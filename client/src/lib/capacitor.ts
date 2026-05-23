const NATIVE_CACHE_KEY = "ha_native_v1";

function getCap(): any {
  return (window as any).Capacitor;
}

/**
 * Run at module-load time to detect native context and persist it.
 * Must run before any SPA navigation strips the ?native=1 query param.
 */
function detectNativeOnStartup(): void {
  try {
    // Real Capacitor bridge
    if (getCap()?.isNativePlatform?.() === true) {
      localStorage.setItem(NATIVE_CACHE_KEY, "capacitor");
      return;
    }
    // Expo WebView injected flag (set by injectedJavaScriptBeforeContentLoaded)
    if ((window as any).__HOUSALERT_NATIVE__ === true) {
      if (localStorage.getItem(NATIVE_CACHE_KEY) !== "capacitor") {
        localStorage.setItem(NATIVE_CACHE_KEY, "expo");
      }
      return;
    }
    // URL param ?native=1 — must capture BEFORE router strips it
    if (new URLSearchParams(window.location.search).get("native") === "1") {
      if (localStorage.getItem(NATIVE_CACHE_KEY) !== "capacitor") {
        localStorage.setItem(NATIVE_CACHE_KEY, "expo");
      }
      (window as any).__HOUSALERT_NATIVE__ = true;
      return;
    }
  } catch {}
}

// Run immediately at module load — before React renders, before routing
detectNativeOnStartup();

/** True only when running inside a real Capacitor WebView (native bridge present). */
export function isCapacitorNative(): boolean {
  return getCap()?.isNativePlatform?.() === true;
}

/**
 * True when running inside the Expo React Native WebView wrapper.
 * The native layer (mobile-clean/App.tsx) handles Expo push token registration.
 * The web UI should NOT call Capacitor APIs — they don't exist here.
 *
 * Detection order (most to least reliable):
 *  1. window.__HOUSALERT_NATIVE__ injected by App.tsx
 *  2. localStorage cache written by main.tsx at startup (before routing strips URL)
 *  3. ?native=1 URL param (only works before SPA router navigates away)
 *  4. Android WebView UA fingerprint ("wv" token) — reliable fallback
 */
export function isExpoWebView(): boolean {
  if (isCapacitorNative()) return false;
  if ((window as any).__HOUSALERT_NATIVE__ === true) return true;
  try {
    if (localStorage.getItem(NATIVE_CACHE_KEY) === "expo") return true;
  } catch {}
  try {
    if (new URLSearchParams(window.location.search).get("native") === "1") return true;
  } catch {}
  // Android WebView always includes "wv" in the UA string — this app's
  // production web URL is never intentionally opened inside 3rd-party WebViews,
  // so this is a safe signal that we're inside the Expo wrapper.
  if (/Android.*wv\b/.test(navigator.userAgent)) return true;
  return false;
}

/**
 * True when running in any native context (Capacitor OR Expo WebView).
 * Use isCapacitorNative() / isExpoWebView() for specific behavior.
 */
export function isNativePlatform(): boolean {
  return isCapacitorNative() || isExpoWebView();
}

export function getPlatform(): string {
  if (isCapacitorNative()) return getCap()?.getPlatform?.() ?? "android";
  try {
    const p = (window as any).__HOUSALERT_PLATFORM__;
    if (p) return p;
  } catch {}
  return "web";
}

export async function initCapacitorPlugins(): Promise<void> {
  if (!isCapacitorNative()) return;

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#111111' });
  } catch {}

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch {}
}

/**
 * Register for push notifications via Capacitor PushNotifications plugin.
 * Only valid in isCapacitorNative() context. Returns Expo token or null.
 */
