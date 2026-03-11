import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useTranslation } from "@/i18n";

function formatDate(dateStr: string | null | undefined, fallback: string): string {
  if (!dateStr) return fallback;
  return new Date(dateStr).toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function SubscriptionCancelConfirmPage() {
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
    <div className="min-h-screen bg-background" data-testid="page-cancel-confirm">
      <PageHeader title={t("subscription.cancelTitle")} onBack={() => navigate("/account/subscription")} />

      <div className="max-w-xl mx-auto p-4 pb-8">
        <div className="bg-card rounded-lg border p-6" style={{ borderColor: "#E5E7EB" }}>
          <div className="flex items-center justify-center mb-5">
            <div className="w-14 h-14 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#F5F7FA" }}>
              <AlertCircle className="w-7 h-7" style={{ color: "#0D6EFD" }} />
            </div>
          </div>

          <h2 className="text-[20px] font-bold text-center mb-3" style={{ color: "#1F2937" }} data-testid="text-cancel-title">
            {t("subscription.cancelConfirm")}
          </h2>

          <div className="bg-muted rounded-lg p-4 mb-6">
            <p className="text-[15px] text-muted-foreground leading-relaxed" data-testid="text-cancel-info">
              {t("subscription.cancelInfo", { date: renewalDate })}
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => navigate("/account/subscription")}
              className="w-full h-[48px] bg-primary text-primary-foreground rounded-lg font-semibold text-[15px] transition-colors"
              data-testid="button-keep-subscription"
            >
              {t("subscription.keepSubscription")}
            </button>
            <button
              onClick={() => navigate("/account/subscription/cancelled")}
              className="w-full h-[48px] bg-card border text-muted-foreground rounded-lg font-semibold text-[15px] hover-elevate transition-colors"
              style={{ borderColor: "#E5E7EB" }}
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
    <div className="min-h-screen bg-background" data-testid="page-cancelled">
      <PageHeader title={t("subscription.cancelledTitle")} onBack={() => navigate("/account/subscription")} />

      <div className="max-w-xl mx-auto p-4 pb-8">
        <div className="bg-card rounded-lg border p-6" style={{ borderColor: "#E5E7EB" }}>
          <div className="flex items-center justify-center mb-5">
            <div className="w-14 h-14 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#F5F7FA" }}>
              <CheckCircle2 className="w-7 h-7" style={{ color: "#16A34A" }} />
            </div>
          </div>

          <h2 className="text-[20px] font-bold text-center mb-3" style={{ color: "#1F2937" }} data-testid="text-cancelled-title">
            {t("subscription.cancelled")}
          </h2>

          <div className="bg-muted rounded-lg p-4 mb-6">
            <p className="text-[15px] text-muted-foreground leading-relaxed" data-testid="text-cancelled-info">
              {t("subscription.cancelledInfo", { date: renewalDate })}
            </p>
          </div>

          <button
            onClick={() => navigate("/dashboard?tab=profiel&sub=account")}
            className="w-full h-[48px] bg-primary text-primary-foreground rounded-lg font-semibold text-[15px] transition-colors"
            data-testid="button-back-to-account"
          >
            {t("subscription.backToAccount")}
          </button>
        </div>
      </div>
    </div>
  );
}
