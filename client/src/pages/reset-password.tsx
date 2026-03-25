import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { HousAlertLogo } from "@/components/housalert-logo";
import { supabase } from "@/lib/supabase";
import { setRecoveryMode } from "@/lib/auth";
import { useTranslation } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock, CheckCircle2, Loader2 } from "lucide-react";

const BRAND = "#E91E63";
const BRAND_HOVER = "#D81B60";

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

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = password.length >= 8 && password === confirm && !loading;

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
      <div className="h-[100dvh] bg-[#1A1A2E] flex flex-col items-center justify-center px-8 text-center" data-testid="page-reset-error">
        <h1 className="text-[22px] font-bold text-white mb-3" data-testid="text-error-title">
          {t("resetPassword.expiredTitle")}
        </h1>
        <p className="text-[15px] text-[#9CA3AF] leading-[1.5] max-w-[320px] mb-6">
          {t("resetPassword.expiredDesc")}
        </p>
        <button
          onClick={() => { setRecoveryMode(false); navigate("/forgot-password"); }}
          className="h-[50px] px-8 rounded-full text-[15px] font-bold text-white transition-all active:scale-[0.97]"
          style={{ backgroundColor: BRAND }}
          data-testid="button-try-again"
        >
          {t("resetPassword.tryAgain")}
        </button>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="h-[100dvh] bg-[#1A1A2E] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#E91E63]" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="h-[100dvh] bg-[#1A1A2E] flex flex-col items-center justify-center px-8 text-center" data-testid="page-reset-success">
        <div className="w-16 h-16 rounded-full bg-[#00C896]/15 flex items-center justify-center mb-6">
          <CheckCircle2 className="w-8 h-8 text-[#00C896]" />
        </div>
        <h1 className="text-[24px] font-bold text-white tracking-[-0.02em] mb-3" data-testid="text-success-title">
          {t("resetPassword.successTitle")}
        </h1>
        <p className="text-[15px] text-[#9CA3AF] leading-[1.55] max-w-[320px] mb-8">
          {t("resetPassword.successDesc")}
        </p>
        <button
          onClick={() => navigate("/login")}
          className="h-[50px] px-8 rounded-full text-[15px] font-bold text-white transition-all active:scale-[0.97] shadow-[0_4px_16px_rgba(233,30,99,0.35)]"
          style={{ backgroundColor: BRAND }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = BRAND_HOVER)}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = BRAND)}
          data-testid="button-go-login"
        >
          {t("resetPassword.goToLogin")}
        </button>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-[#1A1A2E] flex flex-col" data-testid="page-reset-password">
      <div className="pt-[max(env(safe-area-inset-top),8px)]" />

      <div className="flex-1 flex flex-col px-7">
        <div className="flex justify-center pt-8 pb-8">
          <HousAlertLogo size={44} showText={true} textClassName="font-bold text-white text-[20px] tracking-[-0.01em]" />
        </div>

        <h1
          className="text-[26px] font-bold text-white leading-[1.15] tracking-[-0.03em] mb-3 text-center"
          data-testid="text-reset-title"
        >
          {t("resetPassword.title")}
        </h1>

        <p className="text-[15px] text-[#9CA3AF] leading-[1.55] text-center max-w-[340px] mx-auto mb-8">
          {t("resetPassword.description")}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-[14px] font-medium text-white mb-2">
              {t("resetPassword.newPassword")}
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <Lock className="w-[18px] h-[18px] text-[#6B7280]" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-[52px] pl-11 pr-12 rounded-2xl border border-[#353560] bg-[#252547] text-[15px] font-medium text-white placeholder:text-[#6B7280] placeholder:font-normal focus:border-[#E91E63] focus:shadow-[0_0_0_3px_rgba(233,30,99,0.1)] outline-none transition-all"
                data-testid="input-new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2"
                data-testid="button-toggle-password"
              >
                {showPassword
                  ? <EyeOff className="w-[18px] h-[18px] text-[#6B7280]" />
                  : <Eye className="w-[18px] h-[18px] text-[#6B7280]" />}
              </button>
            </div>
            {tooShort && (
              <p className="text-[13px] mt-1.5 text-[#E91E63]" data-testid="text-error-short">
                {t("resetPassword.minLength")}
              </p>
            )}
          </div>

          <div>
            <label className="block text-[14px] font-medium text-white mb-2">
              {t("resetPassword.confirmPassword")}
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <Lock className="w-[18px] h-[18px] text-[#6B7280]" />
              </div>
              <input
                type={showConfirm ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className="w-full h-[52px] pl-11 pr-12 rounded-2xl border border-[#353560] bg-[#252547] text-[15px] font-medium text-white placeholder:text-[#6B7280] placeholder:font-normal focus:border-[#E91E63] focus:shadow-[0_0_0_3px_rgba(233,30,99,0.1)] outline-none transition-all"
                data-testid="input-confirm-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-4 top-1/2 -translate-y-1/2"
                data-testid="button-toggle-confirm"
              >
                {showConfirm
                  ? <EyeOff className="w-[18px] h-[18px] text-[#6B7280]" />
                  : <Eye className="w-[18px] h-[18px] text-[#6B7280]" />}
              </button>
            </div>
            {mismatch && (
              <p className="text-[13px] mt-1.5 text-[#E91E63]" data-testid="text-error-mismatch">
                {t("resetPassword.mismatch")}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className={`w-full h-[52px] rounded-full text-[16px] font-bold transition-all active:scale-[0.97] ${
              canSubmit
                ? "text-white shadow-[0_4px_16px_rgba(233,30,99,0.35)]"
                : "text-[#6B7280] bg-[#353560] cursor-not-allowed"
            }`}
            style={canSubmit ? { backgroundColor: BRAND } : undefined}
            onMouseOver={(e) => { if (canSubmit) e.currentTarget.style.backgroundColor = BRAND_HOVER; }}
            onMouseOut={(e) => { if (canSubmit) e.currentTarget.style.backgroundColor = BRAND; }}
            data-testid="button-submit"
          >
            {loading ? t("common.loading") : t("resetPassword.submit")}
          </button>
        </form>
      </div>

      <div className="pb-[max(env(safe-area-inset-bottom),20px)]" />
    </div>
  );
}
