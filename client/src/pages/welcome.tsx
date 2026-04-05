import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { HousAlertLogo } from "@/components/housalert-logo";
import { useTranslation, hasExplicitLocale, detectBrowserLocale } from "@/i18n";
import type { Locale } from "@/i18n";
import { ChevronDown, Eye, EyeOff, Loader2, ArrowRight, Star } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ensureTrialForCurrentUser } from "@/lib/auth";
import { clearAllUserData } from "@/lib/queryClient";
import { apiFetch } from "@/lib/api-base";
import { useToast } from "@/hooks/use-toast";

const OB = {
  gradient: "#ffffff",
  pink: "rgb(var(--ha-primary))",
  pinkGradient: "linear-gradient(135deg, rgb(var(--ha-primary)) 0%, #1E7FA3 100%)",
  pinkShadow: "0 4px 15px rgba(37,150,190,0.3)",
  text: "#111111",
  textSecondary: "#6B7280",
};

const LANGUAGES: { code: Locale; label: string; flag: string }[] = [
  { code: "de", label: "Deutsch", flag: "\u{1F1E9}\u{1F1EA}" },
  { code: "nl", label: "Nederlands", flag: "\u{1F1F3}\u{1F1F1}" },
  { code: "en", label: "English", flag: "\u{1F1EC}\u{1F1E7}" },
];

