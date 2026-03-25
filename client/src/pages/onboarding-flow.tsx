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
import { generateOnboardingLetter, type OnboardingLetterData } from "@/lib/application-letter";
import { defaultCities } from "../../../config/market";
import {
  MapPin, Search, ChevronLeft, Loader2, Check, ArrowRight,
  Euro, BedDouble, Maximize2, Eye, Shield, Star, Zap, Bell, Lock,
  AlertTriangle, Clock, X, CheckCircle2, Copy, Send, Mail, BellRing,
  User, Heart, Briefcase, Home, PawPrint, FileText, Users, Sparkles,
} from "lucide-react";

const BRAND = "rgb(var(--ha-primary))";
const BRAND_HOVER = "rgb(var(--ha-primary-hover))";
const TEXT_PRIMARY = "rgb(var(--ha-text))";
const TEXT_SECONDARY = "rgb(var(--ha-text-secondary))";
const BG_SURFACE = "rgb(var(--ha-surface))";
const BG_CARD = "rgb(var(--ha-card))";
const BORDER = "rgb(var(--ha-card-border))";

type FlowStep =
  | "location" | "radius" | "filters" | "preview" | "confirm" | "paywall"
  | "limited-access" | "welcome" | "letter-personal" | "letter-living"
  | "letter-preview" | "search-buddy" | "push-test" | "success";

const PRE_PAYWALL_STEPS: FlowStep[] = ["location", "radius", "filters", "preview", "confirm", "paywall"];
const POST_PAYWALL_STEPS: FlowStep[] = ["welcome", "letter-personal", "letter-living", "letter-preview", "search-buddy", "push-test", "success"];
const STEPS = PRE_PAYWALL_STEPS;

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
  const isPostPaywall = POST_PAYWALL_STEPS.includes(step) || step === "limited-access";
  const stepList = isPostPaywall ? POST_PAYWALL_STEPS : PRE_PAYWALL_STEPS;
  const stepIndex = stepList.indexOf(step);
  const hideProgress = step === "limited-access" || step === "success";

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
        {!hideProgress && (
          <div className="max-w-[480px] mx-auto px-5">
            <ProgressDots current={stepIndex} total={stepList.length} />
          </div>
        )}
      </header>
      <main className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-5 pt-5 pb-10" style={{ paddingBottom: "max(40px, env(safe-area-inset-bottom, 40px))" }}>
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

function SecondaryBtn({
  onClick,
  children,
  testId,
}: {
  onClick: () => void;
  children: React.ReactNode;
  testId: string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full h-[52px] rounded-[6px] text-[15px] font-medium border border-ha-card-border bg-ha-card transition-all active:scale-[0.97]"
      style={{ color: TEXT_SECONDARY }}
      data-testid={testId}
    >
      {children}
    </button>
  );
}

