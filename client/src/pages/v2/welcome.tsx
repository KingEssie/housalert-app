import { useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { ensureTrialForCurrentUser } from "@/lib/auth";
import { clearAllUserData } from "@/lib/queryClient";
import { apiFetch } from "@/lib/api-base";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";
import { useV2Onboarding } from "@/lib/v2-onboarding-store";
import { Eye, EyeOff, ChevronDown, ArrowRight, Loader2, Star } from "lucide-react";
import { HousAlertLogo } from "@/components/housalert-logo";

const ACCENT = "#e91e63";
const BG = "#1A1A2E";

export default function V2WelcomePage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t, locale, setLocale } = useTranslation();
  const { update: updateOnboarding } = useV2Onboarding();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);

  const languages: { code: "de" | "en" | "nl"; label: string; short: string }[] = [
    { code: "de", label: "Deutsch", short: "DE" },
    { code: "en", label: "English", short: "EN" },
    { code: "nl", label: "Nederlands", short: "NL" },
  ];

  const currentLang = languages.find((l) => l.code === locale) || languages[0];

  async function handleLogin() {
    if (!email || !password) return;
    setLoading(true);
    clearAllUserData();

    const { data: signInData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setLoading(false);
      toast({
        title: t("v2.welcome.loginFailed"),
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    await ensureTrialForCurrentUser();

    try {
      const token = signInData.session?.access_token;
      if (token) {
        const res = await apiFetch("/api/onboarding-status", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.onboarding_completed !== true) {
          setLoading(false);
          navigate("/onboarding/setup");
          return;
        }
      }
    } catch {}

    setLoading(false);
    navigate("/dashboard");
  }

  async function handleForgotPassword() {
    if (!email) {
      toast({
        title: t("v2.welcome.enterEmailFirst"),
        variant: "destructive",
      });
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      toast({ title: error.message, variant: "destructive" });
    } else {
      toast({ title: t("v2.welcome.resetSent") });
    }
  }

  return (
    <div
      className="min-h-[100dvh] flex flex-col"
      style={{ backgroundColor: BG }}
      data-testid="v2-welcome-page"
    >
      {showLangPicker && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowLangPicker(false)}
        />
      )}

      <div className="pt-[max(env(safe-area-inset-top),12px)]" />

      <header className="w-full px-6 h-[52px] flex items-center justify-between relative z-50">
        <HousAlertLogo
          size={30}
          textClassName="font-semibold text-white text-[18px] tracking-[-0.01em]"
        />

        <div className="relative">
          <button
            onClick={() => setShowLangPicker(!showLangPicker)}
            className="flex items-center gap-1 text-[13px] font-medium text-white/50 hover:text-white/70 transition-colors px-2.5 py-1.5 rounded-[6px] hover:bg-white/5"
            data-testid="button-v2-language"
          >
            {currentLang.short}
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {showLangPicker && (
            <div className="absolute right-0 top-full mt-1.5 bg-[#252540] border border-white/10 rounded-[6px] shadow-2xl py-1 z-50 min-w-[150px]">
              {languages.map((l) => (
                <button
                  key={l.code}
                  onClick={() => {
                    setLocale(l.code);
                    updateOnboarding({ language: l.code });
                    setShowLangPicker(false);
                  }}
                  className={`w-full px-4 py-2.5 text-left text-[14px] flex items-center justify-between hover:bg-white/5 transition-colors ${
                    locale === l.code
                      ? "text-[#e91e63] font-medium"
                      : "text-white/70"
                  }`}
                  data-testid={`lang-${l.code}`}
                >
                  <span>{l.label}</span>
                  <span className="text-[12px] text-white/30">{l.short}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col px-6 max-w-[420px] w-full mx-auto">
        <div className="pt-10 pb-8">
          <h1
            className="text-[30px] font-bold leading-[1.12] tracking-[-0.025em] text-white"
            data-testid="text-v2-welcome-title"
          >
            {t("v2.welcome.title")}
          </h1>
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2.5">
            <label className="text-[13px] font-semibold text-white/55 tracking-wide">
              {t("v2.welcome.emailLabel")}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("v2.welcome.emailPlaceholder")}
              autoComplete="email"
              className="w-full h-[56px] rounded-[6px] bg-white px-5 text-[16px] text-[#1A1A2E] placeholder-[#B0B0B0] outline-none border-2 border-transparent focus:border-[#e91e63] transition-colors"
              data-testid="input-v2-email"
            />
          </div>

          <div className="flex flex-col gap-2.5">
            <label className="text-[13px] font-semibold text-white/55 tracking-wide">
              {t("v2.welcome.passwordLabel")}
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("v2.welcome.passwordPlaceholder")}
                autoComplete="current-password"
                className="w-full h-[56px] rounded-[6px] bg-white px-5 pr-14 text-[16px] text-[#1A1A2E] placeholder-[#B0B0B0] outline-none border-2 border-transparent focus:border-[#e91e63] transition-colors"
                data-testid="input-v2-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-[#B0B0B0] hover:text-[#717171] transition-colors"
                data-testid="button-toggle-password"
              >
                {showPassword ? (
                  <EyeOff className="w-[22px] h-[22px]" />
                ) : (
                  <Eye className="w-[22px] h-[22px]" />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-3 mb-7">
          <button
            onClick={handleForgotPassword}
            className="text-[13px] font-medium text-[#e91e63]/70 hover:text-[#e91e63] transition-colors py-1"
            data-testid="button-v2-forgot-password"
          >
            {t("v2.welcome.forgotPassword")}
          </button>
        </div>

        <button
          onClick={handleLogin}
          disabled={loading || !email || !password}
          className="w-full h-[56px] rounded-[6px] text-[16px] font-bold text-white transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{
            backgroundColor: ACCENT,
            boxShadow: "0 6px 20px rgba(233, 30, 99, 0.35)",
          }}
          data-testid="button-v2-login"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              {t("v2.welcome.login")}
              <ArrowRight className="w-[18px] h-[18px]" />
            </>
          )}
        </button>

        <div className="flex items-center gap-4 my-7">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[12px] text-white/25 font-semibold uppercase tracking-wider">
            {t("v2.welcome.or")}
          </span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <button
          onClick={() => navigate("/v2/onboarding/intro")}
          className="w-full h-[56px] rounded-[6px] text-[15px] font-semibold transition-all active:scale-[0.97] flex items-center justify-center"
          style={{
            color: ACCENT,
            border: `1.5px solid ${ACCENT}`,
            backgroundColor: "transparent",
          }}
          data-testid="button-v2-signup"
        >
          {t("v2.welcome.signupCta")}
        </button>

        <div className="flex-1" />

        <div className="flex items-center justify-center gap-2 py-6">
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                className="w-[14px] h-[14px]"
                fill={i <= 4 ? "#22C55E" : "none"}
                stroke={i <= 4 ? "#22C55E" : "rgba(255,255,255,0.2)"}
              />
            ))}
          </div>
          <span className="text-[13px] font-semibold text-white/50">4.8</span>
          <span className="text-[12px] text-white/30">•</span>
          <span className="text-[12px] text-white/30">{t("v2.welcome.trustLine")}</span>
        </div>
      </main>

      <div className="pb-[max(env(safe-area-inset-bottom),12px)]" />
    </div>
  );
}
