import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import {
  X, ChevronLeft, ChevronDown, ChevronRight, Check,
  Eye, EyeOff, Loader2, Bath, Sun, Trees, Leaf, MapPin,
} from "lucide-react";
import { useTranslation } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api-base";
import { clearAllUserData } from "@/lib/queryClient";
import { createSearchProfile } from "@/lib/search-profiles";
import { validatePassword, isPasswordValid } from "@/lib/password-validation";
import { PasswordRules } from "@/components/password-rules";
import MapView from "@/components/map-view";
import { cityDistricts } from "../../../config/market";
import {
  matchEstimateQueryKey,
  fetchMatchEstimate,
  type MatchEstimateResult,
  type NormalizedFilters,
} from "@/lib/match-estimate";
import { useQuery } from "@tanstack/react-query";
import { OBW } from "@/components/onboarding-ui";

// ─── Types ────────────────────────────────────────────────────────────────────

type ModalStep = "location" | "filters" | "account";

type LocationMode = "districts" | "radius" | "city";

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

const INITIAL_FILTERS: FiltersData = {
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

const AMENITY_OPTIONS = [
  { value: "bath", labelKey: "amenities.bath", fallback: "Bad", Icon: Bath },
  { value: "balcony", labelKey: "amenities.balcony", fallback: "Balkon", Icon: Sun },
  { value: "garden", labelKey: "amenities.garden", fallback: "Garten", Icon: Trees },
  { value: "energy_c", labelKey: "amenities.energyC", fallback: "Energieklasse C+", Icon: Leaf },
];

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─── Shared sub-components ────────────────────────────────────────────────────

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
        style={{ backgroundColor: checked ? "rgb(var(--ha-primary))" : "rgb(var(--ha-card-border))" }}
        onClick={() => onChange(!checked)}
      >
        <div
          className="w-[20px] h-[20px] rounded-full bg-white transition-transform shadow-sm"
          style={{ transform: checked ? "translateX(20px)" : "translateX(0)" }}
        />
      </div>
      <span className="text-[13px] leading-snug" style={{ color: OBW.text }}>{label}</span>
    </label>
  );
}

function DualRangeSlider({
  min, max, step, valueLow, valueHigh, onChangeLow, onChangeHigh, formatLabel, testId,
}: {
  min: number; max: number; step: number;
  valueLow: number; valueHigh: number;
  onChangeLow: (v: number) => void;
  onChangeHigh: (v: number) => void;
  formatLabel: (v: number) => string;
  testId: string;
}) {
  const pctLow = ((valueLow - min) / (max - min)) * 100;
  const pctHigh = ((valueHigh - min) / (max - min)) * 100;
  const primary = "rgb(var(--ha-primary))";
  const inactive = "rgb(var(--ha-card-border))";
  const trackBg = `linear-gradient(to right, ${inactive} 0%, ${inactive} ${pctLow}%, ${primary} ${pctLow}%, ${primary} ${pctHigh}%, ${inactive} ${pctHigh}%, ${inactive} 100%)`;
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
          style={{ background: trackBg, zIndex: valueLow > max - step ? 3 : 1 }}
          data-testid="slider-min-price"
        />
        <input type="range" min={min} max={max} step={step} value={valueHigh}
          onChange={(e) => { const v = Number(e.target.value); if (v >= valueLow) onChangeHigh(v); }}
          className="w-full absolute inset-0 dual-range-thumb"
          style={{ background: "transparent", zIndex: 2 }}
          data-testid="slider-max-price"
        />
      </div>
    </div>
  );
}

// ─── Main Modal Component ─────────────────────────────────────────────────────

interface OnboardingModalProps {
  city: string;
  lat: number;
  lng: number;
  onClose: () => void;
}

