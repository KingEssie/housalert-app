import { useState, useEffect } from "react";
import { useHashSearch } from "@/lib/hash-search";
import { useLocation } from "wouter";
import { ChevronLeft, Euro, BedDouble, Maximize2, Loader2 } from "lucide-react";
import { HousAlertLogo } from "@/components/housalert-logo";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { useEmbedded } from "@/hooks/use-embedded";
import { getMatchEstimateRange } from "@/lib/match-estimate";
import { apiFetch } from "@/lib/api-base";

const INPUT_CLS = "w-full h-[44px] pl-10 pr-4 rounded-xl border border-transparent bg-ha-surface text-[15px] font-medium text-ha-text placeholder:text-ha-text-secondary placeholder:font-normal focus:bg-ha-card";
const SELECT_CLS = "w-full h-[44px] pl-10 pr-4 rounded-xl border border-transparent bg-ha-surface text-[15px] font-medium text-ha-text focus:bg-ha-card cursor-pointer appearance-none";

export default function OnboardingFiltersPage() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const searchString = useHashSearch();
  const { isEmbedded, containerClass } = useEmbedded();
  const params = new URLSearchParams(searchString);
  const city = params.get("city") || "";

  const [minPrice, setMinPrice] = useState(params.get("minPrice") || "");
  const [maxPrice, setMaxPrice] = useState(params.get("maxPrice") || "");
  const [bedrooms, setBedrooms] = useState(params.get("minRooms") || "");
  const [minSize, setMinSize] = useState(params.get("minSize") || "");

  const [estimate, setEstimate] = useState<number | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);

  useEffect(() => {
    if (!city) return;
    setEstimateLoading(true);
    const p = new URLSearchParams({ city });
    apiFetch(`/api/estimate?${p.toString()}`)
      .then((res) => (res.ok ? res.json() : { perWeekEstimate: 0 }))
      .then((data) => setEstimate(data.perWeekEstimate ?? 0))
      .catch(() => setEstimate(0))
      .finally(() => setEstimateLoading(false));
  }, [city]);

  function buildParams(): URLSearchParams {
    const p = new URLSearchParams(searchString);
    if (minPrice) p.set("minPrice", minPrice); else p.delete("minPrice");
    if (maxPrice) p.set("maxPrice", maxPrice); else p.delete("maxPrice");
    if (bedrooms && bedrooms !== "any") p.set("minRooms", bedrooms); else p.delete("minRooms");
    if (minSize) p.set("minSize", minSize); else p.delete("minSize");
    return p;
  }

  function handleNext() {
    const builtParams = buildParams();
    if (isEmbedded) {
      const funnel: Record<string, string> = {};
      builtParams.forEach((v, k) => { funnel[k] = v; });
      localStorage.setItem("housalert_embed_funnel", JSON.stringify(funnel));
      navigate(`/onboarding/value?${builtParams.toString()}`);
    } else {
      navigate(`/onboarding/preferences?${builtParams.toString()}`);
    }
  }

  function handleBack() {
    const p = new URLSearchParams(searchString);
    navigate(`/onboarding/location?${p.toString()}`);
  }

  return (
    <div className={`min-h-screen ${isEmbedded ? "bg-ha-card" : "bg-ha-surface"} flex flex-col`}>
      {!isEmbedded && (
        <header className="w-full bg-ha-card sticky top-0 z-20 border-b border-ha-card-border">
          <div className={`${containerClass} mx-auto px-5 h-[56px] flex items-center gap-3`}>
            <button
              onClick={handleBack}
              className="w-10 h-10 rounded-full bg-ha-surface flex items-center justify-center active:scale-95 transition-transform"
              data-testid="button-back-location"
            >
              <ChevronLeft className="w-5 h-5 text-ha-text-muted" />
            </button>
            <HousAlertLogo size={28} />
          </div>
        </header>
      )}

      <div className={`${containerClass} mx-auto w-full px-5 ${isEmbedded ? "pt-2 pb-0" : "pt-4 pb-1"}`}>
        <div className="flex items-center justify-center gap-2 py-2">
          {(isEmbedded ? [1, 2] : [1, 2, 3, 4]).map((step) => (
            <div
              key={step}
              className={`w-2 h-2 rounded-full transition-all ${
                step <= 2 ? "bg-ha-primary" : "bg-ha-input-border"
              }`}
              data-testid={`dot-step-${step}`}
            />
          ))}
        </div>
      </div>

      <main className={`flex-1 ${containerClass} mx-auto w-full px-5 ${isEmbedded ? "pb-4 pt-1" : "pb-8 pt-3"}`}>
        {!isEmbedded && (
          <>
            <h1 className="text-page-title mb-1" data-testid="text-filters-title">
              {t("onboardingFilters.title")}
            </h1>
            <p className="text-[14px] text-ha-text-secondary mb-5">
              {t("onboardingFilters.subtitle", { city })}
            </p>
          </>
        )}

        <div className={`bg-ha-card rounded-[16px] border border-ha-card-border shadow-[0_2px_8px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)] ${isEmbedded ? "p-4" : "p-5"}`}>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div>
              <label className="text-[13px] font-medium text-ha-text-secondary mb-1.5 block">{t("onboardingFilters.minRent")}</label>
              <div className="relative">
                <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ha-text-muted" />
                <input
                  type="number"
                  placeholder="€ 0"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className={INPUT_CLS}
                  data-testid="input-min-price"
                />
              </div>
            </div>
            <div>
              <label className="text-[13px] font-medium text-ha-text-secondary mb-1.5 block">{t("onboardingFilters.maxRent")}</label>
              <div className="relative">
                <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ha-text-muted" />
                <input
                  type="number"
                  placeholder="€ 2000"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className={INPUT_CLS}
                  data-testid="input-max-price"
                />
              </div>
            </div>
          </div>

          <div className="mb-5">
            <label className="text-[13px] font-medium text-ha-text-secondary mb-1.5 block">{t("onboardingFilters.bedrooms")}</label>
            <div className="relative">
              <BedDouble className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ha-text-muted" />
              <select
                value={bedrooms}
                onChange={(e) => setBedrooms(e.target.value)}
                className={SELECT_CLS}
                data-testid="select-bedrooms"
              >
                <option value="">{t("onboardingFilters.doesntMatter")}</option>
                <option value="0">Studio+</option>
                <option value="1">1+</option>
                <option value="2">2+</option>
                <option value="3">3+</option>
                <option value="4">4+</option>
                <option value="5">5+</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[13px] font-medium text-ha-text-secondary mb-1.5 block">{t("onboardingFilters.minArea")}</label>
            <div className="relative">
              <Maximize2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ha-text-muted" />
              <input
                type="number"
                placeholder="0 m²"
                value={minSize}
                onChange={(e) => setMinSize(e.target.value)}
                className={INPUT_CLS}
                data-testid="input-min-size"
              />
            </div>
          </div>
        </div>

        {isEmbedded ? (
          <div className="mt-3">
            <Button
              className="w-full h-[48px] rounded-[14px] text-[15px] font-medium shadow-none bg-ha-primary hover:bg-ha-primary-hover"
              onClick={handleNext}
              data-testid="button-next-filters"
            >
              {t("embedFilters.cta")}
            </Button>

            {city && (
              <p className="text-center text-[14px] text-ha-text-secondary mt-3" data-testid="text-embed-estimate">
                {estimateLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-ha-primary" />
                  </span>
                ) : (
                  t("embedFilters.estimateText", getMatchEstimateRange(estimate ?? 0))
                )}
              </p>
            )}
          </div>
        ) : (
          <div className="pt-5 flex gap-3">
            <Button
              variant="outline"
              className="h-[48px] px-6 rounded-full text-[15px] font-medium border-ha-card-border text-ha-text-secondary hover:bg-ha-surface"
              onClick={handleBack}
              data-testid="button-back-filters"
            >
              {t("onboardingFilters.back")}
            </Button>
            <Button
              className="flex-1 h-[48px] rounded-[14px] text-[15px] font-medium shadow-none bg-ha-primary hover:bg-ha-primary-hover"
              onClick={handleNext}
              data-testid="button-next-filters"
            >
              {t("onboardingFilters.next")}
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
