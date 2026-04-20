import { useState, useEffect, useRef } from "react";
import { useLocation, Redirect } from "wouter";
import { useHashSearch } from "@/lib/hash-search";
import { useTranslation } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import {
  Check, Bath, Sun, Trees, Leaf, Info, ChevronLeft, X, Loader2,
} from "lucide-react";
import { OB, OBW, useWebsiteMode, appendWebsiteParams } from "@/components/onboarding-ui";
import { OnboardingFlowLayout } from "@/components/onboarding-flow-layout";
import { createSearchProfile, type InsertSearchProfileInput } from "@/lib/search-profiles";
import { queryClient } from "@/lib/queryClient";
import {
  matchEstimateQueryKey,
  fetchMatchEstimate,
  type MatchEstimateResult,
  type NormalizedFilters,
} from "@/lib/match-estimate";

type OBTheme = typeof OB | typeof OBW;

function WebToggle({
  checked,
  onChange,
  label,
  testId,
  noBorder,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  testId: string;
  noBorder?: boolean;
}) {
  return (
    <label
      className="flex items-center gap-3 cursor-pointer h-[52px] px-4 rounded-[10px]"
      style={noBorder ? {} : { border: "1px solid rgb(var(--ha-card-border))" }}
      data-testid={testId}
    >
      <div
        className="w-[44px] h-[26px] rounded-full p-[3px] transition-colors shrink-0 flex items-center"
        style={{ backgroundColor: checked ? "rgb(var(--ha-text))" : "rgb(var(--ha-card-border))" }}
        onClick={(e) => { e.preventDefault(); onChange(!checked); }}
      >
        <div
          className="w-[20px] h-[20px] rounded-full bg-white transition-all"
          style={{
            transform: checked ? "translateX(18px)" : "translateX(0)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
          }}
        />
      </div>
      <span className="text-[14px] leading-snug flex-1" style={{ color: OBW.text }}>{label}</span>
    </label>
  );
}

