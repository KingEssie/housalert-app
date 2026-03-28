import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "@/i18n";
import { Search, MapPin, Loader2, X, ChevronLeft } from "lucide-react";
import { defaultCities } from "../../../../config/market";
import { OB } from "@/components/onboarding-ui";

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

  function handleClose() {
    navigate("/");
  }

  const showDropdown = !selectedCity;

  return (
    <div className="min-h-[100dvh] flex flex-col ob-dark" style={{ background: OB.gradient }} data-testid="screen-onboarding-city">
      <header
        className="w-full sticky top-0 z-20 border-b"
        style={{ backgroundColor: OB.headerBg, borderColor: OB.headerBorder, paddingTop: "max(8px, env(safe-area-inset-top))" }}
      >
        <div className="max-w-[480px] mx-auto px-5 h-[52px] flex items-center justify-between">
          <span
            className="text-[12px] font-semibold px-2.5 py-1 rounded-[8px]"
            style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "#ffffff" }}
            data-testid="badge-step"
          >
            1/4
          </span>
          <span className="text-[18px] font-semibold" style={{ color: OB.text }}>
            {t("onboarding.location.headerTitle") || "Zoekopdracht maken"}
          </span>
          <button
            onClick={handleClose}
            className="w-[36px] h-[36px] rounded-full flex items-center justify-center active:scale-95 transition-transform"
            style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
            data-testid="button-city-close"
          >
            <X className="w-4 h-4" style={{ color: OB.textSecondary }} />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-5 pt-5 pb-[120px] overflow-y-auto">
        <h2
          className="text-[18px] font-semibold mb-4"
          style={{ color: OB.text }}
          data-testid="text-city-title"
        >
          {t("onboarding.location.sectionTitle") || "Locatie"}
        </h2>

        <div className="relative mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (selectedCity) setSelectedCity(null);
            }}
            placeholder={t("onboarding.location.searchPlaceholder") || "Locatie"}
            className="w-full h-[48px] pl-4 pr-12 rounded-[10px] text-[15px] font-medium outline-none"
            style={{
              backgroundColor: "transparent",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "#ffffff",
            }}
            autoFocus
            data-testid="input-city-search"
          />
          {searching ? (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] animate-spin" style={{ color: "rgba(255,255,255,0.6)" }} />
          ) : (
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px]" style={{ color: "rgba(255,255,255,0.6)" }} />
          )}
        </div>

        {showDropdown && (
          <div data-testid="city-results">
            {presetMatches.map((city, i) => (
              <button
                key={city.name}
                onClick={() => selectPresetCity(city)}
                className="w-full flex items-center gap-3 py-3.5 text-left transition-colors hover:bg-white/5"
                style={{ borderBottom: i < presetMatches.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none" }}
                data-testid={`city-option-${city.name}`}
              >
                <MapPin className="w-[18px] h-[18px] shrink-0" style={{ color: "#38bdf8" }} />
                <span className="text-[16px] font-medium" style={{ color: OB.text }}>{city.name}</span>
              </button>
            ))}

            {presetMatches.length === 0 && nominatimResults.length > 0 && nominatimResults.map((r, i) => {
              const addr = r.address;
              const name = addr?.city || addr?.town || addr?.village || r.display_name.split(",")[0];
              return (
                <button
                  key={i}
                  onClick={() => selectNominatimCity(r)}
                  className="w-full flex items-center gap-3 py-3.5 text-left transition-colors hover:bg-white/5"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
                  data-testid={`city-nominatim-${i}`}
                >
                  <MapPin className="w-[18px] h-[18px] shrink-0" style={{ color: "#38bdf8" }} />
                  <div>
                    <span className="text-[16px] font-medium block" style={{ color: OB.text }}>{name}</span>
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
          <div
            className="flex items-center gap-3 py-3.5"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
            data-testid="city-selected"
          >
            <MapPin className="w-[18px] h-[18px] shrink-0" style={{ color: "#38bdf8" }} />
            <span className="text-[16px] font-medium flex-1" style={{ color: OB.text }}>{selectedCity.name}</span>
            <button
              onClick={() => { setSelectedCity(null); setSearch(""); }}
              className="text-[13px] font-medium px-3 py-1.5 rounded-[6px] transition-colors hover:bg-white/5"
              style={{ color: OB.textSecondary }}
              data-testid="button-city-change"
            >
              {t("common.edit") || "Wijzig"}
            </button>
          </div>
        )}
      </main>

      <div
        className="fixed bottom-0 left-0 right-0 z-30"
        style={{
          borderTop: "1px solid rgba(255,255,255,0.08)",
          backgroundColor: "rgba(10,10,30,0.4)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          paddingBottom: "max(8px, env(safe-area-inset-bottom, 8px))",
        }}
      >
        <div className="max-w-[480px] mx-auto px-5 pt-3 flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-[48px] h-[48px] rounded-[12px] flex items-center justify-center shrink-0 active:scale-95 transition-transform"
            style={{
              border: "1.5px solid rgba(255,255,255,0.25)",
              backgroundColor: "transparent",
            }}
            data-testid="button-city-back"
          >
            <ChevronLeft className="w-[18px] h-[18px]" style={{ color: OB.text }} />
          </button>
          <button
            onClick={handleNext}
            disabled={!selectedCity}
            className="flex-1 h-[52px] rounded-[14px] text-[15px] font-semibold text-white transition-all active:scale-[0.97] disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ background: OB.pinkGradient, boxShadow: "0 8px 20px rgba(255,0,100,0.25)" }}
            data-testid="button-city-next"
          >
            {t("common.next") || "Volgende"}
          </button>
        </div>
      </div>
    </div>
  );
}
