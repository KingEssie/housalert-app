import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { apiFetch } from "@/lib/api-base";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/queryClient";
import { CheckCircle, Loader2, AlertCircle, RotateCw } from "lucide-react";

type Status = "loading" | "success" | "error";
const MAX_RETRIES = 8;

export default function CheckoutSuccessPage() {
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const retriesRef = useRef(0);
  const confirmedRef = useRef(false);

  async function confirmSession() {
    if (confirmedRef.current) return;

    setStatus("loading");
    setErrorMsg("");
    retriesRef.current = 0;

    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");

    if (!sessionId) {
      setStatus("error");
      setErrorMsg("Geen sessie gevonden. Probeer het opnieuw.");
      return;
    }

    await pollConfirm(sessionId);
  }

  async function pollConfirm(sessionId: string) {
    if (confirmedRef.current) return;

    try {
      const res = await apiFetch("/api/stripe/confirm-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });

      const data = await res.json();

      if (res.status === 202) {
        retriesRef.current++;
        if (retriesRef.current >= MAX_RETRIES) {
          setStatus("error");
          setErrorMsg("Betaling wordt nog verwerkt. Probeer over een minuut opnieuw.");
          return;
        }
        await new Promise((r) => setTimeout(r, 3000));
        return pollConfirm(sessionId);
      }

      if (res.ok && data.success) {
        confirmedRef.current = true;
        onSuccess();
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
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

      setStatus("error");
      setErrorMsg(data.error || "Er ging iets mis. Probeer het opnieuw.");
    } catch {
      setStatus("error");
      setErrorMsg("Verbinding mislukt. Controleer je internet en probeer opnieuw.");
    }
  }

  function onSuccess() {
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
    <div className="min-h-screen bg-[#edf2f7] flex items-center justify-center px-5" data-testid="page-checkout-success">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: status === "error" ? "#FEE2E2" : "rgba(217,26,104,0.08)" }}>
          {status === "loading" && <Loader2 className="w-8 h-8 animate-spin" style={{ color: "rgb(var(--ha-primary))" }} />}
          {status === "success" && <CheckCircle className="w-8 h-8 text-emerald-500" />}
          {status === "error" && <AlertCircle className="w-8 h-8 text-red-500" />}
        </div>

        <h1 className="text-[30px] font-semibold text-[#111] mb-2" data-testid="text-checkout-title">
          {status === "loading" && "Betaling bevestigen..."}
          {status === "success" && "Betaling gelukt!"}
          {status === "error" && "Er ging iets mis"}
        </h1>

        <p className="text-[15px] text-[#334855]" data-testid="text-checkout-subtitle">
          {status === "loading" && "Even geduld, we activeren je account."}
          {status === "success" && "Je wordt doorgestuurd naar de app..."}
          {status === "error" && errorMsg}
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
              Opnieuw proberen
            </button>
            <button
              onClick={() => navigate("/home")}
              className="h-[44px] rounded-[10px] text-[15px] font-medium text-[#334855] hover:bg-[#F9FAFB] transition-colors"
              data-testid="button-go-home"
            >
              Ga naar de app
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
