import { log } from "../log";
import { sendBatchMatchAlert } from "../email";
import { areAlertsEnabled } from "./index";
import { getSubscriptionStatus } from "../subscriptions";
import { sendMatchPushNotifications, type PushMatchListing } from "./push";
import { batchedIn } from "../freshness";
import { markEmailSent, markPushSent, getUndeliveredMatches } from "../user-matches";

const MAX_LISTINGS_PER_EMAIL = 20;

function sortBufferedMatches(listings: BufferedMatch[]): BufferedMatch[] {
  return [...listings].sort((a, b) => {
    const tA = a.matched_at ? new Date(a.matched_at).getTime() : 0;
    const tB = b.matched_at ? new Date(b.matched_at).getTime() : 0;
    if (tB !== tA) return tB - tA;
    return a.listing_id.localeCompare(b.listing_id);
  });
}

export interface BufferedMatch {
  listing_id: string;
  title: string;
  city: string;
  price: number;
  bedrooms: number;
  size_m2: number;
  url?: string | null;
  image_url?: string | null;
  matched_at?: string;
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

  let bufferMatchQuery = supabase
    .from("matches")
    .select("id, listing_id, created_at")
    .eq("user_id", userId);
  if (premiumStartedAt) {
    bufferMatchQuery = bufferMatchQuery.gte("created_at", premiumStartedAt);
  }
  const { data: matchRows } = await bufferMatchQuery;

  if (!matchRows || matchRows.length === 0) return new Set();

  const enriched = matchRows.map((m: any) => ({
    ...m,
    matched_at: m.created_at,
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

  const existingListings = await batchedIn<any>(
    "listings", "id", listingIds, "id",
    (q: any) => q.not("title", "is", null)
  );

  return new Set(existingListings.map((l: any) => l.id));
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
  let totalPushesSent = 0;

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

    const verified = sortBufferedMatches(deduped.filter(l => appVisibleIds.has(l.listing_id)));

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
      try { await markEmailSent(userId, emailedListingIds); } catch {}
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
      const pushResult = await sendMatchPushNotifications(userId, pushListings, supabase);
      if (pushResult.sent > 0) {
        const pushedIds = verified.map(l => l.listing_id);
        try { await markPushSent(userId, pushedIds); } catch {}
        totalPushesSent += pushResult.sent;
      }
    } catch (err: any) {
      log(`[ALERTS] Push error for user ${userId.substring(0, 8)}...: ${err.message}`);
    }
  }

  _flushing = false;
  log(`[ALERTS] Flush complete: ${sent} sent, ${failed} failed, ${totalPushesSent} pushes, ${skippedNoSub} skipped (no sub), ${skippedEmailOff} skipped (email off)`);
  return { sent, failed, pushesSent: totalPushesSent };
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
  const verified = sortBufferedMatches(deduped.filter(l => appVisibleIds.has(l.listing_id)));

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
    try { await markEmailSent(userId, emailedListingIds); } catch {}
  }

  try {
    const pushListings: PushMatchListing[] = verified.map((l) => ({
      listing_id: l.listing_id,
      city: l.city,
    }));
    const pushResult = await sendMatchPushNotifications(userId, pushListings, supabase);
    if (pushResult.sent > 0) {
      const pushedIds = verified.map(l => l.listing_id);
      try { await markPushSent(userId, pushedIds); } catch {}
    }
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

export async function recoverUndeliveredMatches(supabase: any): Promise<{ recovered: number; sent: number; failed: number }> {
  if (!areAlertsEnabled()) {
    return { recovered: 0, sent: 0, failed: 0 };
  }

  const undelivered = await getUndeliveredMatches(24);
  if (undelivered.length === 0) {
    return { recovered: 0, sent: 0, failed: 0 };
  }

  const byUser = new Map<string, typeof undelivered>();
  for (const m of undelivered) {
    const arr = byUser.get(m.user_id) || [];
    arr.push(m);
    byUser.set(m.user_id, arr);
  }

  log(`[RECOVERY] Found ${undelivered.length} undelivered matches across ${byUser.size} users`);

  for (const [userId, matches] of byUser.entries()) {
    const subStatus = await getSubscriptionStatus(userId);
    const hasAccess = subStatus.isActive || subStatus.isTrial;
    if (!hasAccess) continue;

    const { data: userData } = await supabase.auth.admin.getUserById(userId);
    const email = userData?.user?.email;
    if (!email) continue;

    for (const m of matches) {
      bufferMatchAlert(userId, email, {
        listing_id: m.listing_id,
        title: m.listing_title || "Nieuwe woning",
        city: m.listing_city || "",
        price: Number(m.listing_price) || 0,
        bedrooms: 0,
        size_m2: 0,
        url: m.listing_url,
        matched_at: m.matched_at,
      });
    }
  }

  const bufSize = getBufferSize();
  if (bufSize.listings === 0) {
    log(`[RECOVERY] No listings to flush after filtering`);
    return { recovered: undelivered.length, sent: 0, failed: 0 };
  }

  log(`[RECOVERY] Re-buffered ${bufSize.listings} listings for ${bufSize.users} users — flushing`);
  const result = await flushMatchAlertBuffer(supabase);
  return { recovered: undelivered.length, sent: result.sent, failed: result.failed };
}
