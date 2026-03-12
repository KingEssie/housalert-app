import { useState } from "react";
import { useHashSearch } from "@/lib/hash-search";
import { useLocation } from "wouter";
import { Home, ChevronLeft, User, Mail, Lock, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { ensureTrialForCurrentUser } from "@/lib/auth";
import { useTranslation } from "@/i18n";

export default function SignupPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();
  const searchString = useHashSearch();
  const params = new URLSearchParams(searchString);

  const city = params.get("city") || "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailConfirmationPending, setEmailConfirmationPending] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        toast({ title: t("auth.signup.failed"), description: error.message, variant: "destructive" });
        setLoading(false);
        return;
      }

      if (!data.user) {
        toast({ title: t("auth.signup.failed"), description: t("common.error"), variant: "destructive" });
        setLoading(false);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const hasSession = !!sessionData?.session?.access_token;

      if (hasSession) {
        const trialOk = await ensureTrialForCurrentUser();
        if (!trialOk) {
          console.error("[signup] Trial creation failed after signup — continuing to onboarding anyway");
        }
        navigate("/onboarding");
      } else {
        setEmailConfirmationPending(true);
      }
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    window.history.back();
  }

  if (emailConfirmationPending) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <header className="w-full bg-white sticky top-0 z-20 border-b border-[#E5E7EB]">
          <div className="max-w-xl mx-auto px-6 h-[60px] flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-2xl bg-[#111C3D] flex items-center justify-center">
                <Home className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-extrabold text-[#111C3D] text-base">{t("auth.appName")}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-[72px] h-[72px] rounded-2xl bg-[#EBF2FF] flex items-center justify-center mb-8">
            <MailCheck className="w-8 h-8 text-[#0D6EFD]" />
          </div>

          <h1
            className="text-[28px] font-[800] text-[#111C3D] tracking-[-0.03em] leading-[1.1] mb-4 max-w-[320px]"
            data-testid="text-email-confirm-title"
          >
            {t("auth.signup.confirmTitle")}
          </h1>

          <p
            className="text-[16px] leading-relaxed text-[#1F2937] mb-3 max-w-[340px]"
            data-testid="text-email-confirm-description"
          >
            {t("auth.signup.confirmText")}
          </p>

          <p
            className="text-[16px] font-semibold text-[#111C3D] mb-8"
            data-testid="text-email-confirm-address"
          >
            {email}
          </p>

          <p className="text-[15px] text-[#1F2937] mb-10 max-w-[340px] leading-relaxed">
            {t("auth.signup.confirmInstructions")}
          </p>

          <button
            onClick={() => navigate("/login")}
            className="w-full max-w-[320px] min-h-[56px] rounded-full bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white font-bold text-[16px] transition-colors shadow-[0_2px_12px_rgba(0,0,0,0.25)]"
            data-testid="button-go-login-after-confirm"
          >
            {t("auth.signup.toLogin")}
          </button>

          <p className="text-[13px] text-[#1F2937] mt-6 max-w-[300px]">
            {t("auth.signup.noEmail")}
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="w-full bg-white sticky top-0 z-20 border-b border-[#E5E7EB]">
        <div className="max-w-xl mx-auto px-6 h-[60px] flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-[#F5F7FA] transition-colors"
            data-testid="button-back-estimate"
          >
            <ChevronLeft className="w-5 h-5 text-[#1F2937]" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-2xl bg-[#111C3D] flex items-center justify-center">
              <Home className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-extrabold text-[#111C3D] text-base">{t("auth.appName")}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-xl mx-auto w-full px-6 pt-12 pb-16">
        <div className="text-center mb-10">
          <h1 className="text-[32px] font-[800] text-[#111C3D] tracking-[-0.03em] leading-[1.1] mb-4" data-testid="text-signup-title">
            {t("auth.signup.title")}
          </h1>
          <p className="text-[15px] text-[#1F2937]">
            {city ? t("auth.signup.subtitleCity", { city }) : t("auth.signup.subtitle")}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6">
          <form onSubmit={handleSignup} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-[14px] font-semibold text-[#111C3D]">{t("auth.signup.name")}</Label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#1F2937]" />
                <input
                  type="text"
                  placeholder={t("auth.signup.namePlaceholder")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-[60px] pl-11 pr-4 rounded-[20px] border-0 bg-[#F3F4F6] text-[15px] font-medium text-[#1F2937] placeholder:text-[#9CA3AF] placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/15 focus:bg-white transition-all"
                  data-testid="input-signup-name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[14px] font-semibold text-[#111C3D]">{t("auth.signup.email")}</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#1F2937]" />
                <input
                  type="email"
                  placeholder={t("auth.signup.emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full h-[60px] pl-11 pr-4 rounded-[20px] border-0 bg-[#F3F4F6] text-[15px] font-medium text-[#1F2937] placeholder:text-[#9CA3AF] placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/15 focus:bg-white transition-all"
                  data-testid="input-signup-email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[14px] font-semibold text-[#111C3D]">{t("auth.signup.password")}</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#1F2937]" />
                <input
                  type="password"
                  placeholder={t("auth.signup.passwordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full h-[60px] pl-11 pr-4 rounded-[20px] border-0 bg-[#F3F4F6] text-[15px] font-medium text-[#1F2937] placeholder:text-[#9CA3AF] placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/15 focus:bg-white transition-all"
                  data-testid="input-signup-password"
                />
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full h-[56px] rounded-full text-[16px] font-bold shadow-none bg-[#0D6EFD] mt-1"
              disabled={loading || !email || !password}
              data-testid="button-signup-submit"
            >
              {loading ? t("auth.signup.submitAlt") : t("auth.signup.submit")}
            </Button>
          </form>
        </div>

        <p className="text-center text-[15px] text-[#1F2937] mt-6">
          {t("auth.signup.hasAccount")}{" "}
          <button
            onClick={() => navigate("/login")}
            className="text-[#0D6EFD] font-semibold hover:underline"
            data-testid="link-login"
          >
            {t("auth.signup.loginLink")}
          </button>
        </p>

        <p className="text-center text-[13px] text-[#1F2937] mt-4">
          {t("auth.signup.footer")}
        </p>
      </main>
    </div>
  );
}
