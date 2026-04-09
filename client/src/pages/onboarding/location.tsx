import { useState } from "react";
import { useLocation } from "wouter";
import { useHashSearch } from "@/lib/hash-search";
import { ChevronDown, Check, Search, X } from "lucide-react";
import { cityDistricts } from "../../../../config/market";
import { OB, OBW, ONBOARDING_TOTAL_STEPS, OBFooter, useWebsiteMode, appendWebsiteParams } from "@/components/onboarding-ui";
import { OnboardingFlowLayout } from "@/components/onboarding-flow-layout";
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

  if (w) {
    return (
      <div
        className="min-h-[100dvh] flex flex-col"
        style={{ background: T.gradient, borderRadius: 0 }}
        data-testid="screen-onboarding-location"
      >
        <header
          className="w-full sticky top-0 z-20"
          style={{
            backgroundColor: T.headerBg,
            borderBottom: `1px solid ${T.headerBorder}`,
          }}
        >
          <div className="max-w-[480px] mx-auto px-5 h-[52px] flex items-center justify-between">
            <span
              className="text-[12px] font-semibold px-2.5 py-1 rounded-[6px]"
              style={{ backgroundColor: "#111111", color: "#ffffff" }}
              data-testid="badge-step"
            >
              {`${w ? "1" : "2"}/${w ? "2" : ONBOARDING_TOTAL_STEPS}`}
            </span>
            <span className="text-[20px] font-semibold" style={{ color: T.text }}>
              Zoekopdracht maken
            </span>
            <button
              onClick={handleClose}
              className="w-[36px] h-[36px] rounded-full flex items-center justify-center active:scale-95 transition-transform"
              style={{ backgroundColor: OBW.closeBtnBg }}
              data-testid="button-location-close"
            >
              <X className="w-4 h-4" style={{ color: OBW.closeBtnColor }} />
            </button>
          </div>
        </header>

        <main className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-5 pb-[140px] min-h-0">
          <p className="text-[14px] font-medium" style={{ color: T.textSecondary, marginTop: "20px", marginBottom: "8px" }}>
            Woonplaats
          </p>
          <button
            onClick={() => navigate(appendWebsiteParams("/onboarding/city", searchString))}
            className="w-full flex items-center gap-3 mb-5 ha-field"
            style={{ backgroundColor: OBW.inputBg, borderColor: OBW.inputBorder, color: OBW.text }}
            data-testid="field-city-display"
          >
            <Search className="w-[16px] h-[16px] shrink-0" style={{ color: T.textMuted }} />
            <span className="flex-1 text-left text-[15px] font-medium" style={{ color: T.text }}>{city}</span>
            <X className="w-[14px] h-[14px] shrink-0" style={{ color: T.textMuted }} />
          </button>

          {mode === "radius" && (
            <div className="flex-1 flex flex-col min-h-0">
              <p className="text-[14px] font-medium mb-3 shrink-0" style={{ color: T.textSecondary }}>Straal</p>
              <div className="flex flex-wrap gap-2 shrink-0" data-testid="radius-options">
                {RADIUS_OPTIONS.map((km) => {
                  const active = radiusKm === km;
                  return (
                    <button
                      key={km}
                      onClick={() => setRadiusKm(km)}
                      className="px-4 py-2.5 rounded-full text-[14px] font-medium transition-all"
                      style={{
                        border: active ? "1.5px solid rgba(217,26,104,0.6)" : `1px solid ${OBW.chipBorder}`,
                        backgroundColor: active ? OB.selectedBg : "transparent",
                        color: active ? OB.pink : OBW.text,
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
                  height="clamp(240px, 35vh, 360px)"
                  className="rounded-[12px] overflow-hidden"
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
              <p className="text-[13px] font-medium" style={{ color: T.textMuted }}>Geschatte matches</p>
              <p className="text-[15px] font-semibold" style={{ color: T.text }}>121 per week 🔥</p>
            </div>
          }
        />
      </div>
    );
  }

  const locationContent = (
    <>
      <button
        onClick={() => navigate(appendWebsiteParams("/onboarding/city", searchString))}
        className="w-full flex items-center gap-3 mb-5 h-[56px] rounded-[16px] border border-[#E5E7EB] bg-white px-4"
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
          <p className="text-[14px] font-medium mb-2 text-[#334855]">Buurten</p>
          <button
            onClick={() => setShowDistrictPicker(!showDistrictPicker)}
            className="w-full flex items-center justify-between h-[56px] rounded-[16px] border border-[#E5E7EB] bg-white px-4"
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
          <p className="text-[14px] font-medium mb-3 text-[#334855]">Straal</p>
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
              {`We zoeken in heel ${city} naar passende woningen.`}
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
      flowTitle="Zoekopdracht maken"
      currentStep={2}
      totalSteps={3}
      stepTitle="Stel je locatie in"
      stepDescription="Kies hoe breed je wilt zoeken rondom je stad."
      onBack={handleBack}
      onNext={handleNext}
      onClose={handleClose}
      nextLabel="Volgende"
      backTestId="button-location-back"
      nextTestId="button-location-next"
      closeTestId="button-location-close"
      screenTestId="screen-onboarding-location"
    >
      {locationContent}
    </OnboardingFlowLayout>
  );
}
