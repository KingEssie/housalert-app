import { apiFetch } from "@/lib/api-base";
import { useHashSearch } from "@/lib/hash-search";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Home, ChevronLeft, TrendingUp, Loader2, Sparkles } from "lucide-react";
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
    <div className="min-h-screen bg-white flex flex-col">
      <header className="w-full bg-white sticky top-0 z-20 border-b border-[#E5E7EB]">
        <div className="max-w-xl mx-auto px-6 h-[60px] flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-12 h-12 rounded-full bg-[#F3F4F6] shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center justify-center active:scale-95 transition-colors"
            data-testid="button-back-filters"
          >
            <ChevronLeft className="w-5 h-5 text-[#1F2937]" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#0D6EFD] flex items-center justify-center">
              <Home className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-[#111C3D] text-base">HousAlert</span>
          </div>
        </div>
      </header>

      <div className="max-w-xl mx-auto w-full px-6 pt-6 pb-2">
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex-1 h-2 rounded-full overflow-hidden bg-[#E5E7EB]">
              <div
                className="h-full rounded-full w-full bg-[#0D6EFD]"
                data-testid={`progress-step-${step}`}
              />
            </div>
          ))}
        </div>
        <p className="text-xs font-medium text-[#1F2937] mt-2" data-testid="text-step-indicator">{t("onboardingEstimate.stepIndicator", { step: 3, total: 3 })}</p>
      </div>

      <main className="flex-1 max-w-xl mx-auto w-full px-6 pb-8 pt-4 flex flex-col">
        <h1 className="text-[32px] font-[800] text-[#111C3D] leading-[1.1] tracking-[-0.03em] mb-3 text-center" data-testid="text-estimate-title">
          {t("onboardingEstimate.title")}
        </h1>
        <p className="text-[15px] text-[#1F2937] text-center mb-6">
          {t("onboardingEstimate.subtitle", { city })}
        </p>

        <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6" data-testid="card-estimate">
          <div className="text-center py-4 border-b border-[#E5E7EB]">
            <div className="w-14 h-14 rounded-2xl bg-[#EBF2FF] flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-7 h-7 text-[#0D6EFD]" />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-8 h-8 text-[#0D6EFD] animate-spin" />
              </div>
            ) : (
              <>
                <p className="text-5xl font-extrabold text-[#111C3D] mb-3 tabular-nums" data-testid="text-estimate-number">
                  {getMatchEstimateRange(estimate ?? 0).low}–{getMatchEstimateRange(estimate ?? 0).high}
                </p>
                <p className="text-base text-[#1F2937] leading-relaxed max-w-sm mx-auto" data-testid="text-estimate-description">
                  {t("onboardingEstimate.estimateDesc", getMatchEstimateRange(estimate ?? 0))}
                </p>
              </>
            )}
          </div>

          {filterChips.length > 0 && (
            <div className="py-5 border-b border-[#E5E7EB]">
              <p className="text-sm font-semibold text-[#111C3D] mb-3">{t("onboardingEstimate.yourFilters")}</p>
              <div className="flex flex-wrap gap-2">
                {filterChips.map((chip) => (
                  <span
                    key={chip.testId}
                    className="px-3.5 py-1.5 bg-[#F5F7FA] rounded-full text-sm font-medium text-[#1F2937]"
                    data-testid={chip.testId}
                  >
                    {chip.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-start gap-3 py-5 border-b border-[#E5E7EB]">
            <Sparkles className="w-5 h-5 text-[#0D6EFD] flex-shrink-0 mt-0.5" />
            <p className="text-sm text-[#1F2937] leading-relaxed">
              {t("onboardingEstimate.ctaText")}
            </p>
          </div>

          <div className="pt-6 flex gap-3">
            <Button
              variant="outline"
              size="lg"
              className="h-[48px] px-6 rounded-full text-[15px] font-semibold border-[#E5E7EB] text-[#1F2937] hover:bg-[#F5F7FA]"
              onClick={handleBack}
              data-testid="button-back-estimate"
            >
              {t("onboardingEstimate.back")}
            </Button>
            <Button
              size="lg"
              className="flex-1 h-[56px] rounded-full text-[16px] font-semibold shadow-none bg-[#0D6EFD] hover:bg-[#0B5ED7]"
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
