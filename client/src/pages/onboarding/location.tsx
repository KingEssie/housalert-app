import { useState, useEffect, useRef } from "react";
import { useLocation, Redirect } from "wouter";
import { useHashSearch } from "@/lib/hash-search";
import { ChevronDown, ChevronLeft, Check, Search, X, MapPin, Loader2 } from "lucide-react";
import { cityDistricts, defaultCities } from "../../../../config/market";
import { useGeocoderSearch } from "@/hooks/use-geocoder-search";
import { OB, OBW, useWebsiteMode, appendWebsiteParams } from "@/components/onboarding-ui";
import { OnboardingFlowLayout } from "@/components/onboarding-flow-layout";
import MapView from "@/components/map-view";
import { useTranslation } from "@/i18n";
import { useQuery } from "@tanstack/react-query";
import {
  matchEstimateQueryKey,
  fetchMatchEstimate,
  type MatchEstimateResult,
  type NormalizedFilters,
} from "@/lib/match-estimate";

type LocationMode = "city" | "districts" | "radius";

const RADIUS_OPTIONS = [2, 5, 10, 15, 25, 50];
const TOP_CITIES = defaultCities.slice(0, 8);

export default function OnboardingLocation() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const searchString = useHashSearch();
  const w = useWebsiteMode();
  const T = w ? OBW : OB;
  const params = new URLSearchParams(searchString);

  const city = params.get("city") || "";
  const lat = params.get("lat") || "0";
  const lng = params.get("lng") || "0";

  const districtList = cityDistricts[city] || [];
  const hasDistricts = districtList.length > 0;

  const incomingMode = params.get("locationMode") as LocationMode | null;
  const incomingDistricts = params.get("districts")?.split(",").filter(Boolean) || [];
  const incomingRadius = parseInt(params.get("radiusKm") || "0") || 5;

  const [mode, setMode] = useState<LocationMode>(
    w ? "districts" : (incomingMode || (hasDistricts ? "districts" : "city"))
  );
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>(incomingDistricts);
  const [radiusKm, setRadiusKm] = useState(incomingRadius);
  const [showDistrictPicker, setShowDistrictPicker] = useState(false);

  const [citySearch, setCitySearch] = useState("");
  const cityGeocoder = useGeocoderSearch({ debounceMs: 300, minChars: 2, limit: 6 });

  const presetMatches = citySearch.trim().length > 0
    ? TOP_CITIES.filter((c) => c.name.toLowerCase().includes(citySearch.toLowerCase()))
    : TOP_CITIES;

  function selectCity(name: string, clat: number, clng: number) {
    const p = new URLSearchParams(searchString);
    p.set("city", name);
    p.set("lat", String(clat));
    p.set("lng", String(clng));
    navigate(appendWebsiteParams(`/onboarding/location?${p.toString()}`, searchString));
  }

  const [debounced, setDebounced] = useState({ mode, selectedDistricts, radiusKm });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => setDebounced({ mode, selectedDistricts, radiusKm }),
      600,
    );
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [mode, selectedDistricts, radiusKm]);

  const parsedLat = parseFloat(lat);
  const parsedLng = parseFloat(lng);
  const dMode = debounced.mode;
  const dDistricts = debounced.selectedDistricts;
  const dRadius = debounced.radiusKm;
  const estimateFilters: NormalizedFilters = {
    city,
    location_mode:
      dMode === "radius" ? "radius"
      : dMode === "districts" && dDistricts.length > 0 ? "districts"
      : "city",
    latitude: !isNaN(parsedLat) ? parsedLat : undefined,
    longitude: !isNaN(parsedLng) ? parsedLng : undefined,
    radius_km: dMode === "radius" ? dRadius : undefined,
    districts: dMode === "districts" && dDistricts.length > 0 ? dDistricts : undefined,
    price_min: 0,
    price_max: 0,
    bedrooms_min: 0,
    size_min: 0,
    send_unclear: true,
    price_flexible: false,
  };

  const { data: estimate, isFetching: estimateFetching } = useQuery<MatchEstimateResult>({
    queryKey: matchEstimateQueryKey(estimateFilters),
    queryFn: () => fetchMatchEstimate(estimateFilters),
    enabled: !!city,
    staleTime: 2 * 60 * 1000,
  });

  if (!city) {
    return (
      <div
        className="min-h-[100dvh] flex flex-col"
        style={{ background: "rgb(var(--ha-card))" }}
        data-testid="screen-onboarding-location-citypicker"
      >
        <header
          className="sticky top-0 z-20 w-full"
          style={{ backgroundColor: "rgb(var(--ha-card))", borderBottom: `1px solid ${OBW.headerBorder}` }}
        >
          <div className="relative max-w-[480px] mx-auto px-4 h-[56px] flex items-center justify-between">
            <span
              className="text-[14px] font-bold rounded-[10px] shrink-0 flex items-center px-3.5"
              style={{ height: "32px", backgroundColor: "rgb(var(--ha-primary))", color: "white" }}
              data-testid="badge-step"
            >
              1/4
            </span>
            <span
              className="absolute inset-0 flex items-center justify-center text-[19px] font-bold pointer-events-none"
              style={{ color: OBW.text }}
            >
              {t("onboarding.filters.headerTitle")}
            </span>
            <button
              onClick={() => navigate("/")}
              className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-ha-card-border hover:bg-ha-border-input active:bg-ha-border-input transition-colors"
              data-testid="button-close"
            >
              <X className="w-[18px] h-[18px] text-ha-text-secondary" />
            </button>
          </div>
        </header>

        <main className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-5 pt-5 pb-10 overflow-y-auto">
          <label className="text-[18px] font-semibold mb-2 block" style={{ color: OBW.textSecondary }}>
            {t("newSearch.step5.location")}
          </label>

          <div className="relative mb-4">
            <input
              type="text"
              value={citySearch}
              onChange={(e) => {
                setCitySearch(e.target.value);
                cityGeocoder.search(e.target.value);
              }}
              placeholder={t("onboarding.location.searchPlaceholder")}
              className="w-full ha-field-web focus:ring-0 placeholder:text-[16px] placeholder:text-ha-text-placeholder"
              style={{ backgroundColor: OBW.inputBg, borderColor: "rgb(var(--ha-border-input))", color: OBW.text, paddingRight: "2.5rem" }}
              autoFocus
              data-testid="input-city-search"
            />
            {cityGeocoder.loading ? (
              <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[16px] h-[16px] animate-spin" style={{ color: OBW.textSecondary }} />
            ) : (
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[16px] h-[16px]" style={{ color: OBW.textSecondary }} />
            )}
          </div>

          <div data-testid="city-results">
            {presetMatches.length > 0 && presetMatches.map((c) => (
              <button
                key={c.name}
                onClick={() => selectCity(c.name, c.lat, c.lng)}
                className="w-full flex items-center gap-2.5 min-h-[56px] text-left transition-colors hover:bg-ha-hover-bg active:bg-ha-surface"
                style={{ paddingTop: "14px", paddingBottom: "14px", borderBottom: "1px solid rgb(var(--ha-divider))" }}
                data-testid={`city-option-${c.name}`}
              >
                <MapPin className="w-[20px] h-[20px] shrink-0" style={{ color: OBW.primary, opacity: 0.8 }} />
                <span className="text-[18px] font-semibold" style={{ color: OBW.text }}>{c.name}</span>
              </button>
            ))}

            {presetMatches.length === 0 && cityGeocoder.results.length > 0 && cityGeocoder.results.map((r, i) => (
              <button
                key={(r as any).placeId || i}
                onClick={() => selectCity((r as any).city, (r as any).lat ?? 0, (r as any).lng ?? 0)}
                className="w-full flex items-center gap-2.5 min-h-[56px] text-left transition-colors hover:bg-ha-hover-bg active:bg-ha-surface"
                style={{ paddingTop: "14px", paddingBottom: "14px", borderBottom: "1px solid rgb(var(--ha-divider))" }}
                data-testid={`city-geocoder-${i}`}
              >
                <MapPin className="w-[20px] h-[20px] shrink-0" style={{ color: OBW.primary, opacity: 0.8 }} />
                <div className="min-w-0">
                  <span className="text-[18px] font-semibold block" style={{ color: OBW.text }}>{(r as any).city}</span>
                  {(r as any).label !== (r as any).city && (
                    <span className="text-[13px]" style={{ color: OBW.textSecondary }}>{(r as any).label.replace(`${(r as any).city}, `, "")}</span>
                  )}
                </div>
              </button>
            ))}

            {presetMatches.length === 0 && cityGeocoder.results.length === 0 && !cityGeocoder.loading && citySearch.trim().length >= 3 && (
              <p className="text-[15px] text-center py-6" style={{ color: OBW.textSecondary }}>
                {t("onboardingLocation.noResults")}
              </p>
            )}
          </div>
        </main>
      </div>
    );
  }

  function toggleDistrict(d: string) {
    setSelectedDistricts((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  }

  function handleNext() {
    const nextParams = new URLSearchParams({
      city,
      lat,
      lng,
      locationMode: mode,
    });
    if (mode === "districts" && selectedDistricts.length > 0) {
      nextParams.set("districts", selectedDistricts.join(","));
    }
    if (mode === "radius") {
      nextParams.set("radiusKm", String(radiusKm));
    }
    navigate(appendWebsiteParams(`/onboarding/filters?${nextParams.toString()}`, searchString));
  }

  function handleBack() {
    navigate("/");
  }

  function handleClose() {
    navigate("/");
  }

  const TAB_OPTIONS: { value: LocationMode; label: string }[] = [
    ...(hasDistricts ? [{ value: "districts" as LocationMode, label: t("onboarding.location.neighborhoodsTab") }] : []),
    { value: "radius" as LocationMode, label: t("onboarding.location.radiusTab") },
    { value: "city" as LocationMode, label: t("onboarding.location.wholePlaceTab") },
  ];

  const n = selectedDistricts.length;
  const districtSummary =
    n === 0
      ? t("onboarding.location.allNeighborhoodsSelected")
      : n === districtList.length
        ? t("onboarding.location.allNeighborhoodsSelected")
        : n === 1
          ? t("onboarding.location.neighborhoodsSelected").replace("{n}", String(n))
          : t("onboarding.location.neighborhoodsPluralSelected").replace("{n}", String(n));

  if (w) {
    const webTabs: { value: LocationMode; label: string }[] = [
      { value: "districts", label: t("onboarding.location.neighborhoodsTab") },
      { value: "radius", label: t("onboarding.location.radiusTab") },
      { value: "city", label: t("onboarding.location.wholePlaceTab") },
    ];

    return (
      <div
        className="min-h-[100dvh] flex flex-col"
        style={{ background: "rgb(var(--ha-card))" }}
        data-testid="screen-onboarding-location"
      >
        {/* Header — matches city.tsx: badge | centered title | close circle */}
        <header
          className="sticky top-0 z-20 w-full"
          style={{ backgroundColor: "rgb(var(--ha-card))", borderBottom: `1px solid ${OBW.headerBorder}` }}
        >
          <div className="relative max-w-[480px] mx-auto px-4 h-[56px] flex items-center justify-between">
            <span
              className="text-[14px] font-bold rounded-[10px] shrink-0 flex items-center px-3.5"
              style={{ height: "32px", backgroundColor: "rgb(var(--ha-primary))", color: "white" }}
              data-testid="badge-step"
            >
              1/4
            </span>
            <span
              className="absolute inset-0 flex items-center justify-center text-[19px] font-bold pointer-events-none"
              style={{ color: OBW.text }}
            >
              {t("onboarding.filters.headerTitle")}
            </span>
            <button
              onClick={handleClose}
              className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-ha-card-border hover:bg-ha-border-input active:bg-ha-border-input transition-colors"
              data-testid="button-location-close"
            >
              <X className="w-[18px] h-[18px] text-ha-text-secondary" />
            </button>
          </div>
        </header>

        <main className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-5 pt-5 pb-[140px] overflow-y-auto">
          {/* City field */}
          <label
            className="text-[18px] font-semibold mb-2 block"
            style={{ color: OBW.textSecondary }}
          >
            {t("onboarding.location.cityLabel")}
          </label>
          <button
            onClick={() => navigate("/")}
            className="w-full flex items-center gap-3 mb-5 ha-field-web text-left"
            style={{ backgroundColor: OBW.inputBg, borderColor: "rgb(var(--ha-border-input))", color: OBW.text }}
            data-testid="field-city-display"
          >
            <Search className="w-[18px] h-[18px] shrink-0" style={{ color: OBW.textMuted }} />
            <span className="flex-1 text-[16px] font-medium" style={{ color: OBW.text }}>{city}</span>
            <X className="w-[16px] h-[16px] shrink-0" style={{ color: OBW.textMuted }} />
          </button>

          {/* Segmented tab control */}
          <div
            className="flex items-center gap-1 p-[4px] rounded-full mb-5"
            style={{ backgroundColor: "rgb(var(--ha-toggle-bg))" }}
            data-testid="location-tabs"
          >
            {webTabs.map((tab) => {
              const isActive = mode === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => setMode(tab.value)}
                  className="flex-1 py-[8px] text-[12px] font-semibold rounded-full text-center transition-all whitespace-nowrap overflow-hidden"
                  style={{
                    backgroundColor: isActive ? "rgb(var(--ha-primary))" : "transparent",
                    color: isActive ? "white" : "rgb(var(--ha-text))",
                  }}
                  data-testid={`tab-${tab.value}`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Buurten (districts) mode */}
          {mode === "districts" && (
            <div data-testid="section-districts">
              <p className="text-[15px] font-semibold mb-3" style={{ color: OBW.textSecondary }}>
                {t("onboarding.location.neighborhoodsTab")}
              </p>
              <button
                onClick={() => setShowDistrictPicker(!showDistrictPicker)}
                className="w-full flex items-center justify-between ha-field-web text-left mb-4"
                style={{ backgroundColor: OBW.inputBg, borderColor: "rgb(var(--ha-border-input))", color: OBW.text }}
                data-testid="dropdown-districts"
              >
                <span className="text-[16px] font-medium" style={{ color: OBW.text }}>{districtSummary}</span>
                <ChevronDown
                  className="w-[18px] h-[18px] shrink-0 transition-transform duration-200"
                  style={{
                    color: OBW.textMuted,
                    transform: showDistrictPicker ? "rotate(180deg)" : "none",
                  }}
                />
              </button>

              {showDistrictPicker && hasDistricts && (
                <div
                  className="rounded-[12px] overflow-hidden border mb-4"
                  style={{ borderColor: "rgb(var(--ha-divider))", maxHeight: "200px", overflowY: "auto" }}
                  data-testid="district-list"
                >
                  {districtList.map((d, i) => {
                    const active = selectedDistricts.includes(d);
                    return (
                      <button
                        key={d}
                        onClick={() => toggleDistrict(d)}
                        className="w-full flex items-center justify-between hover:bg-ha-hover-bg transition-colors"
                        style={{
                          padding: "12px 16px",
                          borderBottom: i < districtList.length - 1 ? "1px solid rgb(var(--ha-divider))" : "none",
                        }}
                        data-testid={`district-${d}`}
                      >
                        <span
                          className="text-[14px] font-medium"
                          style={{ color: active ? OBW.text : OBW.textSecondary }}
                        >
                          {d}
                        </span>
                        {active && <Check className="w-4 h-4" style={{ color: "rgb(var(--ha-primary))" }} />}
                      </button>
                    );
                  })}
                </div>
              )}

              <div style={{ aspectRatio: "1/1" }} className="rounded-[12px] overflow-hidden w-full">
                <MapView
                  lat={parseFloat(lat)}
                  lng={parseFloat(lng)}
                  zoom={13}
                  markers={[{ lat: parseFloat(lat), lng: parseFloat(lng), type: "primary" }]}
                  circles={[{ lat: parseFloat(lat), lng: parseFloat(lng), radiusMeters: 1500 }]}
                  height="100%"
                  className=""
                />
              </div>
            </div>
          )}

          {/* Straal (radius) mode */}
          {mode === "radius" && (
            <div data-testid="section-radius">
              {/* Slider CSS — scoped via class, injected inline to stay within this file */}
              <style>{`
                .ha-radius-slider { -webkit-appearance: none; appearance: none; background: transparent; cursor: pointer; width: 100%; height: 4px; }
                .ha-radius-slider::-webkit-slider-runnable-track { background: linear-gradient(to right, rgb(var(--ha-primary)) 0%, rgb(var(--ha-primary)) var(--sl-pct,0%), rgb(var(--ha-card-border)) var(--sl-pct,0%), rgb(var(--ha-card-border)) 100%); border-radius: 9999px; height: 4px; }
                .ha-radius-slider::-moz-range-track { background:rgb(var(--ha-card-border)); border-radius: 9999px; height: 4px; }
                .ha-radius-slider::-moz-range-progress { background: rgb(var(--ha-primary)); border-radius: 9999px; height: 4px; }
                .ha-radius-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 22px; height: 22px; border-radius: 50%; background:white; box-shadow: 0 1px 6px rgba(0,0,0,0.18), 0 0 0 1.5px rgba(0,0,0,0.07); margin-top: -9px; cursor: pointer; }
                .ha-radius-slider::-moz-range-thumb { width: 22px; height: 22px; border-radius: 50%; background:white; box-shadow: 0 1px 6px rgba(0,0,0,0.18), 0 0 0 1.5px rgba(0,0,0,0.07); border: none; cursor: pointer; }
              `}</style>

              {/* Header row: distance label + city name */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-[15px] font-semibold" style={{ color: OBW.textSecondary }}>
                  {t("onboarding.location.distanceLabel")}
                </span>
                <span className="text-[14px] font-medium" style={{ color: OBW.textMuted }}>
                  {city}
                </span>
              </div>

              {/* Slider row: track + value on right */}
              <div className="flex items-center gap-3 mb-5">
                <input
                  type="range"
                  min={1}
                  max={50}
                  step={1}
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(parseInt(e.target.value))}
                  className="ha-radius-slider flex-1"
                  style={{ "--sl-pct": `${((radiusKm - 1) / 49) * 100}%` } as React.CSSProperties}
                  data-testid="slider-radius"
                />
                <span
                  className="text-[15px] font-semibold shrink-0 w-[52px] text-right"
                  style={{ color: "rgb(var(--ha-primary))" }}
                >
                  {radiusKm} km
                </span>
              </div>

              {/* Map 1:1 */}
              <div style={{ aspectRatio: "1/1" }} className="rounded-[12px] overflow-hidden w-full">
                <MapView
                  lat={parseFloat(lat)}
                  lng={parseFloat(lng)}
                  zoom={10}
                  markers={[{ lat: parseFloat(lat), lng: parseFloat(lng), type: "primary" }]}
                  circles={[{ lat: parseFloat(lat), lng: parseFloat(lng), radiusMeters: radiusKm * 1000 }]}
                  height="100%"
                  className=""
                />
              </div>
            </div>
          )}

          {/* Gehele woonplaats (city) mode */}
          {mode === "city" && (
            <div data-testid="section-city">
              <div style={{ aspectRatio: "1/1" }} className="rounded-[12px] overflow-hidden w-full">
                <MapView
                  lat={parseFloat(lat)}
                  lng={parseFloat(lng)}
                  zoom={10}
                  markers={[{ lat: parseFloat(lat), lng: parseFloat(lng), type: "primary" }]}
                  height="100%"
                  className=""
                />
              </div>
            </div>
          )}
        </main>

        {/* Inline footer: match count left, back + next buttons right */}
        <div
          className="fixed bottom-0 left-0 right-0 z-30"
          style={{
            borderTop: `1px solid ${OBW.footerBorder}`,
            backgroundColor: OBW.footerBg,
            paddingBottom: "max(8px, env(safe-area-inset-bottom, 8px))",
          }}
        >
          <div className="max-w-[480px] mx-auto px-5 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium" style={{ color: OBW.textMuted }}>
                {t("onboarding.location.estimatedMatches")}
              </p>
              <p className="text-[16px] font-semibold leading-snug" style={{ color: OBW.text }}>
                {estimateFetching ? (
                  <span style={{ color: OBW.textMuted }}>…</span>
                ) : estimate?.matchesLast7Days != null ? (
                  <>
                    {Math.max(1, estimate.matchesLast7Days)} {t("onboardingUI.perWeek")}
                    {Math.max(1, estimate.matchesLast7Days) > 10 ? " 🔥" : ""}
                  </>
                ) : (
                  <>— {t("onboardingUI.perWeek")}</>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={handleBack}
                className="w-[44px] h-[44px] rounded-[6px] flex items-center justify-center active:scale-95 transition-transform"
                style={{ border: `1.5px solid ${OBW.backBtnBorder}`, backgroundColor: OBW.backBtnBg }}
                data-testid="button-location-back"
              >
                <ChevronLeft className="w-[18px] h-[18px]" style={{ color: OBW.backBtnColor }} />
              </button>
              <button
                onClick={handleNext}
                className="h-[44px] px-6 rounded-[8px] text-[15px] font-semibold text-white flex items-center justify-center active:scale-[0.97] transition-transform"
                style={{ background: OBW.primary, boxShadow: "0 4px 14px rgb(var(--ha-primary) / 0.2)" }}
                data-testid="button-location-next"
              >
                {t("common.next")}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const locationContent = (
    <>
      <button
        onClick={() => navigate("/")}
        className="w-full flex items-center gap-3 mb-5 h-[56px] rounded-[8px] border border-ha-border-input bg-white px-4"
        data-testid="field-city-display"
      >
        <Search className="w-[16px] h-[16px] shrink-0 text-ha-text-secondary" />
        <span className="flex-1 text-left text-[15px] font-medium text-ha-text">{city}</span>
        <X className="w-[14px] h-[14px] shrink-0 text-ha-text-secondary" />
      </button>

      <div className="flex items-center gap-2 mb-5" data-testid="location-tabs">
        {TAB_OPTIONS.map((tab) => {
          const isActive = mode === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setMode(tab.value)}
              className={`px-3.5 py-[6px] text-[13px] rounded-full border transition-all duration-200 active:scale-[0.96] ${
                isActive
                  ? "bg-ha-text text-white font-semibold border-ha-text"
                  : "bg-ha-surface text-ha-text font-medium border-transparent"
              }`}
              data-testid={`tab-${tab.value}`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {mode === "districts" && hasDistricts && (
        <div>
          <p className="text-[14px] font-medium mb-2 text-ha-text-secondary">{t("onboarding.location.neighborhoodsTab")}</p>
          <button
            onClick={() => setShowDistrictPicker(!showDistrictPicker)}
            className="w-full flex items-center justify-between h-[56px] rounded-[8px] border border-ha-border-input bg-white px-4"
            data-testid="dropdown-districts"
          >
            <span className="text-[15px] font-medium text-ha-text">{districtSummary}</span>
            <ChevronDown
              className="w-[16px] h-[16px] shrink-0 transition-transform text-ha-text-secondary"
              style={{ transform: showDistrictPicker ? "rotate(180deg)" : "none" }}
            />
          </button>

          {showDistrictPicker && (
            <div
              className="mt-2 rounded-[12px] overflow-hidden border border-ha-card-border bg-white"
              style={{ maxHeight: "200px", overflowY: "auto" }}
              data-testid="district-list"
            >
              {districtList.map((d, i) => {
                const active = selectedDistricts.includes(d);
                return (
                  <button
                    key={d}
                    onClick={() => toggleDistrict(d)}
                    className="w-full flex items-center justify-between px-4 transition-colors hover:bg-ha-hover-bg"
                    style={{
                      padding: "12px 16px",
                      borderBottom: i < districtList.length - 1 ? "1px solid rgb(var(--ha-divider))" : "none",
                    }}
                    data-testid={`district-${d}`}
                  >
                    <span className={`text-[14px] font-medium ${active ? "text-ha-text" : "text-ha-text-secondary"}`}>{d}</span>
                    {active && <Check className="w-4 h-4 text-ha-primary" />}
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-4" data-testid="location-map">
            <MapView
              lat={parseFloat(lat)}
              lng={parseFloat(lng)}
              zoom={10}
              markers={[{ lat: parseFloat(lat), lng: parseFloat(lng), type: "primary" }]}
              height="clamp(200px, 30vh, 300px)"
              className="rounded-[12px] overflow-hidden"
            />
          </div>
        </div>
      )}

      {mode === "radius" && (
        <div>
          <p className="text-[14px] font-medium mb-3 text-ha-text-secondary">{t("onboarding.location.radiusTab")}</p>
          <div className="flex flex-wrap gap-2" data-testid="radius-options">
            {RADIUS_OPTIONS.map((km) => {
              const active = radiusKm === km;
              return (
                <button
                  key={km}
                  onClick={() => setRadiusKm(km)}
                  className="px-4 py-2.5 rounded-full text-[14px] font-medium transition-all"
                  style={{
                    border: active ? "1.5px solid rgba(37,60,150,0.6)" : "1px solid rgb(var(--ha-card-border))",
                    backgroundColor: active ? "rgba(37,60,150,0.08)" : "transparent",
                    color: active ? "rgb(var(--ha-primary))" : "rgb(var(--ha-text))",
                  }}
                  data-testid={`radius-${km}`}
                >
                  {km} km
                </button>
              );
            })}
          </div>
          <div className="mt-4" data-testid="location-map">
            <MapView
              lat={parseFloat(lat)}
              lng={parseFloat(lng)}
              zoom={10}
              markers={[{ lat: parseFloat(lat), lng: parseFloat(lng), type: "primary" }]}
              circles={[{ lat: parseFloat(lat), lng: parseFloat(lng), radiusMeters: radiusKm * 1000 }]}
              height="clamp(200px, 30vh, 300px)"
              className="rounded-[12px] overflow-hidden"
            />
          </div>
        </div>
      )}

      {mode === "city" && (
        <div>
          <div className="rounded-[12px] p-4 flex items-center gap-3 border border-ha-card-border bg-white">
            <div className="w-10 h-10 rounded-[8px] flex items-center justify-center shrink-0 bg-ha-primary/8">
              <Check className="w-5 h-5 text-ha-primary" />
            </div>
            <p className="text-[14px] leading-relaxed text-ha-text-secondary">
              {t("onboardingLocation.searchingInCity").replace("{city}", city)}
            </p>
          </div>
          <div className="mt-4" data-testid="location-map">
            <MapView
              lat={parseFloat(lat)}
              lng={parseFloat(lng)}
              zoom={10}
              markers={[{ lat: parseFloat(lat), lng: parseFloat(lng), type: "primary" }]}
              height="clamp(200px, 30vh, 300px)"
              className="rounded-[12px] overflow-hidden"
            />
          </div>
        </div>
      )}
    </>
  );

  return (
    <OnboardingFlowLayout
      flowTitle={t("onboarding.filters.headerTitle")}
      currentStep={2}
      totalSteps={3}
      stepTitle={t("onboarding.location.radiusStepTitle")}
      stepDescription={t("onboarding.location.radiusStepDesc")}
      onBack={handleBack}
      onNext={handleNext}
      onClose={handleClose}
      nextLabel={t("common.next")}
      backTestId="button-location-back"
      nextTestId="button-location-next"
      closeTestId="button-location-close"
      screenTestId="screen-onboarding-location"
    >
      {locationContent}
    </OnboardingFlowLayout>
  );
}
