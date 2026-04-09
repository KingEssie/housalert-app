import { apiFetch } from "@/lib/api-base";
import { useState, useCallback, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { createSearchProfile, updateSearchProfile, getSearchProfile, getSearchProfiles } from "@/lib/search-profiles";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useTranslation } from "@/i18n";
import { getMatchEstimateRange } from "@/lib/match-estimate";
import LocationModeSelector, {
  type LocationData,
  DEFAULT_LOCATION_DATA,
  isLocationValid,
} from "@/components/location-mode-selector";
import {
  ArrowLeft,
  ArrowRight,
  Euro,
  BedDouble,
  Ruler,
  Sparkles,
  AlertCircle,
  Search,
  Sofa,
  Check,
  Pencil,
} from "lucide-react";

const MAX_PROFILES = 4;
const TOTAL_STEPS = 5;

const BEDROOM_OPTIONS = [
  { value: 0, labelKey: "newSearch.step2.noPref" },
  { value: 1, labelKey: "newSearch.step2.rooms1" },
  { value: 2, labelKey: "newSearch.step2.rooms2" },
  { value: 3, labelKey: "newSearch.step2.rooms3" },
  { value: 4, labelKey: "newSearch.step2.rooms4plus" },
];

const SIZE_OPTIONS = [
  { value: 0, labelKey: "newSearch.step2.noPref" },
  { value: 20, label: "20+ m\u00B2" },
  { value: 30, label: "30+ m\u00B2" },
  { value: 40, label: "40+ m\u00B2" },
  { value: 50, label: "50+ m\u00B2" },
  { value: 60, label: "60+ m\u00B2" },
  { value: 80, label: "80+ m\u00B2" },
  { value: 100, label: "100+ m\u00B2" },
  { value: 120, label: "120+ m\u00B2" },
  { value: 150, label: "150+ m\u00B2" },
  { value: 200, label: "200+ m\u00B2" },
];

const DEFAULT_BERLIN: LocationData = {
  ...DEFAULT_LOCATION_DATA,
  tab: "wijken",
  place: {
    city_name: "Berlin",
    country_code: "DE",
    latitude: 52.52,
    longitude: 13.405,
    place_id: "berlin_de",
  },
};

const FURNISHED_OPTIONS = [
  { value: "", labelKey: "newSearch.step2.doesntMatter" },
  { value: "furnished", labelKey: "newSearch.step2.furnishedOption" },
  { value: "unfurnished", labelKey: "newSearch.step2.unfurnishedOption" },
];

const TARGET_CATEGORY_OPTIONS = [
  { value: "studenten", labelKey: "newSearch.step4.students" },
  { value: "woningdelers", labelKey: "newSearch.step4.sharers" },
  { value: "huisdiereigenaren", labelKey: "newSearch.step4.petOwners" },
  { value: "betaalde_websites", labelKey: "newSearch.step4.paidSites" },
  { value: "kamers_gedeeld", labelKey: "newSearch.step4.sharedRooms" },
  { value: "vrije_sector", labelKey: "newSearch.step4.freeMarket" },
  { value: "tijdelijke_woningen", labelKey: "newSearch.step4.tempHousing" },
  { value: "seniorenwoningen", labelKey: "newSearch.step4.seniorHousing" },
];

const EXTRA_FEATURE_OPTIONS = [
  { value: "balkon", labelKey: "newSearch.step3.balcony" },
  { value: "tuin", labelKey: "newSearch.step3.garden" },
  { value: "parkeerplaats", labelKey: "newSearch.step3.parking" },
  { value: "lift", labelKey: "newSearch.step3.elevator" },
  { value: "kelder", labelKey: "newSearch.step3.basement" },
];

const PREFERENCE_OPTIONS = [
  { value: "huisdieren", labelKey: "newSearch.step3.pets", hintKey: "newSearch.step3.petsHint" },
];

interface FilterData {
  priceMin: string;
  priceMax: string;
  bedroomsMin: number;
  sizeMin: number;
  furnished: string;
  targetCategories: string[];
  extraFeatures: string[];
  sendUnclear: boolean;
  priceFlexible: boolean;
}

function resolveOptionLabel(opt: { label?: string; labelKey?: string }, t: (key: string, params?: Record<string, string | number>) => string): string {
  if (opt.labelKey) return t(opt.labelKey);
  return opt.label || "";
}

