import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { logoSrc } from "@/components/housalert-logo";
import { useTranslation, hasExplicitLocale, detectBrowserLocale } from "@/i18n";
import type { Locale } from "@/i18n";
import { ChevronDown, Eye, EyeOff, Loader2, ArrowRight, Star } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { clearAllUserData } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const GREEN   = "#85fb8c";
const PURPLE  = "#bbadfb";

const LANGUAGES: { code: Locale; label: string; flag: string }[] = [
  { code: "de", label: "DE", flag: "\u{1F1E9}\u{1F1EA}" },
  { code: "nl", label: "NL", flag: "\u{1F1F3}\u{1F1F1}" },
  { code: "en", label: "EN", flag: "\u{1F1EC}\u{1F1E7}" },
];

function LanguageDropdown() {
  const { locale, setLocale } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LANGUAGES.find((l) => l.code === locale) || LANGUAGES[1];

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
        className="flex items-center gap-[5px] transition-all active:scale-[0.95]"
        style={{
          backgroundColor: "rgba(0,0,0,0.06)",
          borderRadius: "8px",
          padding: "6px 10px",
        }}
        data-testid="button-language-selector"
      >
        <span className="text-[13px] font-semibold" style={{ color: "#111111" }}>{current.label}</span>
        <ChevronDown className="w-3 h-3" style={{ color: "#666666" }} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Languages"
          className="absolute top-full right-0 mt-1.5 w-[120px] rounded-[12px] overflow-hidden z-50"
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid #eceaef",
            boxShadow: "0 8px 28px rgba(0,0,0,0.10)",
          }}
        >
          {LANGUAGES.map((lang) => {
            const isActive = locale === lang.code;
            return (
              <button
                key={lang.code}
                role="option"
                aria-selected={isActive}
                onClick={() => { setLocale(lang.code); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 transition-colors"
                style={{ backgroundColor: isActive ? "rgba(187,173,251,0.10)" : "transparent" }}
                data-testid={`button-lang-${lang.code}`}
              >
                <span className="text-[15px]">{lang.flag}</span>
                <span className="text-[13px] font-semibold" style={{ color: "#111111" }}>{lang.label}</span>
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

  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]       = useState(false);

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
      redirectTo: `${window.location.origin}/reset-password`,
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
    window.location.href = "/dashboard?tab=matches";
  }

  const inputBase: React.CSSProperties = {
    height: "52px",
    borderRadius: "12px",
    background: "#ffffff",
    border: "1.5px solid #e7e7e7",
    padding: "0 16px",
    fontSize: "15px",
    color: "#111111",
    width: "100%",
    outline: "none",
    transition: "border-color 0.15s, box-shadow 0.15s",
    boxSizing: "border-box",
  };

  function onFocus(e: React.FocusEvent<HTMLInputElement>) {
    e.currentTarget.style.borderColor = PURPLE;
    e.currentTarget.style.boxShadow = "0 0 0 3.5px rgba(187,173,251,0.18)";
  }
  function onBlur(e: React.FocusEvent<HTMLInputElement>) {
    e.currentTarget.style.borderColor = "#e7e7e7";
    e.currentTarget.style.boxShadow = "none";
  }

  return (
    <div
      className="h-[100dvh] flex flex-col overflow-auto"
      style={{ backgroundColor: "#f5f5f7" }}
      data-testid="welcome-page"
    >
      {/* ── Header ── */}
      <header
        className="bg-white flex items-center justify-between px-6"
        style={{
          paddingTop: "max(env(safe-area-inset-top), 16px)",
          paddingBottom: "14px",
          borderBottom: "1px solid #f0eef4",
          boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
        }}
      >
        {/* Logo — mix-blend-mode:multiply makes white areas transparent */}
        <img
          src={logoSrc}
          alt="HousAlert"
          className="object-contain block"
          style={{
            height: 30,
            width: "auto",
            mixBlendMode: "multiply",
          }}
          data-testid="img-housalert-logo"
        />
        <LanguageDropdown />
      </header>

      {/* ── Main ── */}
      <main
        className="flex-1 flex flex-col items-center justify-center px-5"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 32px)", paddingTop: "24px" }}
      >
        {/* Login card */}
        <div
          className="w-full max-w-[420px] bg-white flex flex-col"
          style={{
            borderRadius: "24px",
            border: "1px solid #eeebf3",
            boxShadow: "0 2px 16px rgba(0,0,0,0.05), 0 8px 32px rgba(0,0,0,0.04)",
            padding: "36px 32px 32px",
          }}
        >
          {/* Heading */}
          <h1
            className="font-extrabold tracking-[-0.03em]"
            style={{ fontSize: "26px", lineHeight: "1.1", color: "#111111", marginBottom: "6px" }}
            data-testid="text-auth-title"
          >
            {t("v2.welcome.title")}
          </h1>
          <p style={{ fontSize: "14px", color: "#888888", lineHeight: "1.5", marginBottom: "28px" }}>
            {t("v2.welcome.subtitle") || "Inloggen op je account"}
          </p>

          {/* Form */}
          <form onSubmit={handleLogin} className="flex flex-col" style={{ gap: "16px" }}>

            {/* Email */}
            <div className="flex flex-col" style={{ gap: "5px" }}>
              <label
                htmlFor="welcome-email"
                style={{ fontSize: "12px", fontWeight: 500, color: "#444444", letterSpacing: "0.01em" }}
              >
                {t("v2.welcome.emailLabel")}
              </label>
              <input
                id="welcome-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("v2.welcome.emailPlaceholder")}
                required
                style={{ ...inputBase, color: "#111111" }}
                onFocus={onFocus}
                onBlur={onBlur}
                data-testid="input-email"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col" style={{ gap: "5px" }}>
              <label
                htmlFor="welcome-password"
                style={{ fontSize: "12px", fontWeight: 500, color: "#444444", letterSpacing: "0.01em" }}
              >
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
                  style={{ ...inputBase, paddingRight: "48px" }}
                  onFocus={onFocus}
                  onBlur={onBlur}
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-[14px] top-1/2 -translate-y-1/2 bg-transparent border-0 cursor-pointer p-0"
                  style={{ color: "#aaaaaa" }}
                  tabIndex={-1}
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                </button>
              </div>
              <div className="flex justify-end" style={{ marginTop: "1px" }}>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); navigate("/forgot-password"); }}
                  className="bg-transparent border-0 cursor-pointer"
                  style={{ fontSize: "12px", fontWeight: 600, color: PURPLE }}
                  data-testid="button-forgot-password"
                >
                  {t("v2.welcome.forgotPassword")}
                </button>
              </div>
            </div>

            {/* Primary login button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full border-0 cursor-pointer flex items-center justify-center gap-[7px] transition-all active:scale-[0.97] disabled:opacity-60"
              style={{
                height: "52px",
                borderRadius: "9999px",
                background: GREEN,
                color: "#111111",
                fontSize: "16px",
                fontWeight: 700,
                letterSpacing: "-0.01em",
                marginTop: "4px",
                boxShadow: "0 2px 12px rgba(133,251,140,0.38)",
              }}
              data-testid="button-login"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {t("v2.welcome.login")}
                  <ArrowRight className="w-[16px] h-[16px]" strokeWidth={2.5} />
                </>
              )}
            </button>
          </form>

          {/* OR divider */}
          <div className="flex items-center gap-3" style={{ margin: "22px 0" }}>
            <div className="flex-1" style={{ height: "1px", backgroundColor: "#eeebf3" }} />
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#bbbbbb", letterSpacing: "0.07em" }}>
              {t("v2.welcome.or").toUpperCase()}
            </span>
            <div className="flex-1" style={{ height: "1px", backgroundColor: "#eeebf3" }} />
          </div>

          {/* Sign up button */}
          <button
            type="button"
            onClick={() => navigate("/onboarding/location?source=website")}
            className="w-full cursor-pointer flex items-center justify-center gap-[7px] transition-all active:scale-[0.97]"
            style={{
              height: "52px",
              border: `1px solid ${PURPLE}`,
              borderRadius: "9999px",
              color: "#111111",
              backgroundColor: "rgba(187,173,251,0.04)",
              fontSize: "16px",
              fontWeight: 700,
              letterSpacing: "-0.01em",
            }}
            data-testid="button-signup"
          >
            {t("v2.welcome.signupCta")}
            <ArrowRight className="w-[16px] h-[16px]" strokeWidth={2.5} />
          </button>
        </div>

        {/* Trustpilot — just below card, anchored */}
        <div className="flex items-center justify-center gap-[9px]" style={{ marginTop: "20px" }}>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#999999" }}>Trustpilot</span>
          <div className="flex items-center gap-[2px]">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="flex items-center justify-center rounded-[3px]"
                style={{
                  width: "18px",
                  height: "18px",
                  backgroundColor: i <= 4 ? "#00b67a" : "#e5e5e5",
                }}
              >
                <Star
                  className="w-[9px] h-[9px]"
                  fill={i <= 4 ? "#ffffff" : "#bbbbbb"}
                  stroke="none"
                />
              </div>
            ))}
          </div>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "#444444" }}>4.8</span>
        </div>
      </main>
    </div>
  );
}
