import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";
import { useGeocoderSearch } from "@/hooks/use-geocoder-search";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api-base";
import { clearAllUserData, queryClient } from "@/lib/queryClient";
import { createSearchProfile } from "@/lib/search-profiles";
import { validatePassword, isPasswordValid } from "@/lib/password-validation";
import { PasswordRules } from "@/components/password-rules";
import MapView from "@/components/map-view";
import { defaultCities, cityDistricts } from "../../../config/market";
import {
  matchEstimateQueryKey,
  fetchMatchEstimate,
  type MatchEstimateResult,
  type NormalizedFilters,
} from "@/lib/match-estimate";
import { OBW } from "@/components/onboarding-ui";
import {
  MapPin, ChevronLeft, ChevronRight, ChevronDown,
  Check, X, Eye, EyeOff, Loader2, Search,
  Bath, Sun, Trees, Leaf,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type EmbedStep = 1 | 2 | 3 | 4;
type LocationMode = "districts" | "radius" | "city";

interface CityData { name: string; lat: number; lng: number; }

interface LocationData {
  mode: LocationMode;
  selectedDistricts: string[];
  radiusKm: number;
}

interface FiltersData {
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

const INIT_FILTERS: FiltersData = {
  minPrice: 0, maxPrice: 1500, priceFlexible: false,
  propertyType: "any", includeRooms: false,
  minRooms: "any", minSize: 30, sizeNA: false,
  furnished: "any", amenities: [], sendUnclear: true,
};

const AMENITY_OPTIONS = [
  { value: "bath",     labelKey: "amenities.bath",     fallback: "Bad",             Icon: Bath  },
  { value: "balcony",  labelKey: "amenities.balcony",  fallback: "Balkon",          Icon: Sun   },
  { value: "garden",   labelKey: "amenities.garden",   fallback: "Garten",          Icon: Trees },
  { value: "energy_c", labelKey: "amenities.energyC",  fallback: "Energieklasse C+", Icon: Leaf  },
];

const TOP_CITIES = defaultCities.slice(0, 6);

function isValidEmail(e: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

// ─── Inline sub-components ───────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[14px] font-semibold mb-2.5 block" style={{ color: OBW.text }}>
      {children}
    </label>
  );
}

function Divider() {
  return <div className="h-px" style={{ backgroundColor: "rgb(var(--ha-divider))" }} />;
}

function Toggle({ checked, onChange, label, testId }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; testId: string;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer" data-testid={testId}>
      <div className="w-[44px] h-[24px] rounded-full p-[2px] transition-colors shrink-0"
        style={{ backgroundColor: checked ? "rgb(var(--ha-primary))" : "rgb(var(--ha-card-border))" }}
        onClick={() => onChange(!checked)}>
        <div className="w-[20px] h-[20px] rounded-full bg-white transition-transform shadow-sm"
          style={{ transform: checked ? "translateX(20px)" : "translateX(0)" }} />
      </div>
      <span className="text-[13px] leading-snug" style={{ color: OBW.text }}>{label}</span>
    </label>
  );
}

function DualRangeSlider({ min, max, step, valueLow, valueHigh, onChangeLow, onChangeHigh, formatLabel, testId }: {
  min: number; max: number; step: number;
  valueLow: number; valueHigh: number;
  onChangeLow: (v: number) => void; onChangeHigh: (v: number) => void;
  formatLabel: (v: number) => string; testId: string;
}) {
  const pL = ((valueLow - min) / (max - min)) * 100;
  const pH = ((valueHigh - min) / (max - min)) * 100;
  const pri = "rgb(var(--ha-primary))";
  const inact = "rgb(var(--ha-card-border))";
  const bg = `linear-gradient(to right,${inact} 0%,${inact} ${pL}%,${pri} ${pL}%,${pri} ${pH}%,${inact} ${pH}%,${inact} 100%)`;
  return (
    <div data-testid={testId}>
      <div className="flex justify-between mb-2">
        <span className="text-[14px] font-semibold" style={{ color: OBW.text }}>{formatLabel(valueLow)}</span>
        <span className="text-[14px] font-semibold" style={{ color: OBW.text }}>{formatLabel(valueHigh)}</span>
      </div>
      <div className="relative h-[36px]">
        <input type="range" min={min} max={max} step={step} value={valueLow}
          onChange={(e) => { const v = Number(e.target.value); if (v <= valueHigh) onChangeLow(v); }}
          className="w-full absolute inset-0 dual-range-thumb"
          style={{ background: bg, zIndex: valueLow > max - step ? 3 : 1 }}
          data-testid="slider-min-price" />
        <input type="range" min={min} max={max} step={step} value={valueHigh}
          onChange={(e) => { const v = Number(e.target.value); if (v >= valueLow) onChangeHigh(v); }}
          className="w-full absolute inset-0 dual-range-thumb"
          style={{ background: "transparent", zIndex: 2 }}
          data-testid="slider-max-price" />
      </div>
    </div>
  );
}

// ─── Shared step header ───────────────────────────────────────────────────────

