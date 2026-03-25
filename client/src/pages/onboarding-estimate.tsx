import { apiFetch } from "@/lib/api-base";
import { useHashSearch } from "@/lib/hash-search";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, TrendingUp, Loader2, Sparkles } from "lucide-react";
import { HousAlertLogo } from "@/components/housalert-logo";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { getMatchEstimateRange } from "@/lib/match-estimate";

export default function OnboardingEstimatePage() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const searchString = useHashSearch();
  const params = new URLSearchParams(searchString);

  const city = params.get("city") || "";
  const minPrice = params.get("minPrice") || "";
  const maxPrice = params.get("maxPrice") || "";
  const minRooms = params.get("minRooms") || "";
  const minSize = params.get("minSize") || "";

  const [estimate, setEstimate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEstimate() {
      try {
        const p = new URLSearchParams();
        p.set("city", city);
        if (minPrice) p.set("minPrice", minPrice);
        if (maxPrice) p.set("maxPrice", maxPrice);
        if (minRooms && minRooms !== "any") p.set("minRooms", minRooms);
        if (minSize) p.set("minSize", minSize);

        const res = await apiFetch(`/api/estimate?${p.toString()}`);
        if (!res.ok) {
          setEstimate(0);
          return;
        }
        const data = await res.json();
        setEstimate(data.perWeekEstimate ?? 0);
      } catch {
        setEstimate(0);
      } finally {
        setLoading(false);
      }
    }
    fetchEstimate();
  }, [city, minPrice, maxPrice, minRooms, minSize]);

  function handleBack() {
    const p = new URLSearchParams();
    p.set("city", city);
    if (minPrice) p.set("minPrice", minPrice);
    if (maxPrice) p.set("maxPrice", maxPrice);
    if (minRooms) p.set("minRooms", minRooms);
    if (minSize) p.set("minSize", minSize);
    navigate(`/onboarding/filters?${p.toString()}`);
  }

  function handleCreateAccount() {
    const p = new URLSearchParams();
    p.set("city", city);
    if (minPrice) p.set("minPrice", minPrice);
    if (maxPrice) p.set("maxPrice", maxPrice);
    if (minRooms) p.set("minRooms", minRooms);
    if (minSize) p.set("minSize", minSize);
    navigate(`/signup?${p.toString()}`);
  }

  const filterChips = [
    { label: city, show: !!city, testId: "tag-city" },
    { label: t("onboardingEstimate.fromPrice", { price: minPrice }), show: !!minPrice, testId: "tag-min-price" },
    { label: t("onboardingEstimate.toPrice", { price: maxPrice }), show: !!maxPrice, testId: "tag-max-price" },
    { label: t("onboardingEstimate.bedroomsPlus", { count: minRooms }), show: !!minRooms && minRooms !== "any", testId: "tag-bedrooms" },
    { label: t("onboardingEstimate.sizePlus", { size: minSize }), show: !!minSize, testId: "tag-size" },
  ].filter((c) => c.show);

  return (
    <div className="min-h-screen bg-ha-bg flex flex-col">
      <header className="w-full bg-ha-bg sticky top-0 z-20 border-b border-ha-card-border">
        <div className="max-w-xl mx-auto px-6 h-[60px] flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-12 h-12 rounded-full bg-ha-card flex items-center justify-center active:scale-95 transition-colors"
            data-testid="button-back-filters"
          >
            <ChevronLeft className="w-5 h-5 text-ha-text-secondary" />
          </button>
          <HousAlertLogo size={28} />
        </div>
      </header>

      <div className="max-w-xl mx-auto w-full px-6 pt-6 pb-2">
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex-1 h-2 rounded-full overflow-hidden bg-ha-surface">
              <div
                className="h-full rounded-full w-full bg-ha-primary"
                data-testid={`progress-step-${step}`}
              />
            </div>
          ))}
        </div>
        <p className="text-xs font-medium text-ha-text-secondary mt-2" data-testid="text-step-indicator">{t("onboardingEstimate.stepIndicator", { step: 3, total: 3 })}</p>
      </div>

      <main className="flex-1 max-w-xl mx-auto w-full px-6 pb-8 pt-4 flex flex-col">
        <h1 className="text-[32px] font-medium text-ha-text leading-[1.1] tracking-[-0.03em] mb-3 text-center" data-testid="text-estimate-title">
          {t("onboardingEstimate.title")}
        </h1>
        <p className="text-[15px] text-ha-text-secondary text-center mb-6">
          {t("onboardingEstimate.subtitle", { city })}
        </p>

        <div className="bg-ha-card rounded-[6px] border border-ha-card-border p-6" data-testid="card-estimate">
          <div className="text-center py-4 border-b border-ha-card-border">
            <div className="flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-7 h-7 text-ha-text-secondary" />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-8 h-8 text-ha-primary animate-spin" />
              </div>
            ) : (
              <>
                <p className="text-5xl font-medium text-ha-text mb-3 tabular-nums" data-testid="text-estimate-number">
                  {getMatchEstimateRange(estimate ?? 0).low}–{getMatchEstimateRange(estimate ?? 0).high}
                </p>
                <p className="text-base text-ha-text-secondary leading-relaxed max-w-sm mx-auto" data-testid="text-estimate-description">
                  {t("onboardingEstimate.estimateDesc", getMatchEstimateRange(estimate ?? 0))}
                </p>
              </>
            )}
          </div>

          {filterChips.length > 0 && (
            <div className="py-5 border-b border-ha-card-border">
              <p className="text-sm font-medium text-ha-text mb-3">{t("onboardingEstimate.yourFilters")}</p>
              <div className="flex flex-wrap gap-2">
                {filterChips.map((chip) => (
                  <span
                    key={chip.testId}
                    className="px-3.5 py-1.5 bg-ha-surface rounded-full text-sm font-medium text-ha-text"
                    data-testid={chip.testId}
                  >
                    {chip.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-start gap-3 py-5 border-b border-ha-card-border">
            <Sparkles className="w-5 h-5 text-ha-primary flex-shrink-0 mt-0.5" />
            <p className="text-sm text-ha-text-secondary leading-relaxed">
              {t("onboardingEstimate.ctaText")}
            </p>
          </div>

          <div className="pt-6 flex gap-3">
            <Button
              variant="outline"
              size="lg"
              className="h-[48px] px-6 rounded-full text-[15px] font-medium border-ha-card-border text-ha-text hover:bg-ha-surface"
              onClick={handleBack}
              data-testid="button-back-estimate"
            >
              {t("onboardingEstimate.back")}
            </Button>
            <Button
              size="lg"
              className="flex-1 h-[56px] rounded-[6px] text-[16px] font-medium shadow-none bg-ha-primary hover:bg-ha-primary-hover text-white"
              onClick={handleCreateAccount}
              disabled={loading}
              data-testid="button-create-account"
            >
              {t("onboardingEstimate.createAccount")}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
