import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "@/i18n";
import { HousAlertLogo } from "@/components/housalert-logo";
import { ChevronLeft, Search, MapPin, Loader2 } from "lucide-react";
import { defaultCities } from "../../../../config/market";

const BRAND = "rgb(var(--ha-primary))";
const BRAND_HOVER = "rgb(var(--ha-primary-hover))";
const TEXT_SECONDARY = "rgb(var(--ha-text-secondary))";
const BORDER = "rgb(var(--ha-card-border))";

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-1.5 justify-center py-3" data-testid="progress-dots">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="h-[6px] rounded-full transition-all"
          style={{
            width: i === current ? 24 : 6,
            backgroundColor: i <= current ? BRAND : "rgba(var(--ha-text-rgb, 26,26,46), 0.12)",
          }}
        />
      ))}
    </div>
  );
}

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
    <div className="min-h-[100dvh] flex flex-col bg-ha-bg" data-testid="screen-onboarding-city">
      <header className="sticky top-0 z-20 bg-ha-card border-b border-ha-card-border">
        <div className="max-w-[480px] mx-auto px-5 h-[56px] flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-10 h-10 rounded-full bg-ha-surface flex items-center justify-center active:scale-95 transition-transform"
            data-testid="button-city-back"
          >
            <ChevronLeft className="w-5 h-5 text-ha-text-muted" />
          </button>
          <div className="flex-1 flex justify-center">
            <HousAlertLogo size={28} />
          </div>
          <div className="w-10" />
        </div>
      </header>

      <div className="max-w-[480px] mx-auto px-5 w-full">
        <ProgressDots current={0} total={4} />
      </div>

      <main className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-5 pt-4 pb-8">
        <h1
          className="text-[24px] font-bold tracking-[-0.02em] text-ha-text mb-2"
          data-testid="text-city-title"
        >
          {t("onboarding.location.title") || "Wo möchtest du wohnen?"}
        </h1>
        <p className="text-[14px] text-ha-text-secondary mb-5">
          {t("onboarding.location.subtitle") || "Wähle deine Stadt."}
        </p>

        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-ha-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (selectedCity) setSelectedCity(null);
            }}
            placeholder={t("onboarding.location.searchPlaceholder") || "Stadt suchen..."}
            className="w-full h-[48px] pl-11 pr-4 rounded-[6px] border bg-ha-card text-[15px] font-medium text-ha-text placeholder:text-ha-text-muted focus:border-ha-primary outline-none transition-all"
            style={{ borderColor: selectedCity ? BRAND : BORDER }}
            autoFocus
            data-testid="input-city-search"
          />
          {searching && (
            <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-ha-text-muted" />
          )}
        </div>

        {showDropdown && (
          <div className="bg-ha-card rounded-[6px] border border-ha-card-border overflow-hidden mb-4" data-testid="city-results">
            {presetMatches.map((city) => (
              <button
                key={city.name}
                onClick={() => selectPresetCity(city)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-ha-surface transition-colors border-b border-ha-card-border last:border-b-0"
                data-testid={`city-option-${city.name}`}
              >
                <MapPin className="w-4 h-4 text-ha-text-muted shrink-0" />
                <span className="text-[14px] font-medium text-ha-text">{city.name}</span>
              </button>
            ))}

            {presetMatches.length === 0 && nominatimResults.length > 0 && nominatimResults.map((r, i) => {
              const addr = r.address;
              const name = addr?.city || addr?.town || addr?.village || r.display_name.split(",")[0];
              return (
                <button
                  key={i}
                  onClick={() => selectNominatimCity(r)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-ha-surface transition-colors border-b border-ha-card-border last:border-b-0"
                  data-testid={`city-nominatim-${i}`}
                >
                  <MapPin className="w-4 h-4 text-ha-text-muted shrink-0" />
                  <div>
                    <span className="text-[14px] font-medium text-ha-text block">{name}</span>
                    {addr?.state && (
                      <span className="text-[12px] text-ha-text-muted">{addr.state}</span>
                    )}
                  </div>
                </button>
              );
            })}

            {presetMatches.length === 0 && nominatimResults.length === 0 && !searching && search.trim().length >= 3 && (
              <p className="text-[13px] text-ha-text-muted text-center py-4">
                {t("onboarding.location.noResults") || "Keine Ergebnisse"}
              </p>
            )}
          </div>
        )}

        {selectedCity && (
          <div className="bg-ha-card rounded-[6px] border border-ha-card-border p-4 mb-6 flex items-center gap-3" data-testid="city-selected">
            <div
              className="w-10 h-10 rounded-[6px] flex items-center justify-center"
              style={{ backgroundColor: "rgba(var(--ha-primary-rgb, 233,30,99), 0.08)" }}
            >
              <MapPin className="w-5 h-5" style={{ color: BRAND }} />
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-semibold text-ha-text">{selectedCity.name}</p>
              <p className="text-[12px] text-ha-text-muted">Deutschland</p>
            </div>
            <button
              onClick={() => { setSelectedCity(null); setSearch(""); }}
              className="text-[13px] font-medium px-3 py-1.5 rounded-[6px] border transition-colors hover:bg-ha-surface"
              style={{ borderColor: BORDER, color: TEXT_SECONDARY }}
              data-testid="button-city-change"
            >
              {t("common.edit") || "Ändern"}
            </button>
          </div>
        )}

        {selectedCity && (
          <div className="mt-auto pt-6">
            <button
              onClick={handleNext}
              className="w-full h-[52px] rounded-[6px] text-[15px] font-bold text-white transition-all active:scale-[0.97]"
              style={{ backgroundColor: BRAND }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = BRAND_HOVER)}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = BRAND)}
              data-testid="button-city-next"
            >
              {t("common.next") || "Weiter"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
