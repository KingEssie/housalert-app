import { apiFetch } from "@/lib/api-base";
import { useHashSearch } from "@/lib/hash-search";
import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Check, Loader2, X, ShieldAlert, ChevronDown, ArrowRight, Shield, Clock, Zap } from "lucide-react";
import { HousAlertLogo } from "@/components/housalert-logo";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "@/i18n";
import { trackEvent, trackEventLazy } from "@/lib/track-event";
import { OBW } from "@/components/onboarding-ui";

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
      discountColor: "#22c55e",
    },
    {
      id: "two_month",
      label: t("paywall.plans.twoMonth"),
      price: "€34,99",
      perMonth: "€17,50 " + t("paywall.perMonth"),
      popular: true,
      discountLabel: "-30%",
      discountColor: "#f97316",
    },
    {
      id: "monthly",
      label: t("paywall.plans.monthly"),
      price: "€24,99",
      perMonth: "€24,99 " + t("paywall.perMonth"),
      popular: false,
      discountLabel: "",
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

const WEBSITE_PLANS: WebsitePlan[] = [
  { id: "three_month", label: "3 maanden", perMonth: "€15,00 per maand", discount: "40% korting", popular: false },
  { id: "two_month", label: "2 maanden", perMonth: "€17,50 per maand", discount: "30% korting", popular: true },
  { id: "monthly", label: "1 maand", perMonth: "€24,99 per maand", discount: "0% korting", popular: false },
];

function WebsitePaywall({
  selectedPlan,
  setSelectedPlan,
  loading,
  handleCheckout,
  queryParams,
}: {
  selectedPlan: string;
  setSelectedPlan: (id: string) => void;
  loading: boolean;
  handleCheckout: () => void;
  queryParams: URLSearchParams;
}) {
  const [searchOpen, setSearchOpen] = useState(false);

  const city = queryParams.get("city") || "";
  const maxPrice = queryParams.get("maxPrice") || "";
  const minSize = queryParams.get("minSize") || "";
  const minRooms = queryParams.get("minRooms") || "";
  const radiusKm = queryParams.get("radiusKm") || "";

  const searchDetails: string[] = [];
  if (city) searchDetails.push(city);
  if (radiusKm && radiusKm !== "0") searchDetails.push(`+ ${radiusKm} km`);
  if (maxPrice && maxPrice !== "0") searchDetails.push(`max €${maxPrice}`);
  if (minSize && minSize !== "0") searchDetails.push(`${minSize}m²+`);
  if (minRooms && minRooms !== "0") searchDetails.push(`${minRooms}+ kamers`);

  return (
    <div
      className="min-h-[100dvh] flex flex-col"
      style={{ background: "#ffffff" }}
      data-testid="screen-paywall-website"
    >
      <header
        className="w-full sticky top-0 z-20"
        style={{ backgroundColor: OBW.headerBg, borderBottom: `1px solid ${OBW.headerBorder}` }}
      >
        <div className="max-w-[480px] mx-auto px-5 h-[52px] flex items-center justify-between">
          <HousAlertLogo size={26} />
          <div className="w-[30px]" />
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-5 pt-6 pb-8">
        <h2
          className="text-[22px] font-bold tracking-[-0.02em] mb-5"
          style={{ color: OBW.text }}
          data-testid="text-paywall-title"
        >
          Selecteer je pakket
        </h2>

        {city && (
          <div
            className="rounded-[4px] mb-5"
            style={{ border: `1px solid ${OBW.cardBorder}`, backgroundColor: "#ffffff" }}
          >
            <button
              className="w-full flex items-center justify-between px-4 py-3"
              onClick={() => setSearchOpen(!searchOpen)}
              data-testid="button-search-summary-toggle"
            >
              <span className="text-[15px] font-semibold" style={{ color: OBW.text }}>
                Jouw zoekopdracht
              </span>
              <ChevronDown
                className="w-4 h-4 transition-transform"
                style={{
                  color: OBW.textSecondary,
                  transform: searchOpen ? "rotate(180deg)" : "rotate(0deg)",
                }}
              />
            </button>
            {searchOpen && (
              <div className="px-4 pb-3">
                <div
                  className="rounded-[4px] p-3"
                  style={{ backgroundColor: "#f0f9ff", border: "1px solid #bfdbfe" }}
                >
                  <p className="text-[13px] leading-[1.5]" style={{ color: "#1e40af" }}>
                    {searchDetails.length > 0 ? searchDetails.join(" · ") : "Geen zoekcriteria ingesteld"}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <p
          className="text-[15px] font-semibold mb-3"
          style={{ color: OBW.text }}
        >
          Selecteer jouw kortingsperiode
        </p>

        <div className="flex flex-col gap-0" data-testid="plan-options">
          {WEBSITE_PLANS.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            return (
              <div key={plan.id} className="relative">
                {plan.popular && (
                  <div className="flex justify-center" style={{ marginBottom: "-12px", position: "relative", zIndex: 2 }}>
                    <span
                      className="text-[11px] font-bold px-3 py-1 rounded-full"
                      style={{ backgroundColor: "#22c55e", color: "#ffffff" }}
                      data-testid="badge-popular"
                    >
                      Meest gekozen
                    </span>
                  </div>
                )}
                <button
                  onClick={() => setSelectedPlan(plan.id)}
                  className="w-full text-left transition-all"
                  style={{
                    border: isSelected ? `2px solid ${OBW.pink}` : `1px solid ${OBW.cardBorder}`,
                    borderRadius: "4px",
                    backgroundColor: isSelected ? "rgba(233,30,99,0.04)" : "#ffffff",
                    padding: plan.popular ? "16px 16px 12px 16px" : "12px 16px",
                    marginBottom: "8px",
                  }}
                  data-testid={`card-plan-${plan.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0"
                        style={{
                          border: isSelected ? "none" : `2px solid ${OBW.chipBorder}`,
                          backgroundColor: isSelected ? "#22c55e" : "transparent",
                        }}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <span
                        className="text-[15px] font-bold"
                        style={{ color: OBW.text }}
                      >
                        {plan.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px]" style={{ color: OBW.textSecondary }}>
                        {plan.perMonth}
                      </span>
                      <span
                        className="text-[13px] font-bold"
                        style={{ color: plan.discount === "0% korting" ? OBW.textSecondary : "#e91e63" }}
                      >
                        {plan.discount}
                      </span>
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
          className="w-full h-[48px] rounded-[4px] text-[15px] font-bold text-white transition-all active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-2 mt-2 mb-6"
          style={{
            background: OBW.pinkGradient,
            boxShadow: "0 4px 14px rgba(233,30,99,0.25)",
          }}
          data-testid="button-select-payment"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Even geduld...
            </>
          ) : (
            <>
              Activeer woonalerts
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        <div className="flex flex-col gap-3 mb-6">
          <div className="flex items-start gap-2.5">
            <div
              className="w-[20px] h-[20px] rounded-full flex items-center justify-center shrink-0 mt-[1px]"
              style={{ backgroundColor: "rgba(34,197,94,0.12)" }}
            >
              <Check className="w-3 h-3" style={{ color: "#22c55e" }} />
            </div>
            <p className="text-[13px] leading-[1.5]" style={{ color: OBW.text }}>
              <strong>Bespaar tijd (en stress):</strong> wij vinden woningmatches die bij je passen
            </p>
          </div>
          <div className="flex items-start gap-2.5">
            <div
              className="w-[20px] h-[20px] rounded-full flex items-center justify-center shrink-0 mt-[1px]"
              style={{ backgroundColor: "rgba(34,197,94,0.12)" }}
            >
              <Check className="w-3 h-3" style={{ color: "#22c55e" }} />
            </div>
            <p className="text-[13px] leading-[1.5]" style={{ color: OBW.text }}>
              <strong>Ongelimiteerd woningmatches</strong> direct via de HousAlert app
            </p>
          </div>
          <div className="flex items-start gap-2.5">
            <div
              className="w-[20px] h-[20px] rounded-full flex items-center justify-center shrink-0 mt-[1px]"
              style={{ backgroundColor: "rgba(34,197,94,0.12)" }}
            >
              <Check className="w-3 h-3" style={{ color: "#22c55e" }} />
            </div>
            <p className="text-[13px] leading-[1.5]" style={{ color: OBW.text }}>
              De meeste HousAlert-gebruikers vinden in <strong>4–8 weken</strong> een huurwoning
            </p>
          </div>
        </div>

        <div
          className="rounded-[4px] p-4"
          style={{ backgroundColor: "#f0f9ff", border: "1px solid #bfdbfe" }}
        >
          <p className="text-[15px] font-bold mb-1" style={{ color: "#1e40af" }}>
            Probeer HousAlert zonder risico!
          </p>
          <p className="text-[13px] leading-[1.55]" style={{ color: "#1e40af" }}>
            Ben je binnen 14 dagen niet tevreden over HousAlert? Dan krijg jij het volledige bedrag terug. Zonder fratsen.
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

  if (isWebsiteMode) {
    return (
      <WebsitePaywall
        selectedPlan={selectedPlan}
        setSelectedPlan={setSelectedPlan}
        loading={loading}
        handleCheckout={handleCheckout}
        queryParams={queryParams}
      />
    );
  }

  return (
    <div className="min-h-screen bg-ha-bg flex flex-col">
      <header className="w-full bg-ha-bg sticky top-0 z-20 border-b border-ha-card-border">
        <div className="max-w-xl mx-auto px-6 h-[60px] flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="w-9 h-9 rounded-full bg-ha-card flex items-center justify-center active:scale-95 transition-transform"
            data-testid="button-paywall-back"
          >
            <ArrowLeft className="w-4 h-4 text-ha-text-secondary" />
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
        <h1 className="text-[28px] font-extrabold tracking-[-0.03em] leading-[1.1] mb-6" style={{ color: TEXT_PRIMARY }} data-testid="text-paywall-title">
          {t("paywall.headline")}
        </h1>

        <div className="space-y-4 mb-8">
          {BENEFIT_KEYS.map((b, i) => (
            <div key={i} className="flex items-start gap-3" data-testid={`paywall-benefit-${i}`}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: "rgba(34,197,94,0.15)" }}>
                <Check className="w-3.5 h-3.5 text-green-500" />
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
                className="w-full rounded-[12px] border-2 transition-all text-left relative overflow-hidden bg-ha-card"
                style={{
                  borderColor: isSelected ? BRAND : "rgb(var(--ha-card-border))",
                }}
                data-testid={`card-plan-${plan.id}`}
              >
                {plan.popular && (
                  <div className="w-full text-center py-1 text-[11px] font-bold tracking-wider uppercase" style={{ backgroundColor: BRAND, color: "#fff" }} data-testid="badge-popular">
                    {t("paywall.mostChosen")}
                  </div>
                )}
                <div className="flex items-center justify-between px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors"
                      style={{
                        borderColor: isSelected ? BRAND : "rgb(var(--ha-card-border))",
                        backgroundColor: isSelected ? BRAND : "transparent",
                      }}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div>
                      <p className="text-[15px] font-semibold text-ha-text">{plan.label}</p>
                      <p className="text-[12px] text-ha-text-secondary">{plan.perMonth}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-[18px] font-bold text-ha-text">{plan.price}</span>
                    {plan.discountLabel && (
                      <span
                        className="text-[11px] font-bold px-2 py-0.5 rounded-[4px]"
                        style={{ backgroundColor: plan.discountColor + "20", color: plan.discountColor }}
                      >
                        {plan.discountLabel}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-ha-bg border-t border-ha-card-border p-5 z-10">
        <div className="max-w-xl mx-auto">
          <button
            className="w-full ha-btn text-white font-bold"
            style={{ backgroundColor: BRAND }}
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
        </div>
      </div>
    </div>
  );
}
