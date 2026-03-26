import { useState } from "react";
import { useLocation } from "wouter";
import { useHashSearch } from "@/lib/hash-search";
import { useTranslation } from "@/i18n";
import { HousAlertLogo } from "@/components/housalert-logo";
import { ChevronLeft, Check, MapPin, Crosshair, Map } from "lucide-react";
import { cityDistricts } from "../../../../config/market";

const BRAND = "rgb(var(--ha-primary))";
const BRAND_HOVER = "rgb(var(--ha-primary-hover))";
const TEXT_PRIMARY = "rgb(var(--ha-text))";
const TEXT_SECONDARY = "rgb(var(--ha-text-secondary))";
const BORDER = "rgb(var(--ha-card-border))";

type LocationMode = "city" | "districts" | "radius";

const RADIUS_OPTIONS = [2, 5, 10, 15, 25, 50];

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-1.5 justify-center py-3" data-testid="progress-dots">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="h-[6px] rounded-full transition-all"
          style={{
            width: i === current ? 24 : 6,
            backgroundColor: i <= current ? BRAND : "rgba(var(--ha-text-rgb, 26,26,46), 0.12)",
          }}
        />
      ))}
    </div>
  );
}

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

  const MODE_OPTIONS: { value: LocationMode; label: string; icon: typeof Map; available: boolean }[] = [
    ...(hasDistricts ? [{ value: "districts" as LocationMode, label: t("location.tabs.districts") || "Stadtteile", icon: MapPin, available: true }] : []),
    { value: "radius", label: t("location.tabs.radius") || "Radius", icon: Crosshair, available: true },
    { value: "city", label: t("onboarding.location.wholeCity") || "Ganze Stadt", icon: Map, available: true },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-ha-bg" data-testid="screen-onboarding-location">
      <header className="sticky top-0 z-20 bg-ha-card border-b border-ha-card-border">
        <div className="max-w-[480px] mx-auto px-5 h-[56px] flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-10 h-10 rounded-full bg-ha-surface flex items-center justify-center active:scale-95 transition-transform"
            data-testid="button-location-back"
          >
            <ChevronLeft className="w-5 h-5 text-ha-text-muted" />
          </button>
          <div className="flex-1 flex justify-center">
            <HousAlertLogo size={28} />
          </div>
          <div className="w-10" />
        </div>
      </header>

      <div className="max-w-[480px] mx-auto px-5 w-full">
        <ProgressDots current={1} total={4} />
      </div>

      <main className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-5 pt-4 pb-8">
        <h1
          className="text-[24px] font-bold tracking-[-0.02em] text-ha-text mb-1"
          data-testid="text-location-title"
        >
          {city}
        </h1>
        <p className="text-[14px] text-ha-text-secondary mb-6">
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
                  borderColor: active ? BRAND : BORDER,
                  backgroundColor: active ? "rgba(var(--ha-primary-rgb, 233,30,99), 0.04)" : "transparent",
                }}
                data-testid={`mode-${opt.value}`}
              >
                <div
                  className="w-10 h-10 rounded-[6px] flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: active
                      ? "rgba(var(--ha-primary-rgb, 233,30,99), 0.10)"
                      : "rgba(var(--ha-text-rgb, 26,26,46), 0.05)",
                  }}
                >
                  <Icon className="w-5 h-5" style={{ color: active ? BRAND : TEXT_SECONDARY }} />
                </div>
                <span
                  className="text-[15px] font-medium"
                  style={{ color: active ? BRAND : TEXT_PRIMARY }}
                >
                  {opt.label}
                </span>
                {active && (
                  <Check className="w-5 h-5 ml-auto shrink-0" style={{ color: BRAND }} />
                )}
              </button>
            );
          })}
        </div>

        {mode === "districts" && hasDistricts && (
          <div className="mb-6">
            <p className="text-[13px] font-medium text-ha-text-secondary mb-3">
              {t("onboarding.location.districtsLabel") || "Stadtteile (optional)"}
            </p>
            <div className="flex flex-wrap gap-2" data-testid="district-chips">
              {districtList.map((d) => {
                const active = selectedDistricts.includes(d);
                return (
                  <button
                    key={d}
                    onClick={() => toggleDistrict(d)}
                    className="px-3 py-1.5 rounded-full text-[13px] font-medium border transition-all"
                    style={{
                      backgroundColor: active ? BRAND : "transparent",
                      borderColor: active ? BRAND : BORDER,
                      color: active ? "#fff" : TEXT_SECONDARY,
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
            <p className="text-[13px] font-medium text-ha-text-secondary mb-3">
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
                      borderColor: active ? BRAND : BORDER,
                      backgroundColor: active ? "rgba(var(--ha-primary-rgb, 233,30,99), 0.06)" : "transparent",
                      color: active ? BRAND : TEXT_PRIMARY,
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
          <div className="bg-ha-card rounded-[6px] border border-ha-card-border p-4 mb-6">
            <p className="text-[14px] text-ha-text leading-relaxed">
              {t("onboarding.location.wholeCityHint") || `Wir suchen in ganz ${city} nach passenden Wohnungen.`}
            </p>
          </div>
        )}

        <div className="mt-auto pt-6">
          <button
            onClick={handleNext}
            className="w-full h-[52px] rounded-[6px] text-[15px] font-bold text-white transition-all active:scale-[0.97]"
            style={{ backgroundColor: BRAND }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = BRAND_HOVER)}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = BRAND)}
            data-testid="button-location-next"
          >
            {t("common.next") || "Weiter"}
          </button>
        </div>
      </main>
    </div>
  );
}
