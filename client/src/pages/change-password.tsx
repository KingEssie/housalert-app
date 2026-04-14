import { useState } from "react";
import { useLocation } from "wouter";
import { AppHeader } from "@/components/ui/app-header";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";
import { Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { validatePassword, isPasswordValid } from "@/lib/password-validation";
import { PasswordRules } from "@/components/password-rules";

const INPUT_CLASS =
  "w-full h-[56px] border border-[#D1D5DB] rounded-[8px] bg-white px-4 pr-12 text-[15px] text-[#111111] placeholder:text-[#9CA3AF] outline-none transition-all focus:border-ha-primary";

export default function ChangePasswordPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const v = validatePassword(newPassword);
  const passwordOk = isPasswordValid(v);
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const confirmOk = confirmPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit = passwordOk && confirmOk && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast({ title: t("common.error"), description: error.message, variant: "destructive" });
        return;
      }
      setSuccess(true);
    } catch {
      toast({ title: t("common.error"), description: t("changePassword.errorGeneric"), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#eaeaeb]" data-testid="page-password-success">
        <AppHeader title={t("changePassword.title")} onBack={() => navigate("/dashboard?tab=profiel")} />
        <div className="max-w-xl mx-auto p-4 pb-8">
          <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-6 text-center">
            <div className="flex items-center justify-center mb-5">
              <div className="w-14 h-14 rounded-full bg-[#DCFCE7] flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-[#16A34A]" />
              </div>
            </div>
            <h2 className="text-[20px] font-semibold text-[#111111] mb-2" data-testid="text-success-title">
              {t("changePassword.successTitle")}
            </h2>
            <p className="text-[15px] text-[#6B7280] mb-6">
              {t("changePassword.successDesc")}
            </p>
            <button
              onClick={() => navigate("/dashboard?tab=profiel")}
              className="w-full h-[52px] bg-ha-primary text-white rounded-[8px] font-semibold text-[15px] transition-colors hover:bg-ha-primary-hover"
              data-testid="button-back-to-account"
            >
              {t("changePassword.backToAccount")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#eaeaeb]" data-testid="page-change-password">
      <AppHeader title={t("changePassword.title")} onBack={() => navigate("/dashboard?tab=profiel")} />

      <div className="flex-1 max-w-xl mx-auto w-full px-4 pt-5 pb-8">

        <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-5 flex flex-col gap-5">

          {/* Wachtwoord */}
          <div>
            <label className="block text-[15px] font-semibold text-[#111111] mb-2">
              {t("changePassword.new")}
            </label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t("changePassword.newPlaceholder")}
                className={INPUT_CLASS}
                autoFocus
                data-testid="input-new-password"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
                data-testid="button-toggle-new"
              >
                {showNew
                  ? <EyeOff className="w-[18px] h-[18px]" />
                  : <Eye className="w-[18px] h-[18px]" />}
              </button>
            </div>
            <PasswordRules password={newPassword} />
          </div>

          {/* Wachtwoord bevestigen */}
          <div>
            <label className="block text-[15px] font-semibold text-[#111111] mb-2">
              {t("changePassword.confirmLabel")}
            </label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t("changePassword.confirmPlaceholder")}
                className={INPUT_CLASS}
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
                {t("changePassword.mismatch")}
              </p>
            )}
          </div>

        </div>
      </div>

      {/* Sticky CTA */}
      <div
        className="sticky bottom-0 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 px-5"
        style={{ background: "linear-gradient(to top, #eaeaeb, #eaeaeb 80%, transparent)" }}
      >
        <div className="max-w-xl mx-auto">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`w-full h-[52px] rounded-[8px] font-semibold text-[15px] transition-all flex items-center justify-center ${
              canSubmit
                ? "bg-ha-primary text-white hover:bg-ha-primary-hover"
                : "bg-ha-primary/30 text-white cursor-not-allowed"
            }`}
            data-testid="button-submit-password"
          >
            {submitting ? t("changePassword.changing") : t("changePassword.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
