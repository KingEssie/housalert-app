import { useState, useCallback, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api-base";
import { HousAlertLogo } from "@/components/housalert-logo";
import { trackEvent } from "@/lib/track-event";
import { createSearchProfile } from "@/lib/search-profiles";
import { getMatchEstimateRange } from "@/lib/match-estimate";
import { defaultCities } from "../../../config/market";
import {
  MapPin, Search, ChevronLeft, Loader2, Check, ArrowRight,
  Euro, BedDouble, Maximize2, Eye, Shield, Star, Zap, Bell, Lock,
} from "lucide-react";

const BRAND = "rgb(var(--ha-primary))";
const BRAND_HOVER = "rgb(var(--ha-primary-hover))";
const TEXT_PRIMARY = "rgb(var(--ha-text))";
const TEXT_SECONDARY = "rgb(var(--ha-text-secondary))";
const BG_SURFACE = "rgb(var(--ha-surface))";
const BG_CARD = "rgb(var(--ha-card))";
const BORDER = "rgb(var(--ha-card-border))";

type FlowStep = "location" | "radius" | "filters" | "preview" | "confirm" | "paywall";
const STEPS: FlowStep[] = ["location", "radius", "filters", "preview", "confirm", "paywall"];

interface SearchData {
  city: string;
  lat: number;
  lng: number;
  radiusKm: number;
  minPrice: string;
  maxPrice: string;
  bedrooms: string;
  minSize: string;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
    country_code?: string;
  };
}

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-1.5 justify-center py-3" data-testid="onboarding-progress">
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

