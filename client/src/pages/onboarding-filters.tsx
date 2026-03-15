import { useState } from "react";
import { useHashSearch } from "@/lib/hash-search";
import { useLocation } from "wouter";
import { Home, ChevronLeft, Euro, BedDouble, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";

const INPUT_CLS = "w-full h-[44px] pl-10 pr-4 rounded-xl border border-transparent bg-[#F3F4F6] text-[15px] font-medium text-[#1F2937] placeholder:text-[#9CA3AF] placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[#0D6EFD] focus:border-[#0D6EFD] focus:bg-white transition-all";
const SELECT_CLS = "w-full h-[44px] pl-10 pr-4 rounded-xl border border-transparent bg-[#F3F4F6] text-[15px] font-medium text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#0D6EFD] focus:border-[#0D6EFD] focus:bg-white cursor-pointer appearance-none transition-all";

export default function OnboardingFiltersPage() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const searchString = useHashSearch();
  const params = new URLSearchParams(searchString);
  const city = params.get("city") || "";

  const [minPrice, setMinPrice] = useState(params.get("minPrice") || "");
  const [maxPrice, setMaxPrice] = useState(params.get("maxPrice") || "");
  const [bedrooms, setBedrooms] = useState(params.get("minRooms") || "");
  const [minSize, setMinSize] = useState(params.get("minSize") || "");

  function buildParams(): URLSearchParams {
    const p = new URLSearchParams(searchString);
    if (minPrice) p.set("minPrice", minPrice); else p.delete("minPrice");
    if (maxPrice) p.set("maxPrice", maxPrice); else p.delete("maxPrice");
    if (bedrooms && bedrooms !== "any") p.set("minRooms", bedrooms); else p.delete("minRooms");
    if (minSize) p.set("minSize", minSize); else p.delete("minSize");
    return p;
  }

  function handleNext() {
    navigate(`/onboarding/preferences?${buildParams().toString()}`);
  }

  function handleBack() {
    const p = new URLSearchParams(searchString);
    navigate(`/onboarding/location?${p.toString()}`);
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col">
      <header className="w-full bg-white sticky top-0 z-20 border-b border-[#E5E7EB]">
        <div className="max-w-xl mx-auto px-5 h-[56px] flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-10 h-10 rounded-full bg-[#F3F4F6] flex items-center justify-center active:scale-95 transition-transform"
            data-testid="button-back-location"
          >
            <ChevronLeft className="w-5 h-5 text-[#1F2937]" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#0D6EFD] flex items-center justify-center">
              <Home className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-[#111C3D] text-[15px]">HousAlert</span>
          </div>
        </div>
      </header>

      <div className="max-w-xl mx-auto w-full px-5 pt-4 pb-1">
        <div className="flex items-center justify-center gap-2 py-2">
          {[1, 2, 3, 4].map((step) => (
            <div
              key={step}
              className={`w-2 h-2 rounded-full transition-all ${
                step <= 2 ? "bg-[#0D6EFD]" : "bg-[#D1D5DB]"
              }`}
              data-testid={`dot-step-${step}`}
            />
          ))}
        </div>
      </div>

      <main className="flex-1 max-w-xl mx-auto w-full px-5 pb-8 pt-3">
        <h1 className="text-[24px] font-[800] text-[#111C3D] leading-[1.15] tracking-[-0.02em] mb-1" data-testid="text-filters-title">
          {t("onboardingFilters.title")}
        </h1>
        <p className="text-[14px] text-[#6B7280] mb-5">
          {t("onboardingFilters.subtitle", { city })}
        </p>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5">
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div>
              <label className="text-[13px] font-[600] text-[#374151] mb-1.5 block">{t("onboardingFilters.minRent")}</label>
              <div className="relative">
                <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
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
              <label className="text-[13px] font-[600] text-[#374151] mb-1.5 block">{t("onboardingFilters.maxRent")}</label>
              <div className="relative">
                <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
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
            <label className="text-[13px] font-[600] text-[#374151] mb-1.5 block">{t("onboardingFilters.bedrooms")}</label>
            <div className="relative">
              <BedDouble className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
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
            <label className="text-[13px] font-[600] text-[#374151] mb-1.5 block">{t("onboardingFilters.minArea")}</label>
            <div className="relative">
              <Maximize2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
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

        <div className="pt-5 flex gap-3">
          <Button
            variant="outline"
            className="h-[48px] px-6 rounded-full text-[15px] font-semibold border-[#E5E7EB] text-[#374151] hover:bg-[#F5F7FA]"
            onClick={handleBack}
            data-testid="button-back-filters"
          >
            {t("onboardingFilters.back")}
          </Button>
          <Button
            className="flex-1 h-[48px] rounded-full text-[15px] font-semibold shadow-none bg-[#0D6EFD] hover:bg-[#0B5ED7]"
            onClick={handleNext}
            data-testid="button-next-filters"
          >
            {t("onboardingFilters.next")}
          </Button>
        </div>
      </main>
    </div>
  );
}
