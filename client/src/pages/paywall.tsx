import { apiFetch } from "@/lib/api-base";
import { useHashSearch } from "@/lib/hash-search";
import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Check, Crown, Loader2 } from "lucide-react";
import { HousAlertLogo } from "@/components/housalert-logo";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "@/i18n";
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

const FEATURE_KEYS = [
  "paywall.features.profiles",
  "paywall.features.emailAlerts",
  "paywall.features.pushAlerts",
  "paywall.features.firstAccess",
];

export default function PaywallPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const searchString = useHashSearch();
  const queryParams = new URLSearchParams(searchString);
  const planFromUrl = queryParams.get("plan");
  const autoCheckout = queryParams.get("autoCheckout") === "true";

  const [selectedPlan, setSelectedPlan] = useState(
    planFromUrl && PLANS.some((p) => p.id === planFromUrl) ? planFromUrl : "two_month"
  );
  const [loading, setLoading] = useState(false);
  const autoCheckoutTriggered = useRef(false);

  useEffect(() => {
    trackEventLazy("pricing_viewed");
  }, []);

  useEffect(() => {
    if (autoCheckout && user && !authLoading && !autoCheckoutTriggered.current) {
      autoCheckoutTriggered.current = true;
      handleCheckout();
    }
  }, [autoCheckout, user, authLoading]);

  async function handleCheckout() {
    if (!user) {
      navigate(`/signup?plan=${selectedPlan}`);
      return;
    }

    setLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        toast({ title: t("paywall.notLoggedIn"), description: t("paywall.loginAgain"), variant: "destructive" });
        navigate("/login");
        return;
      }

      trackEvent("checkout_started", { plan: selectedPlan });

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
    } catch (err: any) {
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
    <div className="min-h-screen bg-[#1A1A2E] flex flex-col">
      <header className="w-full bg-[#1A1A2E] sticky top-0 z-20 border-b border-[#353560]">
        <div className="max-w-xl mx-auto px-6 h-[60px] flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="w-9 h-9 rounded-full bg-[#252547] flex items-center justify-center active:scale-95 transition-transform"
            data-testid="button-paywall-back"
          >
            <ArrowLeft className="w-4 h-4 text-[#9CA3AF]" />
          </button>
          <HousAlertLogo size={28} />
        </div>
      </header>

      <main className="flex-1 max-w-xl mx-auto w-full px-6 pt-10 pb-32">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#E91E63]/10 flex items-center justify-center mx-auto mb-4">
            <Crown className="w-7 h-7 text-[#E91E63]" />
          </div>
          <h1 className="text-[32px] font-medium text-white tracking-[-0.03em] leading-[1.1] mb-3" data-testid="text-paywall-title">
            {t("paywall.title")}
          </h1>
          <p className="text-[15px] text-[#9CA3AF]">
            {t("paywall.trialInfo")}
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {PLANS.map((plan) => (
            <button
              key={plan.id}
              onClick={() => setSelectedPlan(plan.id)}
              className={`w-full p-6 rounded-[24px] border-2 transition-all text-left relative bg-[#252547] ${
                selectedPlan === plan.id
                  ? "border-[#E91E63]"
                  : "border-[#353560] hover:border-[#4A4A70]"
              }`}
              data-testid={`card-plan-${plan.id}`}
            >
              {plan.popular && (
                <span
                  className="absolute -top-3 left-5 px-3 py-0.5 bg-[#E91E63] text-white text-xs font-medium rounded-full"
                  data-testid="badge-popular"
                >
                  {t("paywall.mostChosen")}
                </span>
              )}

              <div className="flex items-center justify-between gap-4 pr-8">
                <div>
                  <p className="text-[18px] font-medium text-white">{t(plan.nameKey)}</p>
                  <p className="text-[15px] text-[#9CA3AF]">{t(plan.pricePerMonthKey)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-medium text-white">{t(plan.priceKey)}</p>
                  {plan.savingsKey && (
                    <p className="text-xs font-medium text-[#E91E63]">{t(plan.savingsKey)}</p>
                  )}
                </div>
              </div>

              <div
                className={`absolute top-6 right-6 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                  selectedPlan === plan.id
                    ? "bg-[#E91E63] border-[#E91E63]"
                    : "border-[#6B7280]"
                }`}
              >
                {selectedPlan === plan.id && <Check className="w-3.5 h-3.5 text-white" />}
              </div>
            </button>
          ))}
        </div>

        <div className="bg-[#252547] rounded-[24px] border border-[#353560] p-6">
          <p className="text-[16px] font-medium text-white mb-3">{t("paywall.featuresTitle")}</p>
          <div className="space-y-2.5">
            {FEATURE_KEYS.map((key, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-[#00C896]/15 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-[#00C896]" />
                </div>
                <span className="text-[15px] text-[#9CA3AF]">{t(key)}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-[#1A1A2E] border-t border-[#353560] p-5 z-10">
        <div className="max-w-xl mx-auto">
          <Button
            size="lg"
            className="w-full h-[56px] rounded-full text-[16px] font-medium shadow-none bg-[#E91E63] hover:bg-[#D81B60] text-white"
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
              t("paywall.startTrial")
            )}
          </Button>
          <p className="text-center text-[13px] text-[#6B7280] mt-3">
            {t("paywall.trialFooter")}
          </p>
        </div>
      </div>
    </div>
  );
}
