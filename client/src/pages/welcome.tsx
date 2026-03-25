import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { HousAlertLogo } from "@/components/housalert-logo";
import { useTranslation, hasExplicitLocale, detectBrowserLocale } from "@/i18n";
import type { Locale } from "@/i18n";
import { ChevronDown, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ensureTrialForCurrentUser } from "@/lib/auth";
import { clearAllUserData } from "@/lib/queryClient";
import { apiFetch } from "@/lib/api-base";
import { useToast } from "@/hooks/use-toast";
import heroImg from "@assets/50F77D08-ED68-40B2-AFD3-67D49A86100C_1774074748083.png";

const BRAND = "rgb(var(--ha-primary))";
const BRAND_HOVER = "rgb(var(--ha-primary-hover))";

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
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-ha-card/20 backdrop-blur-md hover:bg-ha-card/30 transition-colors active:scale-[0.96]"
        data-testid="button-language-selector"
      >
        <span className="text-[14px]">{current.flag}</span>
        <span className="text-[12px] font-semibold text-white drop-shadow-sm">{current.label}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-white/80 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Languages"
          className="absolute top-full right-0 mt-1.5 w-[180px] bg-ha-card rounded-2xl border border-ha-card-border shadow-[0_8px_30px_rgba(0,0,0,0.3)] overflow-hidden z-50"
        >
          {LANGUAGES.map((lang) => {
            const isActive = locale === lang.code;
            return (
              <button
                key={lang.code}
                role="option"
                aria-selected={isActive}
                onClick={() => { setLocale(lang.code); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${isActive ? "bg-ha-primary/15" : "hover:bg-ha-surface"}`}
                data-testid={`button-lang-${lang.code}`}
              >
                <span className="text-[16px]">{lang.flag}</span>
                <span className={`text-[14px] font-semibold ${isActive ? "text-ha-primary" : "text-ha-text"}`}>
                  {lang.label}
                </span>
                {isActive && (
                  <div className="ml-auto w-[18px] h-[18px] rounded-full flex items-center justify-center" style={{ backgroundColor: BRAND }}>
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
  console.log("[PAGE] WelcomePage v2.1 rendered (new Rentbird-style auth screen)");
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
        const completed = data.onboarding_completed === true;
        console.log(`[WELCOME] onboarding_completed=${completed} → redirect=${completed ? "/dashboard" : "/onboarding/setup"}`);
        setLoading(false);
        navigate(completed ? "/dashboard" : "/onboarding/setup");
        return;
      }
    } catch (err) {
      console.log("[WELCOME] onboarding check failed, defaulting to onboarding/setup", err);
    }

    setLoading(false);
    navigate("/onboarding/setup");
  }

  return (
    <div className="h-[100dvh] bg-ha-bg flex flex-col overflow-hidden" data-testid="welcome-page">
      <div className="relative w-full flex-shrink-0" style={{ height: "38%", maxHeight: "40vh" }}>
        <img
          src={heroImg}
          alt=""
          className="w-full h-full object-cover"
          data-testid="auth-hero-image"
          draggable={false}
        />

        <div className="absolute inset-0 pointer-events-none" style={{
          background: "linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 45%, rgba(26,26,46,0.85) 100%)"
        }} />

        <div className="absolute top-0 left-0 right-0 pt-[max(env(safe-area-inset-top),8px)] px-5 flex items-center justify-end z-10">
          <div className="pt-3">
            <LanguageDropdown />
          </div>
        </div>

        <div className="absolute left-0 right-0 flex justify-center z-10" style={{ top: "60%" }}>
          <HousAlertLogo
            size={36}
            showText={true}
            textClassName="font-bold text-white text-[19px] tracking-[-0.01em] drop-shadow-[0_2px_6px_rgba(0,0,0,0.4)]"
          />
        </div>
      </div>

      <div
        className="relative flex-1 bg-ha-bg flex flex-col"
        style={{
          borderRadius: "28px 28px 0 0",
          marginTop: "-32px",
          zIndex: 5,
        }}
      >
        <div className="flex flex-col px-6 pt-5 pb-[max(env(safe-area-inset-bottom),12px)] flex-1">
          <div className="text-center mb-4">
            <h1
              className="text-[22px] font-bold text-ha-text leading-[1.15] tracking-[-0.03em] mb-1"
              data-testid="text-auth-title"
            >
              {t("authScreen.title")}
            </h1>
            <p
              className="text-[13px] text-ha-text-secondary leading-[1.45]"
              data-testid="text-auth-subtitle"
            >
              {t("authScreen.subtitle")}
            </p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-2.5">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("authScreen.emailPlaceholder")}
              required
              className="w-full h-[46px] px-4 rounded-xl border border-ha-card-border bg-ha-card text-[14px] font-medium text-ha-text placeholder:text-ha-text-muted placeholder:font-normal focus:border-ha-primary focus:shadow-[0_0_0_3px_rgba(233,30,99,0.08)] outline-none transition-all"
              data-testid="input-email"
            />

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("authScreen.passwordPlaceholder")}
                required
                className="w-full h-[46px] px-4 pr-11 rounded-xl border border-ha-card-border bg-ha-card text-[14px] font-medium text-ha-text placeholder:text-ha-text-muted placeholder:font-normal focus:border-ha-primary focus:shadow-[0_0_0_3px_rgba(233,30,99,0.08)] outline-none transition-all"
                data-testid="input-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2"
                tabIndex={-1}
                data-testid="button-toggle-password"
              >
                {showPassword
                  ? <EyeOff className="w-[16px] h-[16px] text-ha-text-muted" />
                  : <Eye className="w-[16px] h-[16px] text-ha-text-muted" />}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-[46px] rounded-full text-[15px] font-bold text-white transition-all active:scale-[0.97] shadow-[0_4px_14px_rgba(233,30,99,0.3)] disabled:opacity-60"
              style={{ backgroundColor: loading ? "#555" : BRAND }}
              onMouseOver={(e) => { if (!loading) e.currentTarget.style.backgroundColor = BRAND_HOVER; }}
              onMouseOut={(e) => { if (!loading) e.currentTarget.style.backgroundColor = BRAND; }}
              data-testid="button-login"
            >
              {loading ? t("common.loading") : t("authScreen.logIn")}
            </button>
          </form>

          <div className="flex justify-end mt-1.5 mb-2">
            <button
              onClick={() => navigate("/forgot-password")}
              className="text-[11px] text-ha-text-muted font-medium hover:text-ha-text-secondary transition-colors"
              data-testid="button-forgot-password"
            >
              {t("authScreen.forgotPassword")}
            </button>
          </div>

          <button
            onClick={() => navigate("/onboarding/intro")}
            className="w-full h-[46px] rounded-full text-[14px] font-semibold text-ha-text border border-ha-card-border bg-transparent hover:bg-ha-card transition-colors active:scale-[0.97]"
            data-testid="button-signup"
          >
            {t("authScreen.signUp")}
          </button>

          <div className="flex items-center gap-3 my-2.5">
            <div className="flex-1 h-px bg-ha-surface" />
            <span className="text-[12px] text-ha-text-muted font-medium">{t("authScreen.or")}</span>
            <div className="flex-1 h-px bg-ha-surface" />
          </div>

          <div className="flex justify-center gap-4">
            <button
              className="w-[48px] h-[48px] rounded-[14px] bg-ha-card border border-ha-card-border flex items-center justify-center hover:bg-ha-surface transition-colors active:scale-[0.95]"
              data-testid="button-google"
              onClick={() => {}}
              aria-label="Continue with Google"
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            </button>

            <button
              className="w-[48px] h-[48px] rounded-[14px] bg-ha-card flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:bg-ha-surface transition-colors active:scale-[0.95]"
              data-testid="button-apple"
              onClick={() => {}}
              aria-label="Continue with Apple"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="black">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
