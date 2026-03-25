import { useState } from "react";
import { useLocation } from "wouter";
import { HousAlertLogo } from "@/components/housalert-logo";
import { useTranslation } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Mail, CheckCircle2 } from "lucide-react";

const BRAND = "rgb(var(--ha-primary))";
const BRAND_HOVER = "rgb(var(--ha-primary-hover))";

export default function ForgotPasswordPage() {
  const [, navigate] = useLocation();
  const { t, locale } = useTranslation();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!email.trim()) {
      toast({
        title: t("forgotPassword.error"),
        description: t("forgotPassword.enterEmail"),
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const resp = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), lang: locale }),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || "Request failed");
      }
    } catch (err: any) {
      setLoading(false);
      toast({
        title: t("forgotPassword.error"),
        description: err.message,
        variant: "destructive",
      });
      return;
    }

    setLoading(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="h-[100dvh] bg-ha-bg flex flex-col" data-testid="page-forgot-password-sent">
        <div className="pt-[max(env(safe-area-inset-top),8px)] px-5">
          <button
            onClick={() => navigate("/welcome")}
            className="mt-3 w-10 h-10 rounded-full flex items-center justify-center hover:bg-ha-card transition-colors"
            data-testid="button-back"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-ha-text" />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <div className="w-16 h-16 rounded-full bg-ha-success-light flex items-center justify-center mb-6">
            <CheckCircle2 className="w-8 h-8 text-ha-success" />
          </div>
          <h1
            className="text-[24px] font-bold text-ha-text tracking-[-0.02em] mb-3"
            data-testid="text-sent-title"
          >
            {t("forgotPassword.sentTitle")}
          </h1>
          <p className="text-[15px] text-ha-text-secondary leading-[1.55] max-w-[320px] mb-8" data-testid="text-sent-desc">
            {t("forgotPassword.sentDesc")}
          </p>
          <button
            onClick={() => navigate("/login")}
            className="h-[50px] px-8 rounded-full text-[15px] font-bold text-ha-text transition-all active:scale-[0.97] shadow-[0_4px_16px_rgba(233,30,99,0.35)]"
            style={{ backgroundColor: BRAND }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = BRAND_HOVER)}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = BRAND)}
            data-testid="button-back-to-login"
          >
            {t("forgotPassword.backToLogin")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-ha-bg flex flex-col" data-testid="page-forgot-password">
      <div className="pt-[max(env(safe-area-inset-top),8px)] px-5">
        <button
          onClick={() => navigate("/welcome")}
          className="mt-3 w-10 h-10 rounded-full flex items-center justify-center hover:bg-ha-card transition-colors"
          data-testid="button-back"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5 text-ha-text" />
        </button>
      </div>

      <div className="flex-1 flex flex-col px-7">
        <div className="flex justify-center pt-8 pb-8">
          <HousAlertLogo size={44} showText={true} textClassName="font-bold text-ha-text text-[20px] tracking-[-0.01em]" />
        </div>

        <h1
          className="text-[26px] font-bold text-ha-text leading-[1.15] tracking-[-0.03em] mb-3 text-center"
          data-testid="text-forgot-title"
        >
          {t("forgotPassword.title")}
        </h1>

        <p className="text-[15px] text-ha-text-secondary leading-[1.55] text-center max-w-[340px] mx-auto mb-8" data-testid="text-forgot-desc">
          {t("forgotPassword.description")}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <Mail className="w-[18px] h-[18px] text-ha-text-muted" />
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("forgotPassword.emailPlaceholder")}
              required
              className="w-full h-[52px] pl-11 pr-4 rounded-2xl border border-ha-card-border bg-ha-card text-[15px] font-medium text-ha-text placeholder:text-ha-text-muted placeholder:font-normal focus:border-ha-primary focus:shadow-[0_0_0_3px_rgba(233,30,99,0.1)] outline-none transition-all"
              data-testid="input-email"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-[52px] rounded-full text-[16px] font-bold text-ha-text transition-all active:scale-[0.97] shadow-[0_4px_16px_rgba(233,30,99,0.35)] disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ backgroundColor: loading ? "#555" : BRAND }}
            onMouseOver={(e) => { if (!loading) e.currentTarget.style.backgroundColor = BRAND_HOVER; }}
            onMouseOut={(e) => { if (!loading) e.currentTarget.style.backgroundColor = BRAND; }}
            data-testid="button-submit"
          >
            {loading ? t("common.loading") : t("forgotPassword.submit")}
          </button>
        </form>
      </div>

      <div className="pb-[max(env(safe-area-inset-bottom),20px)]" />
    </div>
  );
}
