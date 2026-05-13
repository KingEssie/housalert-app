import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { logoSrc } from "@/components/housalert-logo";
import { supabase } from "@/lib/supabase";
import { setRecoveryMode } from "@/lib/auth";
import { useTranslation } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, CheckCircle2, Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { validatePassword, isPasswordValid } from "@/lib/password-validation";
import { PasswordRules } from "@/components/password-rules";

const OUTER_BG = "#223546";
const CARD_BG = "#1a2b38";
const ACCENT = "#85fb8c";

const inputStyle = (extraPadding?: string): React.CSSProperties => ({
  height: "58px",
  borderRadius: "4px",
  background: "#FFFFFF",
  border: "1.5px solid rgba(0,0,0,0.08)",
  padding: extraPadding ?? "0 16px",
  fontSize: "16px",
  color: "#111111",
  width: "100%",
  outline: "none",
  transition: "border-color 0.15s",
  boxSizing: "border-box",
});

function CardShell({ children, testId }: { children: React.ReactNode; testId?: string }) {
  return (
    <div
      className="h-[100dvh] flex flex-col items-center justify-center px-5"
      style={{ backgroundColor: OUTER_BG }}
      data-testid={testId}
    >
      <div
        className="w-full max-w-[420px] rounded-[12px] px-7 py-8"
        style={{ backgroundColor: CARD_BG }}
      >
        {children}
      </div>
    </div>
  );
}

function CardLogo() {
  return (
    <div className="flex items-center gap-2 mb-8">
      <img src={logoSrc} alt="HousAlert" width={30} height={30} className="object-contain" style={{ width: 30, height: 30 }} />
      <span className="font-bold text-white" style={{ fontSize: "17px", letterSpacing: "-0.01em" }}>HousAlert</span>
    </div>
  );
}

