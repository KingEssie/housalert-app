import { apiFetch } from "@/lib/api-base";
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

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

export async function subscribeToPush(accessToken: string): Promise<boolean> {
  if (!isPushSupported() || !VAPID_PUBLIC_KEY) return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;

    const existingSub = await registration.pushManager.getSubscription();
    if (existingSub) {
      await existingSub.unsubscribe();
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    const subJson = subscription.toJSON();

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
