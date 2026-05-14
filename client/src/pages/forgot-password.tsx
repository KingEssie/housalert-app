import { useState } from "react";
import { useLocation } from "wouter";
import { logoSrc } from "@/components/housalert-logo";
import { useTranslation } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

const OUTER_BG = "#223546";
const CARD_BG = "#1a2b38";
const ACCENT = "#85fb8c";

export default function ForgotPasswordPage() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
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

    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });

    setLoading(false);

    if (error) {
      console.error("[forgot-password] resetPasswordForEmail error:", error.message);
      toast({
        title: t("forgotPassword.error"),
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div
        className="h-[100dvh] flex flex-col items-center justify-center px-5"
        style={{ backgroundColor: OUTER_BG }}
        data-testid="page-forgot-password-sent"
      >
        <div
          className="w-full max-w-[420px] rounded-[12px] px-7 py-10 flex flex-col items-center text-center"
          style={{ backgroundColor: CARD_BG }}
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
            style={{ backgroundColor: `${ACCENT}22` }}
          >
            <CheckCircle2 className="w-8 h-8" style={{ color: ACCENT }} />
          </div>
          <h1
            className="font-bold tracking-[-0.02em] mb-3 text-white"
            style={{ fontSize: "26px", lineHeight: "1.15" }}
            data-testid="text-sent-title"
          >
            {t("forgotPassword.sentTitle")}
          </h1>
          <p
            className="leading-[1.55] mb-8"
            style={{ fontSize: "15px", color: "rgba(255,255,255,0.7)", maxWidth: "300px" }}
            data-testid="text-sent-desc"
          >
            {t("forgotPassword.sentDesc")}
          </p>
          <button
            onClick={() => navigate("/")}
            className="w-full flex items-center justify-center gap-2 font-bold transition-all active:scale-[0.97]"
            style={{
              height: "56px",
              borderRadius: "4px",
              backgroundColor: ACCENT,
              color: "#000000",
              fontSize: "16px",
              border: "none",
              cursor: "pointer",
            }}
            data-testid="button-back-to-login"
          >
            {t("forgotPassword.backToLogin")}
            <ArrowRight className="w-[17px] h-[17px]" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-[100dvh] flex flex-col items-center justify-center px-5"
      style={{ backgroundColor: OUTER_BG }}
      data-testid="page-forgot-password"
    >
      <div
        className="w-full max-w-[420px] rounded-[12px] px-7 py-8"
        style={{ backgroundColor: CARD_BG }}
      >
        {/* Logo */}
        <div className="mb-8">
          <img
            src={logoSrc}
            alt="HousAlert"
            className="object-contain block"
            style={{ height: 32, width: "auto", filter: "brightness(0) invert(1)" }}
          />
        </div>

        {/* Heading */}
        <h1
          className="font-bold text-white tracking-[-0.025em] mb-3"
          style={{ fontSize: "30px", lineHeight: "1.1" }}
          data-testid="text-forgot-title"
        >
          {t("forgotPassword.title")}
        </h1>

        {/* Description */}
        <p
          className="mb-7 leading-[1.5]"
          style={{ fontSize: "15px", color: "rgba(255,255,255,0.65)" }}
          data-testid="text-forgot-desc"
        >
          {t("forgotPassword.description")}
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-[7px]">
            <label
              className="font-semibold text-white"
              style={{ fontSize: "13px" }}
              htmlFor="forgot-email"
            >
              {t("forgotPassword.emailLabel")}
            </label>
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("forgotPassword.emailPlaceholder")}
              required
              className="w-full outline-none"
              style={{
                height: "58px",
                borderRadius: "4px",
                background: "#FFFFFF",
                border: "1.5px solid rgba(0,0,0,0.08)",
                padding: "0 16px",
                fontSize: "16px",
                color: "#111111",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = ACCENT; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(0,0,0,0.08)"; }}
              data-testid="input-email"
            />
          </div>

          {/* Primary CTA */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 font-bold transition-all active:scale-[0.97]"
            style={{
              height: "58px",
              borderRadius: "4px",
              backgroundColor: ACCENT,
              color: "#000000",
              fontSize: "17px",
              border: "none",
              cursor: "pointer",
              letterSpacing: "-0.01em",
            }}
            data-testid="button-submit"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                {t("forgotPassword.submit")}
                <ArrowRight className="w-[17px] h-[17px]" strokeWidth={2.5} />
              </>
            )}
          </button>
        </form>

        {/* Back to login */}
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex items-center gap-2 mt-5 bg-transparent border-0 cursor-pointer hover:underline"
          style={{ fontSize: "14px", fontWeight: 600, color: "#FFFFFF" }}
          data-testid="button-back-to-login"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2.5} />
          {t("forgotPassword.backToLogin")}
        </button>
      </div>
    </div>
  );
}