export default function NewSearchPage() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [locationData, setLocationData] = useState<LocationData>({ ...DEFAULT_BERLIN });
  const [editLoaded, setEditLoaded] = useState(false);

  const [, params] = useRoute("/dashboard/searches/edit/:id");
  const editId = params?.id || null;
  const isEditMode = !!editId;

  const [filters, setFilters] = useState<FilterData>({
    priceMin: "0",
    priceMax: "3000",
    bedroomsMin: 0,
    sizeMin: 0,
    furnished: "",
    targetCategories: [],
    extraFeatures: [],
    sendUnclear: true,
    priceFlexible: false,
  });

  const profilesQuery = useQuery({
    queryKey: ["/search-profiles"],
    queryFn: getSearchProfiles,
    enabled: !!user,
  });

  useEffect(() => {
    if (!editId || editLoaded) return;
    getSearchProfile(editId).then((profile) => {
      if (!profile) {
        toast({ title: t("newSearch.toasts.notFound"), variant: "destructive" });
        if (window.history.length > 1) window.history.back(); else navigate("/dashboard?tab=home");
        return;
      }
      const tab = profile.location_mode === "commute" ? "reistijd"
        : profile.location_mode === "radius" ? "radius"
        : "wijken";

      setLocationData({
        tab,
        place: {
          city_name: profile.city_name || profile.city || "",
          country_code: profile.country_code || "DE",
          latitude: profile.latitude || 52.52,
          longitude: profile.longitude || 13.405,
          place_id: profile.place_id || "",
        },
        districts: profile.districts || [],
        radiusKm: profile.radius_km || 5,
        commuteDestination: profile.commute_destination || "",
        commuteLat: profile.commute_lat || null,
        commuteLng: profile.commute_lng || null,
        commuteMode: (profile.commute_mode as any) || "driving",
        commuteMinutes: profile.commute_minutes || 30,
        commuteCity: profile.city_name || profile.city || "",
      });

      setFilters({
        priceMin: profile.price_min ? String(profile.price_min) : "",
        priceMax: profile.price_max ? String(profile.price_max) : "",
        bedroomsMin: profile.bedrooms_min || 0,
        sizeMin: profile.size_min || 0,
        furnished: profile.furnished || "",
        targetCategories: profile.target_categories || [],
        extraFeatures: profile.extra_features || [],
        sendUnclear: profile.send_unclear !== false,
        priceFlexible: profile.price_flexible === true,
      });

      setEditLoaded(true);
    });
  }, [editId, editLoaded, navigate, toast, t]);

  const profileCount = profilesQuery.data?.length ?? 0;
  const atLimit = !isEditMode && profileCount >= MAX_PROFILES;

  const cityForProfile = locationData.tab === "reistijd"
    ? locationData.commuteCity || locationData.commuteDestination.split(",")[0].trim()
    : locationData.place?.city_name ?? "";

  const estimateQuery = useQuery({
    queryKey: ["/api/estimate", cityForProfile, filters.priceMin, filters.priceMax, filters.bedroomsMin, filters.sizeMin],
    queryFn: async () => {
      const params = new URLSearchParams({ city: cityForProfile });
      if (filters.priceMin) params.set("minPrice", filters.priceMin);
      if (filters.priceMax) params.set("maxPrice", filters.priceMax);
      if (filters.bedroomsMin > 0) params.set("minRooms", String(filters.bedroomsMin));
      if (filters.sizeMin > 0) params.set("minSize", String(filters.sizeMin));
      const res = await apiFetch(`/api/estimate?${params}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!cityForProfile && step >= 2,
    staleTime: 30000,
  });

  const updateFilters = useCallback((partial: Partial<FilterData>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
  }, []);

  const canProceed = (): boolean => {
    switch (step) {
      case 1: return isLocationValid(locationData);
      default: return true;
    }
  };

  const goNext = () => { if (step < TOTAL_STEPS) setStep(step + 1); };
  const goBack = () => { if (step > 1) setStep(step - 1); else if (window.history.length > 1) window.history.back(); else navigate("/dashboard?tab=home"); };

  function buildPayload() {
    const parsedPriceMin = parseInt(filters.priceMin) || 0;
    const parsedPriceMax = parseInt(filters.priceMax) || 0;
    const locationMode = locationData.tab === "wijken"
      ? (locationData.districts.length > 0 ? "districts" as const : "city" as const)
      : locationData.tab === "radius"
        ? "radius" as const
        : "commute" as const;

    return {
      user_id: user!.id,
      city_name: cityForProfile,
      country_code: locationData.place?.country_code,
      latitude: locationData.place?.latitude,
      longitude: locationData.place?.longitude,
      place_id: locationData.place?.place_id,
      price_min: parsedPriceMin,
      price_max: parsedPriceMax,
      bedrooms_min: filters.bedroomsMin,
      size_min: filters.sizeMin,
      location_mode: locationMode,
      districts: locationData.tab === "wijken" && locationData.districts.length > 0 ? locationData.districts : undefined,
      radius_km: locationData.tab === "radius" ? locationData.radiusKm : undefined,
      commute_destination: locationData.tab === "reistijd" ? locationData.commuteDestination : undefined,
      commute_lat: locationData.tab === "reistijd" ? locationData.commuteLat ?? undefined : undefined,
      commute_lng: locationData.tab === "reistijd" ? locationData.commuteLng ?? undefined : undefined,
      commute_mode: locationData.tab === "reistijd" ? locationData.commuteMode : undefined,
      commute_minutes: locationData.tab === "reistijd" ? locationData.commuteMinutes : undefined,
      furnished: filters.furnished || undefined,
      property_types: undefined,
      extra_features: filters.extraFeatures.length > 0 ? filters.extraFeatures : undefined,
      target_categories: filters.targetCategories.length > 0 ? filters.targetCategories : undefined,
      send_unclear: filters.sendUnclear,
      price_flexible: filters.priceFlexible,
    };
  }

  async function handleSubmit() {
    if (!isEditMode && atLimit) {
      toast({ title: t("newSearch.toasts.limitReached"), description: t("newSearch.toasts.limitMaxDesc", { max: MAX_PROFILES }), variant: "destructive" });
      return;
    }
    if (!isLocationValid(locationData)) {
      toast({ title: t("newSearch.toasts.locationRequired"), variant: "destructive" });
      setStep(1);
      return;
    }

    const parsedPriceMin = parseInt(filters.priceMin) || 0;
    const parsedPriceMax = parseInt(filters.priceMax) || 0;

    if (parsedPriceMax > 0 && parsedPriceMin > parsedPriceMax) {
      toast({ title: t("newSearch.toasts.priceMinMax"), variant: "destructive" });
      setStep(2);
      return;
    }

    setSubmitting(true);
    try {
      const payload = buildPayload();

      if (isEditMode && editId) {
        await updateSearchProfile(editId, payload);
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (token) {
          apiFetch("/api/search-profiles/backfill", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ searchProfileId: editId }),
          }).catch(() => {});
        }
        queryClient.invalidateQueries({ queryKey: ["/search-profiles"] });
        queryClient.invalidateQueries({ queryKey: ["/api/profile-strength"] });
        toast({ title: t("newSearch.toasts.updated"), description: t("newSearch.toasts.updatedDesc") });
      } else {
        const profile = await createSearchProfile(payload);
        if (profile?.id) {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData?.session?.access_token;
          if (token) {
            apiFetch("/api/search-profiles/backfill", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ searchProfileId: profile.id }),
            }).catch(() => {});
          }
        }
        queryClient.invalidateQueries({ queryKey: ["/search-profiles"] });
        queryClient.invalidateQueries({ queryKey: ["/api/profile-strength"] });
        toast({ title: t("newSearch.toasts.created"), description: t("newSearch.toasts.createdDesc") });
      }

      if (window.history.length > 1) window.history.back(); else navigate("/dashboard?tab=home");
    } catch (err: any) {
      console.error("[new-search] Save failed:", err);
      toast({
        title: t("newSearch.toasts.saveFailed"),
        description: err?.message || t("newSearch.toasts.saveFailedDesc"),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || (isEditMode && !editLoaded)) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-ha-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) { navigate("/"); return null; }

  if (atLimit) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <div className="max-w-lg mx-auto flex items-center justify-between h-[60px] px-5">
            <button
              onClick={() => window.history.length > 1 ? window.history.back() : navigate("/dashboard?tab=home")}
              className="w-11 h-11 rounded-full bg-[#F3F4F6] flex items-center justify-center active:scale-95 transition-transform"
              data-testid="button-wizard-header-back"
            >
              <ArrowLeft className="w-5 h-5 text-[#334855]" />
            </button>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center px-5" style={{ paddingTop: "calc(env(safe-area-inset-top) + 76px)" }}>
          <div className="text-center max-w-sm w-full">
            <div className="w-16 h-16 rounded-2xl bg-[#F9FAFB] flex items-center justify-center mx-auto mb-5">
              <AlertCircle className="w-7 h-7 text-ha-primary" />
            </div>
            <h2 className="text-[30px] font-semibold text-[#111111] mb-2">{t("newSearch.limitTitle")}</h2>
            <p className="text-[17px] text-[#334855] mb-7 leading-relaxed">
              {t("newSearch.limitDesc", { max: MAX_PROFILES })}
            </p>
            <Button
              onClick={() => window.history.length > 1 ? window.history.back() : navigate("/dashboard?tab=home")}
              className="w-full h-[52px] rounded-[14px] bg-ha-primary hover:bg-ha-primary-hover text-white text-[16px] font-semibold"
              data-testid="button-back-to-dashboard-limit"
            >
              {t("newSearch.backToDashboard")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const perWeekRaw = estimateQuery.data?.perWeekEstimate ?? 0;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="max-w-lg mx-auto flex items-center justify-between h-[64px] px-5">
          <button
            onClick={goBack}
            className="w-10 h-10 rounded-full bg-[#F3F4F6] flex items-center justify-center active:scale-95 transition-transform"
            data-testid="button-wizard-header-back"
          >
            <ArrowLeft className="w-5 h-5 text-[#334855]" />
          </button>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className="h-[5px] rounded-full transition-all duration-300"
                style={{
                  width: i + 1 === step ? 28 : 8,
                  backgroundColor: i + 1 <= step ? "rgb(var(--ha-primary))" : "#E5E7EB",
                }}
              />
            ))}
          </div>
          <span className="text-[16px] font-bold text-[#111111] tabular-nums" data-testid="text-step-indicator">
            {step}<span className="text-[#C4C4C4] font-semibold">/{TOTAL_STEPS}</span>
          </span>
        </div>
      </header>

      <main className="flex-1 w-full max-w-lg mx-auto px-5 pb-40" style={{ paddingTop: "calc(env(safe-area-inset-top) + 76px)" }}>
        {step === 1 && <Step1Location locationData={locationData} setLocationData={setLocationData} />}
        {step === 2 && <Step2Requirements filters={filters} updateFilters={updateFilters} />}
        {step === 3 && <Step3ExtraFeatures filters={filters} updateFilters={updateFilters} />}
        {step === 4 && <Step4TargetCategories filters={filters} updateFilters={updateFilters} />}
        {step === 5 && (
          <StepReview
            locationData={locationData}
            filters={filters}
            cityForProfile={cityForProfile}
            onEdit={(s: number) => setStep(s)}
            isEditMode={isEditMode}
            submitting={submitting}
            onSubmit={handleSubmit}
            perWeek={perWeekRaw}
            estimateLoading={estimateQuery.isLoading}
          />
        )}
      </main>

      {step < 5 && (
        <div className="fixed z-50" style={{ bottom: "calc(env(safe-area-inset-bottom) + 24px)", left: 20, right: 20 }}>
          <div className="max-w-lg mx-auto flex items-center gap-3">
            {step > 1 && (
              <button
                onClick={goBack}
                className="h-[52px] px-5 rounded-full border border-[#E5E7EB] bg-white text-[15px] font-semibold text-[#111111] active:scale-[0.97] transition-all flex items-center gap-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
                data-testid="button-wizard-footer-back"
              >
                <ArrowLeft className="w-4 h-4" />
                {t("taskFlow.ui.prev")}
              </button>
            )}
            <div className="flex-1" />
            <button
              onClick={step < TOTAL_STEPS - 1 ? goNext : () => setStep(5)}
              disabled={!canProceed()}
              className="h-[52px] px-8 rounded-full bg-ha-primary hover:brightness-95 text-white text-[15px] font-semibold flex items-center justify-center gap-1.5 shadow-[0_4px_16px_rgba(217,26,104,0.3)] disabled:opacity-20 disabled:shadow-none transition-all active:scale-[0.97]"
              data-testid="button-wizard-next"
            >
              {t("taskFlow.ui.next")}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StepHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-8">
      <h2 className="text-[30px] font-semibold text-[#111111] leading-[1.15] tracking-[-0.025em] mb-2.5" data-testid="text-step-title">
        {title}
      </h2>
      <p className="text-[17px] text-[#334855] leading-relaxed">
        {subtitle}
      </p>
    </div>
  );
}

function Step1Location({
  locationData,
  setLocationData,
}: {
  locationData: LocationData;
  setLocationData: (ld: LocationData) => void;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <StepHeader title={t("newSearch.step1.title")} subtitle={t("newSearch.step1.subtitle")} />
      <LocationModeSelector
        value={locationData}
        onChange={setLocationData}
        segmentedTabs
        alwaysShowMap
        mapMaxHeight="50vh"
      />
    </div>
  );
}

function PillGroup({
  options,
  value,
  onChange,
  testId,
}: {
  options: { value: string | number; label?: string; labelKey?: string }[];
  value: string | number;
  onChange: (v: string) => void;
  testId: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-2" data-testid={testId}>
      {options.map((opt) => {
        const active = String(value) === String(opt.value);
        const label = opt.labelKey ? t(opt.labelKey) : opt.label || "";
        return (
          <button
            key={String(opt.value)}
            onClick={() => onChange(String(opt.value))}
            className="h-[40px] px-5 rounded-full text-[14px] font-medium border transition-all active:scale-[0.96]"
            style={{
              backgroundColor: active ? "rgb(var(--ha-primary))" : "#F9FAFB",
              borderColor: active ? "rgb(var(--ha-primary))" : "#E5E7EB",
              color: active ? "#fff" : "#334855",
            }}
            data-testid={`${testId}-${opt.value}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function DualSlider({
  min,
  max,
  step,
  valueLow,
  valueHigh,
  onChangeLow,
  onChangeHigh,
  formatLabel,
  testId,
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
}) {
  const pctLow = ((valueLow - min) / (max - min)) * 100;
  const pctHigh = ((valueHigh - min) / (max - min)) * 100;
  const trackBg = `linear-gradient(to right, #E5E7EB 0%, #E5E7EB ${pctLow}%, rgb(var(--ha-primary)) ${pctLow}%, rgb(var(--ha-primary)) ${pctHigh}%, #E5E7EB ${pctHigh}%, #E5E7EB 100%)`;

  return (
    <div data-testid={testId}>
      <div className="flex justify-between mb-2">
        <span className="text-[14px] font-semibold text-[#111111]">{formatLabel(valueLow)}</span>
        <span className="text-[14px] font-semibold text-[#111111]">{formatLabel(valueHigh)}</span>
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

function SingleSlider({
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
          background: `linear-gradient(to right, rgb(var(--ha-primary)) 0%, rgb(var(--ha-primary)) ${pct}%, #E5E7EB ${pct}%, #E5E7EB 100%)`,
        }}
      />
      <div className="flex justify-between mt-1">
        <span className="text-[12px] text-[#334855]">{formatLabel(min)}</span>
        <span className="text-[13px] font-semibold" style={{ color: "rgb(var(--ha-primary))" }}>{formatLabel(value)}</span>
        <span className="text-[12px] text-[#334855]">{formatLabel(max)}</span>
      </div>
    </div>
  );
}

function Step2Requirements({
  filters,
  updateFilters,
}: {
  filters: FilterData;
  updateFilters: (partial: Partial<FilterData>) => void;
}) {
  const { t } = useTranslation();
  const pMin = filters.priceMin ? parseInt(filters.priceMin) : 0;
  const pMax = filters.priceMax ? parseInt(filters.priceMax) : 3000;

  return (
    <div>
      <StepHeader title={t("newSearch.step2.title")} subtitle={t("newSearch.step2.subtitle")} />

      <div className="flex flex-col gap-6">
        <section>
          <label className="text-[15px] font-medium text-[#111111] mb-3 flex items-center gap-2.5">
            <span className="w-5 h-5 flex items-center justify-center text-[#334855]"><Euro className="w-[18px] h-[18px]" /></span>
            {t("onboarding.filters.rentLabel") || "Huurprijs"}
          </label>
          <DualSlider
            min={0}
            max={5000}
            step={50}
            valueLow={pMin}
            valueHigh={pMax}
            onChangeLow={(v) => updateFilters({ priceMin: String(v) })}
            onChangeHigh={(v) => updateFilters({ priceMax: String(v) })}
            formatLabel={(v) => `€${v.toLocaleString("nl-NL")}`}
            testId="slider-rent-price"
          />
          <div className="mt-3">
            <ToggleSwitch
              checked={filters.priceFlexible}
              onChange={(v) => updateFilters({ priceFlexible: v })}
              label={t("onboarding.filters.priceFlexible")}
              testId="toggle-price-flexible"
            />
          </div>
        </section>

        <div className="h-px bg-[#F0F0F0]" />

        <section>
          <label className="text-[15px] font-medium text-[#111111] mb-3 flex items-center gap-2.5">
            <span className="w-5 h-5 flex items-center justify-center text-[#334855]"><BedDouble className="w-[18px] h-[18px]" /></span>
            {t("newSearch.step2.bedrooms")}
          </label>
          <div
            className="flex p-1 rounded-full bg-[#F3F4F6]"
            data-testid="rooms-selector"
          >
            {BEDROOM_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => updateFilters({ bedroomsMin: opt.value })}
                className="flex-1 h-[40px] rounded-full text-[13px] font-semibold transition-all"
                style={{
                  backgroundColor: filters.bedroomsMin === opt.value ? "rgb(var(--ha-primary))" : "transparent",
                  color: filters.bedroomsMin === opt.value ? "#fff" : "#334855",
                }}
                data-testid={`rooms-${opt.value}`}
              >
                {t(opt.labelKey)}
              </button>
            ))}
          </div>
        </section>

        <div className="h-px bg-[#F0F0F0]" />

        <section>
          <label className="text-[15px] font-medium text-[#111111] mb-3 flex items-center gap-2.5">
            <span className="w-5 h-5 flex items-center justify-center text-[#334855]"><Ruler className="w-[18px] h-[18px]" /></span>
            {t("newSearch.step2.area")}
          </label>
          <SingleSlider
            min={0}
            max={200}
            step={5}
            value={filters.sizeMin}
            onChange={(v) => updateFilters({ sizeMin: v })}
            formatLabel={(v) => v === 0 ? t("newSearch.step2.noPref") : `${v} m²`}
            testId="slider-min-size"
          />
        </section>

        <div className="h-px bg-[#F0F0F0]" />

        <section>
          <label className="text-[15px] font-medium text-[#111111] mb-3 flex items-center gap-2.5">
            <span className="w-5 h-5 flex items-center justify-center text-[#334855]"><Sofa className="w-[18px] h-[18px]" /></span>
            {t("newSearch.step2.furnished")}
          </label>
          <PillGroup
            options={FURNISHED_OPTIONS}
            value={filters.furnished}
            onChange={(v) => updateFilters({ furnished: v })}
            testId="furnished-selector"
          />
        </section>
      </div>
    </div>
  );
}

function ToggleSwitch({
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
    <label className="flex items-center gap-3.5 cursor-pointer rounded-[16px] bg-white border border-[#DADDE3] px-4 py-4" data-testid={testId}>
      <div
        className="w-[48px] h-[28px] rounded-full p-[2px] transition-colors shrink-0 cursor-pointer"
        style={{ backgroundColor: checked ? "rgb(var(--ha-primary))" : "#D1D5DB" }}
        onClick={(e) => { e.preventDefault(); onChange(!checked); }}
      >
        <div
          className="w-[24px] h-[24px] rounded-full bg-white transition-transform shadow-sm"
          style={{ transform: checked ? "translateX(20px)" : "translateX(0)" }}
        />
      </div>
      <span className="text-[15px] leading-snug text-[#111111] font-medium">{label}</span>
    </label>
  );
}

function CheckboxRow({
  label,
  selected,
  onToggle,
  testId,
  hint,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
  testId: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full flex items-center gap-4 px-4 min-h-[72px] py-4 rounded-[16px] border-2 transition-all text-left ${
        selected
          ? "border-[rgb(var(--ha-primary))] bg-[#FFF1F4]"
          : "border-[#E5E7EB] bg-white hover:bg-[#FAFAFA]"
      }`}
      data-testid={testId}
    >
      <div className={`w-[26px] h-[26px] rounded-[8px] flex items-center justify-center flex-shrink-0 border-2 transition-colors ${
        selected ? "bg-ha-primary border-ha-primary" : "border-[#334855] bg-white"
      }`}>
        {selected && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-[16px] font-medium text-[#111111]">{label}</span>
        {hint && selected && (
          <p className="text-[14px] text-[#334855] mt-1 leading-snug">{hint}</p>
        )}
      </div>
    </button>
  );
}

function Step3ExtraFeatures({
  filters,
  updateFilters,
}: {
  filters: FilterData;
  updateFilters: (partial: Partial<FilterData>) => void;
}) {
  const { t } = useTranslation();
  const toggleFeature = (val: string) => {
    const arr = filters.extraFeatures;
    updateFilters({ extraFeatures: arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val] });
  };

  return (
    <div>
      <StepHeader title={t("newSearch.step3.title")} subtitle={t("newSearch.step3.subtitle")} />

      <div className="space-y-4">
        {EXTRA_FEATURE_OPTIONS.map((opt) => (
          <CheckboxRow
            key={opt.value}
            label={t(opt.labelKey)}
            selected={filters.extraFeatures.includes(opt.value)}
            onToggle={() => toggleFeature(opt.value)}
            testId={`option-feature-${opt.value}`}
          />
        ))}
      </div>

      <div className="mt-10">
        <h3 className="text-[16px] font-bold text-[#111111] mb-2">{t("newSearch.step3.preferencesTitle")}</h3>
        <p className="text-[15px] text-[#334855] mb-4 leading-relaxed">{t("newSearch.step3.preferencesSubtitle")}</p>
        <div className="space-y-4">
          {PREFERENCE_OPTIONS.map((opt) => (
            <CheckboxRow
              key={opt.value}
              label={t(opt.labelKey)}
              selected={filters.extraFeatures.includes(opt.value)}
              onToggle={() => toggleFeature(opt.value)}
              testId={`option-pref-${opt.value}`}
              hint={t(opt.hintKey)}
            />
          ))}
        </div>
      </div>

      {filters.extraFeatures.length === 0 && (
        <p className="text-[15px] text-[#334855] text-center mt-7">
          {t("newSearch.step3.noSelectionHint")}
        </p>
      )}

      <div className="mt-7">
        <ToggleSwitch
          checked={filters.sendUnclear}
          onChange={(v) => updateFilters({ sendUnclear: v })}
          label={t("onboarding.filters.sendUnclear")}
          testId="toggle-send-unclear"
        />
      </div>
    </div>
  );
}

function Step4TargetCategories({
  filters,
  updateFilters,
}: {
  filters: FilterData;
  updateFilters: (partial: Partial<FilterData>) => void;
}) {
  const { t } = useTranslation();
  const toggleCategory = (val: string) => {
    const arr = filters.targetCategories;
    updateFilters({ targetCategories: arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val] });
  };

  return (
    <div>
      <StepHeader title={t("newSearch.step4.title")} subtitle={t("newSearch.step4.subtitle")} />

      <div className="space-y-4">
        {TARGET_CATEGORY_OPTIONS.map((opt) => (
          <CheckboxRow
            key={opt.value}
            label={t(opt.labelKey)}
            selected={filters.targetCategories.includes(opt.value)}
            onToggle={() => toggleCategory(opt.value)}
            testId={`option-category-${opt.value}`}
          />
        ))}
      </div>

      {filters.targetCategories.length === 0 && (
        <p className="text-[15px] text-[#334855] text-center mt-7">
          {t("newSearch.step4.noSelectionHint")}
        </p>
      )}
    </div>
  );
}

function ReviewRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <button
      onClick={onEdit}
      className="w-full flex items-center justify-between py-[18px] px-5 border-b border-[#F3F4F6] last:border-b-0 text-left hover:bg-[#FAFAFA] transition-colors active:bg-[#F3F4F6] group"
      data-testid={`button-review-edit-${label.toLowerCase().replace(/\s/g, "-")}`}
    >
      <div className="flex-1 min-w-0 mr-3">
        <p className="text-[14px] font-medium text-[#334855] mb-1">{label}</p>
        <p className="text-[17px] font-semibold text-[#111111] leading-snug">{value}</p>
      </div>
      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-[#F3F4F6] flex items-center justify-center group-hover:bg-[#E5E7EB] transition-colors">
        <Pencil className="w-4 h-4 text-[#334855]" />
      </div>
    </button>
  );
}

function StepReview({
  locationData,
  filters,
  cityForProfile,
  onEdit,
  isEditMode,
  submitting,
  onSubmit,
  perWeek,
  estimateLoading,
}: {
  locationData: LocationData;
  filters: FilterData;
  cityForProfile: string;
  onEdit: (step: number) => void;
  isEditMode: boolean;
  submitting: boolean;
  onSubmit: () => void;
  perWeek: number;
  estimateLoading: boolean;
}) {
  const { t } = useTranslation();
  const perWeekRange = getMatchEstimateRange(perWeek);

  const locationLabel = locationData.tab === "reistijd"
    ? t("newSearch.step5.commuteTo", { dest: locationData.commuteDestination })
    : locationData.tab === "radius"
      ? `${cityForProfile} (${locationData.radiusKm} km)`
      : cityForProfile;

  const districtsLabel = locationData.districts.length > 0
    ? locationData.districts.join(", ")
    : t("newSearch.step5.allDistricts");

  const priceLabel = (() => {
    const min = filters.priceMin ? `\u20AC${parseInt(filters.priceMin).toLocaleString("de-DE")}` : "";
    const max = filters.priceMax ? `\u20AC${parseInt(filters.priceMax).toLocaleString("de-DE")}` : "";
    if (min && max) return `${min} \u2013 ${max}`;
    if (min) return t("newSearch.step5.from", { price: parseInt(filters.priceMin).toLocaleString("de-DE") });
    if (max) return t("newSearch.step5.upTo", { price: parseInt(filters.priceMax).toLocaleString("de-DE") });
    return t("newSearch.step2.noPref");
  })();

  const bedroomsLabel = resolveOptionLabel(BEDROOM_OPTIONS.find(o => o.value === filters.bedroomsMin) || BEDROOM_OPTIONS[0], t);
  const sizeLabel = resolveOptionLabel(SIZE_OPTIONS.find(o => o.value === filters.sizeMin) || SIZE_OPTIONS[0], t);

  const hardExtras = filters.extraFeatures.filter(v => EXTRA_FEATURE_OPTIONS.some(o => o.value === v));
  const softPrefs = filters.extraFeatures.filter(v => PREFERENCE_OPTIONS.some(o => o.value === v));

  const extraFeaturesLabel = hardExtras.length > 0
    ? hardExtras.map(v => { const o = EXTRA_FEATURE_OPTIONS.find(o => o.value === v); return o ? t(o.labelKey) : v; }).join(", ")
    : t("newSearch.step5.noSelection");

  const preferencesLabel = softPrefs.length > 0
    ? softPrefs.map(v => { const o = PREFERENCE_OPTIONS.find(o => o.value === v); return o ? t(o.labelKey) : v; }).join(", ")
    : t("newSearch.step5.noSelection");

  const targetLabel = filters.targetCategories.length > 0
    ? filters.targetCategories.map(v => { const o = TARGET_CATEGORY_OPTIONS.find(o => o.value === v); return o ? t(o.labelKey) : v; }).join(", ")
    : t("newSearch.step5.noSelection");

  return (
    <div className="pb-28">
      <StepHeader title={t("newSearch.step5.title")} subtitle={t("newSearch.step5.subtitle")} />

      <div className="space-y-5">
        {!estimateLoading && (
          <div className="rounded-[16px] bg-[#F5F0EB] p-6 flex items-center gap-4" data-testid="card-review-estimate">
            <div className="flex-shrink-0">
              <Sparkles className="w-[32px] h-[32px] text-[#111111]" strokeWidth={1.6} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[17px] font-bold text-[#111111] leading-snug">
                {perWeek > 0
                  ? t("newSearch.step5.estimate", perWeekRange)
                  : t("newSearch.step5.noMatchesExpected")}
              </p>
              <p className="text-[14px] text-[#334855] mt-1">
                {perWeek > 0
                  ? t("newSearch.step5.estimateDesc")
                  : t("newSearch.step5.adjustFiltersLater")}
              </p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-[16px] border border-[#E5E7EB] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <ReviewRow label={t("newSearch.step5.location")} value={locationLabel} onEdit={() => onEdit(1)} />
          {locationData.tab === "wijken" && (
            <ReviewRow label={t("newSearch.step5.districts")} value={districtsLabel} onEdit={() => onEdit(1)} />
          )}
          <ReviewRow label={t("newSearch.step5.rent")} value={priceLabel} onEdit={() => onEdit(2)} />
          <ReviewRow label={t("newSearch.step5.bedrooms")} value={bedroomsLabel} onEdit={() => onEdit(2)} />
          <ReviewRow label={t("newSearch.step5.area")} value={sizeLabel} onEdit={() => onEdit(2)} />
          <ReviewRow label={t("newSearch.step5.extras")} value={extraFeaturesLabel} onEdit={() => onEdit(3)} />
          <ReviewRow label={t("newSearch.step5.preferences")} value={preferencesLabel} onEdit={() => onEdit(3)} />
          <ReviewRow label={t("newSearch.step5.otherPrefs")} value={targetLabel} onEdit={() => onEdit(4)} />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-t border-[#F3F4F6]" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
        <div className="max-w-lg mx-auto px-5 pt-4">
          <Button
            onClick={onSubmit}
            disabled={submitting}
            className="w-full h-[56px] rounded-[16px] bg-ha-primary hover:bg-ha-primary-hover text-white text-[17px] font-bold disabled:opacity-40 shadow-[0_4px_20px_rgba(217,26,104,0.3)]"
            data-testid="button-wizard-submit"
          >
            {submitting ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t("newSearch.step5.saving")}
              </div>
            ) : (
              <>
                <Search className="w-5 h-5 mr-2" />
                {isEditMode ? t("newSearch.step5.update") : t("newSearch.step5.save")}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
