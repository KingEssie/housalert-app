import { useState } from "react";
import { useLocation } from "wouter";
import { useHashSearch } from "@/lib/hash-search";
import { useTranslation } from "@/i18n";
import { HousAlertLogo } from "@/components/housalert-logo";
import {
  ChevronLeft, Check, Bath, Sun, Trees, Leaf, Sparkles,
} from "lucide-react";

const BRAND = "rgb(var(--ha-primary))";
const BRAND_HOVER = "rgb(var(--ha-primary-hover))";
const TEXT_PRIMARY = "rgb(var(--ha-text))";
const TEXT_SECONDARY = "rgb(var(--ha-text-secondary))";
const BORDER = "rgb(var(--ha-card-border))";

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

function SegmentedControl({
  options,
  value,
  onChange,
  testId,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  testId: string;
}) {
  return (
    <div
      className="flex gap-1 p-1 rounded-[6px] bg-ha-surface border border-ha-card-border"
      data-testid={testId}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="flex-1 h-[38px] rounded-[5px] text-[13px] font-medium transition-all"
          style={{
            backgroundColor: value === opt.value ? BRAND : "transparent",
            color: value === opt.value ? "#fff" : TEXT_SECONDARY,
          }}
          data-testid={`${testId}-${opt.value}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  testId,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  testId: string;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer" data-testid={testId}>
      <div
        className="w-[44px] h-[24px] rounded-full p-[2px] transition-colors shrink-0"
        style={{ backgroundColor: checked ? BRAND : "rgba(var(--ha-text-rgb, 26,26,46), 0.15)" }}
        onClick={() => onChange(!checked)}
      >
        <div
          className="w-[20px] h-[20px] rounded-full bg-white transition-transform shadow-sm"
          style={{ transform: checked ? "translateX(20px)" : "translateX(0)" }}
        />
      </div>
      <span className="text-[13px] text-ha-text leading-snug">{label}</span>
    </label>
  );
}

function RangeSlider({
  min,
  max,
  step,
  value,
  onChange,
  formatLabel,
  testId,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  formatLabel: (v: number) => string;
  testId: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div data-testid={testId}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
        style={{
          background: `linear-gradient(to right, ${BRAND} 0%, ${BRAND} ${pct}%, rgba(var(--ha-text-rgb,26,26,46),0.1) ${pct}%, rgba(var(--ha-text-rgb,26,26,46),0.1) 100%)`,
        }}
      />
      <div className="flex justify-between mt-1">
        <span className="text-[12px] text-ha-text-muted">{formatLabel(min)}</span>
        <span className="text-[13px] font-semibold" style={{ color: BRAND }}>{formatLabel(value)}</span>
        <span className="text-[12px] text-ha-text-muted">{formatLabel(max)}</span>
      </div>
    </div>
  );
}

const AMENITY_OPTIONS = [
  { value: "bath", labelKey: "amenities.bath", fallback: "Badewanne", icon: Bath },
  { value: "balcony", labelKey: "amenities.balcony", fallback: "Balkon", icon: Sun },
  { value: "garden", labelKey: "amenities.garden", fallback: "Garten", icon: Trees },
  { value: "rooftop", labelKey: "amenities.rooftop", fallback: "Dachterrasse", icon: Sun },
  { value: "energy_c", labelKey: "amenities.energyC", fallback: "Energielabel C+", icon: Leaf },
];

interface FilterData {
  minPrice: number;
  maxPrice: number;
  priceFlexible: boolean;
  propertyType: string;
  includeRooms: boolean;
  minRooms: string;
  minSize: number;
  sizeNA: boolean;
  furnished: string;
  amenities: string[];
  sendUnclear: boolean;
}

const INITIAL_FILTERS: FilterData = {
  minPrice: 0,
  maxPrice: 1500,
  priceFlexible: false,
  propertyType: "any",
  includeRooms: false,
  minRooms: "any",
  minSize: 30,
  sizeNA: false,
  furnished: "any",
  amenities: [],
  sendUnclear: true,
};

export default function OnboardingFilters() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const searchString = useHashSearch();
  const incomingParams = new URLSearchParams(searchString);

  const city = incomingParams.get("city") || "";
  const lat = incomingParams.get("lat") || "0";
  const lng = incomingParams.get("lng") || "0";
  const locationMode = incomingParams.get("locationMode") || "city";
  const districts = incomingParams.get("districts") || "";
  const radiusKm = incomingParams.get("radiusKm") || "";

  const [f, setF] = useState<FilterData>(INITIAL_FILTERS);

  function update(partial: Partial<FilterData>) {
    setF((prev) => ({ ...prev, ...partial }));
  }

  function toggleAmenity(a: string) {
    setF((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(a)
        ? prev.amenities.filter((x) => x !== a)
        : [...prev.amenities, a],
    }));
  }

  function handleNext() {
    const outParams = new URLSearchParams({
      city,
      lat,
      lng,
      locationMode,
      minPrice: String(f.minPrice),
      maxPrice: String(f.maxPrice),
      minRooms: f.minRooms === "any" ? "0" : f.minRooms,
      minSize: String(f.sizeNA ? 0 : f.minSize),
      furnished: f.furnished,
    });
    if (districts) outParams.set("districts", districts);
    if (radiusKm) outParams.set("radiusKm", radiusKm);
    if (f.propertyType !== "any") {
      outParams.set("propertyTypes", f.propertyType);
    }
    if (f.amenities.length > 0) {
      outParams.set("amenities", f.amenities.join(","));
    }
    if (f.priceFlexible) outParams.set("priceFlexible", "true");
    if (f.includeRooms) outParams.set("includeRooms", "true");
    if (f.sendUnclear) outParams.set("sendUnclear", "true");

    navigate(`/onboarding/name?${outParams.toString()}`);
  }

  function handleBack() {
    const backParams = new URLSearchParams({ city, lat, lng, locationMode });
    if (districts) backParams.set("districts", districts);
    if (radiusKm) backParams.set("radiusKm", radiusKm);
    navigate(`/onboarding/location?${backParams.toString()}`);
  }

  const ROOM_OPTIONS = [
    { value: "any", label: "Studio+" },
    { value: "1", label: "1+" },
    { value: "2", label: "2+" },
    { value: "3", label: "3+" },
    { value: "4", label: "4+" },
    { value: "5", label: "5+" },
  ];

  const PROPERTY_OPTIONS = [
    { value: "any", label: t("onboarding.propertyType.any") || "Egal" },
    { value: "apartment", label: t("onboarding.propertyType.apartment") || "Wohnung" },
    { value: "house", label: t("onboarding.filters.house") || "Haus" },
  ];

  const FURNISHED_OPTIONS = [
    { value: "any", label: t("onboarding.filters.furnishedAny") || "Egal" },
    { value: "furnished", label: t("onboarding.filters.furnishedYes") || "Ja" },
    { value: "unfurnished", label: t("onboarding.filters.furnishedNo") || "Nein" },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-ha-bg" data-testid="screen-onboarding-filters">
      <header className="sticky top-0 z-20 bg-ha-card border-b border-ha-card-border">
        <div className="max-w-[480px] mx-auto px-5 h-[56px] flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-10 h-10 rounded-full bg-ha-surface flex items-center justify-center active:scale-95 transition-transform"
            data-testid="button-filters-back"
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
        <ProgressDots current={2} total={4} />
      </div>

      <main className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-5 pt-4 pb-[140px] overflow-y-auto">
        <h1
          className="text-[24px] font-bold tracking-[-0.02em] text-ha-text mb-2"
          data-testid="text-filters-title"
        >
          {t("onboarding.filters.title") || "Was suchst du genau?"}
        </h1>
        <p className="text-[14px] text-ha-text-secondary mb-6">
          {t("onboarding.filters.subtitle") || "Grenze deine Suche ein."}
        </p>

        <div className="flex flex-col gap-7">
          <section>
            <label className="text-[13px] font-semibold text-ha-text mb-3 block">
              {t("onboarding.filters.rentLabel") || "Mietpreis"}
            </label>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1">
                <label className="text-[11px] text-ha-text-muted mb-1 block">Min</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={f.minPrice || ""}
                  onChange={(e) => update({ minPrice: Number(e.target.value) || 0 })}
                  placeholder="0"
                  className="w-full h-[40px] px-3 rounded-[6px] border bg-ha-card text-[14px] font-medium text-ha-text placeholder:text-ha-text-muted focus:border-ha-primary outline-none"
                  style={{ borderColor: BORDER }}
                  data-testid="input-min-price"
                />
              </div>
              <span className="text-ha-text-muted mt-5">—</span>
              <div className="flex-1">
                <label className="text-[11px] text-ha-text-muted mb-1 block">Max</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={f.maxPrice || ""}
                  onChange={(e) => update({ maxPrice: Number(e.target.value) || 0 })}
                  placeholder="1500"
                  className="w-full h-[40px] px-3 rounded-[6px] border bg-ha-card text-[14px] font-medium text-ha-text placeholder:text-ha-text-muted focus:border-ha-primary outline-none"
                  style={{ borderColor: BORDER }}
                  data-testid="input-max-price"
                />
              </div>
              <span className="text-[13px] font-medium text-ha-text-muted mt-5">€</span>
            </div>
            <RangeSlider
              min={0}
              max={3000}
              step={50}
              value={f.maxPrice}
              onChange={(v) => update({ maxPrice: v })}
              formatLabel={(v) => `€${v}`}
              testId="slider-max-price"
            />
            <div className="mt-3">
              <Toggle
                checked={f.priceFlexible}
                onChange={(v) => update({ priceFlexible: v })}
                label={t("onboarding.filters.priceFlexible") || "Sende auch etwas teurere perfekte Treffer"}
                testId="toggle-price-flexible"
              />
            </div>
          </section>

          <div className="h-px bg-ha-card-border" />

          <section>
            <label className="text-[13px] font-semibold text-ha-text mb-3 block">
              {t("onboarding.filters.propertyTypeLabel") || "Wohnungsart"}
            </label>
            <SegmentedControl
              options={PROPERTY_OPTIONS}
              value={f.propertyType}
              onChange={(v) => update({ propertyType: v })}
              testId="property-type"
            />
            <div className="mt-3">
              <Toggle
                checked={f.includeRooms}
                onChange={(v) => update({ includeRooms: v })}
                label={t("onboarding.filters.includeRooms") || "Auch Zimmer / unselbständige Wohnräume suchen"}
                testId="toggle-include-rooms"
              />
            </div>
          </section>

          <div className="h-px bg-ha-card-border" />

          <section>
            <label className="text-[13px] font-semibold text-ha-text mb-3 block">
              {t("onboarding.filters.bedroomsLabel") || "Schlafzimmer"}
            </label>
            <div
              className="flex gap-1 p-1 rounded-[6px] bg-ha-surface border border-ha-card-border"
              data-testid="rooms-selector"
            >
              {ROOM_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => update({ minRooms: opt.value })}
                  className="flex-1 h-[38px] rounded-[5px] text-[13px] font-medium transition-all"
                  style={{
                    backgroundColor: f.minRooms === opt.value ? BRAND : "transparent",
                    color: f.minRooms === opt.value ? "#fff" : TEXT_SECONDARY,
                  }}
                  data-testid={`rooms-${opt.value}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </section>

          <div className="h-px bg-ha-card-border" />

          <section>
            <div className="flex items-center justify-between mb-3">
              <label className="text-[13px] font-semibold text-ha-text">
                {t("onboarding.filters.minSizeLabel") || "Mindestfläche"}
              </label>
              <button
                onClick={() => update({ sizeNA: !f.sizeNA, minSize: f.sizeNA ? 30 : 0 })}
                className="text-[12px] font-medium px-2.5 py-1 rounded-full border transition-all"
                style={{
                  borderColor: f.sizeNA ? BRAND : BORDER,
                  backgroundColor: f.sizeNA ? "rgba(var(--ha-primary-rgb, 233,30,99), 0.06)" : "transparent",
                  color: f.sizeNA ? BRAND : TEXT_SECONDARY,
                }}
                data-testid="button-size-na"
              >
                n.v.t.
              </button>
            </div>
            {!f.sizeNA && (
              <RangeSlider
                min={0}
                max={200}
                step={5}
                value={f.minSize}
                onChange={(v) => update({ minSize: v })}
                formatLabel={(v) => `${v} m²`}
                testId="slider-min-size"
              />
            )}
          </section>

          <div className="h-px bg-ha-card-border" />

          <section>
            <label className="text-[13px] font-semibold text-ha-text mb-3 block">
              {t("onboarding.filters.furnishedLabel") || "Möbliert"}
            </label>
            <SegmentedControl
              options={FURNISHED_OPTIONS}
              value={f.furnished}
              onChange={(v) => update({ furnished: v })}
              testId="furnished-selector"
            />
          </section>

          <div className="h-px bg-ha-card-border" />

          <section>
            <label className="text-[13px] font-semibold text-ha-text mb-3 block">
              {t("onboarding.filters.amenitiesLabel") || "Weitere Wünsche"}
            </label>
            <div className="flex flex-wrap gap-2" data-testid="amenity-chips">
              {AMENITY_OPTIONS.map(({ value, labelKey, fallback, icon: Icon }) => {
                const active = f.amenities.includes(value);
                return (
                  <button
                    key={value}
                    onClick={() => toggleAmenity(value)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-full text-[13px] font-medium border transition-all"
                    style={{
                      backgroundColor: active ? BRAND : "transparent",
                      borderColor: active ? BRAND : BORDER,
                      color: active ? "#fff" : TEXT_SECONDARY,
                    }}
                    data-testid={`amenity-${value}`}
                  >
                    {active && <Check className="w-3 h-3" />}
                    <Icon className="w-3.5 h-3.5" />
                    {t(labelKey) || fallback}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="h-px bg-ha-card-border" />

          <section>
            <Toggle
              checked={f.sendUnclear}
              onChange={(v) => update({ sendUnclear: v })}
              label={t("onboarding.filters.sendUnclear") || "Sende mir Wohnungen, bei denen meine Kriterien nicht eindeutig angegeben sind"}
              testId="toggle-send-unclear"
            />
          </section>
        </div>
      </main>

      <div
        className="fixed bottom-0 left-0 right-0 bg-ha-card border-t border-ha-card-border z-30"
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))" }}
      >
        <div className="max-w-[480px] mx-auto px-5 pt-3 flex items-center gap-3">
          <button
            onClick={handleBack}
            className="h-[52px] px-6 rounded-[6px] text-[15px] font-medium border-2 transition-all active:scale-[0.97]"
            style={{ borderColor: BORDER, color: TEXT_PRIMARY }}
            data-testid="button-filters-back-bottom"
          >
            {t("common.back") || "Zurück"}
          </button>
          <button
            onClick={handleNext}
            className="flex-1 h-[52px] rounded-[6px] text-[15px] font-bold text-white transition-all active:scale-[0.97]"
            style={{ backgroundColor: BRAND }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = BRAND_HOVER)}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = BRAND)}
            data-testid="button-filters-next"
          >
            {t("common.next") || "Weiter"}
          </button>
        </div>
      </div>
    </div>
  );
}
