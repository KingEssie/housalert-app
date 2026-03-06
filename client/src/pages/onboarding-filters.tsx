import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Home, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
      <header className="w-full bg-white sticky top-0 z-20 border-b border-[#E5E7EB]">
        <div className="max-w-xl mx-auto px-5 h-14 flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-[#F2F4F7] transition-colors"
            data-testid="button-back-location"
          >
            <ChevronLeft className="w-5 h-5 text-[#6B7280]" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#1D6FE8] flex items-center justify-center">
              <Home className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-[#0B1F44] text-base">Stekkies</span>
          </div>
        </div>
      </header>

      <div className="max-w-xl mx-auto w-full px-5 pt-6 pb-2">
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex-1 h-2 rounded-full overflow-hidden bg-[#E5E7EB]">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  step <= 2 ? "w-full bg-[#1D6FE8]" : "w-0"
                }`}
                data-testid={`progress-step-${step}`}
              />
            </div>
          ))}
        </div>
        <p className="text-xs font-medium text-[#6B7280] mt-2" data-testid="text-step-indicator">Stap 2 van 3</p>
      </div>

      <main className="flex-1 max-w-xl mx-auto w-full px-5 pb-32 pt-4">
        <h1 className="text-[26px] font-extrabold text-[#0B1F44] leading-tight mb-2" data-testid="text-filters-title">
          Wat zoek je precies?
        </h1>
        <p className="text-[15px] text-[#6B7280] mb-7">
          Verfijn je zoekopdracht voor <span className="font-semibold text-[#0B1F44]">{city}</span>. Alle velden zijn optioneel.
        </p>

        <div className="bg-white rounded-2xl shadow-[0_6px_20px_rgba(0,0,0,0.06)] p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-[#0B1F44]">Min. prijs</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6B7280] text-sm font-medium">€</span>
                <Input
                  type="number"
                  placeholder="0"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="h-13 pl-8 rounded-xl text-[15px] bg-[#F2F4F7] border-transparent focus:border-[#1D6FE8] focus:bg-white transition-colors"
                  data-testid="input-min-price"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-[#0B1F44]">Max. prijs</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6B7280] text-sm font-medium">€</span>
                <Input
                  type="number"
                  placeholder="2000"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="h-13 pl-8 rounded-xl text-[15px] bg-[#F2F4F7] border-transparent focus:border-[#1D6FE8] focus:bg-white transition-colors"
                  data-testid="input-max-price"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold text-[#0B1F44]">Slaapkamers</Label>
            <Select value={bedrooms} onValueChange={setBedrooms}>
              <SelectTrigger
                className="h-13 rounded-xl text-[15px] bg-[#F2F4F7] border-transparent focus:border-[#1D6FE8]"
                data-testid="select-bedrooms"
              >
                <SelectValue placeholder="Maakt niet uit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Maakt niet uit</SelectItem>
                <SelectItem value="1">1+ slaapkamer</SelectItem>
                <SelectItem value="2">2+ slaapkamers</SelectItem>
                <SelectItem value="3">3+ slaapkamers</SelectItem>
                <SelectItem value="4">4+ slaapkamers</SelectItem>
                <SelectItem value="5">5+ slaapkamers</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold text-[#0B1F44]">Min. oppervlakte</Label>
            <div className="relative">
              <Input
                type="number"
                placeholder="0"
                value={minSize}
                onChange={(e) => setMinSize(e.target.value)}
                className="h-13 pr-12 rounded-xl text-[15px] bg-[#F2F4F7] border-transparent focus:border-[#1D6FE8] focus:bg-white transition-colors"
                data-testid="input-min-size"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6B7280] text-sm font-medium">m²</span>
            </div>
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] p-4 z-10">
        <div className="max-w-xl mx-auto flex gap-3">
          <Button
            variant="outline"
            size="lg"
            className="h-[52px] px-6 rounded-xl text-[15px] font-semibold border-[#E5E7EB] text-[#6B7280] hover:bg-[#F2F4F7]"
            onClick={handleBack}
            data-testid="button-back-filters"
          >
            Terug
          </Button>
          <Button
            size="lg"
            className="flex-1 h-[52px] rounded-xl text-[16px] font-semibold shadow-none bg-[#1D6FE8] hover:bg-[#165DD0]"
            onClick={handleNext}
            data-testid="button-next-filters"
          >
            Volgende
          </Button>
        </div>
      </div>
    </div>
  );
}
