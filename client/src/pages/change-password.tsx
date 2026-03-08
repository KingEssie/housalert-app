import { useState } from "react";
import { useLocation } from "wouter";
import { PageHeader } from "@/components/ui/page-header";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock, CheckCircle2 } from "lucide-react";

export default function ChangePasswordPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

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
          title: "Onjuist wachtwoord",
          description: "Het huidige wachtwoord is niet correct.",
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
          title: "Fout",
          description: updateError.message,
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      setSuccess(true);
    } catch {
      toast({
        title: "Fout",
        description: "Er is iets misgegaan. Probeer het opnieuw.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background" data-testid="page-password-success">
        <PageHeader title="Wachtwoord wijzigen" onBack={() => navigate("/dashboard?tab=profiel")} />
        <div className="max-w-xl mx-auto p-4 pb-8">
          <div className="bg-card rounded-[18px] border p-6 text-center" style={{ borderColor: "var(--yo-divider)" }}>
            <div className="flex items-center justify-center mb-5">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "var(--yo-teal-light)" }}>
                <CheckCircle2 className="w-7 h-7" style={{ color: "var(--yo-success)" }} />
              </div>
            </div>
            <h2 className="text-[20px] font-bold mb-2" style={{ color: "var(--yo-dark)" }} data-testid="text-success-title">
              Wachtwoord succesvol gewijzigd
            </h2>
            <p className="text-[15px] mb-6" style={{ color: "var(--yo-muted)" }}>
              Je kunt nu inloggen met je nieuwe wachtwoord.
            </p>
            <button
              onClick={() => navigate("/dashboard?tab=profiel")}
              className="w-full h-[48px] bg-primary text-primary-foreground rounded-[14px] font-semibold text-[15px] transition-colors"
              data-testid="button-back-to-account"
            >
              Terug naar account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="page-change-password">
      <PageHeader title="Wachtwoord wijzigen" onBack={() => navigate("/dashboard?tab=profiel")} />

      <div className="max-w-xl mx-auto p-4 pb-8">
        <div className="bg-card rounded-[18px] border p-5 space-y-5" style={{ borderColor: "var(--yo-divider)" }}>
          <div>
            <label className="block text-[14px] font-medium mb-2" style={{ color: "var(--yo-dark)" }}>Huidig wachtwoord</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <Lock className="w-[18px] h-[18px] text-muted-foreground" />
              </div>
              <input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Voer je huidige wachtwoord in"
                className="w-full h-[52px] pl-11 pr-12 rounded-[14px] border-0 bg-muted text-[16px] font-medium text-foreground placeholder:text-muted-foreground placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-primary/15 focus:bg-background transition-all"
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

          <div className="h-px" style={{ backgroundColor: "var(--yo-divider)" }} />

          <div>
            <label className="block text-[14px] font-medium mb-2" style={{ color: "var(--yo-dark)" }}>Nieuw wachtwoord</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <Lock className="w-[18px] h-[18px] text-muted-foreground" />
              </div>
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimaal 8 tekens"
                className="w-full h-[52px] pl-11 pr-12 rounded-[14px] border-0 bg-muted text-[16px] font-medium text-foreground placeholder:text-muted-foreground placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-primary/15 focus:bg-background transition-all"
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
              <p className="text-[13px] mt-1.5" style={{ color: "var(--yo-teal)" }} data-testid="text-error-min-length">
                Wachtwoord moet minimaal 8 tekens bevatten
              </p>
            )}
          </div>

          <div>
            <label className="block text-[14px] font-medium mb-2" style={{ color: "var(--yo-dark)" }}>Nieuw wachtwoord bevestigen</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <Lock className="w-[18px] h-[18px] text-muted-foreground" />
              </div>
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Herhaal nieuw wachtwoord"
                className="w-full h-[52px] pl-11 pr-12 rounded-[14px] border-0 bg-muted text-[16px] font-medium text-foreground placeholder:text-muted-foreground placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-primary/15 focus:bg-background transition-all"
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
              <p className="text-[13px] mt-1.5" style={{ color: "var(--yo-teal)" }} data-testid="text-error-mismatch">
                Wachtwoorden komen niet overeen
              </p>
            )}
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`w-full h-[48px] rounded-[14px] font-semibold text-[15px] mt-5 transition-colors ${
            canSubmit
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          }`}
          data-testid="button-submit-password"
        >
          {submitting ? "Wijzigen..." : "Wachtwoord wijzigen"}
        </button>
      </div>
    </div>
  );
}
