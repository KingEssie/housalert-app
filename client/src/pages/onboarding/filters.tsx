import { useState } from "react";
import { useLocation } from "wouter";
import { useHashSearch } from "@/lib/hash-search";
import { useTranslation } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import {
  Check, Bath, Sun, Trees, Leaf,
} from "lucide-react";
import { OB, OBW, OBWebHeader, OBWebFooter, useWebsiteMode, appendWebsiteParams } from "@/components/onboarding-ui";
import { OnboardingFlowLayout } from "@/components/onboarding-flow-layout";
import { createSearchProfile, type InsertSearchProfileInput } from "@/lib/search-profiles";
import { queryClient } from "@/lib/queryClient";

type OBTheme = typeof OB | typeof OBW;

function WebToggle({
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
    <label
      className="flex items-start gap-3 cursor-pointer rounded-[8px] p-3 transition-colors"
      style={{
        backgroundColor: checked ? "rgba(217,26,104,0.04)" : "transparent",
        border: `1px solid ${checked ? "rgba(217,26,104,0.2)" : OBW.divider}`,
      }}
      data-testid={testId}
    >
      <div
        className="w-[38px] h-[22px] rounded-full p-[2px] transition-colors shrink-0 mt-[1px]"
        style={{ backgroundColor: checked ? "#111111" : "#E5E7EB" }}
        onClick={(e) => { e.preventDefault(); onChange(!checked); }}
      >
        <div
          className="w-[18px] h-[18px] rounded-full bg-white transition-transform"
          style={{
            transform: checked ? "translateX(16px)" : "translateX(0)",
            boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
          }}
        />
      </div>
      <span className="text-[13px] leading-snug" style={{ color: OBW.text }}>{label}</span>
    </label>
  );
}

function WebPillGroup({
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
    <div className="flex flex-wrap gap-2" data-testid={testId}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="h-[40px] px-5 rounded-full text-[14px] font-medium border transition-all active:scale-[0.96]"
            style={{
              backgroundColor: active ? "rgb(var(--ha-primary))" : "#F9FAFB",
              borderColor: active ? "rgb(var(--ha-primary))" : "#E5E7EB",
              color: active ? "#fff" : "#334855",
            }}
            data-testid={`${testId}-${opt.value}`}
          >
            {opt.label}
          </button>
        );
      })}
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
  theme?: OBTheme;
}) {
  return (
    <div
      className="flex items-center gap-2"
      data-testid={testId}
    >
      {options.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-3.5 py-[6px] text-[13px] rounded-full border transition-all duration-200 active:scale-[0.96] ${
              isActive
                ? "bg-[#111111] text-white font-semibold border-[#111111]"
                : "bg-[#F3F4F6] text-[#111111] font-medium border-transparent"
            }`}
            data-testid={`${testId}-${opt.value}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  testId,
  theme,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  testId: string;
  theme?: OBTheme;
}) {
  const t = theme || OB;
  return (
    <label className="flex items-center gap-3 cursor-pointer" data-testid={testId}>
      <div
        className="w-[44px] h-[24px] rounded-full p-[2px] transition-colors shrink-0"
        style={{ backgroundColor: checked ? OB.pink : "#E5E7EB" }}
        onClick={() => onChange(!checked)}
      >
        <div
          className="w-[20px] h-[20px] rounded-full bg-white transition-transform shadow-sm"
          style={{ transform: checked ? "translateX(20px)" : "translateX(0)" }}
        />
      </div>
      <span className="text-[13px] leading-snug" style={{ color: t.text }}>{label}</span>
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
  theme,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  formatLabel: (v: number) => string;
  testId: string;
  theme?: OBTheme;
}) {
  const t = theme || OB;
  const trackInactive = "#E5E7EB";
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
          background: `linear-gradient(to right, ${OB.pink} 0%, ${OB.pink} ${pct}%, ${trackInactive} ${pct}%, ${trackInactive} 100%)`,
        }}
      />
      <div className="flex justify-between mt-1">
        <span className="text-[12px]" style={{ color: t.textSecondary }}>{formatLabel(min)}</span>
        <span className="text-[13px] font-semibold" style={{ color: OB.pink }}>{formatLabel(value)}</span>
        <span className="text-[12px]" style={{ color: t.textSecondary }}>{formatLabel(max)}</span>
      </div>
    </div>
  );
}

