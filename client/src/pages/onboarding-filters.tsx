import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Home, ChevronLeft, DollarSign, BedDouble, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OnboardingFiltersPage() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const city = params.get("city") || "";

  const [minPrice, setMinPrice] = useState(params.get("minPrice") || "");
  const [maxPrice, setMaxPrice] = useState(params.get("maxPrice") || "");
  const [bedrooms, setBedrooms] = useState(params.get("minRooms") || "");
  const [minSize, setMinSize] = useState(params.get("minSize") || "");

  function handleNext() {
    const p = new URLSearchParams();
    p.set("city", city);
    if (minPrice) p.set("minPrice", minPrice);
    if (maxPrice) p.set("maxPrice", maxPrice);
    if (bedrooms && bedrooms !== "any") p.set("minRooms", bedrooms);
    if (minSize) p.set("minSize", minSize);
    navigate(`/onboarding/estimate?${p.toString()}`);
  }

  function handleBack() {
    navigate("/onboarding/location");
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="w-full bg-white sticky top-0 z-20 border-b border-[#F0F2F5]">
        <div className="max-w-xl mx-auto px-6 h-[60px] flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-10 h-10 rounded-full bg-[#F2F5F8] flex items-center justify-center hover:bg-[#EAEFF5] transition-colors"
            data-testid="button-back-location"
          >
            <ChevronLeft className="w-5 h-5 text-[#72839A]" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#0066FF] flex items-center justify-center">
              <Home className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-[#1B2A4A] text-base">Stekkies</span>
          </div>
        </div>
      </header>

      <div className="max-w-xl mx-auto w-full px-6 pt-6 pb-2">
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex-1 h-2 rounded-full overflow-hidden bg-[#EAEFF5]">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  step <= 2 ? "w-full bg-[#0066FF]" : "w-0"
                }`}
                data-testid={`progress-step-${step}`}
              />
            </div>
          ))}
        </div>
        <p className="text-xs font-medium text-[#72839A] mt-2" data-testid="text-step-indicator">Stap 2 van 3</p>
      </div>

      <main className="flex-1 max-w-xl mx-auto w-full px-6 pb-8 pt-4">
        <h1 className="text-[32px] font-[800] text-[#1B2A4A] leading-[1.1] tracking-[-0.03em] mb-3" data-testid="text-filters-title">
          Wat zoek je precies?
        </h1>
        <p className="text-[15px] text-[#72839A] mb-6">
          Verfijn je zoekopdracht voor <span className="font-semibold text-[#1B2A4A]">{city}</span>. Alle velden zijn optioneel.
        </p>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-[14px] font-semibold text-[#1B2A4A] mb-2 block">Minimale huur</label>
            <div className="relative">
              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A8599]" />
              <input
                type="number"
                placeholder="€ 0"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="w-full h-[52px] pl-11 pr-4 rounded-xl border-0 bg-[#F3F4F8] text-[15px] font-medium text-[#1B2A4A] placeholder:text-[#7A8599] placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[#0066FF]/15 focus:bg-[#FAFBFC] transition-all"
                data-testid="input-min-price"
              />
            </div>
          </div>

          <div>
            <label className="text-[14px] font-semibold text-[#1B2A4A] mb-2 block">Maximale huur</label>
            <div className="relative">
              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A8599]" />
              <input
                type="number"
                placeholder="€ 2000"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="w-full h-[52px] pl-11 pr-4 rounded-xl border-0 bg-[#F3F4F8] text-[15px] font-medium text-[#1B2A4A] placeholder:text-[#7A8599] placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[#0066FF]/15 focus:bg-[#FAFBFC] transition-all"
                data-testid="input-max-price"
              />
            </div>
          </div>

          <div>
            <label className="text-[14px] font-semibold text-[#1B2A4A] mb-2 block">Slaapkamers</label>
            <div className="relative">
              <BedDouble className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A8599]" />
              <select
                value={bedrooms}
                onChange={(e) => setBedrooms(e.target.value)}
                className="w-full h-[52px] pl-11 pr-4 rounded-xl border-0 bg-[#F3F4F8] text-[15px] font-medium text-[#1B2A4A] focus:outline-none focus:ring-2 focus:ring-[#0066FF]/15 focus:bg-[#FAFBFC] cursor-pointer appearance-none transition-all"
                data-testid="select-bedrooms"
              >
                <option value="">Maakt niet uit</option>
                <option value="any">Maakt niet uit</option>
                <option value="1">1+</option>
                <option value="2">2+</option>
                <option value="3">3+</option>
                <option value="4">4+</option>
                <option value="5">5+</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[14px] font-semibold text-[#1B2A4A] mb-2 block">Minimale oppervlakte</label>
            <div className="relative">
              <Maximize2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A8599]" />
              <input
                type="number"
                placeholder="0 m²"
                value={minSize}
                onChange={(e) => setMinSize(e.target.value)}
                className="w-full h-[52px] pl-11 pr-4 rounded-xl border-0 bg-[#F3F4F8] text-[15px] font-medium text-[#1B2A4A] placeholder:text-[#7A8599] placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[#0066FF]/15 focus:bg-[#FAFBFC] transition-all"
                data-testid="input-min-size"
              />
            </div>
          </div>

          <div className="pt-6 flex gap-3">
            <Button
              variant="outline"
              size="lg"
              className="h-[48px] px-6 rounded-xl text-[15px] font-semibold border-[#EAEFF5] text-[#1B2A4A] hover:bg-[#F2F5F8]"
              onClick={handleBack}
              data-testid="button-back-filters"
            >
              Terug
            </Button>
            <Button
              size="lg"
              className="flex-1 h-[56px] rounded-xl text-[16px] font-semibold shadow-none bg-[#0066FF] hover:bg-[#0052CC]"
              onClick={handleNext}
              data-testid="button-next-filters"
            >
              Volgende
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
