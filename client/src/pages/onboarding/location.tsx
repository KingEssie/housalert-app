import { useState } from "react";
import { useLocation } from "wouter";
import { useHashSearch } from "@/lib/hash-search";
import { ChevronDown, Check, Search, X } from "lucide-react";
import { cityDistricts } from "../../../../config/market";
import { OB, OBW, ONBOARDING_TOTAL_STEPS, OBFooter, useWebsiteMode, appendWebsiteParams } from "@/components/onboarding-ui";
import MapView from "@/components/map-view";

type LocationMode = "city" | "districts" | "radius";

const RADIUS_OPTIONS = [2, 5, 10, 15, 25, 50];

export default function OnboardingLocation() {
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
    w ? "radius" : (incomingMode || (hasDistricts ? "districts" : "city"))
  );
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>(incomingDistricts);
  const [radiusKm, setRadiusKm] = useState(incomingRadius);
  const [showDistrictPicker, setShowDistrictPicker] = useState(false);

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
    ...(hasDistricts ? [{ value: "districts" as LocationMode, label: "Buurten" }] : []),
    { value: "radius" as LocationMode, label: "Straal" },
    { value: "city" as LocationMode, label: "Gehele woonplaats" },
  ];

  const districtSummary =
    selectedDistricts.length === 0
      ? "Alle buurten geselecteerd"
      : selectedDistricts.length === districtList.length
        ? "Alle buurten geselecteerd"
        : `${selectedDistricts.length} buurt${selectedDistricts.length === 1 ? "" : "en"} geselecteerd`;

  return (
    <div
      className={`min-h-[100dvh] flex flex-col ${w ? "" : "ob-dark"}`}
      style={{ background: T.gradient, borderRadius: w ? 0 : undefined }}
      data-testid="screen-onboarding-location"
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
            {`${w ? "1" : "2"}/${w ? "2" : ONBOARDING_TOTAL_STEPS}`}
          </span>
          <span className="text-[18px] font-semibold" style={{ color: T.text }}>
            Zoekopdracht maken
          </span>
          <button
            onClick={handleClose}
            className="w-[36px] h-[36px] rounded-full flex items-center justify-center active:scale-95 transition-transform"
            style={{ backgroundColor: w ? OBW.closeBtnBg : "rgba(255,255,255,0.08)" }}
            data-testid="button-location-close"
          >
            <X className="w-4 h-4" style={{ color: w ? OBW.closeBtnColor : "rgba(255,255,255,0.7)" }} />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-5 pb-[140px] min-h-0">
        <p
          className="text-[14px] font-medium"
          style={{ color: T.textSecondary, marginTop: "20px", marginBottom: "8px" }}
        >
          Woonplaats
        </p>
        <button
          onClick={() => navigate(appendWebsiteParams("/onboarding/city", searchString))}
          className={`w-full flex items-center gap-3 mb-5 ${w ? "ha-field" : "ha-field ha-field-dark"}`}
          style={w ? { backgroundColor: OBW.inputBg, borderColor: OBW.inputBorder, color: OBW.text } : undefined}
          data-testid="field-city-display"
        >
          <Search className="w-[16px] h-[16px] shrink-0" style={{ color: T.textMuted }} />
          <span className="flex-1 text-left text-[15px] font-medium" style={{ color: T.text }}>
            {city}
          </span>
          <X
            className="w-[14px] h-[14px] shrink-0"
            style={{ color: T.textMuted }}
          />
        </button>

        {!w && (
          <div
            className="flex p-1 rounded-full mb-5"
            style={{ backgroundColor: w ? OBW.tabBg : "rgba(99,102,241,0.12)" }}
            data-testid="location-tabs"
          >
            {TAB_OPTIONS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setMode(tab.value)}
                className="flex-1 h-[40px] rounded-full text-[13px] font-semibold transition-all"
                style={{
                  backgroundColor: mode === tab.value
                    ? (w ? OBW.tabActiveBg : "rgba(99,102,241,0.35)")
                    : "transparent",
                  color: mode === tab.value
                    ? (w ? OBW.tabActiveColor : "#fff")
                    : (w ? OBW.tabInactiveColor : "rgba(255,255,255,0.5)"),
                }}
                data-testid={`tab-${tab.value}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {mode === "districts" && hasDistricts && !w && (
          <div className="flex-1 flex flex-col min-h-0">
            <p
              className="text-[14px] font-medium mb-2 shrink-0"
              style={{ color: T.textSecondary }}
            >
              Buurten
            </p>
            <button
              onClick={() => setShowDistrictPicker(!showDistrictPicker)}
              className={`w-full flex items-center justify-between shrink-0 ${w ? "ha-field" : "ha-field ha-field-dark"}`}
              data-testid="dropdown-districts"
            >
              <span className="text-[15px] font-medium" style={{ color: T.text }}>
                {districtSummary}
              </span>
              <ChevronDown
                className="w-[16px] h-[16px] shrink-0 transition-transform"
                style={{
                  color: T.textMuted,
                  transform: showDistrictPicker ? "rotate(180deg)" : "none",
                }}
              />
            </button>

            {showDistrictPicker && (
              <div
                className="mt-2 rounded-[6px] overflow-hidden shrink-0"
                style={{
                  border: `1px solid ${T.cardBorder}`,
                  backgroundColor: T.card,
                  maxHeight: "200px",
                  overflowY: "auto",
                }}
                data-testid="district-list"
              >
                {districtList.map((d, i) => {
                  const active = selectedDistricts.includes(d);
                  return (
                    <button
                      key={d}
                      onClick={() => toggleDistrict(d)}
                      className={`w-full flex items-center justify-between px-4 transition-colors ${w ? "hover:bg-gray-50" : "hover:bg-white/5"}`}
                      style={{
                        padding: "12px 16px",
                        borderBottom: i < districtList.length - 1 ? `1px solid ${T.divider}` : "none",
                      }}
                      data-testid={`district-${d}`}
                    >
                      <span className="text-[14px] font-medium" style={{ color: active ? T.text : T.textSecondary }}>
                        {d}
                      </span>
                      {active && <Check className="w-4 h-4" style={{ color: OB.pink }} />}
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
                height="420px"
                className="rounded-[6px] overflow-hidden"
              />
            </div>
          </div>
        )}

        {mode === "radius" && (
          <div className="flex-1 flex flex-col min-h-0">
            <p
              className="text-[14px] font-medium mb-3 shrink-0"
              style={{ color: T.textSecondary }}
            >
              Straal
            </p>
            <div className="flex flex-wrap gap-2 shrink-0" data-testid="radius-options">
              {RADIUS_OPTIONS.map((km) => {
                const active = radiusKm === km;
                return (
                  <button
                    key={km}
                    onClick={() => setRadiusKm(km)}
                    className="px-4 py-2.5 rounded-full text-[14px] font-medium transition-all"
                    style={{
                      border: active
                        ? "1.5px solid rgba(233,30,99,0.6)"
                        : `1px solid ${w ? OBW.chipBorder : "rgba(255,255,255,0.2)"}`,
                      backgroundColor: active ? OB.selectedBg : "transparent",
                      color: active ? OB.pink : (w ? OBW.text : "rgba(255,255,255,0.8)"),
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
                height="420px"
                className="rounded-[6px] overflow-hidden"
              />
            </div>
          </div>
        )}

        {mode === "city" && !w && (
          <div className="flex-1 flex flex-col min-h-0">
            <div
              className="rounded-[6px] p-4 flex items-center gap-3 shrink-0"
              style={{ border: `1px solid ${T.cardBorder}`, backgroundColor: T.card }}
            >
              <div
                className="w-10 h-10 rounded-[6px] flex items-center justify-center shrink-0"
                style={{ backgroundColor: OB.selectedBg }}
              >
                <Check className="w-5 h-5" style={{ color: OB.pink }} />
              </div>
              <p className="text-[14px] leading-relaxed" style={{ color: T.textSecondary }}>
                {`We zoeken in heel ${city} naar passende woningen.`}
              </p>
            </div>

            <div className="mt-4" data-testid="location-map">
              <MapView
                lat={parseFloat(lat)}
                lng={parseFloat(lng)}
                zoom={10}
                markers={[{ lat: parseFloat(lat), lng: parseFloat(lng), type: "primary" }]}
                height="420px"
                className="rounded-[6px] overflow-hidden"
              />
            </div>
          </div>
        )}
      </main>

      <OBFooter
        onBack={handleBack}
        onNext={handleNext}
        nextLabel="Volgende"
        backTestId="button-location-back"
        nextTestId="button-location-next"
        websiteMode={w}
        topContent={
          <div>
            <p className="text-[13px] font-medium" style={{ color: T.textMuted }}>
              Geschatte matches
            </p>
            <p className="text-[15px] font-bold" style={{ color: T.text }}>
              121 per week 🔥
            </p>
          </div>
        }
      />
    </div>
  );
}
