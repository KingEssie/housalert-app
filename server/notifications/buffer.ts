import { log } from "../log";
import { sendBatchMatchAlert } from "../email";
import { areAlertsEnabled } from "./index";
import { getSubscriptionStatus } from "../subscriptions";

const MAX_LISTINGS_PER_EMAIL = 20;

export interface BufferedMatch {
  listing_id: string;
  title: string;
  city: string;
  price: number;
  bedrooms: number;
  size_m2: number;
  url?: string | null;
}

interface UserBuffer {
  email: string;
  seenListingIds: Set<string>;
  listings: BufferedMatch[];
}

const buffer = new Map<string, UserBuffer>();
let _flushing = false;

export function bufferMatchAlert(
  userId: string,
  userEmail: string,
  listing: BufferedMatch
): void {
  if (!areAlertsEnabled()) return;

  if (!listing.listing_id) {
    log(`[ALERTS] Skipping buffer — missing listing_id for "${listing.title}"`);
    return;
  }

  const existing = buffer.get(userId);
  if (existing) {
    if (existing.seenListingIds.has(listing.listing_id)) return;
    existing.seenListingIds.add(listing.listing_id);
    existing.listings.push(listing);
  } else {
    const seenListingIds = new Set<string>([listing.listing_id]);
    buffer.set(userId, { email: userEmail, seenListingIds, listings: [listing] });
  }
}

export async function flushMatchAlertBuffer(supabase: any): Promise<{ sent: number; failed: number }> {
  if (!areAlertsEnabled()) {
    buffer.clear();
    return { sent: 0, failed: 0 };
  }

  if (_flushing) {
    log(`[ALERTS] Flush already in progress — skipping`);
    return { sent: 0, failed: 0 };
  }

  if (buffer.size === 0) {
    return { sent: 0, failed: 0 };
  }

  _flushing = true;

  const snapshot = new Map(buffer);
  buffer.clear();

  const totalRawListings = Array.from(snapshot.values()).reduce((s, u) => s + u.listings.length, 0);
  log(`[ALERTS] Flushing match alert buffer: ${snapshot.size} users, ${totalRawListings} total raw listings`);

  let sent = 0;
  let failed = 0;
  let skippedNoSub = 0;
  let skippedEmailOff = 0;

  for (const [userId, { email, listings }] of snapshot.entries()) {
    if (!email) continue;

    const subStatus = await getSubscriptionStatus(userId);
    const hasAccess = subStatus.isActive || subStatus.isTrial;

    if (!hasAccess) {
      skippedNoSub++;
      log(`[ALERTS] Skipping user ${userId.substring(0, 8)}... — no active subscription (status=${subStatus.status})`);
      continue;
    }

    const { data: settings, error: settingsErr } = await supabase
      .from("user_notification_settings")
      .select("email_enabled")
      .eq("user_id", userId)
      .maybeSingle();

    if (settingsErr) {
      log(`[ALERTS] Settings read error for user ${userId.substring(0, 8)}... — skipping (safe default)`);
      continue;
    }

    const emailEnabled = settings?.email_enabled ?? true;
    if (!emailEnabled) {
      skippedEmailOff++;
      log(`[ALERTS] Skipping user ${userId.substring(0, 8)}... (email_enabled=false)`);
      continue;
    }

    const deduped: BufferedMatch[] = [];
    const seenIds = new Set<string>();
    for (const l of listings) {
      if (seenIds.has(l.listing_id)) continue;
      seenIds.add(l.listing_id);
      deduped.push(l);
    }

    const validListingIds = deduped.map(l => l.listing_id);
    if (validListingIds.length > 0) {
      const { data: existingListings } = await supabase
        .from("listings")
        .select("id")
        .in("id", validListingIds)
        .not("title", "is", null);

      const existingIds = new Set((existingListings ?? []).map((l: any) => l.id));
      const beforeCount = deduped.length;
      const verified = deduped.filter(l => existingIds.has(l.listing_id));

      if (verified.length < beforeCount) {
        log(`[ALERTS] User ${userId.substring(0, 8)}...: ${beforeCount - verified.length} listings removed (not found/no title)`);
      }

      if (verified.length === 0) {
        log(`[ALERTS] User ${userId.substring(0, 8)}...: 0 eligible listings after verification — skipping email`);
        continue;
      }

      const capped = verified.slice(0, MAX_LISTINGS_PER_EMAIL);

      log(`[ALERTS] User ${userId.substring(0, 8)}...: raw=${listings.length} → deduped=${deduped.length} → verified=${verified.length} → emailed=${capped.length}`);

      try {
        const success = await sendBatchMatchAlert(email, capped);
        if (success) {
          sent++;
          log(`[ALERTS] Sent digest to ${email} with ${capped.length} listings${verified.length > MAX_LISTINGS_PER_EMAIL ? ` (capped from ${verified.length})` : ""}`);
        } else {
          failed++;
          log(`[ALERTS] Failed digest to ${email}`);
        }
      } catch (err: any) {
        failed++;
        log(`[ALERTS] Error sending digest to ${email}: ${err.message}`);
      }
    } else {
      log(`[ALERTS] User ${userId.substring(0, 8)}...: 0 eligible listings — skipping email`);
    }
  }

  _flushing = false;
  log(`[ALERTS] Flush complete: ${sent} sent, ${failed} failed, ${skippedNoSub} skipped (no sub), ${skippedEmailOff} skipped (email off)`);
  return { sent, failed };
}

