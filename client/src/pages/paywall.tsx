import { apiFetch } from "@/lib/api-base";
import { useHashSearch } from "@/lib/hash-search";
import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { isNativePlatform } from "@/lib/capacitor";
import { ArrowLeft, Check, Loader2, X, ShieldAlert, MapPin, CircleArrowRight } from "lucide-react";
import { HousAlertLogo } from "@/components/housalert-logo";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "@/i18n";
import { trackEvent, trackEventLazy } from "@/lib/track-event";
import { OBW, OBWebHeader, OBWebFooter, OBInfoBox } from "@/components/onboarding-ui";

const BRAND = "rgb(var(--ha-primary))";
const TEXT_PRIMARY = "rgb(var(--ha-text))";
const TEXT_SECONDARY = "rgb(var(--ha-text-secondary))";

interface Plan {
  id: string;
  label: string;
  price: string;
  perMonth: string;
  popular: boolean;
  discountLabel?: string;
  discountColor?: string;
  discountBgColor?: string;
}

function getPlans(t: (k: string) => string): Plan[] {
  return [
    {
      id: "three_month",
      label: t("paywall.plans.threeMonth"),
      price: "€44,99",
      perMonth: "€15,00 " + t("paywall.perMonth"),
      popular: false,
      discountLabel: "-40%",
      discountColor: "rgb(var(--ha-success))",
      discountBgColor: "var(--ha-success-light)",
    },
    {
      id: "two_month",
      label: t("paywall.plans.twoMonth"),
      price: "€34,99",
      perMonth: "€17,50 " + t("paywall.perMonth"),
      popular: true,
      discountLabel: "-30%",
      discountColor: "rgb(var(--ha-primary))",
      discountBgColor: "var(--ha-primary-light)",
    },
    {
      id: "monthly",
      label: t("paywall.plans.monthly"),
      price: "€24,99",
      perMonth: "€24,99 " + t("paywall.perMonth"),
      popular: false,
      discountLabel: "0%",
      discountColor: "rgb(var(--ha-text-secondary))",
      discountBgColor: "rgb(var(--ha-text-secondary) / 0.10)",
    },
  ];
}

const BENEFIT_KEYS = [
  { titleKey: "paywall.benefits.speed.title", descKey: "paywall.benefits.speed.desc" },
  { titleKey: "paywall.benefits.sources.title", descKey: "paywall.benefits.sources.desc" },
  { titleKey: "paywall.benefits.letter.title", descKey: "paywall.benefits.letter.desc" },
];

interface WebsitePlan {
  id: string;
  label: string;
  perMonth: string;
  discount: string;
  popular: boolean;
}


