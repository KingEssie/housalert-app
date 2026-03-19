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

  const returnTo = (() => {
    const fromSearch = new URLSearchParams(window.location.search).get("returnTo");
    if (fromSearch) return fromSearch;
    const hash = window.location.hash;
    const qIdx = hash.indexOf("?");
    if (qIdx >= 0) {
      return new URLSearchParams(hash.substring(qIdx)).get("returnTo");
    }
    return null;
  })();

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
    navigate(returnTo || "/dashboard");
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
            <span className="font-medium text-[#18181B] text-lg tracking-tight">{t("auth.appName")}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-[28px] font-medium text-[#18181B] tracking-[-0.03em] leading-[1.1] mb-3" data-testid="text-login-title">
              {t("auth.login.title")}
            </h1>
            <p className="text-[15px] text-[#1F2937]">
              {t("auth.login.subtitle")}
            </p>
          </div>

          <div className="bg-white rounded-[24px] border border-[#F0F0F0] shadow-[0_2px_8px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)] p-6">
            <form onSubmit={handleLogin} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="login-email" className="text-[14px] font-medium text-[#18181B]">{t("auth.login.email")}</Label>
                <input
                  id="login-email"
                  type="email"
                  placeholder={t("auth.login.emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-[48px] px-4 rounded-xl border border-transparent bg-[#F3F4F6] text-[15px] font-medium text-[#1F2937] placeholder:text-[#9CA3AF] placeholder:font-normal focus:bg-white"
                  data-testid="input-login-email"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="login-password" className="text-[14px] font-medium text-[#18181B]">{t("auth.login.password")}</Label>
                <input
                  id="login-password"
                  type="password"
                  placeholder={t("auth.login.passwordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-[48px] px-4 rounded-xl border border-transparent bg-[#F3F4F6] text-[15px] font-medium text-[#1F2937] placeholder:text-[#9CA3AF] placeholder:font-normal focus:bg-white"
                  data-testid="input-login-password"
                />
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resetLoading}
                  className="self-end text-[13px] font-medium text-[#0D6EFD] hover:underline mt-1"
                  data-testid="link-forgot-password"
                >
                  {resetLoading ? t("common.loading") : t("auth.login.forgotPassword")}
                </button>
              </div>
              <Button
                type="submit"
                className="w-full h-[56px] rounded-full text-[16px] font-medium bg-[#0D6EFD] text-white"
                disabled={loading}
                data-testid="button-login-submit"
              >
                {loading ? t("common.loading") : t("auth.login.submit")}
              </Button>
            </form>
          </div>

          <div className="text-center mt-6">
            <p className="text-[15px] text-[#1F2937]">
              {t("auth.login.noAccount")}{" "}
              <button
                onClick={() => navigate("/onboarding/location")}
                className="text-[#0D6EFD] font-medium hover:underline"
                data-testid="link-signup"
              >
                {t("auth.login.createAccount")}
              </button>
            </p>
          </div>

          <p className="text-center text-[13px] text-[#1F2937] mt-6">
            {t("auth.login.footer")}
          </p>
        </div>
      </main>
    </div>
  );
}
