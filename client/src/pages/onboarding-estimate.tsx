import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Home, ChevronLeft, TrendingUp, Loader2, Sparkles } from "lucide-react";
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

  const filterChips = [
    { label: city, show: !!city, testId: "tag-city" },
    { label: `Vanaf €${minPrice}`, show: !!minPrice, testId: "tag-min-price" },
    { label: `Tot €${maxPrice}`, show: !!maxPrice, testId: "tag-max-price" },
    { label: `${minRooms}+ slaapkamers`, show: !!minRooms && minRooms !== "any", testId: "tag-bedrooms" },
    { label: `${minSize}+ m²`, show: !!minSize, testId: "tag-size" },
  ].filter((c) => c.show);

  return (
    <div className="min-h-screen bg-[#f5f6f8] flex flex-col">
      <header className="w-full bg-white sticky top-0 z-20 shadow-sm">
        <div className="max-w-xl mx-auto px-5 h-14 flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-[#f5f6f8] transition-colors"
            data-testid="button-back-filters"
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
                className="h-full rounded-full w-full bg-primary"
                data-testid={`progress-step-${step}`}
              />
            </div>
          ))}
        </div>
        <p className="text-xs font-medium text-[#9ca3af] mt-2" data-testid="text-step-indicator">Stap 3 van 3</p>
      </div>

      <main className="flex-1 max-w-xl mx-auto w-full px-5 pb-32 pt-4 flex flex-col">
        <h1 className="text-[26px] font-extrabold text-[#1a2744] leading-tight mb-2 text-center" data-testid="text-estimate-title">
          Jouw schatting
        </h1>
        <p className="text-[15px] text-[#6b7280] text-center mb-6">
          Op basis van jouw zoekcriteria in <span className="font-semibold text-[#1a2744]">{city}</span>
        </p>

        <div className="bg-white rounded-2xl shadow-md border border-[#eceef1] p-8 mb-5 text-center" data-testid="card-estimate">
          <div className="w-16 h-16 rounded-2xl bg-[#eef2ff] flex items-center justify-center mx-auto mb-5">
            <TrendingUp className="w-8 h-8 text-primary" />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : (
            <>
              <p className="text-6xl font-extrabold text-[#1a2744] mb-4 tabular-nums" data-testid="text-estimate-number">
                {estimate}
              </p>
              <p className="text-base text-[#4a5568] leading-relaxed max-w-sm mx-auto" data-testid="text-estimate-description">
                Met jouw zoekcriteria verwachten we ongeveer{" "}
                <span className="font-bold text-[#1a2744]">{estimate} nieuwe woningen</span>{" "}
                per week.
              </p>
            </>
          )}
        </div>

        {filterChips.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-[#eceef1] p-5 mb-5">
            <p className="text-sm font-semibold text-[#1a2744] mb-3">Jouw filters</p>
            <div className="flex flex-wrap gap-2">
              {filterChips.map((chip) => (
                <span
                  key={chip.testId}
                  className="px-3.5 py-1.5 bg-[#f7f8fa] rounded-lg text-sm font-medium text-[#4a5568] border border-[#e5e7eb]"
                  data-testid={chip.testId}
                >
                  {chip.label}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="bg-[#f0f4ff] rounded-2xl p-5 border border-[#dce3f5] flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-sm text-[#4a5568] leading-relaxed">
            Maak een account aan en we sturen je direct een melding als er een woning beschikbaar komt die aan je criteria voldoet.
          </p>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#eceef1] p-4 z-10 shadow-[0_-2px_10px_rgba(0,0,0,0.04)]">
        <div className="max-w-xl mx-auto flex gap-3">
          <Button
            variant="outline"
            size="lg"
            className="h-[52px] px-6 rounded-xl text-[15px] font-semibold border-[#d1d5db] text-[#4a5568] hover:bg-[#f5f6f8]"
            onClick={handleBack}
            data-testid="button-back-estimate"
          >
            Terug
          </Button>
          <Button
            size="lg"
            className="flex-1 h-[52px] rounded-xl text-[15px] font-semibold shadow-none bg-primary hover:bg-primary/90"
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
