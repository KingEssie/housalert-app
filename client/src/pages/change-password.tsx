import { useState } from "react";
import { useLocation } from "wouter";
import { AppHeader } from "@/components/ui/app-header";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";
import { Eye, EyeOff, Lock, CheckCircle2 } from "lucide-react";

export default function ChangePasswordPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const newTooShort = newPassword.length > 0 && newPassword.length < 8;
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    newPassword === confirmPassword &&
    !submitting;

  const handleSubmit = async () => {
    if (!user?.email || !canSubmit) return;
    setSubmitting(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        toast({
          title: t("changePassword.wrongPassword"),
          description: t("changePassword.wrongPasswordDesc"),
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        toast({
          title: t("common.error"),
          description: updateError.message,
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      setSuccess(true);
    } catch {
      toast({
        title: t("common.error"),
        description: t("changePassword.errorGeneric"),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "#F5F6F8" }} data-testid="page-password-success">
        <AppHeader title={t("changePassword.title")} onBack={() => navigate("/dashboard?tab=profiel")} />
        <div className="max-w-xl mx-auto p-4 pb-8">
          <div className="app-card text-center">
            <div className="flex items-center justify-center mb-5">
              <div className="w-14 h-14 rounded-full bg-ha-success/10 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-[#111111]" />
              </div>
            </div>
            <h2 className="text-[20px] font-semibold text-[#111111] mb-2" data-testid="text-success-title">
              {t("changePassword.successTitle")}
            </h2>
            <p className="text-[15px] text-[#334855] mb-6">
              {t("changePassword.successDesc")}
            </p>
            <button
              onClick={() => navigate("/dashboard?tab=profiel")}
              className="w-full h-[48px] bg-ha-primary text-white rounded-[6px] font-semibold text-[15px] transition-colors hover:bg-ha-primary-hover"
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
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#F5F6F8" }} data-testid="page-change-password">
      <AppHeader title={t("changePassword.title")} onBack={() => navigate("/dashboard?tab=profiel")} />

      <div className="flex-1 max-w-xl mx-auto w-full p-4 pb-8">
        <div className="app-card space-y-5">
          <div>
            <label className="text-field-label mb-2 block">{t("changePassword.current")}</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <Lock className="w-[18px] h-[18px] text-ha-icon-secondary" />
              </div>
              <input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t("changePassword.currentPlaceholder")}
                className="app-input !pl-11 !pr-12"
                data-testid="input-current-password"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-4 top-1/2 -translate-y-1/2"
                data-testid="button-toggle-current"
              >
                {showCurrent ? <EyeOff className="w-[18px] h-[18px] text-ha-icon-secondary" /> : <Eye className="w-[18px] h-[18px] text-ha-icon-secondary" />}
              </button>
            </div>
          </div>

          <div className="h-px bg-[#E5E7EB]" />

          <div>
            <label className="text-field-label mb-2 block">{t("changePassword.new")}</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <Lock className="w-[18px] h-[18px] text-ha-icon-secondary" />
              </div>
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t("changePassword.newPlaceholder")}
                className="app-input !pl-11 !pr-12"
                data-testid="input-new-password"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-4 top-1/2 -translate-y-1/2"
                data-testid="button-toggle-new"
              >
                {showNew ? <EyeOff className="w-[18px] h-[18px] text-ha-icon-secondary" /> : <Eye className="w-[18px] h-[18px] text-ha-icon-secondary" />}
              </button>
            </div>
            {newTooShort && (
              <p className="text-[13px] mt-1.5 text-[#111111]" data-testid="text-error-min-length">
                {t("changePassword.minLength")}
              </p>
            )}
          </div>

          <div>
            <label className="text-field-label mb-2 block">{t("changePassword.confirmLabel")}</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <Lock className="w-[18px] h-[18px] text-ha-icon-secondary" />
              </div>
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t("changePassword.confirmPlaceholder")}
                className="app-input !pl-11 !pr-12"
                data-testid="input-confirm-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-4 top-1/2 -translate-y-1/2"
                data-testid="button-toggle-confirm"
              >
                {showConfirm ? <EyeOff className="w-[18px] h-[18px] text-ha-icon-secondary" /> : <Eye className="w-[18px] h-[18px] text-ha-icon-secondary" />}
              </button>
            </div>
            {mismatch && (
              <p className="text-[13px] mt-1.5 text-[#111111]" data-testid="text-error-mismatch">
                {t("changePassword.mismatch")}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 px-5" style={{ background: "linear-gradient(to top, #F5F6F8, #F5F6F8 80%, transparent)" }}>
        <div className="max-w-xl mx-auto">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`w-full h-[48px] rounded-[6px] font-semibold text-[15px] transition-colors flex items-center justify-center ${
              canSubmit
                ? "bg-ha-primary hover:bg-ha-primary-hover text-white"
                : "bg-[#E5E7EB] text-ha-icon-secondary cursor-not-allowed"
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
