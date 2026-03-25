import { useLocation } from "wouter";
import { Crown, CreditCard, Calendar, RefreshCw, ChevronRight, AlertCircle, XCircle } from "lucide-react";
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

  function getStatusLabel(): string {
    if (subscription?.isTrial) return t("subscription.status.trial");
    if (subscription?.isExpired) return t("subscription.status.expired");
    if (isCanceled && subscription?.isActive) return t("subscription.status.activeUntilEnd");
    if (subscription?.isActive) return t("subscription.status.active");
    return t("subscription.status.expired");
  }

  function getStatusColor(): string {
    if (subscription?.isExpired) return "bg-[#EF4444]/15 text-[#EF4444]";
    if (isCanceled && subscription?.isActive) return "bg-[#FBBF24]/15 text-[#FBBF24]";
    if (subscription?.isTrial) return "bg-[#E91E63]/15 text-[#E91E63]";
    return "bg-[#00C896]/15 text-[#00C896]";
  }

  const startDate = subscription?.created_at || null;
  const renewalDate = subscription?.current_period_ends_at || subscription?.trial_ends_at;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1A1A2E]">
        <PageHeader title={t("subscription.title")} onBack={() => navigate("/dashboard?tab=profiel&sub=account")} />
        <div className="max-w-lg mx-auto px-6 pt-4">
          <div className="rounded-[20px] border border-[#353560] bg-[#252547] p-6 animate-pulse">
            <div className="h-5 bg-[#353560] rounded w-1/3 mb-4" />
            <div className="h-4 bg-[#353560] rounded w-2/3 mb-3" />
            <div className="h-4 bg-[#353560] rounded w-1/2 mb-3" />
            <div className="h-4 bg-[#353560] rounded w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  const rows: { label: string; value: string; testId: string }[] = [
    {
      label: t("subscription.planType"),
      value: subscription?.isTrial ? t("subscription.status.trial") : getPlanLabel(subscription?.plan),
      testId: "text-plan-name",
    },
    ...(!subscription?.isTrial && subscription?.plan ? [{
      label: t("subscription.price"),
      value: getPriceLabel(subscription?.plan),
      testId: "text-price",
    }] : []),
    {
      label: t("subscription.startDate"),
      value: formatDate(startDate),
      testId: "text-start-date",
    },
    {
      label: subscription?.isTrial
        ? t("subscription.trialEnds")
        : isCanceled
          ? t("subscription.endsAt")
          : t("subscription.nextRenewal"),
      value: formatDate(renewalDate),
      testId: "text-renewal-date",
    },
    {
      label: t("subscription.autoRenew"),
      value: !isCanceled && subscription?.isActive && !subscription?.isTrial ? t("subscription.on") : t("subscription.off"),
      testId: "text-auto-renew",
    },
    {
      label: t("subscription.paymentMethod"),
      value: t("subscription.viaStripe"),
      testId: "text-payment-method",
    },
  ];

  return (
    <div className="min-h-screen bg-[#1A1A2E]" data-testid="page-subscription-detail">
      <PageHeader title={t("subscription.title")} onBack={() => navigate("/dashboard?tab=profiel&sub=account")} />

      <div className="max-w-lg mx-auto px-6 pt-2 pb-12 flex flex-col gap-6">
        <div
          className="rounded-[20px] border border-[#353560] bg-[#252547] px-5 py-5"
          data-testid="card-subscription-info"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-[#E91E63]/10 flex items-center justify-center flex-shrink-0">
              <Crown className="w-[22px] h-[22px] text-[#E91E63]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-white" data-testid="text-plan-summary">
                {subscription?.isTrial ? t("subscription.status.trial") : getPlanLabel(subscription?.plan)}
              </p>
              <span
                className={`inline-block mt-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full ${getStatusColor()}`}
                data-testid="badge-subscription-status"
              >
                {getStatusLabel()}
              </span>
            </div>
          </div>

          <div className="flex flex-col">
            {rows.map((row, idx) => (
              <div
                key={row.testId}
                className={`flex items-center justify-between py-[14px] ${idx < rows.length - 1 ? "border-b border-[#353560]" : ""}`}
              >
                <p className="text-[13px] text-[#9CA3AF]">{row.label}</p>
                <p className="text-[14px] text-white font-medium" data-testid={row.testId}>{row.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <button
            onClick={() => navigate("/account/payment-method")}
            className="w-full flex items-center gap-3.5 px-1 py-[14px] text-left active:bg-[#252547] transition-colors rounded-xl"
            data-testid="button-manage-payment"
          >
            <CreditCard className="w-[22px] h-[22px] text-[#9CA3AF] flex-shrink-0" />
            <p className="text-[15px] text-white flex-1">{t("subscription.managePayment")}</p>
            <ChevronRight className="w-4 h-4 text-[#6B7280] flex-shrink-0" />
          </button>

          {!isCanceled && (
            <button
              onClick={() => navigate("/account/subscription/cancel")}
              className="w-full flex items-center gap-3.5 px-1 py-[14px] text-left active:bg-[#EF4444]/10 transition-colors rounded-xl"
              data-testid="button-cancel-subscription"
            >
              <XCircle className="w-[22px] h-[22px] text-[#EF4444] flex-shrink-0" />
              <p className="text-[15px] text-[#EF4444] flex-1">{t("subscription.cancelSubscription")}</p>
              <ChevronRight className="w-4 h-4 text-[#6B7280] flex-shrink-0" />
            </button>
          )}
        </div>

        {subscription?.isExpired && (
          <div className="rounded-[20px] border border-[#353560] bg-[#252547] p-5" data-testid="card-expired-cta">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-[#E91E63]/10 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-[#E91E63]" />
              </div>
              <div>
                <p className="text-[15px] font-medium text-white">{t("subscription.expiredTitle")}</p>
                <p className="text-[14px] text-[#9CA3AF] mt-0.5">{t("subscription.expiredDesc")}</p>
              </div>
            </div>
            <button
              onClick={() => navigate("/paywall")}
              className="w-full h-[48px] bg-[#E91E63] hover:bg-[#D81B60] text-white rounded-full font-medium text-[15px] transition-colors active:opacity-90"
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
