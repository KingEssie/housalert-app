import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api-base";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/i18n";

export default function AuthCallbackPage() {
  const [, navigate] = useLocation();
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (!code) {
      setError(t("authCallback.noCode"));
      return;
    }

    supabase.auth
      .exchangeCodeForSession(code)
      .then(async ({ error: exchangeErr }) => {
        if (exchangeErr) {
          console.error("[auth-callback] Exchange failed:", exchangeErr.message);
          setError(t("authCallback.failed"));
          return;
        }

        await supabase.auth.updateUser({
          data: { email_needs_verification: false },
        });

        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            const res = await apiFetch("/api/onboarding-status", {
              headers: { Authorization: `Bearer ${session.access_token}` },
            });
            const data = await res.json();
            const completed = data.onboarding_completed === true;
            console.log(`[auth-callback] onboarding_completed=${completed}`);
            navigate(completed ? "/dashboard" : "/onboarding/setup", { replace: true });
            return;
          }
        } catch (err) {
          console.error("[auth-callback] onboarding check failed, defaulting to onboarding/setup", err);
        }

        navigate("/onboarding/setup", { replace: true });
      })
      .catch((err) => {
        console.error("[auth-callback] Unexpected error:", err);
        setError(t("authCallback.error"));
      });
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-ha-bg px-6">
        <p className="text-ha-text font-medium text-lg mb-4" data-testid="text-auth-error">{error}</p>
        <button
          onClick={() => navigate("/")}
          className="min-h-[56px] px-8 rounded-full bg-ha-primary hover:bg-ha-primary-hover text-white font-medium text-[16px] transition-colors"
          data-testid="button-go-login"
        >
          {t("authCallback.goToLogin")}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-ha-bg">
      <Loader2 className="w-8 h-8 animate-spin text-ha-primary" />
      <p className="mt-4 text-ha-text font-medium" data-testid="text-auth-verifying">{t("authCallback.verifying")}</p>
    </div>
  );
}
