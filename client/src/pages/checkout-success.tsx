import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { apiFetch } from "@/lib/api-base";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/queryClient";
import { useTranslation } from "@/i18n";
import { consumeCheckoutContext, markPaymentPendingForLogin } from "@/lib/capacitor";
import { CheckCircle, Loader2, AlertCircle, RotateCw, LogIn } from "lucide-react";

type Status = "loading" | "success" | "error" | "session_missing";
const MAX_RETRIES = 8;

/** Reads a URL param from both the standard search string and hash-based routing.
 *  In some environments the query string lives inside the hash fragment:
 *    https://example.com/#/checkout/success?session_id=cs_xxx */
function getUrlParam(key: string): string | null {
  const searchParams = new URLSearchParams(window.location.search);
  const fromSearch = searchParams.get(key);
  if (fromSearch) return fromSearch;

  const hash = window.location.hash;
  const qIdx = hash.indexOf("?");
  if (qIdx !== -1) {
    const hashParams = new URLSearchParams(hash.slice(qIdx));
    const fromHash = hashParams.get(key);
    if (fromHash) return fromHash;
  }
  return null;
}

/** Waits for a valid Supabase session, refreshing if needed.
 *  After a web redirect the browser may briefly have no session in memory. */
async function waitForSession(maxAttempts = 4, delayMs = 800): Promise<string | null> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        console.log(`[checkout-success] Session ready on attempt ${i + 1}`);
        return session.access_token;
      }
      if (i < maxAttempts - 1) {
        console.log(`[checkout-success] No session on attempt ${i + 1} — waiting ${delayMs}ms then refreshing`);
        await new Promise(r => setTimeout(r, delayMs));
        try { await supabase.auth.refreshSession(); } catch {}
      }
    } catch (e) {
      console.warn(`[checkout-success] Session attempt ${i + 1} threw:`, e);
    }
  }
  return null;
}

