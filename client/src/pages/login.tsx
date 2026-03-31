import { useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { ensureTrialForCurrentUser } from "@/lib/auth";
import { clearAllUserData } from "@/lib/queryClient";
import { apiFetch } from "@/lib/api-base";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";
import { HousAlertLogo } from "@/components/housalert-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { OB } from "@/components/onboarding-ui";
import { Eye, EyeOff, ArrowRight, Star } from "lucide-react";

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
  const [showPassword, setShowPassword] = useState(false);
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
      <header className="w-full pt-3 px-4">
        <div className="max-w-[480px] mx-auto flex items-center justify-between">
          <HousAlertLogo size={32} textClassName="font-bold text-white text-[18px]" />
          <LanguageSwitcher />
        </div>
      </header>

      <main className="flex-1 flex flex-col px-4 pt-8 pb-6">
        <div className="w-full max-w-[480px] mx-auto flex flex-col flex-1">
          <h1
            className="text-[28px] font-extrabold tracking-[-0.02em] leading-[1.15] mb-8 whitespace-pre-line"
            style={{ color: OB.text }}
            data-testid="text-login-title"
          >
            {t("auth.login.title")}
          </h1>

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="login-email" className="text-[14px] font-bold" style={{ color: OB.text }}>
                {t("auth.login.email")}
              </label>
              <input
                id="login-email"
                type="email"
                placeholder={t("auth.login.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full ha-field ha-field-dark"
                style={{ backgroundColor: "#151226", borderColor: "rgba(255,255,255,0.12)" }}
                data-testid="input-login-email"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="login-password" className="text-[14px] font-bold" style={{ color: OB.text }}>
                {t("auth.login.password")}
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  placeholder={t("auth.login.passwordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full ha-field ha-field-dark pr-12"
                  style={{ backgroundColor: "#151226", borderColor: "rgba(255,255,255,0.12)" }}
                  data-testid="input-login-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-0"
                  style={{ color: "rgba(255,255,255,0.5)" }}
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={resetLoading}
                className="self-end text-[14px] font-medium mt-0.5 transition-colors hover:underline"
                style={{ color: "#5b8def" }}
                data-testid="link-forgot-password"
              >
                {resetLoading ? t("common.loading") : t("auth.login.forgotPassword")}
              </button>
            </div>

            <button
              type="submit"
              className="w-full ha-btn text-white border-0 font-bold"
              style={{ background: OB.pinkGradient, boxShadow: OB.pinkShadow }}
              disabled={loading}
              data-testid="button-login-submit"
            >
              {loading ? t("common.loading") : (
                <>
                  {t("auth.login.submit")}
                  <ArrowRight className="w-[18px] h-[18px]" />
                </>
              )}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ backgroundColor: "rgba(255,255,255,0.15)" }} />
            <span className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.5)" }}>
              {t("auth.login.or") || "OF"}
            </span>
            <div className="flex-1 h-px" style={{ backgroundColor: "rgba(255,255,255,0.15)" }} />
          </div>

          <button
            onClick={() => navigate("/onboarding/intro")}
            className="w-full ha-btn font-semibold"
            style={{
              border: `1.5px solid ${OB.pink}`,
              color: OB.pink,
              backgroundColor: "transparent",
            }}
            data-testid="link-signup"
          >
            {t("auth.login.newToHousAlert") || "Ik ben nieuw bij HousAlert"}
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="flex-1" />

          <div className="flex items-center justify-center gap-2 pt-8 pb-2">
            <span className="text-[13px] font-semibold" style={{ color: "rgba(255,255,255,0.6)" }}>
              Trustpilot
            </span>
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="w-[22px] h-[22px] flex items-center justify-center rounded-[3px]"
                  style={{ backgroundColor: i <= 4 ? "#00b67a" : "#dce4e8" }}
                >
                  <Star
                    className="w-3 h-3"
                    fill={i <= 4 ? "#ffffff" : "#00b67a"}
                    stroke="none"
                  />
                </div>
              ))}
            </div>
            <span className="text-[14px] font-bold" style={{ color: "rgba(255,255,255,0.7)" }}>
              4.8
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
