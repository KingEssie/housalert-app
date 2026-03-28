import { useState } from "react";
import { useLocation } from "wouter";
import { useHashSearch } from "@/lib/hash-search";
import { useTranslation } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { HousAlertLogo } from "@/components/housalert-logo";
import {
  ChevronLeft, Check, Bath, Sun, Trees, Leaf, Sparkles, Loader2,
} from "lucide-react";
import { OB, OBProgressDots, OBStickyBar } from "@/components/onboarding-ui";
import { createSearchProfile, type InsertSearchProfileInput } from "@/lib/search-profiles";
import { queryClient } from "@/lib/queryClient";

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
      className="flex gap-1 p-1 rounded-[6px] border"
      style={{ backgroundColor: OB.surface, borderColor: OB.cardBorder }}
      data-testid={testId}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="flex-1 h-[40px] rounded-[4px] text-[13px] font-medium transition-all"
          style={{
            backgroundColor: value === opt.value ? OB.pink : "transparent",
            color: value === opt.value ? "#fff" : OB.textSecondary,
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
        style={{ backgroundColor: checked ? OB.pink : "rgba(255,255,255,0.15)" }}
        onClick={() => onChange(!checked)}
      >
        <div
          className="w-[20px] h-[20px] rounded-full bg-white transition-transform shadow-sm"
          style={{ transform: checked ? "translateX(20px)" : "translateX(0)" }}
        />
      </div>
      <span className="text-[13px] leading-snug" style={{ color: OB.text }}>{label}</span>
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
          background: `linear-gradient(to right, ${OB.pink} 0%, ${OB.pink} ${pct}%, rgba(255,255,255,0.1) ${pct}%, rgba(255,255,255,0.1) 100%)`,
        }}
      />
      <div className="flex justify-between mt-1">
        <span className="text-[12px]" style={{ color: OB.textMuted }}>{formatLabel(min)}</span>
        <span className="text-[13px] font-semibold" style={{ color: OB.pink }}>{formatLabel(value)}</span>
        <span className="text-[12px]" style={{ color: OB.textMuted }}>{formatLabel(max)}</span>
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
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const searchString = useHashSearch();
  const incomingParams = new URLSearchParams(searchString);
  const isSearchOnlyMode = !!user;

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

  async function saveSearchProfileDirectly() {
    if (!user) return;
    setSaving(true);
    try {
      const input: InsertSearchProfileInput = {
        user_id: user.id,
        city_name: city,
        country_code: "DE",
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        place_id: city.toLowerCase().replace(/\s+/g, "_") + "_de",
        price_min: f.minPrice,
        price_max: f.maxPrice,
        bedrooms_min: f.minRooms === "any" ? 0 : parseInt(f.minRooms, 10),
        size_min: f.sizeNA ? 0 : f.minSize,
        location_mode: locationMode as any,
        furnished: f.furnished !== "any" ? f.furnished : undefined,
      };
      if (districts) input.districts = districts.split(",");
      if (radiusKm) input.radius_km = parseFloat(radiusKm);
      if (f.propertyType !== "any") input.property_types = [f.propertyType];
      if (f.amenities.length > 0) input.extra_features = f.amenities;

      await createSearchProfile(input);
      queryClient.invalidateQueries({ queryKey: ["/api/search-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activation-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile-strength"] });
      toast({ title: t("newSearch.saved") || "Zoekopdracht opgeslagen!" });
      navigate("/home");
    } catch (err: any) {
      toast({
        title: t("common.error") || "Fout",
        description: err.message || "Er ging iets mis",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  function handleNext() {
    if (isSearchOnlyMode) {
      saveSearchProfileDirectly();
      return;
    }

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
    <div className="min-h-[100dvh] flex flex-col ob-dark" style={{ background: OB.gradient }} data-testid="screen-onboarding-filters">
      <header className="sticky top-0 z-20 backdrop-blur-md border-b" style={{ backgroundColor: OB.headerBg, borderColor: OB.headerBorder }}>
        <div className="max-w-[480px] mx-auto px-5 h-[56px] flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-transform"
            style={{ backgroundColor: OB.backBtnBg }}
            data-testid="button-filters-back"
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
        <OBProgressDots current={2} total={4} />
      </div>

      <main className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-5 pt-4 pb-[100px] overflow-y-auto">
        <h1
          className="text-[24px] font-bold tracking-[-0.02em] mb-2"
          style={{ color: OB.text }}
          data-testid="text-filters-title"
        >
          {t("onboarding.filters.title") || "Was suchst du genau?"}
        </h1>
        <p className="text-[14px] mb-6" style={{ color: OB.textSecondary }}>
          {t("onboarding.filters.subtitle") || "Grenze deine Suche ein."}
        </p>

        <div className="flex flex-col gap-7">
          <section>
            <label className="text-[13px] font-semibold mb-3 block" style={{ color: OB.text }}>
              {t("onboarding.filters.rentLabel") || "Mietpreis"}
            </label>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1">
                <label className="text-[11px] mb-1 block" style={{ color: OB.textMuted }}>Min</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={f.minPrice || ""}
                  onChange={(e) => update({ minPrice: Number(e.target.value) || 0 })}
                  placeholder="0"
                  className="ob-input w-full h-[48px] px-3 rounded-[6px] text-[14px] font-medium"
                  data-testid="input-min-price"
                />
              </div>
              <span style={{ color: OB.textMuted }} className="mt-5">—</span>
              <div className="flex-1">
                <label className="text-[11px] mb-1 block" style={{ color: OB.textMuted }}>Max</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={f.maxPrice || ""}
                  onChange={(e) => update({ maxPrice: Number(e.target.value) || 0 })}
                  placeholder="1500"
                  className="ob-input w-full h-[48px] px-3 rounded-[6px] text-[14px] font-medium"
                  data-testid="input-max-price"
                />
              </div>
              <span className="text-[13px] font-medium mt-5" style={{ color: OB.textMuted }}>€</span>
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

          <div className="h-px" style={{ backgroundColor: OB.divider }} />

          <section>
            <label className="text-[13px] font-semibold mb-3 block" style={{ color: OB.text }}>
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

          <div className="h-px" style={{ backgroundColor: OB.divider }} />

          <section>
            <label className="text-[13px] font-semibold mb-3 block" style={{ color: OB.text }}>
              {t("onboarding.filters.bedroomsLabel") || "Schlafzimmer"}
            </label>
            <div
              className="flex gap-1 p-1 rounded-[6px] border"
              style={{ backgroundColor: OB.surface, borderColor: OB.cardBorder }}
              data-testid="rooms-selector"
            >
              {ROOM_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => update({ minRooms: opt.value })}
                  className="flex-1 h-[40px] rounded-[4px] text-[13px] font-medium transition-all"
                  style={{
                    backgroundColor: f.minRooms === opt.value ? OB.pink : "transparent",
                    color: f.minRooms === opt.value ? "#fff" : OB.textSecondary,
                  }}
                  data-testid={`rooms-${opt.value}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </section>

          <div className="h-px" style={{ backgroundColor: OB.divider }} />

          <section>
            <div className="flex items-center justify-between mb-3">
              <label className="text-[13px] font-semibold" style={{ color: OB.text }}>
                {t("onboarding.filters.minSizeLabel") || "Mindestfläche"}
              </label>
              <button
                onClick={() => update({ sizeNA: !f.sizeNA, minSize: f.sizeNA ? 30 : 0 })}
                className="text-[12px] font-medium px-2.5 py-1 rounded-[6px] border transition-all"
                style={{
                  borderColor: f.sizeNA ? OB.selectedBorder : OB.cardBorder,
                  backgroundColor: f.sizeNA ? OB.selectedBg : "transparent",
                  color: f.sizeNA ? OB.pink : OB.textSecondary,
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

          <div className="h-px" style={{ backgroundColor: OB.divider }} />

          <section>
            <label className="text-[13px] font-semibold mb-3 block" style={{ color: OB.text }}>
              {t("onboarding.filters.furnishedLabel") || "Möbliert"}
            </label>
            <SegmentedControl
              options={FURNISHED_OPTIONS}
              value={f.furnished}
              onChange={(v) => update({ furnished: v })}
              testId="furnished-selector"
            />
          </section>

          <div className="h-px" style={{ backgroundColor: OB.divider }} />

          <section>
            <label className="text-[13px] font-semibold mb-3 block" style={{ color: OB.text }}>
              {t("onboarding.filters.amenitiesLabel") || "Weitere Wünsche"}
            </label>
            <div className="flex flex-wrap gap-2" data-testid="amenity-chips">
              {AMENITY_OPTIONS.map(({ value, labelKey, fallback, icon: Icon }) => {
                const active = f.amenities.includes(value);
                return (
                  <button
                    key={value}
                    onClick={() => toggleAmenity(value)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-[6px] text-[13px] font-medium border transition-all"
                    style={{
                      backgroundColor: active ? OB.pink : "transparent",
                      borderColor: active ? OB.pink : OB.cardBorder,
                      color: active ? "#fff" : OB.textSecondary,
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

          <div className="h-px" style={{ backgroundColor: OB.divider }} />

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

      <OBStickyBar>
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="h-[56px] px-6 rounded-[6px] text-[15px] font-medium transition-all active:scale-[0.97] border"
            style={{ borderColor: "rgba(255,255,255,0.15)", color: OB.textSecondary }}
            data-testid="button-filters-back-bottom"
          >
            {t("common.back") || "Zurück"}
          </button>
          <button
            onClick={handleNext}
            disabled={saving}
            className="flex-1 h-[56px] rounded-[6px] text-[15px] font-bold text-white transition-all active:scale-[0.97] disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background: OB.pinkGradient, boxShadow: OB.pinkShadow }}
            data-testid="button-filters-next"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSearchOnlyMode
              ? (t("newSearch.save") || "Opslaan")
              : (t("common.next") || "Weiter")}
          </button>
        </div>
      </OBStickyBar>
    </div>
  );
}
