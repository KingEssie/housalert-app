import { useLocation } from "wouter";
import { Crown, CreditCard, Calendar, RefreshCw, ChevronRight, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { useSubscription } from "@/lib/subscription";
import { useTranslation } from "@/i18n";

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function SubscriptionDetailPage() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();

  const sub = useSubscription();
  const isLoading = sub.loading;

  const isCanceled = sub.status === "canceled" || sub.cancelAtPeriodEnd;

  const subscription = isLoading ? undefined : {
    status: sub.status,
    plan: sub.plan,
    trial_ends_at: sub.trialEndsAt,
    current_period_ends_at: sub.currentPeriodEndsAt,
    created_at: sub.created_at,
    isActive: sub.isActive,
    isTrial: sub.isTrial,
    isExpired: sub.isExpired,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
  };

  function getPlanLabel(plan: string | null | undefined): string {
    switch (plan) {
      case "monthly": return t("subscription.planLabel.monthly");
      case "two_month": return t("subscription.planLabel.twoMonth");
      case "three_month": return t("subscription.planLabel.threeMonth");
      default: return t("subscription.planLabel.default");
    }
  }

  function getPriceLabel(plan: string | null | undefined): string {
    switch (plan) {
      case "monthly": return t("subscription.priceLabel.monthly");
      case "two_month": return t("subscription.priceLabel.twoMonth");
      case "three_month": return t("subscription.priceLabel.threeMonth");
      default: return "\u2014";
    }
  }

  function getBillingFrequency(plan: string | null | undefined): string {
    switch (plan) {
      case "monthly": return t("subscription.billingFrequencyValue.monthly");
      case "two_month": return t("subscription.billingFrequencyValue.twoMonth");
      case "three_month": return t("subscription.billingFrequencyValue.threeMonth");
      default: return "\u2014";
    }
  }

  function getStatusLabel(): string {
    if (subscription?.isTrial) return t("subscription.status.trial");
    if (subscription?.isExpired) return t("subscription.status.expired");
    if (isCanceled && subscription?.isActive) return t("subscription.status.activeUntilEnd");
    if (subscription?.isActive) return t("subscription.status.active");
    return t("subscription.status.expired");
  }

  function getPlanSummary(): string {
    if (subscription?.isTrial) return t("subscription.status.trial");
    const planName = getPlanLabel(subscription?.plan);
    if (subscription?.isExpired) return planName;
    if (isCanceled && subscription?.isActive) {
      return `${planName} \u2022 ${t("subscription.status.activeUntilEnd")}`;
    }
    return `${planName} \u2022 ${t("subscription.status.active")}`;
  }

  const startDate = subscription?.created_at || null;
  const renewalDate = subscription?.current_period_ends_at || subscription?.trial_ends_at;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title={t("subscription.title")} onBack={() => navigate("/dashboard?tab=profiel&sub=account")} />
        <div className="max-w-xl mx-auto p-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card rounded-[24px] border border-[#F0F0F0] shadow-[0_2px_8px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)] p-5 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/3 mb-3" />
              <div className="h-5 bg-muted rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="page-subscription-detail">
      <PageHeader title={t("subscription.title")} onBack={() => navigate("/dashboard?tab=profiel&sub=account")} />

      <div className="max-w-xl mx-auto p-4 space-y-4 pb-8">
        <div className="rounded-[24px] p-6 bg-[#0F172A]" data-testid="card-subscription-plan">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-[48px] h-[48px] rounded-full bg-white/10 flex items-center justify-center">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[16px] font-medium text-white" data-testid="text-plan-name">
                {subscription?.isTrial ? t("subscription.status.trial") : getPlanSummary()}
              </p>
              <span
                className={`inline-block mt-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full ${
                  isCanceled && subscription?.isActive
                    ? "bg-[#FEF3C7] text-[#92400E]"
                    : "bg-white text-[#0D6EFD]"
                }`}
                data-testid="badge-subscription-status"
              >
                {getStatusLabel()}
              </span>
            </div>
          </div>

          {!subscription?.isTrial && subscription?.plan && (
            <p className="text-[24px] font-medium text-white ml-[60px]" data-testid="text-price">
              {getPriceLabel(subscription?.plan)}
            </p>
          )}
        </div>

        <div className="bg-card rounded-[24px] border border-[#F0F0F0] shadow-[0_2px_8px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)] overflow-hidden" data-testid="card-subscription-details">
          <div className="px-5 pt-5 pb-2">
            <p className="text-[13px] font-medium tracking-wider" style={{ color: "#6B7280" }}>{t("subscription.details")}</p>
          </div>

          <DetailRow
            icon={<Calendar className="w-[18px] h-[18px]" style={{ color: "#0D6EFD" }} />}
            label={t("subscription.startDate")}
            value={formatDate(startDate)}
            testId="text-start-date"
          />
          <div className="mx-5" style={{ borderBottom: "1px solid #E5E7EB" }} />

          <DetailRow
            icon={<Calendar className="w-[18px] h-[18px]" style={{ color: "#0D6EFD" }} />}
            label={
              subscription?.isTrial
                ? t("subscription.trialEnds")
                : isCanceled
                  ? t("subscription.endsAt")
                  : t("subscription.nextRenewal")
            }
            value={formatDate(renewalDate)}
            testId="text-renewal-date"
          />
          <div className="mx-5" style={{ borderBottom: "1px solid #E5E7EB" }} />

          <DetailRow
            icon={<RefreshCw className="w-[18px] h-[18px]" style={{ color: "#0D6EFD" }} />}
            label={t("subscription.autoRenew")}
            value={!isCanceled && subscription?.isActive && !subscription?.isTrial ? t("subscription.on") : t("subscription.off")}
            testId="text-auto-renew"
          />
          <div className="mx-5" style={{ borderBottom: "1px solid #E5E7EB" }} />

          <DetailRow
            icon={<CreditCard className="w-[18px] h-[18px]" style={{ color: "#0D6EFD" }} />}
            label={t("subscription.paymentMethod")}
            value={t("subscription.viaStripe")}
            testId="text-payment-method"
          />
        </div>

        <div className="bg-card rounded-[24px] border border-[#F0F0F0] shadow-[0_2px_8px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)] overflow-hidden" data-testid="card-subscription-actions">
          <div className="px-5 pt-5 pb-2">
            <p className="text-[13px] font-medium tracking-wider" style={{ color: "#6B7280" }}>{t("subscription.manage")}</p>
          </div>

          <ActionRow
            label={t("subscription.managePayment")}
            onClick={() => navigate("/account/payment-method")}
            testId="button-manage-payment"
          />
          <div className="mx-5" style={{ borderBottom: "1px solid #E5E7EB" }} />

          {!isCanceled && (
            <ActionRow
              label={t("subscription.cancelSubscription")}
              onClick={() => navigate("/account/subscription/cancel")}
              danger
              testId="button-cancel-subscription"
            />
          )}
        </div>

        {subscription?.isExpired && (
          <div className="bg-card rounded-[24px] border border-[#F0F0F0] shadow-[0_2px_8px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)] p-5" data-testid="card-expired-cta">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#F5F7FA" }}>
                <AlertCircle className="w-5 h-5" style={{ color: "#0D6EFD" }} />
              </div>
              <div>
                <p className="text-[15px] font-medium" style={{ color: "#1F2937" }}>{t("subscription.expiredTitle")}</p>
                <p className="text-[14px] text-muted-foreground mt-0.5">{t("subscription.expiredDesc")}</p>
              </div>
            </div>
            <button
              onClick={() => navigate("/paywall")}
              className="w-full h-[48px] bg-primary text-primary-foreground rounded-full font-medium text-[15px] transition-colors"
              data-testid="button-renew-subscription"
            >
              {t("subscription.renewSubscription")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ icon, label, value, testId }: { icon: React.ReactNode; label: string; value: string; testId: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <div className="w-8 h-8 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#F5F7FA" }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-muted-foreground">{label}</p>
        <p className="text-[15px] font-medium truncate" style={{ color: "#1F2937" }} data-testid={testId}>{value}</p>
      </div>
    </div>
  );
}

function ActionRow({ label, onClick, danger, testId }: { label: string; onClick: () => void; danger?: boolean; testId: string }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-5 py-4 hover-elevate transition-colors"
      data-testid={testId}
    >
      <span className={`text-[15px] font-medium ${danger ? "text-destructive" : ""}`} style={danger ? {} : { color: "#1F2937" }}>{label}</span>
      <ChevronRight className="w-4 h-4 text-muted-foreground" />
    </button>
  );
}