function EmbedHeader({ step, title }: { step: EmbedStep; title: string }) {
  return (
    <header className="sticky top-0 z-20 shrink-0"
      style={{ backgroundColor: "rgb(var(--ha-card))", borderBottom: `1px solid ${OBW.headerBorder}` }}>
      <div className="relative max-w-[480px] mx-auto px-4 h-[56px] flex items-center justify-between">
        <span className="text-[13px] font-bold rounded-[8px] shrink-0 flex items-center px-3"
          style={{ height: "30px", backgroundColor: "rgb(var(--ha-primary))", color: "white" }}
          data-testid="badge-embed-step">
          {step}/4
        </span>
        <span className="absolute inset-0 flex items-center justify-center text-[17px] font-bold pointer-events-none"
          style={{ color: OBW.text }}>
          {title}
        </span>
        {/* Progress bar row */}
      </div>
      <div className="mx-4 h-[3px] rounded-full overflow-hidden" style={{ backgroundColor: "rgb(var(--ha-divider))" }}>
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${(step / 4) * 100}%`, backgroundColor: "rgb(var(--ha-primary))" }} />
      </div>
    </header>
  );
}

// ─── Shared sticky footer ─────────────────────────────────────────────────────

function EmbedFooter({
  matchCount, fetching, onBack, onNext, nextLabel, nextDisabled, loading, showMatch,
}: {
  matchCount?: number | null; fetching?: boolean;
  onBack: () => void; onNext: () => void;
  nextLabel: string; nextDisabled?: boolean; loading?: boolean; showMatch?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="sticky bottom-0 shrink-0 z-20"
      style={{
        borderTop: `1px solid ${OBW.footerBorder}`,
        backgroundColor: OBW.footerBg,
        paddingBottom: "max(8px, env(safe-area-inset-bottom, 8px))",
      }}>
      <div className="max-w-[480px] mx-auto px-4 py-3 flex items-center gap-3">
        {showMatch && (
          <div className="flex-1 min-w-0">
            <p className="text-[10.5px] font-medium leading-tight" style={{ color: OBW.textMuted }}>
              {t("onboarding.location.estimatedMatches")}
            </p>
            <p className="text-[15px] font-semibold leading-snug" style={{ color: OBW.text }}>
              {fetching
                ? <span style={{ color: OBW.textMuted }}>…</span>
                : matchCount != null
                  ? <>{Math.max(1, matchCount)} {t("onboardingUI.perWeek")}{Math.max(1, matchCount) > 10 ? " 🔥" : ""}</>
                  : <span style={{ color: OBW.textMuted }}>—</span>
              }
            </p>
          </div>
        )}
        {!showMatch && <div className="flex-1" />}

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={onBack}
            className="w-[44px] h-[44px] rounded-[6px] flex items-center justify-center active:scale-95 transition-transform"
            style={{ border: `1.5px solid ${OBW.backBtnBorder}`, backgroundColor: OBW.backBtnBg }}
            data-testid="button-embed-back">
            <ChevronLeft className="w-[18px] h-[18px]" style={{ color: OBW.backBtnColor }} />
          </button>
          <button
            onClick={onNext}
            disabled={nextDisabled || loading}
            className="h-[44px] px-6 rounded-[8px] text-[15px] font-semibold text-white flex items-center justify-center gap-1.5 active:scale-[0.97] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "rgb(var(--ha-primary))", boxShadow: "0 4px 14px rgba(37,60,150,0.2)" }}
            data-testid="button-embed-next">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {!loading && nextLabel}
            {!loading && <ChevronRight className="w-[16px] h-[16px]" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OnboardingEmbedPage() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const { toast } = useToast();

  // Step
  const [step, setStep] = useState<EmbedStep>(1);

  // Step 1: City
  const [city, setCity] = useState<CityData | null>(null);
  const [searchText, setSearchText] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const geocoder = useGeocoderSearch({ debounceMs: 250, minChars: 2, limit: 5 });

  // Step 2: Location
  const districtList = city ? (cityDistricts[city.name] || []) : [];
  const hasDistricts = districtList.length > 0;
  const [locationData, setLocationData] = useState<LocationData>({
    mode: "city",
    selectedDistricts: [],
    radiusKm: 5,
  });
  const [showDistrictPicker, setShowDistrictPicker] = useState(false);

  // Reset location mode when city changes
  useEffect(() => {
    if (city) {
      const dl = cityDistricts[city.name] || [];
      setLocationData({ mode: dl.length > 0 ? "districts" : "city", selectedDistricts: [], radiusKm: 5 });
    }
  }, [city?.name]);

  // Step 3: Filters
  const [filters, setFilters] = useState<FiltersData>(INIT_FILTERS);

  // Debounced values for queries
  const [debouncedLocation, setDebouncedLocation] = useState<LocationData>(locationData);
  const [debouncedFilters, setDebouncedFilters] = useState<FiltersData>(INIT_FILTERS);
  const locDebRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filDebRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (locDebRef.current) clearTimeout(locDebRef.current);
    locDebRef.current = setTimeout(() => setDebouncedLocation(locationData), 600);
    return () => { if (locDebRef.current) clearTimeout(locDebRef.current); };
  }, [locationData]);
  useEffect(() => {
    if (filDebRef.current) clearTimeout(filDebRef.current);
    filDebRef.current = setTimeout(() => setDebouncedFilters(filters), 600);
    return () => { if (filDebRef.current) clearTimeout(filDebRef.current); };
  }, [filters]);

  // Match estimate for step 2 (location)
  const locEstFilters: NormalizedFilters = {
    city: city?.name ?? "",
    location_mode:
      debouncedLocation.mode === "radius" ? "radius"
      : debouncedLocation.mode === "districts" && debouncedLocation.selectedDistricts.length > 0 ? "districts"
      : "city",
    latitude: city?.lat ?? 0,
    longitude: city?.lng ?? 0,
    radius_km: debouncedLocation.mode === "radius" ? debouncedLocation.radiusKm : undefined,
    districts: debouncedLocation.mode === "districts" && debouncedLocation.selectedDistricts.length > 0
      ? debouncedLocation.selectedDistricts : undefined,
    price_min: 0, price_max: 0, bedrooms_min: 0, size_min: 0,
    send_unclear: true, price_flexible: false,
  };
  const { data: locEstimate, isFetching: locFetching } = useQuery<MatchEstimateResult>({
    queryKey: matchEstimateQueryKey(locEstFilters),
    queryFn: () => fetchMatchEstimate(locEstFilters),
    enabled: !!city && step === 2,
    staleTime: 2 * 60 * 1000,
  });

  // Match estimate for step 3 + 4 (filters)
  const filEstFilters: NormalizedFilters = {
    city: city?.name ?? "",
    latitude: city?.lat ?? 0,
    longitude: city?.lng ?? 0,
    location_mode:
      locationData.mode === "radius" ? "radius"
      : locationData.mode === "districts" && locationData.selectedDistricts.length > 0 ? "districts"
      : "city",
    radius_km: locationData.mode === "radius" ? locationData.radiusKm : undefined,
    districts: locationData.mode === "districts" && locationData.selectedDistricts.length > 0
      ? locationData.selectedDistricts : undefined,
    price_min: debouncedFilters.minPrice,
    price_max: debouncedFilters.maxPrice,
    bedrooms_min: debouncedFilters.minRooms === "any" ? 0 : parseInt(debouncedFilters.minRooms, 10),
    size_min: debouncedFilters.sizeNA ? 0 : debouncedFilters.minSize,
    furnished: debouncedFilters.furnished !== "any" ? debouncedFilters.furnished : undefined,
    property_types: debouncedFilters.propertyType !== "any" ? [debouncedFilters.propertyType] : undefined,
    extra_features: debouncedFilters.amenities.length > 0 ? debouncedFilters.amenities : undefined,
    send_unclear: debouncedFilters.sendUnclear,
    price_flexible: debouncedFilters.priceFlexible,
    include_rooms: debouncedFilters.includeRooms,
  };
  const { data: filEstimate, isFetching: filFetching } = useQuery<MatchEstimateResult>({
    queryKey: matchEstimateQueryKey(filEstFilters),
    queryFn: () => fetchMatchEstimate(filEstFilters),
    enabled: !!city && (step === 3 || step === 4),
    staleTime: 2 * 60 * 1000,
  });

  // Step 4: Account
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  const pwStrength = validatePassword(password);
  const passwordOk = isPasswordValid(pwStrength);
  const confirmOk = confirmPassword.length > 0 && password === confirmPassword;
  const canSubmit = firstName.trim() !== "" && isValidEmail(email) && passwordOk && confirmOk && !loading;

  // Pre-fill city from ?city= query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cp = params.get("city");
    if (!cp) return;
    const match = defaultCities.find((c) => c.name.toLowerCase() === cp.toLowerCase());
    if (match) { setCity(match); setSearchText(match.name); }
  }, []);

  // Click-outside for city dropdown
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) setDropdownOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Location mode tabs
  const locationTabs: { value: LocationMode; label: string }[] = [
    ...(hasDistricts ? [{ value: "districts" as LocationMode, label: t("onboarding.location.neighborhoodsTab") }] : []),
    { value: "radius" as LocationMode, label: t("onboarding.location.radiusTab") },
    { value: "city" as LocationMode, label: t("onboarding.location.wholePlaceTab") },
  ];

  const districtCount = locationData.selectedDistricts.length;
  const districtSummary = districtCount === 0 || districtCount === districtList.length
    ? t("onboarding.location.allNeighborhoodsSelected")
    : districtCount === 1
      ? t("onboarding.location.neighborhoodsSelected").replace("{n}", "1")
      : t("onboarding.location.neighborhoodsPluralSelected").replace("{n}", String(districtCount));

  function toggleDistrict(d: string) {
    setLocationData((prev) => ({
      ...prev,
      selectedDistricts: prev.selectedDistricts.includes(d)
        ? prev.selectedDistricts.filter((x) => x !== d)
        : [...prev.selectedDistricts, d],
    }));
  }

  function updateFilters(partial: Partial<FiltersData>) {
    setFilters((prev) => ({ ...prev, ...partial }));
  }

  function toggleAmenity(a: string) {
    setFilters((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(a)
        ? prev.amenities.filter((x) => x !== a)
        : [...prev.amenities, a],
    }));
  }

  // City search helpers
  const filteredTopCities = searchText.trim().length > 0
    ? TOP_CITIES.filter((c) => c.name.toLowerCase().includes(searchText.toLowerCase()))
    : TOP_CITIES;
  const showGeoResults = searchText.trim().length >= 2 && geocoder.results.length > 0;
  const showTopCities = !showGeoResults && filteredTopCities.length > 0;
  const showDropdown = dropdownOpen && !city && (showGeoResults || showTopCities || geocoder.loading);

  function handleSearchChange(val: string) {
    setSearchText(val); setCity(null); setDropdownOpen(true); geocoder.search(val);
  }
  function handleSelectCity(c: CityData) {
    setCity(c); setSearchText(c.name); setDropdownOpen(false); geocoder.clear();
  }
  function handleClearCity() {
    setCity(null); setSearchText(""); setDropdownOpen(false); geocoder.clear();
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  // Account creation
  async function handleCreateAccount() {
    if (!canSubmit || !city) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);

    const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
    clearAllUserData();

    try {
      const res = await apiFetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, fullName }),
      });
      const result = await res.json();
      if (!res.ok) {
        const msg = result.error === "user_exists"
          ? t("common.authAccountExists")
          : (result.message || result.error || t("auth.signup.failed"));
        toast({ title: t("auth.signup.failed"), description: msg, variant: "destructive" });
        setLoading(false); submittingRef.current = false; return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        toast({ title: t("common.error"), description: signInError.message, variant: "destructive" });
        setLoading(false); submittingRef.current = false; return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;

      import("@/lib/track-event").then(({ trackEvent }) => { trackEvent("account_created"); }).catch(() => {});

      if (userId && city) {
        try {
          await createSearchProfile({
            user_id: userId,
            city_name: city.name,
            country_code: "DE",
            latitude: city.lat,
            longitude: city.lng,
            place_id: city.name.toLowerCase().replace(/\s+/g, "_") + "_de",
            price_min: filters.minPrice,
            price_max: filters.maxPrice,
            bedrooms_min: filters.minRooms === "any" ? 0 : parseInt(filters.minRooms, 10),
            size_min: filters.sizeNA ? 0 : filters.minSize,
            location_mode: locationData.mode as any,
            districts: locationData.mode === "districts" && locationData.selectedDistricts.length > 0
              ? locationData.selectedDistricts : undefined,
            radius_km: locationData.mode === "radius" ? locationData.radiusKm : undefined,
            furnished: filters.furnished !== "any" ? filters.furnished : undefined,
            property_types: filters.propertyType !== "any" ? [filters.propertyType] : undefined,
            extra_features: filters.amenities.length > 0 ? filters.amenities : undefined,
            send_unclear: filters.sendUnclear,
            price_flexible: filters.priceFlexible,
          });
        } catch (err) {
          console.error("[OnboardingEmbed] Failed to save search profile:", err);
        }
      }

      if (sessionData?.session?.access_token) {
        try {
          await apiFetch("/api/profile-data", {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${sessionData.session.access_token}`,
            },
            body: JSON.stringify({ onboarding_completed: true }),
          });
        } catch (err) {
          console.error("[OnboardingEmbed] Failed to set onboarding_completed:", err);
        }
      }

      navigate("/onboarding/setup");
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    } finally {
      setLoading(false); submittingRef.current = false;
    }
  }

  // Chip selector helper
  const chipRow = (opts: { value: string; label: string }[], current: string, onChange: (v: string) => void, testId: string) => (
    <div className="flex items-center gap-[4px] p-[4px] rounded-full" style={{ backgroundColor: "rgb(var(--ha-toggle-bg))" }} data-testid={testId}>
      {opts.map((o) => {
        const active = current === o.value;
        return (
          <button key={o.value} onClick={() => onChange(o.value)}
            className="flex-1 py-[8px] text-[12px] font-semibold rounded-full text-center transition-all whitespace-nowrap overflow-hidden"
            style={{ backgroundColor: active ? "rgb(var(--ha-primary))" : "transparent", color: active ? "white" : "rgb(var(--ha-text))" }}
            data-testid={`${testId}-${o.value}`}>
            {o.label}
          </button>
        );
      })}
    </div>
  );

  const ROOM_OPTIONS = [
    { value: "any", label: t("onboarding.filters.doesntMatter") },
    { value: "1", label: "1+" }, { value: "2", label: "2+" },
    { value: "3", label: "3+" }, { value: "4", label: "4+" }, { value: "5", label: "5+" },
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

  const HEADER_TITLE = "Zoekopdracht maken";
  const missed30 = filEstimate?.matchesLast30Days ?? null;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col" style={{ minHeight: "100dvh", backgroundColor: "rgb(var(--ha-card))" }}
      data-testid="onboarding-embed">

      <EmbedHeader step={step} title={step === 4 ? "Account aanmaken" : HEADER_TITLE} />

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[480px] mx-auto px-4 pt-5 pb-[120px]">

          {/* ── STEP 1: CITY ──────────────────────────────────────────────── */}
          {step === 1 && (
            <div data-testid="embed-step-city">
              <p className="text-[15px] font-medium mb-5" style={{ color: OBW.textSecondary }}>
                In welke stad zoek je een woning?
              </p>

              {/* Search input */}
              <div className="relative mb-4" data-testid="city-search-container">
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[17px] h-[17px] pointer-events-none"
                    style={{ color: city ? "rgb(var(--ha-primary))" : "rgb(var(--ha-text-placeholder))" }} />
                  <input ref={inputRef} type="text" value={searchText}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onFocus={() => setDropdownOpen(true)}
                    placeholder="Zoek een stad..."
                    className="w-full h-[48px] rounded-[10px] border pl-10 pr-10 text-[15px] font-medium outline-none transition-all"
                    style={{
                      borderColor: "rgb(var(--ha-card-border))",
                      backgroundColor: city ? "var(--ha-primary-light)" : "rgb(var(--ha-surface))",
                      color: "rgb(var(--ha-text))",
                    }}
                    data-testid="input-city-search" />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                    {geocoder.loading && !city
                      ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: "rgb(var(--ha-text-placeholder))" }} />
                      : city || searchText.length > 0
                        ? <button onClick={handleClearCity} className="w-5 h-5 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: "rgb(var(--ha-card-border))" }} data-testid="button-clear-city">
                            <X className="w-3 h-3" style={{ color: "rgb(var(--ha-text-muted))" }} />
                          </button>
                        : <Search className="w-4 h-4" style={{ color: "rgb(var(--ha-text-placeholder))" }} />
                    }
                  </div>
                </div>

                {/* Dropdown */}
                {showDropdown && (
                  <div ref={dropdownRef}
                    className="absolute left-0 right-0 top-[52px] z-50 rounded-[10px] border overflow-hidden shadow-lg"
                    style={{ borderColor: "rgb(var(--ha-card-border))", backgroundColor: "rgb(var(--ha-card))" }}
                    data-testid="city-dropdown">
                    {geocoder.loading && (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-4 h-4 animate-spin" style={{ color: "rgb(var(--ha-text-placeholder))" }} />
                      </div>
                    )}
                    {showGeoResults && (geocoder.results as any[]).map((r, i) => (
                      <button key={i} onClick={() => handleSelectCity({ name: r.city, lat: r.lat ?? 0, lng: r.lng ?? 0 })}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-ha-surface transition-colors text-left"
                        style={{ borderBottom: i < geocoder.results.length - 1 ? "1px solid rgb(var(--ha-surface))" : "none" }}
                        data-testid={`city-result-${i}`}>
                        <MapPin className="w-4 h-4 shrink-0" style={{ color: "rgb(var(--ha-primary))", opacity: 0.7 }} />
                        <span className="text-[14px] font-semibold" style={{ color: "rgb(var(--ha-text))" }}>{r.city}</span>
                      </button>
                    ))}
                    {showTopCities && filteredTopCities.map((c, i) => (
                      <button key={c.name} onClick={() => handleSelectCity(c)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-ha-surface transition-colors text-left"
                        style={{ borderBottom: i < filteredTopCities.length - 1 ? "1px solid rgb(var(--ha-surface))" : "none" }}
                        data-testid={`city-suggestion-${c.name.toLowerCase()}`}>
                        <MapPin className="w-4 h-4 shrink-0" style={{ color: "rgb(var(--ha-primary))", opacity: 0.7 }} />
                        <span className="text-[14px] font-semibold" style={{ color: "rgb(var(--ha-text))" }}>{c.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Top cities list */}
              {!searchText.trim() && (
                <div className="rounded-[10px] border overflow-hidden" style={{ borderColor: "rgb(var(--ha-card-border))" }}>
                  {TOP_CITIES.map((c, i) => (
                    <button key={c.name} onClick={() => handleSelectCity(c)}
                      className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-ha-surface transition-colors text-left"
                      style={{
                        borderBottom: i < TOP_CITIES.length - 1 ? "1px solid rgb(var(--ha-card-border))" : "none",
                        backgroundColor: city?.name === c.name ? "rgb(var(--ha-primary-light))" : undefined,
                      }}
                      data-testid={`city-option-${c.name.toLowerCase()}`}>
                      <div className="flex items-center gap-3">
                        <MapPin className="w-4 h-4 shrink-0" style={{ color: "rgb(var(--ha-primary))", opacity: 0.7 }} />
                        <span className="text-[15px] font-semibold" style={{ color: "rgb(var(--ha-text))" }}>{c.name}</span>
                      </div>
                      {city?.name === c.name
                        ? <Check className="w-4 h-4" style={{ color: "rgb(var(--ha-primary))" }} />
                        : <ChevronRight className="w-4 h-4" style={{ color: "rgb(var(--ha-text-placeholder))" }} />
                      }
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2: LOCATION ──────────────────────────────────────────── */}
          {step === 2 && city && (
            <div data-testid="embed-step-location">
              {/* City display (click → back to step 1) */}
              <SectionLabel>{t("onboarding.location.cityLabel")}</SectionLabel>
              <button onClick={() => setStep(1)}
                className="w-full flex items-center gap-3 mb-5 ha-field-web text-left"
                style={{ backgroundColor: OBW.inputBg, borderColor: "rgb(var(--ha-border-input))", color: OBW.text }}
                data-testid="field-city-display">
                <MapPin className="w-[17px] h-[17px] shrink-0" style={{ color: "rgb(var(--ha-primary))" }} />
                <span className="flex-1 text-[16px] font-medium" style={{ color: OBW.text }}>{city.name}</span>
                <X className="w-[15px] h-[15px] shrink-0" style={{ color: OBW.textMuted }} />
              </button>

              {/* Location mode tabs */}
              <div className="flex items-center gap-1 p-[4px] rounded-full mb-5"
                style={{ backgroundColor: "rgb(var(--ha-toggle-bg))" }} data-testid="location-tabs">
                {locationTabs.map((tab) => {
                  const active = locationData.mode === tab.value;
                  return (
                    <button key={tab.value} onClick={() => setLocationData((p) => ({ ...p, mode: tab.value }))}
                      className="flex-1 py-[8px] text-[12px] font-semibold rounded-full text-center transition-all whitespace-nowrap overflow-hidden"
                      style={{ backgroundColor: active ? "rgb(var(--ha-primary))" : "transparent", color: active ? "white" : "rgb(var(--ha-text))" }}
                      data-testid={`tab-location-${tab.value}`}>
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Buurten (districts) */}
              {locationData.mode === "districts" && (
                <div data-testid="section-districts">
                  <button onClick={() => setShowDistrictPicker(!showDistrictPicker)}
                    className="w-full flex items-center justify-between ha-field-web text-left mb-4"
                    style={{ backgroundColor: OBW.inputBg, borderColor: "rgb(var(--ha-border-input))" }}
                    data-testid="dropdown-districts">
                    <span className="text-[15px] font-medium" style={{ color: OBW.text }}>{districtSummary}</span>
                    <ChevronDown className="w-[17px] h-[17px] shrink-0 transition-transform duration-200"
                      style={{ color: OBW.textMuted, transform: showDistrictPicker ? "rotate(180deg)" : "none" }} />
                  </button>
                  {showDistrictPicker && districtList.length > 0 && (
                    <div className="rounded-[12px] overflow-hidden border mb-4"
                      style={{ borderColor: "rgb(var(--ha-divider))", maxHeight: "180px", overflowY: "auto" }}
                      data-testid="district-list">
                      {districtList.map((d, i) => {
                        const active = locationData.selectedDistricts.includes(d);
                        return (
                          <button key={d} onClick={() => toggleDistrict(d)}
                            className="w-full flex items-center justify-between hover:bg-ha-hover-bg transition-colors"
                            style={{ padding: "11px 16px", borderBottom: i < districtList.length - 1 ? "1px solid rgb(var(--ha-divider))" : "none" }}
                            data-testid={`district-${d}`}>
                            <span className="text-[14px] font-medium" style={{ color: active ? OBW.text : OBW.textSecondary }}>{d}</span>
                            {active && <Check className="w-4 h-4" style={{ color: "rgb(var(--ha-primary))" }} />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div style={{ aspectRatio: "1/1" }} className="rounded-[12px] overflow-hidden w-full">
                    <MapView lat={city.lat} lng={city.lng} zoom={13}
                      markers={[{ lat: city.lat, lng: city.lng, type: "primary" }]}
                      circles={[{ lat: city.lat, lng: city.lng, radiusMeters: 1500 }]}
                      height="100%" className="" />
                  </div>
                </div>
              )}

              {/* Straal (radius) */}
              {locationData.mode === "radius" && (
                <div data-testid="section-radius">
                  <style>{`
                    .embed-radius-slider{-webkit-appearance:none;appearance:none;background:transparent;cursor:pointer;width:100%;height:4px}
                    .embed-radius-slider::-webkit-slider-runnable-track{background:linear-gradient(to right,rgb(var(--ha-primary)) 0%,rgb(var(--ha-primary)) var(--sl-pct,0%),rgb(var(--ha-card-border)) var(--sl-pct,0%),rgb(var(--ha-card-border)) 100%);border-radius:9999px;height:4px}
                    .embed-radius-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:22px;height:22px;border-radius:50%;background:white;box-shadow:0 1px 6px rgba(0,0,0,0.18),0 0 0 1.5px rgba(0,0,0,0.07);margin-top:-9px;cursor:pointer}
                    .embed-radius-slider::-moz-range-track{background:rgb(var(--ha-card-border));border-radius:9999px;height:4px}
                    .embed-radius-slider::-moz-range-thumb{width:22px;height:22px;border-radius:50%;background:white;box-shadow:0 1px 6px rgba(0,0,0,0.18);border:none;cursor:pointer}
                  `}</style>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[14px] font-semibold" style={{ color: OBW.textSecondary }}>
                      {t("onboarding.location.distanceLabel")}
                    </span>
                    <span className="text-[13px] font-medium" style={{ color: OBW.textMuted }}>{city.name}</span>
                  </div>
                  <div className="flex items-center gap-3 mb-5">
                    <input type="range" min={1} max={50} step={1}
                      value={locationData.radiusKm}
                      onChange={(e) => setLocationData((p) => ({ ...p, radiusKm: parseInt(e.target.value) }))}
                      className="embed-radius-slider flex-1"
                      style={{ "--sl-pct": `${((locationData.radiusKm - 1) / 49) * 100}%` } as React.CSSProperties}
                      data-testid="slider-radius" />
                    <span className="text-[15px] font-semibold shrink-0 w-[52px] text-right"
                      style={{ color: "rgb(var(--ha-primary))" }}>
                      {locationData.radiusKm} km
                    </span>
                  </div>
                  <div style={{ aspectRatio: "1/1" }} className="rounded-[12px] overflow-hidden w-full">
                    <MapView lat={city.lat} lng={city.lng} zoom={10}
                      markers={[{ lat: city.lat, lng: city.lng, type: "primary" }]}
                      circles={[{ lat: city.lat, lng: city.lng, radiusMeters: locationData.radiusKm * 1000 }]}
                      height="100%" className="" />
                  </div>
                </div>
              )}

              {/* Gehele woonplaats */}
              {locationData.mode === "city" && (
                <div data-testid="section-city">
                  <div style={{ aspectRatio: "1/1" }} className="rounded-[12px] overflow-hidden w-full">
                    <MapView lat={city.lat} lng={city.lng} zoom={10}
                      markers={[{ lat: city.lat, lng: city.lng, type: "primary" }]}
                      height="100%" className="" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: FILTERS ───────────────────────────────────────────── */}
          {step === 3 && (
            <div className="flex flex-col gap-5" data-testid="embed-step-filters">
              <section>
                <SectionLabel>{t("onboarding.filters.rentLabel")}</SectionLabel>
                <DualRangeSlider
                  min={0} max={3000} step={50}
                  valueLow={filters.minPrice} valueHigh={filters.maxPrice}
                  onChangeLow={(v) => updateFilters({ minPrice: v })}
                  onChangeHigh={(v) => updateFilters({ maxPrice: v })}
                  formatLabel={(v) => `€${v}`} testId="slider-rent-price" />
                <div className="mt-3">
                  <Toggle checked={filters.priceFlexible} onChange={(v) => updateFilters({ priceFlexible: v })}
                    label={t("onboarding.filters.priceFlexible")} testId="toggle-price-flexible" />
                </div>
              </section>

              <Divider />

              <section>
                <SectionLabel>{t("onboarding.filters.propertyTypeLabel")}</SectionLabel>
                {chipRow(PROPERTY_OPTIONS, filters.propertyType, (v) => updateFilters({ propertyType: v }), "property-type")}
                <div className="mt-3">
                  <Toggle checked={filters.includeRooms} onChange={(v) => updateFilters({ includeRooms: v })}
                    label={t("onboarding.filters.includeRooms")} testId="toggle-include-rooms" />
                </div>
              </section>

              <Divider />

              <section>
                <SectionLabel>{t("onboarding.filters.bedroomsLabel")}</SectionLabel>
                <div className="flex gap-2 overflow-x-auto no-scrollbar" data-testid="rooms-selector">
                  {ROOM_OPTIONS.map((opt) => {
                    const active = filters.minRooms === opt.value;
                    return (
                      <button key={opt.value} onClick={() => updateFilters({ minRooms: opt.value })}
                        className="h-[40px] px-4 rounded-full text-[13px] font-semibold whitespace-nowrap transition-all active:scale-[0.96] shrink-0"
                        style={{ backgroundColor: active ? "rgb(var(--ha-primary))" : "rgb(var(--ha-surface))", color: active ? "white" : OBW.textSecondary }}
                        data-testid={`rooms-${opt.value}`}>
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </section>

              <Divider />

              <section>
                <div className="flex items-center justify-between mb-2.5">
                  <SectionLabel>{t("onboarding.filters.minSizeLabel")}</SectionLabel>
                  <button onClick={() => updateFilters({ sizeNA: !filters.sizeNA, minSize: filters.sizeNA ? 30 : 0 })}
                    className="text-[12px] font-medium px-2.5 py-1 rounded-full border transition-all"
                    style={{
                      borderColor: filters.sizeNA ? "rgb(var(--ha-primary))" : OBW.cardBorder,
                      backgroundColor: filters.sizeNA ? "rgba(37,60,150,0.08)" : "transparent",
                      color: filters.sizeNA ? "rgb(var(--ha-primary))" : OBW.textSecondary,
                    }}
                    data-testid="button-size-na">
                    {t("common.na")}
                  </button>
                </div>
                {!filters.sizeNA && (
                  <div data-testid="slider-min-size">
                    <div className="flex justify-between mb-1.5">
                      <span className="text-[13px]" style={{ color: OBW.textSecondary }}>0 m²</span>
                      <span className="text-[13px] font-semibold" style={{ color: "rgb(var(--ha-primary))" }}>{filters.minSize} m²</span>
                      <span className="text-[13px]" style={{ color: OBW.textSecondary }}>200 m²</span>
                    </div>
                    <input type="range" min={0} max={200} step={5} value={filters.minSize}
                      onChange={(e) => updateFilters({ minSize: Number(e.target.value) })}
                      className="w-full"
                      style={{ background: `linear-gradient(to right,rgb(var(--ha-primary)) 0%,rgb(var(--ha-primary)) ${(filters.minSize / 200) * 100}%,rgb(var(--ha-card-border)) ${(filters.minSize / 200) * 100}%,rgb(var(--ha-card-border)) 100%)` }} />
                  </div>
                )}
              </section>

              <Divider />

              <section>
                <SectionLabel>{t("onboarding.filters.furnishedLabel")}</SectionLabel>
                {chipRow(FURNISHED_OPTIONS, filters.furnished, (v) => updateFilters({ furnished: v }), "furnished-selector")}
              </section>

              <Divider />

              <section>
                <SectionLabel>{t("onboarding.filters.amenitiesLabel")}</SectionLabel>
                <div className="flex flex-wrap gap-2" data-testid="amenity-chips">
                  {AMENITY_OPTIONS.map(({ value, labelKey, fallback, Icon }) => {
                    const active = filters.amenities.includes(value);
                    return (
                      <button key={value} onClick={() => toggleAmenity(value)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-medium border transition-all"
                        style={{
                          backgroundColor: active ? "rgb(var(--ha-primary))" : "transparent",
                          borderColor: active ? "rgb(var(--ha-primary))" : OBW.cardBorder,
                          color: active ? "white" : OBW.textSecondary,
                        }}
                        data-testid={`amenity-${value}`}>
                        {active && <Check className="w-3 h-3" />}
                        <Icon className="w-3.5 h-3.5" />
                        {t(labelKey) || fallback}
                      </button>
                    );
                  })}
                </div>
              </section>

              <Divider />

              <section>
                <Toggle checked={filters.sendUnclear} onChange={(v) => updateFilters({ sendUnclear: v })}
                  label={t("onboarding.filters.sendUnclear")} testId="toggle-send-unclear" />
              </section>
            </div>
          )}

          {/* ── STEP 4: ACCOUNT ───────────────────────────────────────────── */}
          {step === 4 && (
            <div className="flex flex-col gap-4" data-testid="embed-step-account">
              <div>
                <h2 className="text-[22px] font-bold mb-1" style={{ color: OBW.text }}>
                  Waar kunnen we je matches heen sturen?
                </h2>
                <p className="text-[14px]" style={{ color: OBW.textSecondary }}>
                  {t("onboarding.name.subtitle")}
                </p>
              </div>

              {/* Missed matches card */}
              {missed30 !== null && (
                <div className="flex items-center gap-3 rounded-[12px] px-4 py-3.5"
                  style={{ backgroundColor: "rgb(var(--ha-primary-light))", border: "1px solid rgba(37,60,150,0.12)" }}
                  data-testid="embed-missed-matches-card">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: "rgb(var(--ha-primary))" }}>
                    <span className="text-white text-[15px] font-bold">{Math.max(1, missed30)}</span>
                  </div>
                  <p className="text-[13px] font-medium leading-snug" style={{ color: OBW.text }}>
                    Je hebt <span className="font-bold">{Math.max(1, missed30)} woningmatches</span> gemist in de laatste 30 dagen
                  </p>
                </div>
              )}

              {/* Name fields */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <SectionLabel>{t("onboarding.name.firstNameLabel")}</SectionLabel>
                  <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                    placeholder={t("onboarding.name.firstNamePlaceholder")}
                    className="w-full ha-field-web"
                    style={{ borderColor: "rgb(var(--ha-border-input))", color: OBW.text, backgroundColor: OBW.inputBg }}
                    autoFocus data-testid="input-first-name" />
                </div>
                <div className="flex-1">
                  <SectionLabel>{t("onboarding.name.lastNameLabel")}</SectionLabel>
                  <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                    placeholder={t("onboarding.name.lastNamePlaceholder")}
                    className="w-full ha-field-web"
                    style={{ borderColor: "rgb(var(--ha-border-input))", color: OBW.text, backgroundColor: OBW.inputBg }}
                    data-testid="input-last-name" />
                </div>
              </div>

              <div>
                <SectionLabel>{t("onboarding.email.label")}</SectionLabel>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("onboarding.email.placeholder")}
                  className="w-full ha-field-web"
                  style={{ borderColor: "rgb(var(--ha-border-input))", color: OBW.text, backgroundColor: OBW.inputBg }}
                  data-testid="input-email" />
              </div>

              <div>
                <SectionLabel>{t("onboarding.password.label")}</SectionLabel>
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("onboarding.password.placeholder")}
                    className="w-full ha-field-web pr-11"
                    style={{ borderColor: "rgb(var(--ha-border-input))", color: OBW.text, backgroundColor: OBW.inputBg }}
                    data-testid="input-password" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2"
                    style={{ color: OBW.textMuted }} data-testid="button-toggle-password">
                    {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                  </button>
                </div>
                <PasswordRules password={password} />
              </div>

              <div>
                <SectionLabel>{t("onboarding.password.confirmLabel")}</SectionLabel>
                <div className="relative">
                  <input type={showConfirm ? "text" : "password"} value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t("onboarding.password.confirmPlaceholder")}
                    className="w-full ha-field-web pr-11"
                    style={{
                      borderColor: confirmPassword.length > 0 && !confirmOk ? "rgb(var(--ha-danger))" : "rgb(var(--ha-border-input))",
                      color: OBW.text, backgroundColor: OBW.inputBg,
                    }}
                    data-testid="input-confirm-password" />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2"
                    style={{ color: OBW.textMuted }} data-testid="button-toggle-confirm">
                    {showConfirm ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                  </button>
                </div>
              </div>

              {/* Legal text */}
              <p className="text-[11px] leading-relaxed" style={{ color: OBW.textMuted }}>
                Door een account aan te maken ga je akkoord met onze{" "}
                <a href="/terms" target="_blank" className="underline" style={{ color: OBW.textSecondary }}>Gebruiksvoorwaarden</a>{" "}
                en{" "}
                <a href="/privacy" target="_blank" className="underline" style={{ color: OBW.textSecondary }}>Privacybeleid</a>.
              </p>
            </div>
          )}

        </div>
      </div>

      {/* ── Sticky footer ───────────────────────────────────────────────────── */}
      {step === 1 && (
        <EmbedFooter
          onBack={() => {}}
          onNext={() => { if (city) setStep(2); }}
          nextLabel={t("common.next")}
          nextDisabled={!city}
          showMatch={false}
        />
      )}
      {step === 2 && (
        <EmbedFooter
          matchCount={locEstimate?.matchesLast7Days}
          fetching={locFetching}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
          nextLabel={t("common.next")}
          showMatch={true}
        />
      )}
      {step === 3 && (
        <EmbedFooter
          matchCount={filEstimate?.matchesLast7Days}
          fetching={filFetching}
          onBack={() => setStep(2)}
          onNext={() => setStep(4)}
          nextLabel={t("common.next")}
          showMatch={true}
        />
      )}
      {step === 4 && (
        <EmbedFooter
          onBack={() => setStep(3)}
          onNext={handleCreateAccount}
          nextLabel="Account aanmaken"
          nextDisabled={!canSubmit}
          loading={loading}
          showMatch={false}
        />
      )}

    </div>
  );
}
