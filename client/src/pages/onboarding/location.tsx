import { useState } from "react";
import { useLocation } from "wouter";
import { useHashSearch } from "@/lib/hash-search";
import { useTranslation } from "@/i18n";
import { HousAlertLogo } from "@/components/housalert-logo";
import { ChevronLeft, Check, MapPin, Crosshair, Map } from "lucide-react";
import { cityDistricts } from "../../../../config/market";
import { OB, OBProgressDots, OBStickyBar } from "@/components/onboarding-ui";

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

  const MODE_OPTIONS: { value: LocationMode; label: string; desc: string; icon: typeof Map; available: boolean }[] = [
    ...(hasDistricts ? [{ value: "districts" as LocationMode, label: t("location.tabs.districts") || "Stadtteile", desc: t("location.tabs.districtsDesc") || "Wähle bestimmte Stadtteile aus", icon: MapPin, available: true }] : []),
    { value: "radius", label: t("location.tabs.radius") || "Radius", desc: t("location.tabs.radiusDesc") || "Suche im Umkreis eines Punktes", icon: Crosshair, available: true },
    { value: "city", label: t("onboarding.location.wholeCity") || "Ganze Stadt", desc: t("onboarding.location.wholeCityDesc") || "Alle Angebote in der gesamten Stadt", icon: Map, available: true },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col ob-dark" style={{ background: OB.gradient }} data-testid="screen-onboarding-location">
      <header className="sticky top-0 z-20 backdrop-blur-md border-b" style={{ backgroundColor: OB.headerBg, borderColor: OB.headerBorder }}>
        <div className="max-w-[480px] mx-auto px-5 h-[56px] flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-transform"
            style={{ backgroundColor: OB.backBtnBg }}
            data-testid="button-location-back"
          >
            <ChevronLeft className="w-5 h-5" style={{ color: OB.textSecondary }} />
          </button>
          <div className="flex-1 flex justify-center">
            <HousAlertLogo size={28} />
          </div>
          <div className="w-10" />
        </div>
      </header>

      <div className="max-w-[480px] mx-auto px-5 w-full">
        <OBProgressDots current={1} total={4} />
      </div>

      <main className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-5 pt-4 pb-[100px]">
        <h1
          className="text-[24px] font-bold tracking-[-0.02em] mb-1"
          style={{ color: OB.text }}
          data-testid="text-location-title"
        >
          {city}
        </h1>
        <p className="text-[14px] mb-6" style={{ color: OB.textSecondary }}>
          {t("onboarding.location.modeLabel") || "Wie möchtest du suchen?"}
        </p>

        <div className="flex flex-col gap-3 mb-6">
          {MODE_OPTIONS.map((opt) => {
            const active = mode === opt.value;
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                onClick={() => setMode(opt.value)}
                className="flex items-center gap-4 p-4 rounded-[6px] border-2 transition-all text-left"
                style={{
                  borderColor: active ? OB.selectedBorder : OB.cardBorder,
                  backgroundColor: active ? OB.selectedBg : OB.card,
                }}
                data-testid={`mode-${opt.value}`}
              >
                <div
                  className="w-12 h-12 rounded-[6px] flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: active ? OB.accentBg : OB.surface,
                  }}
                >
                  <Icon className="w-5 h-5" style={{ color: active ? OB.pink : OB.textMuted }} />
                </div>
                <div className="flex-1">
                  <span
                    className="text-[15px] font-semibold block"
                    style={{ color: active ? OB.text : OB.textSecondary }}
                  >
                    {opt.label}
                  </span>
                  <span className="text-[13px] mt-0.5 block" style={{ color: OB.textMuted }}>
                    {opt.desc}
                  </span>
                </div>
                {active && (
                  <Check className="w-5 h-5 ml-auto shrink-0" style={{ color: OB.pink }} />
                )}
              </button>
            );
          })}
        </div>

        {mode === "districts" && hasDistricts && (
          <div className="mb-6">
            <p className="text-[13px] font-medium mb-3" style={{ color: OB.textSecondary }}>
              {t("onboarding.location.districtsLabel") || "Stadtteile (optional)"}
            </p>
            <div className="flex flex-wrap gap-2" data-testid="district-chips">
              {districtList.map((d) => {
                const active = selectedDistricts.includes(d);
                return (
                  <button
                    key={d}
                    onClick={() => toggleDistrict(d)}
                    className="px-3.5 py-2 rounded-[6px] text-[13px] font-medium border transition-all"
                    style={{
                      backgroundColor: active ? OB.pink : "transparent",
                      borderColor: active ? OB.pink : OB.cardBorder,
                      color: active ? "#fff" : OB.textSecondary,
                    }}
                    data-testid={`district-${d}`}
                  >
                    {active && <Check className="w-3 h-3 inline mr-1" />}
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {mode === "radius" && (
          <div className="mb-6">
            <p className="text-[13px] font-medium mb-3" style={{ color: OB.textSecondary }}>
              {t("location.radiusLabel") || "Radius"}
            </p>
            <div className="flex flex-wrap gap-2" data-testid="radius-options">
              {RADIUS_OPTIONS.map((km) => {
                const active = radiusKm === km;
                return (
                  <button
                    key={km}
                    onClick={() => setRadiusKm(km)}
                    className="px-4 py-2.5 rounded-[6px] text-[14px] font-medium border-2 transition-all"
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
          <div className="rounded-[6px] border p-4 mb-6" style={{ backgroundColor: OB.card, borderColor: OB.cardBorder }}>
            <p className="text-[14px] leading-relaxed" style={{ color: OB.textSecondary }}>
              {t("onboarding.location.wholeCityHint") || `Wir suchen in ganz ${city} nach passenden Wohnungen.`}
            </p>
          </div>
        )}
      </main>

      <OBStickyBar>
        <button
          onClick={handleNext}
          className="w-full h-[56px] rounded-[6px] text-[15px] font-bold text-white transition-all active:scale-[0.97]"
          style={{ background: OB.pinkGradient, boxShadow: OB.pinkShadow }}
          data-testid="button-location-next"
        >
          {t("common.next") || "Weiter"}
        </button>
      </OBStickyBar>
    </div>
  );
}
