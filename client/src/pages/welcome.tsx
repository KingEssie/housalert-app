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
        className="flex items-center gap-1 px-2.5 py-1 rounded-[5px] transition-colors active:scale-[0.96]"
        style={{ backgroundColor: "rgba(255,255,255,0.12)", color: "#FFFFFF" }}
        data-testid="button-language-selector"
      >
        <span className="text-[14px] font-semibold text-white">{current.label}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-white transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Languages"
          className="absolute top-full right-0 mt-1.5 w-[140px] rounded-[8px] overflow-hidden z-50 shadow-[0_8px_24px_rgba(0,0,0,0.3)]"
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
                className="w-full flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/10"
                style={{ backgroundColor: isActive ? "rgba(255,255,255,0.15)" : "transparent" }}
                data-testid={`button-lang-${lang.code}`}
              >
                <span className="text-[16px]">{lang.flag}</span>
                <span className={`text-[14px] font-semibold text-white`}>
                  {lang.label}
                </span>
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

  return (
    <div
      className="h-[100dvh] flex flex-col overflow-auto"
      style={{ backgroundColor: BG }}
      data-testid="welcome-page"
    >
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),20px)] pb-0">
        <div className="flex items-center gap-2.5">
          <img
            src={logoSrc}
            alt="HousAlert"
            width={36}
            height={36}
            className="object-contain"
            style={{ width: 36, height: 36 }}
            data-testid="img-housalert-logo"
          />
          <span
            className="font-bold text-[20px] tracking-[-0.01em] text-white"
            data-testid="text-logo"
          >
            HousAlert
          </span>
        </div>
        <LanguageDropdown />
      </header>

      {/* ── Main content ── */}
      <main className="flex-1 flex flex-col w-full px-5 pb-[max(env(safe-area-inset-bottom),16px)]">

        {/* Welcome heading */}
        <h1
          className="text-[30px] font-bold leading-[1.15] tracking-[-0.02em] pt-7 pb-6 text-white"
          data-testid="text-auth-title"
        >
          {t("v2.welcome.title")}
        </h1>

        {/* Login form */}
        <form onSubmit={handleLogin} className="flex flex-col gap-5">

          {/* Email */}
          <div className="flex flex-col gap-2">
            <label
              className="text-[14px] font-semibold text-white"
              htmlFor="welcome-email"
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
              className="w-full outline-none"
              style={{
                height: "56px",
                borderRadius: "12px",
                background: "#FFFFFF",
                border: "2px solid transparent",
                padding: "0 16px",
                fontSize: "16px",
                color: "#111111",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
              data-testid="input-email"
            />
          </div>

          {/* Password */}
          <div className="flex flex-col gap-2">
            <label
              className="text-[14px] font-semibold text-white"
              htmlFor="welcome-password"
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
                className="w-full outline-none"
                style={{
                  height: "56px",
                  borderRadius: "12px",
                  background: "#FFFFFF",
                  border: "2px solid transparent",
                  padding: "0 48px 0 16px",
                  fontSize: "16px",
                  color: "#111111",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = PRIMARY; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                data-testid="input-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-transparent border-0 cursor-pointer p-0"
                style={{ color: "#666" }}
                tabIndex={-1}
                data-testid="button-toggle-password"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {/* Forgot password */}
            <div className="flex justify-end mt-0.5">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-[14px] font-medium bg-transparent border-0 cursor-pointer hover:underline"
                style={{ color: PRIMARY }}
                data-testid="button-forgot-password"
              >
                {t("v2.welcome.forgotPassword")}
              </button>
            </div>
          </div>

          {/* Login button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full border-0 font-semibold cursor-pointer flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
            style={{
              height: "56px",
              borderRadius: "14px",
              background: PRIMARY,
              color: "white",
              fontSize: "17px",
              fontWeight: 600,
            }}
            data-testid="button-login"
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
        </form>

        {/* OF separator */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px" style={{ backgroundColor: "rgba(255,255,255,0.2)" }} />
          <span className="text-[13px] font-bold text-white uppercase tracking-wider">
            {t("v2.welcome.or")}
          </span>
          <div className="flex-1 h-px" style={{ backgroundColor: "rgba(255,255,255,0.2)" }} />
        </div>

        {/* Secondary: sign up */}
        <button
          type="button"
          onClick={() => navigate("/onboarding/location")}
          className="w-full font-semibold cursor-pointer flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
          style={{
            height: "56px",
            borderRadius: "14px",
            border: `2px solid ${PRIMARY}`,
            color: PRIMARY,
            backgroundColor: "transparent",
            fontSize: "17px",
            fontWeight: 600,
          }}
          data-testid="button-signup"
        >
          {t("v2.welcome.signupCta")}
          <ArrowRight className="w-4 h-4" />
        </button>

        {/* Spacer */}
        <div className="flex-1 min-h-[16px]" />

        {/* Trustpilot */}
        <div className="flex items-center justify-center gap-2.5 pt-3 pb-2">
          <span className="text-[13px] font-semibold text-white">
            Trustpilot
          </span>
          <div className="flex items-center gap-[3px]">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="w-[22px] h-[22px] flex items-center justify-center rounded-[3px]"
                style={{ backgroundColor: i <= 4 ? "#00b67a" : "rgba(255,255,255,0.25)" }}
              >
                <Star
                  className="w-3 h-3"
                  fill={i <= 4 ? "#ffffff" : "#00b67a"}
                  stroke="none"
                />
              </div>
            ))}
          </div>
          <span className="text-[14px] font-semibold text-white">
            4.8
          </span>
        </div>
      </main>
    </div>
  );
}
