import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let freshnessAvailable: boolean | null = null;
let rpcAvailable: boolean | null = null;

async function checkTableExists(): Promise<boolean> {
  if (freshnessAvailable === false) return false;
  const { error } = await supabase
    .from("listing_freshness")
    .select("listing_id")
    .limit(1);
  if (error) {
    if (freshnessAvailable === null) {
      console.warn("[freshness] listing_freshness table not available in Supabase — freshness tracking disabled until migration is applied");
    }
    freshnessAvailable = false;
    return false;
  }
  freshnessAvailable = true;
  return true;
}

async function upsertViaRpc(
  listingId: string,
  source: string,
  sourceId: string,
  now: string
): Promise<boolean> {
  const { error } = await supabase.rpc("upsert_listing_freshness", {
    p_listing_id: listingId,
    p_source: source,
    p_source_id: sourceId,
    p_now: now,
  });
  if (error) {
    if (rpcAvailable === null) {
      console.warn("[freshness] RPC upsert_listing_freshness not available, using fallback");
    }
    rpcAvailable = false;
    return false;
  }
  rpcAvailable = true;
  return true;
}

async function upsertViaFallback(
  listingId: string,
  source: string,
  sourceId: string,
  now: string
): Promise<void> {
  const { data: existing } = await supabase
    .from("listing_freshness")
    .select("listing_id")
    .eq("listing_id", listingId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("listing_freshness")
      .update({ last_seen_at: now })
      .eq("listing_id", listingId);
  } else {
    const { error } = await supabase.from("listing_freshness").insert({
      listing_id: listingId,
      source,
      source_id: sourceId,
      first_seen_at: now,
      last_seen_at: now,
    });
    if (error && error.code === "23505") {
      await supabase
        .from("listing_freshness")
        .update({ last_seen_at: now })
        .eq("listing_id", listingId);
    } else if (error) {
      console.error("[freshness] trackListingSeen insert failed:", error.message);
    }
  }
}

export async function trackListingSeen(
  listingId: string,
  source: string,
  sourceId: string
): Promise<void> {
  if (!(await checkTableExists())) return;

  const now = new Date().toISOString();

  if (rpcAvailable !== false) {
    const ok = await upsertViaRpc(listingId, source, sourceId, now);
    if (ok) return;
  }

  await upsertViaFallback(listingId, source, sourceId, now);
}

const SUPABASE_IN_BATCH_SIZE = 200;

export async function batchedIn<T>(
  table: string,
  column: string,
  ids: string[],
  selectCols: string,
  extraFilters?: (q: any) => any
): Promise<T[]> {
  if (ids.length === 0) return [];
  const results: T[] = [];
  for (let i = 0; i < ids.length; i += SUPABASE_IN_BATCH_SIZE) {
    const batch = ids.slice(i, i + SUPABASE_IN_BATCH_SIZE);
    let q = supabase.from(table).select(selectCols).in(column, batch);
    if (extraFilters) q = extraFilters(q);
    const { data, error } = await q;
    if (error || !data) {
      console.warn(`[batchedIn] ${table}.${column} batch ${i / SUPABASE_IN_BATCH_SIZE + 1} failed:`, error?.message || "no data");
      continue;
    }
    results.push(...(data as T[]));
  }
  return results;
}

export async function getListingFreshness(
  listingIds: string[]
): Promise<
  Record<string, { first_seen_at: string; last_seen_at: string }>
> {
  if (listingIds.length === 0) return {};
  if (freshnessAvailable === false) return {};

  const rows = await batchedIn<any>(
    "listing_freshness",
    "listing_id",
    listingIds,
    "listing_id, first_seen_at, last_seen_at"
  );

  const result: Record<string, { first_seen_at: string; last_seen_at: string }> = {};
  for (const row of rows) {
    result[row.listing_id] = {
      first_seen_at: row.first_seen_at,
      last_seen_at: row.last_seen_at,
    };
  }
  return result;
}

export interface FreshListingRow {
  listing_id: string;
  source: string;
  first_seen_at: string;
}

export async function getNewestListingIds(
  limit: number
): Promise<FreshListingRow[]> {
  if (freshnessAvailable === false) return [];

  const { data: rows, error } = await supabase
    .from("listing_freshness")
    .select("listing_id, source, first_seen_at")
    .order("first_seen_at", { ascending: false })
    .limit(limit);

  if (error || !rows) return [];

  return rows.map((r: any) => ({
    listing_id: r.listing_id,
    source: r.source,
    first_seen_at: r.first_seen_at,
  }));
}

let matchTableAvailable: boolean | null = null;

export async function trackMatchCreated(matchId: string): Promise<void> {
  if (matchTableAvailable === false) return;

  const now = new Date().toISOString();
  const { error } = await supabase.from("match_timestamps").upsert(
    { match_id: matchId, matched_at: now },
    { onConflict: "match_id", ignoreDuplicates: true }
  );

  if (error) {
    if (matchTableAvailable === null) {
      console.warn("[freshness] match_timestamps table not available — timestamp tracking disabled until migration is applied");
    }
    matchTableAvailable = false;
  } else {
    matchTableAvailable = true;
  }
}

export async function getMatchTimestamps(
  matchIds: string[]
): Promise<Record<string, string>> {
  if (matchIds.length === 0) return {};
  if (matchTableAvailable === false) return {};

  const rows = await batchedIn<any>(
    "match_timestamps",
    "match_id",
    matchIds,
    "match_id, matched_at"
  );

  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.match_id] = row.matched_at;
  }
  return result;
}