function WebSelect({
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
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full ha-select-web"
      style={{ borderColor: "rgb(var(--ha-border-input))", color: "rgb(var(--ha-text))", backgroundColor: "rgb(var(--ha-card))" }}
      data-testid={testId}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
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
              backgroundColor: active ? "rgb(var(--ha-primary))" : "rgb(var(--ha-surface))",
              borderColor: "rgb(var(--ha-card-border))",
              color: active ? "white" : "rgb(var(--ha-text-secondary))",
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
                ? "bg-ha-text text-white font-semibold border-ha-text"
                : "bg-ha-surface text-ha-text font-medium border-transparent"
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
        style={{ backgroundColor: checked ? OB.pink : "rgb(var(--ha-card-border))" }}
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
  extraClass,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  formatLabel: (v: number) => string;
  testId: string;
  theme?: OBTheme;
  extraClass?: string;
}) {
  const t = theme || OB;
  const trackInactive = "rgb(var(--ha-card-border))";
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
        className={`w-full${extraClass ? ` ${extraClass}` : ""}`}
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
  extraClass,
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
  extraClass?: string;
}) {
  const t = theme || OB;
  const trackInactive = "rgb(var(--ha-card-border))";
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
          className={`w-full absolute inset-0 dual-range-thumb${extraClass ? ` ${extraClass}` : ""}`}
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
          className={`w-full absolute inset-0 dual-range-thumb${extraClass ? ` ${extraClass}` : ""}`}
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
  { value: "garden", labelKey: "amenities.garden", fallback: "Garten", icon: Trees },
  { value: "rooftop", labelKey: "amenities.rooftop", fallback: "Dachterrasse", icon: Sun },
  { value: "energy_c", labelKey: "amenities.energyC", fallback: "Energieklasse C+", icon: Leaf },
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
  const [showPriceInfo, setShowPriceInfo] = useState(false);
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

  const [debouncedF, setDebouncedF] = useState<FilterData>(f);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedF(f), 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [f]);

  const parsedLat = parseFloat(lat);
  const parsedLng = parseFloat(lng);
  const parsedRadius = parseFloat(radiusKm);
  const lMode = locationMode === "radius" ? "radius" : locationMode === "districts" ? "districts" : "city";
  const estimateFilters: NormalizedFilters = {
    city,
    location_mode: lMode as NormalizedFilters["location_mode"],
    latitude: !isNaN(parsedLat) ? parsedLat : undefined,
    longitude: !isNaN(parsedLng) ? parsedLng : undefined,
    radius_km: !isNaN(parsedRadius) && parsedRadius > 0 ? parsedRadius : undefined,
    districts: districts ? districts.split(",").filter(Boolean) : undefined,
    price_min: debouncedF.minPrice,
    price_max: debouncedF.maxPrice,
    bedrooms_min: debouncedF.minRooms === "any" ? 0 : parseInt(debouncedF.minRooms, 10),
    size_min: debouncedF.sizeNA ? 0 : debouncedF.minSize,
    furnished: debouncedF.furnished !== "any" ? debouncedF.furnished : undefined,
    property_types: debouncedF.propertyType !== "any" ? [debouncedF.propertyType] : undefined,
    extra_features: debouncedF.amenities.length > 0 ? debouncedF.amenities : undefined,
    send_unclear: debouncedF.sendUnclear,
    price_flexible: debouncedF.priceFlexible,
    include_rooms: debouncedF.includeRooms,
  };

  const { data: estimate, isFetching: estimateFetching } = useQuery<MatchEstimateResult>({
    queryKey: matchEstimateQueryKey(estimateFilters),
    queryFn: () => fetchMatchEstimate(estimateFilters),
    enabled: !!city,
    staleTime: 2 * 60 * 1000,
  });

  if (!city) return <Redirect to="/" />;

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
      const backParams = new URLSearchParams({ city, lat, lng, locationMode });
      if (districts) backParams.set("districts", districts);
      if (radiusKm) backParams.set("radiusKm", radiusKm);
      navigate(appendWebsiteParams(`/onboarding/location?${backParams.toString()}`, searchString));
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
    { value: "house", label: t("onboarding.filters.house") },
  ];

  const FURNISHED_OPTIONS = [
    { value: "any", label: t("onboarding.filters.furnishedAny") },
    { value: "furnished", label: t("onboarding.filters.furnishedYes") },
    { value: "unfurnished", label: t("onboarding.filters.furnishedNo") },
  ];

  const sLabel = w ? "text-[15px] font-semibold mb-3 block" : "text-[13px] font-semibold mb-3 block";

  const darkFilterSections = (
    <div className="flex flex-col gap-6">
      <section>
        <label className={sLabel} style={{ color: T.text }}>
          {t("onboarding.filters.rentLabel")}
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
            label={t("onboarding.filters.priceFlexible")}
            testId="toggle-price-flexible"
            theme={T}
          />
        </div>
      </section>

      <div className="h-px" style={{ backgroundColor: T.divider }} />

      <section>
        <label className={sLabel} style={{ color: T.text }}>
          {t("onboarding.filters.propertyTypeLabel")}
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
            label={t("onboarding.filters.includeRooms")}
            testId="toggle-include-rooms"
            theme={T}
          />
        </div>
      </section>

      <div className="h-px" style={{ backgroundColor: T.divider }} />

      <section>
        <label className={sLabel} style={{ color: T.text }}>
          {t("onboarding.filters.bedroomsLabel")}
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
                  backgroundColor: active ? "rgb(var(--ha-primary))" : "rgb(var(--ha-surface))",
                  color: active ? "white" : T.textSecondary,
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
            {t("onboarding.filters.minSizeLabel")}
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
          {t("onboarding.filters.furnishedLabel")}
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
          {t("onboarding.filters.amenitiesLabel")}
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
                  color: active ? "white" : T.textSecondary,
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
          label={t("onboarding.filters.sendUnclear")}
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
        style={{ background: "rgb(var(--ha-card))" }}
        data-testid="screen-onboarding-filters"
      >
        {/* Header: badge | centered title | close — matches 2/4 exactly */}
        <header
          className="sticky top-0 z-20 w-full"
          style={{ backgroundColor: "rgb(var(--ha-card))", borderBottom: `1px solid ${OBW.headerBorder}` }}
        >
          <div className="relative max-w-[480px] mx-auto px-4 h-[56px] flex items-center justify-between">
            <span
              className="text-[14px] font-bold rounded-[10px] shrink-0 flex items-center px-3.5"
              style={{ height: "32px", backgroundColor: "rgb(var(--ha-primary))", color: "white" }}
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
              style={{ backgroundColor: "rgb(var(--ha-surface))", color: "rgb(var(--ha-text-muted))" }}
              data-testid="button-filters-close"
            >
              <X className="w-[22px] h-[22px]" />
            </button>
          </div>
        </header>

        <main className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-5 pt-5 pb-[140px] overflow-y-auto">
          <div className="flex flex-col gap-5">

            {/* Huurprijs */}
            <section>
              <div className="flex items-center gap-1.5 mb-3">
                <span className="text-[15px] font-semibold" style={{ color: OBW.text }}>
                  {t("onboarding.filters.rentLabel")}
                </span>
                <div className="relative">
                  <button
                    onClick={() => setShowPriceInfo((v) => !v)}
                    className="flex items-center justify-center w-[18px] h-[18px] transition-opacity hover:opacity-70"
                    style={{ color: OBW.textMuted }}
                    data-testid="button-price-info"
                  >
                    <Info className="w-[14px] h-[14px]" />
                  </button>
                  {showPriceInfo && (
                    <div
                      className="absolute left-0 top-[22px] z-20 w-[210px] rounded-[10px] px-3 py-2.5"
                      style={{
                        backgroundColor: "rgb(var(--ha-card))",
                        border: `1px solid ${OBW.cardBorder}`,
                        boxShadow: "0 4px 14px rgba(0,0,0,0.09)",
                      }}
                      data-testid="tooltip-price-info"
                    >
                      <p className="text-[12px] leading-relaxed" style={{ color: OBW.textSecondary }}>
                        {t("onboarding.filters.priceTooltip")}
                      </p>
                    </div>
                  )}
                </div>
              </div>
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
                  label={t("onboarding.filters.priceFlexible")}
                  testId="toggle-price-flexible"
                />
              </div>
            </section>

            <div className="h-px bg-ha-divider" />

            {/* Soort woning */}
            <section>
              <label className="text-[15px] font-semibold mb-3 block" style={{ color: OBW.text }}>
                {t("onboarding.filters.propertyTypeLabel")}
              </label>
              <div
                className="flex items-center gap-[4px] p-[4px] rounded-full"
                style={{ backgroundColor: "rgb(var(--ha-toggle-bg))" }}
                data-testid="property-type"
              >
                {PROPERTY_OPTIONS.map((opt) => {
                  const isActive = f.propertyType === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => update({ propertyType: opt.value })}
                      className="flex-1 py-[8px] text-[12px] font-semibold rounded-full text-center transition-all whitespace-nowrap overflow-hidden"
                      style={{
                        backgroundColor: isActive ? "rgb(var(--ha-primary))" : "transparent",
                        color: isActive ? "white" : "rgb(var(--ha-text))",
                      }}
                      data-testid={`property-type-${opt.value}`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3">
                <WebToggle
                  checked={f.includeRooms}
                  onChange={(v) => update({ includeRooms: v })}
                  label={t("onboarding.filters.includeRooms")}
                  testId="toggle-include-rooms"
                />
              </div>
            </section>

            <div className="h-px bg-ha-divider" />

            {/* Slaapkamers */}
            <section>
              <label className="text-[15px] font-semibold mb-3 block" style={{ color: OBW.text }}>
                {t("onboarding.filters.bedroomsLabel")}
              </label>
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar" data-testid="rooms-selector">
                {ROOM_OPTIONS.map((opt) => {
                  const active = f.minRooms === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => update({ minRooms: opt.value })}
                      className="py-[8px] px-4 text-[12px] font-semibold rounded-full whitespace-nowrap shrink-0 transition-all active:scale-[0.96]"
                      style={{
                        backgroundColor: active ? "rgb(var(--ha-primary))" : "rgb(var(--ha-toggle-bg))",
                        color: active ? "white" : "rgb(var(--ha-text))",
                      }}
                      data-testid={`rooms-${opt.value}`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </section>

            <div className="h-px bg-ha-divider" />

            {/* Minimale oppervlakte */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <label className="text-[15px] font-semibold" style={{ color: OBW.text }}>
                  {t("onboarding.filters.minSizeLabel")}
                </label>
                <button
                  onClick={() => update({ sizeNA: !f.sizeNA, minSize: f.sizeNA ? 30 : 0 })}
                  className="text-[12px] font-semibold px-3 py-[5px] rounded-full border transition-all"
                  style={{
                    borderColor: "rgb(var(--ha-card-border))",
                    backgroundColor: f.sizeNA ? "rgba(217,26,104,0.06)" : "transparent",
                    color: f.sizeNA ? "rgb(var(--ha-primary))" : OBW.textSecondary,
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

            <div className="h-px bg-ha-divider" />

            {/* Gemeubileerd */}
            <section>
              <label className="text-[15px] font-semibold mb-3 block" style={{ color: OBW.text }}>
                {t("onboarding.filters.furnishedLabel")}
              </label>
              <div
                className="flex items-center gap-[4px] p-[4px] rounded-full"
                style={{ backgroundColor: "rgb(var(--ha-toggle-bg))" }}
                data-testid="furnished-selector"
              >
                {FURNISHED_OPTIONS.map((opt) => {
                  const isActive = f.furnished === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => update({ furnished: opt.value })}
                      className="flex-1 py-[8px] text-[12px] font-semibold rounded-full text-center transition-all whitespace-nowrap overflow-hidden"
                      style={{
                        backgroundColor: isActive ? "rgb(var(--ha-primary))" : "transparent",
                        color: isActive ? "white" : "rgb(var(--ha-text))",
                      }}
                      data-testid={`furnished-selector-${opt.value}`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </section>

            <div className="h-px bg-ha-divider" />

            {/* Overige wensen — pill chips */}
            <section>
              <label className="text-[15px] font-semibold mb-3 block" style={{ color: OBW.text }}>
                {t("onboarding.filters.amenitiesLabel")}
              </label>
              <div className="flex flex-wrap gap-2" data-testid="amenity-chips">
                {AMENITY_OPTIONS.map(({ value, labelKey, fallback, icon: Icon }) => {
                  const active = f.amenities.includes(value);
                  return (
                    <button
                      key={value}
                      onClick={() => toggleAmenity(value)}
                      className="flex items-center gap-1.5 h-[36px] px-3.5 rounded-full text-[13px] font-medium border transition-all active:scale-[0.96]"
                      style={{
                        backgroundColor: active ? "rgb(var(--ha-primary))" : "transparent",
                        borderColor: active ? "rgb(var(--ha-primary))" : OBW.chipBorder,
                        color: active ? "white" : OBW.textSecondary,
                      }}
                      data-testid={`amenity-${value}`}
                    >
                      {active ? (
                        <Check className="w-3 h-3 shrink-0" />
                      ) : (
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span>{t(labelKey) || fallback}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <div className="h-px bg-ha-divider" />

            {/* sendUnclear toggle */}
            <section>
              <WebToggle
                checked={f.sendUnclear}
                onChange={(v) => update({ sendUnclear: v })}
                label={t("onboarding.filters.sendUnclear")}
                testId="toggle-send-unclear"
              />
            </section>

          </div>
        </main>

        {/* Footer: matches 2/4 exactly */}
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
                {estimateFetching ? (
                  <span style={{ color: OBW.textMuted }}>…</span>
                ) : estimate?.matchesLast7Days != null ? (
                  <>
                    {Math.max(1, estimate.matchesLast7Days)} {t("onboardingUI.perWeek")}
                    {Math.max(1, estimate.matchesLast7Days) > 10 ? " 🔥" : ""}
                  </>
                ) : (
                  <>— {t("onboardingUI.perWeek")}</>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={handleBack}
                className="w-[44px] h-[44px] rounded-[6px] flex items-center justify-center active:scale-95 transition-transform"
                style={{ border: `1.5px solid ${OBW.backBtnBorder}`, backgroundColor: OBW.backBtnBg }}
                data-testid="button-filters-back"
              >
                <ChevronLeft className="w-[18px] h-[18px]" style={{ color: OBW.backBtnColor }} />
              </button>
              <button
                onClick={handleNext}
                disabled={saving}
                className="h-[44px] px-6 rounded-[8px] text-[15px] font-semibold text-white flex items-center justify-center gap-1.5 active:scale-[0.97] transition-transform disabled:opacity-40"
                style={{ background: OBW.pink, boxShadow: "0 4px 14px rgba(217,26,104,0.2)" }}
                data-testid="button-filters-next"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSearchOnlyMode ? t("common.save") : t("common.next")}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <OnboardingFlowLayout
      flowTitle={t("onboarding.filters.headerTitle")}
      currentStep={3}
      totalSteps={3}
      stepTitle={t("onboarding.filters.title")}
      stepDescription={t("onboarding.filters.subtitle")}
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