function DualRangeSlider({
  min,
  max,
  step,
  valueLow,
  valueHigh,
  onChangeLow,
  onChangeHigh,
  formatLabel,
  testId,
  theme,
}: {
  min: number;
  max: number;
  step: number;
  valueLow: number;
  valueHigh: number;
  onChangeLow: (v: number) => void;
  onChangeHigh: (v: number) => void;
  formatLabel: (v: number) => string;
  testId: string;
  theme?: OBTheme;
}) {
  const t = theme || OB;
  const trackInactive = "#E5E7EB";
  const pctLow = ((valueLow - min) / (max - min)) * 100;
  const pctHigh = ((valueHigh - min) / (max - min)) * 100;
  const trackBg = `linear-gradient(to right, ${trackInactive} 0%, ${trackInactive} ${pctLow}%, ${OB.pink} ${pctLow}%, ${OB.pink} ${pctHigh}%, ${trackInactive} ${pctHigh}%, ${trackInactive} 100%)`;

  return (
    <div data-testid={testId}>
      <div className="flex justify-between mb-2">
        <span className="text-[14px] font-semibold" style={{ color: t.text }}>{formatLabel(valueLow)}</span>
        <span className="text-[14px] font-semibold" style={{ color: t.text }}>{formatLabel(valueHigh)}</span>
      </div>
      <div className="relative h-[36px]">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={valueLow}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (v <= valueHigh) onChangeLow(v);
          }}
          className="w-full absolute inset-0 dual-range-thumb"
          style={{ background: trackBg, zIndex: valueLow > max - step ? 3 : 1 }}
          data-testid="slider-min-price"
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={valueHigh}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (v >= valueLow) onChangeHigh(v);
          }}
          className="w-full absolute inset-0 dual-range-thumb"
          style={{ background: "transparent", zIndex: 2 }}
          data-testid="slider-max-price"
        />
      </div>
    </div>
  );
}