function FlowShell({
  children,
  step,
  onBack,
  showBack,
}: {
  children: React.ReactNode;
  step: FlowStep;
  onBack?: () => void;
  showBack?: boolean;
}) {
  const stepIndex = STEPS.indexOf(step);
  return (
    <div className="min-h-[100dvh] flex flex-col bg-ha-surface" data-testid={`onboarding-step-${step}`}>
      <header className="sticky top-0 z-20 bg-ha-card border-b border-ha-card-border">
        <div className="max-w-[480px] mx-auto px-5 h-[56px] flex items-center gap-3">
          {showBack && onBack ? (
            <button
              onClick={onBack}
              className="w-10 h-10 rounded-full bg-ha-surface flex items-center justify-center active:scale-95 transition-transform"
              data-testid="button-flow-back"
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
        <div className="max-w-[480px] mx-auto px-5">
          <ProgressDots current={stepIndex} total={STEPS.length} />
        </div>
      </header>
      <main className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-5 pb-8 pt-4">
        {children}
      </main>
    </div>
  );
}

function PrimaryBtn({
  onClick,
  children,
  loading,
  disabled,
  testId,
}: {
  onClick: () => void;
  children: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  testId: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full h-[52px] rounded-[6px] text-[15px] font-bold text-white transition-all active:scale-[0.97] disabled:opacity-50 shadow-[0_4px_16px_rgba(249,115,22,0.3)]"
      style={{ backgroundColor: BRAND }}
      onMouseOver={(e) => (e.currentTarget.style.backgroundColor = BRAND_HOVER)}
      onMouseOut={(e) => (e.currentTarget.style.backgroundColor = BRAND)}
      data-testid={testId}
    >
      {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : children}
    </button>
  );
}

function LocationStep({
  data,
  onSelect,
  t,
}: {
  data: SearchData;
  onSelect: (city: string, lat: number, lng: number) => void;
  t: (k: string, p?: Record<string, any>) => string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchCity = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        q, format: "json", addressdetails: "1",
        countrycodes: "de", limit: "6", "accept-language": "de",
      });
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { "User-Agent": "HousAlert/1.0" },
      });
      const json: NominatimResult[] = await res.json();
      setResults(json.filter((r) => {
        const a = r.address;
        return !!(a.city || a.town || a.village || a.municipality);
      }));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleInputChange(val: string) {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchCity(val), 300);
  }

  function handleSelectResult(r: NominatimResult) {
    const a = r.address;
    const name = a.city || a.town || a.village || a.municipality || "";
    onSelect(name, parseFloat(r.lat), parseFloat(r.lon));
  }

  function handleSelectPopular(c: typeof defaultCities[0]) {
    onSelect(c.name, c.lat, c.lng);
  }

  const topCities = defaultCities.slice(0, 12);

  return (
    <>
      <h1 className="text-[24px] font-bold tracking-[-0.02em] mb-1" style={{ color: TEXT_PRIMARY }} data-testid="text-location-title">
        {t("onboardingFlow.stepLocation")}
      </h1>
      <p className="text-[14px] mb-5" style={{ color: TEXT_SECONDARY }}>
        {t("onboardingFlow.stepLocationSub")}
      </p>

      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-ha-text-muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={t("onboardingFlow.searchPlaceholder")}
          className="w-full h-[48px] pl-11 pr-4 rounded-[6px] border border-ha-card-border bg-ha-card text-[15px] text-ha-text placeholder:text-ha-text-secondary focus:outline-none focus:ring-2 focus:ring-orange-200"
          data-testid="input-city-search"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-ha-text-muted" />}
      </div>

      {results.length > 0 && query.length >= 2 && (
        <div className="bg-ha-card rounded-[6px] border border-ha-card-border shadow-lg mb-5 overflow-hidden">
          {results.map((r) => {
            const a = r.address;
            const cityName = a.city || a.town || a.village || a.municipality || "";
            const state = a.state || "";
            return (
              <button
                key={r.place_id}
                onClick={() => handleSelectResult(r)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-ha-surface transition-colors text-left border-b border-ha-card-border last:border-0"
                data-testid={`result-city-${cityName}`}
              >
                <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: BRAND }} />
                <div>
                  <span className="text-[14px] font-medium text-ha-text">{cityName}</span>
                  {state && <span className="text-[13px] text-ha-text-secondary ml-1.5">{state}</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {query.length < 2 && (
        <>
          <p className="text-[13px] font-semibold uppercase tracking-wide mb-3" style={{ color: TEXT_SECONDARY }}>
            {t("onboardingFlow.popularCities")}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {topCities.map((c) => (
              <button
                key={c.name}
                onClick={() => handleSelectPopular(c)}
                className="h-[44px] rounded-[6px] border border-ha-card-border bg-ha-card text-[14px] font-medium text-ha-text hover:border-ha-primary hover:bg-orange-50 transition-all active:scale-[0.97]"
                data-testid={`city-${c.name}`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function RadiusStep({
  data,
  onChange,
  onNext,
  onBack,
  t,
}: {
  data: SearchData;
  onChange: (d: Partial<SearchData>) => void;
  onNext: () => void;
  onBack: () => void;
  t: (k: string, p?: Record<string, any>) => string;
}) {
  const radiusOptions = [5, 10, 15, 20, 25, 30, 50];

  return (
    <>
      <h1 className="text-[24px] font-bold tracking-[-0.02em] mb-1" style={{ color: TEXT_PRIMARY }} data-testid="text-radius-title">
        {t("onboardingFlow.stepRadius")}
      </h1>
      <p className="text-[14px] mb-6" style={{ color: TEXT_SECONDARY }}>
        {t("onboardingFlow.stepRadiusSub", { city: data.city })}
      </p>

      <div className="bg-ha-card rounded-[6px] border border-ha-card-border p-5 mb-6">
        <div className="flex items-center gap-2 mb-5">
          <MapPin className="w-4 h-4" style={{ color: BRAND }} />
          <span className="text-[15px] font-semibold text-ha-text">{data.city}</span>
        </div>

        <div className="space-y-3">
          {radiusOptions.map((km) => (
            <button
              key={km}
              onClick={() => onChange({ radiusKm: km })}
              className="w-full flex items-center justify-between px-4 py-3 rounded-[6px] border-2 transition-all"
              style={{
                borderColor: data.radiusKm === km ? BRAND : "rgb(var(--ha-card-border))",
                backgroundColor: data.radiusKm === km ? "rgba(249,115,22,0.06)" : "transparent",
              }}
              data-testid={`radius-${km}`}
            >
              <span className="text-[14px] font-medium" style={{ color: data.radiusKm === km ? BRAND : TEXT_PRIMARY }}>
                {t("onboardingFlow.radiusLabel", { km })}
              </span>
              {data.radiusKm === km && <Check className="w-4 h-4" style={{ color: BRAND }} />}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-auto space-y-3">
        <PrimaryBtn onClick={onNext} testId="button-radius-next">
          {t("onboardingFlow.next")}
        </PrimaryBtn>
      </div>
    </>
  );
}

function FiltersStep({
  data,
  onChange,
  onNext,
  onBack,
  t,
}: {
  data: SearchData;
  onChange: (d: Partial<SearchData>) => void;
  onNext: () => void;
  onBack: () => void;
  t: (k: string, p?: Record<string, any>) => string;
}) {
  const INPUT_CLS = "w-full h-[48px] pl-10 pr-4 rounded-[6px] border border-ha-card-border bg-ha-card text-[15px] font-medium text-ha-text placeholder:text-ha-text-secondary focus:outline-none focus:ring-2 focus:ring-orange-200";
  const SELECT_CLS = "w-full h-[48px] pl-10 pr-4 rounded-[6px] border border-ha-card-border bg-ha-card text-[15px] font-medium text-ha-text focus:outline-none focus:ring-2 focus:ring-orange-200 cursor-pointer appearance-none";

  return (
    <>
      <h1 className="text-[24px] font-bold tracking-[-0.02em] mb-1" style={{ color: TEXT_PRIMARY }} data-testid="text-filters-title">
        {t("onboardingFlow.stepFilters")}
      </h1>
      <p className="text-[14px] mb-5" style={{ color: TEXT_SECONDARY }}>
        {t("onboardingFlow.stepFiltersSub")}
      </p>

      <div className="bg-ha-card rounded-[6px] border border-ha-card-border p-5 mb-6">
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div>
            <label className="text-[13px] font-medium text-ha-text-secondary mb-1.5 block">
              {t("onboardingFlow.minRent")}
            </label>
            <div className="relative">
              <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ha-text-muted" />
              <input
                type="number"
                placeholder="€ 0"
                value={data.minPrice}
                onChange={(e) => onChange({ minPrice: e.target.value })}
                className={INPUT_CLS}
                data-testid="input-min-price"
              />
            </div>
          </div>
          <div>
            <label className="text-[13px] font-medium text-ha-text-secondary mb-1.5 block">
              {t("onboardingFlow.maxRent")}
            </label>
            <div className="relative">
              <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ha-text-muted" />
              <input
                type="number"
                placeholder="€ 2000"
                value={data.maxPrice}
                onChange={(e) => onChange({ maxPrice: e.target.value })}
                className={INPUT_CLS}
                data-testid="input-max-price"
              />
            </div>
          </div>
        </div>

        <div className="mb-5">
          <label className="text-[13px] font-medium text-ha-text-secondary mb-1.5 block">
            {t("onboardingFlow.bedrooms")}
          </label>
          <div className="relative">
            <BedDouble className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ha-text-muted" />
            <select
              value={data.bedrooms}
              onChange={(e) => onChange({ bedrooms: e.target.value })}
              className={SELECT_CLS}
              data-testid="select-bedrooms"
            >
              <option value="">{t("onboardingFlow.doesntMatter")}</option>
              <option value="0">Studio+</option>
              <option value="1">1+</option>
              <option value="2">2+</option>
              <option value="3">3+</option>
              <option value="4">4+</option>
              <option value="5">5+</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-[13px] font-medium text-ha-text-secondary mb-1.5 block">
            {t("onboardingFlow.minArea")}
          </label>
          <div className="relative">
            <Maximize2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ha-text-muted" />
            <input
              type="number"
              placeholder="0 m²"
              value={data.minSize}
              onChange={(e) => onChange({ minSize: e.target.value })}
              className={INPUT_CLS}
              data-testid="input-min-size"
            />
          </div>
        </div>
      </div>

      <div className="mt-auto space-y-3">
        <PrimaryBtn onClick={onNext} testId="button-filters-next">
          {t("onboardingFlow.next")}
        </PrimaryBtn>
      </div>
    </>
  );
}

function BlurredListingCard({ index }: { index: number }) {
  const prices = ["€850", "€1.200", "€975", "€1.450", "€680"];
  const sizes = ["65 m²", "82 m²", "55 m²", "95 m²", "48 m²"];
  const rooms = ["2 Zi.", "3 Zi.", "2 Zi.", "4 Zi.", "1 Zi."];
  const districts = ["Mitte", "Kreuzberg", "Altona", "Schwabing", "Südstadt"];

  return (
    <div className="bg-ha-card rounded-[6px] border border-ha-card-border p-4 relative overflow-hidden" data-testid={`blurred-listing-${index}`}>
      <div className="absolute inset-0 backdrop-blur-[6px] bg-white/60 z-10 flex items-center justify-center">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-ha-primary/10">
          <Lock className="w-3.5 h-3.5" style={{ color: BRAND }} />
          <span className="text-[12px] font-semibold" style={{ color: BRAND }}>Premium</span>
        </div>
      </div>
      <div className="flex gap-3">
        <div className="w-[72px] h-[72px] rounded-[4px] bg-gradient-to-br from-gray-200 to-gray-100 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold text-ha-text truncate">{prices[index % 5]} /Mon.</div>
          <div className="text-[13px] text-ha-text-secondary mt-0.5">{sizes[index % 5]} · {rooms[index % 5]}</div>
          <div className="text-[12px] text-ha-text-muted mt-1">{districts[index % 5]}</div>
        </div>
      </div>
    </div>
  );
}

function PreviewStep({
  data,
  onNext,
  onBack,
  t,
}: {
  data: SearchData;
  onNext: () => void;
  onBack: () => void;
  t: (k: string, p?: Record<string, any>) => string;
}) {
  const [estimate, setEstimate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!data.city) return;
    const p = new URLSearchParams({ city: data.city });
    apiFetch(`/api/estimate?${p.toString()}`)
      .then((res) => (res.ok ? res.json() : { perWeekEstimate: 0 }))
      .then((d) => setEstimate(d.perWeekEstimate ?? 0))
      .catch(() => setEstimate(0))
      .finally(() => setLoading(false));
  }, [data.city]);

  const range = getMatchEstimateRange(estimate ?? 0);

  return (
    <>
      <h1 className="text-[24px] font-bold tracking-[-0.02em] mb-1" style={{ color: TEXT_PRIMARY }} data-testid="text-preview-title">
        {t("onboardingFlow.stepPreview")}
      </h1>
      <p className="text-[14px] mb-5" style={{ color: TEXT_SECONDARY }}>
        {t("onboardingFlow.stepPreviewSub")}
      </p>

      <div className="bg-ha-card rounded-[6px] border border-ha-card-border p-5 mb-5">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(249,115,22,0.12)" }}>
            <Zap className="w-6 h-6" style={{ color: BRAND }} />
          </div>
          <div>
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: BRAND }} />
            ) : (
              <span className="text-[22px] font-bold" style={{ color: BRAND }} data-testid="text-match-range">
                {t("onboardingFlow.matchesPerWeek", { low: range.low, high: range.high })}
              </span>
            )}
          </div>
        </div>
        <p className="text-[13px] text-center" style={{ color: TEXT_SECONDARY }}>
          {t("onboardingFlow.previewNote")}
        </p>
      </div>

      <p className="text-[13px] font-semibold uppercase tracking-wide mb-3" style={{ color: TEXT_SECONDARY }}>
        {t("onboardingFlow.sampleListings", { city: data.city })}
      </p>

      <div className="space-y-3 mb-6">
        {[0, 1, 2].map((i) => (
          <BlurredListingCard key={i} index={i} />
        ))}
      </div>

      <div className="mt-auto space-y-3">
        <PrimaryBtn onClick={onNext} testId="button-preview-next">
          <span className="flex items-center justify-center gap-2">
            {t("onboardingFlow.next")}
            <ArrowRight className="w-4 h-4" />
          </span>
        </PrimaryBtn>
      </div>
    </>
  );
}

function ConfirmStep({
  data,
  onNext,
  onEdit,
  loading,
  t,
}: {
  data: SearchData;
  onNext: () => void;
  onEdit: () => void;
  loading?: boolean;
  t: (k: string, p?: Record<string, any>) => string;
}) {
  const rows = [
    { label: t("onboardingFlow.confirmCity"), value: data.city },
    { label: t("onboardingFlow.confirmRadius"), value: `${data.radiusKm} km` },
    {
      label: t("onboardingFlow.confirmPrice"),
      value: data.minPrice || data.maxPrice
        ? `€${data.minPrice || "0"} – €${data.maxPrice || "∞"}`
        : t("onboardingFlow.confirmAny"),
    },
    {
      label: t("onboardingFlow.confirmBedrooms"),
      value: data.bedrooms ? `${data.bedrooms}+` : t("onboardingFlow.confirmAny"),
    },
    {
      label: t("onboardingFlow.confirmSize"),
      value: data.minSize ? `${data.minSize} m²` : t("onboardingFlow.confirmAny"),
    },
  ];

  return (
    <>
      <h1 className="text-[24px] font-bold tracking-[-0.02em] mb-1" style={{ color: TEXT_PRIMARY }} data-testid="text-confirm-title">
        {t("onboardingFlow.stepConfirm")}
      </h1>
      <p className="text-[14px] mb-5" style={{ color: TEXT_SECONDARY }}>
        {t("onboardingFlow.stepConfirmSub")}
      </p>

      <div className="bg-ha-card rounded-[6px] border border-ha-card-border overflow-hidden mb-6">
        {rows.map((row, i) => (
          <div
            key={row.label}
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: i < rows.length - 1 ? `1px solid ${BORDER}` : "none" }}
            data-testid={`confirm-row-${i}`}
          >
            <span className="text-[13px] font-medium" style={{ color: TEXT_SECONDARY }}>{row.label}</span>
            <span className="text-[14px] font-semibold" style={{ color: TEXT_PRIMARY }}>{row.value}</span>
          </div>
        ))}
      </div>

      <div className="mt-auto space-y-3">
        <PrimaryBtn onClick={onNext} loading={loading} disabled={loading} testId="button-confirm-activate">
          <span className="flex items-center justify-center gap-2">
            {t("onboardingFlow.activateSearch")}
            <Check className="w-4 h-4" />
          </span>
        </PrimaryBtn>
        <button
          onClick={onEdit}
          className="w-full h-[44px] text-[14px] font-medium transition-all active:scale-[0.97]"
          style={{ color: TEXT_SECONDARY }}
          data-testid="button-confirm-edit"
        >
          {t("onboardingFlow.editSearch")}
        </button>
      </div>
    </>
  );
}

function PaywallStep({
  onSelectPlan,
  onSkip,
  t,
}: {
  onSelectPlan: (plan: string) => void;
  onSkip: () => void;
  t: (k: string, p?: Record<string, any>) => string;
}) {
  const [selected, setSelected] = useState("two_month");

  const plans = [
    { id: "monthly", name: t("funnel.paywall.monthly"), price: "€14,99", perMonth: "€14,99", popular: false, savings: null },
    { id: "two_month", name: t("funnel.paywall.twoMonth"), price: "€24,99", perMonth: "€12,50", popular: true, savings: t("funnel.paywall.save17") },
    { id: "three_month", name: t("funnel.paywall.threeMonth"), price: "€29,99", perMonth: "€10,00", popular: false, savings: t("funnel.paywall.save33") },
  ];

  return (
    <>
      <h1 className="text-[24px] font-bold tracking-[-0.02em] text-center mb-1" style={{ color: TEXT_PRIMARY }} data-testid="text-paywall-title">
        {t("onboardingFlow.stepPaywall")}
      </h1>
      <p className="text-[14px] text-center mb-5" style={{ color: TEXT_SECONDARY }}>
        {t("onboardingFlow.stepPaywallSub")}
      </p>

      <div className="space-y-3 mb-4">
        {[t("funnel.paywall.benefit1"), t("funnel.paywall.benefit2"), t("funnel.paywall.benefit3")].map((b, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "rgba(249,115,22,0.12)" }}>
              <Check className="w-3.5 h-3.5" style={{ color: BRAND }} />
            </div>
            <span className="text-[14px]" style={{ color: TEXT_PRIMARY }}>{b}</span>
          </div>
        ))}
      </div>

      <div className="space-y-3 mb-6 mt-2">
        {plans.map((plan) => (
          <button
            key={plan.id}
            onClick={() => setSelected(plan.id)}
            className="w-full rounded-[6px] p-4 border-2 transition-all relative text-left"
            style={{
              borderColor: selected === plan.id ? BRAND : BORDER,
              backgroundColor: selected === plan.id ? "rgba(249,115,22,0.04)" : "white",
            }}
            data-testid={`plan-${plan.id}`}
          >
            {plan.popular && (
              <span
                className="absolute -top-2.5 left-4 text-[11px] font-bold text-white px-2.5 py-0.5 rounded-full"
                style={{ backgroundColor: BRAND }}
              >
                {t("funnel.paywall.mostChosen")}
              </span>
            )}
            <div className="flex justify-between items-center">
              <div>
                <span className="text-[15px] font-semibold" style={{ color: TEXT_PRIMARY }}>{plan.name}</span>
                {plan.savings && (
                  <span className="ml-2 text-[12px] font-semibold px-2 py-0.5 rounded-full" style={{ color: BRAND, backgroundColor: "rgba(249,115,22,0.12)" }}>
                    {plan.savings}
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className="text-[16px] font-bold" style={{ color: TEXT_PRIMARY }}>{plan.perMonth}</span>
                <span className="text-[12px]" style={{ color: TEXT_SECONDARY }}>{t("funnel.paywall.perMonth")}</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 justify-center mb-5">
        <Shield className="w-4 h-4" style={{ color: TEXT_SECONDARY }} />
        <span className="text-[12px]" style={{ color: TEXT_SECONDARY }}>{t("funnel.paywall.guarantee")}</span>
      </div>

      <div className="mt-auto space-y-2">
        <PrimaryBtn onClick={() => onSelectPlan(selected)} testId="button-select-plan">
          {t("funnel.paywall.selectPlan")}
        </PrimaryBtn>
        <button
          onClick={onSkip}
          className="w-full h-[44px] text-[14px] font-medium transition-all active:scale-[0.97]"
          style={{ color: TEXT_SECONDARY }}
          data-testid="button-skip-paywall"
        >
          {t("onboardingFlow.continueWithout")}
        </button>
      </div>
    </>
  );
}

export default function OnboardingFlow() {
  const [, navigate] = useLocation();
  const { user, session } = useAuth();
  const { t } = useTranslation();
  const { toast } = useToast();

  const [step, setStep] = useState<FlowStep>("location");
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<SearchData>({
    city: "",
    lat: 52.52,
    lng: 13.405,
    radiusKm: 10,
    minPrice: "",
    maxPrice: "",
    bedrooms: "",
    minSize: "",
  });

  const updateData = useCallback((partial: Partial<SearchData>) => {
    setData((prev) => ({ ...prev, ...partial }));
  }, []);

  function goStep(s: FlowStep) {
    setStep(s);
    window.scrollTo(0, 0);
  }

  function handleBack() {
    const idx = STEPS.indexOf(step);
    if (idx > 0) goStep(STEPS[idx - 1]);
  }

  function handleCitySelect(city: string, lat: number, lng: number) {
    updateData({ city, lat, lng });
    trackEvent("onboarding_city_selected", { city });
    goStep("radius");
  }

  async function handleConfirmActivate() {
    if (!user) {
      navigate("/login");
      return;
    }

    setSaving(true);
    try {
      await createSearchProfile({
        user_id: user.id,
        city_name: data.city,
        country_code: "DE",
        latitude: data.lat,
        longitude: data.lng,
        price_min: parseInt(data.minPrice) || 0,
        price_max: parseInt(data.maxPrice) || 5000,
        bedrooms_min: parseInt(data.bedrooms) || 0,
        size_min: parseInt(data.minSize) || 0,
        location_mode: "radius",
        radius_km: data.radiusKm,
      });
      trackEvent("onboarding_search_created", { city: data.city });

      if (session?.access_token) {
        await apiFetch("/api/profile-data", {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ onboarding_completed: true }),
        }).catch((err) => console.error("[ONBOARDING] Failed to mark onboarding complete", err));
      }

      goStep("paywall");
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleSelectPlan(plan: string) {
    trackEvent("onboarding_plan_selected", { plan });

    try {
      const s = await supabase.auth.getSession();
      const token = s.data.session?.access_token;
      if (!token) {
        navigate("/login");
        return;
      }

      const res = await apiFetch("/api/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Checkout failed");
      }
      const result = await res.json();

      if (result.url) {
        if (typeof (window as any).ReactNativeWebView?.postMessage === "function") {
          (window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: "openExternal", url: result.url }));
        } else {
          window.location.href = result.url;
        }
      }
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    }
  }

  async function handleSkipPaywall() {
    trackEvent("onboarding_paywall_skipped");
    try {
      if (session?.access_token) {
        await apiFetch("/api/profile-data", {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ onboarding_completed: true }),
        });
      }
    } catch (err) {
      console.error("[ONBOARDING] Failed to mark onboarding complete", err);
    }
    navigate("/dashboard");
  }

  useEffect(() => {
    trackEvent("onboarding_flow_step", { step });
  }, [step]);

  return (
    <FlowShell step={step} onBack={handleBack} showBack={step !== "location"}>
      {step === "location" && (
        <LocationStep data={data} onSelect={handleCitySelect} t={t} />
      )}
      {step === "radius" && (
        <RadiusStep data={data} onChange={updateData} onNext={() => goStep("filters")} onBack={handleBack} t={t} />
      )}
      {step === "filters" && (
        <FiltersStep data={data} onChange={updateData} onNext={() => goStep("preview")} onBack={handleBack} t={t} />
      )}
      {step === "preview" && (
        <PreviewStep data={data} onNext={() => goStep("confirm")} onBack={handleBack} t={t} />
      )}
      {step === "confirm" && (
        <ConfirmStep data={data} onNext={handleConfirmActivate} onEdit={() => goStep("location")} loading={saving} t={t} />
      )}
      {step === "paywall" && (
        <PaywallStep onSelectPlan={handleSelectPlan} onSkip={handleSkipPaywall} t={t} />
      )}
    </FlowShell>
  );
}
