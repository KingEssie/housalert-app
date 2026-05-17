import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { apiFetch } from "@/lib/api-base";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/queryClient";
import { useTranslation } from "@/i18n";
import { isNativePlatform, closeInAppBrowser } from "@/lib/capacitor";
import { CheckCircle, Loader2, AlertCircle, RotateCw, LogIn } from "lucide-react";

type Status = "loading" | "success" | "error" | "session_missing";
const MAX_RETRIES = 8;

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

export default function CheckoutSuccessPage() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  // Read session_id from URL once at component level so the session_missing
  // UI can build a deep-link back into the native app.
  const urlSessionId = getUrlParam("session_id");
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const retriesRef = useRef(0);
  const confirmedRef = useRef(false);
  const native = isNativePlatform();

  // When this page loads inside Chrome Custom Tab (after Stripe redirects to the
  // https:// success URL), immediately attempt a deep-link back into the native app.
  // If the housalert:// intent-filter is registered in AndroidManifest.xml, Android
  // intercepts the URL, auto-closes the Custom Tab, and fires appUrlOpen in the app.
  // If not registered this is a silent no-op and the user sees the visible fallback button.
  useEffect(() => {
    if (native) return;          // already inside native app — no redirect needed
    if (!urlSessionId) return;   // no session_id → nothing to redirect
    const deepLink = `housalert://checkout/success?session_id=${encodeURIComponent(urlSessionId)}`;
    console.log("[checkout-success] Browser context with session_id — attempting deep-link:", deepLink.substring(0, 80));
    window.location.href = deepLink;
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
      await closeInAppBrowser();
    }

    // On native, wait for the auth session to be available (the WebView was
    // backgrounded during checkout so the token may need a refresh cycle).
    let sessionId = getUrlParam("session_id");
    console.log(`[checkout-success] session_id from URL: ${sessionId?.substring(0, 20) ?? "none"}`);

    if (!sessionId) {
      // Fallback: the browserFinished path stores the session_id in localStorage
      // before navigating here.  consumePendingCheckoutSession() already read and
      // cleared it in the DeepLinkHandler, but if we land here via a direct
      // browser-finished navigate the id is already encoded in the URL.
      // This branch handles edge-cases where the URL parse above failed.
      console.log("[checkout-success] session_id not in URL — checking localStorage fallback");
      const { consumePendingCheckoutSession } = await import("@/lib/capacitor");
      const stored = consumePendingCheckoutSession();
      if (stored) {
        sessionId = stored;
        console.log("[checkout-success] Using localStorage session_id:", stored.substring(0, 20));
      }
    }

    if (!sessionId) {
      console.warn("[checkout-success] No session_id found — redirecting to setup");
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

      // No auth session available — payment likely succeeded but the user was
      // logged out while in the background. Store the session_id so that after
      // the user logs in again, the login page resumes the checkout flow.
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
    console.log("[checkout-success] Payment confirmed — invalidating cache and redirecting to onboarding/setup");
    setStatus("success");
    queryClient.invalidateQueries({ queryKey: ["/api/subscription/status"] });
    queryClient.invalidateQueries({ queryKey: ["/api/profile-stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
    queryClient.invalidateQueries({ queryKey: ["/api/onboarding-status"] });
    setTimeout(() => navigate("/onboarding/setup"), 2500);
  }

  useEffect(() => {
    confirmSession();
  }, []);

  return (
    <div className="min-h-screen bg-ha-bg flex items-center justify-center px-5" data-testid="page-checkout-success">
      <div className="text-center max-w-sm">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{
            background: status === "error"
              ? "var(--ha-danger-light)"
              : status === "session_missing"
              ? "var(--ha-warning-light, #fffbeb)"
              : "var(--ha-primary-light)",
          }}
        >
          {status === "loading" && <Loader2 className="w-8 h-8 animate-spin text-ha-primary" />}
          {status === "success" && <CheckCircle className="w-8 h-8 text-ha-success" />}
          {status === "error" && <AlertCircle className="w-8 h-8 text-ha-danger" />}
          {status === "session_missing" && <CheckCircle className="w-8 h-8" style={{ color: "#f59e0b" }} />}
        </div>

        <h1 className="text-[30px] font-semibold text-ha-text mb-2" data-testid="text-checkout-title">
          {status === "loading" && t("checkoutSuccess.loading")}
          {status === "success" && t("checkoutSuccess.success")}
          {status === "error" && t("checkoutSuccess.error")}
          {status === "session_missing" && t("checkoutSuccess.paymentOk")}
        </h1>

        <p className="text-[15px] text-ha-text-secondary" data-testid="text-checkout-subtitle">
          {status === "loading" && t("checkoutSuccess.loadingSubtitle")}
          {status === "success" && t("checkoutSuccess.successSubtitle")}
          {status === "error" && errorMsg}
          {status === "session_missing" && t("checkoutSuccess.sessionMissingSubtitle")}
        </p>

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
            {/* Primary action: deep-link back into the native app.
                Works from Chrome Custom Tab — Android intercepts housalert://
                and opens the app, which then processes the session_id via
                the DeepLinkHandler → CheckoutSuccessPage with a live session. */}
            {urlSessionId && (
              <a
                href={`housalert://checkout/success?session_id=${encodeURIComponent(urlSessionId)}`}
                className="h-[48px] rounded-[10px] text-white text-[15px] font-semibold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform no-underline"
                style={{ background: "rgb(var(--ha-primary))" }}
                data-testid="button-return-to-app"
              >
                {t("checkoutSuccess.returnToApp", "Terug naar HousAlert")}
              </a>
            )}
            {/* Fallback: log in via the web flow.
                The ha_pending_checkout entry in localStorage ensures the login
                page resumes the checkout automatically after a successful login. */}
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