function LimitedAccessStep({
  onGoBack,
  onContinue,
  t,
}: {
  onGoBack: () => void;
  onContinue: () => void;
  t: (k: string, p?: Record<string, any>) => string;
}) {
  const features = [
    { icon: Clock, text: t("onboardingFlow.limitedAccess.feature1") },
    { icon: AlertTriangle, text: t("onboardingFlow.limitedAccess.feature2") },
    { icon: X, text: t("onboardingFlow.limitedAccess.feature3") },
  ];

  return (
    <>
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-5" style={{ backgroundColor: "rgba(239,68,68,0.1)" }}>
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-[24px] font-bold tracking-[-0.02em] mb-2" style={{ color: TEXT_PRIMARY }} data-testid="text-limited-title">
          {t("onboardingFlow.limitedAccess.title")}
        </h1>
        <p className="text-[14px] mb-8 max-w-[320px]" style={{ color: TEXT_SECONDARY }}>
          {t("onboardingFlow.limitedAccess.subtitle")}
        </p>

        <div className="bg-ha-card rounded-[6px] border border-ha-card-border p-5 w-full text-left space-y-4">
          {features.map((f, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                <f.icon className="w-4 h-4 text-red-500" />
              </div>
              <span className="text-[14px] font-medium" style={{ color: TEXT_PRIMARY }}>{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto space-y-3 pt-6">
        <PrimaryBtn onClick={onGoBack} testId="button-limited-goback">
          {t("onboardingFlow.limitedAccess.goBack")}
        </PrimaryBtn>
        <SecondaryBtn onClick={onContinue} testId="button-limited-continue">
          {t("onboardingFlow.limitedAccess.continueAnyway")}
        </SecondaryBtn>
      </div>
    </>
  );
}

function WelcomeStep({
  onNext,
  t,
}: {
  onNext: () => void;
  t: (k: string, p?: Record<string, any>) => string;
}) {
  const points = [
    { icon: FileText, text: t("onboardingFlow.welcome.point1") },
    { icon: Users, text: t("onboardingFlow.welcome.point2") },
    { icon: Bell, text: t("onboardingFlow.welcome.point3") },
  ];

  return (
    <>
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-5" style={{ backgroundColor: "rgba(249,115,22,0.12)" }}>
          <Sparkles className="w-8 h-8" style={{ color: BRAND }} />
        </div>
        <h1 className="text-[24px] font-bold tracking-[-0.02em] mb-2" style={{ color: TEXT_PRIMARY }} data-testid="text-welcome-title">
          {t("onboardingFlow.welcome.title")}
        </h1>
        <p className="text-[14px] mb-8 max-w-[320px]" style={{ color: TEXT_SECONDARY }}>
          {t("onboardingFlow.welcome.subtitle")}
        </p>

        <div className="w-full space-y-4">
          {points.map((p, i) => (
            <div key={i} className="flex items-center gap-4 bg-ha-card rounded-[6px] border border-ha-card-border px-5 py-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "rgba(249,115,22,0.12)" }}>
                <p.icon className="w-5 h-5" style={{ color: BRAND }} />
              </div>
              <span className="text-[14px] font-medium text-left" style={{ color: TEXT_PRIMARY }}>{p.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto pt-6">
        <PrimaryBtn onClick={onNext} testId="button-welcome-next">
          {t("onboardingFlow.welcome.cta")}
        </PrimaryBtn>
      </div>
    </>
  );
}

interface PersonalData {
  phone: string;
  birthDay: string;
  birthMonth: string;
  birthYear: string;
  gender: string;
}

function LetterPersonalStep({
  personalData,
  onChange,
  onNext,
  onSkip,
  t,
}: {
  personalData: PersonalData;
  onChange: (d: Partial<PersonalData>) => void;
  onNext: () => void;
  onSkip: () => void;
  t: (k: string, p?: Record<string, any>) => string;
}) {
  const INPUT_CLS = "w-full h-[48px] px-4 rounded-[6px] border border-ha-card-border bg-ha-card text-[15px] text-ha-text placeholder:text-ha-text-secondary focus:outline-none focus:ring-2 focus:ring-orange-200";

  const genderOptions = [
    { value: "male", label: t("onboardingFlow.letterPersonal.genderOptions.male") },
    { value: "female", label: t("onboardingFlow.letterPersonal.genderOptions.female") },
    { value: "other", label: t("onboardingFlow.letterPersonal.genderOptions.other") },
    { value: "prefer_not", label: t("onboardingFlow.letterPersonal.genderOptions.prefer_not") },
  ];

  return (
    <>
      <h1 className="text-[24px] font-bold tracking-[-0.02em] mb-2" style={{ color: TEXT_PRIMARY }} data-testid="text-letter-personal-title">
        {t("onboardingFlow.letterPersonal.title")}
      </h1>
      <p className="text-[14px] mb-6" style={{ color: TEXT_SECONDARY }}>
        {t("onboardingFlow.letterPersonal.subtitle")}
      </p>

      <div className="space-y-5 flex-1">
        <div>
          <label className="text-[13px] font-medium text-ha-text-secondary mb-1.5 block">
            {t("onboardingFlow.letterPersonal.phone")}
          </label>
          <input
            type="tel"
            inputMode="tel"
            value={personalData.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
            placeholder={t("onboardingFlow.letterPersonal.phonePlaceholder")}
            className={INPUT_CLS}
            data-testid="input-phone"
          />
        </div>

        <div>
          <label className="text-[13px] font-medium text-ha-text-secondary mb-1.5 block">
            {t("onboardingFlow.letterPersonal.birthDate")}
          </label>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder={t("onboardingFlow.letterPersonal.day")}
              value={personalData.birthDay}
              onChange={(e) => onChange({ birthDay: e.target.value.replace(/\D/g, "").slice(0, 2) })}
              className={INPUT_CLS + " text-center"}
              data-testid="input-birth-day"
            />
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder={t("onboardingFlow.letterPersonal.month")}
              value={personalData.birthMonth}
              onChange={(e) => onChange({ birthMonth: e.target.value.replace(/\D/g, "").slice(0, 2) })}
              className={INPUT_CLS + " text-center"}
              data-testid="input-birth-month"
            />
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder={t("onboardingFlow.letterPersonal.year")}
              value={personalData.birthYear}
              onChange={(e) => onChange({ birthYear: e.target.value.replace(/\D/g, "").slice(0, 4) })}
              className={INPUT_CLS + " text-center"}
              data-testid="input-birth-year"
            />
          </div>
        </div>

        <div>
          <label className="text-[13px] font-medium text-ha-text-secondary mb-2 block">
            {t("onboardingFlow.letterPersonal.gender")}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {genderOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onChange({ gender: opt.value })}
                className="h-[46px] rounded-[6px] border-2 text-[14px] font-medium transition-all active:scale-[0.97]"
                style={{
                  borderColor: personalData.gender === opt.value ? BRAND : "rgb(var(--ha-card-border))",
                  backgroundColor: personalData.gender === opt.value ? "rgba(249,115,22,0.06)" : "transparent",
                  color: personalData.gender === opt.value ? BRAND : TEXT_PRIMARY,
                }}
                data-testid={`gender-${opt.value}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-auto space-y-3 pt-6">
        <PrimaryBtn onClick={onNext} testId="button-personal-next">
          {t("onboardingFlow.letterPersonal.cta")}
        </PrimaryBtn>
        <SecondaryBtn onClick={onSkip} testId="button-personal-skip">
          {t("onboardingFlow.letterPersonal.skip")}
        </SecondaryBtn>
      </div>
    </>
  );
}

interface LivingData {
  livingWith: string;
  workStatus: string;
  moveReason: string;
  income: string;
  petsCount: string;
}

function OptionGrid({
  options,
  selected,
  onSelect,
  columns,
}: {
  options: { value: string; label: string }[];
  selected: string;
  onSelect: (v: string) => void;
  columns?: number;
}) {
  return (
    <div className={`grid gap-2 ${columns === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onSelect(opt.value)}
          className="px-3 py-3 rounded-[6px] border-2 text-[13px] font-medium transition-all active:scale-[0.97] text-left"
          style={{
            borderColor: selected === opt.value ? BRAND : "rgb(var(--ha-card-border))",
            backgroundColor: selected === opt.value ? "rgba(249,115,22,0.06)" : "transparent",
            color: selected === opt.value ? BRAND : TEXT_PRIMARY,
          }}
          data-testid={`option-${opt.value}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function LetterLivingStep({
  livingData,
  onChange,
  onNext,
  onSkip,
  t,
}: {
  livingData: LivingData;
  onChange: (d: Partial<LivingData>) => void;
  onNext: () => void;
  onSkip: () => void;
  t: (k: string, p?: Record<string, any>) => string;
}) {
  const livingOptions = [
    { value: "alone", label: t("onboardingFlow.letterLiving.livingOptions.alone") },
    { value: "partner", label: t("onboardingFlow.letterLiving.livingOptions.partner") },
    { value: "partner_kids", label: t("onboardingFlow.letterLiving.livingOptions.partner_kids") },
    { value: "kids", label: t("onboardingFlow.letterLiving.livingOptions.kids") },
    { value: "roommates", label: t("onboardingFlow.letterLiving.livingOptions.roommates") },
    { value: "family", label: t("onboardingFlow.letterLiving.livingOptions.family") },
    { value: "other", label: t("onboardingFlow.letterLiving.livingOptions.other") },
  ];
  const workOptions = [
    { value: "employed", label: t("onboardingFlow.letterLiving.workOptions.employed") },
    { value: "self_employed", label: t("onboardingFlow.letterLiving.workOptions.self_employed") },
    { value: "student", label: t("onboardingFlow.letterLiving.workOptions.student") },
    { value: "expat", label: t("onboardingFlow.letterLiving.workOptions.expat") },
    { value: "benefits", label: t("onboardingFlow.letterLiving.workOptions.benefits") },
    { value: "other", label: t("onboardingFlow.letterLiving.workOptions.other") },
  ];
  const moveOptions = [
    { value: "work_study", label: t("onboardingFlow.letterLiving.moveOptions.work_study") },
    { value: "first_together", label: t("onboardingFlow.letterLiving.moveOptions.first_together") },
    { value: "family_growth", label: t("onboardingFlow.letterLiving.moveOptions.family_growth") },
    { value: "breakup", label: t("onboardingFlow.letterLiving.moveOptions.breakup") },
    { value: "first_own", label: t("onboardingFlow.letterLiving.moveOptions.first_own") },
    { value: "bigger", label: t("onboardingFlow.letterLiving.moveOptions.bigger") },
    { value: "cheaper", label: t("onboardingFlow.letterLiving.moveOptions.cheaper") },
    { value: "new_area", label: t("onboardingFlow.letterLiving.moveOptions.new_area") },
    { value: "other", label: t("onboardingFlow.letterLiving.moveOptions.other") },
  ];

  const INPUT_CLS = "w-full h-[48px] px-4 rounded-[6px] border border-ha-card-border bg-ha-card text-[15px] text-ha-text placeholder:text-ha-text-secondary focus:outline-none focus:ring-2 focus:ring-orange-200";

  return (
    <>
      <h1 className="text-[24px] font-bold tracking-[-0.02em] mb-2" style={{ color: TEXT_PRIMARY }} data-testid="text-letter-living-title">
        {t("onboardingFlow.letterLiving.title")}
      </h1>
      <p className="text-[14px] mb-6" style={{ color: TEXT_SECONDARY }}>
        {t("onboardingFlow.letterLiving.subtitle")}
      </p>

      <div className="space-y-6 flex-1 overflow-y-auto">
        <div>
          <label className="text-[13px] font-medium text-ha-text-secondary mb-2 block">
            {t("onboardingFlow.letterLiving.livingWith")}
          </label>
          <OptionGrid
            options={livingOptions}
            selected={livingData.livingWith}
            onSelect={(v) => onChange({ livingWith: v })}
          />
        </div>

        <div>
          <label className="text-[13px] font-medium text-ha-text-secondary mb-2 block">
            {t("onboardingFlow.letterLiving.workStatus")}
          </label>
          <OptionGrid
            options={workOptions}
            selected={livingData.workStatus}
            onSelect={(v) => onChange({ workStatus: v })}
          />
        </div>

        <div>
          <label className="text-[13px] font-medium text-ha-text-secondary mb-2 block">
            {t("onboardingFlow.letterLiving.moveReason")}
          </label>
          <OptionGrid
            options={moveOptions}
            selected={livingData.moveReason}
            onSelect={(v) => onChange({ moveReason: v })}
          />
        </div>

        <div>
          <label className="text-[13px] font-medium text-ha-text-secondary mb-1.5 block">
            {t("onboardingFlow.letterLiving.income")}
          </label>
          <div className="relative">
            <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ha-text-muted" />
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={livingData.income}
              onChange={(e) => onChange({ income: e.target.value.replace(/\D/g, "") })}
              placeholder={t("onboardingFlow.letterLiving.incomePlaceholder")}
              className={INPUT_CLS + " pl-10"}
              data-testid="input-income"
            />
          </div>
        </div>

        <div>
          <label className="text-[13px] font-medium text-ha-text-secondary mb-1.5 block">
            {t("onboardingFlow.letterLiving.pets")}
          </label>
          <div className="flex gap-2">
            {["0", "1", "2", "3+"].map((val) => (
              <button
                key={val}
                onClick={() => onChange({ petsCount: val })}
                className="flex-1 h-[46px] rounded-[6px] border-2 text-[14px] font-medium transition-all active:scale-[0.97]"
                style={{
                  borderColor: livingData.petsCount === val ? BRAND : "rgb(var(--ha-card-border))",
                  backgroundColor: livingData.petsCount === val ? "rgba(249,115,22,0.06)" : "transparent",
                  color: livingData.petsCount === val ? BRAND : TEXT_PRIMARY,
                }}
                data-testid={`pets-${val}`}
              >
                {val}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-auto space-y-3 pt-6">
        <PrimaryBtn onClick={onNext} testId="button-living-next">
          {t("onboardingFlow.letterLiving.cta")}
        </PrimaryBtn>
        <SecondaryBtn onClick={onSkip} testId="button-living-skip">
          {t("onboardingFlow.letterLiving.skip")}
        </SecondaryBtn>
      </div>
    </>
  );
}

function LetterPreviewStep({
  letterText,
  onLetterChange,
  onNext,
  onBack,
  t,
}: {
  letterText: string;
  onLetterChange: (text: string) => void;
  onNext: () => void;
  onBack: () => void;
  t: (k: string, p?: Record<string, any>) => string;
}) {
  return (
    <>
      <h1 className="text-[24px] font-bold tracking-[-0.02em] mb-2" style={{ color: TEXT_PRIMARY }} data-testid="text-letter-preview-title">
        {t("onboardingFlow.letterPreview.title")}
      </h1>
      <p className="text-[14px] mb-4" style={{ color: TEXT_SECONDARY }}>
        {t("onboardingFlow.letterPreview.subtitle")}
      </p>

      <div className="bg-orange-50 border border-orange-200 rounded-[6px] px-4 py-3 mb-4 flex items-start gap-2.5">
        <FileText className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: BRAND }} />
        <p className="text-[13px] leading-snug" style={{ color: BRAND }}>
          {t("onboardingFlow.letterPreview.addressNote")}
        </p>
      </div>

      <textarea
        value={letterText}
        onChange={(e) => onLetterChange(e.target.value)}
        className="w-full flex-1 min-h-[280px] p-4 rounded-[6px] border border-ha-card-border bg-ha-card text-[14px] leading-[1.7] text-ha-text placeholder:text-ha-text-secondary focus:outline-none focus:ring-2 focus:ring-orange-200 resize-none"
        style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
        data-testid="textarea-letter"
      />

      <div className="mt-auto space-y-3 pt-4">
        <PrimaryBtn onClick={onNext} testId="button-letter-next">
          {t("onboardingFlow.letterPreview.cta")}
        </PrimaryBtn>
        <SecondaryBtn onClick={onBack} testId="button-letter-back">
          {t("onboardingFlow.letterPreview.back")}
        </SecondaryBtn>
      </div>
    </>
  );
}

function SearchBuddyStep({
  buddyEmail,
  onBuddyEmailChange,
  onInvite,
  onSkip,
  invited,
  loading,
  t,
}: {
  buddyEmail: string;
  onBuddyEmailChange: (e: string) => void;
  onInvite: () => void;
  onSkip: () => void;
  invited: boolean;
  loading: boolean;
  t: (k: string, p?: Record<string, any>) => string;
}) {
  return (
    <>
      <h1 className="text-[24px] font-bold tracking-[-0.02em] mb-2" style={{ color: TEXT_PRIMARY }} data-testid="text-buddy-title">
        {t("onboardingFlow.searchBuddy.title")}
      </h1>
      <p className="text-[14px] mb-6" style={{ color: TEXT_SECONDARY }}>
        {t("onboardingFlow.searchBuddy.subtitle")}
      </p>

      <div className="bg-ha-card rounded-[6px] border border-ha-card-border p-5 mb-6">
        <div className="pb-4 mb-4 border-b border-ha-card-border">
          <p className="text-[13px] font-semibold mb-2.5" style={{ color: "rgb(34,197,94)" }}>
            {t("onboardingFlow.searchBuddy.allowed")}
          </p>
          <div className="space-y-2.5">
            {[
              t("onboardingFlow.searchBuddy.canAlerts"),
              t("onboardingFlow.searchBuddy.canFavorite"),
              t("onboardingFlow.searchBuddy.canApply"),
            ].map((text, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span className="text-[13px]" style={{ color: TEXT_PRIMARY }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[13px] font-semibold mb-2.5 text-red-500">
            {t("onboardingFlow.searchBuddy.notAllowed")}
          </p>
          <div className="space-y-2.5">
            {[
              t("onboardingFlow.searchBuddy.cannotProfiles"),
              t("onboardingFlow.searchBuddy.cannotLetter"),
            ].map((text, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <X className="w-4 h-4 text-red-500 flex-shrink-0" />
                <span className="text-[13px]" style={{ color: TEXT_PRIMARY }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {invited ? (
        <div className="bg-green-50 border border-green-200 rounded-[6px] px-4 py-3.5 mb-6 flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
          <span className="text-[14px] font-medium text-green-700">{t("onboardingFlow.searchBuddy.invited")}</span>
        </div>
      ) : (
        <div className="flex gap-2 mb-6">
          <input
            type="email"
            inputMode="email"
            value={buddyEmail}
            onChange={(e) => onBuddyEmailChange(e.target.value)}
            placeholder={t("onboardingFlow.searchBuddy.emailPlaceholder")}
            className="flex-1 h-[48px] px-4 rounded-[6px] border border-ha-card-border bg-ha-card text-[14px] text-ha-text placeholder:text-ha-text-secondary focus:outline-none focus:ring-2 focus:ring-orange-200"
            data-testid="input-buddy-email"
          />
          <button
            onClick={onInvite}
            disabled={!buddyEmail.includes("@") || loading}
            className="h-[48px] px-5 rounded-[6px] text-[14px] font-semibold text-white transition-all active:scale-[0.97] disabled:opacity-50 flex items-center gap-1.5"
            style={{ backgroundColor: BRAND }}
            data-testid="button-buddy-invite"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 flex-shrink-0" />{t("onboardingFlow.searchBuddy.invite")}</>}
          </button>
        </div>
      )}

      <div className="mt-auto space-y-3">
        {invited ? (
          <PrimaryBtn onClick={onSkip} testId="button-buddy-continue">
            {t("onboardingFlow.next")}
          </PrimaryBtn>
        ) : (
          <SecondaryBtn onClick={onSkip} testId="button-buddy-skip">
            {t("onboardingFlow.searchBuddy.maybeLater")}
          </SecondaryBtn>
        )}
      </div>
    </>
  );
}

function PushTestStep({
  onNext,
  onEnable,
  pushState,
  t,
}: {
  onNext: () => void;
  onEnable: () => void;
  pushState: "idle" | "requesting" | "granted" | "denied";
  t: (k: string, p?: Record<string, any>) => string;
}) {
  return (
    <>
      <h1 className="text-[24px] font-bold tracking-[-0.02em] mb-2" style={{ color: TEXT_PRIMARY }} data-testid="text-push-title">
        {t("onboardingFlow.pushTest.title")}
      </h1>

      {pushState === "granted" ? (
        <>
          <p className="text-[14px] mb-6" style={{ color: TEXT_SECONDARY }}>
            {t("onboardingFlow.pushTest.subtitle")}
          </p>
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-5" style={{ backgroundColor: "rgba(34,197,94,0.1)" }}>
              <BellRing className="w-8 h-8 text-green-500" />
            </div>

            <div className="bg-green-50 border border-green-200 rounded-[6px] px-5 py-4 w-full flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[14px] font-semibold mb-0.5 text-green-800">
                  {t("onboardingFlow.pushTest.infoTitle")}
                </p>
                <p className="text-[13px] text-green-700 leading-snug">
                  {t("onboardingFlow.pushTest.infoText")}
                </p>
              </div>
            </div>
          </div>
        </>
      ) : pushState === "denied" ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-5 bg-red-50">
            <Bell className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-[14px] text-center mb-4 max-w-[320px] font-medium" style={{ color: TEXT_PRIMARY }}>
            {t("onboardingFlow.pushTest.denied")}
          </p>
          <p className="text-[13px] text-center max-w-[300px]" style={{ color: TEXT_SECONDARY }}>
            {t("onboardingFlow.pushTest.deniedHint")}
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-5" style={{ backgroundColor: "rgba(249,115,22,0.12)" }}>
            <Bell className="w-8 h-8" style={{ color: BRAND }} />
          </div>
          {pushState === "requesting" ? (
            <Loader2 className="w-6 h-6 animate-spin mb-4" style={{ color: BRAND }} />
          ) : (
            <p className="text-[14px] text-center max-w-[300px]" style={{ color: TEXT_SECONDARY }}>
              {t("onboardingFlow.pushTest.idleHint")}
            </p>
          )}
        </div>
      )}

      <div className="mt-auto space-y-3 pt-6">
        {pushState === "idle" ? (
          <>
            <PrimaryBtn onClick={onEnable} testId="button-push-enable">
              {t("onboardingFlow.pushTest.enablePush")}
            </PrimaryBtn>
            <SecondaryBtn onClick={onNext} testId="button-push-skip">
              {t("onboardingFlow.pushTest.cta")}
            </SecondaryBtn>
          </>
        ) : (
          <PrimaryBtn onClick={onNext} testId="button-push-next">
            {t("onboardingFlow.pushTest.cta")}
          </PrimaryBtn>
        )}
      </div>
    </>
  );
}

function SuccessStep({
  onFinish,
  t,
}: {
  onFinish: () => void;
  t: (k: string, p?: Record<string, any>) => string;
}) {
  const points = [
    { icon: Zap, text: t("onboardingFlow.success.point1") },
    { icon: ArrowRight, text: t("onboardingFlow.success.point2") },
    { icon: Star, text: t("onboardingFlow.success.point3") },
  ];

  return (
    <>
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 animate-scale-in" style={{ backgroundColor: "rgba(34,197,94,0.12)" }}>
          <CheckCircle2 className="w-10 h-10 text-green-500" />
        </div>
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em] mb-2" style={{ color: TEXT_PRIMARY }} data-testid="text-success-title">
          {t("onboardingFlow.success.title")}
        </h1>
        <p className="text-[15px] mb-8 max-w-[320px] leading-relaxed" style={{ color: TEXT_SECONDARY }}>
          {t("onboardingFlow.success.subtitle")}
        </p>

        <div className="w-full space-y-3">
          {points.map((p, i) => (
            <div key={i} className="flex items-center gap-4 bg-ha-card rounded-[6px] border border-ha-card-border px-5 py-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "rgba(34,197,94,0.1)" }}>
                <p.icon className="w-5 h-5 text-green-500" />
              </div>
              <span className="text-[14px] font-medium text-left" style={{ color: TEXT_PRIMARY }}>{p.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto pt-6">
        <PrimaryBtn onClick={onFinish} testId="button-success-finish">
          <span className="inline-flex items-center gap-2">
            {t("onboardingFlow.success.cta")}
            <ArrowRight className="w-5 h-5" />
          </span>
        </PrimaryBtn>
      </div>
    </>
  );
}

export function PostPaywallContinue() {
  return <OnboardingFlow initialStep="welcome" />;
}

export default function OnboardingFlow({ initialStep }: { initialStep?: FlowStep }) {
  const [, navigate] = useLocation();
  const { user, session } = useAuth();
  const { t, locale } = useTranslation();
  const { toast } = useToast();

  const [step, setStep] = useState<FlowStep>(initialStep || "location");
  const [saving, setSaving] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(!initialStep);
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

  const [personalData, setPersonalData] = useState<PersonalData>({
    phone: "",
    birthDay: "",
    birthMonth: "",
    birthYear: "",
    gender: "",
  });
  const [livingData, setLivingData] = useState<LivingData>({
    livingWith: "",
    workStatus: "",
    moveReason: "",
    income: "",
    petsCount: "0",
  });
  const [letterText, setLetterText] = useState("");
  const [buddyEmail, setBuddyEmail] = useState("");
  const [buddyInvited, setBuddyInvited] = useState(false);
  const [buddyLoading, setBuddyLoading] = useState(false);
  const [pushState, setPushState] = useState<"idle" | "requesting" | "granted" | "denied">("idle");

  useEffect(() => {
    if (!initialStep || !session?.access_token) {
      setProfileLoaded(true);
      return;
    }
    (async () => {
      try {
        const res = await apiFetch("/api/profile-data", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const d = await res.json();
          if (d.phone) setPersonalData((p) => ({ ...p, phone: d.phone }));
          if (d.birth_date) {
            const [y, m, day] = d.birth_date.split("-");
            setPersonalData((p) => ({ ...p, birthYear: y, birthMonth: String(parseInt(m)), birthDay: String(parseInt(day)) }));
          }
          if (d.gender) setPersonalData((p) => ({ ...p, gender: d.gender }));
          if (d.living_with) setLivingData((l) => ({ ...l, livingWith: d.living_with }));
          if (d.work_status) setLivingData((l) => ({ ...l, workStatus: d.work_status }));
          if (d.move_reason) setLivingData((l) => ({ ...l, moveReason: d.move_reason }));
          if (d.monthly_income) setLivingData((l) => ({ ...l, income: String(d.monthly_income) }));
          if (d.pets_count != null) setLivingData((l) => ({ ...l, petsCount: String(d.pets_count) }));
          if (d.application_template) setLetterText(d.application_template);
          if (d.search_buddy_email) {
            setBuddyEmail(d.search_buddy_email);
            setBuddyInvited(true);
          }
          if (d.push_test_completed) setPushState("granted");

          if (d.post_paywall_onboarding_completed) {
            navigate("/home");
            return;
          }

          const savedStep = d.onboarding_current_step;
          if (savedStep && POST_PAYWALL_STEPS.includes(savedStep as FlowStep)) {
            setStep(savedStep as FlowStep);
          }
        }
      } catch (err) {
        console.error("[ONBOARDING] Failed to load profile data", err);
      } finally {
        setProfileLoaded(true);
      }
    })();
  }, [initialStep, session?.access_token]);

  const updateData = useCallback((partial: Partial<SearchData>) => {
    setData((prev) => ({ ...prev, ...partial }));
  }, []);

  const updatePersonalData = useCallback((partial: Partial<PersonalData>) => {
    setPersonalData((prev) => ({ ...prev, ...partial }));
  }, []);

  const updateLivingData = useCallback((partial: Partial<LivingData>) => {
    setLivingData((prev) => ({ ...prev, ...partial }));
  }, []);

  function goStep(s: FlowStep) {
    setStep(s);
    window.scrollTo(0, 0);
    if (POST_PAYWALL_STEPS.includes(s)) {
      saveProfileField({ onboarding_current_step: s });
    }
  }

  function handleBack() {
    const preIdx = PRE_PAYWALL_STEPS.indexOf(step);
    if (preIdx > 0) {
      goStep(PRE_PAYWALL_STEPS[preIdx - 1]);
      return;
    }
    const postIdx = POST_PAYWALL_STEPS.indexOf(step);
    if (postIdx > 0) {
      goStep(POST_PAYWALL_STEPS[postIdx - 1]);
    }
  }

  function handleCitySelect(city: string, lat: number, lng: number) {
    updateData({ city, lat, lng });
    trackEvent("onboarding_city_selected", { city });
    goStep("radius");
  }

  async function saveProfileField(fields: Record<string, any>) {
    if (!session?.access_token) return;
    try {
      await apiFetch("/api/profile-data", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(fields),
      });
    } catch (err) {
      console.error("[ONBOARDING] Failed to save profile fields", err);
    }
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

      await saveProfileField({ onboarding_completed: true });

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

  function handleSkipPaywall() {
    trackEvent("onboarding_paywall_skipped");
    goStep("limited-access");
  }

  function handleLimitedContinue() {
    trackEvent("onboarding_limited_continue");
    goStep("welcome");
  }

  async function handleLetterPersonalNext() {
    trackEvent("onboarding_letter_personal_done");
    const birthDate = personalData.birthYear && personalData.birthMonth && personalData.birthDay
      ? `${personalData.birthYear}-${personalData.birthMonth.padStart(2, "0")}-${personalData.birthDay.padStart(2, "0")}`
      : undefined;

    const fields: Record<string, any> = {};
    if (personalData.phone) fields.phone = personalData.phone;
    if (birthDate) fields.birth_date = birthDate;
    if (personalData.gender) fields.gender = personalData.gender;
    if (Object.keys(fields).length > 0) await saveProfileField(fields);

    goStep("letter-living");
  }

  async function handleLetterLivingNext() {
    trackEvent("onboarding_letter_living_done");
    const fields: Record<string, any> = {};
    if (livingData.livingWith) fields.living_with = livingData.livingWith;
    if (livingData.workStatus) fields.work_status = livingData.workStatus;
    if (livingData.moveReason) fields.move_reason = livingData.moveReason;
    if (livingData.income) fields.monthly_income = parseInt(livingData.income) || undefined;
    if (livingData.petsCount) fields.pets_count = parseInt(livingData.petsCount) || 0;
    if (Object.keys(fields).length > 0) await saveProfileField(fields);

    const letterData: OnboardingLetterData = {
      firstName: user?.user_metadata?.first_name || user?.user_metadata?.full_name?.split(" ")[0],
      lastName: user?.user_metadata?.last_name || user?.user_metadata?.full_name?.split(" ").slice(1).join(" "),
      phone: personalData.phone || undefined,
      email: user?.email,
      gender: personalData.gender || undefined,
      livingWith: livingData.livingWith || undefined,
      workStatus: livingData.workStatus || undefined,
      moveReason: livingData.moveReason || undefined,
      grossIncome: parseInt(livingData.income) || undefined,
      petsCount: parseInt(livingData.petsCount) || 0,
    };
    const generated = generateOnboardingLetter(letterData, locale as any);
    setLetterText(generated);

    goStep("letter-preview");
  }

  async function handleLetterPreviewNext() {
    trackEvent("onboarding_letter_done");
    await saveProfileField({ application_template: letterText });
    goStep("search-buddy");
  }

  async function handleBuddyInvite() {
    if (!buddyEmail.includes("@")) return;
    setBuddyLoading(true);
    try {
      await saveProfileField({
        search_buddy_email: buddyEmail,
        search_buddy_enabled: true,
      });
      trackEvent("onboarding_buddy_invited", { email: buddyEmail });
      setBuddyInvited(true);
    } catch (err) {
      console.error("[ONBOARDING] buddy invite failed", err);
    } finally {
      setBuddyLoading(false);
    }
  }

  function handleBuddySkip() {
    trackEvent("onboarding_buddy_skipped");
    goStep("push-test");
  }

  async function handlePushEnable() {
    setPushState("requesting");
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        const vapidRes = await apiFetch("/api/push/vapid-key");
        if (!vapidRes.ok) throw new Error("No VAPID key");
        const { publicKey } = await vapidRes.json();

        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: publicKey,
        });

        const subJson = sub.toJSON();
        const token = session?.access_token;
        if (token && subJson.keys) {
          await apiFetch("/api/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              endpoint: subJson.endpoint,
              p256dh: subJson.keys.p256dh,
              auth: subJson.keys.auth,
            }),
          });
        }

        if (token) {
          apiFetch("/api/push/test-self", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => {});
        }

        await saveProfileField({ push_test_completed: true });
        setPushState("granted");
        trackEvent("onboarding_push_granted");
      } else {
        setPushState("denied");
        await saveProfileField({ push_test_completed: false });
        trackEvent("onboarding_push_denied");
      }
    } catch (err) {
      console.error("[ONBOARDING] push setup failed", err);
      setPushState("denied");
      saveProfileField({ push_test_completed: false });
    }
  }

  function handlePushNext() {
    goStep("success");
  }

  async function handleSuccessFinish() {
    trackEvent("onboarding_complete");
    await saveProfileField({
      post_paywall_onboarding_completed: true,
      onboarding_current_step: "done",
    });
    navigate("/home");
  }

  useEffect(() => {
    trackEvent("onboarding_flow_step", { step });
  }, [step]);

  if (!profileLoaded) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-ha-surface">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: BRAND }} />
      </div>
    );
  }

  const showBack = step !== "location" && step !== "limited-access" && step !== "welcome" && step !== "success";

  return (
    <FlowShell step={step} onBack={handleBack} showBack={showBack}>
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
      {step === "limited-access" && (
        <LimitedAccessStep
          onGoBack={() => goStep("paywall")}
          onContinue={handleLimitedContinue}
          t={t}
        />
      )}
      {step === "welcome" && (
        <WelcomeStep onNext={() => goStep("letter-personal")} t={t} />
      )}
      {step === "letter-personal" && (
        <LetterPersonalStep
          personalData={personalData}
          onChange={updatePersonalData}
          onNext={handleLetterPersonalNext}
          onSkip={() => goStep("letter-living")}
          t={t}
        />
      )}
      {step === "letter-living" && (
        <LetterLivingStep
          livingData={livingData}
          onChange={updateLivingData}
          onNext={handleLetterLivingNext}
          onSkip={() => { handleLetterLivingNext(); }}
          t={t}
        />
      )}
      {step === "letter-preview" && (
        <LetterPreviewStep
          letterText={letterText}
          onLetterChange={setLetterText}
          onNext={handleLetterPreviewNext}
          onBack={() => goStep("letter-living")}
          t={t}
        />
      )}
      {step === "search-buddy" && (
        <SearchBuddyStep
          buddyEmail={buddyEmail}
          onBuddyEmailChange={setBuddyEmail}
          onInvite={handleBuddyInvite}
          onSkip={handleBuddySkip}
          invited={buddyInvited}
          loading={buddyLoading}
          t={t}
        />
      )}
      {step === "push-test" && (
        <PushTestStep
          onNext={handlePushNext}
          onEnable={handlePushEnable}
          pushState={pushState}
          t={t}
        />
      )}
      {step === "success" && (
        <SuccessStep onFinish={handleSuccessFinish} t={t} />
      )}
    </FlowShell>
  );
}
