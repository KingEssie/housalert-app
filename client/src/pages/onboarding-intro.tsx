import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "@/i18n";
import { HousAlertLogo } from "@/components/housalert-logo";
import {
  Search, Zap, Bell, MapPin, ChevronLeft, Loader2, Check,
  Bath, Trees, Sun, Leaf, Sparkles,
} from "lucide-react";
import { defaultCities, cityDistricts } from "../../../config/market";
import { useGeocoderSearch } from "@/hooks/use-geocoder-search";

const BRAND = "rgb(var(--ha-primary))";
const BRAND_HOVER = "rgb(var(--ha-primary-hover))";
const TEXT_PRIMARY = "rgb(var(--ha-text))";
const TEXT_SECONDARY = "rgb(var(--ha-text-secondary))";
const BORDER = "rgb(var(--ha-card-border))";

type IntroStep = "info" | "city" | "filters";
type LocationMode = "city" | "districts" | "radius";

interface SearchData {
  city: string;
  lat: number;
  lng: number;
  locationMode: LocationMode;
  districts: string[];
  radiusKm: number;
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

const INITIAL_DATA: SearchData = {
  city: "", lat: 0, lng: 0,
  locationMode: "city",
  districts: [], radiusKm: 5,
  minPrice: 0, maxPrice: 1500, priceFlexible: false,
  propertyType: "any", includeRooms: false,
  minRooms: "any", minSize: 30, sizeNA: false,
  furnished: "any", amenities: [], sendUnclear: true,
};

const RADIUS_OPTIONS = [2, 5, 10, 15, 25, 50];

function Header({ onBack, showBack }: { onBack?: () => void; showBack?: boolean }) {
  return (
    <header className="sticky top-0 z-20 bg-ha-card border-b border-ha-card-border">
      <div className="max-w-[480px] mx-auto px-5 h-[56px] flex items-center gap-3">
        {showBack && onBack ? (
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-ha-surface flex items-center justify-center active:scale-95 transition-transform"
            data-testid="button-intro-back"
          >
            <ChevronLeft className="w-5 h-5 text-ha-text-muted" />
          </button>
        ) : (
          <div className="w-10" />
        )}
        <div className="flex-1 flex justify-center">
          <HousAlertLogo size={28} />
        </div>
        <div className="w-10" />
      </div>
    </header>
  );
}

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-1.5 justify-center py-3" data-testid="intro-progress">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="h-1.5 rounded-full transition-all duration-300"
          style={{
            width: i === current ? 24 : 8,
            backgroundColor: i <= current ? BRAND : "rgb(var(--ha-input-border))",
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
    <div className="flex gap-1 p-1 rounded-[6px] bg-ha-surface border border-ha-card-border" data-testid={testId}>
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
    <button
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 w-full py-2"
      data-testid={testId}
    >
      <div
        className="w-[44px] h-[26px] rounded-full transition-all flex-shrink-0 relative"
        style={{ backgroundColor: checked ? BRAND : "rgb(var(--ha-input-border))" }}
      >
        <div
          className="w-[22px] h-[22px] rounded-full bg-white shadow-sm absolute top-[2px] transition-all"
          style={{ left: checked ? 20 : 2 }}
        />
      </div>
      <span className="text-[14px] text-ha-text text-left">{label}</span>
    </button>
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
  formatLabel?: (v: number) => string;
  testId: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="w-full" data-testid={testId}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${BRAND} 0%, ${BRAND} ${pct}%, rgb(var(--ha-input-border)) ${pct}%, rgb(var(--ha-input-border)) 100%)`,
        }}
        data-testid={`${testId}-input`}
      />
      <div className="flex justify-between mt-1.5">
        <span className="text-[12px] text-ha-text-muted">{formatLabel ? formatLabel(min) : min}</span>
        <span className="text-[14px] font-semibold text-ha-text">{formatLabel ? formatLabel(value) : value}</span>
        <span className="text-[12px] text-ha-text-muted">{formatLabel ? formatLabel(max) : max}</span>
      </div>
    </div>
  );
}

const BENEFITS = [
  { icon: Search, key: "benefit1" as const },
  { icon: Zap, key: "benefit2" as const },
  { icon: Bell, key: "benefit3" as const },
];

function InfoStep({ onNext, onLogin, t }: { onNext: () => void; onLogin: () => void; t: (k: string) => string }) {
  return (
    <div className="min-h-[100dvh] bg-ha-bg flex flex-col" data-testid="onboarding-intro-page">
      <header className="w-full bg-ha-bg sticky top-0 z-20 border-b border-ha-card-border">
        <div className="max-w-lg mx-auto px-5 h-[56px] flex items-center justify-between">
          <HousAlertLogo size={32} textClassName="font-semibold text-ha-text text-[17px] tracking-[-0.01em]" />
          <button
            onClick={onLogin}
            className="text-[13px] font-medium text-ha-text-secondary hover:text-ha-text transition-colors"
            data-testid="button-back-to-login"
          >
            {t("onboardingIntro.alreadyAccount")}
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-[max(env(safe-area-inset-bottom),24px)]">
        <div className="w-full max-w-[380px] flex flex-col items-center text-center">
          <div className="w-[72px] h-[72px] rounded-[6px] flex items-center justify-center mb-8 bg-ha-primary/10">
            <Search className="w-8 h-8 text-ha-primary" />
          </div>

          <h1
            className="text-[26px] font-bold leading-[1.15] tracking-[-0.02em] text-ha-text mb-3"
            data-testid="text-intro-title"
          >
            {t("onboardingIntro.title")}
          </h1>

          <p className="text-[15px] leading-relaxed text-ha-text-secondary mb-10" data-testid="text-intro-subtitle">
            {t("onboardingIntro.subtitle")}
          </p>

          <div className="w-full flex flex-col gap-4 mb-10">
            {BENEFITS.map(({ icon: Icon, key }, i) => (
              <div key={i} className="flex items-start gap-3.5 text-left" data-testid={`benefit-${i + 1}`}>
                <div className="w-10 h-10 rounded-[6px] flex items-center justify-center flex-shrink-0 bg-ha-primary/10">
                  <Icon className="w-5 h-5 text-ha-primary" />
                </div>
                <div>
                  <p className="text-[15px] text-title text-ha-text">{t(`onboardingIntro.${key}.title`)}</p>
                  <p className="text-[13px] text-ha-text-secondary leading-relaxed mt-0.5">{t(`onboardingIntro.${key}.desc`)}</p>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={onNext}
            className="w-full h-[52px] rounded-[6px] text-[16px] font-bold text-ha-text transition-all active:scale-[0.97] shadow-[0_4px_14px_rgba(233,30,99,0.3)]"
            style={{ backgroundColor: BRAND }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = BRAND_HOVER)}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = BRAND)}
            data-testid="button-create-profile"
          >
            {t("onboardingIntro.cta")}
          </button>

          <button
            onClick={onLogin}
            className="mt-4 text-[13px] font-medium text-ha-text-secondary hover:text-ha-text transition-colors"
            data-testid="button-browse-listings"
          >
            {t("onboardingIntro.secondary")}
          </button>
        </div>
      </main>
    </div>
  );
}

function CityStep({
  data,
  onUpdate,
  onNext,
  onBack,
  t,
}: {
  data: SearchData;
  onUpdate: (d: Partial<SearchData>) => void;
  onNext: () => void;
  onBack: () => void;
  t: (k: string) => string;
}) {
  const [search, setSearch] = useState("");
  const geocoder = useGeocoderSearch({ debounceMs: 400, minChars: 2, limit: 5 });

  const filteredCities = search.trim()
    ? defaultCities.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : defaultCities;

  useEffect(() => {
    if (search.trim().length >= 2 && filteredCities.length === 0) {
      geocoder.search(search.trim());
    } else {
      geocoder.clear();
    }
  }, [search]);

  const geocoderCities = geocoder.results.map((r) => ({ name: r.city, lat: r.lat, lng: r.lng }));
  const allResults = filteredCities.length > 0 ? filteredCities : geocoderCities;
  const districts = data.city ? cityDistricts[data.city] || [] : [];
  const hasDistricts = districts.length > 0;

  function selectCity(city: { name: string; lat: number; lng: number }) {
    const d = cityDistricts[city.name] || [];
    onUpdate({
      city: city.name, lat: city.lat, lng: city.lng,
      districts: [],
      locationMode: d.length > 0 ? "districts" : "city",
    });
    setSearch("");
  }

  function toggleDistrict(d: string) {
    const current = data.districts;
    if (current.includes(d)) {
      onUpdate({ districts: current.filter((x) => x !== d) });
    } else {
      onUpdate({ districts: [...current, d] });
    }
  }

  const locationModes: { value: LocationMode; label: string }[] = hasDistricts
    ? [
        { value: "districts", label: t("location.tabs.districts") || "Stadtteile" },
        { value: "radius", label: t("location.tabs.radius") || "Radius" },
        { value: "city", label: t("onboarding.location.wholeCity") || "Ganze Stadt" },
      ]
    : [
        { value: "radius", label: t("location.tabs.radius") || "Radius" },
        { value: "city", label: t("onboarding.location.wholeCity") || "Ganze Stadt" },
      ];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-ha-surface" data-testid="onboarding-step-city">
      <Header onBack={onBack} showBack />
      <div className="max-w-[480px] mx-auto px-5 w-full">
        <StepDots current={0} total={2} />
      </div>
      <main className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-5 pt-5 pb-10" style={{ paddingBottom: "max(40px, env(safe-area-inset-bottom, 40px))" }}>
        <h1 className="text-[24px] font-bold tracking-[-0.02em] mb-2" style={{ color: TEXT_PRIMARY }} data-testid="text-city-title">
          {t("onboarding.location.title")}
        </h1>
        <p className="text-[14px] mb-6" style={{ color: TEXT_SECONDARY }}>
          {t("onboarding.location.subtitle")}
        </p>

        <div className="relative mb-5">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ha-text-muted" />
          <input
            type="text"
            value={search || data.city}
            onChange={(e) => { setSearch(e.target.value); if (data.city) onUpdate({ city: "", lat: 0, lng: 0, districts: [], locationMode: "city" }); }}
            placeholder={t("onboarding.location.searchPlaceholder") || "Stadt suchen..."}
            className="w-full h-[48px] pl-11 pr-4 rounded-[6px] border bg-ha-card text-[15px] font-medium text-ha-text placeholder:text-ha-text-muted focus:border-ha-primary outline-none transition-all"
            style={{ borderColor: BORDER }}
            data-testid="input-city-search"
          />
          {geocoder.loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-ha-text-muted" />}
        </div>

        {!data.city && (
          <div className="flex flex-col gap-1 mb-4 max-h-[320px] overflow-y-auto" data-testid="city-list">
            {allResults.map((city) => (
              <button
                key={city.name}
                onClick={() => selectCity(city)}
                className="flex items-center gap-3 px-3 py-3 rounded-[6px] hover:bg-ha-surface-hover active:bg-ha-surface-active transition-colors text-left"
                data-testid={`city-option-${city.name}`}
              >
                <MapPin className="w-4 h-4 text-ha-text-muted flex-shrink-0" />
                <span className="text-[15px] font-medium text-ha-text">{city.name}</span>
              </button>
            ))}
            {allResults.length === 0 && search.trim().length >= 2 && !geocoder.loading && (
              <p className="text-[13px] text-ha-text-muted text-center py-4">{t("onboarding.location.noResults") || "Keine Ergebnisse"}</p>
            )}
          </div>
        )}

        {data.city && (
          <>
            <div className="mb-5">
              <p className="text-[13px] font-medium text-ha-text-secondary mb-2">
                {t("onboarding.location.modeLabel") || "Wie möchtest du suchen?"}
              </p>
              <SegmentedControl
                options={locationModes}
                value={data.locationMode}
                onChange={(v) => onUpdate({ locationMode: v as LocationMode, districts: [] })}
                testId="location-mode"
              />
            </div>

            {data.locationMode === "districts" && hasDistricts && (
              <div className="mb-6">
                <p className="text-[13px] font-medium text-ha-text-secondary mb-3">
                  {t("onboarding.location.districtsLabel") || "Stadtteile (optional)"}
                </p>
                <div className="flex flex-wrap gap-2" data-testid="district-chips">
                  {districts.map((d) => {
                    const active = data.districts.includes(d);
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

            {data.locationMode === "radius" && (
              <div className="mb-6">
                <p className="text-[13px] font-medium text-ha-text-secondary mb-3">
                  {t("location.radiusLabel") || "Radius"}
                </p>
                <div className="flex flex-wrap gap-2" data-testid="radius-options">
                  {RADIUS_OPTIONS.map((km) => {
                    const active = data.radiusKm === km;
                    return (
                      <button
                        key={km}
                        onClick={() => onUpdate({ radiusKm: km })}
                        className="px-4 py-2 rounded-[6px] text-[14px] font-medium border-2 transition-all"
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

            {data.locationMode === "city" && (
              <div className="mb-6 bg-ha-card rounded-[6px] border border-ha-card-border p-4">
                <p className="text-[14px] text-ha-text">
                  {t("onboarding.location.wholeCityHint") || `Wir suchen in ganz ${data.city} nach passenden Wohnungen.`}
                </p>
              </div>
            )}

            <div className="mt-auto pt-6">
              <button
                onClick={onNext}
                className="w-full h-[52px] rounded-[6px] text-[15px] font-bold text-white transition-all active:scale-[0.97] disabled:opacity-50 shadow-[0_4px_16px_rgba(249,115,22,0.3)]"
                style={{ backgroundColor: BRAND }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = BRAND_HOVER)}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = BRAND)}
                data-testid="button-city-next"
              >
                {t("common.next") || "Weiter"}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

const AMENITY_OPTIONS = [
  { value: "bath", label: "Bad", icon: Bath },
  { value: "balcony", label: "Balkon", icon: Sun },
  { value: "garden", label: "Tuin", icon: Trees },
  { value: "rooftop", label: "Dakterras", icon: Sun },
  { value: "energy_c", label: "Energielabel C+", icon: Leaf },
];

function FiltersStep({
  data,
  onUpdate,
  onNext,
  onBack,
  t,
}: {
  data: SearchData;
  onUpdate: (d: Partial<SearchData>) => void;
  onNext: () => void;
  onBack: () => void;
  t: (k: string) => string;
}) {
  const ROOM_OPTIONS = [
    { value: "any", label: "Studio+" },
    { value: "1", label: "1+" },
    { value: "2", label: "2+" },
    { value: "3", label: "3+" },
    { value: "4", label: "4+" },
    { value: "5", label: "5+" },
  ];

  const PROPERTY_OPTIONS = [
    { value: "any", label: t("onboarding.propertyType.any") || "Maakt niet uit" },
    { value: "apartment", label: t("onboarding.propertyType.apartment") || "Appartement" },
    { value: "house", label: t("onboarding.filters.house") || "Huis" },
  ];

  const FURNISHED_OPTIONS = [
    { value: "any", label: t("onboarding.filters.furnishedAny") || "Maakt niet uit" },
    { value: "furnished", label: t("onboarding.filters.furnishedYes") || "Ja" },
    { value: "unfurnished", label: t("onboarding.filters.furnishedNo") || "Nee" },
  ];

  function toggleAmenity(a: string) {
    const current = data.amenities;
    if (current.includes(a)) {
      onUpdate({ amenities: current.filter((x) => x !== a) });
    } else {
      onUpdate({ amenities: [...current, a] });
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-ha-surface" data-testid="onboarding-step-filters">
      <Header onBack={onBack} showBack />
      <div className="max-w-[480px] mx-auto px-5 w-full">
        <StepDots current={1} total={2} />
      </div>

      <main className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-5 pt-5 pb-[140px] overflow-y-auto">
        <h1 className="text-[24px] font-bold tracking-[-0.02em] mb-2" style={{ color: TEXT_PRIMARY }} data-testid="text-filters-title">
          {t("onboarding.filters.title") || "Was suchst du genau?"}
        </h1>
        <p className="text-[14px] mb-6" style={{ color: TEXT_SECONDARY }}>
          {t("onboarding.filters.subtitle") || "Verfijn je zoekopdracht."}
        </p>

        <div className="flex flex-col gap-7">
          <div>
            <label className="text-[13px] font-semibold text-ha-text mb-3 block">
              {t("onboarding.filters.rentLabel") || "Huurprijs"}
            </label>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1">
                <label className="text-[11px] text-ha-text-muted mb-1 block">Min</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={data.minPrice || ""}
                  onChange={(e) => onUpdate({ minPrice: Number(e.target.value) || 0 })}
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
                  value={data.maxPrice || ""}
                  onChange={(e) => onUpdate({ maxPrice: Number(e.target.value) || 0 })}
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
              value={data.maxPrice}
              onChange={(v) => onUpdate({ maxPrice: v })}
              formatLabel={(v) => `€${v}`}
              testId="slider-max-price"
            />
            <div className="mt-3">
              <Toggle
                checked={data.priceFlexible}
                onChange={(v) => onUpdate({ priceFlexible: v })}
                label={t("onboarding.filters.priceFlexible") || "Stuur ook iets duurdere perfecte matches"}
                testId="toggle-price-flexible"
              />
            </div>
          </div>

          <div className="h-px bg-ha-card-border" />

          <div>
            <label className="text-[13px] font-semibold text-ha-text mb-3 block">
              {t("onboarding.filters.propertyTypeLabel") || "Soort woning"}
            </label>
            <SegmentedControl
              options={PROPERTY_OPTIONS}
              value={data.propertyType}
              onChange={(v) => onUpdate({ propertyType: v })}
              testId="property-type"
            />
            <div className="mt-3">
              <Toggle
                checked={data.includeRooms}
                onChange={(v) => onUpdate({ includeRooms: v })}
                label={t("onboarding.filters.includeRooms") || "Zoek ook naar kamers / onzelfstandige woonruimtes"}
                testId="toggle-include-rooms"
              />
            </div>
          </div>

          <div className="h-px bg-ha-card-border" />

          <div>
            <label className="text-[13px] font-semibold text-ha-text mb-3 block">
              {t("onboarding.filters.bedroomsLabel") || "Slaapkamers"}
            </label>
            <div className="flex gap-1 p-1 rounded-[6px] bg-ha-surface border border-ha-card-border" data-testid="rooms-selector">
              {ROOM_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onUpdate({ minRooms: opt.value })}
                  className="flex-1 h-[38px] rounded-[5px] text-[13px] font-medium transition-all"
                  style={{
                    backgroundColor: data.minRooms === opt.value ? BRAND : "transparent",
                    color: data.minRooms === opt.value ? "#fff" : TEXT_SECONDARY,
                  }}
                  data-testid={`rooms-${opt.value}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="h-px bg-ha-card-border" />

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-[13px] font-semibold text-ha-text">
                {t("onboarding.filters.minSizeLabel") || "Minimale oppervlakte"}
              </label>
              <button
                onClick={() => onUpdate({ sizeNA: !data.sizeNA, minSize: data.sizeNA ? 30 : 0 })}
                className="text-[12px] font-medium px-2.5 py-1 rounded-full border transition-all"
                style={{
                  borderColor: data.sizeNA ? BRAND : BORDER,
                  backgroundColor: data.sizeNA ? "rgba(var(--ha-primary-rgb, 233,30,99), 0.06)" : "transparent",
                  color: data.sizeNA ? BRAND : TEXT_SECONDARY,
                }}
                data-testid="button-size-na"
              >
                n.v.t.
              </button>
            </div>
            {!data.sizeNA && (
              <RangeSlider
                min={0}
                max={200}
                step={5}
                value={data.minSize}
                onChange={(v) => onUpdate({ minSize: v })}
                formatLabel={(v) => `${v} m²`}
                testId="slider-min-size"
              />
            )}
          </div>

          <div className="h-px bg-ha-card-border" />

          <div>
            <label className="text-[13px] font-semibold text-ha-text mb-3 block">
              {t("onboarding.filters.furnishedLabel") || "Gemeubileerd"}
            </label>
            <SegmentedControl
              options={FURNISHED_OPTIONS}
              value={data.furnished}
              onChange={(v) => onUpdate({ furnished: v })}
              testId="furnished-selector"
            />
          </div>

          <div className="h-px bg-ha-card-border" />

          <div>
            <label className="text-[13px] font-semibold text-ha-text mb-3 block">
              {t("onboarding.filters.amenitiesLabel") || "Overige wensen"}
            </label>
            <div className="flex flex-wrap gap-2" data-testid="amenity-chips">
              {AMENITY_OPTIONS.map(({ value, label, icon: Icon }) => {
                const active = data.amenities.includes(value);
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
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-px bg-ha-card-border" />

          <div>
            <Toggle
              checked={data.sendUnclear}
              onChange={(v) => onUpdate({ sendUnclear: v })}
              label={t("onboarding.filters.sendUnclear") || "Stuur mij woningen waarbij mijn eisen niet duidelijk staan"}
              testId="toggle-send-unclear"
            />
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-ha-card border-t border-ha-card-border z-30" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))" }}>
        <div className="max-w-[480px] mx-auto px-5 pt-3 flex items-center gap-3">
          <button
            onClick={onBack}
            className="h-[52px] px-6 rounded-[6px] text-[15px] font-medium border-2 transition-all active:scale-[0.97]"
            style={{ borderColor: BORDER, color: TEXT_PRIMARY }}
            data-testid="button-filters-back"
          >
            {t("common.back") || "Terug"}
          </button>
          <button
            onClick={onNext}
            className="flex-1 h-[52px] rounded-[6px] text-[15px] font-bold text-white transition-all active:scale-[0.97] shadow-[0_4px_16px_rgba(249,115,22,0.3)]"
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

export default function OnboardingIntroPage() {
  console.log("[PAGE] OnboardingIntroPage rendered (new unified flow)");
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const [step, setStep] = useState<IntroStep>("info");
  const [data, setData] = useState<SearchData>(INITIAL_DATA);

  function updateData(partial: Partial<SearchData>) {
    setData((prev) => ({ ...prev, ...partial }));
  }

  function handleFiltersNext() {
    const params = new URLSearchParams();
    if (data.city) params.set("city", data.city);
    if (data.lat) params.set("lat", String(data.lat));
    if (data.lng) params.set("lng", String(data.lng));

    if (data.locationMode === "districts" && data.districts.length > 0) {
      params.set("locationMode", "districts");
      params.set("districts", data.districts.join(","));
    } else if (data.locationMode === "radius") {
      params.set("locationMode", "radius");
      params.set("radiusKm", String(data.radiusKm));
    } else {
      params.set("locationMode", "city");
    }

    if (data.minPrice) params.set("minPrice", String(data.minPrice));
    if (data.maxPrice) params.set("maxPrice", String(data.maxPrice));
    if (data.priceFlexible) params.set("priceFlexible", "true");

    if (data.propertyType !== "any") {
      const types = [data.propertyType];
      if (data.includeRooms) types.push("room");
      params.set("propertyTypes", types.join(","));
    } else if (data.includeRooms) {
      params.set("propertyTypes", "apartment,house,room");
    }

    if (data.minRooms !== "any") params.set("minRooms", data.minRooms);
    if (!data.sizeNA && data.minSize > 0) params.set("minSize", String(data.minSize));
    if (data.furnished !== "any") params.set("furnished", data.furnished);
    if (data.amenities.length > 0) params.set("amenities", data.amenities.join(","));
    if (data.sendUnclear) params.set("sendUnclear", "true");

    navigate(`/signup?${params.toString()}`);
  }

  if (step === "city") {
    return (
      <CityStep
        data={data}
        onUpdate={updateData}
        onNext={() => { window.scrollTo(0, 0); setStep("filters"); }}
        onBack={() => { window.scrollTo(0, 0); setStep("info"); }}
        t={t}
      />
    );
  }

  if (step === "filters") {
    return (
      <FiltersStep
        data={data}
        onUpdate={updateData}
        onNext={handleFiltersNext}
        onBack={() => { window.scrollTo(0, 0); setStep("city"); }}
        t={t}
      />
    );
  }

  return (
    <InfoStep
      onNext={() => { window.scrollTo(0, 0); setStep("city"); }}
      onLogin={() => navigate("/")}
      t={t}
    />
  );
}