function LanguageDropdown() {
  const { locale, setLocale } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LANGUAGES.find((l) => l.code === locale) || LANGUAGES[2];

  useEffect(() => {
    if (!open) return;
    function dismiss(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function keyDismiss(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", dismiss);
    document.addEventListener("touchstart", dismiss as any);
    document.addEventListener("keydown", keyDismiss);
    return () => {
      document.removeEventListener("mousedown", dismiss);
      document.removeEventListener("touchstart", dismiss as any);
      document.removeEventListener("keydown", keyDismiss);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select language"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[#F7F7F7] hover:bg-[#F0F0F0] transition-colors active:scale-[0.96]"
        data-testid="button-language-selector"
      >
        <span className="text-[14px]">{current.flag}</span>
        <span className="text-[12px] font-semibold text-[#111111]">{current.label}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-[#9CA3AF] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Languages"
          className="absolute top-full right-0 mt-1.5 w-[180px] rounded-[6px] border overflow-hidden z-50 shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
          style={{ backgroundColor: "#ffffff", borderColor: "#E5E7EB" }}
        >
          {LANGUAGES.map((lang) => {
            const isActive = locale === lang.code;
            return (
              <button
                key={lang.code}
                role="option"
                aria-selected={isActive}
                onClick={() => { setLocale(lang.code); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${isActive ? "bg-[#F9FAFB]" : "hover:bg-[#F9FAFB]"}`}
                data-testid={`button-lang-${lang.code}`}
              >
                <span className="text-[16px]">{lang.flag}</span>
                <span className={`text-[14px] font-semibold ${isActive ? "text-ha-primary" : "text-[#111111]"}`}>
                  {lang.label}
                </span>
                {isActive && (
                  <div className="ml-auto w-[18px] h-[18px] rounded-full flex items-center justify-center" style={{ backgroundColor: OB.pink }}>
                    <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function WelcomePage() {
  const [, navigate] = useLocation();
  const { t, setLocale } = useTranslation();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hasExplicitLocale()) {
      const detected = detectBrowserLocale();
      setLocale(detected);
    }
  }, [setLocale]);

  async function handleForgotPassword() {
    if (!email) {
      toast({ title: t("auth.login.emailRequired"), description: t("auth.login.enterEmailFirst"), variant: "destructive" });
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/account/change-password`,
    });
    if (error) {
      toast({ title: t("auth.login.failed"), description: error.message, variant: "destructive" });
    } else {
      toast({ title: t("auth.login.resetSent"), description: t("auth.login.resetSentDesc") });
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    clearAllUserData();
    const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      toast({ title: t("auth.login.failed"), description: error.message, variant: "destructive" });
      return;
    }
    console.log(`[WELCOME] Login success — user.id=${signInData?.user?.id?.substring(0, 8) ?? "null"}`);
    await ensureTrialForCurrentUser();

    try {
      const token = signInData.session?.access_token;
      if (token) {
        const res = await apiFetch("/api/onboarding-status", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        const completed = data.onboarding_completed === true;
        let dest = completed ? "/home" : "/onboarding/intro";
        console.log(`[WELCOME] onboarding_completed=${completed} → redirect=${dest}`);
        setLoading(false);
        navigate(dest);
        return;
      }
    } catch (err) {
      console.log("[WELCOME] onboarding check failed, defaulting to onboarding/intro", err);
    }

    setLoading(false);
    navigate("/onboarding/intro");
  }

  return (
    <div
      className="h-[100dvh] flex flex-col overflow-auto"
      style={{ background: OB.gradient }}
      data-testid="welcome-page"
    >
      <header className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),12px)] pb-2">
        <HousAlertLogo
          size={28}
          showText={true}
          textClassName="font-semibold text-[#111111] text-[17px] tracking-[-0.01em]"
        />
        <LanguageDropdown />
      </header>

      <main className="flex-1 flex flex-col w-full px-4 pt-6 pb-[max(env(safe-area-inset-bottom),12px)]">
        <h1
          className="text-[26px] font-semibold text-[#111111] leading-[1.15] tracking-[-0.02em] mb-8 whitespace-nowrap"
          data-testid="text-auth-title"
        >
          {t("v2.welcome.title")}
        </h1>

        <form onSubmit={handleLogin} className="flex flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-semibold text-[#111111]" htmlFor="welcome-email">
              {t("v2.welcome.emailLabel")}
            </label>
            <input
              id="welcome-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("v2.welcome.emailPlaceholder")}
              required
              className="w-full ha-field"
              style={{ backgroundColor: "#ffffff", borderColor: "#E5E7EB" }}
              data-testid="input-email"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-semibold text-[#111111]" htmlFor="welcome-password">
              {t("v2.welcome.passwordLabel")}
            </label>
            <div className="relative">
              <input
                id="welcome-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("v2.welcome.passwordPlaceholder")}
                required
                className="w-full ha-field pr-12"
                style={{ backgroundColor: "#ffffff", borderColor: "#E5E7EB" }}
                data-testid="input-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: "#6B7280" }}
                tabIndex={-1}
                data-testid="button-toggle-password"
              >
                {showPassword
                  ? <EyeOff className="w-5 h-5" />
                  : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <div className="flex justify-end mt-0.5">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-[14px] font-medium transition-colors hover:underline"
                style={{ color: "rgb(var(--ha-primary))" }}
                data-testid="button-forgot-password"
              >
                {t("v2.welcome.forgotPassword")}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full ha-btn text-white font-semibold"
            style={{ background: OB.pink, boxShadow: OB.pinkShadow }}
            data-testid="button-login"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                {t("v2.welcome.login")}
                <div className="w-[22px] h-[22px] rounded-full border-[1.5px] border-white/50 flex items-center justify-center ml-1">
                  <ArrowRight className="w-3 h-3" />
                </div>
              </>
            )}
          </button>
        </form>

        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px" style={{ backgroundColor: "#E5E7EB" }} />
          <span className="text-[13px] font-semibold" style={{ color: "#9CA3AF" }}>
            {t("v2.welcome.or") || "OF"}
          </span>
          <div className="flex-1 h-px" style={{ backgroundColor: "#E5E7EB" }} />
        </div>

        <button
          type="button"
          onClick={() => navigate("/onboarding/intro")}
          className="w-full ha-btn font-semibold"
          style={{
            border: `1.5px solid ${OB.pink}`,
            color: OB.pink,
            backgroundColor: "transparent",
          }}
          data-testid="button-signup"
        >
          {t("v2.welcome.signupCta")}
          <div className="w-[22px] h-[22px] rounded-full border-[1.5px] flex items-center justify-center ml-1" style={{ borderColor: OB.pink }}>
            <ArrowRight className="w-3 h-3" />
          </div>
        </button>

        <div className="flex-1" />

        <div className="flex items-center justify-center gap-2.5 pt-6 pb-2">
          <span className="text-[13px] font-semibold" style={{ color: "#9CA3AF" }}>
            Trustpilot
          </span>
          <div className="flex items-center gap-[3px]">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="w-[22px] h-[22px] flex items-center justify-center rounded-[3px]"
                style={{ backgroundColor: i <= 4 ? "#00b67a" : "#E5E7EB" }}
              >
                <Star
                  className="w-3 h-3"
                  fill={i <= 4 ? "#ffffff" : "#00b67a"}
                  stroke="none"
                />
              </div>
            ))}
          </div>
          <span className="text-[14px] font-semibold" style={{ color: "#6B7280" }}>
            4.8
          </span>
        </div>
      </main>
    </div>
  );
}
