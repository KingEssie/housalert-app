import { useEffect } from "react";
import { useLocation } from "wouter";
import { Crown, CreditCard, ChevronRight, AlertCircle, XCircle, CheckCircle2 } from "lucide-react";
import { AppHeader } from "@/components/ui/app-header";
import { useSubscription } from "@/lib/subscription";
import { useTranslation } from "@/i18n";
import { useBuddyConnections, isBuddyMode } from "@/lib/buddy";

function formatDate(dateStr: string | null | undefined, locale?: string): string {
  if (!dateStr) return "\u2014";
  const intlLocale = locale === "de" ? "de-DE" : locale === "en" ? "en-GB" : "nl-NL";
  return new Date(dateStr).toLocaleDateString(intlLocale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function SubscriptionDetailPage() {
  const [, navigate] = useLocation();
  const { t, locale } = useTranslation();
  const buddyConns = useBuddyConnections();
  const isBuddy = isBuddyMode(buddyConns.data);

  useEffect(() => {
    if (isBuddy) navigate("/dashboard");
  }, [isBuddy]);

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
    if (isCanceled && subscription?.isActive) return "bg-[#F3F4F6] text-[#111111]";
    if (subscription?.isTrial) return "bg-ha-primary/10 text-ha-primary";
    return "bg-[#ECFDF5] text-[#065F46]";
  }

  const startDate = subscription?.created_at || null;
  const renewalDate = subscription?.current_period_ends_at || subscription?.trial_ends_at;

  if (isLoading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "#eaeaeb" }}>
        <AppHeader title={t("subscription.title")} onBack={() => navigate("/dashboard?tab=profile")} />
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
      value: formatDate(startDate, locale),
      testId: "text-start-date",
    },
    {
      label: subscription?.isTrial
        ? t("subscription.trialEnds")
        : isCanceled
          ? t("subscription.endsAt")
          : t("subscription.nextRenewal"),
      value: formatDate(renewalDate, locale),
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
    <div className="min-h-screen" style={{ backgroundColor: "#eaeaeb" }} data-testid="page-subscription-detail">
      <AppHeader title={t("subscription.title")} onBack={() => navigate("/dashboard?tab=profile")} />

      <div className="max-w-lg mx-auto px-4 pt-2 pb-12 flex flex-col gap-3">

        {/* ── Top membership card ── */}
        <div className="app-card !p-0 overflow-hidden" data-testid="card-subscription-info">

          {/* Hero block */}
          <div className="px-5 pt-6 pb-5">

            {/* Crown icon — standalone, no background */}
            <Crown
              className="w-[26px] h-[26px] text-[#000000] mb-4"
              strokeWidth={1.8}
            />

            {/* Plan name — bold black, largest text */}
            <p
              className="text-[22px] font-bold text-[#000000] leading-tight"
              data-testid="text-plan-summary"
            >
              {subscription?.isTrial ? t("subscription.status.trial") : getPlanLabel(subscription?.plan)}
            </p>

            {/* Status badge — inline after plan name */}
            <div className="mt-2 flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase px-2.5 py-[5px] rounded-[6px] ${getStatusBadgeClass()}`}
                data-testid="badge-subscription-status"
              >
                {subscription?.isActive && !subscription?.isExpired && (
                  <span className="w-[5px] h-[5px] rounded-full bg-current opacity-90 flex-shrink-0" />
                )}
                {getStatusLabel()}
              </span>
            </div>

            {/* Renewal message — black, no fade */}
            {renewalDate && (
              <p className="text-[14px] font-medium text-[#000000] mt-3" data-testid="text-renewal-hero">
                {isCanceled
                  ? `${t("subscription.endsAt")} ${formatDate(renewalDate, locale)}`
                  : subscription?.isTrial
                    ? `${t("subscription.trialEnds")} ${formatDate(renewalDate, locale)}`
                    : `${t("subscription.nextRenewal")} ${formatDate(renewalDate, locale)}`}
              </p>
            )}

            {/* Value confirmation line — no icon container */}
            {subscription?.isActive && !subscription?.isExpired && (
              <div className="flex items-center gap-2 mt-3">
                <CheckCircle2
                  className="w-[15px] h-[15px] text-[#059669] flex-shrink-0"
                  strokeWidth={2}
                />
                <p className="text-[13px] font-normal text-[#000000]">
                  {t("subscription.matchesNowActive")}
                </p>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="h-px bg-[#F3F4F6] mx-5" />

          {/* Detail rows — labels black, values bold black */}
          <div className="px-5 pb-1">
            {rows.map((row, idx) => (
              <div
                key={row.testId}
                className={`flex items-center justify-between py-[13px] ${idx < rows.length - 1 ? "border-b border-[#F3F4F6]" : ""}`}
              >
                <p className="text-[13px] font-normal text-[#000000]">{row.label}</p>
                <p className="text-[13px] font-semibold text-[#000000]" data-testid={row.testId}>{row.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Management actions ── */}
        <div className="app-card !p-0 overflow-hidden" data-testid="card-subscription-actions">

          {/* Primary: manage payment */}
          <button
            onClick={() => navigate("/account/payment-method")}
            className="w-full flex items-center gap-4 px-5 py-[16px] text-left active:bg-[#F9FAFB] transition-colors"
            data-testid="button-manage-payment"
          >
            {/* Icon standalone — no background */}
            <CreditCard
              className="w-[22px] h-[22px] text-[#000000] flex-shrink-0"
              strokeWidth={1.8}
            />
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold text-[#000000] leading-snug">
                {t("subscription.managePayment")}
              </p>
              <p className="text-[12px] font-normal text-[#000000] mt-[2px] opacity-60">
                {t("subscription.updatePaymentDesc")}
              </p>
            </div>
            <ChevronRight className="w-[18px] h-[18px] text-[#000000] opacity-30 flex-shrink-0" />
          </button>

          {/* Destructive: cancel — clearly red, no icon container */}
          {!isCanceled && (
            <>
              <div className="h-px bg-[#F3F4F6] mx-5" />
              <button
                onClick={() => navigate("/account/subscription/cancel")}
                className="w-full flex items-center gap-4 px-5 py-[14px] text-left active:bg-red-50/60 transition-colors"
                data-testid="button-cancel-subscription"
              >
                <XCircle
                  className="w-[20px] h-[20px] text-[#DC2626] flex-shrink-0"
                  strokeWidth={1.8}
                />
                <p className="text-[14px] font-medium text-[#DC2626] flex-1">
                  {t("subscription.cancelSubscription")}
                </p>
                <ChevronRight className="w-[16px] h-[16px] text-[#DC2626] opacity-40 flex-shrink-0" />
              </button>
            </>
          )}
        </div>

        {/* ── Expired CTA ── */}
        {subscription?.isExpired && (
          <div className="app-card" data-testid="card-expired-cta">
            <div className="flex items-start gap-3 mb-4">
              {/* AlertCircle standalone — no container */}
              <AlertCircle
                className="w-[22px] h-[22px] text-[#000000] flex-shrink-0 mt-0.5"
                strokeWidth={1.8}
              />
              <div>
                <p className="text-[15px] font-bold text-[#000000]">{t("subscription.expiredTitle")}</p>
                <p className="text-[13px] font-normal text-[#000000] mt-0.5 opacity-60">{t("subscription.expiredDesc")}</p>
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
