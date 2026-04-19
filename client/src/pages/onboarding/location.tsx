import { useState } from "react";
import { useLocation, Redirect } from "wouter";
import { useHashSearch } from "@/lib/hash-search";
import { ChevronDown, ChevronLeft, Check, Search, X } from "lucide-react";
import { cityDistricts } from "../../../../config/market";
import { OB, OBW, useWebsiteMode, appendWebsiteParams } from "@/components/onboarding-ui";
import { OnboardingFlowLayout } from "@/components/onboarding-flow-layout";
import MapView from "@/components/map-view";
import { useTranslation } from "@/i18n";

type LocationMode = "city" | "districts" | "radius";

const RADIUS_OPTIONS = [2, 5, 10, 15, 25, 50];

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

  if (!city) return <Redirect to="/onboarding/city" />;

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
    navigate(appendWebsiteParams("/onboarding/city", searchString));
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
        style={{ background: "#ffffff" }}
        data-testid="screen-onboarding-location"
      >
        {/* Header — matches city.tsx: badge | centered title | close circle */}
        <header
          className="sticky top-0 z-20 w-full"
          style={{ backgroundColor: "#ffffff", borderBottom: `1px solid ${OBW.headerBorder}` }}
        >
          <div className="relative max-w-[480px] mx-auto px-4 h-[56px] flex items-center justify-between">
            <span
              className="text-[14px] font-bold rounded-[10px] shrink-0 flex items-center px-3.5"
              style={{ height: "32px", backgroundColor: "rgb(var(--ha-primary))", color: "#ffffff" }}
              data-testid="badge-step"
            >
              2/4
            </span>
            <span
              className="absolute inset-0 flex items-center justify-center text-[19px] font-bold pointer-events-none"
              style={{ color: OBW.text }}
            >
              {t("onboarding.filters.headerTitle")}
            </span>
            <button
              onClick={handleClose}
              className="w-[36px] h-[36px] shrink-0 flex items-center justify-center rounded-full transition-opacity hover:opacity-70 active:opacity-50"
              style={{ backgroundColor: "#F2F2F2", color: "#444444" }}
              data-testid="button-location-close"
            >
              <X className="w-[22px] h-[22px]" />
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
            onClick={() => navigate(appendWebsiteParams("/onboarding/city", searchString))}
            className="w-full flex items-center gap-3 mb-5 ha-field-web text-left"
            style={{ backgroundColor: OBW.inputBg, borderColor: "#CFCFCF", color: OBW.text }}
            data-testid="field-city-display"
          >
            <Search className="w-[18px] h-[18px] shrink-0" style={{ color: OBW.textMuted }} />
            <span className="flex-1 text-[16px] font-medium" style={{ color: OBW.text }}>{city}</span>
            <X className="w-[16px] h-[16px] shrink-0" style={{ color: OBW.textMuted }} />
          </button>

          {/* Segmented tab control */}
          <div
            className="flex items-center gap-1 p-[4px] rounded-full mb-5"
            style={{ backgroundColor: "#F0F4F8" }}
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
                    color: isActive ? "#ffffff" : "#111111",
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
                style={{ backgroundColor: OBW.inputBg, borderColor: "#CFCFCF", color: OBW.text }}
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
                  style={{ borderColor: "#EAEAEA", maxHeight: "200px", overflowY: "auto" }}
                  data-testid="district-list"
                >
                  {districtList.map((d, i) => {
                    const active = selectedDistricts.includes(d);
                    return (
                      <button
                        key={d}
                        onClick={() => toggleDistrict(d)}
                        className="w-full flex items-center justify-between hover:bg-[#F7F7F7] transition-colors"
                        style={{
                          padding: "12px 16px",
                          borderBottom: i < districtList.length - 1 ? "1px solid #F0F0F0" : "none",
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
                .ha-radius-slider::-webkit-slider-runnable-track { background: linear-gradient(to right, rgb(var(--ha-primary)) 0%, rgb(var(--ha-primary)) var(--sl-pct,0%), #E5E7EB var(--sl-pct,0%), #E5E7EB 100%); border-radius: 9999px; height: 4px; }
                .ha-radius-slider::-moz-range-track { background: #E5E7EB; border-radius: 9999px; height: 4px; }
                .ha-radius-slider::-moz-range-progress { background: rgb(var(--ha-primary)); border-radius: 9999px; height: 4px; }
                .ha-radius-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 22px; height: 22px; border-radius: 50%; background: #ffffff; box-shadow: 0 1px 6px rgba(0,0,0,0.18), 0 0 0 1.5px rgba(0,0,0,0.07); margin-top: -9px; cursor: pointer; }
                .ha-radius-slider::-moz-range-thumb { width: 22px; height: 22px; border-radius: 50%; background: #ffffff; box-shadow: 0 1px 6px rgba(0,0,0,0.18), 0 0 0 1.5px rgba(0,0,0,0.07); border: none; cursor: pointer; }
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
                195 {t("onboardingUI.perWeek")} 🔥
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
                style={{ background: OBW.pink, boxShadow: "0 4px 14px rgba(217,26,104,0.2)" }}
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
        onClick={() => navigate(appendWebsiteParams("/onboarding/city", searchString))}
        className="w-full flex items-center gap-3 mb-5 h-[56px] rounded-[8px] border border-[#D1D5DB] bg-white px-4"
        data-testid="field-city-display"
      >
        <Search className="w-[16px] h-[16px] shrink-0 text-[#334855]" />
        <span className="flex-1 text-left text-[15px] font-medium text-[#111111]">{city}</span>
        <X className="w-[14px] h-[14px] shrink-0 text-[#334855]" />
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
                  ? "bg-[#111111] text-white font-semibold border-[#111111]"
                  : "bg-[#F3F4F6] text-[#111111] font-medium border-transparent"
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
          <p className="text-[14px] font-medium mb-2 text-[#334855]">{t("onboarding.location.neighborhoodsTab")}</p>
          <button
            onClick={() => setShowDistrictPicker(!showDistrictPicker)}
            className="w-full flex items-center justify-between h-[56px] rounded-[8px] border border-[#D1D5DB] bg-white px-4"
            data-testid="dropdown-districts"
          >
            <span className="text-[15px] font-medium text-[#111111]">{districtSummary}</span>
            <ChevronDown
              className="w-[16px] h-[16px] shrink-0 transition-transform text-[#334855]"
              style={{ transform: showDistrictPicker ? "rotate(180deg)" : "none" }}
            />
          </button>

          {showDistrictPicker && (
            <div
              className="mt-2 rounded-[12px] overflow-hidden border border-[#E5E7EB] bg-white"
              style={{ maxHeight: "200px", overflowY: "auto" }}
              data-testid="district-list"
            >
              {districtList.map((d, i) => {
                const active = selectedDistricts.includes(d);
                return (
                  <button
                    key={d}
                    onClick={() => toggleDistrict(d)}
                    className="w-full flex items-center justify-between px-4 transition-colors hover:bg-[#F7F7F7]"
                    style={{
                      padding: "12px 16px",
                      borderBottom: i < districtList.length - 1 ? "1px solid #F0F0F0" : "none",
                    }}
                    data-testid={`district-${d}`}
                  >
                    <span className={`text-[14px] font-medium ${active ? "text-[#111111]" : "text-[#334855]"}`}>{d}</span>
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
          <p className="text-[14px] font-medium mb-3 text-[#334855]">{t("onboarding.location.radiusTab")}</p>
          <div className="flex flex-wrap gap-2" data-testid="radius-options">
            {RADIUS_OPTIONS.map((km) => {
              const active = radiusKm === km;
              return (
                <button
                  key={km}
                  onClick={() => setRadiusKm(km)}
                  className="px-4 py-2.5 rounded-full text-[14px] font-medium transition-all"
                  style={{
                    border: active ? "1.5px solid rgba(217,26,104,0.6)" : "1px solid #E5E7EB",
                    backgroundColor: active ? "rgba(217,26,104,0.08)" : "transparent",
                    color: active ? "rgb(var(--ha-primary))" : "#111111",
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
          <div className="rounded-[12px] p-4 flex items-center gap-3 border border-[#E5E7EB] bg-white">
            <div className="w-10 h-10 rounded-[8px] flex items-center justify-center shrink-0 bg-ha-primary/8">
              <Check className="w-5 h-5 text-ha-primary" />
            </div>
            <p className="text-[14px] leading-relaxed text-[#334855]">
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