export default function ResetPasswordPage() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const { toast } = useToast();

  const [ready, setReady] = useState(false);
  const [sessionError, setSessionError] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes("access_token")) {
      const params = new URLSearchParams(hash.replace("#", "?"));
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (accessToken && refreshToken) {
        supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        }).then(({ error }) => {
          if (error) {
            console.error("[reset-password] setSession error:", error.message);
            setSessionError(true);
          } else {
            setReady(true);
          }
        });
        return;
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setReady(true);
      } else {
        setSessionError(true);
      }
    });
  }, []);

  const v = validatePassword(password);
  const passwordOk = isPasswordValid(v);
  const mismatch = confirm.length > 0 && password !== confirm;
  const confirmOk = confirm.length > 0 && password === confirm;
  const canSubmit = passwordOk && confirmOk && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (error) {
      toast({
        title: t("resetPassword.error"),
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setRecoveryMode(false);
    await supabase.auth.signOut();
    setSuccess(true);
  }

  /* ── Loading state ── */
  if (!ready && !sessionError) {
    return (
      <div
        className="h-[100dvh] flex items-center justify-center"
        style={{ backgroundColor: OUTER_BG }}
      >
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  /* ── Session error / expired link ── */
  if (sessionError) {
    return (
      <CardShell testId="page-reset-error">
        <CardLogo />
        <h1
          className="font-bold text-white tracking-[-0.025em] mb-3"
          style={{ fontSize: "28px", lineHeight: "1.1" }}
          data-testid="text-error-title"
        >
          {t("resetPassword.expiredTitle")}
        </h1>
        <p
          className="mb-7 leading-[1.5]"
          style={{ fontSize: "15px", color: "rgba(255,255,255,0.65)" }}
        >
          {t("resetPassword.expiredDesc")}
        </p>
        <button
          onClick={() => { setRecoveryMode(false); navigate("/forgot-password"); }}
          className="w-full flex items-center justify-center gap-2 font-bold transition-all active:scale-[0.97]"
          style={{
            height: "58px",
            borderRadius: "4px",
            backgroundColor: ACCENT,
            color: "#000000",
            fontSize: "17px",
            border: "none",
            cursor: "pointer",
            letterSpacing: "-0.01em",
          }}
          data-testid="button-try-again"
        >
          {t("resetPassword.tryAgain")}
          <ArrowRight className="w-[17px] h-[17px]" strokeWidth={2.5} />
        </button>
      </CardShell>
    );
  }

  /* ── Success state ── */
  if (success) {
    return (
      <CardShell testId="page-reset-success">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mb-6"
          style={{ backgroundColor: `${ACCENT}22` }}
        >
          <CheckCircle2 className="w-7 h-7" style={{ color: ACCENT }} />
        </div>
        <h1
          className="font-bold text-white tracking-[-0.02em] mb-3"
          style={{ fontSize: "26px", lineHeight: "1.15" }}
          data-testid="text-success-title"
        >
          {t("resetPassword.successTitle")}
        </h1>
        <p
          className="mb-8 leading-[1.55]"
          style={{ fontSize: "15px", color: "rgba(255,255,255,0.65)", maxWidth: "300px" }}
        >
          {t("resetPassword.successDesc")}
        </p>
        <button
          onClick={() => navigate("/")}
          className="w-full flex items-center justify-center gap-2 font-bold transition-all active:scale-[0.97]"
          style={{
            height: "58px",
            borderRadius: "4px",
            backgroundColor: ACCENT,
            color: "#000000",
            fontSize: "17px",
            border: "none",
            cursor: "pointer",
            letterSpacing: "-0.01em",
          }}
          data-testid="button-go-login"
        >
          {t("resetPassword.goToLogin")}
          <ArrowRight className="w-[17px] h-[17px]" strokeWidth={2.5} />
        </button>
      </CardShell>
    );
  }

  /* ── Main form ── */
  return (
    <CardShell testId="page-reset-password">
      <CardLogo />

      <h1
        className="font-bold text-white tracking-[-0.025em] mb-3"
        style={{ fontSize: "30px", lineHeight: "1.1" }}
        data-testid="text-reset-title"
      >
        {t("resetPassword.title")}
      </h1>

      <p
        className="mb-7 leading-[1.5]"
        style={{ fontSize: "15px", color: "rgba(255,255,255,0.65)" }}
      >
        {t("resetPassword.description")}
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* New password */}
        <div className="flex flex-col gap-[7px]">
          <label className="font-semibold text-white" style={{ fontSize: "13px" }}>
            {t("resetPassword.newPassword")}
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={inputStyle("0 50px 0 16px")}
              autoComplete="new-password"
              autoFocus
              onFocus={(e) => { e.currentTarget.style.borderColor = ACCENT; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(0,0,0,0.08)"; }}
              data-testid="input-new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-transparent border-0 cursor-pointer p-0"
              style={{ color: "#555" }}
              data-testid="button-toggle-password"
            >
              {showPassword ? <EyeOff className="w-[19px] h-[19px]" /> : <Eye className="w-[19px] h-[19px]" />}
            </button>
          </div>
          <PasswordRules password={password} />
        </div>

        {/* Confirm password */}
        <div className="flex flex-col gap-[7px]">
          <label className="font-semibold text-white" style={{ fontSize: "13px" }}>
            {t("resetPassword.confirmPassword")}
          </label>
          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              style={inputStyle("0 50px 0 16px")}
              autoComplete="new-password"
              onFocus={(e) => { e.currentTarget.style.borderColor = ACCENT; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(0,0,0,0.08)"; }}
              data-testid="input-confirm-password"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-transparent border-0 cursor-pointer p-0"
              style={{ color: "#555" }}
              data-testid="button-toggle-confirm"
            >
              {showConfirm ? <EyeOff className="w-[19px] h-[19px]" /> : <Eye className="w-[19px] h-[19px]" />}
            </button>
          </div>
          {mismatch && (
            <p className="text-[13px]" style={{ color: "#ffb3b3" }} data-testid="text-error-mismatch">
              {t("resetPassword.mismatch")}
            </p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full flex items-center justify-center gap-2 font-bold transition-all active:scale-[0.97]"
          style={{
            height: "58px",
            borderRadius: "4px",
            backgroundColor: canSubmit ? ACCENT : `${ACCENT}55`,
            color: "#000000",
            fontSize: "17px",
            border: "none",
            cursor: canSubmit ? "pointer" : "not-allowed",
            letterSpacing: "-0.01em",
            marginTop: "2px",
          }}
          data-testid="button-submit"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              {t("resetPassword.submit")}
              <ArrowRight className="w-[17px] h-[17px]" strokeWidth={2.5} />
            </>
          )}
        </button>
      </form>

      {/* Back to login */}
      <button
        type="button"
        onClick={() => navigate("/")}
        className="flex items-center gap-2 mt-5 bg-transparent border-0 cursor-pointer hover:underline"
        style={{ fontSize: "14px", fontWeight: 600, color: "#FFFFFF" }}
        data-testid="button-back-to-login"
      >
        <ArrowLeft className="w-4 h-4" strokeWidth={2.5} />
        {t("forgotPassword.backToLogin")}
      </button>
    </CardShell>
  );
}
