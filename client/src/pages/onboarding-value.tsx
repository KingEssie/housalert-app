import { apiFetch } from "@/lib/api-base";
import { useState } from "react";
import { useLocation } from "wouter";
import { Home, X, Check, Clock, Search, Eye, Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "@/i18n";

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

  const [selectedPlan, setSelectedPlan] = useState("two_month");
  const [loading, setLoading] = useState(false);

  async function handleCheckout() {
    setLoading(true);
    try {
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
    <div className="min-h-screen bg-white flex flex-col">
      <header className="w-full bg-white sticky top-0 z-20 border-b border-[#E5E7EB]">
        <div className="max-w-xl mx-auto px-5 h-[56px] flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#0D6EFD] flex items-center justify-center">
              <Home className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-[#111C3D] text-[15px]">HousAlert</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-xl mx-auto w-full px-5 pb-32">
        <div className="pt-8 pb-6 text-center">
          <h1
            className="text-[24px] font-[800] text-[#111C3D] leading-[1.15] tracking-[-0.02em]"
            data-testid="text-value-title"
          >
            {t("valueStep.heroTitle")}
          </h1>
        </div>

        <div className="mb-6">
          <div className="bg-[#FFF7ED] rounded-2xl p-5">
            <p className="text-[15px] font-[700] text-[#9A3412] mb-3" data-testid="text-without-title">
              {t("valueStep.withoutTitle")}
            </p>
            <div className="space-y-2.5">
              {WITHOUT_ITEMS.map((key, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-[#FED7AA] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <X className="w-3 h-3 text-[#C2410C]" />
                  </div>
                  <span className="text-[14px] text-[#7C2D12] leading-[1.4]">{t(key)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-8">
          <div className="bg-[#F0FDF4] rounded-2xl p-5">
            <p className="text-[15px] font-[700] text-[#166534] mb-3" data-testid="text-with-title">
              {t("valueStep.withTitle")}
            </p>
            <div className="space-y-2.5">
              {WITH_ITEMS.map((key, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-[#BBF7D0] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-[#16A34A]" />
                  </div>
                  <span className="text-[14px] text-[#14532D] leading-[1.4]">{t(key)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4 mb-10">
          {EXPLANATIONS.map(({ icon: Icon, key }) => (
            <div
              key={key}
              className="bg-[#F5F7FA] rounded-2xl p-5 flex items-start gap-4"
              data-testid={`card-explain-${key}`}
            >
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center flex-shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                <Icon className="w-5 h-5 text-[#0D6EFD]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-[700] text-[#111C3D] mb-0.5">
                  {t(`valueStep.explain.${key}.title`)}
                </p>
                <p className="text-[13px] text-[#6B7280] leading-[1.5]">
                  {t(`valueStep.explain.${key}.desc`)}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-[#E5E7EB] pt-8 mb-6">
          <h2
            className="text-[22px] font-[800] text-[#111C3D] text-center mb-1"
            data-testid="text-plans-title"
          >
            {t("valueStep.plansTitle")}
          </h2>
          <p className="text-[14px] text-[#6B7280] text-center mb-5">
            {t("valueStep.plansSubtitle")}
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {PLANS.map((plan) => (
            <button
              key={plan.id}
              onClick={() => setSelectedPlan(plan.id)}
              className={`w-full p-4 rounded-2xl border-2 transition-all text-left relative bg-white ${
                selectedPlan === plan.id
                  ? "border-[#0D6EFD] shadow-[0_0_0_1px_#0D6EFD]"
                  : "border-[#E5E7EB] hover:border-[#D1D5DB]"
              }`}
              data-testid={`card-plan-${plan.id}`}
            >
              {plan.popular && (
                <span
                  className="absolute -top-2.5 left-4 px-2.5 py-0.5 bg-[#0D6EFD] text-white text-[11px] font-bold rounded-full"
                  data-testid="badge-popular"
                >
                  {t("paywall.mostChosen")}
                </span>
              )}

              <div className="flex items-center justify-between gap-3 pr-8">
                <div>
                  <p className="text-[16px] font-[700] text-[#111C3D]">{t(plan.nameKey)}</p>
                  <p className="text-[13px] text-[#6B7280]">{t(plan.pricePerMonthKey)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[18px] font-[800] text-[#111C3D]">{t(plan.priceKey)}</p>
                  {plan.savingsKey && (
                    <p className="text-[12px] font-semibold text-[#0D6EFD]">{t(plan.savingsKey)}</p>
                  )}
                </div>
              </div>

              <div
                className={`absolute top-4 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                  selectedPlan === plan.id
                    ? "bg-[#0D6EFD] border-[#0D6EFD]"
                    : "border-[#D1D5DB]"
                }`}
              >
                {selectedPlan === plan.id && <Check className="w-3 h-3 text-white" />}
              </div>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-center gap-2 text-[13px] text-[#6B7280] mb-4">
          <Shield className="w-4 h-4" />
          <span>{t("valueStep.trustBadge")}</span>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] p-4 z-10">
        <div className="max-w-xl mx-auto">
          <Button
            className="w-full h-[48px] rounded-full text-[15px] font-bold shadow-none bg-[#0D6EFD] hover:bg-[#0B5ED7]"
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
          <p className="text-center text-[12px] text-[#9CA3AF] mt-2">
            {t("paywall.trialFooter")}
          </p>
        </div>
      </div>
    </div>
  );
}
