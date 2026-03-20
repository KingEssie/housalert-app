import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { ensureTrialForCurrentUser } from "@/lib/auth";
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

        const trialOk = await ensureTrialForCurrentUser();
        if (!trialOk) {
          console.error("[auth-callback] Trial creation failed after email verification — continuing anyway");
        }

        navigate("/dashboard", { replace: true });
      })
      .catch((err) => {
        console.error("[auth-callback] Unexpected error:", err);
        setError(t("authCallback.error"));
      });
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FFFFFF] px-6">
        <p className="text-[#222222] font-medium text-lg mb-4" data-testid="text-auth-error">{error}</p>
        <button
          onClick={() => navigate("/login")}
          className="min-h-[56px] px-8 rounded-full bg-[#F97316] hover:bg-[#EA580C] text-white font-medium text-[16px] transition-colors"
          data-testid="button-go-login"
        >
          {t("authCallback.goToLogin")}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FFFFFF]">
      <Loader2 className="w-8 h-8 animate-spin text-[#F97316]" />
      <p className="mt-4 text-[#222222] font-medium" data-testid="text-auth-verifying">{t("authCallback.verifying")}</p>
    </div>
  );
}
