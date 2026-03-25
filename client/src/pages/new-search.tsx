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
  ChevronDown,
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

const RENT_OPTIONS = [
  { value: "", labelKey: "newSearch.step2.noPref" },
  { value: "200", label: "\u20AC200" },
  { value: "300", label: "\u20AC300" },
  { value: "400", label: "\u20AC400" },
  { value: "500", label: "\u20AC500" },
  { value: "600", label: "\u20AC600" },
  { value: "700", label: "\u20AC700" },
  { value: "800", label: "\u20AC800" },
  { value: "900", label: "\u20AC900" },
  { value: "1000", label: "\u20AC1.000" },
  { value: "1200", label: "\u20AC1.200" },
  { value: "1500", label: "\u20AC1.500" },
  { value: "2000", label: "\u20AC2.000" },
  { value: "2500", label: "\u20AC2.500" },
  { value: "3000", label: "\u20AC3.000" },
  { value: "3500", label: "\u20AC3.500" },
  { value: "4000", label: "\u20AC4.000" },
  { value: "4500", label: "\u20AC4.500" },
  { value: "5000", label: "\u20AC5.000+" },
];

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
    priceMin: "",
    priceMax: "",
    bedroomsMin: 0,
    sizeMin: 0,
    furnished: "",
    targetCategories: [],
    extraFeatures: [],
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
      <div className="min-h-screen bg-[#1A1A2E] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#E91E63] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) { navigate("/login"); return null; }

  if (atLimit) {
    return (
      <div className="min-h-screen bg-[#1A1A2E] flex flex-col">
        <header className="fixed top-0 left-0 right-0 z-50 bg-[#1A1A2E]">
          <div className="max-w-lg mx-auto flex items-center justify-between h-[56px] px-5">
            <button
              onClick={() => window.history.length > 1 ? window.history.back() : navigate("/dashboard?tab=home")}
              className="w-12 h-12 rounded-full bg-[#252547] shadow-[0_1px_4px_rgba(0,0,0,0.2)] flex items-center justify-center"
              data-testid="button-wizard-header-back"
            >
              <ArrowLeft className="w-5 h-5 text-[#9CA3AF]" />
            </button>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center px-5 pt-[56px]">
          <div className="text-center max-w-sm w-full">
            <div className="w-14 h-14 rounded-lg bg-[#252547] flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-[#E91E63]" />
            </div>
            <h2 className="text-[18px] font-medium text-white mb-2">{t("newSearch.limitTitle")}</h2>
            <p className="text-[14px] text-[#9CA3AF] mb-5">
              {t("newSearch.limitDesc", { max: MAX_PROFILES })}
            </p>
            <Button
              onClick={() => window.history.length > 1 ? window.history.back() : navigate("/dashboard?tab=home")}
              className="w-full h-[56px] rounded-full bg-[#E91E63] hover:bg-[#D81B60] text-white text-[15px] font-medium"
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
    <div className="min-h-screen bg-[#1A1A2E] flex flex-col">
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#1A1A2E]">
        <div className="max-w-lg mx-auto flex items-center justify-between h-[56px] px-5">
          <button
            onClick={goBack}
            className="w-12 h-12 rounded-full bg-[#252547] shadow-[0_1px_4px_rgba(0,0,0,0.2)] flex items-center justify-center"
            data-testid="button-wizard-header-back"
          >
            <ArrowLeft className="w-5 h-5 text-[#9CA3AF]" />
          </button>
          <span className="text-[13px] font-medium text-[#9CA3AF]" data-testid="text-step-indicator">
            {t("newSearch.stepOf", { step, total: TOTAL_STEPS })}
          </span>
        </div>
      </header>

      <main className="flex-1 w-full max-w-lg mx-auto px-5 pt-[72px] pb-32">
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
        <div className="fixed bottom-6 right-6 z-50" style={{ maxWidth: "calc(100% - 48px)" }}>
          <button
            onClick={step < TOTAL_STEPS - 1 ? goNext : () => setStep(5)}
            disabled={!canProceed()}
            className="w-14 h-14 rounded-full bg-[#E91E63] hover:bg-[#D81B60] text-white flex items-center justify-center shadow-[0_4px_16px_rgba(0,0,0,0.3)] disabled:opacity-40 transition-all active:scale-95"
            data-testid="button-wizard-next"
          >
            <ArrowRight className="w-6 h-6" />
          </button>
        </div>
      )}
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
    <div className="space-y-5">
      <div>
        <h2 className="text-page-title mb-1.5" data-testid="text-step-title">
          {t("newSearch.step1.title")}
        </h2>
        <p className="text-subtitle">
          {t("newSearch.step1.subtitle")}
        </p>
      </div>

      <LocationModeSelector
        value={locationData}
        onChange={setLocationData}
        segmentedTabs
        alwaysShowMap
        mapMaxHeight="40vh"
      />
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
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-page-title mb-1.5" data-testid="text-step-title">
          {t("newSearch.step2.title")}
        </h2>
        <p className="text-subtitle">
          {t("newSearch.step2.subtitle")}
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="text-[15px] font-medium text-white mb-2.5 flex items-center gap-2">
            <Euro className="w-4 h-4 text-[#E91E63]" />
            {t("newSearch.step2.minPrice")}
          </label>
          <div className="relative">
            <select
              value={filters.priceMin}
              onChange={(e) => updateFilters({ priceMin: e.target.value })}
              className="w-full h-[60px] px-4 pr-10 rounded-[20px] border border-[#353560] bg-[#252547] text-[15px] font-medium text-white appearance-none cursor-pointer"
              data-testid="select-price-min"
            >
              {RENT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{resolveOptionLabel(opt, t)}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] pointer-events-none" />
          </div>
        </div>

        <div>
          <label className="text-[15px] font-medium text-white mb-2.5 flex items-center gap-2">
            <Euro className="w-4 h-4 text-[#E91E63]" />
            {t("newSearch.step2.maxPrice")}
          </label>
          <div className="relative">
            <select
              value={filters.priceMax}
              onChange={(e) => updateFilters({ priceMax: e.target.value })}
              className="w-full h-[60px] px-4 pr-10 rounded-[20px] border border-[#353560] bg-[#252547] text-[15px] font-medium text-white appearance-none cursor-pointer"
              data-testid="select-price-max"
            >
              {RENT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{resolveOptionLabel(opt, t)}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] pointer-events-none" />
          </div>
        </div>

        <div>
          <label className="text-[15px] font-medium text-white mb-2.5 flex items-center gap-2">
            <BedDouble className="w-4 h-4 text-[#E91E63]" />
            {t("newSearch.step2.bedrooms")}
          </label>
          <div className="relative">
            <select
              value={filters.bedroomsMin}
              onChange={(e) => updateFilters({ bedroomsMin: parseInt(e.target.value) })}
              className="w-full h-[60px] px-4 pr-10 rounded-[20px] border border-[#353560] bg-[#252547] text-[15px] font-medium text-white appearance-none cursor-pointer"
              data-testid="select-bedrooms"
            >
              {BEDROOM_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{resolveOptionLabel(opt, t)}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] pointer-events-none" />
          </div>
        </div>

        <div>
          <label className="text-[15px] font-medium text-white mb-2.5 flex items-center gap-2">
            <Ruler className="w-4 h-4 text-[#E91E63]" />
            {t("newSearch.step2.area")}
          </label>
          <div className="relative">
            <select
              value={filters.sizeMin}
              onChange={(e) => updateFilters({ sizeMin: parseInt(e.target.value) })}
              className="w-full h-[60px] px-4 pr-10 rounded-[20px] border border-[#353560] bg-[#252547] text-[15px] font-medium text-white appearance-none cursor-pointer"
              data-testid="select-size"
            >
              {SIZE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{resolveOptionLabel(opt, t)}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] pointer-events-none" />
          </div>
        </div>

        <div>
          <label className="text-[15px] font-medium text-white mb-2.5 flex items-center gap-2">
            <Sofa className="w-4 h-4 text-[#E91E63]" />
            {t("newSearch.step2.furnished")}
          </label>
          <div className="relative">
            <select
              value={filters.furnished}
              onChange={(e) => updateFilters({ furnished: e.target.value })}
              className="w-full h-[60px] px-4 pr-10 rounded-[20px] border border-[#353560] bg-[#252547] text-[15px] font-medium text-white appearance-none cursor-pointer"
              data-testid="select-furnished"
            >
              {FURNISHED_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{resolveOptionLabel(opt, t)}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckboxRow({
  label,
  selected,
  onToggle,
  testId,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center gap-4 py-4 border-b border-[#353560] last:border-b-0 text-left"
      data-testid={testId}
    >
      <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 border-2 transition-colors ${
        selected ? "bg-[#E91E63] border-[#E91E63]" : "border-[#E91E63] bg-transparent"
      }`}>
        {selected && <Check className="w-4 h-4 text-white" />}
      </div>
      <span className="text-[15px] font-medium text-white">{label}</span>
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
    <div className="space-y-5">
      <div>
        <h2 className="text-page-title mb-1.5" data-testid="text-step-title">
          {t("newSearch.step3.title")}
        </h2>
        <p className="text-subtitle">
          {t("newSearch.step3.subtitle")}
        </p>
      </div>

      <div className="bg-[#252547] rounded-lg border border-[#353560]">
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

      <div>
        <h3 className="text-[14px] font-medium text-white mb-1">{t("newSearch.step3.preferencesTitle")}</h3>
        <p className="text-[12px] text-[#9CA3AF] mb-2">{t("newSearch.step3.preferencesSubtitle")}</p>
        <div className="bg-[#252547] rounded-lg border border-[#353560]">
          {PREFERENCE_OPTIONS.map((opt) => (
            <div key={opt.value}>
              <CheckboxRow
                label={t(opt.labelKey)}
                selected={filters.extraFeatures.includes(opt.value)}
                onToggle={() => toggleFeature(opt.value)}
                testId={`option-pref-${opt.value}`}
              />
              {filters.extraFeatures.includes(opt.value) && (
                <p className="text-[11px] text-[#9CA3AF] px-4 pb-3 -mt-1">{t(opt.hintKey)}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {filters.extraFeatures.length === 0 && (
        <p className="text-[13px] text-[#9CA3AF] text-center">
          {t("newSearch.step3.noSelectionHint")}
        </p>
      )}
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
    <div className="space-y-5">
      <div>
        <h2 className="text-page-title mb-1.5" data-testid="text-step-title">
          {t("newSearch.step4.title")}
        </h2>
        <p className="text-subtitle">
          {t("newSearch.step4.subtitle")}
        </p>
      </div>

      <div className="bg-[#252547] rounded-lg border border-[#353560]">
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
        <p className="text-[13px] text-[#9CA3AF] text-center">
          {t("newSearch.step4.noSelectionHint")}
        </p>
      )}
    </div>
  );
}

function ReviewRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="flex items-start justify-between py-3.5 border-b border-[#353560] last:border-b-0">
      <div className="flex-1 min-w-0 mr-3">
        <p className="text-[13px] font-medium text-[#9CA3AF] mb-0.5">{label}</p>
        <p className="text-[15px] font-medium text-white">{value}</p>
      </div>
      <button
        onClick={onEdit}
        className="flex-shrink-0 w-8 h-8 rounded-full bg-[#353560] flex items-center justify-center hover:bg-[#4A4A70] transition-colors"
        data-testid={`button-review-edit-${label.toLowerCase().replace(/\s/g, "-")}`}
      >
        <Pencil className="w-3.5 h-3.5 text-[#9CA3AF]" />
      </button>
    </div>
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
    if (min && max) return `${min} - ${max}`;
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
      <div className="space-y-6">
        <div>
          <h2 className="text-page-title mb-1.5" data-testid="text-step-title">
            {t("newSearch.step5.title")}
          </h2>
          <p className="text-subtitle">
            {t("newSearch.step5.subtitle")}
          </p>
        </div>

        {!estimateLoading && (
          <div className="rounded-xl bg-[#252547] border border-[#353560] p-5 flex items-center gap-3" data-testid="card-review-estimate">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[15px] font-medium text-white">
                {perWeek > 0
                  ? t("newSearch.step5.estimate", perWeekRange)
                  : t("newSearch.step5.noMatchesExpected")}
              </p>
              <p className="text-[13px] text-white/60 mt-0.5">
                {perWeek > 0
                  ? t("newSearch.step5.estimateDesc")
                  : t("newSearch.step5.adjustFiltersLater")}
              </p>
            </div>
          </div>
        )}

        <div className="bg-[#252547] rounded-lg border border-[#353560]">
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

      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#1A1A2E] border-t border-[#353560] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="max-w-lg mx-auto">
          <Button
            onClick={onSubmit}
            disabled={submitting}
            className="w-full h-[56px] rounded-full bg-[#E91E63] hover:bg-[#D81B60] text-white text-[16px] font-medium disabled:opacity-40 shadow-[0_2px_12px_rgba(0,0,0,0.3)]"
            data-testid="button-wizard-submit"
          >
            {submitting ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t("newSearch.step5.saving")}
              </div>
            ) : (
              <>
                <Search className="w-4 h-4 mr-1.5" />
                {isEditMode ? t("newSearch.step5.update") : t("newSearch.step5.save")}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
