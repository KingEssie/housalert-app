import webpush from "web-push";
import { log } from "../log";

let initialized = false;

export function initWebPush(): void {
  const publicKey = process.env.VITE_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@housalert.de";

  if (!publicKey || !privateKey) {
    log("[PUSH] VAPID keys not configured — push notifications disabled");
    return;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  initialized = true;
  log("[PUSH] Web Push initialized with VAPID keys");
}

export function isPushInitialized(): boolean {
  return initialized;
}

interface PushSubscription {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string },
  supabase: any
): Promise<{ sent: number; failed: number; removed: number }> {
  if (!initialized) {
    log(`[PUSH] Skipped — not initialized`);
    return { sent: 0, failed: 0, removed: 0 };
  }

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (error || !subs || subs.length === 0) {
    log(`[PUSH] No subscriptions for user ${userId.substring(0, 8)}...`);
    return { sent: 0, failed: 0, removed: 0 };
  }

  const jsonPayload = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  let removed = 0;

  for (const sub of subs as PushSubscription[]) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        jsonPayload
      );
      sent++;
      log(`[PUSH] Sent to user ${userId.substring(0, 8)}... endpoint=${sub.endpoint.substring(0, 40)}...`);
    } catch (err: any) {
      const statusCode = err.statusCode;
      if (statusCode === 410 || statusCode === 404) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        removed++;
        log(`[PUSH] Removed stale subscription (${statusCode}) for user ${userId.substring(0, 8)}...`);
      } else {
        failed++;
        log(`[PUSH] Failed for user ${userId.substring(0, 8)}...: ${err.message || err}`);
      }
    }
  }

  return { sent, failed, removed };
}

export interface PushMatchListing {
  listing_id: string;
  city: string;
}

export async function sendMatchPushNotifications(
  userId: string,
  listings: PushMatchListing[],
  supabase: any
): Promise<{ sent: number; skipped: number; failed: number }> {
  if (!initialized) {
    return { sent: 0, skipped: 0, failed: 0 };
  }

  const { data: settings } = await supabase
    .from("user_notification_settings")
    .select("push_enabled")
    .eq("user_id", userId)
    .maybeSingle();

  if (!settings?.push_enabled) {
    log(`[PUSH] Skipped user ${userId.substring(0, 8)}... — push_enabled=false`);
    return { sent: 0, skipped: listings.length, failed: 0 };
  }

  const listingIds = listings.map((l) => l.listing_id);
  const { data: alreadySent } = await supabase
    .from("push_sent_log")
    .select("listing_id")
    .eq("user_id", userId)
    .in("listing_id", listingIds);

  const alreadySentIds = new Set((alreadySent ?? []).map((r: any) => r.listing_id));
  const newListings = listings.filter((l) => !alreadySentIds.has(l.listing_id));

  if (newListings.length === 0) {
    log(`[PUSH] Skipped user ${userId.substring(0, 8)}... — all ${listings.length} listings already pushed`);
    return { sent: 0, skipped: listings.length, failed: 0 };
  }

  const cities = [...new Set(newListings.map((l) => l.city).filter(Boolean))];
  const cityText = cities.length > 0 ? cities.slice(0, 2).join(", ") : "deiner Stadt";

  const payload = {
    title: "Neue Wohnung gefunden",
    body:
      newListings.length === 1
        ? `Eine neue Wohnung passt zu deinem Suchprofil in ${cityText}.`
        : `${newListings.length} neue Wohnungen passen zu deinem Suchprofil in ${cityText}.`,
    url: "/dashboard?tab=matches",
  };

  const result = await sendPushToUser(userId, payload, supabase);

  if (result.sent > 0) {
    const logEntries = newListings.map((l) => ({
      user_id: userId,
      listing_id: l.listing_id,
    }));

    const { error: logError } = await supabase
      .from("push_sent_log")
      .upsert(logEntries, { onConflict: "user_id,listing_id", ignoreDuplicates: true });

    if (logError) {
      log(`[PUSH] Warning: failed to log sent pushes for user ${userId.substring(0, 8)}...: ${logError.message}`);
    }
  }

  log(`[PUSH] User ${userId.substring(0, 8)}...: ${result.sent} sent, ${alreadySentIds.size} deduped, ${result.failed} failed`);
  return { sent: result.sent, skipped: alreadySentIds.size, failed: result.failed };
}
