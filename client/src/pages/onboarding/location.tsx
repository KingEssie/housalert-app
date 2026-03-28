import { useState } from "react";
import { useLocation } from "wouter";
import { useHashSearch } from "@/lib/hash-search";
import { useTranslation } from "@/i18n";
import { ChevronLeft, Check, MapPin, Crosshair, Map, X } from "lucide-react";
import { cityDistricts } from "../../../../config/market";
import { OB } from "@/components/onboarding-ui";

type LocationMode = "city" | "districts" | "radius";

const RADIUS_OPTIONS = [2, 5, 10, 15, 25, 50];

export default function OnboardingLocation() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
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

  const TAB_OPTIONS: { value: LocationMode; label: string; available: boolean }[] = [
    ...(hasDistricts ? [{ value: "districts" as LocationMode, label: t("location.tabs.districts") || "Buurten", available: true }] : []),
    { value: "radius", label: t("location.tabs.radius") || "Straal", available: true },
    { value: "city", label: t("onboarding.location.wholeCity") || "Gehele woonplaats", available: true },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col ob-dark" style={{ background: OB.gradient }} data-testid="screen-onboarding-location">
      <header
        className="w-full sticky top-0 z-20 border-b"
        style={{ backgroundColor: OB.headerBg, borderColor: OB.headerBorder, paddingTop: "max(8px, env(safe-area-inset-top))" }}
      >
        <div className="max-w-[480px] mx-auto px-5 h-[52px] flex items-center justify-between">
          <span
            className="text-[12px] font-bold px-2.5 py-1 rounded-[6px]"
            style={{ backgroundColor: "rgba(99,102,241,0.2)", color: "#818cf8" }}
            data-testid="badge-step"
          >
            2/3
          </span>
          <span className="text-[15px] font-semibold" style={{ color: OB.text }}>
            {t("onboarding.location.headerTitle") || "Zoekopdracht maken"}
          </span>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-transform"
            style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
            data-testid="button-location-close"
          >
            <X className="w-4 h-4" style={{ color: OB.textSecondary }} />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-5 pt-5 pb-[120px] overflow-y-auto">
        <h2
          className="text-[22px] font-bold tracking-[-0.02em] mb-1"
          style={{ color: OB.text }}
          data-testid="text-location-title"
        >
          {city}
        </h2>
        <p className="text-[14px] mb-5" style={{ color: OB.textSecondary }}>
          {t("onboarding.location.modeLabel") || "Hoe wil je zoeken?"}
        </p>

        <div
          className="flex p-1 rounded-full mb-6"
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
                color: mode === tab.value ? "#fff" : OB.textSecondary,
              }}
              data-testid={`tab-${tab.value}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {mode === "districts" && hasDistricts && (
          <div className="mb-6">
            <p className="text-[13px] font-semibold mb-3" style={{ color: OB.text }}>
              {t("onboarding.location.districtsLabel") || "Buurten"}
            </p>
            <div className="flex flex-wrap gap-2" data-testid="district-chips">
              {districtList.map((d) => {
                const active = selectedDistricts.includes(d);
                return (
                  <button
                    key={d}
                    onClick={() => toggleDistrict(d)}
                    className="px-3.5 py-2 rounded-full text-[13px] font-medium border transition-all flex items-center gap-1.5"
                    style={{
                      backgroundColor: active ? OB.pink : "transparent",
                      borderColor: active ? OB.pink : OB.cardBorder,
                      color: active ? "#fff" : OB.textSecondary,
                    }}
                    data-testid={`district-${d}`}
                  >
                    {active && <Check className="w-3 h-3" />}
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {mode === "radius" && (
          <div className="mb-6">
            <p className="text-[13px] font-semibold mb-3" style={{ color: OB.text }}>
              {t("location.radiusLabel") || "Straal"}
            </p>
            <div className="flex flex-wrap gap-2" data-testid="radius-options">
              {RADIUS_OPTIONS.map((km) => {
                const active = radiusKm === km;
                return (
                  <button
                    key={km}
                    onClick={() => setRadiusKm(km)}
                    className="px-4 py-2.5 rounded-full text-[14px] font-medium border-2 transition-all"
                    style={{
                      borderColor: active ? OB.selectedBorder : OB.cardBorder,
                      backgroundColor: active ? OB.selectedBg : "transparent",
                      color: active ? OB.pink : OB.text,
                    }}
                    data-testid={`radius-${km}`}
                  >
                    {km} km
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {mode === "city" && (
          <div className="rounded-[10px] border p-4 mb-6" style={{ backgroundColor: OB.card, borderColor: OB.cardBorder }}>
            <p className="text-[14px] leading-relaxed" style={{ color: OB.textSecondary }}>
              {t("onboarding.location.wholeCityHint") || `We zoeken in heel ${city} naar passende woningen.`}
            </p>
          </div>
        )}
      </main>

      <div
        className="fixed bottom-0 left-0 right-0 z-30 border-t"
        style={{
          backgroundColor: OB.headerBg,
          borderColor: OB.headerBorder,
          paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))",
        }}
      >
        <div className="max-w-[480px] mx-auto px-5 pt-3 flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-[52px] h-[52px] rounded-[10px] flex items-center justify-center shrink-0 active:scale-95 transition-transform"
            style={{
              border: `2px solid ${OB.cardBorder}`,
              backgroundColor: "transparent",
            }}
            data-testid="button-location-back"
          >
            <ChevronLeft className="w-5 h-5" style={{ color: OB.text }} />
          </button>
          <button
            onClick={handleNext}
            className="flex-1 h-[52px] rounded-[10px] text-[15px] font-bold text-white transition-all active:scale-[0.97] flex items-center justify-center gap-2"
            style={{ background: OB.pinkGradient, boxShadow: OB.pinkShadow }}
            data-testid="button-location-next"
          >
            {t("common.next") || "Volgende"}
          </button>
        </div>
      </div>
    </div>
  );
}
