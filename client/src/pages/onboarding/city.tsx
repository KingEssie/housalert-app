import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Search, MapPin, Loader2, X, ChevronLeft } from "lucide-react";
import { defaultCities } from "../../../../config/market";
import { OB } from "@/components/onboarding-ui";

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  address?: { city?: string; town?: string; village?: string; state?: string };
}

const TOP_CITIES = defaultCities.slice(0, 5);

export default function OnboardingCity() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [selectedCity, setSelectedCity] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [nominatimResults, setNominatimResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const presetMatches = search.trim().length > 0
    ? TOP_CITIES.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : TOP_CITIES;

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

  function goToStep2(city: { name: string; lat: number; lng: number }) {
    const params = new URLSearchParams({
      city: city.name,
      lat: String(city.lat),
      lng: String(city.lng),
    });
    navigate(`/onboarding/location?${params.toString()}`);
  }

  function selectPresetCity(city: typeof TOP_CITIES[0]) {
    const selected = { name: city.name, lat: city.lat, lng: city.lng };
    setSelectedCity(selected);
    setSearch(city.name);
    setNominatimResults([]);
    goToStep2(selected);
  }

  function selectNominatimCity(result: NominatimResult) {
    const addr = result.address;
    const name = addr?.city || addr?.town || addr?.village || result.display_name.split(",")[0];
    const selected = { name, lat: parseFloat(result.lat), lng: parseFloat(result.lon) };
    setSelectedCity(selected);
    setSearch(name);
    setNominatimResults([]);
    goToStep2(selected);
  }

  function handleNext() {
    if (!selectedCity) return;
    goToStep2(selectedCity);
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
        className="w-full sticky top-0 z-20"
        style={{ backgroundColor: OB.headerBg, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingTop: "max(8px, env(safe-area-inset-top))" }}
      >
        <div className="max-w-[480px] mx-auto px-5 h-[52px] flex items-center justify-between">
          <span
            className="text-[12px] font-semibold px-2.5 py-1 rounded-[8px]"
            style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "#ffffff" }}
            data-testid="badge-step"
          >
            1/4
          </span>
          <span className="text-[18px] font-semibold" style={{ color: "#ffffff" }}>
            Zoekopdracht maken
          </span>
          <button
            onClick={handleClose}
            className="w-[36px] h-[36px] rounded-full flex items-center justify-center active:scale-95 transition-transform"
            style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
            data-testid="button-city-close"
          >
            <X className="w-4 h-4" style={{ color: "rgba(255,255,255,0.7)" }} />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-5 pb-[120px] overflow-y-auto">
        <h2
          className="text-[18px] font-semibold"
          style={{ color: "#ffffff", marginTop: "20px", marginBottom: "12px" }}
          data-testid="text-city-title"
        >
          Locatie
        </h2>

        <div className="relative" style={{ marginBottom: "18px" }}>
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (selectedCity) setSelectedCity(null);
            }}
            placeholder="Zoek stad..."
            className="w-full h-[56px] pl-4 pr-12 rounded-[6px] text-[15px] font-medium outline-none"
            style={{
              backgroundColor: "transparent",
              border: "1px solid rgba(255,255,255,0.7)",
              color: "#ffffff",
            }}
            autoFocus
            data-testid="input-city-search"
          />
          {searching ? (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] animate-spin" style={{ color: "rgba(255,255,255,0.7)" }} />
          ) : (
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px]" style={{ color: "rgba(255,255,255,0.7)" }} />
          )}
        </div>

        {showDropdown && (
          <div data-testid="city-results">
            {presetMatches.map((city, i) => (
              <button
                key={city.name}
                onClick={() => selectPresetCity(city)}
                className="w-full flex items-center gap-3 text-left transition-colors hover:bg-white/5"
                style={{
                  padding: "14px 0",
                  borderBottom: i < presetMatches.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none",
                }}
                data-testid={`city-option-${city.name}`}
              >
                <MapPin className="w-[18px] h-[18px] shrink-0" style={{ color: "#38bdf8" }} />
                <span className="text-[16px] font-medium" style={{ color: "#ffffff" }}>{city.name}</span>
              </button>
            ))}

            {presetMatches.length === 0 && nominatimResults.length > 0 && nominatimResults.map((r, i) => {
              const addr = r.address;
              const name = addr?.city || addr?.town || addr?.village || r.display_name.split(",")[0];
              return (
                <button
                  key={i}
                  onClick={() => selectNominatimCity(r)}
                  className="w-full flex items-center gap-3 text-left transition-colors hover:bg-white/5"
                  style={{
                    padding: "14px 0",
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                  }}
                  data-testid={`city-nominatim-${i}`}
                >
                  <MapPin className="w-[18px] h-[18px] shrink-0" style={{ color: "#38bdf8" }} />
                  <div>
                    <span className="text-[16px] font-medium block" style={{ color: "#ffffff" }}>{name}</span>
                    {addr?.state && (
                      <span className="text-[12px]" style={{ color: OB.textSecondary }}>{addr.state}</span>
                    )}
                  </div>
                </button>
              );
            })}

            {presetMatches.length === 0 && nominatimResults.length === 0 && !searching && search.trim().length >= 3 && (
              <p className="text-[13px] text-center py-4" style={{ color: OB.textSecondary }}>
                Geen resultaten
              </p>
            )}
          </div>
        )}

        {selectedCity && (
          <div
            className="flex items-center gap-3"
            style={{ padding: "14px 0", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
            data-testid="city-selected"
          >
            <MapPin className="w-[18px] h-[18px] shrink-0" style={{ color: "#38bdf8" }} />
            <span className="text-[16px] font-medium flex-1" style={{ color: "#ffffff" }}>{selectedCity.name}</span>
            <button
              onClick={() => { setSelectedCity(null); setSearch(""); }}
              className="text-[13px] font-medium px-3 py-1.5 rounded-[6px] transition-colors hover:bg-white/5"
              style={{ color: OB.textSecondary }}
              data-testid="button-city-change"
            >
              Wijzig
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
            <ChevronLeft className="w-[18px] h-[18px]" style={{ color: "#ffffff" }} />
          </button>
          <button
            onClick={handleNext}
            disabled={!selectedCity}
            className="flex-1 h-[48px] rounded-[12px] text-[15px] font-bold text-white transition-all active:scale-[0.97] disabled:opacity-40 flex items-center justify-center"
            style={{ background: OB.pinkGradient, boxShadow: "0 8px 20px rgba(255,0,100,0.25)" }}
            data-testid="button-city-next"
          >
            Volgende
          </button>
        </div>
      </div>
    </div>
  );
}