function WebsitePaywall({
  selectedPlan,
  setSelectedPlan,
  loading,
  handleCheckout,
  onSkip,
  queryParams,
}: {
  selectedPlan: string;
  setSelectedPlan: (id: string) => void;
  loading: boolean;
  handleCheckout: () => void;
  onSkip: () => void;
  queryParams: URLSearchParams;
}) {
  const { t } = useTranslation();
  const city = queryParams.get("city") || "";
  const maxPrice = queryParams.get("maxPrice") || "";
  const minRooms = queryParams.get("minRooms") || "";
  const radiusKm = queryParams.get("radiusKm") || "";
  const roomsLabel = (!minRooms || minRooms === "0") ? "Studio+" : `${minRooms}+`;

  const WEBSITE_PLANS: WebsitePlan[] = [
    { id: "three_month", label: t("paywall.website.plans.threeMonth.label"), perMonth: t("paywall.website.plans.threeMonth.perMonth"), discount: t("paywall.website.plans.threeMonth.discount"), popular: false },
    { id: "two_month", label: t("paywall.website.plans.twoMonth.label"), perMonth: t("paywall.website.plans.twoMonth.perMonth"), discount: t("paywall.website.plans.twoMonth.discount"), popular: true },
    { id: "monthly", label: t("paywall.website.plans.monthly.label"), perMonth: t("paywall.website.plans.monthly.perMonth"), discount: t("paywall.website.plans.monthly.discount"), popular: false },
  ];

  return (
    <div
      className="min-h-[100dvh] flex flex-col"
      style={{ background: "rgb(var(--ha-bg))" }}
      data-testid="screen-paywall-website"
    >
      <OBWebHeader />

      <main className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-5 pt-6 pb-10 overflow-y-auto">
        <h2
          className="text-[30px] font-black tracking-[-0.025em] mb-1"
          style={{ color: OBW.text }}
          data-testid="text-paywall-title"
        >
          {t("paywall.website.title")}
        </h2>
        <p className="text-[13px] mb-5 leading-relaxed" style={{ color: OBW.textSecondary }}>
          {t("paywall.website.subtitle")}
        </p>

        {city && (
          <div
            className="rounded-[4px] p-3.5 mb-5 flex items-start gap-3"
            style={{
              backgroundColor: "rgb(var(--ha-surface))",
              border: "1px solid rgba(187,173,251,0.25)",
            }}
            data-testid="search-summary-card"
          >
            <MapPin className="w-4 h-4 shrink-0 mt-0.5" style={{ color: OBW.primary }} />
            <div className="min-w-0">
              <p className="text-[14px] font-semibold" style={{ color: OBW.text }}>
                {city}{radiusKm && radiusKm !== "0" ? ` · ${radiusKm} km` : ""}
              </p>
              <p className="text-[12px]" style={{ color: OBW.textSecondary }}>
                max €{maxPrice} · {roomsLabel} {t("paywall.website.rooms")}
              </p>
            </div>
          </div>
        )}

        <p
          className="text-[16px] font-semibold mb-3"
          style={{ color: OBW.text }}
        >
          {t("paywall.website.selectPeriod")}
        </p>

        <div
          className="rounded-[10px] overflow-hidden mb-4"
          style={{ border: `1px solid ${OBW.cardBorder}` }}
          data-testid="plan-options"
        >
          {WEBSITE_PLANS.map((plan, i) => {
            const isSelected = selectedPlan === plan.id;
            const isLast = i === WEBSITE_PLANS.length - 1;
            return (
              <div key={plan.id} className="relative">
                {plan.popular && (
                  <div
                    className="flex justify-center"
                    style={{ marginBottom: "-11px", position: "relative", zIndex: 2 }}
                  >
                    <span
                      className="text-[11px] font-semibold px-3.5 py-[3px] rounded-full"
                      style={{ backgroundColor: "#bbadfb", color: "#111111" }}
                      data-testid="badge-popular"
                    >
                      {t("paywall.website.mostChosen")}
                    </span>
                  </div>
                )}
                <button
                  onClick={() => setSelectedPlan(plan.id)}
                  className="w-full text-left transition-colors"
                  style={{
                    borderBottom: !isLast ? `1px solid ${OBW.cardBorder}` : "none",
                    backgroundColor: isSelected ? "rgba(187,173,251,0.12)" : "rgb(var(--ha-card))",
                    padding: plan.popular ? "20px 16px 16px 16px" : "16px 16px",
                  }}
                  data-testid={`card-plan-${plan.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0"
                        style={{
                          border: isSelected ? "none" : `1.5px solid ${OBW.chipBorder}`,
                          backgroundColor: isSelected ? "#bbadfb" : "transparent",
                        }}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" style={{ color: "#111111" }} />}
                      </div>
                      <span
                        className="text-[15px] font-semibold"
                        style={{ color: OBW.text }}
                      >
                        {plan.label}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-[13px]" style={{ color: OBW.textSecondary }}>
                        {plan.perMonth}
                      </span>
                      {plan.discount && (
                        <span
                          className="text-[13px] font-semibold"
                          style={{ color: "#bbadfb" }}
                        >
                          {plan.discount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </div>
            );
          })}
        </div>

        <button
          onClick={handleCheckout}
          disabled={loading}
          className="w-full h-[52px] text-[15px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-2.5"
          style={{
            background: "rgb(var(--ha-primary))",
            boxShadow: "0 4px 14px rgb(var(--ha-primary) / 0.25)",
            borderRadius: "9999px",
            color: "#111111",
          }}
          data-testid="button-select-payment"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              {t("paywall.selectPlan")}
              <CircleArrowRight className="w-[18px] h-[18px]" />
            </>
          )}
        </button>

        <button
          onClick={onSkip}
          className="w-full h-[44px] text-[14px] font-medium mt-2 mb-4 transition-colors flex items-center justify-center"
          style={{ color: OBW.textSecondary, borderRadius: "9999px" }}
          data-testid="button-skip-subscription"
        >
          {t("paywall.skipFree")}
        </button>

        <div className="flex flex-col gap-3 mb-6">
          <div className="flex items-start gap-2.5">
            <div
              className="w-[20px] h-[20px] rounded-full flex items-center justify-center shrink-0 mt-[1px]"
              style={{ backgroundColor: "#bbadfb" }}
            >
              <Check className="w-3 h-3" style={{ color: "#111111" }} />
            </div>
            <p className="text-[13px] leading-[1.5]" style={{ color: OBW.text }}>
              <strong>{t("paywall.website.benefit1Bold")}</strong>{t("paywall.website.benefit1Rest")}
            </p>
          </div>
          <div className="flex items-start gap-2.5">
            <div
              className="w-[20px] h-[20px] rounded-full flex items-center justify-center shrink-0 mt-[1px]"
              style={{ backgroundColor: "#bbadfb" }}
            >
              <Check className="w-3 h-3" style={{ color: "#111111" }} />
            </div>
            <p className="text-[13px] leading-[1.5]" style={{ color: OBW.text }}>
              <strong>{t("paywall.website.benefit2Bold")}</strong>{t("paywall.website.benefit2Rest")}
            </p>
          </div>
          <div className="flex items-start gap-2.5">
            <div
              className="w-[20px] h-[20px] rounded-full flex items-center justify-center shrink-0 mt-[1px]"
              style={{ backgroundColor: "#bbadfb" }}
            >
              <Check className="w-3 h-3" style={{ color: "#111111" }} />
            </div>
            <p className="text-[13px] leading-[1.5]" style={{ color: OBW.text }}>
              {t("paywall.website.benefit3Pre")}<strong>{t("paywall.website.benefit3Weeks")}</strong>{t("paywall.website.benefit3Post")}
            </p>
          </div>
        </div>

        <div
          className="rounded-[10px] p-4"
          style={{ backgroundColor: "rgb(var(--ha-surface))" }}
        >
          <p className="text-[15px] font-semibold mb-1" style={{ color: "rgb(var(--ha-text))" }}>
            {t("paywall.website.guaranteeTitle")}
          </p>
          <p className="text-[13px] leading-[1.55]" style={{ color: "rgb(var(--ha-text-secondary))" }}>
            {t("paywall.website.guaranteeBody")}
          </p>
        </div>
      </main>
    </div>
  );
}

export default function PaywallPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const searchString = useHashSearch();
  const queryParams = new URLSearchParams(searchString);
  const planFromUrl = queryParams.get("plan");
  const autoCheckout = queryParams.get("autoCheckout") === "true";
  const isWebsiteMode = queryParams.get("source") === "website" || queryParams.get("theme") === "light";

  const plans = getPlans(t);
  const validPlanIds = plans.map((p) => p.id);

  const [selectedPlan, setSelectedPlan] = useState(
    planFromUrl && validPlanIds.includes(planFromUrl) ? planFromUrl : "two_month"
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
      navigate(`/welcome`);
      return;
    }

    // Native app subscriptions are handled via Google Play / App Store.
    if (isNativePlatform()) {
      toast({
        title: "Binnenkort beschikbaar",
        description: "Abonnementen in de app komen binnenkort beschikbaar.",
      });
      return;
    }

    setLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        toast({ title: t("paywall.notLoggedIn"), description: t("paywall.loginAgain"), variant: "destructive" });
        navigate("/");
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
        console.log("[paywall] Opening checkout session_id:", data.session_id?.substring(0, 20));
        window.location.href = data.url;
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

  function handleSkip() {
    navigate("/dashboard");
  }

  if (isWebsiteMode) {
    return (
      <WebsitePaywall
        selectedPlan={selectedPlan}
        setSelectedPlan={setSelectedPlan}
        loading={loading}
        handleCheckout={handleCheckout}
        onSkip={handleSkip}
        queryParams={queryParams}
      />
    );
  }

  return (
    <div className="min-h-screen bg-ha-bg flex flex-col">
      <header className="w-full bg-ha-bg sticky top-0 z-20 border-b border-ha-card-border" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="max-w-xl mx-auto px-6 h-[60px] flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="w-10 h-10 rounded-full bg-ha-card-border hover:bg-ha-border-input active:bg-ha-border-input flex items-center justify-center transition-colors"
            data-testid="button-paywall-back"
          >
            <ArrowLeft className="w-5 h-5 text-ha-text-secondary" />
          </button>
          <HousAlertLogo size={28} />
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-[12px] font-medium" style={{ color: TEXT_SECONDARY }}>
              4,6 {t("paywall.outOf")} 5 ★
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-xl mx-auto w-full px-6 pt-8 pb-32">
        <h1 className="text-[28px] font-black tracking-[-0.03em] leading-[1.1] mb-6" style={{ color: TEXT_PRIMARY }} data-testid="text-paywall-title">
          {t("paywall.headline")}
        </h1>

        <div className="space-y-4 mb-8">
          {BENEFIT_KEYS.map((b, i) => (
            <div key={i} className="flex items-start gap-3" data-testid={`paywall-benefit-${i}`}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: "#bbadfb" }}>
                <Check className="w-3.5 h-3.5" style={{ color: "#111111" }} />
              </div>
              <div>
                <p className="text-[15px] font-semibold" style={{ color: TEXT_PRIMARY }}>{t(b.titleKey)}</p>
                <p className="text-[13px] mt-0.5" style={{ color: TEXT_SECONDARY }}>{t(b.descKey)}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3 mb-6">
          {plans.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            return (
              <button
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className="w-full text-left transition-all active:scale-[0.99] relative"
                style={{
                  border: isSelected ? "2px solid #bbadfb" : "2px solid rgba(17,17,17,0.10)",
                  backgroundColor: isSelected ? "rgba(187,173,251,0.10)" : "white",
                  borderRadius: "16px",
                  padding: plan.popular ? "24px 18px 16px" : "16px 18px",
                }}
                data-testid={`card-plan-${plan.id}`}
              >
                {plan.popular && (
                  <div className="absolute -top-[11px] left-1/2 -translate-x-1/2">
                    <span
                      className="text-[11px] font-bold px-4 py-[3px]"
                      style={{ backgroundColor: "#bbadfb", color: "#111111", borderRadius: "9999px" }}
                      data-testid="badge-popular"
                    >
                      {t("paywall.mostChosen")}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div
                    className="w-[22px] h-[22px] rounded-full flex items-center justify-center flex-shrink-0"
                    style={{
                      border: isSelected ? "none" : "2px solid rgba(17,17,17,0.20)",
                      backgroundColor: isSelected ? "#bbadfb" : "transparent",
                    }}
                  >
                    {isSelected && <Check className="w-3 h-3" style={{ color: "#111111" }} />}
                  </div>
                  <div className="flex-1 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[22px] font-black leading-none" style={{ color: "#111111" }}>{plan.discountLabel || "—"}</p>
                      <p className="text-[12px] mt-1" style={{ color: TEXT_SECONDARY }}>{plan.label}</p>
                    </div>
                    <p className="text-[15px] font-bold pt-0.5" style={{ color: "#111111" }}>{plan.perMonth}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-ha-bg border-t border-ha-card-border px-5 pt-4 pb-5 z-10">
        <div className="max-w-xl mx-auto flex flex-col gap-2">
          <button
            className="w-full ha-btn font-semibold"
            style={{ backgroundColor: BRAND, borderRadius: "9999px", color: "#111111" }}
            onClick={handleCheckout}
            disabled={loading}
            data-testid="button-select-payment"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {t("paywall.pleaseWait")}
              </>
            ) : (
              <>{t("paywall.selectPlan")} →</>
            )}
          </button>
          <button
            onClick={handleSkip}
            className="w-full h-[44px] text-[14px] font-medium text-ha-text-secondary transition-colors active:opacity-70"
            data-testid="button-skip-subscription"
          >
            {t("paywall.skipFree")}
          </button>
        </div>
      </div>
    </div>
  );
}
