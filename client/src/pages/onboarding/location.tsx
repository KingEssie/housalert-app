import { useState } from "react";
import { useLocation } from "wouter";
import { useHashSearch } from "@/lib/hash-search";
import { ChevronLeft, ChevronDown, Check, Search, X } from "lucide-react";
import { cityDistricts } from "../../../../config/market";
import { OB } from "@/components/onboarding-ui";

type LocationMode = "city" | "districts" | "radius";

const RADIUS_OPTIONS = [2, 5, 10, 15, 25, 50];

export default function OnboardingLocation() {
  const [, navigate] = useLocation();
  const searchString = useHashSearch();
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
    incomingMode || (hasDistricts ? "districts" : "city")
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
    navigate(`/onboarding/filters?${nextParams.toString()}`);
  }

  function handleBack() {
    navigate("/onboarding/city");
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
    <div className="min-h-[100dvh] flex flex-col ob-dark" style={{ background: OB.gradient }} data-testid="screen-onboarding-location">
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
            2/4
          </span>
          <span className="text-[18px] font-semibold" style={{ color: "#ffffff" }}>
            Zoekopdracht maken
          </span>
          <button
            onClick={handleClose}
            className="w-[36px] h-[36px] rounded-full flex items-center justify-center active:scale-95 transition-transform"
            style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
            data-testid="button-location-close"
          >
            <X className="w-4 h-4" style={{ color: "rgba(255,255,255,0.7)" }} />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-5 pb-[160px] overflow-y-auto">
        <p
          className="text-[14px] font-medium"
          style={{ color: "rgba(255,255,255,0.6)", marginTop: "20px", marginBottom: "8px" }}
        >
          Woonplaats
        </p>
        <button
          onClick={() => navigate("/onboarding/city")}
          className="w-full h-[56px] rounded-[6px] flex items-center px-4 gap-3 mb-5"
          style={{ border: "1px solid rgba(255,255,255,0.7)", backgroundColor: "transparent" }}
          data-testid="field-city-display"
        >
          <Search className="w-[16px] h-[16px] shrink-0" style={{ color: "rgba(255,255,255,0.5)" }} />
          <span className="flex-1 text-left text-[15px] font-medium" style={{ color: "#ffffff" }}>
            {city}
          </span>
          <X
            className="w-[14px] h-[14px] shrink-0"
            style={{ color: "rgba(255,255,255,0.4)" }}
          />
        </button>

        <div
          className="flex p-1 rounded-full mb-5"
          style={{ backgroundColor: "rgba(99,102,241,0.12)" }}
          data-testid="location-tabs"
        >
          {TAB_OPTIONS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setMode(tab.value)}
              className="flex-1 h-[40px] rounded-full text-[13px] font-semibold transition-all"
              style={{
                backgroundColor: mode === tab.value ? "rgba(99,102,241,0.35)" : "transparent",
                color: mode === tab.value ? "#fff" : "rgba(255,255,255,0.5)",
              }}
              data-testid={`tab-${tab.value}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {mode === "districts" && hasDistricts && (
          <div className="mb-4">
            <p
              className="text-[14px] font-medium mb-2"
              style={{ color: "rgba(255,255,255,0.6)" }}
            >
              Buurten
            </p>
            <button
              onClick={() => setShowDistrictPicker(!showDistrictPicker)}
              className="w-full h-[56px] rounded-[6px] flex items-center justify-between px-4"
              style={{ border: "1px solid rgba(255,255,255,0.7)", backgroundColor: "transparent" }}
              data-testid="dropdown-districts"
            >
              <span className="text-[15px] font-medium" style={{ color: "#ffffff" }}>
                {districtSummary}
              </span>
              <ChevronDown
                className="w-[16px] h-[16px] shrink-0 transition-transform"
                style={{
                  color: "rgba(255,255,255,0.5)",
                  transform: showDistrictPicker ? "rotate(180deg)" : "none",
                }}
              />
            </button>

            {showDistrictPicker && (
              <div
                className="mt-2 rounded-[6px] overflow-hidden"
                style={{ border: "1px solid rgba(255,255,255,0.1)", backgroundColor: "rgba(255,255,255,0.04)" }}
                data-testid="district-list"
              >
                {districtList.map((d, i) => {
                  const active = selectedDistricts.includes(d);
                  return (
                    <button
                      key={d}
                      onClick={() => toggleDistrict(d)}
                      className="w-full flex items-center justify-between px-4 transition-colors hover:bg-white/5"
                      style={{
                        padding: "12px 16px",
                        borderBottom: i < districtList.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                      }}
                      data-testid={`district-${d}`}
                    >
                      <span className="text-[14px] font-medium" style={{ color: active ? "#ffffff" : "rgba(255,255,255,0.7)" }}>
                        {d}
                      </span>
                      {active && <Check className="w-4 h-4" style={{ color: OB.pink }} />}
                    </button>
                  );
                })}
              </div>
            )}

            <div
              className="mt-4 rounded-[6px] overflow-hidden"
              style={{ border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <iframe
                title="Map"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(lng) - 0.05},${parseFloat(lat) - 0.03},${parseFloat(lng) + 0.05},${parseFloat(lat) + 0.03}&layer=mapnik&marker=${lat},${lng}`}
                className="w-full"
                style={{ height: "180px", border: "none", opacity: 0.85 }}
                data-testid="location-map"
              />
            </div>
          </div>
        )}

        {mode === "radius" && (
          <div className="mb-4">
            <p
              className="text-[14px] font-medium mb-3"
              style={{ color: "rgba(255,255,255,0.6)" }}
            >
              Straal
            </p>
            <div className="flex flex-wrap gap-2" data-testid="radius-options">
              {RADIUS_OPTIONS.map((km) => {
                const active = radiusKm === km;
                return (
                  <button
                    key={km}
                    onClick={() => setRadiusKm(km)}
                    className="px-4 py-2.5 rounded-full text-[14px] font-medium transition-all"
                    style={{
                      border: active ? "1.5px solid rgba(233,30,99,0.6)" : "1px solid rgba(255,255,255,0.2)",
                      backgroundColor: active ? "rgba(233,30,99,0.12)" : "transparent",
                      color: active ? OB.pink : "rgba(255,255,255,0.8)",
                    }}
                    data-testid={`radius-${km}`}
                  >
                    {km} km
                  </button>
                );
              })}
            </div>

            <div
              className="mt-4 rounded-[6px] overflow-hidden"
              style={{ border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <iframe
                title="Map"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(lng) - 0.08},${parseFloat(lat) - 0.05},${parseFloat(lng) + 0.08},${parseFloat(lat) + 0.05}&layer=mapnik&marker=${lat},${lng}`}
                className="w-full"
                style={{ height: "180px", border: "none", opacity: 0.85 }}
                data-testid="location-map"
              />
            </div>
          </div>
        )}

        {mode === "city" && (
          <div className="mb-4">
            <div
              className="rounded-[6px] p-4 flex items-center gap-3"
              style={{ border: "1px solid rgba(255,255,255,0.1)", backgroundColor: "rgba(255,255,255,0.04)" }}
            >
              <div
                className="w-10 h-10 rounded-[6px] flex items-center justify-center shrink-0"
                style={{ backgroundColor: "rgba(233,30,99,0.12)" }}
              >
                <Check className="w-5 h-5" style={{ color: OB.pink }} />
              </div>
              <p className="text-[14px] leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
                {`We zoeken in heel ${city} naar passende woningen.`}
              </p>
            </div>

            <div
              className="mt-4 rounded-[6px] overflow-hidden"
              style={{ border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <iframe
                title="Map"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(lng) - 0.06},${parseFloat(lat) - 0.04},${parseFloat(lng) + 0.06},${parseFloat(lat) + 0.04}&layer=mapnik&marker=${lat},${lng}`}
                className="w-full"
                style={{ height: "180px", border: "none", opacity: 0.85 }}
                data-testid="location-map"
              />
            </div>
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
        <div className="max-w-[480px] mx-auto px-5 pt-3">
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <p className="text-[13px] font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>
                Geschatte matches
              </p>
              <p className="text-[15px] font-bold" style={{ color: "#ffffff" }}>
                121 per week 🔥
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="w-[48px] h-[48px] rounded-[12px] flex items-center justify-center shrink-0 active:scale-95 transition-transform"
              style={{
                border: "1.5px solid rgba(255,255,255,0.25)",
                backgroundColor: "transparent",
              }}
              data-testid="button-location-back"
            >
              <ChevronLeft className="w-[18px] h-[18px]" style={{ color: "#ffffff" }} />
            </button>
            <button
              onClick={handleNext}
              className="flex-1 h-[48px] rounded-[12px] text-[15px] font-bold text-white transition-all active:scale-[0.97] flex items-center justify-center"
              style={{ background: OB.pinkGradient, boxShadow: "0 8px 20px rgba(255,0,100,0.25)" }}
              data-testid="button-location-next"
            >
              Volgende
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
