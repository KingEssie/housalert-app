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
    <div className="min-h-screen bg-[#f5f6f8] flex flex-col">
      <header className="w-full bg-white sticky top-0 z-20 shadow-sm">
        <div className="max-w-xl mx-auto px-5 h-14 flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-[#f5f6f8] transition-colors"
            data-testid="button-back-location"
          >
            <ChevronLeft className="w-5 h-5 text-[#4a5568]" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Home className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-[#1a2744] text-base">Stekkies</span>
          </div>
        </div>
      </header>

      <div className="max-w-xl mx-auto w-full px-5 pt-6 pb-2">
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex-1 h-2 rounded-full overflow-hidden bg-[#e2e5ea]">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  step <= 2 ? "w-full bg-primary" : "w-0"
                }`}
                data-testid={`progress-step-${step}`}
              />
            </div>
          ))}
        </div>
        <p className="text-xs font-medium text-[#9ca3af] mt-2" data-testid="text-step-indicator">Stap 2 van 3</p>
      </div>

      <main className="flex-1 max-w-xl mx-auto w-full px-5 pb-32 pt-4">
        <h1 className="text-[26px] font-extrabold text-[#1a2744] leading-tight mb-2" data-testid="text-filters-title">
          Wat zoek je precies?
        </h1>
        <p className="text-[15px] text-[#6b7280] mb-7">
          Verfijn je zoekopdracht voor <span className="font-semibold text-[#1a2744]">{city}</span>. Alle velden zijn optioneel.
        </p>

        <div className="bg-white rounded-2xl shadow-sm border border-[#eceef1] p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-[#1a2744]">Min. prijs</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9ca3af] text-sm font-medium">€</span>
                <Input
                  type="number"
                  placeholder="0"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="h-13 pl-8 rounded-xl text-[15px] bg-[#f7f8fa] border-[#e5e7eb] focus:border-primary focus:bg-white transition-colors"
                  data-testid="input-min-price"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-[#1a2744]">Max. prijs</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9ca3af] text-sm font-medium">€</span>
                <Input
                  type="number"
                  placeholder="2000"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="h-13 pl-8 rounded-xl text-[15px] bg-[#f7f8fa] border-[#e5e7eb] focus:border-primary focus:bg-white transition-colors"
                  data-testid="input-max-price"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold text-[#1a2744]">Slaapkamers</Label>
            <Select value={bedrooms} onValueChange={setBedrooms}>
              <SelectTrigger
                className="h-13 rounded-xl text-[15px] bg-[#f7f8fa] border-[#e5e7eb] focus:border-primary"
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
            <Label className="text-sm font-semibold text-[#1a2744]">Min. oppervlakte</Label>
            <div className="relative">
              <Input
                type="number"
                placeholder="0"
                value={minSize}
                onChange={(e) => setMinSize(e.target.value)}
                className="h-13 pr-12 rounded-xl text-[15px] bg-[#f7f8fa] border-[#e5e7eb] focus:border-primary focus:bg-white transition-colors"
                data-testid="input-min-size"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9ca3af] text-sm font-medium">m²</span>
            </div>
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#eceef1] p-4 z-10 shadow-[0_-2px_10px_rgba(0,0,0,0.04)]">
        <div className="max-w-xl mx-auto flex gap-3">
          <Button
            variant="outline"
            size="lg"
            className="h-[52px] px-6 rounded-xl text-[15px] font-semibold border-[#d1d5db] text-[#4a5568] hover:bg-[#f5f6f8]"
            onClick={handleBack}
            data-testid="button-back-filters"
          >
            Terug
          </Button>
          <Button
            size="lg"
            className="flex-1 h-[52px] rounded-xl text-[16px] font-semibold shadow-none bg-primary hover:bg-primary/90"
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
