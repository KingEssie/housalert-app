import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { apiFetch } from "@/lib/api-base";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/queryClient";
import { useTranslation } from "@/i18n";
import { isNativePlatform, closeInAppBrowser, consumeCheckoutContext } from "@/lib/capacitor";
import { CheckCircle, Loader2, AlertCircle, RotateCw, LogIn, Smartphone } from "lucide-react";

type Status = "loading" | "deep_link_waiting" | "success" | "error" | "session_missing";
const MAX_RETRIES = 8;

// Retry schedule (ms after mount) for the housalert:// deep-link attempts.
// If Android intercepts any of these the Chrome Custom Tab auto-closes and
// none of the later timers fire.  We never auto-redirect to a browser fallback.
const DEEP_LINK_RETRIES = [0, 1000, 3000];

/** Reads a URL param from both the standard search string and hash-based routing.
 *  In the native Capacitor app (hash router) the URL is:
 *    https://localhost/#/checkout/success?session_id=cs_xxx
 *  so window.location.search is empty — the query string lives inside the hash. */
function getUrlParam(key: string): string | null {
  const searchParams = new URLSearchParams(window.location.search);
  const fromSearch = searchParams.get(key);
  if (fromSearch) return fromSearch;

  const hash = window.location.hash; // e.g. "#/checkout/success?session_id=cs_xxx"
  const qIdx = hash.indexOf("?");
  if (qIdx !== -1) {
    const hashParams = new URLSearchParams(hash.slice(qIdx));
    const fromHash = hashParams.get(key);
    if (fromHash) return fromHash;
  }
  return null;
}

/** Tries to get a valid Supabase session, refreshing if needed.
 *  On native, the WebView may have been in the background during checkout so
 *  the session token could be stale or not yet copied to localStorage. */
async function waitForSession(maxAttempts = 5, delayMs = 1200): Promise<string | null> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      // On the first attempt, explicitly restore auth from Capacitor Preferences.
      // The app may have been suspended while the user was in the payment browser
      // and the Supabase token may not be in localStorage yet.
      if (i === 0) {
        try {
          const { restoreAuthFromNative } = await import("@/lib/capacitor-storage");
          await restoreAuthFromNative();
          console.log("[checkout-success] restoreAuthFromNative() complete");
        } catch {}
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        console.log(`[checkout-success] Session ready on attempt ${i + 1}`);
        return session.access_token;
      }
      if (i < maxAttempts - 1) {
        console.log(`[checkout-success] No session on attempt ${i + 1} — waiting ${delayMs}ms then refreshing...`);
        await new Promise(r => setTimeout(r, delayMs));
        try { await supabase.auth.refreshSession(); } catch {}
      }
    } catch (e) {
      console.warn(`[checkout-success] Session attempt ${i + 1} threw:`, e);
    }
  }
  console.warn("[checkout-success] Could not restore session after all attempts");
  return null;
}

/** Builds the Android intent:// URI for the given Stripe session.
 *
 *  Chrome Custom Tab BLOCKS housalert:// navigations (custom schemes are
 *  rejected silently).  But Chrome explicitly handles intent:// URIs —
 *  it looks up com.housalert.app, fires a VIEW intent with the reconstructed
 *  housalert:// URL, closes the Custom Tab, and opens the native app.
 *
 *  Format:
 *    intent://checkout/success?session_id=...
 *      #Intent;scheme=housalert;package=com.housalert.app;
 *      S.browser_fallback_url=<encoded-https-fallback>;end
 */
function buildIntentUrl(sessionId: string): string {
  const fallback = encodeURIComponent(
    `https://app.housalert.com/checkout/success?session_id=${encodeURIComponent(sessionId)}&from_native=1`
  );
  return (
    `intent://checkout/success?session_id=${encodeURIComponent(sessionId)}` +
    `#Intent;scheme=housalert;package=com.housalert.app;` +
    `S.browser_fallback_url=${fallback};end`
  );
}

