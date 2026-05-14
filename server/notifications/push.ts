import webpush from "web-push";
import { log } from "../log";
import { t, type ServerLocale } from "../i18n";

let initialized = false;

export function initWebPush(): void {
  const publicKey = process.env.VITE_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@housalert.com";

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

export interface PushSendError {
  statusCode?: number;
  message: string;
  endpoint?: string;
  body?: string;
}

export interface PushSendResult {
  sent: number;
  failed: number;
  removed: number;
  errors: PushSendError[];
}

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string; listing_id?: string },
  supabase: any
): Promise<PushSendResult> {
  if (!initialized) {
    log(`[PUSH] Skipped — not initialized`);
    const vapidPublic = process.env.VITE_VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    return {
      sent: 0,
      failed: 0,
      removed: 0,
      errors: [{
        message: `Web Push not initialized. VAPID_PUBLIC=${vapidPublic ? "set" : "MISSING"}, VAPID_PRIVATE=${vapidPrivate ? "set" : "MISSING"}`,
      }],
    };
  }

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (error || !subs || subs.length === 0) {
    log(`[PUSH] No subscriptions for user ${userId.substring(0, 8)}...`);
    return { sent: 0, failed: 0, removed: 0, errors: [] };
  }

  const jsonPayload = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  let removed = 0;
  const errors: PushSendError[] = [];

  for (const sub of subs as PushSubscription[]) {
    const endpointDomain = (() => {
      try { return new URL(sub.endpoint).hostname; } catch { return sub.endpoint?.substring(0, 40) || "unknown"; }
    })();

    if (!sub.endpoint || !sub.p256dh || !sub.auth) {
      const msg = `Malformed subscription id=${sub.id}: missing ${[!sub.endpoint && "endpoint", !sub.p256dh && "p256dh", !sub.auth && "auth"].filter(Boolean).join(", ")}`;
      log(`[PUSH] ${msg}`);
      errors.push({ message: msg, endpoint: endpointDomain });
      failed++;
      continue;
    }

    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        jsonPayload
      );
      sent++;
      log(`[PUSH] Sent to user ${userId.substring(0, 8)}... endpoint=${endpointDomain}`);
    } catch (err: any) {
      const statusCode: number | undefined = err.statusCode;
      const body: string = typeof err.body === "string" ? err.body.substring(0, 300) : JSON.stringify(err.body ?? "").substring(0, 300);
      const errMsg = err.message || String(err);

      log(`[PUSH] Error for user ${userId.substring(0, 8)}... endpoint=${endpointDomain} statusCode=${statusCode ?? "none"} body=${body} message=${errMsg}`);

      if (statusCode === 410 || statusCode === 404) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        removed++;
        log(`[PUSH] Removed stale subscription (${statusCode}) id=${sub.id} endpoint=${endpointDomain}`);
        errors.push({
          statusCode,
          message: `Subscription expired/unregistered (${statusCode}). Removed automatically.`,
          endpoint: endpointDomain,
          body,
        });
      } else if (statusCode === 401) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        removed++;
        log(`[PUSH] Removed subscription with VAPID mismatch (401) id=${sub.id} endpoint=${endpointDomain}`);
        errors.push({
          statusCode: 401,
          message: "Push subscription rejected (401 Unauthorized). This usually means the VAPID keys changed since this subscription was created. The subscription has been removed — the user must re-enable push notifications to create a fresh subscription.",
          endpoint: endpointDomain,
          body,
        });
      } else if (statusCode === 400) {
        failed++;
        errors.push({
          statusCode: 400,
          message: `Bad request (400). Subscription shape may be invalid. body=${body}`,
          endpoint: endpointDomain,
          body,
        });
        log(`[PUSH] Bad request (400) for subscription id=${sub.id} — not removing, may be transient`);
      } else {
        failed++;
        errors.push({
          statusCode,
          message: `Push failed: ${errMsg}`,
          endpoint: endpointDomain,
          body,
        });
      }
    }
  }

  return { sent, failed, removed, errors };
}

export interface PushMatchListing {
  listing_id: string;
  city: string;
}

export async function sendMatchPushNotifications(
  userId: string,
  listings: PushMatchListing[],
  supabase: any,
  lang: ServerLocale = "en"
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
  const cityText = cities.length > 0 ? cities.slice(0, 2).join(", ") : t(lang, "push.yourCity");

  const isSingle = newListings.length === 1;
  const payload = {
    title: t(lang, "push.webTitle"),
    body: isSingle
      ? t(lang, "push.webBody.single", { city: cityText })
      : t(lang, "push.webBody.batch", { count: newListings.length, city: cityText }),
    url: isSingle ? `/apply/${newListings[0].listing_id}` : "/dashboard?tab=matches",
    listing_id: isSingle ? newListings[0].listing_id : undefined,
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

  log(`[PUSH] User ${userId.substring(0, 8)}...: ${result.sent} sent, ${alreadySentIds.size} deduped, ${result.failed} failed, ${result.removed} removed`);
  return { sent: result.sent, skipped: alreadySentIds.size, failed: result.failed };
}
