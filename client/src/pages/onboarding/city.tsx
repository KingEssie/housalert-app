import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "@/i18n";
import { ChevronLeft, Search, MapPin, Loader2 } from "lucide-react";
import { defaultCities } from "../../../../config/market";
import { OB, OBStickyBar } from "@/components/onboarding-ui";

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  address?: { city?: string; town?: string; village?: string; state?: string };
}

export default function OnboardingCity() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [selectedCity, setSelectedCity] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [nominatimResults, setNominatimResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const presetMatches = search.trim().length > 0
    ? defaultCities.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : defaultCities;

  const nominatimSearch = useCallback(async (q: string) => {
    if (q.length < 3) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=5&countrycodes=de`
      );
      const data: NominatimResult[] = await res.json();
      setNominatimResults(data.filter((r) => {
        const addr = r.address;
        return addr?.city || addr?.town || addr?.village;
      }));
    } catch {
      setNominatimResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCity) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (search.trim().length >= 3 && presetMatches.length === 0) {
      debounceRef.current = setTimeout(() => nominatimSearch(search.trim()), 400);
    } else {
      setNominatimResults([]);
    }
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, selectedCity, presetMatches.length, nominatimSearch]);

  function selectPresetCity(city: typeof defaultCities[0]) {
    setSelectedCity({ name: city.name, lat: city.lat, lng: city.lng });
    setSearch(city.name);
    setNominatimResults([]);
  }

  function selectNominatimCity(result: NominatimResult) {
    const addr = result.address;
    const name = addr?.city || addr?.town || addr?.village || result.display_name.split(",")[0];
    setSelectedCity({ name, lat: parseFloat(result.lat), lng: parseFloat(result.lon) });
    setSearch(name);
    setNominatimResults([]);
  }

  function handleNext() {
    if (!selectedCity) return;
    const params = new URLSearchParams({
      city: selectedCity.name,
      lat: String(selectedCity.lat),
      lng: String(selectedCity.lng),
    });
    navigate(`/onboarding/location?${params.toString()}`);
  }

  function handleBack() {
    navigate("/onboarding/intro");
  }

  const showDropdown = !selectedCity;

  return (
    <div className="min-h-[100dvh] flex flex-col ob-dark" style={{ background: OB.gradient }} data-testid="screen-onboarding-city">
      <main className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-5 pt-[max(24px,env(safe-area-inset-top))] pb-[100px]">
        <span
          className="text-[12px] font-bold tracking-wider mb-4 inline-block self-start px-2.5 py-1 rounded-[4px]"
          style={{ color: OB.textSecondary, backgroundColor: "rgba(255,255,255,0.08)" }}
          data-testid="badge-step"
        >
          1/3
        </span>

        <h1 className="text-[24px] font-bold tracking-[-0.02em] mb-2" style={{ color: OB.text }} data-testid="text-city-title">
          {t("onboarding.location.title") || "Zoekopdracht maken"}
        </h1>
        <p className="text-[14px] mb-5" style={{ color: OB.textSecondary }}>
          {t("onboarding.location.subtitle") || "In welke stad zoek je een woning?"}
        </p>

        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px]" style={{ color: "rgba(255,255,255,0.5)" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (selectedCity) setSelectedCity(null);
            }}
            placeholder={t("onboarding.location.searchPlaceholder") || "Stad zoeken..."}
            className="ob-input w-full h-[56px] pl-12 pr-4 rounded-[6px] text-[15px] font-medium"
            style={selectedCity ? { borderColor: OB.pink } : undefined}
            autoFocus
            data-testid="input-city-search"
          />
          {searching && (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin" style={{ color: "rgba(255,255,255,0.5)" }} />
          )}
        </div>

        {showDropdown && (
          <div className="rounded-[6px] border overflow-hidden mb-4" style={{ backgroundColor: OB.card, borderColor: OB.cardBorder }} data-testid="city-results">
            {presetMatches.map((city) => (
              <button
                key={city.name}
                onClick={() => selectPresetCity(city)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors border-b last:border-b-0 hover:bg-white/5"
                style={{ borderColor: OB.divider }}
                data-testid={`city-option-${city.name}`}
              >
                <MapPin className="w-4 h-4 shrink-0" style={{ color: OB.textSecondary }} />
                <span className="text-[14px] font-medium" style={{ color: OB.text }}>{city.name}</span>
              </button>
            ))}

            {presetMatches.length === 0 && nominatimResults.length > 0 && nominatimResults.map((r, i) => {
              const addr = r.address;
              const name = addr?.city || addr?.town || addr?.village || r.display_name.split(",")[0];
              return (
                <button
                  key={i}
                  onClick={() => selectNominatimCity(r)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors border-b last:border-b-0 hover:bg-white/5"
                  style={{ borderColor: OB.divider }}
                  data-testid={`city-nominatim-${i}`}
                >
                  <MapPin className="w-4 h-4 shrink-0" style={{ color: OB.textSecondary }} />
                  <div>
                    <span className="text-[14px] font-medium block" style={{ color: OB.text }}>{name}</span>
                    {addr?.state && (
                      <span className="text-[12px]" style={{ color: OB.textSecondary }}>{addr.state}</span>
                    )}
                  </div>
                </button>
              );
            })}

            {presetMatches.length === 0 && nominatimResults.length === 0 && !searching && search.trim().length >= 3 && (
              <p className="text-[13px] text-center py-4" style={{ color: OB.textSecondary }}>
                {t("onboarding.location.noResults") || "Geen resultaten"}
              </p>
            )}
          </div>
        )}

        {selectedCity && (
          <div className="rounded-[6px] border p-4 mb-6 flex items-center gap-3" style={{ backgroundColor: OB.card, borderColor: OB.cardBorder }} data-testid="city-selected">
            <div className="w-10 h-10 rounded-[6px] flex items-center justify-center" style={{ backgroundColor: OB.accentBg }}>
              <MapPin className="w-5 h-5" style={{ color: OB.pink }} />
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-semibold" style={{ color: OB.text }}>{selectedCity.name}</p>
              <p className="text-[12px]" style={{ color: OB.textSecondary }}>{t("common.germany") || "Deutschland"}</p>
            </div>
            <button
              onClick={() => { setSelectedCity(null); setSearch(""); }}
              className="text-[13px] font-medium px-3 py-1.5 rounded-[6px] border transition-colors hover:bg-white/5"
              style={{ borderColor: OB.cardBorder, color: OB.textSecondary }}
              data-testid="button-city-change"
            >
              {t("common.edit") || "Wijzig"}
            </button>
          </div>
        )}
      </main>

      <div className="fixed bottom-[max(24px,env(safe-area-inset-bottom))] left-5 z-30">
        <button
          onClick={handleBack}
          className="w-12 h-12 rounded-full flex items-center justify-center active:scale-95 transition-transform backdrop-blur-md shadow-lg"
          style={{ backgroundColor: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.1)" }}
          data-testid="button-city-back"
        >
          <ChevronLeft className="w-5 h-5" style={{ color: OB.text }} />
        </button>
      </div>

      {selectedCity && (
        <OBStickyBar>
          <button
            onClick={handleNext}
            className="w-full h-[56px] rounded-[6px] text-[15px] font-bold text-white transition-all active:scale-[0.97]"
            style={{ background: OB.pinkGradient, boxShadow: OB.pinkShadow }}
            data-testid="button-city-next"
          >
            {t("common.next") || "Volgende"}
          </button>
        </OBStickyBar>
      )}
    </div>
  );
}