export default function OnboardingModal({ city, lat, lng, onClose }: OnboardingModalProps) {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const { toast } = useToast();

  const [step, setStep] = useState<ModalStep>("location");

  // Location state
  const districtList = cityDistricts[city] || [];
  const hasDistricts = districtList.length > 0;
  const [locationData, setLocationData] = useState<LocationData>({
    mode: hasDistricts ? "districts" : "city",
    selectedDistricts: [],
    radiusKm: 5,
  });
  const [showDistrictPicker, setShowDistrictPicker] = useState(false);

  // Filters state
  const [filters, setFilters] = useState<FiltersData>(INITIAL_FILTERS);
  const [debouncedFilters, setDebouncedFilters] = useState<FiltersData>(INITIAL_FILTERS);
  const filterDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    filterDebounceRef.current = setTimeout(() => setDebouncedFilters(filters), 600);
    return () => { if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current); };
  }, [filters]);

  // Account state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  // Location estimate (debounced)
  const [debouncedLocation, setDebouncedLocation] = useState(locationData);
  const locationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (locationDebounceRef.current) clearTimeout(locationDebounceRef.current);
    locationDebounceRef.current = setTimeout(() => setDebouncedLocation(locationData), 600);
    return () => { if (locationDebounceRef.current) clearTimeout(locationDebounceRef.current); };
  }, [locationData]);

  const locationEstimateFilters: NormalizedFilters = {
    city,
    location_mode:
      debouncedLocation.mode === "radius" ? "radius"
      : debouncedLocation.mode === "districts" && debouncedLocation.selectedDistricts.length > 0 ? "districts"
      : "city",
    latitude: lat,
    longitude: lng,
    radius_km: debouncedLocation.mode === "radius" ? debouncedLocation.radiusKm : undefined,
    districts: debouncedLocation.mode === "districts" && debouncedLocation.selectedDistricts.length > 0
      ? debouncedLocation.selectedDistricts : undefined,
    price_min: 0, price_max: 0, bedrooms_min: 0, size_min: 0,
    send_unclear: true, price_flexible: false,
  };

  const { data: locationEstimate, isFetching: locationEstimating } = useQuery<MatchEstimateResult>({
    queryKey: matchEstimateQueryKey(locationEstimateFilters),
    queryFn: () => fetchMatchEstimate(locationEstimateFilters),
    enabled: !!city && step === "location",
    staleTime: 2 * 60 * 1000,
  });

  const filtersEstimateFilters: NormalizedFilters = {
    city, latitude: lat, longitude: lng,
    location_mode: locationData.mode === "radius" ? "radius"
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

  const { data: filtersEstimate, isFetching: filtersEstimating } = useQuery<MatchEstimateResult>({
    queryKey: matchEstimateQueryKey(filtersEstimateFilters),
    queryFn: () => fetchMatchEstimate(filtersEstimateFilters),
    enabled: !!city && step === "filters",
    staleTime: 2 * 60 * 1000,
  });

  const STEPS: ModalStep[] = ["location", "filters", "account"];
  const stepIndex = STEPS.indexOf(step);
  const totalSteps = STEPS.length;
  const stepNumber = stepIndex + 2; // step 1 was city on landing page
  const totalOverall = STEPS.length + 1; // +1 for city step

  function goBack() {
    if (step === "location") { onClose(); return; }
    if (step === "filters") { setStep("location"); return; }
    if (step === "account") { setStep("filters"); return; }
  }

  function goNext() {
    if (step === "location") { setStep("filters"); return; }
    if (step === "filters") { setStep("account"); return; }
  }

  // ── Account creation ───────────────────────────────────────────────────────

  async function handleCreateAccount() {
    const pwOk = isPasswordValid(validatePassword(password));
    if (!firstName.trim() || !isValidEmail(email) || !pwOk || password !== confirmPassword) return;
    if (loading || submittingRef.current) return;
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
        setLoading(false);
        submittingRef.current = false;
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        toast({ title: t("common.error"), description: signInError.message, variant: "destructive" });
        setLoading(false);
        submittingRef.current = false;
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;

      import("@/lib/track-event").then(({ trackEvent }) => { trackEvent("account_created"); }).catch(() => {});

      if (userId && city) {
        try {
          await createSearchProfile({
            user_id: userId,
            city_name: city,
            country_code: "DE",
            latitude: lat,
            longitude: lng,
            place_id: city.toLowerCase().replace(/\s+/g, "_") + "_de",
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
          console.error("[OnboardingModal] Failed to save search profile:", err);
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
          console.error("[OnboardingModal] Failed to set onboarding_completed:", err);
        }
      }

      navigate("/onboarding/setup");
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  const pwStrength = validatePassword(password);
  const passwordOk = isPasswordValid(pwStrength);
  const confirmOk = confirmPassword.length > 0 && password === confirmPassword;
  const canSubmit = firstName.trim() && isValidEmail(email) && passwordOk && confirmOk && !loading;

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

  const locationTabOptions: { value: LocationMode; label: string }[] = [
    ...(hasDistricts ? [{ value: "districts" as LocationMode, label: t("onboarding.location.neighborhoodsTab") }] : []),
    { value: "radius" as LocationMode, label: t("onboarding.location.radiusTab") },
    { value: "city" as LocationMode, label: t("onboarding.location.wholePlaceTab") },
  ];

  const districtCount = locationData.selectedDistricts.length;
  const districtSummary =
    districtCount === 0 || districtCount === districtList.length
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

  const matchCount =
    step === "location"
      ? (locationEstimating ? null : locationEstimate?.matchesLast7Days ?? null)
      : (filtersEstimating ? null : filtersEstimate?.matchesLast7Days ?? null);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-white"
      data-testid="onboarding-modal"
      style={{ overscrollBehavior: "contain" }}
    >
      {/* Header */}
      <div className="bg-white shrink-0" style={{ paddingTop: "max(0px, env(safe-area-inset-top))" }}>
        <div className="relative max-w-[480px] mx-auto px-4 h-[56px] flex items-center justify-between">
          <span
            className="text-[13px] font-bold rounded-[8px] shrink-0 flex items-center px-3"
            style={{ height: "30px", backgroundColor: "rgb(var(--ha-primary))", color: "white" }}
            data-testid="badge-modal-step"
          >
            {stepNumber}/{totalOverall}
          </span>
          <span
            className="absolute inset-0 flex items-center justify-center text-[17px] font-bold pointer-events-none"
            style={{ color: OBW.text }}
          >
            {step === "location" && t("onboarding.filters.headerTitle")}
            {step === "filters" && t("onboarding.filters.headerTitle")}
            {step === "account" && t("onboarding.password.web.title")}
          </span>
          <button
            onClick={onClose}
            className="w-[36px] h-[36px] shrink-0 flex items-center justify-center rounded-full transition-opacity hover:opacity-70 active:opacity-50"
            style={{ backgroundColor: "rgb(var(--ha-surface))", color: "rgb(var(--ha-text-muted))" }}
            data-testid="button-modal-close"
          >
            <X className="w-[20px] h-[20px]" />
          </button>
        </div>
        {/* Progress bar */}
        <div className="mx-4 h-[3px] bg-ha-divider rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${((stepIndex + 1) / totalSteps) * 100}%`,
              backgroundColor: "rgb(var(--ha-primary))",
            }}
          />
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[480px] mx-auto px-4 pt-5 pb-[140px]">

          {/* ── STEP: LOCATION ────────────────────────────────────────────── */}
          {step === "location" && (
            <div data-testid="modal-step-location">
              {/* City display (read-only, click to close modal and re-pick) */}
              <SectionLabel>{t("onboarding.location.cityLabel")}</SectionLabel>
              <button
                onClick={onClose}
                className="w-full flex items-center gap-3 mb-5 ha-field-web text-left"
                style={{ backgroundColor: OBW.inputBg, borderColor: "rgb(var(--ha-border-input))", color: OBW.text }}
                data-testid="field-city-display"
              >
                <MapPin className="w-[17px] h-[17px] shrink-0" style={{ color: "rgb(var(--ha-primary))" }} />
                <span className="flex-1 text-[16px] font-medium" style={{ color: OBW.text }}>{city}</span>
                <X className="w-[15px] h-[15px] shrink-0" style={{ color: OBW.textMuted }} />
              </button>

              {/* Tab selector */}
              <div
                className="flex items-center gap-1 p-[4px] rounded-full mb-5"
                style={{ backgroundColor: "rgb(var(--ha-toggle-bg))" }}
                data-testid="location-tabs"
              >
                {locationTabOptions.map((tab) => {
                  const isActive = locationData.mode === tab.value;
                  return (
                    <button
                      key={tab.value}
                      onClick={() => setLocationData((prev) => ({ ...prev, mode: tab.value }))}
                      className="flex-1 py-[8px] text-[12px] font-semibold rounded-full text-center transition-all whitespace-nowrap overflow-hidden"
                      style={{
                        backgroundColor: isActive ? "rgb(var(--ha-primary))" : "transparent",
                        color: isActive ? "white" : "rgb(var(--ha-text))",
                      }}
                      data-testid={`tab-${tab.value}`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Districts mode */}
              {locationData.mode === "districts" && (
                <div data-testid="section-districts">
                  <button
                    onClick={() => setShowDistrictPicker(!showDistrictPicker)}
                    className="w-full flex items-center justify-between ha-field-web text-left mb-4"
                    style={{ backgroundColor: OBW.inputBg, borderColor: "rgb(var(--ha-border-input))" }}
                    data-testid="dropdown-districts"
                  >
                    <span className="text-[15px] font-medium" style={{ color: OBW.text }}>{districtSummary}</span>
                    <ChevronDown
                      className="w-[17px] h-[17px] shrink-0 transition-transform duration-200"
                      style={{ color: OBW.textMuted, transform: showDistrictPicker ? "rotate(180deg)" : "none" }}
                    />
                  </button>
                  {showDistrictPicker && hasDistricts && (
                    <div
                      className="rounded-[12px] overflow-hidden border mb-4"
                      style={{ borderColor: "rgb(var(--ha-divider))", maxHeight: "180px", overflowY: "auto" }}
                      data-testid="district-list"
                    >
                      {districtList.map((d, i) => {
                        const active = locationData.selectedDistricts.includes(d);
                        return (
                          <button
                            key={d}
                            onClick={() => toggleDistrict(d)}
                            className="w-full flex items-center justify-between hover:bg-ha-hover-bg transition-colors"
                            style={{ padding: "11px 16px", borderBottom: i < districtList.length - 1 ? "1px solid rgb(var(--ha-divider))" : "none" }}
                            data-testid={`district-${d}`}
                          >
                            <span className="text-[14px] font-medium" style={{ color: active ? OBW.text : OBW.textSecondary }}>
                              {d}
                            </span>
                            {active && <Check className="w-4 h-4" style={{ color: "rgb(var(--ha-primary))" }} />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div style={{ aspectRatio: "1/1" }} className="rounded-[12px] overflow-hidden w-full">
                    <MapView lat={lat} lng={lng} zoom={13}
                      markers={[{ lat, lng, type: "primary" }]}
                      circles={[{ lat, lng, radiusMeters: 1500 }]}
                      height="100%" className=""
                    />
                  </div>
                </div>
              )}

              {/* Radius mode */}
              {locationData.mode === "radius" && (
                <div data-testid="section-radius">
                  <style>{`
                    .ha-modal-radius-slider{-webkit-appearance:none;appearance:none;background:transparent;cursor:pointer;width:100%;height:4px}
                    .ha-modal-radius-slider::-webkit-slider-runnable-track{background:linear-gradient(to right,rgb(var(--ha-primary)) 0%,rgb(var(--ha-primary)) var(--sl-pct,0%),rgb(var(--ha-card-border)) var(--sl-pct,0%),rgb(var(--ha-card-border)) 100%);border-radius:9999px;height:4px}
                    .ha-modal-radius-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:22px;height:22px;border-radius:50%;background:white;box-shadow:0 1px 6px rgba(0,0,0,0.18),0 0 0 1.5px rgba(0,0,0,0.07);margin-top:-9px;cursor:pointer}
                    .ha-modal-radius-slider::-moz-range-track{background:rgb(var(--ha-card-border));border-radius:9999px;height:4px}
                    .ha-modal-radius-slider::-moz-range-thumb{width:22px;height:22px;border-radius:50%;background:white;box-shadow:0 1px 6px rgba(0,0,0,0.18);border:none;cursor:pointer}
                  `}</style>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[14px] font-semibold" style={{ color: OBW.textSecondary }}>
                      {t("onboarding.location.distanceLabel")}
                    </span>
                    <span className="text-[13px] font-medium" style={{ color: OBW.textMuted }}>{city}</span>
                  </div>
                  <div className="flex items-center gap-3 mb-5">
                    <input
                      type="range" min={1} max={50} step={1}
                      value={locationData.radiusKm}
                      onChange={(e) => setLocationData((prev) => ({ ...prev, radiusKm: parseInt(e.target.value) }))}
                      className="ha-modal-radius-slider flex-1"
                      style={{ "--sl-pct": `${((locationData.radiusKm - 1) / 49) * 100}%` } as React.CSSProperties}
                      data-testid="slider-radius"
                    />
                    <span className="text-[15px] font-semibold shrink-0 w-[52px] text-right" style={{ color: "rgb(var(--ha-primary))" }}>
                      {locationData.radiusKm} km
                    </span>
                  </div>
                  <div style={{ aspectRatio: "1/1" }} className="rounded-[12px] overflow-hidden w-full">
                    <MapView lat={lat} lng={lng} zoom={10}
                      markers={[{ lat, lng, type: "primary" }]}
                      circles={[{ lat, lng, radiusMeters: locationData.radiusKm * 1000 }]}
                      height="100%" className=""
                    />
                  </div>
                </div>
              )}

              {/* Whole city mode */}
              {locationData.mode === "city" && (
                <div data-testid="section-city">
                  <div style={{ aspectRatio: "1/1" }} className="rounded-[12px] overflow-hidden w-full">
                    <MapView lat={lat} lng={lng} zoom={10}
                      markers={[{ lat, lng, type: "primary" }]}
                      height="100%" className=""
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP: FILTERS ─────────────────────────────────────────────── */}
          {step === "filters" && (
            <div className="flex flex-col gap-5" data-testid="modal-step-filters">
              <section>
                <SectionLabel>{t("onboarding.filters.rentLabel")}</SectionLabel>
                <DualRangeSlider
                  min={0} max={3000} step={50}
                  valueLow={filters.minPrice} valueHigh={filters.maxPrice}
                  onChangeLow={(v) => updateFilters({ minPrice: v })}
                  onChangeHigh={(v) => updateFilters({ maxPrice: v })}
                  formatLabel={(v) => `€${v}`} testId="slider-rent-price"
                />
                <div className="mt-3">
                  <Toggle checked={filters.priceFlexible}
                    onChange={(v) => updateFilters({ priceFlexible: v })}
                    label={t("onboarding.filters.priceFlexible")} testId="toggle-price-flexible"
                  />
                </div>
              </section>

              <Divider />

              <section>
                <SectionLabel>{t("onboarding.filters.propertyTypeLabel")}</SectionLabel>
                <div className="flex items-center gap-[4px] p-[4px] rounded-full" style={{ backgroundColor: "rgb(var(--ha-toggle-bg))" }} data-testid="property-type">
                  {PROPERTY_OPTIONS.map((opt) => {
                    const isActive = filters.propertyType === opt.value;
                    return (
                      <button key={opt.value} onClick={() => updateFilters({ propertyType: opt.value })}
                        className="flex-1 py-[8px] text-[12px] font-semibold rounded-full text-center transition-all"
                        style={{ backgroundColor: isActive ? "rgb(var(--ha-primary))" : "transparent", color: isActive ? "white" : "rgb(var(--ha-text))" }}
                        data-testid={`property-type-${opt.value}`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3">
                  <Toggle checked={filters.includeRooms}
                    onChange={(v) => updateFilters({ includeRooms: v })}
                    label={t("onboarding.filters.includeRooms")} testId="toggle-include-rooms"
                  />
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
                        data-testid={`rooms-${opt.value}`}
                      >
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
                  <button
                    onClick={() => updateFilters({ sizeNA: !filters.sizeNA, minSize: filters.sizeNA ? 30 : 0 })}
                    className="text-[12px] font-medium px-2.5 py-1 rounded-full border transition-all"
                    style={{
                      borderColor: filters.sizeNA ? "rgb(var(--ha-primary))" : OBW.cardBorder,
                      backgroundColor: filters.sizeNA ? "rgba(37,60,150,0.08)" : "transparent",
                      color: filters.sizeNA ? "rgb(var(--ha-primary))" : OBW.textSecondary,
                    }}
                    data-testid="button-size-na"
                  >
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
                      style={{ background: `linear-gradient(to right, rgb(var(--ha-primary)) 0%, rgb(var(--ha-primary)) ${(filters.minSize / 200) * 100}%, rgb(var(--ha-card-border)) ${(filters.minSize / 200) * 100}%, rgb(var(--ha-card-border)) 100%)` }}
                    />
                  </div>
                )}
              </section>

              <Divider />

              <section>
                <SectionLabel>{t("onboarding.filters.furnishedLabel")}</SectionLabel>
                <div className="flex items-center gap-[4px] p-[4px] rounded-full" style={{ backgroundColor: "rgb(var(--ha-toggle-bg))" }} data-testid="furnished-selector">
                  {FURNISHED_OPTIONS.map((opt) => {
                    const isActive = filters.furnished === opt.value;
                    return (
                      <button key={opt.value} onClick={() => updateFilters({ furnished: opt.value })}
                        className="flex-1 py-[8px] text-[12px] font-semibold rounded-full text-center transition-all whitespace-nowrap overflow-hidden"
                        style={{ backgroundColor: isActive ? "rgb(var(--ha-primary))" : "transparent", color: isActive ? "white" : "rgb(var(--ha-text))" }}
                        data-testid={`furnished-${opt.value}`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
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

              <Divider />

              <section>
                <Toggle checked={filters.sendUnclear}
                  onChange={(v) => updateFilters({ sendUnclear: v })}
                  label={t("onboarding.filters.sendUnclear")} testId="toggle-send-unclear"
                />
              </section>
            </div>
          )}

          {/* ── STEP: ACCOUNT ─────────────────────────────────────────────── */}
          {step === "account" && (
            <div className="flex flex-col gap-4" data-testid="modal-step-account">
              <div>
                <h2 className="text-[22px] font-bold mb-1" style={{ color: "rgb(var(--ha-text))" }}>
                  {t("onboarding.password.web.title")}
                </h2>
                <p className="text-[14px]" style={{ color: OBW.textSecondary }}>
                  {t("onboarding.name.subtitle")}
                </p>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <SectionLabel>{t("onboarding.name.firstNameLabel")}</SectionLabel>
                  <input
                    type="text" value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder={t("onboarding.name.firstNamePlaceholder")}
                    className="w-full ha-field-web"
                    style={{ borderColor: "rgb(var(--ha-border-input))", color: OBW.text, backgroundColor: OBW.inputBg }}
                    autoFocus
                    data-testid="input-first-name"
                  />
                </div>
                <div className="flex-1">
                  <SectionLabel>{t("onboarding.name.lastNameLabel")}</SectionLabel>
                  <input
                    type="text" value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder={t("onboarding.name.lastNamePlaceholder")}
                    className="w-full ha-field-web"
                    style={{ borderColor: "rgb(var(--ha-border-input))", color: OBW.text, backgroundColor: OBW.inputBg }}
                    data-testid="input-last-name"
                  />
                </div>
              </div>

              <div>
                <SectionLabel>{t("onboarding.email.label")}</SectionLabel>
                <input
                  type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("onboarding.email.placeholder")}
                  className="w-full ha-field-web"
                  style={{ borderColor: "rgb(var(--ha-border-input))", color: OBW.text, backgroundColor: OBW.inputBg }}
                  data-testid="input-email"
                />
              </div>

              <div>
                <SectionLabel>{t("onboarding.password.label")}</SectionLabel>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("onboarding.password.placeholder")}
                    className="w-full ha-field-web pr-11"
                    style={{ borderColor: "rgb(var(--ha-border-input))", color: OBW.text, backgroundColor: OBW.inputBg }}
                    data-testid="input-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2"
                    style={{ color: OBW.textMuted }}
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                  </button>
                </div>
                <PasswordRules password={password} />
              </div>

              <div>
                <SectionLabel>{t("onboarding.password.confirmLabel")}</SectionLabel>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t("onboarding.password.confirmPlaceholder")}
                    className="w-full ha-field-web pr-11"
                    style={{
                      borderColor: confirmPassword.length > 0 && !confirmOk ? "rgb(var(--ha-danger))" : "rgb(var(--ha-border-input))",
                      color: OBW.text, backgroundColor: OBW.inputBg,
                    }}
                    data-testid="input-confirm-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2"
                    style={{ color: OBW.textMuted }}
                    data-testid="button-toggle-confirm"
                  >
                    {showConfirm ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Footer */}
      <div
        className="shrink-0 border-t"
        style={{
          borderColor: OBW.footerBorder,
          backgroundColor: OBW.footerBg,
          paddingBottom: "max(8px, env(safe-area-inset-bottom, 8px))",
        }}
      >
        <div className="max-w-[480px] mx-auto px-4 py-3 flex items-center gap-3">
          {/* Match count (only on location/filters steps) */}
          {step !== "account" && (
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium" style={{ color: OBW.textMuted }}>
                {t("onboarding.location.estimatedMatches")}
              </p>
              <p className="text-[15px] font-semibold leading-snug" style={{ color: OBW.text }}>
                {matchCount == null
                  ? <span style={{ color: OBW.textMuted }}>…</span>
                  : <>{Math.max(1, matchCount)} {t("onboardingUI.perWeek")}{Math.max(1, matchCount) > 10 ? " 🔥" : ""}</>
                }
              </p>
            </div>
          )}
          {step === "account" && <div className="flex-1" />}

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={goBack}
              className="w-[44px] h-[44px] rounded-[6px] flex items-center justify-center active:scale-95 transition-transform"
              style={{ border: `1.5px solid ${OBW.backBtnBorder}`, backgroundColor: OBW.backBtnBg }}
              data-testid="button-modal-back"
            >
              <ChevronLeft className="w-[18px] h-[18px]" style={{ color: OBW.backBtnColor }} />
            </button>

            {step !== "account" && (
              <button
                onClick={goNext}
                className="h-[44px] px-6 rounded-[8px] text-[15px] font-semibold text-white flex items-center justify-center gap-1.5 active:scale-[0.97] transition-transform"
                style={{ background: "rgb(var(--ha-primary))", boxShadow: "0 4px 14px rgba(37,60,150,0.2)" }}
                data-testid="button-modal-next"
              >
                {t("common.next")}
                <ChevronRight className="w-[16px] h-[16px]" />
              </button>
            )}

            {step === "account" && (
              <button
                onClick={handleCreateAccount}
                disabled={!canSubmit}
                className="h-[44px] px-6 rounded-[8px] text-[14px] font-semibold text-white flex items-center justify-center gap-1.5 active:scale-[0.97] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "rgb(var(--ha-accent))", boxShadow: canSubmit ? "0 4px 14px rgba(243,107,46,0.28)" : "none" }}
                data-testid="button-create-account"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {t("slideshow.createAccount")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
