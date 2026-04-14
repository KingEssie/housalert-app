import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { HousAlertLogo } from "@/components/housalert-logo";
import { supabase } from "@/lib/supabase";
import { setRecoveryMode } from "@/lib/auth";
import { useTranslation } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, CheckCircle2, Loader2 } from "lucide-react";
import { validatePassword, isPasswordValid } from "@/lib/password-validation";
import { PasswordRules } from "@/components/password-rules";

const INPUT_CLASS =
  "w-full h-[56px] border border-[#D1D5DB] rounded-[8px] bg-white px-4 pr-12 text-[15px] text-[#111111] placeholder:text-[#9CA3AF] outline-none transition-all focus:border-ha-primary";

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

  if (sessionError) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center px-8 text-center" style={{ backgroundColor: "#eaeaeb" }} data-testid="page-reset-error">
        <h1 className="text-[30px] font-semibold text-[#111111] mb-3" data-testid="text-error-title">
          {t("resetPassword.expiredTitle")}
        </h1>
        <p className="text-[15px] text-ha-text-muted leading-[1.5] max-w-[320px] mb-6">
          {t("resetPassword.expiredDesc")}
        </p>
        <button
          onClick={() => { setRecoveryMode(false); navigate("/forgot-password"); }}
          className="h-[48px] px-8 rounded-[10px] text-[15px] font-semibold text-white bg-ha-primary hover:bg-ha-primary-hover transition-colors active:scale-[0.97]"
          data-testid="button-try-again"
        >
          {t("resetPassword.tryAgain")}
        </button>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center" style={{ backgroundColor: "#eaeaeb" }}>
        <Loader2 className="w-8 h-8 animate-spin text-[#111111]" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center px-8 text-center" style={{ backgroundColor: "#eaeaeb" }} data-testid="page-reset-success">
        <div className="w-16 h-16 rounded-full bg-[#DCFCE7] flex items-center justify-center mb-6">
          <CheckCircle2 className="w-8 h-8 text-[#16A34A]" />
        </div>
        <h1 className="text-[24px] font-semibold text-[#111111] tracking-[-0.02em] mb-3" data-testid="text-success-title">
          {t("resetPassword.successTitle")}
        </h1>
        <p className="text-[15px] text-ha-text-muted leading-[1.55] max-w-[320px] mb-8">
          {t("resetPassword.successDesc")}
        </p>
        <button
          onClick={() => navigate("/")}
          className="h-[48px] px-8 rounded-[10px] text-[15px] font-semibold text-white bg-ha-primary hover:bg-ha-primary-hover transition-colors active:scale-[0.97]"
          data-testid="button-go-login"
        >
          {t("resetPassword.goToLogin")}
        </button>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col" style={{ backgroundColor: "#eaeaeb" }} data-testid="page-reset-password">
      <div className="pt-[max(env(safe-area-inset-top),8px)]" />

      <div className="flex-1 flex flex-col px-7">
        <div className="flex justify-center pt-8 pb-8">
          <HousAlertLogo size={44} showText={true} textClassName="font-semibold text-[#111111] text-[20px] tracking-[-0.01em]" />
        </div>

        <h1
          className="text-[26px] font-semibold text-[#111111] leading-[1.15] tracking-[-0.03em] mb-3 text-center"
          data-testid="text-reset-title"
        >
          Wachtwoord
        </h1>

        <p className="text-[15px] text-ha-text-muted leading-[1.55] text-center max-w-[340px] mx-auto mb-8">
          {t("resetPassword.description")}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="block text-[15px] font-semibold text-[#111111] mb-2">
              Wachtwoord
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimaal 8 tekens"
                className={INPUT_CLASS}
                autoComplete="new-password"
                autoFocus
                data-testid="input-new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
                data-testid="button-toggle-password"
              >
                {showPassword
                  ? <EyeOff className="w-[18px] h-[18px]" />
                  : <Eye className="w-[18px] h-[18px]" />}
              </button>
            </div>
            <PasswordRules password={password} />
          </div>

          <div>
            <label className="block text-[15px] font-semibold text-[#111111] mb-2">
              Wachtwoord bevestigen
            </label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Herhaal je wachtwoord"
                className={INPUT_CLASS}
                autoComplete="new-password"
                data-testid="input-confirm-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
                data-testid="button-toggle-confirm"
              >
                {showConfirm
                  ? <EyeOff className="w-[18px] h-[18px]" />
                  : <Eye className="w-[18px] h-[18px]" />}
              </button>
            </div>
            {mismatch && (
              <p className="text-[13px] mt-2 text-[#E11D48]" data-testid="text-error-mismatch">
                Wachtwoorden komen niet overeen
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className={`w-full h-[52px] rounded-[10px] text-[15px] font-semibold transition-all active:scale-[0.97] flex items-center justify-center ${
              canSubmit
                ? "bg-ha-primary hover:bg-ha-primary-hover text-white"
                : "bg-ha-primary/30 text-white cursor-not-allowed"
            }`}
            data-testid="button-submit"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Opslaan...</>
              : "Opslaan"
            }
          </button>
        </form>
      </div>

      <div className="pb-[max(env(safe-area-inset-bottom),20px)]" />
    </div>
  );
}
