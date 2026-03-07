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
    <div className="min-h-screen bg-white flex flex-col">
      <header className="w-full bg-white sticky top-0 z-20 border-b border-[#E5E7EB]">
        <div className="max-w-xl mx-auto px-6 h-[60px] flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-10 h-10 rounded-full bg-[#F3F4F6] flex items-center justify-center hover:bg-[#E5E7EB] transition-colors"
            data-testid="button-back-filters"
          >
            <ChevronLeft className="w-5 h-5 text-[#6B7280]" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#673DE6] flex items-center justify-center">
              <Home className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-[#1F2937] text-base">Stekkies</span>
          </div>
        </div>
      </header>

      <div className="max-w-xl mx-auto w-full px-6 pt-6 pb-2">
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex-1 h-2 rounded-full overflow-hidden bg-[#E5E7EB]">
              <div
                className="h-full rounded-full w-full bg-[#673DE6]"
                data-testid={`progress-step-${step}`}
              />
            </div>
          ))}
        </div>
        <p className="text-xs font-medium text-[#6B7280] mt-2" data-testid="text-step-indicator">Stap 3 van 3</p>
      </div>

      <main className="flex-1 max-w-xl mx-auto w-full px-6 pb-8 pt-4 flex flex-col">
        <h1 className="text-[32px] font-[800] text-[#1F2937] leading-[1.1] tracking-[-0.03em] mb-3 text-center" data-testid="text-estimate-title">
          Jouw schatting
        </h1>
        <p className="text-[15px] text-[#6B7280] text-center mb-6">
          Op basis van jouw zoekcriteria in <span className="font-semibold text-[#1F2937]">{city}</span>
        </p>

        <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6" data-testid="card-estimate">
          <div className="text-center py-4 border-b border-[#E5E7EB]">
            <div className="w-14 h-14 rounded-2xl bg-[#EDE9FB] flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-7 h-7 text-[#673DE6]" />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-8 h-8 text-[#673DE6] animate-spin" />
              </div>
            ) : (
              <>
                <p className="text-6xl font-extrabold text-[#1F2937] mb-3 tabular-nums" data-testid="text-estimate-number">
                  {estimate}
                </p>
                <p className="text-base text-[#6B7280] leading-relaxed max-w-sm mx-auto" data-testid="text-estimate-description">
                  Met jouw zoekcriteria verwachten we ongeveer{" "}
                  <span className="font-bold text-[#1F2937]">{estimate} nieuwe woningen</span>{" "}
                  per week.
                </p>
              </>
            )}
          </div>

          {filterChips.length > 0 && (
            <div className="py-5 border-b border-[#E5E7EB]">
              <p className="text-sm font-semibold text-[#1F2937] mb-3">Jouw filters</p>
              <div className="flex flex-wrap gap-2">
                {filterChips.map((chip) => (
                  <span
                    key={chip.testId}
                    className="px-3.5 py-1.5 bg-[#F3F4F6] rounded-full text-sm font-medium text-[#1F2937]"
                    data-testid={chip.testId}
                  >
                    {chip.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-start gap-3 py-5 border-b border-[#E5E7EB]">
            <Sparkles className="w-5 h-5 text-[#673DE6] flex-shrink-0 mt-0.5" />
            <p className="text-sm text-[#6B7280] leading-relaxed">
              Maak een account aan en we sturen je direct een melding als er een woning beschikbaar komt die aan je criteria voldoet.
            </p>
          </div>

          <div className="pt-6 flex gap-3">
            <Button
              variant="outline"
              size="lg"
              className="h-[48px] px-6 rounded-xl text-[15px] font-semibold border-[#E5E7EB] text-[#1F2937] hover:bg-[#F3F4F6]"
              onClick={handleBack}
              data-testid="button-back-estimate"
            >
              Terug
            </Button>
            <Button
              size="lg"
              className="flex-1 h-[56px] rounded-xl text-[16px] font-semibold shadow-none bg-[#673DE6] hover:bg-[#5B30D6]"
              onClick={handleCreateAccount}
              disabled={loading}
              data-testid="button-create-account"
            >
              Maak account en ontvang deze woningen
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
