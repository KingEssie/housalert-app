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
    if (bedrooms) p.set("minRooms", bedrooms);
    if (minSize) p.set("minSize", minSize);
    navigate(`/onboarding/estimate?${p.toString()}`);
  }

  function handleBack() {
    navigate("/onboarding/location");
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="w-full bg-white/90 backdrop-blur-sm sticky top-0 z-20 border-b border-gray-100">
        <div className="max-w-xl mx-auto px-5 h-14 flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100 transition-colors"
            data-testid="button-back-location"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Home className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-base">Stekkies</span>
          </div>
        </div>
      </header>

      <div className="max-w-xl mx-auto w-full px-5 pt-6 pb-3">
        <div className="flex items-center gap-2 mb-1">
          {[1, 2, 3].map((step) => (
            <div
              key={step}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                step <= 2 ? "bg-primary" : "bg-gray-200"
              }`}
              data-testid={`progress-step-${step}`}
            />
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1" data-testid="text-step-indicator">Stap 2 van 3</p>
      </div>

      <main className="flex-1 max-w-xl mx-auto w-full px-5 pb-32">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2" data-testid="text-filters-title">
            Wat zoek je precies?
          </h1>
          <p className="text-gray-500">
            Verfijn je zoekopdracht voor <span className="font-medium text-gray-700">{city}</span>. Alle velden zijn optioneel.
          </p>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="minPrice" className="text-sm font-medium text-gray-700">
                Min. prijs
              </Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
                <Input
                  id="minPrice"
                  type="number"
                  placeholder="0"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="h-14 pl-8 rounded-xl text-base border-gray-200 focus:border-primary"
                  data-testid="input-min-price"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxPrice" className="text-sm font-medium text-gray-700">
                Max. prijs
              </Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
                <Input
                  id="maxPrice"
                  type="number"
                  placeholder="2000"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="h-14 pl-8 rounded-xl text-base border-gray-200 focus:border-primary"
                  data-testid="input-max-price"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bedrooms" className="text-sm font-medium text-gray-700">
              Slaapkamers
            </Label>
            <Select value={bedrooms} onValueChange={setBedrooms}>
              <SelectTrigger
                className="h-14 rounded-xl text-base border-gray-200 focus:border-primary"
                data-testid="select-bedrooms"
              >
                <SelectValue placeholder="Maakt niet uit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Maakt niet uit</SelectItem>
                <SelectItem value="1">1+</SelectItem>
                <SelectItem value="2">2+</SelectItem>
                <SelectItem value="3">3+</SelectItem>
                <SelectItem value="4">4+</SelectItem>
                <SelectItem value="5">5+</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="minSize" className="text-sm font-medium text-gray-700">
              Min. oppervlakte
            </Label>
            <div className="relative">
              <Input
                id="minSize"
                type="number"
                placeholder="0"
                value={minSize}
                onChange={(e) => setMinSize(e.target.value)}
                className="h-14 pr-12 rounded-xl text-base border-gray-200 focus:border-primary"
                data-testid="input-min-size"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">m²</span>
            </div>
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-5 z-10">
        <div className="max-w-xl mx-auto flex gap-3">
          <Button
            variant="outline"
            size="lg"
            className="h-14 px-6 rounded-xl text-base font-medium border-gray-200"
            onClick={handleBack}
            data-testid="button-back-filters"
          >
            Terug
          </Button>
          <Button
            size="lg"
            className="flex-1 h-14 rounded-xl text-lg font-semibold shadow-none"
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