export async function registerNativePush(): Promise<string | null> {
  if (!isCapacitorNative()) return null;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted') return null;

    await PushNotifications.register();

    return new Promise((resolve) => {
      PushNotifications.addListener('registration', (token) => {
        resolve(token.value);
      });
      PushNotifications.addListener('registrationError', () => {
        resolve(null);
      });
      setTimeout(() => resolve(null), 5000);
    });
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Checkout browser — opens Stripe in an in-app browser (Capacitor Browser
// plugin / Chrome Custom Tabs) on native, and via window.location on web.
// ---------------------------------------------------------------------------

const PENDING_SESSION_KEY = "ha_pending_checkout_session_id";
const PENDING_SESSION_TS_KEY = "ha_pending_checkout_ts";
const SESSION_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

export function savePendingCheckoutSession(sessionId: string): void {
  try {
    localStorage.setItem(PENDING_SESSION_KEY, sessionId);
    localStorage.setItem(PENDING_SESSION_TS_KEY, Date.now().toString());
    console.log("[checkout-browser] Saved pending session:", sessionId.substring(0, 20) + "...");
  } catch {}
}

/**
 * Reads and clears the pending checkout session from localStorage.
 * Returns null if absent or older than SESSION_MAX_AGE_MS.
 */
export function consumePendingCheckoutSession(): string | null {
  try {
    const sessionId = localStorage.getItem(PENDING_SESSION_KEY);
    const ts = parseInt(localStorage.getItem(PENDING_SESSION_TS_KEY) || "0", 10);
    localStorage.removeItem(PENDING_SESSION_KEY);
    localStorage.removeItem(PENDING_SESSION_TS_KEY);
    if (!sessionId) return null;
    if (Date.now() - ts > SESSION_MAX_AGE_MS) {
      console.log("[checkout-browser] Pending session expired — discarding");
      return null;
    }
    console.log("[checkout-browser] Consumed pending session:", sessionId.substring(0, 20) + "...");
    return sessionId;
  } catch {
    return null;
  }
}

/**
 * Opens a Stripe checkout URL.
 * - Native: uses @capacitor/browser (Chrome Custom Tabs) so the WebView/session
 *   stays intact while the user pays. Saves sessionId for the browserFinished fallback.
 * - Web: standard window.location redirect.
 */
export async function openCheckoutBrowser(url: string, sessionId: string): Promise<void> {
  savePendingCheckoutSession(sessionId);
  if (isCapacitorNative()) {
    try {
      const { Browser } = await import('@capacitor/browser');
      console.log("[checkout-browser] Opening Stripe in in-app browser (native)");
      await Browser.open({ url, presentationStyle: 'fullscreen', toolbarColor: '#1A1A1A' });
    } catch (err) {
      console.warn("[checkout-browser] Browser plugin failed — falling back to window.location:", err);
      window.location.href = url;
    }
  } else {
    window.location.href = url;
  }
}

/**
 * Programmatically closes the in-app browser (e.g. when the checkout-success
 * page is reached via an App Link and the Custom Tab is still open).
 */
export async function closeInAppBrowser(): Promise<void> {
  if (!isCapacitorNative()) return;
  try {
    const { Browser } = await import('@capacitor/browser');
    await Browser.close();
    console.log("[checkout-browser] In-app browser closed");
  } catch {}
}

// ---------------------------------------------------------------------------
// Checkout context — stores the intended post-payment destination so that
// checkout-success.tsx can continue the correct flow (onboarding vs upgrade)
// regardless of which entry point triggered the checkout.
// ---------------------------------------------------------------------------

const CHECKOUT_CONTEXT_KEY = "ha_checkout_context";
const CHECKOUT_CONTEXT_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

export interface CheckoutContext {
  /** Which UI surface triggered the checkout (for logging/analytics). */
  source: string;
  /** Route to navigate to after successful payment confirmation. */
  next: string;
  ts: number;
}

// Pending-next keys — written before checkout opens so that the login page
// can recover the destination even if auth is lost during payment.
const PENDING_CHECKOUT_NEXT_KEY    = "ha_pending_checkout_next";
const PENDING_CHECKOUT_SUCCESS_KEY = "ha_pending_checkout_success";

/** Writes the post-payment destination to both localStorage and sessionStorage. */
export function savePendingCheckoutNext(next: string): void {
  try {
    localStorage.setItem(PENDING_CHECKOUT_NEXT_KEY, next);
    sessionStorage.setItem(PENDING_CHECKOUT_NEXT_KEY, next);
    console.log(`[checkout-context] saved pending next=${next}`);
  } catch {}
}

/** Reads and clears the pending next destination from any storage. */
export function consumePendingCheckoutNext(): string | null {
  try {
    const next =
      localStorage.getItem(PENDING_CHECKOUT_NEXT_KEY) ??
      sessionStorage.getItem(PENDING_CHECKOUT_NEXT_KEY);
    localStorage.removeItem(PENDING_CHECKOUT_NEXT_KEY);
    sessionStorage.removeItem(PENDING_CHECKOUT_NEXT_KEY);
    localStorage.removeItem(PENDING_CHECKOUT_SUCCESS_KEY);
    sessionStorage.removeItem(PENDING_CHECKOUT_SUCCESS_KEY);
    return next;
  } catch {
    return null;
  }
}

/** Marks that a payment succeeded so the login page can act on it. */
export function markPaymentPendingForLogin(next: string): void {
  try {
    localStorage.setItem(PENDING_CHECKOUT_SUCCESS_KEY, "true");
    sessionStorage.setItem(PENDING_CHECKOUT_SUCCESS_KEY, "true");
    localStorage.setItem(PENDING_CHECKOUT_NEXT_KEY, next);
    sessionStorage.setItem(PENDING_CHECKOUT_NEXT_KEY, next);
  } catch {}
}

export function saveCheckoutContext(ctx: Omit<CheckoutContext, "ts">): void {
  try {
    const full: CheckoutContext = { ...ctx, ts: Date.now() };
    const serialized = JSON.stringify(full);
    // Dual-write: localStorage survives app restarts; sessionStorage survives
    // within-session navigation where localStorage may be cleared by the OS.
    localStorage.setItem(CHECKOUT_CONTEXT_KEY, serialized);
    sessionStorage.setItem(CHECKOUT_CONTEXT_KEY, serialized);
    // Also persist the destination independently so the login page can recover
    // the correct route even if the checkout context is lost.
    savePendingCheckoutNext(ctx.next);
    console.log(`[checkout-context] saved source=${ctx.source} next=${ctx.next}`);
  } catch {}
}

/**
 * Reads and clears the stored checkout context.
 * Returns null if absent or older than 2 hours.
 */
export function consumeCheckoutContext(): CheckoutContext | null {
  try {
    const raw =
      localStorage.getItem(CHECKOUT_CONTEXT_KEY) ??
      sessionStorage.getItem(CHECKOUT_CONTEXT_KEY);
    localStorage.removeItem(CHECKOUT_CONTEXT_KEY);
    sessionStorage.removeItem(CHECKOUT_CONTEXT_KEY);
    if (!raw) return null;
    const ctx: CheckoutContext = JSON.parse(raw);
    if (Date.now() - ctx.ts > CHECKOUT_CONTEXT_MAX_AGE_MS) {
      console.log("[checkout-context] Context expired — discarding");
      return null;
    }
    console.log(`[checkout-context] Consumed: source=${ctx.source} next=${ctx.next}`);
    return ctx;
  } catch {
    return null;
  }
}

/**
 * Registers a listener for when the in-app browser closes (either because
 * the user navigated to a deep-link that re-opened the app, pressed back, or
 * Stripe's success page triggered an App Link).
 *
 * Returns a cleanup function that removes the listener.
 */
export async function setupBrowserFinishedListener(
  onFinished: (sessionId: string | null) => void
): Promise<() => void> {
  if (!isCapacitorNative()) return () => {};
  try {
    const { Browser } = await import('@capacitor/browser');
    const handle = await Browser.addListener('browserFinished', () => {
      const sessionId = consumePendingCheckoutSession();
      console.log("[checkout-browser] browserFinished — pending session:", sessionId ?? "none");
      onFinished(sessionId);
    });
    return () => { handle.remove(); };
  } catch (err) {
    console.warn("[checkout-browser] Could not register browserFinished listener:", err);
    return () => {};
  }
}

/**
 * Registers a listener for App Link / deep link URL opens.
 * Fires when another app (e.g. Chrome Custom Tabs redirected by Stripe) opens
 * the native app via an intent filter match.
 *
 * Returns a cleanup function that removes the listener.
 */
export async function setupDeepLinkListener(
  onUrl: (url: string) => void
): Promise<() => void> {
  if (!isCapacitorNative()) return () => {};
  try {
    const { App } = await import('@capacitor/app');
    const handle = await App.addListener('appUrlOpen', (data: { url: string }) => {
      console.log("[deep-link] appUrlOpen received:", data.url);
      onUrl(data.url);
    });
    return () => { handle.remove(); };
  } catch (err) {
    console.warn("[deep-link] Could not register appUrlOpen listener:", err);
    return () => {};
  }
}
