import { useState } from "react";
import { useLocation } from "wouter";
import { useHashSearch } from "@/lib/hash-search";
import { useTranslation } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import {
  Check, Bath, Sun, Trees, Leaf, X,
} from "lucide-react";
import { OB, OBW, ONBOARDING_TOTAL_STEPS, OBFooter, OBWebHeader, OBWebFooter, useWebsiteMode, appendWebsiteParams } from "@/components/onboarding-ui";
import { createSearchProfile, type InsertSearchProfileInput } from "@/lib/search-profiles";
import { queryClient } from "@/lib/queryClient";

type OBTheme = typeof OB | typeof OBW;

function SegmentedControl({
  options,
  value,
  onChange,
  testId,
  theme,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  testId: string;
  theme?: OBTheme;
}) {
  const t = theme || OB;
  const isLight = theme === OBW;
  return (
    <div
      className="flex p-1 rounded-full"
      style={{ backgroundColor: isLight ? OBW.tabBg : "rgba(99,102,241,0.12)" }}
      data-testid={testId}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="flex-1 h-[40px] rounded-full text-[13px] font-semibold transition-all"
          style={{
            backgroundColor: value === opt.value ? (isLight ? OBW.tabActiveBg : "rgba(99,102,241,0.35)") : "transparent",
            color: value === opt.value ? (isLight ? OBW.tabActiveColor : "#fff") : t.textSecondary,
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
  theme,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  testId: string;
  theme?: OBTheme;
}) {
  const t = theme || OB;
  const isLight = theme === OBW;
  return (
    <label className="flex items-center gap-3 cursor-pointer" data-testid={testId}>
      <div
        className="w-[44px] h-[24px] rounded-full p-[2px] transition-colors shrink-0"
        style={{ backgroundColor: checked ? OB.pink : (isLight ? "#d1d5db" : "rgba(255,255,255,0.15)") }}
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
  const isLight = theme === OBW;
  const trackInactive = isLight ? "#d1d5db" : "rgba(255,255,255,0.1)";
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
  const isLight = theme === OBW;
  const trackInactive = isLight ? "#d1d5db" : "rgba(255,255,255,0.1)";
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
  const isSearchOnlyMode = !!user;

  const city = incomingParams.get("city") || "";
  const lat = incomingParams.get("lat") || "0";
  const lng = incomingParams.get("lng") || "0";
  const locationMode = incomingParams.get("locationMode") || "city";
  const districts = incomingParams.get("districts") || "";
  const radiusKm = incomingParams.get("radiusKm") || "";

  const [f, setF] = useState<FilterData>(() => {
    if (incomingParams.has("maxPrice")) {
      const rawMinSize = incomingParams.get("minSize");
      const minSizeVal = rawMinSize !== null ? parseInt(rawMinSize) : INITIAL_FILTERS.minSize;
      const rawMinRooms = incomingParams.get("minRooms");
      return {
        minPrice: parseInt(incomingParams.get("minPrice") || "0") || 0,
        maxPrice: parseInt(incomingParams.get("maxPrice") || "1500") || INITIAL_FILTERS.maxPrice,
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

  const WEB_PRICE_OPTIONS = [
    { value: "500", label: "€500" },
    { value: "750", label: "€750" },
    { value: "1000", label: "€1.000" },
    { value: "1250", label: "€1.250" },
    { value: "1500", label: "€1.500" },
    { value: "1750", label: "€1.750" },
    { value: "2000", label: "€2.000" },
    { value: "2500", label: "€2.500" },
    { value: "3000", label: "€3.000" },
  ];

  const WEB_SIZE_OPTIONS = [
    { value: "0", label: "Niet belangrijk" },
    { value: "20", label: "20 m²" },
    { value: "30", label: "30 m²" },
    { value: "40", label: "40 m²" },
    { value: "50", label: "50 m²" },
    { value: "60", label: "60 m²" },
    { value: "80", label: "80 m²" },
    { value: "100", label: "100 m²" },
  ];

  const sLabel = w ? "text-[15px] font-bold mb-3 block" : "text-[13px] font-semibold mb-3 block";

  const darkFilterSections = (
    <div className="flex flex-col gap-6">
      <section>
        <label className={sLabel} style={{ color: T.text }}>
          {t("onboarding.filters.rentLabel") || "Huurprijs"}
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
            label={t("onboarding.filters.priceFlexible") || "Stuur ook iets duurdere perfecte matches"}
            testId="toggle-price-flexible"
            theme={T}
          />
        </div>
      </section>

      <div className="h-px" style={{ backgroundColor: T.divider }} />

      <section>
        <label className={sLabel} style={{ color: T.text }}>
          {t("onboarding.filters.propertyTypeLabel") || "Woningtype"}
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
            label={t("onboarding.filters.includeRooms") || "Zoek ook kamers / onzelfstandige woonruimte"}
            testId="toggle-include-rooms"
            theme={T}
          />
        </div>
      </section>

      <div className="h-px" style={{ backgroundColor: T.divider }} />

      <section>
        <label className={sLabel} style={{ color: T.text }}>
          {t("onboarding.filters.bedroomsLabel") || "Slaapkamers"}
        </label>
        <div
          className="flex p-1 rounded-full"
          style={{ backgroundColor: "rgba(99,102,241,0.12)" }}
          data-testid="rooms-selector"
        >
          {ROOM_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => update({ minRooms: opt.value })}
              className="flex-1 h-[40px] rounded-full text-[13px] font-semibold transition-all"
              style={{
                backgroundColor: f.minRooms === opt.value ? "rgba(99,102,241,0.35)" : "transparent",
                color: f.minRooms === opt.value ? "#fff" : T.textSecondary,
              }}
              data-testid={`rooms-${opt.value}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      <div className="h-px" style={{ backgroundColor: T.divider }} />

      <section>
        <div className="flex items-center justify-between mb-3">
          <label className="text-[13px] font-semibold" style={{ color: T.text }}>
            {t("onboarding.filters.minSizeLabel") || "Minimale oppervlakte"}
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
            theme={T}
          />
        )}
      </section>

      <div className="h-px" style={{ backgroundColor: T.divider }} />

      <section>
        <label className={sLabel} style={{ color: T.text }}>
          {t("onboarding.filters.furnishedLabel") || "Gemeubileerd"}
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
          {t("onboarding.filters.amenitiesLabel") || "Extra wensen"}
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
          label={t("onboarding.filters.sendUnclear") || "Stuur ook woningen waarvan de criteria onduidelijk zijn"}
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

        <main className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-5 pt-6 pb-[100px] overflow-y-auto">
          <h2
            className="text-[24px] font-bold tracking-[-0.02em] mb-1"
            style={{ color: OBW.text }}
            data-testid="text-filters-title"
          >
            Wat zoek je precies?
          </h2>
          <p className="text-[14px] mb-6 leading-relaxed" style={{ color: OBW.textSecondary }}>
            Verfijn je zoekopdracht voor de beste resultaten.
          </p>

          <div className="flex flex-col gap-5">
            <div>
              <label className="text-[15px] font-bold mb-2 block" style={{ color: OBW.text }}>
                Maximale huurprijs
              </label>
              <select
                value={String(f.maxPrice)}
                onChange={(e) => update({ maxPrice: parseInt(e.target.value), minPrice: 0 })}
                className="w-full h-[48px] px-3.5 rounded-[8px] text-[14px] ha-field"
                style={{ backgroundColor: OBW.inputBg, borderColor: OBW.inputBorder, color: OBW.text }}
                data-testid="select-max-price"
              >
                {WEB_PRICE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="h-px" style={{ backgroundColor: OBW.divider }} />

            <div>
              <label className="text-[15px] font-bold mb-2 block" style={{ color: OBW.text }}>
                Slaapkamers
              </label>
              <SegmentedControl
                options={ROOM_OPTIONS}
                value={f.minRooms}
                onChange={(v) => update({ minRooms: v })}
                testId="rooms-selector"
                theme={OBW}
              />
            </div>

            <div className="h-px" style={{ backgroundColor: OBW.divider }} />

            <div>
              <label className="text-[15px] font-bold mb-2 block" style={{ color: OBW.text }}>
                Minimum oppervlakte
              </label>
              <select
                value={String(f.sizeNA ? 0 : f.minSize)}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  update({ minSize: v, sizeNA: v === 0 });
                }}
                className="w-full h-[48px] px-3.5 rounded-[8px] text-[14px] ha-field"
                style={{ backgroundColor: OBW.inputBg, borderColor: OBW.inputBorder, color: OBW.text }}
                data-testid="select-min-size"
              >
                {WEB_SIZE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="h-px" style={{ backgroundColor: OBW.divider }} />

            <div>
              <label className="text-[15px] font-bold mb-2 block" style={{ color: OBW.text }}>
                Gemeubileerd
              </label>
              <SegmentedControl
                options={FURNISHED_OPTIONS}
                value={f.furnished}
                onChange={(v) => update({ furnished: v })}
                testId="furnished-selector"
                theme={OBW}
              />
            </div>

            <div className="h-px" style={{ backgroundColor: OBW.divider }} />

            <div>
              <label className="text-[15px] font-bold mb-2 block" style={{ color: OBW.text }}>
                Woningtype
              </label>
              <SegmentedControl
                options={PROPERTY_OPTIONS}
                value={f.propertyType}
                onChange={(v) => update({ propertyType: v })}
                testId="property-type"
                theme={OBW}
              />
              <div className="mt-3">
                <Toggle
                  checked={f.includeRooms}
                  onChange={(v) => update({ includeRooms: v })}
                  label="Zoek ook kamers / onzelfstandige woonruimte"
                  testId="toggle-include-rooms"
                  theme={OBW}
                />
              </div>
            </div>

            <div className="h-px" style={{ backgroundColor: OBW.divider }} />

            <Toggle
              checked={f.priceFlexible}
              onChange={(v) => update({ priceFlexible: v })}
              label="Stuur ook iets duurdere perfecte matches"
              testId="toggle-price-flexible"
              theme={OBW}
            />
          </div>
        </main>

        <OBWebFooter
          onBack={handleBack}
          onNext={handleNext}
          nextLabel={isSearchOnlyMode ? (t("newSearch.save") || "Opslaan") : "Volgende"}
          saving={saving}
          backTestId="button-filters-back"
          nextTestId="button-filters-next"
        />
      </div>
    );
  }

  return (
    <div
      className="min-h-[100dvh] flex flex-col ob-dark"
      style={{ background: T.gradient }}
      data-testid="screen-onboarding-filters"
    >
      <header
        className="w-full sticky top-0 z-20 border-b"
        style={{
          backgroundColor: T.headerBg,
          borderColor: T.headerBorder,
          paddingTop: "max(8px, env(safe-area-inset-top))",
        }}
      >
        <div className="max-w-[480px] mx-auto px-5 h-[52px] flex items-center justify-between">
          <span
            className="text-[12px] font-bold px-2.5 py-1 rounded-[6px]"
            style={{
              backgroundColor: "rgba(56,189,248,0.15)",
              color: "#38bdf8",
            }}
            data-testid="badge-step"
          >
            {`3/${ONBOARDING_TOTAL_STEPS}`}
          </span>
          <span className="text-[15px] font-semibold" style={{ color: T.text }}>
            {t("onboarding.filters.headerTitle") || "Zoekopdracht maken"}
          </span>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-transform"
            style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
            data-testid="button-filters-close"
          >
            <X className="w-4 h-4" style={{ color: T.textSecondary }} />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-5 pt-5 pb-[120px] overflow-y-auto">
        <h2
          className="text-[22px] font-bold tracking-[-0.02em] mb-1"
          style={{ color: T.text }}
          data-testid="text-filters-title"
        >
          {t("onboarding.filters.title") || "Wat zoek je precies?"}
        </h2>
        <p className="text-[14px] mb-6" style={{ color: T.textSecondary }}>
          {t("onboarding.filters.subtitle") || "Verfijn je zoekopdracht."}
        </p>

        {darkFilterSections}
      </main>

      <OBFooter
        onBack={handleBack}
        onNext={handleNext}
        nextLabel={isSearchOnlyMode
          ? (t("newSearch.save") || "Opslaan")
          : (t("common.next") || "Volgende")}
        saving={saving}
        backTestId="button-filters-back"
        nextTestId="button-filters-next"
      />
    </div>
  );
}
