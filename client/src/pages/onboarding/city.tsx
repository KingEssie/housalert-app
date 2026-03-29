import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useHashSearch } from "@/lib/hash-search";
import { Search, MapPin, Loader2, X } from "lucide-react";
import { defaultCities } from "../../../../config/market";
import { OB, OBW, ONBOARDING_TOTAL_STEPS, OBFooter, useWebsiteMode, appendWebsiteParams } from "@/components/onboarding-ui";

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  address?: { city?: string; town?: string; village?: string; state?: string };
}

const TOP_CITIES = defaultCities.slice(0, 5);

function parseAutostartCity(searchString: string): { name: string; lat: number; lng: number } | null {
  const params = new URLSearchParams(searchString);
  const city = params.get("city")?.trim();
  const lat = parseFloat(params.get("lat") || "");
  const lng = parseFloat(params.get("lng") || "");
  const autostart = params.get("autostart");
  if (!city || isNaN(lat) || isNaN(lng) || autostart !== "1") return null;
  return { name: city, lat, lng };
}

function getInitialCityFromQuery(searchString: string): { name: string; lat: number; lng: number } | null {
  const params = new URLSearchParams(searchString);
  const cityParam = params.get("city")?.trim();
  if (!cityParam) return null;
  const lat = parseFloat(params.get("lat") || "");
  const lng = parseFloat(params.get("lng") || "");
  if (!isNaN(lat) && !isNaN(lng)) return { name: cityParam, lat, lng };
  const match = defaultCities.find(
    (c) => c.name.toLowerCase() === cityParam.toLowerCase()
  );
  return match ? { name: match.name, lat: match.lat, lng: match.lng } : null;
}

function getInitialSearchFromQuery(searchString: string): string {
  const params = new URLSearchParams(searchString);
  return params.get("city")?.trim() || "";
}

