import { useEffect, type CSSProperties } from "react";
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

const PAID_PLAN_IDS = ["monthly", "two_month", "three_month"];

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

  // A user with a paid plan set is on a real subscription — even if Stripe is still
  // in a trial phase, we show the paid plan name, not "Proefperiode".
  const isPaidPlan = PAID_PLAN_IDS.includes(subscription?.plan ?? "");

  // For paid plans, `isTrial` in our DB means the 14-day cost-free cancellation
  // window is still open (Stripe subscription started in "trialing" state).
  // This is NOT a free trial — the user already paid. Show refund-window copy.
  const isRefundWindow = isPaidPlan && !!subscription?.isTrial;

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

  // Only label as "Proefperiode" for pure free trials (no paid plan set).
  function getStatusLabel(): string {
    if (subscription?.isExpired) return t("subscription.status.expired");
    if (isCanceled && subscription?.isActive) return t("subscription.status.activeUntilEnd");
    if (subscription?.isTrial && !isPaidPlan) return t("subscription.status.trial");
    if (subscription?.isActive || (subscription?.isTrial && isPaidPlan)) return t("subscription.status.active");
    return t("subscription.status.expired");
  }

  function getStatusBadgeStyle(): CSSProperties {
    if (subscription?.isExpired) return { backgroundColor: "rgba(220,38,38,0.10)", color: "#DC2626" };
    if (isCanceled && subscription?.isActive) return { backgroundColor: "#f0ecff", color: "#4b4170" };
    // Pure free trial (no paid plan) → purple
    if (subscription?.isTrial && !isPaidPlan) return { backgroundColor: "#bbadfb", color: "#171429" };
    // Active or paid-plan-in-trial → green
    return { backgroundColor: "#85fb8c", color: "#223546" };
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
      <div className="min-h-screen" style={{ backgroundColor: "#f6f6f6" }}>
        <AppHeader title={t("subscription.title")} onBack={() => navigate("/account")} />
        <div className="max-w-lg mx-auto px-4 pt-4">
          <div
            className="bg-white rounded-[28px] p-6 animate-pulse space-y-5"
            style={{ border: "1px solid #ece7ef" }}
          >
            <div className="h-5 bg-ha-surface rounded w-1/4" />
            <div className="h-9 bg-ha-surface rounded w-2/3" />
            <div className="h-5 bg-ha-surface rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (!subscription?.isActive && !subscription?.isTrial) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "#f6f6f6" }} data-testid="page-subscription-detail">
        <AppHeader title={t("subscription.title")} onBack={() => navigate("/account")} />
        <div className="max-w-lg mx-auto px-4 pt-6 pb-12">
          <div
            className="bg-white rounded-[28px] p-7 flex flex-col items-center text-center"
            style={{ border: "1px solid #ece7ef", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}
          >
            <div
              className="w-[80px] h-[80px] rounded-full flex items-center justify-center mb-6"
              style={{ backgroundColor: "#bbadfb" }}
            >
              <Crown className="w-9 h-9" style={{ color: "#171429" }} strokeWidth={1.8} />
            </div>

            <p className="text-[26px] font-extrabold text-[#111111] mb-2 leading-tight" data-testid="text-no-sub-title">
              {t("subscription.noSubTitle")}
            </p>
            <p className="text-[17px] leading-relaxed mb-7 max-w-[280px]" style={{ color: "#444444" }}>
              {t("subscription.noSubDesc")}
            </p>

            <div className="w-full text-left flex flex-col gap-4 mb-8">
              {PREMIUM_FEATURES.map((feature, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className="w-[26px] h-[26px] rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: "#bbadfb" }}
                  >
                    <Check className="w-[14px] h-[14px]" style={{ color: "#171429" }} strokeWidth={3} />
                  </div>
                  <span className="text-[17px] font-medium text-[#111111]">{feature}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => navigate("/paywall")}
              className="w-full h-[58px] rounded-full font-bold text-[17px] transition-colors active:scale-[0.98]"
              style={{ backgroundColor: "#85fb8c", color: "#223546" }}
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
      // For paid plan (even in trial): show plan name. Only show "Proefperiode" for pure free trial.
      value: isPaidPlan ? getPlanLabel(subscription?.plan) : subscription?.isTrial ? t("subscription.status.trial") : getPlanLabel(subscription?.plan),
      testId: "text-plan-name",
    },
    ...(isPaidPlan ? [{
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
      label: isRefundWindow
        ? t("subscription.refundWindowEnds")
        : subscription?.isTrial
          ? t("subscription.trialEnds")
          : isCanceled
            ? t("subscription.endsAt")
            : t("subscription.nextRenewal"),
      value: formatDate(renewalDate, locale),
      testId: "text-renewal-date",
    }] : []),
    {
      label: t("subscription.autoRenew"),
      // autoRenew is ON for any active paid plan (including during the refund window where isTrial=true).
      // It is only OFF for: explicit cancellations, or pure free trials (no paid plan).
      value: !isCanceled && subscription?.isActive && (!subscription?.isTrial || isPaidPlan) ? t("subscription.on") : t("subscription.off"),
      testId: "text-auto-renew",
    },
    {
      label: t("subscription.paymentMethod"),
      value: t("subscription.viaStripe"),
      testId: "text-payment-method",
    },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f6f6f6" }} data-testid="page-subscription-detail">
      <AppHeader title={t("subscription.title")} onBack={() => navigate("/account")} />

      <div className="max-w-lg mx-auto px-4 pt-3 pb-12 flex flex-col gap-4">

        {/* ── Top membership card ── */}
        <div
          className="bg-white rounded-[28px] overflow-hidden"
          style={{ border: "1px solid #ece7ef", boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}
          data-testid="card-subscription-info"
        >
          {/* Hero block */}
          <div className="px-6 pt-7 pb-6">
            <Crown className="w-[30px] h-[30px] text-[#111111] mb-4" strokeWidth={1.8} />

            {/* Plan title — never shows "Proefperiode" if user has a paid plan */}
            <p className="text-[34px] font-extrabold text-[#111111] leading-tight" data-testid="text-plan-summary">
              {isPaidPlan ? getPlanLabel(subscription?.plan) : subscription?.isTrial ? t("subscription.status.trial") : getPlanLabel(subscription?.plan)}
            </p>

            <div className="mt-3 flex items-center gap-2">
              <span
                className="inline-flex items-center gap-[7px] text-[15px] font-bold px-3.5 py-[7px] rounded-[8px]"
                style={getStatusBadgeStyle()}
                data-testid="badge-subscription-status"
              >
                {(subscription?.isActive || (subscription?.isTrial && isPaidPlan)) && !subscription?.isExpired && (
                  <span className="w-[6px] h-[6px] rounded-full bg-current opacity-90 flex-shrink-0" />
                )}
                {getStatusLabel()}
              </span>
            </div>

            {renewalDate && !subscription?.isExpired && (
              <p className="text-[18px] font-semibold text-[#111111] mt-4" data-testid="text-renewal-hero">
                {isCanceled
                  ? `${t("subscription.endsAt")} ${formatDate(renewalDate, locale)}`
                  : isRefundWindow
                    ? `${t("subscription.refundWindowEnds")} ${formatDate(renewalDate, locale)}`
                    : subscription?.isTrial
                      ? `${t("subscription.trialEnds")} ${formatDate(renewalDate, locale)}`
                      : `${t("subscription.nextRenewal")} ${formatDate(renewalDate, locale)}`}
              </p>
            )}

            {(subscription?.isActive || (subscription?.isTrial && isPaidPlan)) && !subscription?.isExpired && (
              <div className="flex items-center gap-2 mt-4">
                <CheckCircle2 className="w-[18px] h-[18px] flex-shrink-0" style={{ color: "#16a34a" }} strokeWidth={2} />
                <p className="text-[16px] font-normal text-[#111111]">
                  {t("subscription.matchesNowActive")}
                </p>
              </div>
            )}
          </div>

          <div className="h-px mx-6" style={{ backgroundColor: "#ece7ef" }} />

          <div className="px-6 pb-2">
            {rows.map((row, idx) => (
              <div
                key={row.testId}
                className={`flex items-center justify-between py-[17px] ${idx < rows.length - 1 ? "border-b" : ""}`}
                style={{ borderColor: "#ece7ef" }}
              >
                <p className="text-[17px] font-normal" style={{ color: "#555555" }}>{row.label}</p>
                <p className="text-[17px] font-bold text-[#111111] text-right max-w-[55%]" data-testid={row.testId}>{row.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Management actions ── */}
        <div
          className="bg-white rounded-[28px] overflow-hidden"
          style={{ border: "1px solid #ece7ef", boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}
          data-testid="card-subscription-actions"
        >
          <button
            onClick={() => navigate("/account/payment-method")}
            className="w-full flex items-center gap-4 px-6 py-[18px] text-left transition-colors active:opacity-70"
            data-testid="button-manage-payment"
          >
            <CreditCard className="w-[24px] h-[24px] text-[#111111] flex-shrink-0" strokeWidth={1.8} />
            <div className="flex-1 min-w-0">
              <p className="text-[17px] font-bold text-[#111111] leading-snug">
                {t("subscription.managePayment")}
              </p>
              <p className="text-[14px] font-normal mt-[3px]" style={{ color: "#666666" }}>
                {t("subscription.updatePaymentDesc")}
              </p>
            </div>
            <ChevronRight className="w-[20px] h-[20px] flex-shrink-0" style={{ color: "#6b6677" }} />
          </button>

          {!isCanceled && (
            <>
              <div className="h-px mx-6" style={{ backgroundColor: "#ece7ef" }} />
              <button
                onClick={() => navigate("/account/subscription/cancel")}
                className="w-full flex items-center gap-4 px-6 py-[16px] text-left active:bg-ha-danger/5 transition-colors"
                data-testid="button-cancel-subscription"
              >
                <XCircle className="w-[22px] h-[22px] text-ha-danger flex-shrink-0" strokeWidth={1.8} />
                <p className="text-[16px] font-semibold text-ha-danger flex-1">
                  {t("subscription.cancelSubscription")}
                </p>
                <ChevronRight className="w-[18px] h-[18px] text-ha-danger opacity-40 flex-shrink-0" />
              </button>
            </>
          )}
        </div>

        {/* ── Expired CTA ── */}
        {subscription?.isExpired && (
          <div
            className="bg-white rounded-[28px] p-6"
            style={{ border: "1px solid #ece7ef", boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}
            data-testid="card-expired-cta"
          >
            <div className="flex items-start gap-3 mb-5">
              <AlertCircle className="w-[24px] h-[24px] text-[#111111] flex-shrink-0 mt-0.5" strokeWidth={1.8} />
              <div>
                <p className="text-[18px] font-bold text-[#111111]">{t("subscription.expiredTitle")}</p>
                <p className="text-[15px] font-normal mt-1" style={{ color: "#666666" }}>{t("subscription.expiredDesc")}</p>
              </div>
            </div>
            <button
              onClick={() => navigate("/paywall")}
              className="w-full h-[56px] rounded-full font-bold text-[17px] transition-colors active:scale-[0.98]"
              style={{ backgroundColor: "#85fb8c", color: "#223546" }}
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
