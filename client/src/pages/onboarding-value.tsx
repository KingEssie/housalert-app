import { apiFetch } from "@/lib/api-base";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { X, Check, Clock, Search, Eye, Shield, Loader2 } from "lucide-react";
import { HousAlertLogo } from "@/components/housalert-logo";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "@/i18n";
import { useEmbedded } from "@/hooks/use-embedded";
import { useHashSearch } from "@/lib/hash-search";
import { trackEvent, trackEventLazy } from "@/lib/track-event";

interface Plan {
  id: string;
  nameKey: string;
  priceKey: string;
  pricePerMonthKey: string;
  popular: boolean;
  savingsKey?: string;
}

const PLANS: Plan[] = [
  {
    id: "monthly",
    nameKey: "paywall.plans.monthly",
    priceKey: "paywall.prices.monthly",
    pricePerMonthKey: "paywall.pricePerMonth.monthly",
    popular: false,
  },
  {
    id: "two_month",
    nameKey: "paywall.plans.twoMonth",
    priceKey: "paywall.prices.twoMonth",
    pricePerMonthKey: "paywall.pricePerMonth.twoMonth",
    popular: true,
    savingsKey: "paywall.save17",
  },
  {
    id: "three_month",
    nameKey: "paywall.plans.threeMonth",
    priceKey: "paywall.prices.threeMonth",
    pricePerMonthKey: "paywall.pricePerMonth.threeMonth",
    popular: false,
    savingsKey: "paywall.save33",
  },
];

const WITHOUT_ITEMS = [
  "valueStep.without.hours",
  "valueStep.without.tooLate",
  "valueStep.without.noResponse",
  "valueStep.without.missSmall",
];

const WITH_ITEMS = [
  "valueStep.with.autoAlerts",
  "valueStep.with.beFirst",
  "valueStep.with.moreViewings",
  "valueStep.with.allSites",
];

const EXPLANATIONS = [
  { icon: Clock, key: "saveTime" },
  { icon: Search, key: "findMore" },
  { icon: Eye, key: "moreViewings" },
];

