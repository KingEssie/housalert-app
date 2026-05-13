import { useEffect } from "react";
import { useLocation } from "wouter";
import { Crown, CreditCard, ChevronRight, AlertCircle, XCircle, CheckCircle2, Check } from "lucide-react";
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
    if (subscription?.isExpired) return "bg-ha-danger/10 text-ha-danger";
    if (isCanceled && subscription?.isActive) return "bg-ha-surface text-ha-text";
    if (subscription?.isTrial) return "bg-ha-primary/10 text-ha-primary";
    return "bg-ha-success/10 text-ha-success";
  }

  const startDate = subscription?.created_at || null;
  const renewalDate = subscription?.current_period_ends_at || subscription?.trial_ends_at;

  const PREMIUM_FEATURES = [
    "Direct reageren op woningen",
    "Snellere meldingen bij nieuwe matches",
    "AI-reactiebrief voor aanvragen",
    "Tot 4 actieve zoekopdrachten",
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "#f9f7f8" }}>
        <AppHeader title={t("subscription.title")} onBack={() => { if (window.history.length > 1) window.history.back(); else navigate("/dashboard?tab=profile"); }} />
        <div className="max-w-lg mx-auto px-4 pt-4">
          <div
            className="bg-white rounded-[28px] p-5 animate-pulse space-y-4"
            style={{ border: "1px solid #ece7ef" }}
          >
            <div className="h-4 bg-ha-surface rounded w-1/4" />
            <div className="h-7 bg-ha-surface rounded w-2/3" />
            <div className="h-4 bg-ha-surface rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (!subscription?.isActive && !subscription?.isTrial) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "#f9f7f8" }} data-testid="page-subscription-detail">
        <AppHeader title={t("subscription.title")} onBack={() => { if (window.history.length > 1) window.history.back(); else navigate("/dashboard?tab=profile"); }} />
        <div className="max-w-lg mx-auto px-4 pt-6 pb-12">
          <div
            className="bg-white rounded-[28px] p-6 flex flex-col items-center text-center"
            style={{ border: "1px solid #ece7ef", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}
          >
            {/* Icon circle */}
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
              style={{ backgroundColor: "#b9a7ff" }}
            >
              <Crown className="w-9 h-9 text-[#111111]" strokeWidth={1.8} />
            </div>

            <p className="text-[24px] font-bold text-[#111111] mb-2" data-testid="text-no-sub-title">
              {t("subscription.noSubTitle")}
            </p>
            <p className="text-[15px] leading-relaxed mb-6 max-w-[280px]" style={{ color: "#444444" }}>
              {t("subscription.noSubDesc")}
            </p>

            {/* Feature list */}
            <div className="w-full text-left flex flex-col gap-3 mb-7">
              {PREMIUM_FEATURES.map((feature, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className="w-[24px] h-[24px] rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: "#b9a7ff" }}
                  >
                    <Check className="w-[13px] h-[13px] text-[#111111]" strokeWidth={3} />
                  </div>
                  <span className="text-[15px] font-medium text-[#111111]">{feature}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => navigate("/paywall")}
              className="w-full h-[56px] rounded-full font-bold text-white text-[16px] transition-colors active:scale-[0.98]"
              style={{ backgroundColor: "#223546" }}
              data-testid="button-upgrade-subscription"
            >
              {t("subscription.noSubCta")}
            </button>
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
    ...(renewalDate && !subscription?.isExpired ? [{
      label: subscription?.isTrial
        ? t("subscription.trialEnds")
        : isCanceled
          ? t("subscription.endsAt")
          : t("subscription.nextRenewal"),
      value: formatDate(renewalDate, locale),
      testId: "text-renewal-date",
    }] : []),
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
    <div className="min-h-screen" style={{ backgroundColor: "#f9f7f8" }} data-testid="page-subscription-detail">
      <AppHeader title={t("subscription.title")} onBack={() => { if (window.history.length > 1) window.history.back(); else navigate("/dashboard?tab=profile"); }} />

      <div className="max-w-lg mx-auto px-4 pt-2 pb-12 flex flex-col gap-3">

        {/* ── Top membership card ── */}
        <div
          className="bg-white rounded-[28px] overflow-hidden"
          style={{ border: "1px solid #ece7ef", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
          data-testid="card-subscription-info"
        >
          {/* Hero block */}
          <div className="px-5 pt-6 pb-5">
            <Crown className="w-[26px] h-[26px] text-[#111111] mb-4" strokeWidth={1.8} />

            <p className="text-[22px] font-bold text-[#111111] leading-tight" data-testid="text-plan-summary">
              {subscription?.isTrial ? t("subscription.status.trial") : getPlanLabel(subscription?.plan)}
            </p>

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

            {renewalDate && !subscription?.isExpired && (
              <p className="text-[14px] font-medium text-[#111111] mt-3" data-testid="text-renewal-hero">
                {isCanceled
                  ? `${t("subscription.endsAt")} ${formatDate(renewalDate, locale)}`
                  : subscription?.isTrial
                    ? `${t("subscription.trialEnds")} ${formatDate(renewalDate, locale)}`
                    : `${t("subscription.nextRenewal")} ${formatDate(renewalDate, locale)}`}
              </p>
            )}

            {subscription?.isActive && !subscription?.isExpired && (
              <div className="flex items-center gap-2 mt-3">
                <CheckCircle2 className="w-[15px] h-[15px] text-ha-success flex-shrink-0" strokeWidth={2} />
                <p className="text-[13px] font-normal text-[#111111]">
                  {t("subscription.matchesNowActive")}
                </p>
              </div>
            )}
          </div>

          <div className="h-px mx-5" style={{ backgroundColor: "#ece7ef" }} />

          <div className="px-5 pb-1">
            {rows.map((row, idx) => (
              <div
                key={row.testId}
                className={`flex items-center justify-between py-[13px] ${idx < rows.length - 1 ? "border-b" : ""}`}
                style={{ borderColor: "#ece7ef" }}
              >
                <p className="text-[13px] font-normal text-[#111111]">{row.label}</p>
                <p className="text-[13px] font-semibold text-[#111111]" data-testid={row.testId}>{row.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Management actions ── */}
        <div
          className="bg-white rounded-[28px] overflow-hidden"
          style={{ border: "1px solid #ece7ef", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
          data-testid="card-subscription-actions"
        >
          <button
            onClick={() => navigate("/account/payment-method")}
            className="w-full flex items-center gap-4 px-5 py-[16px] text-left transition-colors active:opacity-70"
            data-testid="button-manage-payment"
          >
            <CreditCard className="w-[22px] h-[22px] text-[#111111] flex-shrink-0" strokeWidth={1.8} />
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold text-[#111111] leading-snug">
                {t("subscription.managePayment")}
              </p>
              <p className="text-[12px] font-normal mt-[2px]" style={{ color: "#666666" }}>
                {t("subscription.updatePaymentDesc")}
              </p>
            </div>
            <ChevronRight className="w-[18px] h-[18px] flex-shrink-0" style={{ color: "#6b6677" }} />
          </button>

          {!isCanceled && (
            <>
              <div className="h-px mx-5" style={{ backgroundColor: "#ece7ef" }} />
              <button
                onClick={() => navigate("/account/subscription/cancel")}
                className="w-full flex items-center gap-4 px-5 py-[14px] text-left active:bg-ha-danger/5 transition-colors"
                data-testid="button-cancel-subscription"
              >
                <XCircle className="w-[20px] h-[20px] text-ha-danger flex-shrink-0" strokeWidth={1.8} />
                <p className="text-[14px] font-medium text-ha-danger flex-1">
                  {t("subscription.cancelSubscription")}
                </p>
                <ChevronRight className="w-[16px] h-[16px] text-ha-danger opacity-40 flex-shrink-0" />
              </button>
            </>
          )}
        </div>

        {/* ── Expired CTA ── */}
        {subscription?.isExpired && (
          <div
            className="bg-white rounded-[28px] p-5"
            style={{ border: "1px solid #ece7ef", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
            data-testid="card-expired-cta"
          >
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="w-[22px] h-[22px] text-[#111111] flex-shrink-0 mt-0.5" strokeWidth={1.8} />
              <div>
                <p className="text-[15px] font-bold text-[#111111]">{t("subscription.expiredTitle")}</p>
                <p className="text-[13px] font-normal mt-0.5" style={{ color: "#666666" }}>{t("subscription.expiredDesc")}</p>
              </div>
            </div>
            <button
              onClick={() => navigate("/paywall")}
              className="w-full h-[52px] rounded-full font-bold text-white text-[15px] transition-colors active:scale-[0.98]"
              style={{ backgroundColor: "#223546" }}
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
