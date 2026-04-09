import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useHashSearch } from "@/lib/hash-search";
import { Search, MapPin, Loader2, X } from "lucide-react";
import { defaultCities } from "../../../../config/market";
import { OB, OBW, ONBOARDING_TOTAL_STEPS, OBFooter, OBWebHeader, OBWebFooter, OBInfoBox, useWebsiteMode, appendWebsiteParams } from "@/components/onboarding-ui";
import MapView from "@/components/map-view";
import { useGeocoderSearch } from "@/hooks/use-geocoder-search";

const TOP_CITIES = defaultCities.slice(0, 5);
const RADIUS_OPTIONS = [2, 5, 10, 15, 25, 50];

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
  const geocoder = useGeocoderSearch({ debounceMs: 300, minChars: 3, limit: 5 });
  const [radiusKm, setRadiusKm] = useState(() => {
    const p = new URLSearchParams(searchString);
    return parseInt(p.get("radiusKm") || "5") || 5;
  });
  const didAutoSearchRef = useRef(false);

  useEffect(() => {
    if (w) return;
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
  }, [searchString, navigate, w]);

  const presetMatches = search.trim().length > 0
    ? TOP_CITIES.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : TOP_CITIES;

  const initialSearchDoneRef = useRef(false);

  useEffect(() => {
    if (!initialSearchDoneRef.current) {
      const params = new URLSearchParams(searchString);
      const cityParam = params.get("city")?.trim();
      if (cityParam && cityParam.length >= 3 && !defaultCities.find((c) => c.name.toLowerCase() === cityParam.toLowerCase())) {
        initialSearchDoneRef.current = true;
        geocoder.searchImmediate(cityParam);
        return;
      }
      initialSearchDoneRef.current = true;
    }
    if (selectedCity) return;
    if (didAutoSearchRef.current) { didAutoSearchRef.current = false; return; }
    if (search.trim().length >= 3 && presetMatches.length === 0) {
      geocoder.search(search.trim());
    } else {
      geocoder.clear();
    }
  }, [search, selectedCity, presetMatches.length]);

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
    geocoder.clear();
    if (!w) goToStep2(selected);
  }

  function selectGeocoderCity(result: typeof geocoder.results[0]) {
    const selected = { name: result.city, lat: result.lat, lng: result.lng };
    setSelectedCity(selected);
    setSearch(result.city);
    geocoder.clear();
    if (!w) goToStep2(selected);
  }

  function handleNext() {
    if (!selectedCity) return;
    if (w) {
      const p = new URLSearchParams({
        city: selectedCity.name,
        lat: String(selectedCity.lat),
        lng: String(selectedCity.lng),
        locationMode: "radius",
        radiusKm: String(radiusKm),
      });
      navigate(appendWebsiteParams(`/onboarding/filters?${p.toString()}`, searchString));
      return;
    }
    goToStep2(selectedCity);
  }

  function handleBack() {
    navigate("/onboarding/intro");
  }

  function handleClose() {
    navigate("/login");
  }

  const showDropdown = !selectedCity;

  if (w) {
    return (
      <div
        className="min-h-[100dvh] flex flex-col"
        style={{ background: "#ffffff" }}
        data-testid="screen-onboarding-city"
      >
        <OBWebHeader step={1} onClose={handleClose} />

        <main className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-5 pt-6 pb-[100px] overflow-y-auto">
          <h2
            className="text-[30px] font-semibold tracking-[-0.025em] mb-1"
            style={{ color: OBW.text }}
            data-testid="text-city-title"
          >
            Waar wil je wonen?
          </h2>
          <p
            className="text-[13px] mb-4 leading-relaxed"
            style={{ color: OBW.textSecondary }}
          >
            Kies je stad en zoekradius.
          </p>

          <div className="relative mb-2.5">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[16px] h-[16px]" style={{ color: OBW.textMuted }} />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (selectedCity) setSelectedCity(null);
              }}
              placeholder="Zoek stad..."
              className="w-full ha-field-web"
              style={{ backgroundColor: OBW.inputBg, borderColor: OBW.inputBorder, color: OBW.text, paddingLeft: "40px", paddingRight: "44px" }}
              autoFocus
              data-testid="input-city-search"
            />
            {geocoder.loading && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] animate-spin" style={{ color: OBW.textSecondary }} />
            )}
          </div>

          {showDropdown && (
            <div data-testid="city-results">
              {presetMatches.map((city, i) => (
                <button
                  key={city.name}
                  onClick={() => selectPresetCity(city)}
                  className="w-full flex items-center gap-2.5 text-left transition-colors hover:bg-[#F7F7F7]"
                  style={{
                    padding: "10px 0",
                    borderBottom: i < presetMatches.length - 1 ? `1px solid ${OBW.divider}` : "none",
                  }}
                  data-testid={`city-option-${city.name}`}
                >
                  <MapPin className="w-[16px] h-[16px] shrink-0" style={{ color: OBW.pink }} />
                  <span className="text-[14px] font-medium" style={{ color: OBW.text }}>{city.name}</span>
                </button>
              ))}

              {presetMatches.length === 0 && geocoder.results.length > 0 && geocoder.results.map((r, i) => (
                  <button
                    key={r.placeId || i}
                    onClick={() => selectGeocoderCity(r)}
                    className="w-full flex items-center gap-2.5 text-left transition-colors hover:bg-[#F7F7F7]"
                    style={{
                      padding: "10px 0",
                      borderBottom: `1px solid ${OBW.divider}`,
                    }}
                    data-testid={`city-nominatim-${i}`}
                  >
                    <MapPin className="w-[16px] h-[16px] shrink-0" style={{ color: OBW.pink }} />
                    <div>
                      <span className="text-[14px] font-medium block" style={{ color: OBW.text }}>{r.city}</span>
                      {r.label !== r.city && (
                        <span className="text-[12px]" style={{ color: OBW.textSecondary }}>{r.label.replace(`${r.city}, `, "")}</span>
                      )}
                    </div>
                  </button>
              ))}

              {presetMatches.length === 0 && geocoder.results.length === 0 && !geocoder.loading && search.trim().length >= 3 && (
                <p className="text-[13px] text-center py-4" style={{ color: OBW.textSecondary }}>
                  Geen resultaten
                </p>
              )}
            </div>
          )}

          {selectedCity && (
            <>
              <div style={{ marginTop: "4px" }}>
                <label className="text-[13px] font-semibold mb-1 block" style={{ color: OBW.textSecondary }}>
                  Straal rondom {selectedCity.name}
                </label>
                <select
                  value={String(radiusKm)}
                  onChange={(e) => setRadiusKm(parseInt(e.target.value))}
                  className="w-full ha-select-web"
                  style={{ backgroundColor: OBW.inputBg, borderColor: OBW.inputBorder, color: OBW.text }}
                  data-testid="select-radius"
                >
                  {RADIUS_OPTIONS.map((km) => (
                    <option key={km} value={km}>{km} km</option>
                  ))}
                </select>
              </div>

              <div className="mt-3" data-testid="location-map">
                <MapView
                  lat={selectedCity.lat}
                  lng={selectedCity.lng}
                  zoom={10}
                  markers={[{ lat: selectedCity.lat, lng: selectedCity.lng, type: "primary" }]}
                  height="clamp(240px, 35vh, 360px)"
                  className="rounded-[4px] overflow-hidden"
                />
              </div>

              <div className="mt-3">
                <OBInfoBox>
                  We doorzoeken alle huurwoningen in een straal van {radiusKm} km rondom {selectedCity.name}. Je ontvangt direct een bericht bij nieuwe woningen.
                </OBInfoBox>
              </div>
            </>
          )}
        </main>

        <OBWebFooter
          onNext={handleNext}
          nextLabel="Volgende"
          nextDisabled={!selectedCity}
          nextTestId="button-city-next"
        />
      </div>
    );
  }

  return (
    <div
      className="min-h-[100dvh] flex flex-col"
      style={{ background: T.gradient }}
      data-testid="screen-onboarding-city"
    >
      <header
        className="w-full sticky top-0 z-20"
        style={{
          backgroundColor: T.headerBg,
          borderBottom: `1px solid ${T.headerBorder}`,
          paddingTop: "max(8px, env(safe-area-inset-top))",
        }}
      >
        <div className="max-w-[480px] mx-auto px-5 h-[52px] flex items-center justify-between">
          <span
            className="text-[12px] font-semibold px-2.5 py-1 rounded-[6px]"
            style={{
              backgroundColor: "#111111",
              color: "#ffffff",
            }}
            data-testid="badge-step"
          >
            {`1/${ONBOARDING_TOTAL_STEPS}`}
          </span>
          <span className="text-[20px] font-semibold" style={{ color: T.text }}>
            Zoekopdracht maken
          </span>
          <button
            onClick={handleClose}
            className="w-[36px] h-[36px] rounded-full flex items-center justify-center active:scale-95 transition-transform"
            style={{ backgroundColor: "#FFFFFF" }}
            data-testid="button-city-close"
          >
            <X className="w-4 h-4" style={{ color: "#334855" }} />
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
            className="w-full pr-12 ha-field"
            autoFocus
            data-testid="input-city-search"
          />
          {geocoder.loading ? (
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
                className="w-full flex items-center gap-3 text-left transition-colors hover:bg-[#F9FAFB]"
                style={{
                  padding: "14px 0",
                  borderBottom: i < presetMatches.length - 1 ? `1px solid ${T.divider}` : "none",
                }}
                data-testid={`city-option-${city.name}`}
              >
                <MapPin className="w-[18px] h-[18px] shrink-0" style={{ color: "rgb(var(--ha-primary))" }} />
                <span className="text-[16px] font-medium" style={{ color: T.text }}>{city.name}</span>
              </button>
            ))}

            {presetMatches.length === 0 && geocoder.results.length > 0 && geocoder.results.map((r, i) => (
                <button
                  key={r.placeId || i}
                  onClick={() => selectGeocoderCity(r)}
                  className="w-full flex items-center gap-3 text-left transition-colors hover:bg-[#F9FAFB]"
                  style={{
                    padding: "14px 0",
                    borderBottom: `1px solid ${T.divider}`,
                  }}
                  data-testid={`city-nominatim-${i}`}
                >
                  <MapPin className="w-[18px] h-[18px] shrink-0" style={{ color: "rgb(var(--ha-primary))" }} />
                  <div>
                    <span className="text-[16px] font-medium block" style={{ color: T.text }}>{r.city}</span>
                    {r.label !== r.city && (
                      <span className="text-[12px]" style={{ color: T.textSecondary }}>{r.label.replace(`${r.city}, `, "")}</span>
                    )}
                  </div>
                </button>
            ))}

            {presetMatches.length === 0 && geocoder.results.length === 0 && !geocoder.loading && search.trim().length >= 3 && (
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
            <MapPin className="w-[18px] h-[18px] shrink-0" style={{ color: "rgb(var(--ha-primary))" }} />
            <span className="text-[16px] font-medium flex-1" style={{ color: T.text }}>{selectedCity.name}</span>
            <button
              onClick={() => { setSelectedCity(null); setSearch(""); }}
              className="text-[13px] font-medium px-3 py-1.5 rounded-[6px] transition-colors hover:bg-[#F9FAFB]"
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
      />
    </div>
  );
}
