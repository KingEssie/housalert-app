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
const BG      = "#f5f3ef";

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

    // ── Helper: reads a URL param from both window.location.search and the hash
    // fragment (native hash-router has params inside the hash, not in search).
    function getParam(key: string): string | null {
      const fromSearch = new URLSearchParams(window.location.search).get(key);
      if (fromSearch) return fromSearch;
      const hash = window.location.hash;  // e.g. "#/login?payment=success&next=/onboarding/setup"
      const qIdx = hash.indexOf("?");
      if (qIdx !== -1) return new URLSearchParams(hash.slice(qIdx)).get(key);
      return null;
    }

    // ── 1. Payment-success path ──────────────────────────────────────────────
    // Triggered by:
    //   a) ha_pending_checkout_success=true in localStorage or sessionStorage
    //   b) ?payment=success in the URL (set by the "Doorgaan in browser" button)
    // In either case navigate to /onboarding/setup — NEVER dashboard.
    try {
      const storageFlag =
        localStorage.getItem("ha_pending_checkout_success") === "true" ||
        sessionStorage.getItem("ha_pending_checkout_success") === "true";
      const urlPayment = getParam("payment") === "success";

      if (storageFlag || urlPayment) {
        const pendingNext =
          localStorage.getItem("ha_pending_checkout_next") ??
          sessionStorage.getItem("ha_pending_checkout_next") ??
          getParam("next") ??
          "/onboarding/setup";

        // Clear all pending-payment flags
        ["ha_pending_checkout_success", "ha_pending_checkout_next"].forEach(k => {
          try { localStorage.removeItem(k); } catch {}
          try { sessionStorage.removeItem(k); } catch {}
        });

        console.log("[login] payment success next detected");
        console.log("[login] navigating to", pendingNext);
        navigate(pendingNext);
        return;
      }
    } catch {}

    // ── 2. Legacy: stored session_id — resume checkout confirmation ──────────
    try {
      const raw = localStorage.getItem("ha_pending_checkout");
      if (raw) {
        const { session_id, ts } = JSON.parse(raw);
        if (session_id && Date.now() - (ts ?? 0) < 30 * 60 * 1000) {
          localStorage.removeItem("ha_pending_checkout");
          console.log("[login] resuming pending checkout session after login");
          navigate(`/checkout/success?session_id=${encodeURIComponent(session_id)}`);
          return;
        }
        localStorage.removeItem("ha_pending_checkout");
      }
    } catch {}

    // ── 3. ?next= redirect param (hash-router aware) ─────────────────────────
    const next = getParam("next");
    if (next && next.startsWith("/")) {
      console.log("[login] navigating to ?next param:", next);
      navigate(next);
      return;
    }

    // ── 4. Default ───────────────────────────────────────────────────────────
    navigate("/dashboard?tab=matches");
  }

  const inputBase: React.CSSProperties = {
    height: "56px",
    borderRadius: "14px",
    background: "#ffffff",
    border: "1px solid #e5e5e5",
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
    e.currentTarget.style.borderColor = "#e5e5e5";
    e.currentTarget.style.boxShadow = "none";
  }

  return (
    <div
      className="min-h-[100dvh] flex flex-col"
      style={{ backgroundColor: BG }}
      data-testid="welcome-page"
    >
      {/* ── Header — blends into background, no card ── */}
      <header
        className="flex items-center justify-between px-6"
        style={{
          paddingTop: "max(env(safe-area-inset-top), 20px)",
          paddingBottom: "12px",
        }}
      >
        <img
          src={logoSrc}
          alt="HousAlert"
          className="object-contain block"
          style={{ height: 28, width: "auto", mixBlendMode: "multiply" }}
          data-testid="img-housalert-logo"
        />
        <LanguageDropdown />
      </header>

      {/* ── Main — content directly on page, no floating card ── */}
      <main
        className="flex-1 flex flex-col w-full max-w-[440px] mx-auto px-6"
        style={{
          paddingTop: "32px",
          paddingBottom: "max(env(safe-area-inset-bottom), 40px)",
        }}
      >
        {/* Heading */}
        <h1
          style={{
            fontSize: "clamp(28px, 7vw, 34px)",
            fontWeight: 800,
            color: "#111111",
            lineHeight: "1.08",
            letterSpacing: "-0.03em",
            marginBottom: "10px",
          }}
          data-testid="text-auth-title"
        >
          {t("v2.welcome.title")}
        </h1>
        <p style={{ fontSize: "15px", color: "#888888", lineHeight: "1.55", marginBottom: "40px" }}>
          {t("v2.welcome.subtitle") || "Inloggen op je account"}
        </p>

        {/* ── Form ── */}
        <form onSubmit={handleLogin} className="flex flex-col" style={{ gap: "18px" }}>

          {/* Email */}
          <div className="flex flex-col" style={{ gap: "7px" }}>
            <label
              htmlFor="welcome-email"
              style={{ fontSize: "13px", fontWeight: 600, color: "#333333", letterSpacing: "0.005em" }}
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
              style={inputBase}
              onFocus={onFocus}
              onBlur={onBlur}
              data-testid="input-email"
            />
          </div>

          {/* Password */}
          <div className="flex flex-col" style={{ gap: "7px" }}>
            <label
              htmlFor="welcome-password"
              style={{ fontSize: "13px", fontWeight: 600, color: "#333333", letterSpacing: "0.005em" }}
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
                style={{ ...inputBase, paddingRight: "52px" }}
                onFocus={onFocus}
                onBlur={onBlur}
                data-testid="input-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-[16px] top-1/2 -translate-y-1/2 bg-transparent border-0 cursor-pointer p-0"
                style={{ color: "#aaaaaa" }}
                tabIndex={-1}
                data-testid="button-toggle-password"
              >
                {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
              </button>
            </div>
            {/* Forgot password — right-aligned, purple */}
            <div className="flex justify-end" style={{ marginTop: "2px" }}>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); navigate("/forgot-password"); }}
                className="bg-transparent border-0 cursor-pointer"
                style={{ fontSize: "13px", fontWeight: 600, color: PURPLE, padding: 0 }}
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
            className="w-full border-0 cursor-pointer flex items-center justify-center gap-2 transition-all active:scale-[0.97] disabled:opacity-60"
            style={{
              height: "56px",
              borderRadius: "9999px",
              background: GREEN,
              color: "#223546",
              fontSize: "16px",
              fontWeight: 700,
              letterSpacing: "-0.01em",
              marginTop: "6px",
              boxShadow: "0 4px 20px rgba(133,251,140,0.40)",
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

        {/* ── OR divider ── */}
        <div className="flex items-center gap-3" style={{ margin: "32px 0" }}>
          <div className="flex-1" style={{ height: "1px", backgroundColor: "#e5e2db" }} />
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#bbbbbb", letterSpacing: "0.09em" }}>
            {t("v2.welcome.or").toUpperCase()}
          </span>
          <div className="flex-1" style={{ height: "1px", backgroundColor: "#e5e2db" }} />
        </div>

        {/* ── Sign-up CTA ── */}
        <button
          type="button"
          onClick={() => navigate("/onboarding/location")}
          className="w-full cursor-pointer flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
          style={{
            height: "56px",
            border: `1.5px solid ${PURPLE}`,
            borderRadius: "9999px",
            color: "#171429",
            backgroundColor: "transparent",
            fontSize: "16px",
            fontWeight: 700,
            letterSpacing: "-0.01em",
          }}
          data-testid="button-signup"
        >
          {t("v2.welcome.signupCta")}
          <ArrowRight className="w-[16px] h-[16px]" strokeWidth={2.5} style={{ color: "#171429" }} />
        </button>

        {/* ── Trustpilot — integrated, no card ── */}
        <div
          className="flex items-center justify-center gap-[10px]"
          style={{ marginTop: "40px" }}
        >
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
