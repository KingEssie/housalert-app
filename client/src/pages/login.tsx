import { useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { ensureTrialForCurrentUser } from "@/lib/auth";
import { clearAllUserData } from "@/lib/queryClient";
import { apiFetch } from "@/lib/api-base";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";
import { HousAlertLogo } from "@/components/housalert-logo";
import { OB } from "@/components/onboarding-ui";

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();

  const returnTo = (() => {
    const fromSearch = new URLSearchParams(window.location.search).get("returnTo");
    if (fromSearch) return fromSearch;
    const hash = window.location.hash;
    const qIdx = hash.indexOf("?");
    if (qIdx >= 0) {
      return new URLSearchParams(hash.substring(qIdx)).get("returnTo");
    }
    return null;
  })();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    console.log(`[IDENTITY] Login attempt — email="${email}"`);
    clearAllUserData();
    const { data: signInData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setLoading(false);
      toast({ title: t("auth.login.failed"), description: error.message, variant: "destructive" });
      return;
    }

    console.log(`[IDENTITY] Login success — user.id=${signInData?.user?.id?.substring(0, 8) ?? "null"}, email=${signInData?.user?.email ?? "unknown"}`);
    await ensureTrialForCurrentUser();

    if (returnTo) {
      console.log(`[IDENTITY] Login redirect → returnTo="${returnTo}"`);
      setLoading(false);
      navigate(returnTo);
      return;
    }

    try {
      const token = signInData.session?.access_token;
      if (token) {
        const res = await apiFetch("/api/onboarding-status", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        const completed = data.onboarding_completed === true;
        console.log(`[IDENTITY] Login onboarding check — completed=${completed}`);
        if (!completed) {
          setLoading(false);
          navigate("/onboarding/setup");
          return;
        }
      }
    } catch (err) {
      console.log("[IDENTITY] Login onboarding check failed, defaulting to dashboard", err);
    }

    setLoading(false);
    navigate("/dashboard");
  }

  async function handleForgotPassword() {
    if (!email) {
      toast({ title: t("auth.login.emailRequired"), description: t("auth.login.enterEmailFirst"), variant: "destructive" });
      return;
    }
    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/account/change-password`,
    });
    setResetLoading(false);
    if (error) {
      toast({ title: t("auth.login.failed"), description: error.message, variant: "destructive" });
    } else {
      toast({ title: t("auth.login.resetSent"), description: t("auth.login.resetSentDesc") });
    }
  }

  return (
    <div className="min-h-screen flex flex-col ob-dark" style={{ background: OB.gradient }}>
      <header className="w-full sticky top-0 z-20 backdrop-blur-md border-b" style={{ backgroundColor: OB.headerBg, borderColor: OB.headerBorder }}>
        <div className="max-w-[480px] mx-auto px-5 h-[56px] flex items-center justify-center">
          <HousAlertLogo size={28} />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-5 py-12">
        <div className="w-full" style={{ maxWidth: 380 }}>
          <div className="text-center mb-8">
            <h1 className="text-[26px] font-bold tracking-[-0.02em] leading-[1.1] mb-3" style={{ color: OB.text }} data-testid="text-login-title">
              {t("auth.login.title")}
            </h1>
            <p className="text-[15px]" style={{ color: OB.textSecondary }}>
              {t("auth.login.subtitle")}
            </p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-email" className="text-[14px] font-semibold" style={{ color: OB.text }}>
                {t("auth.login.email")}
              </label>
              <input
                id="login-email"
                type="email"
                placeholder={t("auth.login.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="ob-input h-[56px] px-4 rounded-[6px] text-[15px] font-medium w-full"
                data-testid="input-login-email"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-password" className="text-[14px] font-semibold" style={{ color: OB.text }}>
                {t("auth.login.password")}
              </label>
              <input
                id="login-password"
                type="password"
                placeholder={t("auth.login.passwordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="ob-input h-[56px] px-4 rounded-[6px] text-[15px] font-medium w-full"
                data-testid="input-login-password"
              />
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={resetLoading}
                className="self-end text-[13px] font-medium mt-1 transition-colors hover:underline"
                style={{ color: OB.pink }}
                data-testid="link-forgot-password"
              >
                {resetLoading ? t("common.loading") : t("auth.login.forgotPassword")}
              </button>
            </div>
            <Button
              type="submit"
              className="w-full h-[56px] rounded-[6px] text-[16px] font-bold text-white border-0"
              style={{ background: OB.pinkGradient, boxShadow: OB.pinkShadow }}
              disabled={loading}
              data-testid="button-login-submit"
            >
              {loading ? t("common.loading") : t("auth.login.submit")}
            </Button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px" style={{ backgroundColor: "rgba(255,255,255,0.2)" }} />
            <span className="text-[13px] font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>
              {t("auth.login.or") || "of"}
            </span>
            <div className="flex-1 h-px" style={{ backgroundColor: "rgba(255,255,255,0.2)" }} />
          </div>

          <button
            onClick={() => navigate("/onboarding/intro")}
            className="w-full h-[56px] rounded-[6px] text-[15px] font-semibold border transition-all active:scale-[0.97]"
            style={{ borderColor: "rgba(255,255,255,0.2)", color: OB.text, backgroundColor: "transparent" }}
            data-testid="link-signup"
          >
            {t("auth.login.newToHousAlert") || "Nieuw bij HousAlert? Start hier"}
          </button>

          <p className="text-center text-[12px] mt-6" style={{ color: OB.textMuted }}>
            {t("auth.login.footer")}
          </p>
        </div>
      </main>
    </div>
  );
}