const AMENITY_OPTIONS = [
  { value: "bath", labelKey: "amenities.bath", fallback: "Bad", icon: Bath },
  { value: "balcony", labelKey: "amenities.balcony", fallback: "Balkon", icon: Sun },
  { value: "garden", labelKey: "amenities.garden", fallback: "Tuin", icon: Trees },
  { value: "rooftop", labelKey: "amenities.rooftop", fallback: "Dakterras", icon: Sun },
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
  const w = useWebsiteMode();
  const T = w ? OBW : OB;
  const incomingParams = new URLSearchParams(searchString);
  const isSearchOnlyMode = w ? false : !!user;

  const city = incomingParams.get("city") || "";
  const lat = incomingParams.get("lat") || "";
  const lng = incomingParams.get("lng") || "";
  const locationMode = incomingParams.get("locationMode") || "";
  const districts = incomingParams.get("districts") || "";
  const radiusKm = incomingParams.get("radiusKm") || "";

  const [f, setF] = useState<FilterData>(() => {
    if (incomingParams.has("maxPrice")) {
      const rawMinSize = incomingParams.get("minSize");
      const minSizeVal = rawMinSize !== null ? parseInt(rawMinSize) : INITIAL_FILTERS.minSize;
      const rawMinRooms = incomingParams.get("minRooms");
      return {
        minPrice: parseInt(incomingParams.get("minPrice") || "") || 0,
        maxPrice: parseInt(incomingParams.get("maxPrice") || "") || INITIAL_FILTERS.maxPrice,
        priceFlexible: incomingParams.get("priceFlexible") === "true",
        propertyType: incomingParams.get("propertyTypes") || "any",
        includeRooms: incomingParams.get("includeRooms") === "true",
        minRooms: (!rawMinRooms || rawMinRooms === "0") ? "any" : rawMinRooms,
        minSize: minSizeVal || 0,
        sizeNA: minSizeVal === 0,
        furnished: incomingParams.get("furnished") || "any",
        amenities: incomingParams.get("amenities")?.split(",").filter(Boolean) || [],
        sendUnclear: incomingParams.get("sendUnclear") !== "false",
      };
    }
    return INITIAL_FILTERS;
  });

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
      input.send_unclear = f.sendUnclear;
      input.price_flexible = f.priceFlexible;

      await createSearchProfile(input);
      queryClient.invalidateQueries({ queryKey: ["/api/search-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activation-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile-strength"] });
      toast({ title: t("newSearch.toasts.created") });
      navigate("/home");
    } catch (err: any) {
      toast({
        title: t("common.error"),
        description: err.message || t("newSearch.toasts.saveFailedDesc"),
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
    outParams.set("sendUnclear", String(f.sendUnclear));

    if (w) {
      navigate(appendWebsiteParams(`/onboarding/preferences?${outParams.toString()}`, searchString));
    } else {
      navigate(appendWebsiteParams(`/onboarding/name?${outParams.toString()}`, searchString));
    }
  }

  function handleBack() {
    if (w) {
      const backParams = new URLSearchParams({ city, lat, lng });
      if (radiusKm) backParams.set("radiusKm", radiusKm);
      navigate(appendWebsiteParams(`/onboarding/city?${backParams.toString()}`, searchString));
    } else {
      const backParams = new URLSearchParams({ city, lat, lng, locationMode });
      if (districts) backParams.set("districts", districts);
      if (radiusKm) backParams.set("radiusKm", radiusKm);
      navigate(appendWebsiteParams(`/onboarding/location?${backParams.toString()}`, searchString));
    }
  }

  function handleClose() {
    navigate("/");
  }

  const ROOM_OPTIONS = [
    { value: "any", label: t("onboarding.filters.doesntMatter") },
    { value: "1", label: "1+" },
    { value: "2", label: "2+" },
    { value: "3", label: "3+" },
    { value: "4", label: "4+" },
    { value: "5", label: "5+" },
  ];

  const PROPERTY_OPTIONS = [
    { value: "any", label: t("onboarding.filters.doesntMatter") },
    { value: "apartment", label: t("onboarding.propertyType.apartment") },
    { value: "house", label: t("newSearch.filters.house") },
  ];

  const FURNISHED_OPTIONS = [
    { value: "any", label: t("newSearch.filters.furnishedAny") },
    { value: "furnished", label: t("newSearch.filters.furnishedYes") },
    { value: "unfurnished", label: t("newSearch.filters.furnishedNo") },
  ];

  const sLabel = w ? "text-[15px] font-semibold mb-3 block" : "text-[13px] font-semibold mb-3 block";

  const darkFilterSections = (
    <div className="flex flex-col gap-6">
      <section>
        <label className={sLabel} style={{ color: T.text }}>
          {t("newSearch.filters.rentLabel")}
        </label>
        <DualRangeSlider
          min={0}
          max={3000}
          step={50}
          valueLow={f.minPrice}
          valueHigh={f.maxPrice}
          onChangeLow={(v) => update({ minPrice: v })}
          onChangeHigh={(v) => update({ maxPrice: v })}
          formatLabel={(v) => `€${v}`}
          testId="slider-rent-price"
          theme={T}
        />
        <div className="mt-3">
          <Toggle
            checked={f.priceFlexible}
            onChange={(v) => update({ priceFlexible: v })}
            label={t("newSearch.filters.priceFlexible")}
            testId="toggle-price-flexible"
            theme={T}
          />
        </div>
      </section>

      <div className="h-px" style={{ backgroundColor: T.divider }} />

      <section>
        <label className={sLabel} style={{ color: T.text }}>
          {t("newSearch.filters.propertyTypeLabel")}
        </label>
        <SegmentedControl
          options={PROPERTY_OPTIONS}
          value={f.propertyType}
          onChange={(v) => update({ propertyType: v })}
          testId="property-type"
          theme={T}
        />
        <div className="mt-3">
          <Toggle
            checked={f.includeRooms}
            onChange={(v) => update({ includeRooms: v })}
            label={t("newSearch.filters.includeRooms")}
            testId="toggle-include-rooms"
            theme={T}
          />
        </div>
      </section>

      <div className="h-px" style={{ backgroundColor: T.divider }} />

      <section>
        <label className={sLabel} style={{ color: T.text }}>
          {t("onboarding.filters.bedrooms")}
        </label>
        <div
          className="flex gap-2 overflow-x-auto no-scrollbar"
          data-testid="rooms-selector"
        >
          {ROOM_OPTIONS.map((opt) => {
            const active = f.minRooms === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => update({ minRooms: opt.value })}
                className="h-[40px] px-4 rounded-full text-[13px] font-semibold whitespace-nowrap transition-all active:scale-[0.96] shrink-0"
                style={{
                  backgroundColor: active ? "rgb(var(--ha-primary))" : "#F3F4F6",
                  color: active ? "#fff" : T.textSecondary,
                }}
                data-testid={`rooms-${opt.value}`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </section>

      <div className="h-px" style={{ backgroundColor: T.divider }} />

      <section>
        <div className="flex items-center justify-between mb-3">
          <label className="text-[13px] font-semibold" style={{ color: T.text }}>
            {t("newSearch.filters.minSizeLabel")}
          </label>
          <button
            onClick={() => update({ sizeNA: !f.sizeNA, minSize: f.sizeNA ? 30 : 0 })}
            className="text-[12px] font-medium px-2.5 py-1 rounded-full border transition-all"
            style={{
              borderColor: f.sizeNA ? T.selectedBorder : T.cardBorder,
              backgroundColor: f.sizeNA ? T.selectedBg : "transparent",
              color: f.sizeNA ? OB.pink : T.textSecondary,
            }}
            data-testid="button-size-na"
          >
            {t("common.na")}
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
            theme={T}
          />
        )}
      </section>

      <div className="h-px" style={{ backgroundColor: T.divider }} />

      <section>
        <label className={sLabel} style={{ color: T.text }}>
          {t("newSearch.filters.furnishedLabel")}
        </label>
        <SegmentedControl
          options={FURNISHED_OPTIONS}
          value={f.furnished}
          onChange={(v) => update({ furnished: v })}
          testId="furnished-selector"
          theme={T}
        />
      </section>

      <div className="h-px" style={{ backgroundColor: T.divider }} />

      <section>
        <label className={sLabel} style={{ color: T.text }}>
          {t("newSearch.filters.amenitiesLabel")}
        </label>
        <div className="flex flex-wrap gap-2" data-testid="amenity-chips">
          {AMENITY_OPTIONS.map(({ value, labelKey, fallback, icon: Icon }) => {
            const active = f.amenities.includes(value);
            return (
              <button
                key={value}
                onClick={() => toggleAmenity(value)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-medium border transition-all"
                style={{
                  backgroundColor: active ? OB.pink : "transparent",
                  borderColor: active ? OB.pink : T.cardBorder,
                  color: active ? "#fff" : T.textSecondary,
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

      <div className="h-px" style={{ backgroundColor: T.divider }} />

      <section>
        <Toggle
          checked={f.sendUnclear}
          onChange={(v) => update({ sendUnclear: v })}
          label={t("newSearch.filters.sendUnclear")}
          testId="toggle-send-unclear"
          theme={T}
        />
      </section>
    </div>
  );

  if (w) {
    return (
      <div
        className="min-h-[100dvh] flex flex-col"
        style={{ background: "#ffffff" }}
        data-testid="screen-onboarding-filters"
      >
        <OBWebHeader step={2} onClose={handleClose} />

        <main className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-5 pt-6 pb-[120px] overflow-y-auto">
          <h2
            className="text-[28px] font-semibold tracking-[-0.025em] mb-1"
            style={{ color: OBW.text }}
            data-testid="text-filters-title"
          >
            {t("newSearch.filters.title")}
          </h2>
          <p className="text-[14px] mb-7 leading-relaxed" style={{ color: OBW.textSecondary }}>
            {t("newSearch.filters.subtitle")}
          </p>

          <div className="flex flex-col gap-6">
            <section>
              <label className="text-[15px] font-semibold mb-3 block" style={{ color: OBW.text }}>
                {t("newSearch.filters.rentLabel")}
              </label>
              <DualRangeSlider
                min={0}
                max={3000}
                step={50}
                valueLow={f.minPrice}
                valueHigh={f.maxPrice}
                onChangeLow={(v) => update({ minPrice: v })}
                onChangeHigh={(v) => update({ maxPrice: v })}
                formatLabel={(v) => `€${v}`}
                testId="slider-rent-price"
                theme={OBW}
              />
              <div className="mt-3">
                <WebToggle
                  checked={f.priceFlexible}
                  onChange={(v) => update({ priceFlexible: v })}
                  label={t("newSearch.filters.priceFlexible")}
                  testId="toggle-price-flexible"
                />
              </div>
            </section>

            <div className="h-px bg-[#F0F0F0]" />

            <section>
              <label className="text-[15px] font-semibold mb-3 block" style={{ color: OBW.text }}>
                {t("newSearch.filters.propertyTypeLabel")}
              </label>
              <WebPillGroup
                options={PROPERTY_OPTIONS}
                value={f.propertyType}
                onChange={(v) => update({ propertyType: v })}
                testId="property-type"
              />
              <div className="mt-3">
                <WebToggle
                  checked={f.includeRooms}
                  onChange={(v) => update({ includeRooms: v })}
                  label={t("newSearch.filters.includeRooms")}
                  testId="toggle-include-rooms"
                />
              </div>
            </section>

            <div className="h-px bg-[#F0F0F0]" />

            <section>
              <label className="text-[15px] font-semibold mb-3 block" style={{ color: OBW.text }}>
                {t("onboarding.filters.bedrooms")}
              </label>
              <div
                className="flex gap-2 overflow-x-auto no-scrollbar"
                data-testid="rooms-selector"
              >
                {ROOM_OPTIONS.map((opt) => {
                  const active = f.minRooms === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => update({ minRooms: opt.value })}
                      className="h-[40px] px-4 rounded-full text-[13px] font-semibold whitespace-nowrap transition-all active:scale-[0.96] shrink-0"
                      style={{
                        backgroundColor: active ? "rgb(var(--ha-primary))" : "#F3F4F6",
                        color: active ? "#fff" : OBW.textSecondary,
                      }}
                      data-testid={`rooms-${opt.value}`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </section>

            <div className="h-px bg-[#F0F0F0]" />

            <section>
              <div className="flex items-center justify-between mb-3">
                <label className="text-[15px] font-semibold" style={{ color: OBW.text }}>
                  {t("newSearch.filters.minSizeLabel")}
                </label>
                <button
                  onClick={() => update({ sizeNA: !f.sizeNA, minSize: f.sizeNA ? 30 : 0 })}
                  className="text-[12px] font-medium px-3 py-1 rounded-full border transition-all"
                  style={{
                    borderColor: f.sizeNA ? "rgba(217,26,104,0.3)" : "#E5E7EB",
                    backgroundColor: f.sizeNA ? "rgba(217,26,104,0.06)" : "transparent",
                    color: f.sizeNA ? OB.pink : OBW.textSecondary,
                  }}
                  data-testid="button-size-na"
                >
                  {t("common.na")}
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
                  theme={OBW}
                />
              )}
            </section>

            <div className="h-px bg-[#F0F0F0]" />

            <section>
              <label className="text-[15px] font-semibold mb-3 block" style={{ color: OBW.text }}>
                {t("newSearch.filters.furnishedLabel")}
              </label>
              <WebPillGroup
                options={FURNISHED_OPTIONS}
                value={f.furnished}
                onChange={(v) => update({ furnished: v })}
                testId="furnished-selector"
              />
            </section>

            <div className="h-px bg-[#F0F0F0]" />

            <section>
              <label className="text-[15px] font-semibold mb-3 block" style={{ color: OBW.text }}>
                {t("newSearch.filters.amenitiesLabel")}
              </label>
              <div className="flex flex-wrap gap-2" data-testid="amenity-chips">
                {AMENITY_OPTIONS.map(({ value, labelKey, fallback, icon: Icon }) => {
                  const active = f.amenities.includes(value);
                  return (
                    <button
                      key={value}
                      onClick={() => toggleAmenity(value)}
                      className="flex items-center gap-1.5 h-[40px] px-4 rounded-full text-[13px] font-medium border transition-all active:scale-[0.96]"
                      style={{
                        backgroundColor: active ? OB.pink : "#F9FAFB",
                        borderColor: active ? OB.pink : "#E5E7EB",
                        color: active ? "#fff" : OBW.textSecondary,
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

            <div className="h-px bg-[#F0F0F0]" />

            <section className="flex flex-col gap-3">
              <WebToggle
                checked={f.sendUnclear}
                onChange={(v) => update({ sendUnclear: v })}
                label={t("newSearch.filters.sendUnclear")}
                testId="toggle-send-unclear"
              />
            </section>
          </div>
        </main>

        <OBWebFooter
          onBack={handleBack}
          onNext={handleNext}
          nextLabel={isSearchOnlyMode ? t("common.save") : t("common.next")}
          saving={saving}
          backTestId="button-filters-back"
          nextTestId="button-filters-next"
        />
      </div>
    );
  }

  return (
    <OnboardingFlowLayout
      flowTitle={t("newSearch.filters.headerTitle")}
      currentStep={3}
      totalSteps={3}
      stepTitle={t("newSearch.filters.title")}
      stepDescription={t("newSearch.filters.subtitle")}
      onBack={handleBack}
      onNext={handleNext}
      onClose={handleClose}
      nextLabel={isSearchOnlyMode ? t("common.save") : t("common.next")}
      saving={saving}
      nextDisabled={false}
      backTestId="button-filters-back"
      nextTestId="button-filters-next"
      closeTestId="button-filters-close"
      screenTestId="screen-onboarding-filters"
    >
      {darkFilterSections}
    </OnboardingFlowLayout>
  );
}
