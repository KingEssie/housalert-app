import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "@/i18n";
import { HousAlertLogo } from "@/components/housalert-logo";
import { ChevronLeft, Search, MapPin, Loader2 } from "lucide-react";
import { defaultCities } from "../../../../config/market";
import { OB, OBProgressDots, OBStickyBar } from "@/components/onboarding-ui";

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

  const showDropdown = !selectedCity && search.trim().length > 0;

  return (
    <div className="min-h-[100dvh] flex flex-col ob-dark" style={{ background: OB.gradient }} data-testid="screen-onboarding-city">
      <header className="sticky top-0 z-20 backdrop-blur-md border-b" style={{ backgroundColor: OB.headerBg, borderColor: OB.headerBorder }}>
        <div className="max-w-[480px] mx-auto px-5 h-[56px] flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-transform"
            style={{ backgroundColor: OB.backBtnBg }}
            data-testid="button-city-back"
          >
            <ChevronLeft className="w-5 h-5" style={{ color: OB.textSecondary }} />
          </button>
          <div className="flex-1 flex justify-center">
            <HousAlertLogo size={28} />
          </div>
          <div className="w-10" />
        </div>
      </header>

      <div className="max-w-[480px] mx-auto px-5 w-full">
        <OBProgressDots current={0} total={4} />
      </div>

      <main className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-5 pt-4 pb-[100px]">
        <h1 className="text-[24px] font-bold tracking-[-0.02em] mb-2" style={{ color: OB.text }} data-testid="text-city-title">
          {t("onboarding.location.title") || "Wo möchtest du wohnen?"}
        </h1>
        <p className="text-[14px] mb-5" style={{ color: OB.textSecondary }}>
          {t("onboarding.location.subtitle") || "Wähle deine Stadt."}
        </p>

        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px]" style={{ color: "#999" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (selectedCity) setSelectedCity(null);
            }}
            placeholder={t("onboarding.location.searchPlaceholder") || "Stadt suchen..."}
            className="ob-input w-full h-[56px] pl-12 pr-4 rounded-[6px] text-[15px] font-medium"
            style={selectedCity ? { borderColor: OB.pink } : undefined}
            autoFocus
            data-testid="input-city-search"
          />
          {searching && (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin" style={{ color: "#999" }} />
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
                <MapPin className="w-4 h-4 shrink-0" style={{ color: OB.textMuted }} />
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
                  <MapPin className="w-4 h-4 shrink-0" style={{ color: OB.textMuted }} />
                  <div>
                    <span className="text-[14px] font-medium block" style={{ color: OB.text }}>{name}</span>
                    {addr?.state && (
                      <span className="text-[12px]" style={{ color: OB.textMuted }}>{addr.state}</span>
                    )}
                  </div>
                </button>
              );
            })}

            {presetMatches.length === 0 && nominatimResults.length === 0 && !searching && search.trim().length >= 3 && (
              <p className="text-[13px] text-center py-4" style={{ color: OB.textMuted }}>
                {t("onboarding.location.noResults") || "Keine Ergebnisse"}
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
              <p className="text-[12px]" style={{ color: OB.textMuted }}>Deutschland</p>
            </div>
            <button
              onClick={() => { setSelectedCity(null); setSearch(""); }}
              className="text-[13px] font-medium px-3 py-1.5 rounded-[6px] border transition-colors hover:bg-white/5"
              style={{ borderColor: OB.cardBorder, color: OB.textSecondary }}
              data-testid="button-city-change"
            >
              {t("common.edit") || "Ändern"}
            </button>
          </div>
        )}
      </main>

      {selectedCity && (
        <OBStickyBar>
          <button
            onClick={handleNext}
            className="w-full h-[56px] rounded-[6px] text-[15px] font-bold text-white transition-all active:scale-[0.97]"
            style={{ background: OB.pinkGradient, boxShadow: OB.pinkShadow }}
            data-testid="button-city-next"
          >
            {t("common.next") || "Weiter"}
          </button>
        </OBStickyBar>
      )}
    </div>
  );
}
