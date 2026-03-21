import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { HousAlertLogo } from "@/components/housalert-logo";
import { useTranslation, hasExplicitLocale, detectBrowserLocale } from "@/i18n";
import type { Locale } from "@/i18n";
import { ChevronDown } from "lucide-react";
import heroImg from "@assets/50F77D08-ED68-40B2-AFD3-67D49A86100C_1774074748083.png";

const BRAND = "#F97316";
const BRAND_HOVER = "#EA580C";

const LANGUAGES: { code: Locale; label: string; flag: string }[] = [
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "nl", label: "Nederlands", flag: "🇳🇱" },
  { code: "en", label: "English", flag: "🇬🇧" },
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
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 transition-colors active:scale-[0.96]"
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
          className="absolute top-full left-0 mt-1.5 w-[180px] bg-white rounded-2xl border border-[#E5E7EB] shadow-[0_8px_30px_rgba(0,0,0,0.15)] overflow-hidden z-50"
        >
          {LANGUAGES.map((lang) => {
            const isActive = locale === lang.code;
            return (
              <button
                key={lang.code}
                role="option"
                aria-selected={isActive}
                onClick={() => { setLocale(lang.code); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${isActive ? "bg-[#FFF7ED]" : "hover:bg-[#F9FAFB]"}`}
                data-testid={`button-lang-${lang.code}`}
              >
                <span className="text-[16px]">{lang.flag}</span>
                <span className={`text-[14px] font-semibold ${isActive ? "text-[#1A1A1A]" : "text-[#555555]"}`}>
                  {lang.label}
                </span>
                {isActive && (
                  <div className="ml-auto w-4.5 h-4.5 rounded-full flex items-center justify-center" style={{ backgroundColor: BRAND }}>
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

  useEffect(() => {
    if (!hasExplicitLocale()) {
      const detected = detectBrowserLocale();
      setLocale(detected);
    }
  }, [setLocale]);

  return (
    <div className="h-[100dvh] bg-white flex flex-col relative" data-testid="welcome-page">
      <div className="relative w-full flex-shrink-0" style={{ height: "55%" }}>
        <img
          src={heroImg}
          alt=""
          className="w-full h-full object-cover"
          data-testid="auth-hero-image"
          draggable={false}
        />

        <div className="absolute inset-0 pointer-events-none" style={{
          background: "linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.55) 100%)"
        }} />

        <div className="absolute top-0 left-0 right-0 pt-[max(env(safe-area-inset-top),8px)] px-5 flex items-center justify-between z-10">
          <div className="pt-3">
            <HousAlertLogo
              size={32}
              showText={true}
              textClassName="font-bold text-white text-[17px] tracking-[-0.01em] drop-shadow-[0_1px_3px_rgba(0,0,0,0.3)]"
            />
          </div>
          <div className="pt-3">
            <LanguageDropdown />
          </div>
        </div>
      </div>

      <div
        className="relative flex-1 bg-white flex flex-col overflow-y-auto"
        style={{
          borderRadius: "32px 32px 0 0",
          marginTop: "-40px",
          zIndex: 5,
          boxShadow: "0 -8px 40px rgba(0,0,0,0.1)",
        }}
      >
        <div className="flex flex-col items-center text-center px-7 pt-8 pb-2">
          <h1
            className="text-[26px] font-bold text-[#1A1A1A] leading-[1.15] tracking-[-0.03em] mb-2"
            data-testid="text-auth-title"
          >
            {t("authScreen.title")}
          </h1>
          <p
            className="text-[15px] text-[#6B7280] leading-[1.5] max-w-[290px]"
            data-testid="text-auth-subtitle"
          >
            {t("authScreen.subtitle")}
          </p>
        </div>

        <div className="flex-1 min-h-[16px]" />

        <div className="px-6 pb-[max(env(safe-area-inset-bottom),16px)] flex flex-col items-center">
          <div className="w-full flex gap-3 mb-2">
            <button
              onClick={() => navigate("/onboarding/location")}
              className="flex-1 h-[50px] rounded-full text-[15px] font-bold text-white transition-all active:scale-[0.97] shadow-[0_4px_16px_rgba(249,115,22,0.35)]"
              style={{ backgroundColor: BRAND }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = BRAND_HOVER)}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = BRAND)}
              data-testid="button-signup"
            >
              {t("authScreen.signUp")}
            </button>

            <button
              onClick={() => navigate("/login")}
              className="flex-1 h-[50px] rounded-full text-[15px] font-semibold text-[#1A1A1A] border border-[#E0E0E0] bg-white hover:bg-[#F9FAFB] transition-colors active:scale-[0.97]"
              data-testid="button-login"
            >
              {t("authScreen.logIn")}
            </button>
          </div>

          <div className="w-full flex justify-end pr-1 mb-4">
            <button
              onClick={() => navigate("/login")}
              className="text-[12px] text-[#AAAAAA] font-medium hover:text-[#888888] transition-colors"
              data-testid="button-forgot-password"
            >
              {t("authScreen.forgotPassword")}
            </button>
          </div>

          <div className="w-full flex items-center gap-4 mb-4">
            <div className="flex-1 h-px bg-[#E5E7EB]" />
            <span className="text-[13px] text-[#B0B0B0] font-medium">{t("authScreen.or")}</span>
            <div className="flex-1 h-px bg-[#E5E7EB]" />
          </div>

          <div className="flex gap-5">
            <button
              className="w-[52px] h-[52px] rounded-full bg-white border border-[#E5E7EB] shadow-[0_2px_8px_rgba(0,0,0,0.08)] flex items-center justify-center hover:shadow-[0_4px_12px_rgba(0,0,0,0.12)] transition-shadow active:scale-[0.95]"
              data-testid="button-google"
              onClick={() => {}}
              aria-label="Continue with Google"
            >
              <svg width="22" height="22" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            </button>

            <button
              className="w-[52px] h-[52px] rounded-full bg-black flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:bg-[#1A1A1A] transition-colors active:scale-[0.95]"
              data-testid="button-apple"
              onClick={() => {}}
              aria-label="Continue with Apple"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