export async function flushUserAlerts(userId: string, supabase: any): Promise<void> {
  if (!areAlertsEnabled()) {
    buffer.delete(userId);
    return;
  }

  const userBuf = buffer.get(userId);
  if (!userBuf || userBuf.listings.length === 0) return;

  buffer.delete(userId);

  if (!userBuf.email) return;

  const subStatus = await getSubscriptionStatus(userId);
  if (!subStatus.isActive && !subStatus.isTrial) {
    log(`[ALERTS] Skipping backfill flush for user ${userId.substring(0, 8)}... — no active subscription`);
    return;
  }

  const { data: settings, error: settingsErr } = await supabase
    .from("user_notification_settings")
    .select("email_enabled")
    .eq("user_id", userId)
    .maybeSingle();

  if (settingsErr || !(settings?.email_enabled ?? true)) return;

  const deduped: BufferedMatch[] = [];
  const seenIds = new Set<string>();
  for (const l of userBuf.listings) {
    if (seenIds.has(l.listing_id)) continue;
    seenIds.add(l.listing_id);
    deduped.push(l);
  }

  const validListingIds = deduped.map(l => l.listing_id);
  if (validListingIds.length > 0) {
    const { data: existingListings } = await supabase
      .from("listings")
      .select("id")
      .in("id", validListingIds)
      .not("title", "is", null);

    const existingIds = new Set((existingListings ?? []).map((l: any) => l.id));
    const verified = deduped.filter(l => existingIds.has(l.listing_id));

    if (verified.length === 0) {
      log(`[ALERTS] Backfill: 0 eligible listings after verification — skipping email`);
      return;
    }

    const capped = verified.slice(0, MAX_LISTINGS_PER_EMAIL);

    try {
      await sendBatchMatchAlert(userBuf.email, capped);
      log(`[ALERTS] Sent backfill digest to ${userBuf.email} with ${capped.length} listings (from ${userBuf.listings.length} raw)`);
    } catch (err: any) {
      log(`[ALERTS] Error sending backfill digest: ${err.message}`);
    }
  }
}

export function getBufferSize(): { users: number; listings: number } {
  let listings = 0;
  for (const u of buffer.values()) listings += u.listings.length;
  return { users: buffer.size, listings };
}

export function clearBuffer(): void {
  buffer.clear();
}
