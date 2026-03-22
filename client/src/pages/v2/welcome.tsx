import { useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { ensureTrialForCurrentUser } from "@/lib/auth";
import { clearAllUserData } from "@/lib/queryClient";
import { apiFetch } from "@/lib/api-base";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";
import { V2DarkScreenLayout, V2DarkHeader, V2DarkContent } from "@/components/v2";
import { V2TextInput, V2PasswordInput } from "@/components/v2";
import { useV2Onboarding } from "@/lib/v2-onboarding-store";
import { Mail, Globe, Loader2 } from "lucide-react";
import { HousAlertLogo } from "@/components/housalert-logo";

const BRAND = "#F97316";

export default function V2WelcomePage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t, locale, setLocale } = useTranslation();
  const { update: updateOnboarding } = useV2Onboarding();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);

  const languages: { code: "de" | "en" | "nl"; label: string; flag: string }[] = [
    { code: "de", label: "Deutsch", flag: "🇩🇪" },
    { code: "en", label: "English", flag: "🇬🇧" },
    { code: "nl", label: "Nederlands", flag: "🇳🇱" },
  ];

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
    <V2DarkScreenLayout>
      <V2DarkHeader
        logo={
          <HousAlertLogo
            size={28}
            textClassName="font-semibold text-white text-[17px] tracking-[-0.01em]"
          />
        }
        right={
          <div className="relative">
            <button
              onClick={() => setShowLangPicker(!showLangPicker)}
              className="flex items-center gap-1.5 text-[13px] text-white/60 hover:text-white/80 transition-colors"
              data-testid="button-v2-language"
            >
              <Globe className="w-4 h-4" />
              {languages.find((l) => l.code === locale)?.flag}{" "}
              {locale.toUpperCase()}
            </button>
            {showLangPicker && (
              <div className="absolute right-0 top-full mt-2 bg-[#2A2A42] border border-white/10 rounded-xl shadow-xl py-1 z-50 min-w-[140px]">
                {languages.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => {
                      setLocale(l.code);
                      updateOnboarding({ language: l.code });
                      setShowLangPicker(false);
                    }}
                    className={`w-full px-4 py-2.5 text-left text-[14px] flex items-center gap-2 hover:bg-white/5 transition-colors ${
                      locale === l.code
                        ? "text-[#F97316] font-medium"
                        : "text-white/70"
                    }`}
                    data-testid={`lang-${l.code}`}
                  >
                    <span>{l.flag}</span> {l.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        }
      />

      <V2DarkContent center>
        <h1
          className="text-[28px] font-bold leading-[1.15] tracking-[-0.02em] text-white text-center mb-2"
          data-testid="text-v2-welcome-title"
        >
          {t("v2.welcome.title")}
        </h1>
        <p
          className="text-[15px] text-white/50 text-center mb-8"
          data-testid="text-v2-welcome-subtitle"
        >
          {t("v2.welcome.subtitle")}
        </p>

        <div className="flex flex-col gap-3 mb-3">
          <V2TextInput
            type="email"
            placeholder={t("v2.welcome.emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={<Mail className="w-5 h-5" />}
            data-testid="input-v2-email"
            autoComplete="email"
          />
          <V2PasswordInput
            placeholder={t("v2.welcome.passwordPlaceholder")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            data-testid="input-v2-password"
            autoComplete="current-password"
          />
        </div>

        <div className="flex justify-end mb-6">
          <button
            onClick={handleForgotPassword}
            className="text-[13px] text-white/40 hover:text-white/60 transition-colors"
            data-testid="button-v2-forgot-password"
          >
            {t("v2.welcome.forgotPassword")}
          </button>
        </div>

        <button
          onClick={handleLogin}
          disabled={loading || !email || !password}
          className="w-full h-[52px] rounded-full text-[16px] font-bold text-white transition-all active:scale-[0.97] disabled:opacity-50 shadow-[0_4px_14px_rgba(249,115,22,0.3)] mb-4"
          style={{ backgroundColor: BRAND }}
          data-testid="button-v2-login"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          ) : (
            t("v2.welcome.login")
          )}
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[12px] text-white/30 font-medium uppercase">
            {t("v2.welcome.or")}
          </span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <button
          onClick={() => navigate("/v2/onboarding/intro")}
          className="w-full h-[48px] rounded-full text-[15px] font-semibold text-white border border-white/20 bg-transparent hover:bg-white/5 transition-colors active:scale-[0.97]"
          data-testid="button-v2-signup"
        >
          {t("v2.welcome.signupCta")}
        </button>

        <div className="mt-8 flex items-center justify-center gap-2">
          <div className="flex -space-x-1.5">
            {["⭐", "⭐", "⭐", "⭐", "⭐"].map((s, i) => (
              <span key={i} className="text-[14px]">{s}</span>
            ))}
          </div>
          <span className="text-[13px] text-white/40">
            {t("v2.welcome.trustLine")}
          </span>
        </div>
      </V2DarkContent>
    </V2DarkScreenLayout>
  );
}
