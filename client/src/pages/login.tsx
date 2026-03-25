import { useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { ensureTrialForCurrentUser } from "@/lib/auth";
import { clearAllUserData } from "@/lib/queryClient";
import { apiFetch } from "@/lib/api-base";
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
    console.log(`[IDENTITY] Login attempt — email="${email}"`);
    clearAllUserData();
    const { data: signInData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setLoading(false);
      toast({ title: t("auth.login.failed"), description: error.message, variant: "destructive" });
      return;
    }

    console.log(`[IDENTITY] Login success — user.id=${signInData?.user?.id?.substring(0, 8) ?? "null"}, email=${signInData?.user?.email ?? "unknown"}`);
    await ensureTrialForCurrentUser();

    if (returnTo) {
      console.log(`[IDENTITY] Login redirect → returnTo="${returnTo}"`);
      setLoading(false);
      navigate(returnTo);
      return;
    }

    try {
      const token = signInData.session?.access_token;
      if (token) {
        const res = await apiFetch("/api/onboarding-status", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        const completed = data.onboarding_completed === true;
        console.log(`[IDENTITY] Login onboarding check — completed=${completed}`);
        if (!completed) {
          setLoading(false);
          navigate("/onboarding/setup");
          return;
        }
      }
    } catch (err) {
      console.log("[IDENTITY] Login onboarding check failed, defaulting to dashboard", err);
    }

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
    <div className="min-h-screen bg-ha-bg flex flex-col">
      <header className="w-full bg-ha-bg sticky top-0 z-20 border-b border-ha-card-border">
        <div className="max-w-5xl mx-auto px-6 h-[60px] flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-ha-primary flex items-center justify-center">
              <Home className="w-4 h-4 text-white" />
            </div>
            <span className="font-medium text-ha-text text-lg tracking-tight">{t("auth.appName")}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-[28px] font-medium text-ha-text tracking-[-0.03em] leading-[1.1] mb-3" data-testid="text-login-title">
              {t("auth.login.title")}
            </h1>
            <p className="text-[15px] text-ha-text-secondary">
              {t("auth.login.subtitle")}
            </p>
          </div>

          <div className="bg-ha-card rounded-[24px] border border-ha-card-border p-6">
            <form onSubmit={handleLogin} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="login-email" className="text-[14px] font-medium text-ha-text">{t("auth.login.email")}</Label>
                <input
                  id="login-email"
                  type="email"
                  placeholder={t("auth.login.emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-[48px] px-4 rounded-xl border border-ha-card-border bg-ha-bg text-[15px] font-medium text-ha-text placeholder:text-ha-text-muted placeholder:font-normal focus:border-ha-primary focus:shadow-[0_0_0_3px_rgba(233,30,99,0.08)] outline-none transition-all"
                  data-testid="input-login-email"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="login-password" className="text-[14px] font-medium text-ha-text">{t("auth.login.password")}</Label>
                <input
                  id="login-password"
                  type="password"
                  placeholder={t("auth.login.passwordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-[48px] px-4 rounded-xl border border-ha-card-border bg-ha-bg text-[15px] font-medium text-ha-text placeholder:text-ha-text-muted placeholder:font-normal focus:border-ha-primary focus:shadow-[0_0_0_3px_rgba(233,30,99,0.08)] outline-none transition-all"
                  data-testid="input-login-password"
                />
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resetLoading}
                  className="self-end text-[13px] font-medium text-ha-primary hover:underline mt-1"
                  data-testid="link-forgot-password"
                >
                  {resetLoading ? t("common.loading") : t("auth.login.forgotPassword")}
                </button>
              </div>
              <Button
                type="submit"
                className="w-full h-[56px] rounded-full text-[16px] font-medium bg-ha-primary hover:bg-ha-primary-hover text-white"
                disabled={loading}
                data-testid="button-login-submit"
              >
                {loading ? t("common.loading") : t("auth.login.submit")}
              </Button>
            </form>
          </div>

          <div className="text-center mt-6">
            <p className="text-[15px] text-ha-text-secondary">
              {t("auth.login.noAccount")}{" "}
              <button
                onClick={() => navigate("/onboarding/location")}
                className="text-ha-primary font-medium hover:underline"
                data-testid="link-signup"
              >
                {t("auth.login.createAccount")}
              </button>
            </p>
          </div>

          <p className="text-center text-[13px] text-ha-text-muted mt-6">
            {t("auth.login.footer")}
          </p>
        </div>
      </main>
    </div>
  );
}
