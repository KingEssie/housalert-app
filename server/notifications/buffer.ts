import { log } from "../log";
import { sendBatchMatchAlert } from "../email";
import { areAlertsEnabled } from "./index";
import { getSubscriptionStatus } from "../subscriptions";
import { sendMatchPushNotifications, type PushMatchListing } from "./push";
import { sendExpoMatchPush, type ExpoMatchListing } from "./expo-push";
import { batchedIn } from "../freshness";
import { markEmailSent, markPushSent, getUndeliveredMatches } from "../user-matches";
import { pool as pgPool } from "../pg-pool";

const MAX_LISTINGS_PER_EMAIL = 20;
const IMAGE_FETCH_TIMEOUT_MS = 5000;
const ALLOWED_FETCH_HOSTS = ["www.wg-gesucht.de", "wg-gesucht.de", "www.immowelt.de", "immowelt.de", "www.kleinanzeigen.de", "kleinanzeigen.de"];
const MAX_IMAGE_FETCHES_PER_FLUSH = 5;
let _flushImageBudget = 0;

function isAllowedListingUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && ALLOWED_FETCH_HOSTS.some(h => parsed.hostname === h || parsed.hostname.endsWith("." + h));
  } catch {
    return false;
  }
}

async function fetchListingImage(url: string): Promise<string | null> {
  if (!isAllowedListingUrl(url)) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
      signal: controller.signal,
    });
    if (!resp.ok) { clearTimeout(timer); return null; }
    const html = await resp.text();
    clearTimeout(timer);
    const ogMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)
      || html.match(/<meta\s+content="([^"]+)"\s+property="og:image"/i);
    if (ogMatch?.[1] && ogMatch[1].startsWith("https://")) return ogMatch[1];
    const imgMatch = html.match(/https:\/\/img\.wg-gesucht\.de\/media\/up\/[^"'\s]+\.(?:jpg|jpeg|png|webp)/i);
    if (imgMatch?.[0]) return imgMatch[0];
    const immoMatch = html.match(/https:\/\/mms\.immowelt\.de\/[^"'\s]+\.(?:jpg|jpeg|png|webp)/i);
    if (immoMatch?.[0]) return immoMatch[0];
    return null;
  } catch {
    return null;
  }
}

async function enrichMissingImages(listings: BufferedMatch[], supabase: any): Promise<void> {
  const needImage = listings.filter(l => !l.image_url && l.url && isAllowedListingUrl(l.url));
  if (needImage.length === 0) return;
  if (_flushImageBudget <= 0) return;

  const toFetch = needImage.slice(0, _flushImageBudget);
  _flushImageBudget -= toFetch.length;

  log(`[ALERTS] Enriching images for ${toFetch.length} listings without photos (budget remaining: ${_flushImageBudget})`);

  const results = await Promise.allSettled(
    toFetch.map(async (l) => {
      const imgUrl = await fetchListingImage(l.url!);
      if (imgUrl) {
        l.image_url = imgUrl;
        const { error: dbErr } = await supabase
          .from("listings")
          .update({ image_url: imgUrl })
          .eq("id", l.listing_id);
        if (dbErr) {
          log(`[ALERTS] Image persist failed for ${l.listing_id}: ${dbErr.message}`);
        }
        log(`[ALERTS] Enriched image for "${l.title.substring(0, 40)}": ${imgUrl.substring(0, 80)}`);
      }
      return imgUrl;
    })
  );

  const enriched = results.filter(r => r.status === "fulfilled" && r.value).length;
  log(`[ALERTS] Image enrichment: ${enriched}/${toFetch.length} successful`);
}

function sortBufferedMatches(listings: BufferedMatch[]): BufferedMatch[] {
  return [...listings].sort((a, b) => {
    const tA = a.matched_at ? new Date(a.matched_at).getTime() : 0;
    const tB = b.matched_at ? new Date(b.matched_at).getTime() : 0;
    if (tB !== tA) return tB - tA;
    return a.listing_id.localeCompare(b.listing_id);
  });
}

interface BuddyInfo {
  email: string;
  enabled: boolean;
}

async function getSearchBuddyInfo(userId: string): Promise<BuddyInfo | null> {
  try {
    const { rows } = await pgPool.query(
      "SELECT search_buddy_email, search_buddy_enabled FROM user_profile_data WHERE user_id = $1 LIMIT 1",
      [userId]
    );
    if (!rows[0]) return null;
    const email = rows[0].search_buddy_email?.trim();
    const enabled = rows[0].search_buddy_enabled === true;
    if (!email) return null;
    return { email, enabled };
  } catch (err: any) {
    log(`[ALERTS] Failed to fetch buddy info for ${userId.substring(0, 8)}...: ${err.message}`);
    return null;
  }
}

async function sendBuddyEmail(
  userId: string,
  mainUserEmail: string,
  buddyInfo: BuddyInfo,
  capped: BufferedMatch[],
  context: string
): Promise<boolean> {
  if (!buddyInfo.enabled) {
    log(`[ALERTS] ${context} Buddy skip for ${userId.substring(0, 8)}...: toggle OFF`);
    return false;
  }
  if (buddyInfo.email.toLowerCase() === mainUserEmail.toLowerCase()) {
    log(`[ALERTS] ${context} Buddy skip for ${userId.substring(0, 8)}...: same email as main user (duplicate prevention)`);
    return false;
  }
  try {
    const success = await sendBatchMatchAlert(buddyInfo.email, capped);
    if (success) {
      log(`[ALERTS] ${context} Buddy email sent to ${buddyInfo.email} for user ${userId.substring(0, 8)}... (${capped.length} listings)`);
    } else {
      log(`[ALERTS] ${context} Buddy email FAILED to ${buddyInfo.email} for user ${userId.substring(0, 8)}...`);
    }
    return success;
  } catch (err: any) {
    log(`[ALERTS] ${context} Buddy email ERROR for ${userId.substring(0, 8)}...: ${err.message}`);
    return false;
  }
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

async function getAppVisibleListingIds(userId: string, supabase: any, candidateListingIds?: string[]): Promise<Set<string>> {
  if (candidateListingIds && candidateListingIds.length > 0) {
    const { data: subRow } = await supabase
      .from("subscriptions")
      .select("created_at")
      .eq("user_id", userId)
      .single();
    const premiumStartedAt = subRow?.created_at || null;

    let matchQuery = supabase
      .from("matches")
      .select("listing_id, created_at")
      .eq("user_id", userId)
      .in("listing_id", candidateListingIds);
    if (premiumStartedAt) {
      matchQuery = matchQuery.gte("created_at", premiumStartedAt);
    }
    const { data: matchRows } = await matchQuery;

    if (!matchRows || matchRows.length === 0) return new Set();

    const matchedIds = matchRows.map((m: any) => m.listing_id);

    const existingListings = await batchedIn<any>(
      "listings", "id", matchedIds, "id",
      (q: any) => q.not("title", "is", null)
    );

    return new Set(existingListings.map((l: any) => l.id));
  }

  const { data: subRow } = await supabase
    .from("subscriptions")
    .select("created_at")
    .eq("user_id", userId)
    .single();
  const premiumStartedAt = subRow?.created_at || null;

  let allMatchRows: any[] = [];
  let page = 0;
  const PAGE_SIZE = 1000;
  while (true) {
    let q = supabase
      .from("matches")
      .select("id, listing_id, created_at")
      .eq("user_id", userId)
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (premiumStartedAt) {
      q = q.gte("created_at", premiumStartedAt);
    }
    const { data: batch } = await q;
    if (!batch || batch.length === 0) break;
    allMatchRows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    page++;
    if (page > 10) break;
  }

  if (allMatchRows.length === 0) return new Set();

  const dedupedByListing: Record<string, any> = {};
  for (const m of allMatchRows) {
    if (!dedupedByListing[m.listing_id]) {
      dedupedByListing[m.listing_id] = m;
    }
  }
  let uniqueMatches = Object.values(dedupedByListing);

  if (premiumStartedAt) {
    const premiumStart = new Date(premiumStartedAt).getTime();
    uniqueMatches = uniqueMatches.filter((m: any) => {
      return new Date(m.created_at).getTime() >= premiumStart;
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
  _flushImageBudget = MAX_IMAGE_FETCHES_PER_FLUSH;

  try {
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

    const buddyInfo = await getSearchBuddyInfo(userId);

    if (!emailEnabled && !pushEnabled && !buddyInfo?.enabled) {
      skippedEmailOff++;
      const skipIds = listings.map(l => l.listing_id);
      try { await markEmailSent(userId, skipIds); } catch {}
      try { await markPushSent(userId, skipIds); } catch {}
      log(`[ALERTS] Skipping user ${userId.substring(0, 8)}... (email_enabled=false, push_enabled=false, no active buddy) — marked ${skipIds.length} as sent`);
      continue;
    }

    const deduped: BufferedMatch[] = [];
    const seenIds = new Set<string>();
    for (const l of listings) {
      if (seenIds.has(l.listing_id)) continue;
      seenIds.add(l.listing_id);
      deduped.push(l);
    }

    const candidateIds = deduped.map(l => l.listing_id);
    const appVisibleIds = await getAppVisibleListingIds(userId, supabase, candidateIds);

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
    const allVerifiedIds = verified.map(l => l.listing_id);

    if (!emailEnabled) {
      try { await markEmailSent(userId, allVerifiedIds); } catch {}
    }
    if (!pushEnabled) {
      try { await markPushSent(userId, allVerifiedIds); } catch {}
    }

    if (emailEnabled) {
      const capped = verified.slice(0, MAX_LISTINGS_PER_EMAIL);
      await enrichMissingImages(capped, supabase);
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

    if (buddyInfo) {
      const buddyCapped = verified.slice(0, MAX_LISTINGS_PER_EMAIL);
      await sendBuddyEmail(userId, email, buddyInfo, buddyCapped, "[FLUSH]");
    } else {
      log(`[ALERTS] Buddy skip for ${userId.substring(0, 8)}...: no buddy email configured`);
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

    if (pushEnabled) {
      const pushStart = Date.now();
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
        log(`[ALERTS] Web push error for user ${userId.substring(0, 8)}...: ${err.message}`);
      }

      try {
        const expoListings: ExpoMatchListing[] = verified.map((l) => ({
          listing_id: l.listing_id,
          title: l.title,
          city: l.city,
          price: l.price,
          url: l.url,
        }));
        const expoResult = await sendExpoMatchPush(userId, expoListings);
        if (expoResult.sent > 0) {
          totalPushesSent += expoResult.sent;
          const expoPushedIds = verified.map(l => l.listing_id);
          try { await markPushSent(userId, expoPushedIds); } catch {}
        }
      } catch (err: any) {
        log(`[ALERTS] Expo push error for user ${userId.substring(0, 8)}...: ${err.message}`);
      }

      const pushDuration = Date.now() - pushStart;
      log(`[LATENCY] match→push dispatch for user ${userId.substring(0, 8)}...: ${pushDuration}ms (${verified.length} listings)`);
    }
  }

  log(`[ALERTS] Flush complete: ${sent} emails sent, ${failed} failed, ${totalPushesSent} pushes, ${skippedNoSub} skipped (no sub), ${skippedEmailOff} skipped (all off)`);
  return { sent, failed, pushesSent: totalPushesSent };
  } finally {
    _flushing = false;
  }
}

export async function flushUserAlerts(userId: string, supabase: any): Promise<void> {
  if (!areAlertsEnabled()) {
    buffer.delete(userId);
    return;
  }

  _flushImageBudget = MAX_IMAGE_FETCHES_PER_FLUSH;

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

  const backfillBuddyCheck = await getSearchBuddyInfo(userId);

  if (!emailEnabled && !pushEnabled && !backfillBuddyCheck?.enabled) {
    const skipIds = userBuf.listings.map(l => l.listing_id);
    try { await markEmailSent(userId, skipIds); } catch {}
    try { await markPushSent(userId, skipIds); } catch {}
    log(`[ALERTS] Backfill: both channels off, no active buddy — marked ${skipIds.length} as sent`);
    return;
  }

  const deduped: BufferedMatch[] = [];
  const seenIds = new Set<string>();
  for (const l of userBuf.listings) {
    if (seenIds.has(l.listing_id)) continue;
    seenIds.add(l.listing_id);
    deduped.push(l);
  }

  const candidateIds = deduped.map(l => l.listing_id);
  const appVisibleIds = await getAppVisibleListingIds(userId, supabase, candidateIds);
  const verified = sortBufferedMatches(deduped.filter(l => appVisibleIds.has(l.listing_id)));

  if (verified.length < deduped.length) {
    log(`[ALERTS] Backfill: ${deduped.length - verified.length} listings dropped (not visible in app)`);
  }

  if (verified.length === 0) {
    log(`[ALERTS] Backfill: 0 eligible listings after app-visibility check — skipping alerts`);
    return;
  }

  const emailedListingIds: string[] = [];
  const allVerifiedIds = verified.map(l => l.listing_id);

  if (!emailEnabled) {
    try { await markEmailSent(userId, allVerifiedIds); } catch {}
  }
  if (!pushEnabled) {
    try { await markPushSent(userId, allVerifiedIds); } catch {}
  }

  if (emailEnabled) {
    const capped = verified.slice(0, MAX_LISTINGS_PER_EMAIL);
    await enrichMissingImages(capped, supabase);
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

  if (backfillBuddyCheck && userBuf.email) {
    const buddyCapped = verified.slice(0, MAX_LISTINGS_PER_EMAIL);
    await sendBuddyEmail(userId, userBuf.email, backfillBuddyCheck, buddyCapped, "[BACKFILL]");
  }

  if (emailedListingIds.length > 0) {
    const prev = recentEmailedIds.get(userId);
    const combined = prev ? [...prev.listing_ids, ...emailedListingIds] : emailedListingIds;
    recentEmailedIds.set(userId, { listing_ids: combined, timestamp: Date.now() });
    try { await markEmailSent(userId, emailedListingIds); } catch {}
  }

  if (pushEnabled) {
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
      log(`[ALERTS] Backfill web push error for user ${userId.substring(0, 8)}...: ${err.message}`);
    }

    try {
      const expoListings: ExpoMatchListing[] = verified.map((l) => ({
        listing_id: l.listing_id,
        title: l.title,
        city: l.city,
        price: l.price,
        url: l.url,
      }));
      const expoResult = await sendExpoMatchPush(userId, expoListings);
      if (expoResult.sent > 0) {
        const expoPushedIds = verified.map(l => l.listing_id);
        try { await markPushSent(userId, expoPushedIds); } catch {}
      }
    } catch (err: any) {
      log(`[ALERTS] Backfill expo push error for user ${userId.substring(0, 8)}...: ${err.message}`);
    }
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
    log(`[RECOVERY] Skipped — ALERTS_ENABLED=${process.env.ALERTS_ENABLED}`);
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

  let skippedNoSub = 0;
  let skippedNoEmail = 0;
  let buffered = 0;

  for (const [userId, matches] of byUser.entries()) {
    const subStatus = await getSubscriptionStatus(userId);
    const hasAccess = subStatus.isActive || subStatus.isTrial;
    if (!hasAccess) {
      skippedNoSub += matches.length;
      log(`[RECOVERY] User ${userId.substring(0, 8)}: skipped ${matches.length} matches (no active subscription, status=${subStatus.status})`);
      continue;
    }

    const { data: notifSettings } = await supabase
      .from("user_notification_settings")
      .select("email_enabled, push_enabled")
      .eq("user_id", userId)
      .maybeSingle();
    const emailOn = notifSettings?.email_enabled ?? true;
    const pushOn = notifSettings?.push_enabled ?? false;
    const recoveryBuddy = await getSearchBuddyInfo(userId);
    if (!emailOn && !pushOn && !recoveryBuddy?.enabled) {
      const skipIds = matches.map(m => m.listing_id);
      try { await markEmailSent(userId, skipIds); } catch {}
      try { await markPushSent(userId, skipIds); } catch {}
      log(`[RECOVERY] User ${userId.substring(0, 8)}: notifications off, no active buddy — marked ${skipIds.length} as sent, skipping`);
      continue;
    }

    const subStartTime = subStatus.created_at ? new Date(subStatus.created_at).getTime() : Date.now();
    const eligibleMatches = matches.filter(m => {
      const matchTime = new Date(m.matched_at).getTime();
      return matchTime >= subStartTime;
    });
    const skippedOld = matches.length - eligibleMatches.length;
    if (skippedOld > 0) {
      const oldIds = matches.filter(m => new Date(m.matched_at).getTime() < subStartTime).map(m => m.listing_id);
      try { await markEmailSent(userId, oldIds); } catch {}
      try { await markPushSent(userId, oldIds); } catch {}
      log(`[RECOVERY] User ${userId.substring(0, 8)}: ${skippedOld} matches older than subscription start — marked as sent`);
    }
    if (eligibleMatches.length === 0) {
      log(`[RECOVERY] User ${userId.substring(0, 8)}: 0 eligible matches after subscription-start filter`);
      continue;
    }

    const { data: userData } = await supabase.auth.admin.getUserById(userId);
    const email = userData?.user?.email;
    if (!email) {
      skippedNoEmail += eligibleMatches.length;
      log(`[RECOVERY] User ${userId.substring(0, 8)}: skipped ${eligibleMatches.length} matches (no email found)`);
      continue;
    }

    log(`[RECOVERY] User ${userId.substring(0, 8)}: buffering ${eligibleMatches.length} matches for ${email} (${skippedOld} pre-sub filtered out)`);

    const listingIds = eligibleMatches.map(m => m.listing_id);
    let enrichMap = new Map<string, { image_url: string | null; bedrooms: number; size_m2: number; created_at: string | null }>();
    try {
      const { data: listingRows } = await supabase
        .from("listings")
        .select("id, image_url, bedrooms, size_m2, created_at")
        .in("id", listingIds);
      if (listingRows) {
        for (const row of listingRows) {
          enrichMap.set(row.id, {
            image_url: row.image_url || null,
            bedrooms: row.bedrooms || 0,
            size_m2: row.size_m2 || 0,
            created_at: row.created_at || null,
          });
        }
      }
    } catch (err: any) {
      log(`[RECOVERY] Failed to fetch listing details: ${err.message}`);
    }

    let skippedPreSub = 0;
    for (const m of eligibleMatches) {
      const enriched = enrichMap.get(m.listing_id);
      if (enriched?.created_at) {
        const listingTime = new Date(enriched.created_at).getTime();
        if (listingTime < subStartTime) {
          skippedPreSub++;
          try { await markEmailSent(userId, [m.listing_id]); } catch {}
          try { await markPushSent(userId, [m.listing_id]); } catch {}
          continue;
        }
      }
      bufferMatchAlert(userId, email, {
        listing_id: m.listing_id,
        title: m.listing_title || "Nieuwe woning",
        city: m.listing_city || "",
        price: Number(m.listing_price) || 0,
        bedrooms: enriched?.bedrooms || 0,
        size_m2: enriched?.size_m2 || 0,
        url: m.listing_url,
        image_url: enriched?.image_url || null,
        matched_at: m.matched_at,
      });
      buffered++;
    }
    if (skippedPreSub > 0) {
      log(`[RECOVERY] User ${userId.substring(0, 8)}: ${skippedPreSub} listings created before subscription — marked sent`);
    }
  }

  log(`[RECOVERY] Summary: total=${undelivered.length} buffered=${buffered} skippedNoSub=${skippedNoSub} skippedNoEmail=${skippedNoEmail}`);

  const bufSize = getBufferSize();
  if (bufSize.listings === 0) {
    log(`[RECOVERY] No listings to flush after filtering`);
    return { recovered: undelivered.length, sent: 0, failed: 0 };
  }

  log(`[RECOVERY] Flushing ${bufSize.listings} listings for ${bufSize.users} users`);
  const result = await flushMatchAlertBuffer(supabase);
  log(`[RECOVERY] Flush result: sent=${result.sent} failed=${result.failed}`);
  return { recovered: undelivered.length, sent: result.sent, failed: result.failed };
}
