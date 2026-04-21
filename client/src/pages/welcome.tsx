import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { logoSrc } from "@/components/housalert-logo";
import { useTranslation, hasExplicitLocale, detectBrowserLocale } from "@/i18n";
import type { Locale } from "@/i18n";
import { ChevronDown, Eye, EyeOff, Loader2, ArrowRight, Star } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ensureTrialForCurrentUser } from "@/lib/auth";
import { clearAllUserData } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const BG = "#11358B";
const PRIMARY = "#6192FC";

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
        className="flex items-center gap-[5px] transition-colors active:scale-[0.96]"
        style={{
          backgroundColor: "rgba(255,255,255,0.10)",
          borderRadius: "6px",
          padding: "5px 10px",
        }}
        data-testid="button-language-selector"
      >
        <span className="text-[13px] font-semibold text-white">{current.label}</span>
        <ChevronDown className={`w-3 h-3 text-white/80 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Languages"
          className="absolute top-full right-0 mt-1.5 w-[120px] rounded-[8px] overflow-hidden z-50 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
          style={{ backgroundColor: "#1a4aad", border: "1px solid rgba(255,255,255,0.15)" }}
        >
          {LANGUAGES.map((lang) => {
            const isActive = locale === lang.code;
            return (
              <button
                key={lang.code}
                role="option"
                aria-selected={isActive}
                onClick={() => { setLocale(lang.code); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 transition-colors hover:bg-white/10"
                style={{ backgroundColor: isActive ? "rgba(255,255,255,0.15)" : "transparent" }}
                data-testid={`button-lang-${lang.code}`}
              >
                <span className="text-[15px]">{lang.flag}</span>
                <span className="text-[13px] font-semibold text-white">{lang.label}</span>
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
    try { await ensureTrialForCurrentUser(); } catch {}
    window.location.href = "/home";
  }

  const inputStyle = (extraPadding?: string): React.CSSProperties => ({
    height: "58px",
    borderRadius: "10px",
    background: "#FFFFFF",
    border: "1.5px solid rgba(0,0,0,0.08)",
    padding: extraPadding ?? "0 16px",
    fontSize: "16px",
    color: "#111111",
    transition: "border-color 0.15s",
  });

  return (
    <div
      className="h-[100dvh] flex flex-col overflow-auto"
      style={{ backgroundColor: BG }}
      data-testid="welcome-page"
    >
      {/* ── Header ── */}
      <header
        className="flex items-center justify-between px-5 pb-0"
        style={{ paddingTop: "max(env(safe-area-inset-top), 22px)" }}
      >
        <div className="flex items-center gap-2.5">
          <img
            src={logoSrc}
            alt="HousAlert"
            width={34}
            height={34}
            className="object-contain"
            style={{ width: 34, height: 34 }}
            data-testid="img-housalert-logo"
          />
          <span className="font-bold text-[19px] tracking-[-0.01em] text-white" data-testid="text-logo">
            HousAlert
          </span>
        </div>
        <LanguageDropdown />
      </header>

      {/* ── Main content ── */}
      <main
        className="flex-1 flex flex-col w-full px-5"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 20px)" }}
      >
        {/* Welcome heading — more breathing room above and below */}
        <h1
          className="text-white font-bold tracking-[-0.025em]"
          style={{ fontSize: "32px", lineHeight: "1.12", paddingTop: "36px", paddingBottom: "28px" }}
          data-testid="text-auth-title"
        >
          {t("v2.welcome.title")}
        </h1>

        {/* Login form */}
        <form onSubmit={handleLogin} className="flex flex-col gap-[18px]">

          {/* Email */}
          <div className="flex flex-col gap-[7px]">
            <label className="text-[13px] font-medium text-white/90" htmlFor="welcome-email">
              {t("v2.welcome.emailLabel")}
            </label>
            <input
              id="welcome-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("v2.welcome.emailPlaceholder")}
              required
              className="w-full outline-none"
              style={inputStyle()}
              onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(0,0,0,0.08)"; }}
              data-testid="input-email"
            />
          </div>

          {/* Password */}
          <div className="flex flex-col gap-[7px]">
            <label className="text-[13px] font-medium text-white/90" htmlFor="welcome-password">
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
                className="w-full outline-none"
                style={inputStyle("0 50px 0 16px")}
                onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(0,0,0,0.08)"; }}
                data-testid="input-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-transparent border-0 cursor-pointer p-0"
                style={{ color: "#555" }}
                tabIndex={-1}
                data-testid="button-toggle-password"
              >
                {showPassword ? <EyeOff className="w-[19px] h-[19px]" /> : <Eye className="w-[19px] h-[19px]" />}
              </button>
            </div>

            {/* Forgot password — tight, right-aligned, secondary */}
            <div className="flex justify-end" style={{ marginTop: "2px" }}>
              <button
                type="button"
                onClick={handleForgotPassword}
                className="bg-transparent border-0 cursor-pointer hover:underline"
                style={{ fontSize: "13px", fontWeight: 500, color: PRIMARY }}
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
            className="w-full border-0 cursor-pointer flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
            style={{
              height: "58px",
              borderRadius: "12px",
              background: PRIMARY,
              color: "white",
              fontSize: "17px",
              fontWeight: 700,
              letterSpacing: "-0.01em",
              boxShadow: "0 4px 18px rgba(97,146,252,0.38)",
              marginTop: "2px",
            }}
            data-testid="button-login"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                {t("v2.welcome.login")}
                <ArrowRight className="w-[17px] h-[17px]" strokeWidth={2.5} />
              </>
            )}
          </button>
        </form>

        {/* OF separator — thinner lines, tighter spacing */}
        <div className="flex items-center gap-3" style={{ margin: "20px 0" }}>
          <div className="flex-1" style={{ height: "1px", backgroundColor: "rgba(255,255,255,0.15)" }} />
          <span style={{ fontSize: "12px", fontWeight: 700, color: "rgba(255,255,255,0.55)", letterSpacing: "0.06em" }}>
            {t("v2.welcome.or").toUpperCase()}
          </span>
          <div className="flex-1" style={{ height: "1px", backgroundColor: "rgba(255,255,255,0.15)" }} />
        </div>

        {/* Secondary: sign up — stronger border */}
        <button
          type="button"
          onClick={() => navigate("/onboarding/location")}
          className="w-full cursor-pointer flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
          style={{
            height: "58px",
            borderRadius: "12px",
            border: `2px solid ${PRIMARY}`,
            color: PRIMARY,
            backgroundColor: "transparent",
            fontSize: "17px",
            fontWeight: 700,
            letterSpacing: "-0.01em",
          }}
          data-testid="button-signup"
        >
          {t("v2.welcome.signupCta")}
          <ArrowRight className="w-[17px] h-[17px]" strokeWidth={2.5} />
        </button>

        {/* Spacer — limits growth so Trustpilot stays anchored but not too low */}
        <div className="flex-1" style={{ minHeight: "24px", maxHeight: "64px" }} />

        {/* Trustpilot — integrated into layout rhythm, not dropped to edge */}
        <div className="flex items-center justify-center gap-[10px]" style={{ paddingBottom: "8px" }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>
            Trustpilot
          </span>
          <div className="flex items-center gap-[3px]">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="flex items-center justify-center rounded-[3px]"
                style={{
                  width: "22px",
                  height: "22px",
                  backgroundColor: i <= 4 ? "#00b67a" : "rgba(255,255,255,0.18)",
                }}
              >
                <Star
                  className="w-[11px] h-[11px]"
                  fill={i <= 4 ? "#ffffff" : "#00b67a"}
                  stroke="none"
                />
              </div>
            ))}
          </div>
          <span style={{ fontSize: "14px", fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>
            4.8
          </span>
        </div>
      </main>
    </div>
  );
}
