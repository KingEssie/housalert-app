import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Home, ChevronLeft, TrendingUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OnboardingEstimatePage() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
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

        const res = await fetch(`/api/estimate?${p.toString()}`);
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

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="w-full bg-white/90 backdrop-blur-sm sticky top-0 z-20 border-b border-gray-100">
        <div className="max-w-xl mx-auto px-5 h-14 flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100 transition-colors"
            data-testid="button-back-filters"
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
              className="h-1.5 flex-1 rounded-full bg-primary"
              data-testid={`progress-step-${step}`}
            />
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1" data-testid="text-step-indicator">Stap 3 van 3</p>
      </div>

      <main className="flex-1 max-w-xl mx-auto w-full px-5 pb-32 flex flex-col items-center justify-center">
        <div className="w-full">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2" data-testid="text-estimate-title">
              Jouw schatting
            </h1>
            <p className="text-gray-500">
              Op basis van jouw zoekcriteria in <span className="font-medium text-gray-700">{city}</span>
            </p>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 mb-6 text-center" data-testid="card-estimate">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
              <TrendingUp className="w-8 h-8 text-primary" />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : (
              <>
                <p className="text-5xl font-extrabold text-gray-900 mb-3" data-testid="text-estimate-number">
                  {estimate}
                </p>
                <p className="text-lg text-gray-600 leading-relaxed" data-testid="text-estimate-description">
                  Met jouw zoekcriteria verwachten we ongeveer <span className="font-bold text-gray-900">{estimate} nieuwe woningen</span> per week.
                </p>
              </>
            )}
          </div>

          <div className="bg-gray-50 rounded-2xl p-5 mb-6">
            <p className="text-sm font-medium text-gray-700 mb-3">Jouw filters</p>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1.5 bg-white rounded-lg text-sm text-gray-600 border border-gray-200" data-testid="tag-city">
                {city}
              </span>
              {minPrice && (
                <span className="px-3 py-1.5 bg-white rounded-lg text-sm text-gray-600 border border-gray-200" data-testid="tag-min-price">
                  Vanaf €{minPrice}
                </span>
              )}
              {maxPrice && (
                <span className="px-3 py-1.5 bg-white rounded-lg text-sm text-gray-600 border border-gray-200" data-testid="tag-max-price">
                  Tot €{maxPrice}
                </span>
              )}
              {minRooms && minRooms !== "any" && (
                <span className="px-3 py-1.5 bg-white rounded-lg text-sm text-gray-600 border border-gray-200" data-testid="tag-bedrooms">
                  {minRooms}+ slaapkamers
                </span>
              )}
              {minSize && (
                <span className="px-3 py-1.5 bg-white rounded-lg text-sm text-gray-600 border border-gray-200" data-testid="tag-size">
                  {minSize}+ m²
                </span>
              )}
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
            data-testid="button-back-estimate"
          >
            Terug
          </Button>
          <Button
            size="lg"
            className="flex-1 h-14 rounded-xl text-lg font-semibold shadow-none"
            onClick={handleCreateAccount}
            disabled={loading}
            data-testid="button-create-account"
          >
            Maak account en ontvang deze woningen
          </Button>
        </div>
      </div>
    </div>
  );
}