export default function CheckoutSuccessPage() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const urlSessionId = getUrlParam("session_id");
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const retriesRef = useRef(0);
  const confirmedRef = useRef(false);

  useEffect(() => {
    console.log(`[checkout-success] mount session_id=${urlSessionId ?? "none"}`);
    confirmSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function confirmSession() {
    if (confirmedRef.current) return;
    setStatus("loading");
    setErrorMsg("");
    retriesRef.current = 0;
    console.log(`[checkout-success] Starting — href=${window.location.href}`);

    // Try to get session_id from URL, fall back to localStorage (stored before
    // Stripe redirect so it survives the redirect bounce).
    let sessionId = urlSessionId;
    if (!sessionId) {
      console.log("[checkout-success] session_id not in URL — checking localStorage");
      try {
        const stored = localStorage.getItem("ha_pending_checkout_session_id");
        const ts = parseInt(localStorage.getItem("ha_pending_checkout_ts") || "0", 10);
        if (stored && Date.now() - ts < 30 * 60 * 1000) {
          sessionId = stored;
          localStorage.removeItem("ha_pending_checkout_session_id");
          localStorage.removeItem("ha_pending_checkout_ts");
          console.log("[checkout-success] Using stored session_id:", stored.substring(0, 20));
        }
      } catch {}
    }

    if (!sessionId) {
      console.warn("[checkout-success] No session_id found — showing error");
      setStatus("error");
      setErrorMsg(t("checkoutSuccess.noSession"));
      return;
    }

    // Wait briefly for the auth session — after a Stripe redirect the browser
    // may need a moment to restore the session from storage.
    const token = await waitForSession(4, 800);
    if (!token) {
      console.warn("[checkout-success] Auth session not found — proceeding anyway");
    }

    await pollConfirm(sessionId);
  }

  async function pollConfirm(sessionId: string) {
    if (confirmedRef.current) return;
    try {
      console.log(`[checkout-success] pollConfirm attempt ${retriesRef.current + 1} — session_id: ${sessionId.substring(0, 20)}`);

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
      const accessToken = session?.access_token;
      console.log(`[checkout-success] confirm-session failed (${res.status}), token fallback: ${accessToken ? "available" : "missing"}`);

      if (accessToken) {
        const verifyRes = await apiFetch("/api/checkout/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
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
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({ paywall_completed: true, onboarding_completed: true }),
            });
          } catch {}
          onSuccess();
          return;
        }
      }

      if (!accessToken) {
        console.warn("[checkout-success] No auth token — showing session_missing");
        try {
          localStorage.setItem("ha_pending_checkout", JSON.stringify({ session_id: sessionId, ts: Date.now() }));
        } catch {}
        const pendingNext =
          localStorage.getItem("ha_pending_checkout_next") ??
          sessionStorage.getItem("ha_pending_checkout_next") ??
          "/onboarding/setup";
        markPaymentPendingForLogin(pendingNext);
        setStatus("session_missing");
        setTimeout(() => {
          navigate(`/login?next=${encodeURIComponent(pendingNext)}&payment=success`);
        }, 3000);
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

    const ctx = consumeCheckoutContext();
    const destination = ctx?.next ?? "/onboarding/setup";
    markPaymentPendingForLogin(destination);
    console.log(`[checkout-success] Payment confirmed — source=${ctx?.source ?? "unknown"} navigating to: ${destination}`);

    setTimeout(() => {
      try {
        localStorage.removeItem("ha_pending_checkout_next");
        sessionStorage.removeItem("ha_pending_checkout_next");
        localStorage.removeItem("ha_pending_checkout_success");
        sessionStorage.removeItem("ha_pending_checkout_success");
      } catch {}
      navigate(destination);
    }, 2000);
  }

  const iconBg =
    status === "error" ? "var(--ha-danger-light)"
    : status === "session_missing" ? "var(--ha-warning-light, #fffbeb)"
    : "var(--ha-primary-light)";

  return (
    <div className="min-h-screen bg-ha-bg flex items-center justify-center px-5" data-testid="page-checkout-success">
      <div className="text-center max-w-sm w-full">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{ background: iconBg }}
        >
          {status === "loading" && <Loader2 className="w-8 h-8 animate-spin text-ha-primary" />}
          {status === "success" && <CheckCircle className="w-8 h-8 text-ha-success" />}
          {status === "error" && <AlertCircle className="w-8 h-8 text-ha-danger" />}
          {status === "session_missing" && <CheckCircle className="w-8 h-8" style={{ color: "#f59e0b" }} />}
        </div>

        <h1 className="text-[26px] font-semibold text-ha-text mb-2" data-testid="text-checkout-title">
          {status === "loading" && t("checkoutSuccess.loading")}
          {status === "success" && t("checkoutSuccess.success")}
          {status === "error" && t("checkoutSuccess.error")}
          {status === "session_missing" && t("checkoutSuccess.paymentOk")}
        </h1>

        <p className="text-[15px] text-ha-text-secondary" data-testid="text-checkout-subtitle">
          {status === "loading" && t("checkoutSuccess.loadingSubtitle")}
          {status === "success" && t("checkoutSuccess.successSubtitle")}
          {status === "error" && errorMsg}
          {status === "session_missing" && "Betaling gelukt — log opnieuw in om verder te gaan"}
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
              onClick={() => navigate("/onboarding/setup")}
              className="h-[44px] rounded-[10px] text-[15px] font-medium text-ha-text-secondary hover:bg-ha-surface transition-colors"
              data-testid="button-go-home"
            >
              {t("checkoutSuccess.goToApp")}
            </button>
          </div>
        )}

        {status === "session_missing" && (
          <div className="mt-6 flex flex-col gap-3">
            <button
              onClick={() => navigate("/login?next=/onboarding/setup&payment=success")}
              className="h-[52px] rounded-[12px] text-white text-[16px] font-semibold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
              style={{ background: "rgb(var(--ha-primary))" }}
              data-testid="button-login-again"
            >
              <LogIn className="w-5 h-5" />
              Opnieuw inloggen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
