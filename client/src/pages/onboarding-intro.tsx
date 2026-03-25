import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "@/i18n";
import { HousAlertLogo } from "@/components/housalert-logo";
import { Search, Zap, Bell, MapPin, ChevronLeft, Loader2, Euro, BedDouble, Maximize2, Check } from "lucide-react";
import { defaultCities, cityDistricts } from "../../../config/market";
import { apiFetch } from "@/lib/api-base";

const BRAND = "rgb(var(--ha-primary))";
const BRAND_HOVER = "rgb(var(--ha-primary-hover))";
const TEXT_PRIMARY = "rgb(var(--ha-text))";
const TEXT_SECONDARY = "rgb(var(--ha-text-secondary))";
const BORDER = "rgb(var(--ha-card-border))";

type IntroStep = "info" | "city" | "filters";

interface SearchData {
  city: string;
  lat: number;
  lng: number;
  districts: string[];
  minPrice: string;
  maxPrice: string;
  minRooms: string;
  minSize: string;
}

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
  const [customResults, setCustomResults] = useState<typeof defaultCities>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filteredCities = search.trim()
    ? defaultCities.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : defaultCities;

  const searchNominatim = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setCustomResults([]); return; }
    setSearching(true);
    try {
      const params = new URLSearchParams({ q, format: "json", addressdetails: "1", countrycodes: "de", limit: "5", "accept-language": "de" });
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { "User-Agent": "HousAlert/1.0" } });
      const results = await res.json();
      const mapped = results
        .filter((r: any) => r.address?.city || r.address?.town || r.address?.village || r.address?.municipality)
        .map((r: any) => ({
          name: r.address?.city || r.address?.town || r.address?.village || r.address?.municipality || r.display_name.split(",")[0],
          lat: parseFloat(r.lat),
          lng: parseFloat(r.lon),
        }));
      setCustomResults(mapped);
    } catch { setCustomResults([]); }
    finally { setSearching(false); }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (search.trim().length >= 2 && filteredCities.length === 0) {
      debounceRef.current = setTimeout(() => searchNominatim(search), 400);
    } else {
      setCustomResults([]);
    }
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const allResults = filteredCities.length > 0 ? filteredCities : customResults;
  const districts = data.city ? cityDistricts[data.city] || [] : [];

  function selectCity(city: { name: string; lat: number; lng: number }) {
    onUpdate({ city: city.name, lat: city.lat, lng: city.lng, districts: [] });
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

  return (
    <div className="min-h-[100dvh] flex flex-col bg-ha-surface" data-testid="onboarding-step-city">
      <Header onBack={onBack} showBack />
      <div className="max-w-[480px] mx-auto px-5 w-full">
        <StepDots current={0} total={2} />
      </div>
      <main className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-5 pt-5 pb-10" style={{ paddingBottom: "max(40px, env(safe-area-inset-bottom, 40px))" }}>
        <h1 className="text-[24px] font-bold tracking-[-0.02em] mb-2" style={{ color: TEXT_PRIMARY }} data-testid="text-city-title">
          {t("onboarding.location.title") || "Wo möchtest du wohnen?"}
        </h1>
        <p className="text-[14px] mb-6" style={{ color: TEXT_SECONDARY }}>
          {t("onboarding.location.subtitle") || "Wähle deine Stadt und optional Stadtteile."}
        </p>

        <div className="relative mb-5">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ha-text-muted" />
          <input
            type="text"
            value={search || data.city}
            onChange={(e) => { setSearch(e.target.value); if (data.city) onUpdate({ city: "", lat: 0, lng: 0, districts: [] }); }}
            placeholder={t("onboarding.location.title")}
            className="w-full h-[48px] pl-11 pr-4 rounded-[6px] border bg-ha-card text-[15px] font-medium text-ha-text placeholder:text-ha-text-muted focus:border-ha-primary outline-none transition-all"
            style={{ borderColor: BORDER }}
            data-testid="input-city-search"
          />
          {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-ha-text-muted" />}
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
            {allResults.length === 0 && search.trim().length >= 2 && !searching && (
              <p className="text-[13px] text-ha-text-muted text-center py-4">{t("onboarding.location.noResults") || "Keine Ergebnisse"}</p>
            )}
          </div>
        )}

        {data.city && districts.length > 0 && (
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

        {data.city && (
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
        )}
      </main>
    </div>
  );
}

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
  return (
    <div className="min-h-[100dvh] flex flex-col bg-ha-surface" data-testid="onboarding-step-filters">
      <Header onBack={onBack} showBack />
      <div className="max-w-[480px] mx-auto px-5 w-full">
        <StepDots current={1} total={2} />
      </div>
      <main className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-5 pt-5 pb-10" style={{ paddingBottom: "max(40px, env(safe-area-inset-bottom, 40px))" }}>
        <h1 className="text-[24px] font-bold tracking-[-0.02em] mb-2" style={{ color: TEXT_PRIMARY }} data-testid="text-filters-title">
          {t("onboarding.filters.title") || "Was suchst du genau?"}
        </h1>
        <p className="text-[14px] mb-8" style={{ color: TEXT_SECONDARY }}>
          {t("onboarding.filters.subtitle") || "Grenze deine Suche ein, damit wir nur passende Wohnungen finden."}
        </p>

        <div className="flex flex-col gap-5">
          <div>
            <label className="text-[13px] font-medium text-ha-text-secondary mb-1.5 block">
              {t("onboarding.filters.maxPrice") || "Maximale Miete (€)"}
            </label>
            <div className="relative">
              <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ha-text-muted" />
              <input
                type="number"
                inputMode="numeric"
                value={data.maxPrice}
                onChange={(e) => onUpdate({ maxPrice: e.target.value })}
                placeholder="1500"
                className="w-full h-[48px] pl-11 pr-4 rounded-[6px] border bg-ha-card text-[15px] font-medium text-ha-text placeholder:text-ha-text-muted focus:border-ha-primary outline-none transition-all"
                style={{ borderColor: BORDER }}
                data-testid="input-max-price"
              />
            </div>
          </div>

          <div>
            <label className="text-[13px] font-medium text-ha-text-secondary mb-1.5 block">
              {t("onboarding.filters.minPrice") || "Mindestmiete (optional, €)"}
            </label>
            <div className="relative">
              <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ha-text-muted" />
              <input
                type="number"
                inputMode="numeric"
                value={data.minPrice}
                onChange={(e) => onUpdate({ minPrice: e.target.value })}
                placeholder="0"
                className="w-full h-[48px] pl-11 pr-4 rounded-[6px] border bg-ha-card text-[15px] font-medium text-ha-text placeholder:text-ha-text-muted focus:border-ha-primary outline-none transition-all"
                style={{ borderColor: BORDER }}
                data-testid="input-min-price"
              />
            </div>
          </div>

          <div>
            <label className="text-[13px] font-medium text-ha-text-secondary mb-1.5 block">
              {t("onboarding.filters.minRooms") || "Mindestanzahl Zimmer"}
            </label>
            <div className="relative">
              <BedDouble className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ha-text-muted" />
              <input
                type="number"
                inputMode="numeric"
                value={data.minRooms}
                onChange={(e) => onUpdate({ minRooms: e.target.value })}
                placeholder="1"
                className="w-full h-[48px] pl-11 pr-4 rounded-[6px] border bg-ha-card text-[15px] font-medium text-ha-text placeholder:text-ha-text-muted focus:border-ha-primary outline-none transition-all"
                style={{ borderColor: BORDER }}
                data-testid="input-min-rooms"
              />
            </div>
          </div>

          <div>
            <label className="text-[13px] font-medium text-ha-text-secondary mb-1.5 block">
              {t("onboarding.filters.minSize") || "Mindestgröße (m²)"}
            </label>
            <div className="relative">
              <Maximize2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ha-text-muted" />
              <input
                type="number"
                inputMode="numeric"
                value={data.minSize}
                onChange={(e) => onUpdate({ minSize: e.target.value })}
                placeholder="30"
                className="w-full h-[48px] pl-11 pr-4 rounded-[6px] border bg-ha-card text-[15px] font-medium text-ha-text placeholder:text-ha-text-muted focus:border-ha-primary outline-none transition-all"
                style={{ borderColor: BORDER }}
                data-testid="input-min-size"
              />
            </div>
          </div>
        </div>

        <div className="mt-auto pt-8">
          <button
            onClick={onNext}
            className="w-full h-[52px] rounded-[6px] text-[15px] font-bold text-white transition-all active:scale-[0.97] disabled:opacity-50 shadow-[0_4px_16px_rgba(249,115,22,0.3)]"
            style={{ backgroundColor: BRAND }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = BRAND_HOVER)}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = BRAND)}
            data-testid="button-filters-next"
          >
            {t("common.next") || "Weiter"}
          </button>
        </div>
      </main>
    </div>
  );
}

export default function OnboardingIntroPage() {
  console.log("[PAGE] OnboardingIntroPage rendered (new unified flow)");
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const [step, setStep] = useState<IntroStep>("info");
  const [data, setData] = useState<SearchData>({
    city: "",
    lat: 0,
    lng: 0,
    districts: [],
    minPrice: "",
    maxPrice: "",
    minRooms: "",
    minSize: "",
  });

  function updateData(partial: Partial<SearchData>) {
    setData((prev) => ({ ...prev, ...partial }));
  }

  function handleFiltersNext() {
    const params = new URLSearchParams();
    if (data.city) params.set("city", data.city);
    if (data.lat) params.set("lat", String(data.lat));
    if (data.lng) params.set("lng", String(data.lng));
    if (data.districts.length > 0) {
      params.set("locationMode", "districts");
      params.set("districts", data.districts.join(","));
    } else {
      params.set("locationMode", "city");
    }
    if (data.minPrice) params.set("minPrice", data.minPrice);
    if (data.maxPrice) params.set("maxPrice", data.maxPrice);
    if (data.minRooms) params.set("minRooms", data.minRooms);
    if (data.minSize) params.set("minSize", data.minSize);
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
