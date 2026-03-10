import { log } from "../log";
import { sendBatchMatchAlert } from "../email";
import { areAlertsEnabled } from "./index";
import { getSubscriptionStatus } from "../subscriptions";
import { sendMatchPushNotifications, type PushMatchListing } from "./push";
import { getMatchTimestamps } from "../freshness";

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

const recentEmailedIds = new Map<string, { listing_ids: string[]; timestamp: number }>();

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

async function getAppVisibleListingIds(userId: string, supabase: any): Promise<Set<string>> {
  const { data: subRow } = await supabase
    .from("subscriptions")
    .select("created_at")
    .eq("user_id", userId)
    .single();
  const premiumStartedAt = subRow?.created_at || null;

  const { data: matchRows } = await supabase
    .from("matches")
    .select("id, listing_id, created_at")
    .eq("user_id", userId);

  if (!matchRows || matchRows.length === 0) return new Set();

  const matchIds = matchRows.map((m: any) => m.id);
  const matchTimestamps = await getMatchTimestamps(matchIds);

  const enriched = matchRows.map((m: any) => ({
    ...m,
    matched_at: matchTimestamps[m.id] || m.created_at,
  }));
  enriched.sort((a: any, b: any) =>
    new Date(b.matched_at).getTime() - new Date(a.matched_at).getTime()
  );

  const dedupedByListing: Record<string, any> = {};
  for (const m of enriched) {
    if (!dedupedByListing[m.listing_id]) {
      dedupedByListing[m.listing_id] = m;
    }
  }
  let uniqueMatches = Object.values(dedupedByListing);

  if (premiumStartedAt) {
    const premiumStart = new Date(premiumStartedAt).getTime();
    uniqueMatches = uniqueMatches.filter((m: any) => {
      return new Date(m.matched_at).getTime() >= premiumStart;
    });
  }

  const listingIds = uniqueMatches.map((m: any) => m.listing_id);
  if (listingIds.length === 0) return new Set();

  const { data: existingListings } = await supabase
    .from("listings")
    .select("id")
    .in("id", listingIds)
    .not("title", "is", null);

  return new Set((existingListings ?? []).map((l: any) => l.id));
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
      .select("email_enabled, push_enabled")
      .eq("user_id", userId)
      .maybeSingle();

    if (settingsErr) {
      log(`[ALERTS] Settings read error for user ${userId.substring(0, 8)}... — skipping (safe default)`);
      continue;
    }

    const emailEnabled = settings?.email_enabled ?? true;
    const pushEnabled = settings?.push_enabled ?? false;

    if (!emailEnabled && !pushEnabled) {
      skippedEmailOff++;
      log(`[ALERTS] Skipping user ${userId.substring(0, 8)}... (email_enabled=false, push_enabled=false)`);
      continue;
    }

    const deduped: BufferedMatch[] = [];
    const seenIds = new Set<string>();
    for (const l of listings) {
      if (seenIds.has(l.listing_id)) continue;
      seenIds.add(l.listing_id);
      deduped.push(l);
    }

    const appVisibleIds = await getAppVisibleListingIds(userId, supabase);

    const verified = deduped.filter(l => appVisibleIds.has(l.listing_id));

    if (verified.length < deduped.length) {
      const dropped = deduped.length - verified.length;
      log(`[ALERTS] User ${userId.substring(0, 8)}...: ${dropped} listings dropped (not visible in app — premium filter, missing listing, or dedup)`);
    }

    if (verified.length === 0) {
      log(`[ALERTS] User ${userId.substring(0, 8)}...: 0 eligible listings after app-visibility check — skipping alerts`);
      continue;
    }

    log(`[ALERTS] User ${userId.substring(0, 8)}...: raw=${listings.length} → deduped=${deduped.length} → app-visible=${verified.length}`);

    const emailedListingIds: string[] = [];

    if (emailEnabled) {
      const capped = verified.slice(0, MAX_LISTINGS_PER_EMAIL);
      try {
        const success = await sendBatchMatchAlert(email, capped);
        if (success) {
          sent++;
          emailedListingIds.push(...capped.map(l => l.listing_id));
          log(`[ALERTS] Sent digest to ${email} with ${capped.length} listings${verified.length > MAX_LISTINGS_PER_EMAIL ? ` (capped from ${verified.length})` : ""}`);
        } else {
          failed++;
          log(`[ALERTS] Failed digest to ${email}`);
        }
      } catch (err: any) {
        failed++;
        log(`[ALERTS] Error sending digest to ${email}: ${err.message}`);
      }
    }

    if (emailedListingIds.length > 0) {
      recentEmailedIds.set(userId, { listing_ids: emailedListingIds, timestamp: Date.now() });
      const MAX_HISTORY = 100;
      if (recentEmailedIds.size > MAX_HISTORY) {
        const oldest = [...recentEmailedIds.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
        for (let i = 0; i < oldest.length - MAX_HISTORY; i++) {
          recentEmailedIds.delete(oldest[i][0]);
        }
      }
    }

    try {
      const pushListings: PushMatchListing[] = verified.map((l) => ({
        listing_id: l.listing_id,
        city: l.city,
      }));
      await sendMatchPushNotifications(userId, pushListings, supabase);
    } catch (err: any) {
      log(`[ALERTS] Push error for user ${userId.substring(0, 8)}...: ${err.message}`);
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
    .select("email_enabled, push_enabled")
    .eq("user_id", userId)
    .maybeSingle();

  const emailEnabled = settingsErr ? true : (settings?.email_enabled ?? true);
  const pushEnabled = settingsErr ? false : (settings?.push_enabled ?? false);

  if (!emailEnabled && !pushEnabled) return;

  const deduped: BufferedMatch[] = [];
  const seenIds = new Set<string>();
  for (const l of userBuf.listings) {
    if (seenIds.has(l.listing_id)) continue;
    seenIds.add(l.listing_id);
    deduped.push(l);
  }

  const appVisibleIds = await getAppVisibleListingIds(userId, supabase);
  const verified = deduped.filter(l => appVisibleIds.has(l.listing_id));

  if (verified.length < deduped.length) {
    log(`[ALERTS] Backfill: ${deduped.length - verified.length} listings dropped (not visible in app)`);
  }

  if (verified.length === 0) {
    log(`[ALERTS] Backfill: 0 eligible listings after app-visibility check — skipping alerts`);
    return;
  }

  const emailedListingIds: string[] = [];

  if (emailEnabled) {
    const capped = verified.slice(0, MAX_LISTINGS_PER_EMAIL);
    try {
      const success = await sendBatchMatchAlert(userBuf.email, capped);
      if (success) {
        emailedListingIds.push(...capped.map(l => l.listing_id));
      }
      log(`[ALERTS] Sent backfill digest to ${userBuf.email} with ${capped.length} listings (from ${userBuf.listings.length} raw)`);
    } catch (err: any) {
      log(`[ALERTS] Error sending backfill digest: ${err.message}`);
    }
  }

  if (emailedListingIds.length > 0) {
    const prev = recentEmailedIds.get(userId);
    const combined = prev ? [...prev.listing_ids, ...emailedListingIds] : emailedListingIds;
    recentEmailedIds.set(userId, { listing_ids: combined, timestamp: Date.now() });
  }

  try {
    const pushListings: PushMatchListing[] = verified.map((l) => ({
      listing_id: l.listing_id,
      city: l.city,
    }));
    await sendMatchPushNotifications(userId, pushListings, supabase);
  } catch (err: any) {
    log(`[ALERTS] Backfill push error for user ${userId.substring(0, 8)}...: ${err.message}`);
  }
}

export function getRecentEmailedIds(userId: string): { listing_ids: string[]; timestamp: number } | null {
  return recentEmailedIds.get(userId) || null;
}

export function getBufferSize(): { users: number; listings: number } {
  let listings = 0;
  for (const u of buffer.values()) listings += u.listings.length;
  return { users: buffer.size, listings };
}

export function clearBuffer(): void {
  buffer.clear();
}
