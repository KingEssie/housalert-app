import { useLocation } from "wouter";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { AlertCircle, CheckCircle2, MessageSquare } from "lucide-react";
import { useTranslation } from "@/i18n";
import { apiFetch } from "@/lib/api-base";
import { supabase } from "@/lib/supabase";

function formatDate(dateStr: string | null | undefined, fallback: string): string {
  if (!dateStr) return fallback;
  return new Date(dateStr).toLocaleDateString("de-DE", {
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

export function SubscriptionCancelConfirmPage() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const [step, setStep] = useState<"confirm" | "feedback">("confirm");
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: subscription } = useQuery<{
    status: string;
    plan: string | null;
    trial_ends_at: string | null;
    current_period_ends_at: string | null;
    isActive: boolean;
    isTrial: boolean;
    isExpired: boolean;
  }>({
    queryKey: ["/api/subscription/status"],
  });

  const renewalDate = formatDate(subscription?.current_period_ends_at || subscription?.trial_ends_at, t("subscription.futureDate"));

  async function submitFeedback() {
    if (!selectedReason) return;
    setSubmitting(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (token) {
        await apiFetch("/api/cancellation-feedback", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            reasonType: selectedReason,
            reasonText: selectedReason === "other" ? reasonText : null,
          }),
        });
      }
    } catch {}
    setSubmitting(false);
    navigate("/account/subscription/cancelled");
  }

  if (step === "feedback") {
    return (
      <div className="min-h-screen bg-ha-bg" data-testid="page-cancel-feedback">
        <PageHeader title={t("cancellation.feedbackTitle")} onBack={() => setStep("confirm")} />

        <div className="max-w-xl mx-auto p-4 pb-8">
          <div className="bg-ha-card rounded-2xl border border-ha-card-border p-6">
            <div className="flex items-center justify-center mb-5">
              <div className="w-14 h-14 rounded-2xl bg-ha-primary/10 flex items-center justify-center">
                <MessageSquare className="w-7 h-7 text-ha-primary" />
              </div>
            </div>

            <h2 className="text-[20px] font-medium text-ha-text text-center mb-2" data-testid="text-feedback-title">
              {t("cancellation.feedbackQuestion")}
            </h2>
            <p className="text-[14px] text-center text-ha-text-secondary mb-5">
              {t("cancellation.feedbackSubtitle")}
            </p>

            <div className="flex flex-col gap-2 mb-5">
              {REASON_OPTIONS.map(({ key, labelKey }) => (
                <button
                  key={key}
                  onClick={() => setSelectedReason(key)}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-[15px] font-medium transition-colors ${
                    selectedReason === key
                      ? "border-ha-primary bg-ha-primary/10 text-ha-primary"
                      : "border-ha-card-border bg-ha-bg text-ha-text hover:bg-ha-surface"
                  }`}
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
                className="w-full h-[80px] bg-ha-bg rounded-xl px-4 py-3 text-[14px] text-ha-text placeholder:text-ha-text-muted resize-none mb-5 border border-ha-card-border focus:border-ha-primary focus:outline-none"
                data-testid="input-reason-text"
              />
            )}

            <div className="space-y-3">
              <button
                onClick={submitFeedback}
                disabled={!selectedReason || submitting}
                className="w-full h-[48px] bg-ha-primary hover:bg-ha-primary-hover text-white rounded-full font-medium text-[15px] transition-colors disabled:opacity-50"
                data-testid="button-submit-feedback"
              >
                {submitting ? t("common.loading") : t("cancellation.submitAndCancel")}
              </button>
              <button
                onClick={() => navigate("/account/subscription")}
                className="w-full h-[48px] bg-ha-card border border-ha-card-border text-ha-text-secondary rounded-full font-medium text-[15px] hover:bg-ha-surface transition-colors"
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
      <PageHeader title={t("subscription.cancelTitle")} onBack={() => navigate("/account/subscription")} />

      <div className="max-w-xl mx-auto p-4 pb-8">
        <div className="bg-ha-card rounded-2xl border border-ha-card-border p-6">
          <div className="flex items-center justify-center mb-5">
            <div className="w-14 h-14 rounded-2xl bg-amber-400/10 flex items-center justify-center">
              <AlertCircle className="w-7 h-7 text-amber-400" />
            </div>
          </div>

          <h2 className="text-[20px] font-medium text-ha-text text-center mb-3" data-testid="text-cancel-title">
            {t("subscription.cancelConfirm")}
          </h2>

          <div className="bg-ha-bg rounded-2xl p-4 mb-6">
            <p className="text-[15px] text-ha-text-secondary leading-relaxed" data-testid="text-cancel-info">
              {t("subscription.cancelInfo", { date: renewalDate })}
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => navigate("/account/subscription")}
              className="w-full h-[48px] bg-ha-primary hover:bg-ha-primary-hover text-white rounded-full font-medium text-[15px] transition-colors"
              data-testid="button-keep-subscription"
            >
              {t("subscription.keepSubscription")}
            </button>
            <button
              onClick={() => setStep("feedback")}
              className="w-full h-[48px] bg-ha-card border border-ha-card-border text-ha-text-secondary rounded-full font-medium text-[15px] hover:bg-ha-surface transition-colors"
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
  const { t } = useTranslation();

  const { data: subscription } = useQuery<{
    status: string;
    plan: string | null;
    trial_ends_at: string | null;
    current_period_ends_at: string | null;
    isActive: boolean;
    isTrial: boolean;
    isExpired: boolean;
  }>({
    queryKey: ["/api/subscription/status"],
  });

  const renewalDate = formatDate(subscription?.current_period_ends_at || subscription?.trial_ends_at, t("subscription.futureDate"));

  return (
    <div className="min-h-screen bg-ha-bg" data-testid="page-cancelled">
      <PageHeader title={t("subscription.cancelledTitle")} onBack={() => navigate("/account/subscription")} />

      <div className="max-w-xl mx-auto p-4 pb-8">
        <div className="bg-ha-card rounded-2xl border border-ha-card-border p-6">
          <div className="flex items-center justify-center mb-5">
            <div className="w-14 h-14 rounded-2xl bg-ha-success-light flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-ha-success" />
            </div>
          </div>

          <h2 className="text-[20px] font-medium text-ha-text text-center mb-3" data-testid="text-cancelled-title">
            {t("subscription.cancelled")}
          </h2>

          <div className="bg-ha-bg rounded-2xl p-4 mb-6">
            <p className="text-[15px] text-ha-text-secondary leading-relaxed" data-testid="text-cancelled-info">
              {t("subscription.cancelledInfo", { date: renewalDate })}
            </p>
          </div>

          <button
            onClick={() => navigate("/dashboard?tab=profiel&sub=account")}
            className="w-full h-[48px] bg-ha-primary hover:bg-ha-primary-hover text-white rounded-full font-medium text-[15px] transition-colors"
            data-testid="button-back-to-account"
          >
            {t("subscription.backToAccount")}
          </button>
        </div>
      </div>
    </div>
  );
}