export default function OnboardingCity() {
  const [, navigate] = useLocation();
  const searchString = useHashSearch();
  const w = useWebsiteMode();
  const T = w ? OBW : OB;
  const didAutostartRef = useRef(false);
  const [search, setSearch] = useState(() => getInitialSearchFromQuery(searchString));
  const [selectedCity, setSelectedCity] = useState<{ name: string; lat: number; lng: number } | null>(
    () => getInitialCityFromQuery(searchString)
  );
  const [nominatimResults, setNominatimResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didAutoSearchRef = useRef(false);

  useEffect(() => {
    if (didAutostartRef.current) return;
    const autostartCity = parseAutostartCity(searchString);
    if (!autostartCity) return;
    didAutostartRef.current = true;
    const step2Params = new URLSearchParams({
      city: autostartCity.name,
      lat: String(autostartCity.lat),
      lng: String(autostartCity.lng),
    });
    navigate(appendWebsiteParams(`/onboarding/location?${step2Params.toString()}`, searchString));
  }, [searchString, navigate]);

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
    if (didAutoSearchRef.current) { didAutoSearchRef.current = false; return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (search.trim().length >= 3 && presetMatches.length === 0) {
      debounceRef.current = setTimeout(() => nominatimSearch(search.trim()), 400);
    } else {
      setNominatimResults([]);
    }
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, selectedCity, presetMatches.length, nominatimSearch]);

  useEffect(() => {
    if (didAutoSearchRef.current) return;
    const params = new URLSearchParams(searchString);
    const cityParam = params.get("city")?.trim();
    if (!cityParam || cityParam.length < 3) return;
    const presetMatch = defaultCities.find(
      (c) => c.name.toLowerCase() === cityParam.toLowerCase()
    );
    if (presetMatch) return;
    didAutoSearchRef.current = true;
    nominatimSearch(cityParam);
  }, [searchString, nominatimSearch]);

  function goToStep2(city: { name: string; lat: number; lng: number }) {
    const params = new URLSearchParams({
      city: city.name,
      lat: String(city.lat),
      lng: String(city.lng),
    });
    navigate(appendWebsiteParams(`/onboarding/location?${params.toString()}`, searchString));
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
    <div
      className={`min-h-[100dvh] flex flex-col ${w ? "" : "ob-dark"}`}
      style={{ background: T.gradient, borderRadius: w ? 0 : undefined }}
      data-testid="screen-onboarding-city"
    >
      <header
        className="w-full sticky top-0 z-20"
        style={{
          backgroundColor: T.headerBg,
          borderBottom: `1px solid ${T.headerBorder}`,
          paddingTop: w ? "0px" : "max(8px, env(safe-area-inset-top))",
          borderRadius: w ? 0 : undefined,
        }}
      >
        <div className="max-w-[480px] mx-auto px-5 h-[52px] flex items-center justify-between">
          <span
            className="text-[12px] font-bold px-2.5 py-1 rounded-[6px]"
            style={{
              backgroundColor: w ? OBW.badgeBg : "rgba(56,189,248,0.15)",
              color: w ? OBW.badgeColor : "#38bdf8",
            }}
            data-testid="badge-step"
          >
            {`1/${ONBOARDING_TOTAL_STEPS}`}
          </span>
          <span className="text-[18px] font-semibold" style={{ color: T.text }}>
            Zoekopdracht maken
          </span>
          <button
            onClick={handleClose}
            className="w-[36px] h-[36px] rounded-full flex items-center justify-center active:scale-95 transition-transform"
            style={{ backgroundColor: w ? OBW.closeBtnBg : "rgba(255,255,255,0.08)" }}
            data-testid="button-city-close"
          >
            <X className="w-4 h-4" style={{ color: w ? OBW.closeBtnColor : "rgba(255,255,255,0.7)" }} />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-5 pb-[120px] overflow-y-auto">
        <h2
          className="text-[18px] font-semibold"
          style={{ color: T.text, marginTop: "20px", marginBottom: "12px" }}
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
            className={`w-full pr-12 ${w ? "ha-field" : "ha-field ha-field-dark"}`}
            style={w ? { backgroundColor: OBW.inputBg, borderColor: OBW.inputBorder, color: OBW.text } : undefined}
            autoFocus
            data-testid="input-city-search"
          />
          {searching ? (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] animate-spin" style={{ color: T.textSecondary }} />
          ) : (
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px]" style={{ color: T.textSecondary }} />
          )}
        </div>

        {showDropdown && (
          <div data-testid="city-results">
            {presetMatches.map((city, i) => (
              <button
                key={city.name}
                onClick={() => selectPresetCity(city)}
                className={`w-full flex items-center gap-3 text-left transition-colors ${w ? "hover:bg-gray-50" : "hover:bg-white/5"}`}
                style={{
                  padding: "14px 0",
                  borderBottom: i < presetMatches.length - 1 ? `1px solid ${T.divider}` : "none",
                }}
                data-testid={`city-option-${city.name}`}
              >
                <MapPin className="w-[18px] h-[18px] shrink-0" style={{ color: w ? OBW.pink : "#38bdf8" }} />
                <span className="text-[16px] font-medium" style={{ color: T.text }}>{city.name}</span>
              </button>
            ))}

            {presetMatches.length === 0 && nominatimResults.length > 0 && nominatimResults.map((r, i) => {
              const addr = r.address;
              const name = addr?.city || addr?.town || addr?.village || r.display_name.split(",")[0];
              return (
                <button
                  key={i}
                  onClick={() => selectNominatimCity(r)}
                  className={`w-full flex items-center gap-3 text-left transition-colors ${w ? "hover:bg-gray-50" : "hover:bg-white/5"}`}
                  style={{
                    padding: "14px 0",
                    borderBottom: `1px solid ${T.divider}`,
                  }}
                  data-testid={`city-nominatim-${i}`}
                >
                  <MapPin className="w-[18px] h-[18px] shrink-0" style={{ color: w ? OBW.pink : "#38bdf8" }} />
                  <div>
                    <span className="text-[16px] font-medium block" style={{ color: T.text }}>{name}</span>
                    {addr?.state && (
                      <span className="text-[12px]" style={{ color: T.textSecondary }}>{addr.state}</span>
                    )}
                  </div>
                </button>
              );
            })}

            {presetMatches.length === 0 && nominatimResults.length === 0 && !searching && search.trim().length >= 3 && (
              <p className="text-[13px] text-center py-4" style={{ color: T.textSecondary }}>
                Geen resultaten
              </p>
            )}
          </div>
        )}

        {selectedCity && (
          <div
            className="flex items-center gap-3"
            style={{ padding: "14px 0", borderBottom: `1px solid ${T.divider}` }}
            data-testid="city-selected"
          >
            <MapPin className="w-[18px] h-[18px] shrink-0" style={{ color: w ? OBW.pink : "#38bdf8" }} />
            <span className="text-[16px] font-medium flex-1" style={{ color: T.text }}>{selectedCity.name}</span>
            <button
              onClick={() => { setSelectedCity(null); setSearch(""); }}
              className={`text-[13px] font-medium px-3 py-1.5 rounded-[6px] transition-colors ${w ? "hover:bg-gray-100" : "hover:bg-white/5"}`}
              style={{ color: T.textSecondary }}
              data-testid="button-city-change"
            >
              Wijzig
            </button>
          </div>
        )}
      </main>

      <OBFooter
        onBack={handleBack}
        onNext={handleNext}
        nextLabel="Volgende"
        nextDisabled={!selectedCity}
        backTestId="button-city-back"
        nextTestId="button-city-next"
        websiteMode={w}
      />
    </div>
  );
}
