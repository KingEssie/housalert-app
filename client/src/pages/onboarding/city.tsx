import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useHashSearch } from "@/lib/hash-search";
import { Search, MapPin, Loader2, X } from "lucide-react";
import { defaultCities } from "../../../../config/market";
import { OBW, useWebsiteMode, appendWebsiteParams } from "@/components/onboarding-ui";
import { OnboardingFlowLayout } from "@/components/onboarding-flow-layout";
import MapView from "@/components/map-view";
import { useGeocoderSearch } from "@/hooks/use-geocoder-search";
import { useTranslation } from "@/i18n";

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
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const searchString = useHashSearch();
  const w = useWebsiteMode();
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

  function goToFilters(city: { name: string; lat: number; lng: number }) {
    const p = new URLSearchParams({
      city: city.name,
      lat: String(city.lat),
      lng: String(city.lng),
      locationMode: "radius",
      radiusKm: String(radiusKm),
    });
    navigate(appendWebsiteParams(`/onboarding/filters?${p.toString()}`, searchString));
  }

  function selectPresetCity(city: typeof TOP_CITIES[0]) {
    const selected = { name: city.name, lat: city.lat, lng: city.lng };
    setSelectedCity(selected);
    setSearch(city.name);
    geocoder.clear();
    if (w) { goToFilters(selected); return; }
    goToStep2(selected);
  }

  function selectGeocoderCity(result: typeof geocoder.results[0]) {
    const selected = { name: result.city, lat: result.lat, lng: result.lng };
    setSelectedCity(selected);
    setSearch(result.city);
    geocoder.clear();
    if (w) { goToFilters(selected); return; }
    goToStep2(selected);
  }

  function handleNext() {
    if (!selectedCity) return;
    if (w) { goToFilters(selectedCity); return; }
    goToStep2(selectedCity);
  }

  function handleBack() {
    navigate("/onboarding/intro");
  }

  function handleClose() {
    navigate("/");
  }

  const showDropdown = !selectedCity;

  if (w) {
    return (
      <div
        className="min-h-[100dvh] flex flex-col"
        style={{ background: "#ffffff" }}
        data-testid="screen-onboarding-city"
      >
        {/* Rentbird-style compact onboarding header: step badge | title | close */}
        <header
          className="sticky top-0 z-20 w-full"
          style={{ backgroundColor: "#ffffff", borderBottom: `1px solid ${OBW.headerBorder}` }}
        >
          <div className="max-w-[480px] mx-auto px-4 h-[52px] flex items-center justify-between gap-3">
            <span
              className="text-[11px] font-bold px-2 py-0.5 rounded-[4px] shrink-0"
              style={{ backgroundColor: "rgb(var(--ha-primary))", color: "#ffffff" }}
              data-testid="badge-step"
            >
              1/4
            </span>
            <span
              className="text-[14px] font-semibold truncate"
              style={{ color: OBW.text }}
            >
              {t("onboarding.filters.headerTitle")}
            </span>
            <button
              onClick={handleClose}
              className="w-[28px] h-[28px] shrink-0 flex items-center justify-center rounded-full transition-colors hover:bg-[#F0F0F0] active:bg-[#E5E5E5]"
              style={{ color: OBW.textSecondary }}
              data-testid="button-close"
            >
              <X className="w-[15px] h-[15px]" />
            </button>
          </div>
        </header>

        <main className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-5 pt-5 pb-10 overflow-y-auto">
          <label className="text-[14px] font-semibold mb-2 block" style={{ color: OBW.textSecondary }}>
            {t("newSearch.step5.location")}
          </label>

          <div className="relative mb-4">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px]" style={{ color: OBW.textMuted }} />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (selectedCity) setSelectedCity(null);
              }}
              placeholder={t("onboarding.location.searchPlaceholder")}
              className="w-full ha-field-web focus:ring-0"
              style={{ backgroundColor: OBW.inputBg, borderColor: OBW.inputBorder, color: OBW.text, paddingLeft: "40px", paddingRight: "16px" }}
              autoFocus
              data-testid="input-city-search"
            />
            {geocoder.loading && (
              <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[16px] h-[16px] animate-spin" style={{ color: OBW.textSecondary }} />
            )}
          </div>

          {showDropdown && (
            <div data-testid="city-results">
              {presetMatches.map((city, i) => (
                <button
                  key={city.name}
                  onClick={() => selectPresetCity(city)}
                  className="w-full flex items-center gap-3 min-h-[56px] text-left transition-colors hover:bg-[#F7F7F7] active:bg-[#F0F1F2]"
                  style={{
                    paddingTop: "14px",
                    paddingBottom: "14px",
                    borderBottom: `1px solid ${OBW.divider}`,
                  }}
                  data-testid={`city-option-${city.name}`}
                >
                  <MapPin className="w-[20px] h-[20px] shrink-0" style={{ color: OBW.pink }} />
                  <span className="text-[16px] font-medium" style={{ color: OBW.text }}>{city.name}</span>
                </button>
              ))}

              {presetMatches.length === 0 && geocoder.results.length > 0 && geocoder.results.map((r, i) => (
                <button
                  key={r.placeId || i}
                  onClick={() => selectGeocoderCity(r)}
                  className="w-full flex items-center gap-3 min-h-[56px] text-left transition-colors hover:bg-[#F7F7F7] active:bg-[#F0F1F2]"
                  style={{
                    paddingTop: "14px",
                    paddingBottom: "14px",
                    borderBottom: `1px solid ${OBW.divider}`,
                  }}
                  data-testid={`city-nominatim-${i}`}
                >
                  <MapPin className="w-[20px] h-[20px] shrink-0" style={{ color: OBW.pink }} />
                  <div className="min-w-0">
                    <span className="text-[16px] font-medium block" style={{ color: OBW.text }}>{r.city}</span>
                    {r.label !== r.city && (
                      <span className="text-[13px]" style={{ color: OBW.textSecondary }}>{r.label.replace(`${r.city}, `, "")}</span>
                    )}
                  </div>
                </button>
              ))}

              {presetMatches.length === 0 && geocoder.results.length === 0 && !geocoder.loading && search.trim().length >= 3 && (
                <p className="text-[15px] text-center py-6" style={{ color: OBW.textSecondary }}>
                  {t("onboardingLocation.noResults")}
                </p>
              )}
            </div>
          )}
        </main>
      </div>
    );
  }

  const cityListContent = (
    <>
      <div className="relative mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (selectedCity) setSelectedCity(null);
          }}
          placeholder={t("onboarding.location.searchPlaceholder")}
          className="w-full h-[56px] rounded-[8px] border border-[#D1D5DB] bg-white px-4 pr-12 text-[16px] text-[#111111] placeholder:text-[#334855] placeholder:opacity-55 outline-none transition-all focus:border-ha-primary focus:ring-1 focus:ring-ha-primary/25"
          autoFocus
          data-testid="input-city-search"
        />
        {geocoder.loading ? (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] animate-spin text-[#334855]" />
        ) : (
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#334855]" />
        )}
      </div>

      {showDropdown && (
        <div data-testid="city-results">
          {presetMatches.map((city, i) => (
            <button
              key={city.name}
              onClick={() => selectPresetCity(city)}
              className="w-full flex items-center gap-3 text-left transition-colors hover:bg-[#F9FAFB] rounded-lg px-1"
              style={{
                padding: "14px 4px",
                borderBottom: i < presetMatches.length - 1 ? "1px solid #F0F0F0" : "none",
              }}
              data-testid={`city-option-${city.name}`}
            >
              <MapPin className="w-[18px] h-[18px] shrink-0 text-ha-primary" />
              <span className="text-[16px] font-medium text-[#111111]">{city.name}</span>
            </button>
          ))}

          {presetMatches.length === 0 && geocoder.results.length > 0 && geocoder.results.map((r, i) => (
              <button
                key={r.placeId || i}
                onClick={() => selectGeocoderCity(r)}
                className="w-full flex items-center gap-3 text-left transition-colors hover:bg-[#F9FAFB] rounded-lg px-1"
                style={{
                  padding: "14px 4px",
                  borderBottom: "1px solid #F0F0F0",
                }}
                data-testid={`city-nominatim-${i}`}
              >
                <MapPin className="w-[18px] h-[18px] shrink-0 text-ha-primary" />
                <div>
                  <span className="text-[16px] font-medium block text-[#111111]">{r.city}</span>
                  {r.label !== r.city && (
                    <span className="text-[12px] text-[#334855]">{r.label.replace(`${r.city}, `, "")}</span>
                  )}
                </div>
              </button>
          ))}

          {presetMatches.length === 0 && geocoder.results.length === 0 && !geocoder.loading && search.trim().length >= 3 && (
            <p className="text-[13px] text-center py-4 text-[#334855]">
              {t("onboardingLocation.noResults")}
            </p>
          )}
        </div>
      )}

      {selectedCity && (
        <div
          className="flex items-center gap-3 rounded-lg px-1"
          style={{ padding: "14px 4px", borderBottom: "1px solid #F0F0F0" }}
          data-testid="city-selected"
        >
          <MapPin className="w-[18px] h-[18px] shrink-0 text-ha-primary" />
          <span className="text-[16px] font-medium flex-1 text-[#111111]">{selectedCity.name}</span>
          <button
            onClick={() => { setSelectedCity(null); setSearch(""); }}
            className="text-[13px] font-medium px-3 py-1.5 rounded-lg transition-colors hover:bg-[#F9FAFB] text-[#334855]"
            data-testid="button-city-change"
          >
            {t("common.edit")}
          </button>
        </div>
      )}
    </>
  );

  return (
    <OnboardingFlowLayout
      flowTitle={t("onboarding.filters.headerTitle")}
      currentStep={1}
      totalSteps={3}
      stepTitle={t("onboarding.location.cityStepTitle")}
      stepDescription={t("onboarding.location.cityStepDesc")}
      onBack={handleBack}
      onNext={handleNext}
      onClose={handleClose}
      nextLabel={t("common.next")}
      nextDisabled={!selectedCity}
      backTestId="button-city-back"
      nextTestId="button-city-next"
      closeTestId="button-city-close"
      screenTestId="screen-onboarding-city"
    >
      {cityListContent}
    </OnboardingFlowLayout>
  );
}
