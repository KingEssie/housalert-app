import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _supabase;
}

export type ListingStatus = "active" | "stale" | "removed";

export const STALE_THRESHOLD_HOURS = 48;
export const REMOVED_THRESHOLD_HOURS = 168;

export function computeStatus(lastSeenAt: Date | string, now: Date = new Date()): ListingStatus {
  const lastSeen = typeof lastSeenAt === "string" ? new Date(lastSeenAt) : lastSeenAt;
  const hoursSince = (now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60);

  if (hoursSince >= REMOVED_THRESHOLD_HOURS) return "removed";
  if (hoursSince >= STALE_THRESHOLD_HOURS) return "stale";
  return "active";
}

export function isListingMatchable(status: ListingStatus): boolean {
  return status === "active";
}

let statusColumnAvailable: boolean | null = null;

async function checkStatusColumn(): Promise<boolean> {
  if (statusColumnAvailable !== null) return statusColumnAvailable;
  const supabase = getSupabase();
  const { error } = await supabase
    .from("listing_freshness")
    .select("status")
    .limit(1);
  statusColumnAvailable = !error;
  if (!statusColumnAvailable) {
    console.warn("[listing-status] status column not found on listing_freshness — staleness tracking requires migration 020");
  }
  return statusColumnAvailable;
}

export async function getListingStatus(listingId: string): Promise<ListingStatus | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("listing_freshness")
    .select("last_seen_at, status")
    .eq("listing_id", listingId)
    .maybeSingle();

  if (error || !data) return null;

  if (data.status && (await checkStatusColumn())) {
    return data.status as ListingStatus;
  }

  return computeStatus(data.last_seen_at);
}

export async function getListingStatusBatch(listingIds: string[]): Promise<Record<string, ListingStatus>> {
  if (listingIds.length === 0) return {};
  const supabase = getSupabase();
  const result: Record<string, ListingStatus> = {};

  const BATCH_SIZE = 200;
  for (let i = 0; i < listingIds.length; i += BATCH_SIZE) {
    const batch = listingIds.slice(i, i + BATCH_SIZE);
    const hasStatusCol = await checkStatusColumn();
    const select = hasStatusCol ? "listing_id, last_seen_at, status" : "listing_id, last_seen_at";
    const { data, error } = await supabase
      .from("listing_freshness")
      .select(select)
      .in("listing_id", batch);

    if (error || !data) continue;

    for (const row of data as any[]) {
      if (hasStatusCol && row.status) {
        result[row.listing_id] = row.status as ListingStatus;
      } else {
        result[row.listing_id] = computeStatus(row.last_seen_at);
      }
    }
  }

  for (const id of listingIds) {
    if (!result[id]) {
      result[id] = "active";
    }
  }

  return result;
}

export interface StalenessUpdateResult {
  checked: number;
  staleCount: number;
  removedCount: number;
  reactivatedCount: number;
  errors: number;
}

export async function updateStalenessStatuses(): Promise<StalenessUpdateResult> {
  const supabase = getSupabase();
  const hasStatusCol = await checkStatusColumn();
  const now = new Date();
  const result: StalenessUpdateResult = { checked: 0, staleCount: 0, removedCount: 0, reactivatedCount: 0, errors: 0 };

  if (!hasStatusCol) {
    console.warn("[listing-status] Cannot update statuses — status column not available. Run migration 020.");
    return result;
  }

  const staleThreshold = new Date(now.getTime() - STALE_THRESHOLD_HOURS * 60 * 60 * 1000).toISOString();
  const removedThreshold = new Date(now.getTime() - REMOVED_THRESHOLD_HOURS * 60 * 60 * 1000).toISOString();

  const { data: staleRows, error: e1 } = await supabase
    .from("listing_freshness")
    .update({ status: "stale", status_changed_at: now.toISOString() })
    .lt("last_seen_at", staleThreshold)
    .gte("last_seen_at", removedThreshold)
    .or("status.is.null,status.eq.active")
    .select("listing_id");

  if (e1) {
    console.error("[listing-status] Error updating stale:", e1.message);
    result.errors++;
  } else {
    result.staleCount = staleRows?.length ?? 0;
  }

  const { data: removedRows, error: e2 } = await supabase
    .from("listing_freshness")
    .update({ status: "removed", status_changed_at: now.toISOString() })
    .lt("last_seen_at", removedThreshold)
    .or("status.is.null,status.eq.active,status.eq.stale")
    .select("listing_id");

  if (e2) {
    console.error("[listing-status] Error updating removed:", e2.message);
    result.errors++;
  } else {
    result.removedCount = removedRows?.length ?? 0;
  }

  const { data: reactivatedRows, error: e3 } = await supabase
    .from("listing_freshness")
    .update({ status: "active", status_changed_at: now.toISOString() })
    .gte("last_seen_at", staleThreshold)
    .or("status.eq.stale,status.eq.removed")
    .select("listing_id");

  if (e3) {
    console.error("[listing-status] Error reactivating:", e3.message);
    result.errors++;
  } else {
    result.reactivatedCount = reactivatedRows?.length ?? 0;
  }

  result.checked = result.staleCount + result.removedCount + result.reactivatedCount;

  return result;
}

export async function getStatusSummary(): Promise<{ active: number; stale: number; removed: number; unknown: number; total: number }> {
  const supabase = getSupabase();
  const hasStatusCol = await checkStatusColumn();

  const summary = { active: 0, stale: 0, removed: 0, unknown: 0, total: 0 };

  if (!hasStatusCol) {
    const { count } = await supabase.from("listing_freshness").select("listing_id", { count: "exact", head: true });
    summary.unknown = count ?? 0;
    summary.total = summary.unknown;
    return summary;
  }

  const statuses: ListingStatus[] = ["active", "stale", "removed"];
  for (const s of statuses) {
    const { count } = await supabase
      .from("listing_freshness")
      .select("listing_id", { count: "exact", head: true })
      .eq("status", s);
    summary[s] = count ?? 0;
  }

  const { count: nullCount } = await supabase
    .from("listing_freshness")
    .select("listing_id", { count: "exact", head: true })
    .is("status", null);
  summary.unknown = nullCount ?? 0;

  summary.total = summary.active + summary.stale + summary.removed + summary.unknown;
  return summary;
}
