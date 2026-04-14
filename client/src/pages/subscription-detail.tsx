import { useLocation } from "wouter";
import { Crown, CreditCard, ChevronRight, AlertCircle, XCircle, CheckCircle2 } from "lucide-react";
import { AppHeader } from "@/components/ui/app-header";
import { useSubscription } from "@/lib/subscription";
import { useTranslation } from "@/i18n";

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString("nl-NL", {
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

  function getStatusBadgeClass(): string {
    if (subscription?.isExpired) return "bg-red-50 text-red-700";
    if (isCanceled && subscription?.isActive) return "bg-[#F3F4F6] text-[#374151]";
    if (subscription?.isTrial) return "bg-ha-primary/10 text-ha-primary";
    return "bg-[#ECFDF5] text-[#065F46]";
  }

  const startDate = subscription?.created_at || null;
  const renewalDate = subscription?.current_period_ends_at || subscription?.trial_ends_at;

  if (isLoading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "#eaeaeb" }}>
        <AppHeader title={t("subscription.title")} onBack={() => navigate("/dashboard?tab=profiel")} />
        <div className="max-w-lg mx-auto px-4 pt-4">
          <div className="app-card animate-pulse space-y-4">
            <div className="h-4 bg-ha-surface rounded w-1/4" />
            <div className="h-7 bg-ha-surface rounded w-2/3" />
            <div className="h-4 bg-ha-surface rounded w-1/2" />
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

  const renewalLabel = subscription?.isTrial
    ? t("subscription.trialEnds")
    : isCanceled
      ? t("subscription.endsAt")
      : t("subscription.nextRenewal");

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#eaeaeb" }} data-testid="page-subscription-detail">
      <AppHeader title={t("subscription.title")} onBack={() => navigate("/dashboard?tab=profiel")} />

      <div className="max-w-lg mx-auto px-4 pt-2 pb-12 flex flex-col gap-3">

        {/* ── Premium membership card ── */}
        <div className="app-card !p-0 overflow-hidden" data-testid="card-subscription-info">

          {/* Top summary block */}
          <div className="px-5 pt-6 pb-5">
            {/* Crown + status badge row */}
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-[8px] bg-ha-primary/10 flex items-center justify-center">
                <Crown className="w-[20px] h-[20px] text-ha-primary" strokeWidth={1.8} />
              </div>
              <span
                className={`inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase px-2.5 py-[5px] rounded-[6px] ${getStatusBadgeClass()}`}
                data-testid="badge-subscription-status"
              >
                {subscription?.isActive && !subscription?.isExpired && (
                  <span className="w-[6px] h-[6px] rounded-full bg-current opacity-80 flex-shrink-0" />
                )}
                {getStatusLabel()}
              </span>
            </div>

            {/* Plan name — hero text */}
            <p
              className="text-[22px] font-bold text-[#111111] leading-tight mb-1"
              data-testid="text-plan-summary"
            >
              {subscription?.isTrial ? t("subscription.status.trial") : getPlanLabel(subscription?.plan)}
            </p>

            {/* Renewal / expiry message */}
            {renewalDate && (
              <p className="text-[14px] text-[#374151] font-medium mt-1" data-testid="text-renewal-hero">
                {isCanceled
                  ? `${t("subscription.endsAt")} ${formatDate(renewalDate)}`
                  : subscription?.isTrial
                    ? `${t("subscription.trialEnds")} ${formatDate(renewalDate)}`
                    : `${t("subscription.nextRenewal")} ${formatDate(renewalDate)}`}
              </p>
            )}

            {/* Value line — subtle, premium */}
            {subscription?.isActive && !subscription?.isExpired && (
              <div className="flex items-center gap-1.5 mt-3">
                <CheckCircle2 className="w-[14px] h-[14px] text-[#059669] flex-shrink-0" strokeWidth={2} />
                <p className="text-[13px] text-[#374151]">
                  Je ontvangt direct nieuwe woningmatches
                </p>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="h-px bg-[#F3F4F6] mx-5" />

          {/* Detail rows */}
          <div className="px-5">
            {rows.map((row, idx) => (
              <div
                key={row.testId}
                className={`flex items-center justify-between py-[13px] ${idx < rows.length - 1 ? "border-b border-[#F3F4F6]" : ""}`}
              >
                <p className="text-[13px] text-[#6B7280]">{row.label}</p>
                <p className="text-[13px] text-[#111111] font-semibold" data-testid={row.testId}>{row.value}</p>
              </div>
            ))}
          </div>

          {/* Bottom padding */}
          <div className="pb-1" />
        </div>

        {/* ── Management actions ── */}
        <div className="app-card !p-0 overflow-hidden" data-testid="card-subscription-actions">

          {/* Primary: manage payment */}
          <button
            onClick={() => navigate("/account/payment-method")}
            className="w-full flex items-center gap-4 px-5 py-[17px] text-left active:bg-[#F9FAFB] transition-colors"
            data-testid="button-manage-payment"
          >
            <div className="w-9 h-9 rounded-[8px] bg-[#F3F4F6] flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-[18px] h-[18px] text-[#374151]" strokeWidth={1.8} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] text-[#111111] font-semibold leading-snug">
                {t("subscription.managePayment")}
              </p>
              <p className="text-[12px] text-[#6B7280] mt-[2px]">
                Werk je betaalgegevens bij
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
          </button>

          {/* Destructive: cancel */}
          {!isCanceled && (
            <>
              <div className="h-px bg-[#F3F4F6] mx-5" />
              <button
                onClick={() => navigate("/account/subscription/cancel")}
                className="w-full flex items-center gap-4 px-5 py-[14px] text-left active:bg-red-50/50 transition-colors"
                data-testid="button-cancel-subscription"
              >
                <XCircle className="w-[18px] h-[18px] text-[#EF4444] flex-shrink-0 ml-[5px]" strokeWidth={1.8} />
                <p className="text-[14px] text-[#EF4444] flex-1">
                  {t("subscription.cancelSubscription")}
                </p>
                <ChevronRight className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
              </button>
            </>
          )}
        </div>

        {/* ── Expired CTA ── */}
        {subscription?.isExpired && (
          <div className="app-card" data-testid="card-expired-cta">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-[8px] bg-ha-primary/10 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-ha-primary" />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-[#111111]">{t("subscription.expiredTitle")}</p>
                <p className="text-[13px] text-[#6B7280] mt-0.5">{t("subscription.expiredDesc")}</p>
              </div>
            </div>
            <button
              onClick={() => navigate("/paywall")}
              className="w-full h-[48px] bg-ha-primary hover:bg-ha-primary-hover text-white rounded-[10px] font-semibold text-[15px] transition-colors active:scale-[0.98]"
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