export default function OnboardingValuePage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useTranslation();
  const { isEmbedded, containerClass } = useEmbedded();
  const searchString = useHashSearch();

  const [selectedPlan, setSelectedPlan] = useState("two_month");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    trackEventLazy("pricing_viewed");
  }, []);

  async function handleCheckout() {
    setLoading(true);
    trackEvent("checkout_started", { plan: selectedPlan });
    try {
      if (isEmbedded) {
        const sp = new URLSearchParams(searchString);
        const funnel: Record<string, string> = {};
        sp.forEach((v, k) => { funnel[k] = v; });
        localStorage.setItem("housalert_embed_funnel", JSON.stringify(funnel));

        const res = await apiFetch("/api/checkout/session-guest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: selectedPlan }),
        });

        const data = await res.json();

        if (data.error) {
          toast({
            title: t("paywall.paymentFailed"),
            description: data.message || data.error || t("paywall.tryAgainLater"),
            variant: "destructive",
          });
          return;
        }

        if (data.url) {
          window.location.href = data.url;
        } else {
          toast({
            title: t("paywall.paymentUnavailable"),
            description: t("paywall.noCheckoutUrl"),
            variant: "destructive",
          });
        }
        return;
      }

      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        setLoading(false);
        navigate(`/login?returnTo=${encodeURIComponent("/onboarding/value")}`);
        return;
      }

      const res = await apiFetch("/api/checkout/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan: selectedPlan }),
      });

      const data = await res.json();

      if (data.error) {
        toast({
          title: t("paywall.paymentFailed"),
          description: data.message || data.error || t("paywall.tryAgainLater"),
          variant: "destructive",
        });
        return;
      }

      if (data.url) {
        if ((window as any).ReactNativeWebView) {
          (window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: "OPEN_EXTERNAL_URL", url: data.url }));
        } else {
          window.location.href = data.url;
        }
      } else {
        toast({
          title: t("paywall.paymentUnavailable"),
          description: t("paywall.noCheckoutUrl"),
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: t("paywall.somethingWentWrong"),
        description: t("paywall.tryAgainLater"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-ha-bg flex flex-col">
      {!isEmbedded && (
        <header className="w-full bg-ha-bg sticky top-0 z-20 border-b border-ha-card-border">
          <div className={`${containerClass} mx-auto px-5 h-[56px] flex items-center gap-3`}>
            <HousAlertLogo size={28} />
          </div>
        </header>
      )}

      <main className={`flex-1 ${containerClass} mx-auto w-full px-5 pb-32`}>
        <div className="pt-8 pb-6 text-center">
          <h1
            className="text-[24px] font-medium text-ha-text leading-[1.15] tracking-[-0.02em]"
            data-testid="text-value-title"
          >
            {t("valueStep.heroTitle")}
          </h1>
        </div>

        <div className="mb-6">
          <div className="bg-ha-danger/10 rounded-2xl p-5">
            <p className="text-[15px] font-medium text-ha-danger mb-3" data-testid="text-without-title">
              {t("valueStep.withoutTitle")}
            </p>
            <div className="space-y-2.5">
              {WITHOUT_ITEMS.map((key, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-ha-danger/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <X className="w-3 h-3 text-ha-danger" />
                  </div>
                  <span className="text-[14px] text-[#FCA5A5] leading-[1.4]">{t(key)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-8">
          <div className="bg-ha-success-light rounded-2xl p-5">
            <p className="text-[15px] font-medium text-ha-success mb-3" data-testid="text-with-title">
              {t("valueStep.withTitle")}
            </p>
            <div className="space-y-2.5">
              {WITH_ITEMS.map((key, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-ha-success/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-ha-success" />
                  </div>
                  <span className="text-[14px] text-[#6EE7B7] leading-[1.4]">{t(key)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4 mb-10">
          {EXPLANATIONS.map(({ icon: Icon, key }) => (
            <div
              key={key}
              className="bg-ha-card rounded-2xl p-5 flex items-start gap-4"
              data-testid={`card-explain-${key}`}
            >
              <div className="w-10 h-10 rounded-xl bg-ha-surface flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-ha-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium text-ha-text mb-0.5">
                  {t(`valueStep.explain.${key}.title`)}
                </p>
                <p className="text-[13px] text-ha-text-secondary leading-[1.5]">
                  {t(`valueStep.explain.${key}.desc`)}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-ha-card-border pt-8 mb-6">
          <h2
            className="text-[22px] font-medium text-ha-text text-center mb-1"
            data-testid="text-plans-title"
          >
            {t("valueStep.plansTitle")}
          </h2>
          <p className="text-[14px] text-ha-text-secondary text-center mb-5">
            {t("valueStep.plansSubtitle")}
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {PLANS.map((plan) => (
            <button
              key={plan.id}
              onClick={() => setSelectedPlan(plan.id)}
              className={`w-full p-4 rounded-2xl border-2 transition-all text-left relative bg-ha-card ${
                selectedPlan === plan.id
                  ? "border-ha-primary shadow-[0_0_0_1px_rgb(var(--ha-primary))]"
                  : "border-ha-card-border hover:border-ha-text-muted"
              }`}
              data-testid={`card-plan-${plan.id}`}
            >
              {plan.popular && (
                <span
                  className="absolute -top-2.5 left-4 px-2.5 py-0.5 bg-ha-primary text-white text-[11px] font-medium rounded-full"
                  data-testid="badge-popular"
                >
                  {t("paywall.mostChosen")}
                </span>
              )}

              <div className="flex items-center justify-between gap-3 pr-8">
                <div>
                  <p className="text-[16px] font-medium text-ha-text">{t(plan.nameKey)}</p>
                  <p className="text-[13px] text-ha-text-secondary">{t(plan.pricePerMonthKey)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[18px] font-medium text-ha-text">{t(plan.priceKey)}</p>
                  {plan.savingsKey && (
                    <p className="text-[12px] font-medium text-ha-primary">{t(plan.savingsKey)}</p>
                  )}
                </div>
              </div>

              <div
                className={`absolute top-4 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                  selectedPlan === plan.id
                    ? "bg-ha-primary border-ha-primary"
                    : "border-white-muted"
                }`}
              >
                {selectedPlan === plan.id && <Check className="w-3 h-3 text-ha-text" />}
              </div>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-center gap-2 text-[13px] text-ha-text-secondary mb-4">
          <Shield className="w-4 h-4" />
          <span>{t("valueStep.trustBadge")}</span>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-ha-bg border-t border-ha-card-border p-4 z-10">
        <div className={`${containerClass} mx-auto`}>
          <Button
            className="w-full h-[48px] rounded-full text-[15px] font-medium shadow-none bg-ha-primary hover:bg-ha-primary-hover text-white"
            onClick={handleCheckout}
            disabled={loading}
            data-testid="button-select-payment"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                {t("paywall.pleaseWait")}
              </>
            ) : (
              t("valueStep.cta")
            )}
          </Button>
          <p className="text-center text-[12px] text-ha-text-muted mt-2">
            {t("paywall.trialFooter")}
          </p>
        </div>
      </div>
    </div>
  );
}
