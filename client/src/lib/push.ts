import { apiFetch } from "@/lib/api-base";

// NOTE: Do NOT read VITE_VAPID_PUBLIC_KEY from import.meta.env here.
// That value is baked into the JS bundle at build time and will be STALE if
// the VAPID key is rotated while the browser (especially Safari PWA) caches
// the old bundle. Always fetch the key from the server at subscribe-time so
// the subscription is always tied to the server's current private key.

export type PushUnsupportedReason =
  | "no-service-worker"
  | "no-push-manager"
  | "no-notification-api"
  | "insecure-context"
  | "ios-not-standalone"
  | "iframe"
  | null;

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return (window.matchMedia("(display-mode: standalone)").matches) ||
    ("standalone" in navigator && (navigator as any).standalone === true);
}

function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function getPushUnsupportedReason(): PushUnsupportedReason {
  if (isInIframe()) return "iframe";
  if (!window.isSecureContext) return "insecure-context";
  if (isIOS() && !isStandalone()) return "ios-not-standalone";
  if (!("serviceWorker" in navigator)) return "no-service-worker";
  if (!("Notification" in window)) return "no-notification-api";
  if (!("PushManager" in window)) return "no-push-manager";
  return null;
}

export function isPushSupported(): boolean {
  return getPushUnsupportedReason() === null;
}

export function getPushPermissionState(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function getPushStatus(accessToken: string): Promise<{
  subscribed: boolean;
  devices: number;
  push_enabled: boolean;
  configured: boolean;
} | null> {
  try {
    const res = await apiFetch("/api/push/status", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/**
 * Fetch the VAPID public key from the server at runtime.
 * This is critical — never use a build-time baked-in key because Safari PWA
 * and other browsers cache the JS bundle and will use the OLD key after a
 * VAPID rotation, producing 403 BadJwtToken errors.
 */
async function fetchVapidPublicKey(): Promise<string | null> {
  try {
    const res = await apiFetch("/api/push/vapid-key");
    if (!res.ok) return null;
    const { publicKey } = await res.json();
    return publicKey || null;
  } catch {
    return null;
  }
}

export async function subscribeToPush(accessToken: string): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    // Always fetch the VAPID key from the server at subscribe time.
    const vapidPublicKey = await fetchVapidPublicKey();
    if (!vapidPublicKey) {
      console.error("[push] Could not fetch VAPID public key from server");
      return false;
    }
    console.log("[push] Using VAPID key prefix:", vapidPublicKey.substring(0, 12) + "...", "length:", vapidPublicKey.length);

    // Register (or get existing) service worker, then force an update so any
    // cached SW is replaced immediately.
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    try { await registration.update(); } catch {}
    await navigator.serviceWorker.ready;

    // Always unsubscribe any existing subscription so the new one is
    // freshly bound to the current server VAPID key.
    const existingSub = await registration.pushManager.getSubscription();
    if (existingSub) {
      console.log("[push] Unsubscribing existing sub endpoint:", existingSub.endpoint.substring(0, 40) + "...");
      await existingSub.unsubscribe();
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    const subJson = subscription.toJSON();
    console.log("[push] New subscription endpoint:", (subJson.endpoint || "").substring(0, 50) + "...");
    console.log("[push] New p256dh prefix:", (subJson.keys?.p256dh || "").substring(0, 8) + "...");
    console.log("[push] New auth prefix:", (subJson.keys?.auth || "").substring(0, 8) + "...");

    const res = await apiFetch("/api/push/register", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        endpoint: subJson.endpoint,
        p256dh: subJson.keys?.p256dh,
        auth: subJson.keys?.auth,
        platform: "web",
        provider: "webpush",
      }),
    });

    return res.ok;
  } catch (err) {
    console.error("[push] subscribe error:", err);
    return false;
  }
}

export async function unsubscribeFromPush(accessToken: string): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    if (registration) {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();

        await apiFetch("/api/push/unregister", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ endpoint }),
        });
      }
    }
    return true;
  } catch (err) {
    console.error("[push] unsubscribe error:", err);
    return false;
  }
}

/**
 * Full browser-side push reset:
 * 1. Unregisters ALL service workers for this origin
 * 2. Unsubscribes from any active push subscription
 * Returns a summary of what was done.
 */
export async function resetPushBrowserSide(): Promise<{
  swsUnregistered: number;
  subUnsubscribed: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  let swsUnregistered = 0;
  let subUnsubscribed = false;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const reg of registrations) {
      try {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          subUnsubscribed = true;
        }
        await reg.unregister();
        swsUnregistered++;
        console.log("[push] Unregistered SW scope:", reg.scope);
      } catch (e: any) {
        errors.push(`SW unregister failed: ${e?.message}`);
      }
    }
  } catch (e: any) {
    errors.push(`getRegistrations failed: ${e?.message}`);
  }

  return { swsUnregistered, subUnsubscribed, errors };
}
