import { apiFetch } from "@/lib/api-base";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { CheckCircle, Loader2 } from "lucide-react";
import { useTranslation } from "@/i18n";

async function verifyCheckout(sessionId: string, token: string): Promise<boolean> {
  const res = await apiFetch("/api/checkout/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ session_id: sessionId }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  return data?.success === true && data?.subscription?.isActive === true;
}

async function pollSubscriptionActive(token: string, maxAttempts = 10): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await apiFetch("/api/subscription/status", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.isActive) return true;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

export default function SubscriptionSuccessPage() {
  const [, navigate] = useLocation();
  const [syncing, setSyncing] = useState(true);
  const [activated, setActivated] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    async function verifyAndSync() {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        setSyncing(false);
        setTimeout(() => navigate("/dashboard"), 2000);
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const sessionId = params.get("session_id");

      let active = false;

      if (sessionId) {
        active = await verifyCheckout(sessionId, token);
      }

      if (!active) {
        active = await pollSubscriptionActive(token, 8);
      }

      setActivated(active);
      setSyncing(false);

      queryClient.invalidateQueries({ queryKey: ["/api/subscription/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });

      setTimeout(() => navigate("/dashboard"), 2000);
    }

    verifyAndSync();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#1A1A2E] flex items-center justify-center px-5">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-full bg-[#00C896]/15 flex items-center justify-center mx-auto mb-5">
          {syncing ? (
            <Loader2 className="w-8 h-8 text-[#E91E63] animate-spin" />
          ) : (
            <CheckCircle className="w-8 h-8 text-[#00C896]" />
          )}
        </div>
        <h1 className="text-[22px] font-medium text-white mb-2" data-testid="text-success-title">
          {syncing
            ? t("subscription.activating")
            : activated
              ? t("subscription.activated")
              : t("subscription.paymentReceived")}
        </h1>
        <p className="text-[15px] text-[#9CA3AF]" data-testid="text-success-redirect">
          {syncing
            ? t("paywall.pleaseWait")
            : t("subscription.redirecting")}
        </p>
      </div>
    </div>
  );
}
