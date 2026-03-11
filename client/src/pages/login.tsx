import { useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { ensureTrialForCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Home } from "lucide-react";
import { useTranslation } from "@/i18n";

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setLoading(false);
      toast({ title: t("auth.login.failed"), description: error.message, variant: "destructive" });
      return;
    }

    await ensureTrialForCurrentUser();
    setLoading(false);
    navigate("/dashboard");
  }

  async function handleForgotPassword() {
    if (!email) {
      toast({ title: t("auth.login.emailRequired"), description: t("auth.login.enterEmailFirst"), variant: "destructive" });
      return;
    }
    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/account/change-password`,
    });
    setResetLoading(false);
    if (error) {
      toast({ title: t("auth.login.failed"), description: error.message, variant: "destructive" });
    } else {
      toast({ title: t("auth.login.resetSent"), description: t("auth.login.resetSentDesc") });
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="w-full bg-white sticky top-0 z-20 border-b border-[#E5E7EB]">
        <div className="max-w-5xl mx-auto px-6 h-[60px] flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#1F2937] flex items-center justify-center">
              <Home className="w-4 h-4 text-white" />
            </div>
            <span className="font-extrabold text-[#1F2937] text-lg tracking-tight">{t("auth.appName")}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-[28px] font-[800] text-[#1F2937] tracking-[-0.03em] leading-[1.1] mb-3" data-testid="text-login-title">
              {t("auth.login.title")}
            </h1>
            <p className="text-[15px] text-[#1F2937]">
              {t("auth.login.subtitle")}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6">
            <form onSubmit={handleLogin} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="login-email" className="text-[14px] font-semibold text-[#1F2937]">{t("auth.login.email")}</Label>
                <input
                  id="login-email"
                  type="email"
                  placeholder={t("auth.login.emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-[52px] px-4 rounded-lg border-0 bg-[#F5F7FA] text-[15px] font-medium text-[#1F2937] placeholder:text-[#1F2937] placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/15 focus:bg-white transition-all"
                  data-testid="input-login-email"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="login-password" className="text-[14px] font-semibold text-[#1F2937]">{t("auth.login.password")}</Label>
                <input
                  id="login-password"
                  type="password"
                  placeholder={t("auth.login.passwordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-[52px] px-4 rounded-lg border-0 bg-[#F5F7FA] text-[15px] font-medium text-[#1F2937] placeholder:text-[#1F2937] placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/15 focus:bg-white transition-all"
                  data-testid="input-login-password"
                />
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resetLoading}
                  className="self-end text-[13px] font-semibold text-[#0D6EFD] hover:underline mt-1"
                  data-testid="link-forgot-password"
                >
                  {resetLoading ? t("common.loading") : t("auth.login.forgotPassword")}
                </button>
              </div>
              <Button
                type="submit"
                className="w-full h-[56px] rounded-full text-[16px] font-bold bg-[#0D6EFD] text-white"
                disabled={loading}
                data-testid="button-login-submit"
              >
                {loading ? t("common.loading") : t("auth.login.submit")}
              </Button>
            </form>
          </div>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-[#E5E7EB]" />
            <span className="text-[13px] text-[#1F2937]">{t("auth.login.or")}</span>
            <div className="flex-1 h-px bg-[#E5E7EB]" />
          </div>

          <div className="text-center">
            <p className="text-[15px] text-[#1F2937] mb-3">{t("auth.login.noAccount")}</p>
            <Button
              variant="outline"
              className="w-full h-[48px] rounded-lg text-[15px] font-bold border-[#0D6EFD] text-[#1F2937]"
              onClick={() => navigate("/signup")}
              data-testid="link-signup"
            >
              {t("auth.login.createAccount")}
            </Button>
          </div>

          <p className="text-center text-[13px] text-[#1F2937] mt-6">
            {t("auth.login.footer")}
          </p>
        </div>
      </main>
    </div>
  );
}
