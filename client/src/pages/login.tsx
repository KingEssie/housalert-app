import { useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { ensureTrialForCurrentUser } from "@/lib/auth";
import { clearAllUserData } from "@/lib/queryClient";
import { apiFetch } from "@/lib/api-base";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";
import { logoSrc } from "@/components/housalert-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
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
    <div className="min-h-screen flex flex-col" style={{ background: "rgb(var(--ha-bg))" }}>
      <div
        className="relative w-full flex-shrink-0"
        style={{
          background: "linear-gradient(135deg, rgb(var(--ha-primary)) 0%, rgb(var(--ha-primary-hover)) 100%)",
          minHeight: "32vh",
          paddingBottom: "48px",
        }}
      >
        <header className="w-full pt-5 px-5">
          <div className="max-w-[480px] mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img
                src={logoSrc}
                alt="HousAlert"
                width={32}
                height={32}
                className="object-contain"
                style={{ width: 32, height: 32, filter: "brightness(0) invert(1)" }}
                data-testid="img-housalert-logo"
              />
              <span
                className="font-bold text-[18px] text-white tracking-[-0.01em]"
                data-testid="text-logo"
              >
                HousAlert
              </span>
            </div>
            <LanguageSwitcher variant="dark" />
          </div>
        </header>

        <div className="max-w-[480px] mx-auto px-6 pt-6">
          <h1
            className="text-[32px] font-bold tracking-[-0.025em] leading-[1.15] text-white mb-2"
            data-testid="text-login-title"
          >
            {t("auth.login.title")}
          </h1>
          <p className="text-[16px] text-white/80 leading-relaxed">
            {t("auth.login.subtitle")}
          </p>
        </div>
      </div>

      <main className="flex-1 flex flex-col px-4" style={{ marginTop: "-40px" }}>
        <div
          className="w-full max-w-[480px] mx-auto flex flex-col"
          style={{
            background: "rgb(var(--ha-card))",
            borderRadius: "20px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.04)",
            padding: "28px 24px 24px",
          }}
        >
          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-email" className="text-[14px] font-medium text-ha-text-secondary">
                {t("auth.login.email")}
              </label>
              <input
                id="login-email"
                type="email"
                placeholder={t("auth.login.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full h-[56px] rounded-[8px] border border-ha-border-input bg-white px-4 text-[16px] font-medium text-ha-text placeholder:text-ha-text-secondary placeholder:opacity-55 outline-none transition-all focus:border-ha-primary focus:ring-1 focus:ring-ha-primary/25"
                data-testid="input-login-email"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-password" className="text-[14px] font-medium text-ha-text-secondary">
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
                  className="w-full h-[56px] rounded-[8px] border border-ha-border-input bg-white pl-4 pr-12 text-[16px] font-medium text-ha-text placeholder:text-ha-text-secondary placeholder:opacity-55 outline-none transition-all focus:border-ha-primary focus:ring-1 focus:ring-ha-primary/25"
                  data-testid="input-login-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-0 bg-transparent border-0"
                  style={{ color: "rgb(var(--ha-text-secondary))" }}
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={resetLoading}
                className="self-end text-[14px] font-medium mt-0.5 transition-colors hover:underline bg-transparent border-0 cursor-pointer"
                style={{ color: "rgb(var(--ha-primary))" }}
                data-testid="link-forgot-password"
              >
                {resetLoading ? t("common.loading") : t("auth.login.forgotPassword")}
              </button>
            </div>

            <button
              type="submit"
              className="w-full border-0 font-semibold cursor-pointer flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
              style={{
                height: "56px",
                borderRadius: "14px",
                background: "rgb(var(--ha-primary))",
                color: "white",
                fontSize: "16px",
                fontWeight: 600,
                boxShadow: "0 4px 15px rgba(37,60,150,0.25)",
              }}
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
            <div className="flex-1 h-px" style={{ backgroundColor: "rgb(var(--ha-card-border))" }} />
            <span className="text-[13px] font-semibold" style={{ color: "rgb(var(--ha-text-secondary))" }}>
              {t("auth.login.or")}
            </span>
            <div className="flex-1 h-px" style={{ backgroundColor: "rgb(var(--ha-card-border))" }} />
          </div>

          <button
            onClick={() => navigate("/onboarding/location")}
            className="w-full font-semibold cursor-pointer flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
            style={{
              height: "56px",
              borderRadius: "14px",
              border: "2px solid rgb(var(--ha-primary))",
              color: "rgb(var(--ha-primary))",
              backgroundColor: "transparent",
              fontSize: "16px",
              fontWeight: 600,
            }}
            data-testid="link-signup"
          >
            {t("auth.login.newToHousAlert")}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-center gap-2 pt-8 pb-6">
          <span className="text-[13px] font-semibold" style={{ color: "rgb(var(--ha-text-secondary))" }}>
            Trustpilot
          </span>
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="w-[22px] h-[22px] flex items-center justify-center rounded-[3px]"
                style={{ backgroundColor: i <= 4 ? "#00b67a" : "rgb(var(--ha-card-border))" }}
              >
                <Star
                  className="w-3 h-3"
                  fill={i <= 4 ? "#ffffff" : "#00b67a"}
                  stroke="none"
                />
              </div>
            ))}
          </div>
          <span className="text-[14px] font-semibold" style={{ color: "rgb(var(--ha-text-secondary))" }}>
            4.8
          </span>
        </div>
      </main>
    </div>
  );
}
