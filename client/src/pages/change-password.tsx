import { useState } from "react";
import { useLocation } from "wouter";
import { PageHeader } from "@/components/ui/page-header";
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
      <div className="min-h-screen bg-background" data-testid="page-password-success">
        <PageHeader title={t("changePassword.title")} onBack={() => navigate("/settings")} />
        <div className="max-w-xl mx-auto p-4 pb-8">
          <div className="bg-card rounded-[6px] border p-6 text-center" style={{ borderColor: "rgb(var(--ha-card-border))" }}>
            <div className="flex items-center justify-center mb-5">
              <div className="w-14 h-14 rounded-[6px] flex items-center justify-center" style={{ backgroundColor: "rgb(var(--ha-surface))" }}>
                <CheckCircle2 className="w-7 h-7" style={{ color: "rgb(var(--ha-success))" }} />
              </div>
            </div>
            <h2 className="text-[20px] font-medium mb-2" style={{ color: "rgb(var(--ha-text))" }} data-testid="text-success-title">
              {t("changePassword.successTitle")}
            </h2>
            <p className="text-[15px] mb-6" style={{ color: "rgb(var(--ha-text-secondary))" }}>
              {t("changePassword.successDesc")}
            </p>
            <button
              onClick={() => navigate("/settings")}
              className="w-full h-[48px] bg-primary text-primary-foreground rounded-full font-medium text-[15px] transition-colors"
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
    <div className="min-h-screen bg-background flex flex-col" data-testid="page-change-password">
      <PageHeader title={t("changePassword.title")} onBack={() => navigate("/settings")} />

      <div className="flex-1 max-w-xl mx-auto w-full p-4 pb-8">
        <div className="bg-card rounded-[6px] border p-5 space-y-5" style={{ borderColor: "rgb(var(--ha-card-border))" }}>
          <div>
            <label className="block text-[14px] font-medium mb-2" style={{ color: "rgb(var(--ha-text))" }}>{t("changePassword.current")}</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <Lock className="w-[18px] h-[18px] text-muted-foreground" />
              </div>
              <input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t("changePassword.currentPlaceholder")}
                className="w-full h-[52px] pl-11 pr-12 rounded-[6px] border border-transparent bg-ha-surface text-[16px] font-medium text-ha-text placeholder:text-ha-text-secondary placeholder:font-normal"
                data-testid="input-current-password"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-4 top-1/2 -translate-y-1/2"
                data-testid="button-toggle-current"
              >
                {showCurrent ? <EyeOff className="w-[18px] h-[18px] text-muted-foreground" /> : <Eye className="w-[18px] h-[18px] text-muted-foreground" />}
              </button>
            </div>
          </div>

          <div className="h-px" style={{ backgroundColor: "rgb(var(--ha-card-border))" }} />

          <div>
            <label className="block text-[14px] font-medium mb-2" style={{ color: "rgb(var(--ha-text))" }}>{t("changePassword.new")}</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <Lock className="w-[18px] h-[18px] text-muted-foreground" />
              </div>
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t("changePassword.newPlaceholder")}
                className="w-full h-[52px] pl-11 pr-12 rounded-[6px] border border-transparent bg-ha-surface text-[16px] font-medium text-ha-text placeholder:text-ha-text-secondary placeholder:font-normal"
                data-testid="input-new-password"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-4 top-1/2 -translate-y-1/2"
                data-testid="button-toggle-new"
              >
                {showNew ? <EyeOff className="w-[18px] h-[18px] text-muted-foreground" /> : <Eye className="w-[18px] h-[18px] text-muted-foreground" />}
              </button>
            </div>
            {newTooShort && (
              <p className="text-[13px] mt-1.5" style={{ color: "rgb(var(--ha-primary))" }} data-testid="text-error-min-length">
                {t("changePassword.minLength")}
              </p>
            )}
          </div>

          <div>
            <label className="block text-[14px] font-medium mb-2" style={{ color: "rgb(var(--ha-text))" }}>{t("changePassword.confirmLabel")}</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <Lock className="w-[18px] h-[18px] text-muted-foreground" />
              </div>
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t("changePassword.confirmPlaceholder")}
                className="w-full h-[52px] pl-11 pr-12 rounded-[6px] border border-transparent bg-ha-surface text-[16px] font-medium text-ha-text placeholder:text-ha-text-secondary placeholder:font-normal"
                data-testid="input-confirm-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-4 top-1/2 -translate-y-1/2"
                data-testid="button-toggle-confirm"
              >
                {showConfirm ? <EyeOff className="w-[18px] h-[18px] text-muted-foreground" /> : <Eye className="w-[18px] h-[18px] text-muted-foreground" />}
              </button>
            </div>
            {mismatch && (
              <p className="text-[13px] mt-1.5" style={{ color: "rgb(var(--ha-primary))" }} data-testid="text-error-mismatch">
                {t("changePassword.mismatch")}
              </p>
            )}
          </div>
        </div>

      </div>

      <div className="sticky bottom-0 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 px-5 bg-gradient-to-t from-white via-white to-white/0">
        <div className="max-w-xl mx-auto">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`w-full h-[52px] rounded-[6px] font-medium text-[16px] transition-colors flex items-center justify-center ${
              canSubmit
                ? "bg-ha-primary hover:bg-ha-primary-hover text-white"
                : "bg-ha-card-border text-ha-text-secondary cursor-not-allowed"
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