export default function CheckoutSuccessPage() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const urlSessionId = getUrlParam("session_id");
  // from_native=1 is appended by the server when creating a Stripe session for
  // a native-app checkout.  It marks that this page was loaded in a Chrome
  // Custom Tab (not in the Capacitor WebView) so we must hand off via intent://.
  const fromNative = getUrlParam("from_native") === "1";
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [deepLinkAttempt, setDeepLinkAttempt] = useState(0);
  const retriesRef = useRef(0);
  const confirmedRef = useRef(false);
  const native = isNativePlatform();

  // ---------------------------------------------------------------------------
  // Routing decision on mount
  //
  //  native=true          → running inside Capacitor WebView (via appUrlOpen or
  //                         browserFinished path) — run confirmSession now.
  //
  //  fromNative=true      → running in Chrome Custom Tab after a native checkout.
  //                         Must use intent:// to hand off back to the native app.
  //                         NEVER auto-navigate to browser fallback.
  //
  //  otherwise            → real web checkout — run confirmSession now.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (native) {
      console.log("[checkout-success] Native context — running confirmSession directly");
      confirmSession();
      return;
    }

    if (!fromNative || !urlSessionId) {
      // Web checkout or missing session_id — process in browser directly.
      console.log(`[checkout-success] Web context (fromNative=${fromNative}, sessionId=${!!urlSessionId}) — running confirmSession`);
      confirmSession();
      return;
    }

    // Chrome Custom Tab from native checkout → show handoff, fire intent:// retries.
    setStatus("deep_link_waiting");
    const intentUrl = buildIntentUrl(urlSessionId);

    function attempt(n: number) {
      console.log(`[deep-link] retry ${n}: ${intentUrl.substring(0, 100)}`);
      setDeepLinkAttempt(n);
      window.location.href = intentUrl;
    }

    attempt(1);

    const timers: ReturnType<typeof setTimeout>[] = [];
    DEEP_LINK_RETRIES.slice(1).forEach((delay, idx) => {
      timers.push(setTimeout(() => attempt(idx + 2), delay));
    });

    // No automatic fallback — user must explicitly choose "Doorgaan in browser".
    return () => timers.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function confirmSession() {
    if (confirmedRef.current) return;

    setStatus("loading");
    setErrorMsg("");
    retriesRef.current = 0;

    console.log(`[checkout-success] Starting — native=${native} href=${window.location.href} hash=${window.location.hash}`);

    // Close any in-app browser that may still be open (App Links re-opened the
    // app but Chrome Custom Tab might still be on screen).
    if (native) {
      try {
        await closeInAppBrowser();
        console.log("[checkout-success] closeInAppBrowser() called");
      } catch {}
    }

    let sessionId = getUrlParam("session_id");
    console.log(`[checkout-success] session_id from URL: ${sessionId?.substring(0, 20) ?? "none"}`);

    if (!sessionId) {
      console.log("[checkout-success] session_id not in URL — checking localStorage fallback");
      const { consumePendingCheckoutSession } = await import("@/lib/capacitor");
      const stored = consumePendingCheckoutSession();
      if (stored) {
        sessionId = stored;
        console.log("[checkout-success] Using localStorage session_id:", stored.substring(0, 20));
      }
    }

    if (!sessionId) {
      console.warn("[checkout-success] No session_id found — showing error");
      setStatus("error");
      setErrorMsg(t("checkoutSuccess.noSession"));
      return;
    }

    if (native) {
      console.log("[checkout-success] Native: waiting for auth session before confirming...");
      const token = await waitForSession(5, 1200);
      if (!token) {
        console.warn("[checkout-success] Auth session unavailable after waiting — proceeding anyway");
      } else {
        console.log("[checkout-success] Auth session restored, proceeding to confirm");
      }
    }

    await pollConfirm(sessionId);
  }

  async function pollConfirm(sessionId: string) {
    if (confirmedRef.current) return;

    try {
      console.log(`[checkout-success] pollConfirm attempt ${retriesRef.current + 1} — session_id:`, sessionId.substring(0, 20));

      const res = await apiFetch("/api/stripe/confirm-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });

      const data = await res.json();

      if (res.status === 202) {
        retriesRef.current++;
        if (retriesRef.current >= MAX_RETRIES) {
          console.warn("[checkout-success] Max retries reached — subscription still processing");
          setStatus("error");
          setErrorMsg(t("checkoutSuccess.stillProcessing"));
          return;
        }
        console.log(`[checkout-success] Still processing (202) — retry ${retriesRef.current}/${MAX_RETRIES} in 3s`);
        await new Promise(r => setTimeout(r, 3000));
        return pollConfirm(sessionId);
      }

      if (res.ok && data.success) {
        console.log("[checkout-success] Confirmed via confirm-session:", data);
        confirmedRef.current = true;
        onSuccess();
        return;
      }

      // Fallback: verify via the token-based endpoint
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      console.log(`[checkout-success] confirm-session failed (${res.status}), token fallback: ${token ? "available" : "missing"}`);

      if (token) {
        const verifyRes = await apiFetch("/api/checkout/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ session_id: sessionId }),
        });
        const verifyData = await verifyRes.json();
        console.log("[checkout-success] verify result:", verifyRes.status, verifyData);

        if (verifyRes.ok && verifyData.success) {
          confirmedRef.current = true;
          try {
            await apiFetch("/api/profile-data", {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ paywall_completed: true, onboarding_completed: true }),
            });
          } catch {}
          onSuccess();
          return;
        }
      }

      if (!token) {
        console.warn("[checkout-success] No auth token and all confirm paths failed — showing session_missing state");
        if (sessionId) {
          try {
            localStorage.setItem("ha_pending_checkout", JSON.stringify({ session_id: sessionId, ts: Date.now() }));
            console.log("[checkout-success] Stored ha_pending_checkout for post-login resume");
          } catch {}
        }
        setStatus("session_missing");
        return;
      }

      console.warn("[checkout-success] All confirmation paths failed:", data.error);
      setStatus("error");
      setErrorMsg(data.error || t("checkoutSuccess.genericError"));
    } catch (err: any) {
      console.error("[checkout-success] Network error:", err);
      setStatus("error");
      setErrorMsg(t("checkoutSuccess.connectionFailed"));
    }
  }

  function onSuccess() {
    setStatus("success");
    queryClient.invalidateQueries({ queryKey: ["/api/subscription/status"] });
    queryClient.invalidateQueries({ queryKey: ["/api/profile-stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
    queryClient.invalidateQueries({ queryKey: ["/api/onboarding-status"] });

    // Read and clear the stored checkout context to decide where to navigate.
    // Falls back to /onboarding/setup when context is missing (safe for all flows).
    const ctx = consumeCheckoutContext();
    const destination = ctx?.next ?? "/onboarding/setup";
    console.log(`[checkout-success] Payment confirmed — source=${ctx?.source ?? "unknown"} navigating to: ${destination}`);
    setTimeout(() => navigate(destination), 2500);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // intent:// format is required for Chrome Custom Tab — Chrome blocks housalert://
  // navigations but explicitly dispatches intent:// URIs to the registered package.
  const intentUrl = urlSessionId ? buildIntentUrl(urlSessionId) : null;

  const iconBg =
    status === "error" ? "var(--ha-danger-light)"
    : status === "session_missing" ? "var(--ha-warning-light, #fffbeb)"
    : status === "deep_link_waiting" ? "#f0fdf4"
    : "var(--ha-primary-light)";

  return (
    <div className="min-h-screen bg-ha-bg flex items-center justify-center px-5" data-testid="page-checkout-success">
      <div className="text-center max-w-sm w-full">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{ background: iconBg }}
        >
          {status === "loading" && <Loader2 className="w-8 h-8 animate-spin text-ha-primary" />}
          {status === "deep_link_waiting" && <Smartphone className="w-8 h-8" style={{ color: "#16a34a" }} />}
          {status === "success" && <CheckCircle className="w-8 h-8 text-ha-success" />}
          {status === "error" && <AlertCircle className="w-8 h-8 text-ha-danger" />}
          {status === "session_missing" && <CheckCircle className="w-8 h-8" style={{ color: "#f59e0b" }} />}
        </div>

        <h1 className="text-[26px] font-semibold text-ha-text mb-2" data-testid="text-checkout-title">
          {status === "loading" && t("checkoutSuccess.loading")}
          {status === "deep_link_waiting" && "Betaling gelukt!"}
          {status === "success" && t("checkoutSuccess.success")}
          {status === "error" && t("checkoutSuccess.error")}
          {status === "session_missing" && t("checkoutSuccess.paymentOk")}
        </h1>

        <p className="text-[15px] text-ha-text-secondary" data-testid="text-checkout-subtitle">
          {status === "loading" && t("checkoutSuccess.loadingSubtitle")}
          {status === "deep_link_waiting" && "Opening HousAlert app…"}
          {status === "success" && t("checkoutSuccess.successSubtitle")}
          {status === "error" && errorMsg}
          {status === "session_missing" && t("checkoutSuccess.sessionMissingSubtitle")}
        </p>

        {/* Deep-link handoff: permanent button + retry status + explicit browser fallback */}
        {status === "deep_link_waiting" && (
          <div className="mt-6 flex flex-col gap-3">
            {/* Primary — intent:// URI, works in Chrome Custom Tab (unlike housalert://) */}
            {intentUrl && (
              <a
                href={intentUrl}
                className="h-[52px] rounded-[12px] text-white text-[16px] font-semibold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform no-underline"
                style={{ background: "rgb(var(--ha-primary))" }}
                data-testid="button-open-app-deep-link"
              >
                <Smartphone className="w-5 h-5" />
                Ga terug naar app
              </a>
            )}

            {/* Retry status indicator */}
            <p className="text-[13px] text-ha-text-secondary" data-testid="text-deep-link-attempt">
              {deepLinkAttempt === 0 && "Verbinden met app…"}
              {deepLinkAttempt === 1 && "App openen… (poging 1/3)"}
              {deepLinkAttempt === 2 && "Opnieuw proberen… (poging 2/3)"}
              {deepLinkAttempt >= 3 && "Nog een keer proberen… (poging 3/3)"}
            </p>

            {/* Secondary — explicit browser fallback, below the fold visually */}
            <div className="mt-2 pt-4 border-t border-ha-border">
              <p className="text-[12px] text-ha-text-secondary mb-2">
                App niet geïnstalleerd?
              </p>
              <button
                onClick={() => { confirmedRef.current = false; confirmSession(); }}
                className="w-full h-[44px] rounded-[10px] text-[14px] font-medium text-ha-text-secondary hover:bg-ha-surface transition-colors border border-ha-border"
                data-testid="button-continue-browser"
              >
                Doorgaan in browser
              </button>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="mt-6 flex flex-col gap-3">
            <button
              onClick={() => { confirmedRef.current = false; confirmSession(); }}
              className="h-[48px] rounded-[10px] text-white text-[15px] font-semibold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
              style={{ background: "rgb(var(--ha-primary))" }}
              data-testid="button-retry-checkout"
            >
              <RotateCw className="w-4 h-4" />
              {t("checkoutSuccess.retry")}
            </button>
            <button
              onClick={() => navigate(native ? "/onboarding/setup" : "/home")}
              className="h-[44px] rounded-[10px] text-[15px] font-medium text-ha-text-secondary hover:bg-ha-surface transition-colors"
              data-testid="button-go-home"
            >
              {t("checkoutSuccess.goToApp")}
            </button>
          </div>
        )}

        {status === "session_missing" && (
          <div className="mt-6 flex flex-col gap-3">
            {/* Primary: intent:// link back into the native app */}
            {intentUrl && (
              <a
                href={intentUrl}
                className="h-[48px] rounded-[10px] text-white text-[15px] font-semibold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform no-underline"
                style={{ background: "rgb(var(--ha-primary))" }}
                data-testid="button-return-to-app"
              >
                <Smartphone className="w-4 h-4" />
                {t("checkoutSuccess.returnToApp", "Terug naar HousAlert")}
              </a>
            )}
            <button
              onClick={() => navigate("/login?next=/onboarding/setup")}
              className="h-[44px] rounded-[10px] text-[15px] font-medium text-ha-text-secondary hover:bg-ha-surface transition-colors"
              data-testid="button-login-continue"
            >
              <LogIn className="w-4 h-4 inline mr-2" />
              {t("checkoutSuccess.loginToContinue")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
