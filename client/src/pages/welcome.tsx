import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { HousAlertLogo } from "@/components/housalert-logo";
import { useTranslation, hasExplicitLocale, detectBrowserLocale } from "@/i18n";
import type { Locale } from "@/i18n";
import { ChevronDown, Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ensureTrialForCurrentUser } from "@/lib/auth";
import { clearAllUserData } from "@/lib/queryClient";
import { apiFetch } from "@/lib/api-base";
import { useToast } from "@/hooks/use-toast";

const OB = {
  gradient: "linear-gradient(180deg, #1e1b4b 0%, #0f0e2a 100%)",
  pink: "#e91e63",
  pinkGradient: "linear-gradient(135deg, #e91e63 0%, #ec407a 100%)",
  pinkShadow: "0 4px 15px rgba(233,30,99,0.3)",
  text: "#ffffff",
  textSecondary: "rgba(255,255,255,0.65)",
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
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-white/10 backdrop-blur-md hover:bg-white/15 transition-colors active:scale-[0.96]"
        data-testid="button-language-selector"
      >
        <span className="text-[14px]">{current.flag}</span>
        <span className="text-[12px] font-semibold text-white">{current.label}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-white/80 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Languages"
          className="absolute top-full right-0 mt-1.5 w-[180px] rounded-[6px] border overflow-hidden z-50 shadow-[0_8px_30px_rgba(0,0,0,0.3)]"
          style={{ backgroundColor: "rgba(30,27,75,0.95)", borderColor: "rgba(255,255,255,0.1)" }}
        >
          {LANGUAGES.map((lang) => {
            const isActive = locale === lang.code;
            return (
              <button
                key={lang.code}
                role="option"
                aria-selected={isActive}
                onClick={() => { setLocale(lang.code); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${isActive ? "bg-white/10" : "hover:bg-white/5"}`}
                data-testid={`button-lang-${lang.code}`}
              >
                <span className="text-[16px]">{lang.flag}</span>
                <span className={`text-[14px] font-semibold ${isActive ? "text-[#e91e63]" : "text-white"}`}>
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
        const prePaywall = data.onboarding_completed === true;
        const postPaywall = data.post_paywall_onboarding_completed === true;
        let dest = "/onboarding/intro";
        if (prePaywall && postPaywall) dest = "/home";
        else if (prePaywall) dest = "/onboarding/setup";
        console.log(`[WELCOME] onboarding_completed=${prePaywall} post_paywall=${postPaywall} → redirect=${dest}`);
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
      className="h-[100dvh] flex flex-col overflow-hidden"
      style={{ background: OB.gradient }}
      data-testid="welcome-page"
    >
      <header className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),12px)] pb-2">
        <HousAlertLogo
          size={28}
          showText={true}
          textClassName="font-bold text-white text-[17px] tracking-[-0.01em]"
        />
        <LanguageDropdown />
      </header>

      <main className="flex-1 flex flex-col justify-center max-w-[400px] mx-auto w-full px-6 pb-[max(env(safe-area-inset-bottom),12px)]">
        <div className="mb-8">
          <h1
            className="text-[26px] font-bold text-white leading-[1.15] tracking-[-0.03em] mb-2"
            data-testid="text-auth-title"
          >
            {t("authScreen.title")}
          </h1>
          <p
            className="text-[14px] leading-[1.5]"
            style={{ color: OB.textSecondary }}
            data-testid="text-auth-subtitle"
          >
            {t("authScreen.subtitle")}
          </p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("authScreen.emailPlaceholder")}
            required
            className="ob-input w-full h-[56px] px-4 rounded-[6px] text-[16px] font-medium"
            data-testid="input-email"
          />

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("authScreen.passwordPlaceholder")}
              required
              className="ob-input w-full h-[56px] px-4 pr-12 rounded-[6px] text-[16px] font-medium"
              data-testid="input-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
              style={{ color: "#999" }}
              tabIndex={-1}
              data-testid="button-toggle-password"
            >
              {showPassword
                ? <EyeOff className="w-[18px] h-[18px]" />
                : <Eye className="w-[18px] h-[18px]" />}
            </button>
          </div>

          <div className="flex justify-end -mt-1">
            <button
              type="button"
              onClick={() => navigate("/forgot-password")}
              className="text-[12px] font-medium transition-colors"
              style={{ color: OB.textSecondary }}
              data-testid="button-forgot-password"
            >
              {t("authScreen.forgotPassword")}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-[56px] rounded-[6px] text-[15px] font-bold text-white transition-all active:scale-[0.97] disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: OB.pinkGradient, boxShadow: OB.pinkShadow }}
            data-testid="button-login"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t("authScreen.logIn")}
          </button>

          <button
            type="button"
            onClick={() => navigate("/onboarding/intro")}
            className="w-full h-[56px] rounded-[6px] text-[14px] font-semibold transition-all active:scale-[0.97]"
            style={{ border: `1.5px solid ${OB.pink}`, color: OB.pink, backgroundColor: "transparent" }}
            data-testid="button-signup"
          >
            {t("authScreen.signUp")}
          </button>
        </form>
      </main>
    </div>
  );
}
