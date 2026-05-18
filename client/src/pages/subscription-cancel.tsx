import { useLocation } from "wouter";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/ui/app-header";
import { AlertCircle, CheckCircle2, MessageSquare } from "lucide-react";
import { useTranslation, type Locale } from "@/i18n";
import { apiFetch } from "@/lib/api-base";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/queryClient";

function localeToIntl(locale: Locale): string {
  if (locale === "de") return "de-DE";
  if (locale === "nl") return "nl-NL";
  return "en-GB";
}

function formatDate(dateStr: string | null | undefined, fallback: string, intlLocale: string): string {
  if (!dateStr) return fallback;
  return new Date(dateStr).toLocaleDateString(intlLocale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const REASON_OPTIONS = [
  { key: "found_via_housalert", labelKey: "cancellation.foundViaHousalert" },
  { key: "found_not_via_housalert", labelKey: "cancellation.foundNotViaHousalert" },
  { key: "not_found", labelKey: "cancellation.notFound" },
  { key: "other", labelKey: "cancellation.otherReason" },
] as const;

interface SubStatus {
  status: string;
  plan: string | null;
  trial_ends_at: string | null;
  current_period_ends_at: string | null;
  isActive: boolean;
  isTrial: boolean;
  isExpired: boolean;
  cancelAtPeriodEnd: boolean;
}

export function SubscriptionCancelConfirmPage() {
  const [, navigate] = useLocation();
  const { t, locale } = useTranslation();
  const [step, setStep] = useState<"confirm" | "feedback">("confirm");
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const { data: subscription } = useQuery<SubStatus>({
    queryKey: ["/api/subscription/status"],
  });

  const intlLocale = localeToIntl(locale);
  const isTrial = !!subscription?.isTrial;
  const endDate = formatDate(
    subscription?.current_period_ends_at || subscription?.trial_ends_at,
    t("subscription.futureDate"),
    intlLocale
  );

  async function submitFeedback() {
    if (!selectedReason) return;
    setSubmitting(true);
    setCancelError(null);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const cancelRes = await apiFetch("/api/subscription/cancel", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!cancelRes.ok) {
        const err = await cancelRes.json().catch(() => ({}));
        throw new Error((err as any).error || "Cancellation failed");
      }

      apiFetch("/api/cancellation-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          reasonType: selectedReason,
          reasonText: selectedReason === "other" ? reasonText : null,
        }),
      }).catch(() => {});

      queryClient.invalidateQueries({ queryKey: ["/api/subscription/status"] });
    } catch (err: any) {
      setCancelError(err.message);
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    navigate("/account/subscription/cancelled");
  }

  if (step === "feedback") {
    return (
      <div className="min-h-screen bg-ha-bg" data-testid="page-cancel-feedback">
        <AppHeader title={t("cancellation.feedbackTitle")} onBack={() => setStep("confirm")} />

        <div className="max-w-xl mx-auto px-4 pt-4 pb-8">
          <div className="bg-white rounded-[28px] p-6" style={{ border: "1px solid #eeeeee" }}>

            <div className="flex items-center justify-center mb-5">
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: "#bbadfb" }}>
                <MessageSquare className="w-7 h-7" style={{ color: "#171429" }} />
              </div>
            </div>

            <h2
              className="text-[20px] font-bold text-center mb-1"
              style={{ color: "#111111" }}
              data-testid="text-feedback-title"
            >
              {t("cancellation.feedbackQuestion")}
            </h2>
            <p className="text-[14px] text-center mb-5" style={{ color: "#666666" }}>
              {t("cancellation.feedbackSubtitle")}
            </p>

            <div className="flex flex-col gap-2.5 mb-5">
              {REASON_OPTIONS.map(({ key, labelKey }) => (
                <button
                  key={key}
                  onClick={() => setSelectedReason(key)}
                  className="w-full text-left px-4 py-3.5 rounded-[14px] border text-[15px] font-medium transition-colors"
                  style={{
                    backgroundColor: selectedReason === key ? "#bbadfb" : "#ffffff",
                    borderColor: selectedReason === key ? "#bbadfb" : "#eeeeee",
                    color: selectedReason === key ? "#171429" : "#111111",
                  }}
                  data-testid={`button-reason-${key}`}
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>

            {selectedReason === "other" && (
              <textarea
                value={reasonText}
                onChange={(e) => setReasonText(e.target.value)}
                placeholder={t("cancellation.otherPlaceholder")}
                className="w-full rounded-[12px] border px-4 py-3 text-[14px] min-h-[80px] mb-5 resize-none outline-none"
                style={{ borderColor: "#eeeeee", color: "#111111" }}
                data-testid="input-reason-text"
              />
            )}

            {cancelError && (
              <p className="text-[13px] text-center mb-3" style={{ color: "#e11d48" }}>
                {cancelError}
              </p>
            )}

            <div className="space-y-3">
              <button
                onClick={submitFeedback}
                disabled={!selectedReason || submitting}
                className="w-full h-[52px] rounded-full font-bold text-[15px] transition-all active:scale-[0.98] disabled:opacity-40"
                style={{ backgroundColor: !selectedReason || submitting ? "#888888" : "#223546", color: "#ffffff" }}
                data-testid="button-submit-feedback"
              >
                {submitting ? t("common.loading") : t("cancellation.submitAndCancel")}
              </button>
              <button
                onClick={() => navigate("/account/subscription")}
                className="w-full h-[52px] rounded-full font-bold text-[15px] transition-all active:scale-[0.98]"
                style={{ backgroundColor: "#85fb8c", color: "#223546" }}
                data-testid="button-keep-instead"
              >
                {t("subscription.keepSubscription")}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ha-bg" data-testid="page-cancel-confirm">
      <AppHeader title={t("subscription.cancelTitle")} onBack={() => navigate("/account/subscription")} />

      <div className="max-w-xl mx-auto px-4 pt-4 pb-8">
        <div className="bg-white rounded-[28px] p-6" style={{ border: "1px solid #eeeeee" }}>

          <div className="flex items-center justify-center mb-5">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: "#bbadfb" }}>
              <AlertCircle className="w-7 h-7" style={{ color: "#171429" }} />
            </div>
          </div>

          <h2
            className="text-[20px] font-bold text-center mb-5"
            style={{ color: "#111111" }}
            data-testid="text-cancel-title"
          >
            {t("subscription.cancelConfirm")}
          </h2>

          <div className="rounded-[16px] p-4 mb-6" style={{ backgroundColor: "#f6f6f6", border: "1px solid #eeeeee" }}>
            <p
              className="text-[15px] leading-relaxed"
              style={{ color: "#444444" }}
              data-testid="text-cancel-info"
            >
              {isTrial
                ? t("subscription.cancelInfoTrial", { date: endDate })
                : t("subscription.cancelInfo", { date: endDate })}
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => navigate("/account/subscription")}
              className="w-full h-[52px] rounded-full font-bold text-[15px] transition-all active:scale-[0.98]"
              style={{ backgroundColor: "#85fb8c", color: "#223546" }}
              data-testid="button-keep-subscription"
            >
              {t("subscription.keepSubscription")}
            </button>
            <button
              onClick={() => setStep("feedback")}
              className="w-full h-[52px] rounded-full font-bold text-[15px] border transition-all active:scale-[0.98]"
              style={{ backgroundColor: "#ffffff", color: "#111111", borderColor: "#111111" }}
              data-testid="button-confirm-cancel"
            >
              {t("subscription.confirmCancel")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SubscriptionCancelledPage() {
  const [, navigate] = useLocation();
  const { t, locale } = useTranslation();

  const { data: subscription } = useQuery<SubStatus>({
    queryKey: ["/api/subscription/status"],
  });

  const intlLocale = localeToIntl(locale);
  const wasTrial = !!subscription?.trial_ends_at;
  const endDate = formatDate(
    subscription?.current_period_ends_at || subscription?.trial_ends_at,
    t("subscription.futureDate"),
    intlLocale
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f6f6f6" }} data-testid="page-cancelled">
      <AppHeader title={t("subscription.cancelledTitle")} onBack={() => navigate("/account/subscription")} />

      <div className="max-w-xl mx-auto px-4 pt-4 pb-8">
        <div className="bg-white rounded-[28px] p-6" style={{ border: "1px solid #eeeeee" }}>

          <div className="flex items-center justify-center mb-5">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: "#bbadfb" }}>
              <CheckCircle2 className="w-7 h-7" style={{ color: "#171429" }} />
            </div>
          </div>

          <h2
            className="text-[22px] font-bold text-center mb-3"
            style={{ color: "#111111" }}
            data-testid="text-cancelled-title"
          >
            {t("subscription.cancelled")}
          </h2>

          <div className="rounded-[16px] p-4 mb-6" style={{ backgroundColor: "#f6f6f6", border: "1px solid #eeeeee" }}>
            <p
              className="text-[15px] leading-relaxed"
              style={{ color: "#444444" }}
              data-testid="text-cancelled-info"
            >
              {wasTrial
                ? t("subscription.cancelledInfoTrial", { date: endDate })
                : t("subscription.cancelledInfo", { date: endDate })}
            </p>
          </div>

          <button
            onClick={() => navigate("/account/subscription")}
            className="w-full h-[52px] rounded-full font-bold text-[15px] transition-all active:scale-[0.98]"
            style={{ backgroundColor: "#85fb8c", color: "#223546" }}
            data-testid="button-back-to-account"
          >
            {t("subscription.backToAccount")}
          </button>
        </div>
      </div>
    </div>
  );
}
