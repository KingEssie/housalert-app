import { useState, useCallback, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { createSearchProfile, updateSearchProfile, getSearchProfile, getSearchProfiles } from "@/lib/search-profiles";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
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
  { value: 0, label: "Geen voorkeur" },
  { value: 1, label: "1 kamer" },
  { value: 2, label: "2 kamers" },
  { value: 3, label: "3 kamers" },
  { value: 4, label: "4+ kamers" },
];

const SIZE_OPTIONS = [
  { value: 0, label: "Geen voorkeur" },
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
  { value: "", label: "Geen voorkeur" },
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
  { value: "", label: "Maakt niet uit" },
  { value: "furnished", label: "Gemeubileerd" },
  { value: "unfurnished", label: "Niet gemeubileerd" },
];

const TARGET_CATEGORY_OPTIONS = [
  { value: "studenten", label: "Studenten" },
  { value: "woningdelers", label: "Woningdelers" },
  { value: "huisdiereigenaren", label: "Huisdiereigenaren" },
  { value: "betaalde_websites", label: "Woningen van betaalde websites" },
  { value: "kamers_gedeeld", label: "Kamers in gedeelde woningen" },
  { value: "vrije_sector", label: "Vrije sector van woningcorporaties" },
  { value: "tijdelijke_woningen", label: "Tijdelijke woningen" },
  { value: "seniorenwoningen", label: "Seniorenwoningen" },
];

const EXTRA_FEATURE_OPTIONS = [
  { value: "balkon", label: "Balkon" },
  { value: "tuin", label: "Tuin" },
  { value: "huisdieren", label: "Huisdieren toegestaan" },
  { value: "parkeerplaats", label: "Parkeerplaats" },
  { value: "lift", label: "Lift" },
  { value: "kelder", label: "Kelder" },
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

export default function NewSearchPage() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
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
        toast({ title: "Zoekopdracht niet gevonden", variant: "destructive" });
        navigate("/dashboard?tab=filters");
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
  }, [editId, editLoaded, navigate, toast]);

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
      const res = await fetch(`/api/estimate?${params}`);
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
  const goBack = () => { if (step > 1) setStep(step - 1); else navigate("/dashboard?tab=filters"); };

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
      toast({ title: "Limiet bereikt", description: `Max ${MAX_PROFILES} zoekopdrachten.`, variant: "destructive" });
      return;
    }
    if (!isLocationValid(locationData)) {
      toast({ title: "Locatie is verplicht", variant: "destructive" });
      setStep(1);
      return;
    }

    const parsedPriceMin = parseInt(filters.priceMin) || 0;
    const parsedPriceMax = parseInt(filters.priceMax) || 0;

    if (parsedPriceMax > 0 && parsedPriceMin > parsedPriceMax) {
      toast({ title: "Min prijs kan niet hoger zijn dan max prijs", variant: "destructive" });
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
          fetch("/api/search-profiles/backfill", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ searchProfileId: editId }),
          }).catch(() => {});
        }
        queryClient.invalidateQueries({ queryKey: ["/search-profiles"] });
        queryClient.invalidateQueries({ queryKey: ["/api/profile-strength"] });
        toast({ title: "Zoekopdracht bijgewerkt!", description: "Je wijzigingen zijn opgeslagen." });
      } else {
        const profile = await createSearchProfile(payload);
        if (profile?.id) {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData?.session?.access_token;
          if (token) {
            fetch("/api/search-profiles/backfill", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ searchProfileId: profile.id }),
            }).catch(() => {});
          }
        }
        queryClient.invalidateQueries({ queryKey: ["/search-profiles"] });
        queryClient.invalidateQueries({ queryKey: ["/api/profile-strength"] });
        toast({ title: "Zoekopdracht aangemaakt!", description: "Je ontvangt nu matches." });
      }

      navigate("/dashboard?tab=filters");
    } catch (err: any) {
      console.error("[new-search] Save failed:", err);
      toast({
        title: "Opslaan mislukt",
        description: err?.message || "Zoekopdracht opslaan mislukt. Probeer opnieuw.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || (isEditMode && !editLoaded)) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--yo-teal)] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) { navigate("/login"); return null; }

  if (atLimit) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <header className="fixed top-0 left-0 right-0 z-50 bg-white">
          <div className="max-w-lg mx-auto flex items-center justify-between h-[56px] px-5">
            <button
              onClick={() => navigate("/dashboard")}
              className="w-10 h-10 rounded-full bg-[var(--yo-surface)] flex items-center justify-center"
              data-testid="button-wizard-header-back"
            >
              <ArrowLeft className="w-5 h-5 text-[var(--yo-dark)]" />
            </button>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center px-5 pt-[56px]">
          <div className="text-center max-w-sm w-full">
            <div className="w-14 h-14 rounded-lg bg-[var(--yo-chip-bg)] flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-[var(--yo-teal)]" />
            </div>
            <h2 className="text-[18px] font-bold text-[var(--yo-dark)] mb-2 uppercase">Limiet bereikt</h2>
            <p className="text-[14px] text-[var(--yo-dark)] mb-5">
              Je hebt al {MAX_PROFILES} zoekopdrachten. Verwijder eerst een bestaande om een nieuwe aan te maken.
            </p>
            <Button
              onClick={() => navigate("/dashboard")}
              className="w-full h-[56px] rounded-lg bg-[var(--yo-teal)] hover:bg-[var(--yo-teal-hover)] text-black text-[15px] font-bold"
              data-testid="button-back-to-dashboard-limit"
            >
              Terug naar dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const perWeek = estimateQuery.data?.perWeekEstimate ?? 0;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white">
        <div className="max-w-lg mx-auto flex items-center justify-between h-[56px] px-5">
          <button
            onClick={goBack}
            className="w-10 h-10 rounded-full bg-[var(--yo-surface)] flex items-center justify-center"
            data-testid="button-wizard-header-back"
          >
            <ArrowLeft className="w-5 h-5 text-[var(--yo-dark)]" />
          </button>
          <span className="text-[13px] font-medium text-[var(--yo-dark)] opacity-60" data-testid="text-step-indicator">
            Stap {step} van {TOTAL_STEPS}
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
            perWeek={perWeek}
            estimateLoading={estimateQuery.isLoading}
          />
        )}
      </main>

      {step < 5 && (
        <div className="fixed bottom-6 right-6 z-50" style={{ maxWidth: "calc(100% - 48px)" }}>
          <button
            onClick={step < TOTAL_STEPS - 1 ? goNext : () => setStep(5)}
            disabled={!canProceed()}
            className="w-14 h-14 rounded-full bg-[var(--yo-teal)] hover:bg-[var(--yo-teal-hover)] text-black flex items-center justify-center shadow-[0_4px_16px_rgba(0,0,0,0.2)] disabled:opacity-40 transition-all active:scale-95"
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
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-page-title mb-1.5" data-testid="text-step-title">
          Locatie
        </h2>
        <p className="text-subtitle">
          Kies een methode en configureer je zoekgebied.
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
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-page-title mb-1.5" data-testid="text-step-title">
          Vereisten
        </h2>
        <p className="text-subtitle">
          Stel je budget en basiswensen in.
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="text-[15px] font-bold text-[var(--yo-dark)] mb-2.5 flex items-center gap-2">
            <Euro className="w-4 h-4 text-[var(--yo-teal)]" />
            Min prijs
          </label>
          <div className="relative">
            <select
              value={filters.priceMin}
              onChange={(e) => updateFilters({ priceMin: e.target.value })}
              className="w-full h-[56px] px-4 pr-10 rounded-lg border-0 bg-[var(--yo-surface)] text-[15px] font-medium text-[var(--yo-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--yo-teal)]/20 transition-all appearance-none cursor-pointer"
              data-testid="select-price-min"
            >
              {RENT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--yo-dark)] pointer-events-none" />
          </div>
        </div>

        <div>
          <label className="text-[15px] font-bold text-[var(--yo-dark)] mb-2.5 flex items-center gap-2">
            <Euro className="w-4 h-4 text-[var(--yo-teal)]" />
            Max prijs
          </label>
          <div className="relative">
            <select
              value={filters.priceMax}
              onChange={(e) => updateFilters({ priceMax: e.target.value })}
              className="w-full h-[56px] px-4 pr-10 rounded-lg border-0 bg-[var(--yo-surface)] text-[15px] font-medium text-[var(--yo-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--yo-teal)]/20 transition-all appearance-none cursor-pointer"
              data-testid="select-price-max"
            >
              {RENT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--yo-dark)] pointer-events-none" />
          </div>
        </div>

        <div>
          <label className="text-[15px] font-bold text-[var(--yo-dark)] mb-2.5 flex items-center gap-2">
            <BedDouble className="w-4 h-4 text-[var(--yo-teal)]" />
            Slaapkamers
          </label>
          <div className="relative">
            <select
              value={filters.bedroomsMin}
              onChange={(e) => updateFilters({ bedroomsMin: parseInt(e.target.value) })}
              className="w-full h-[56px] px-4 pr-10 rounded-lg border-0 bg-[var(--yo-surface)] text-[15px] font-medium text-[var(--yo-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--yo-teal)]/20 transition-all appearance-none cursor-pointer"
              data-testid="select-bedrooms"
            >
              {BEDROOM_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--yo-dark)] pointer-events-none" />
          </div>
        </div>

        <div>
          <label className="text-[15px] font-bold text-[var(--yo-dark)] mb-2.5 flex items-center gap-2">
            <Ruler className="w-4 h-4 text-[var(--yo-teal)]" />
            Oppervlakte
          </label>
          <div className="relative">
            <select
              value={filters.sizeMin}
              onChange={(e) => updateFilters({ sizeMin: parseInt(e.target.value) })}
              className="w-full h-[56px] px-4 pr-10 rounded-lg border-0 bg-[var(--yo-surface)] text-[15px] font-medium text-[var(--yo-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--yo-teal)]/20 transition-all appearance-none cursor-pointer"
              data-testid="select-size"
            >
              {SIZE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--yo-dark)] pointer-events-none" />
          </div>
        </div>

        <div>
          <label className="text-[15px] font-bold text-[var(--yo-dark)] mb-2.5 flex items-center gap-2">
            <Sofa className="w-4 h-4 text-[var(--yo-teal)]" />
            Gemeubileerd
          </label>
          <div className="relative">
            <select
              value={filters.furnished}
              onChange={(e) => updateFilters({ furnished: e.target.value })}
              className="w-full h-[56px] px-4 pr-10 rounded-lg border-0 bg-[var(--yo-surface)] text-[15px] font-medium text-[var(--yo-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--yo-teal)]/20 transition-all appearance-none cursor-pointer"
              data-testid="select-furnished"
            >
              {FURNISHED_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--yo-dark)] pointer-events-none" />
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
      className="w-full flex items-center gap-4 py-4 border-b border-[var(--yo-divider)] last:border-b-0 text-left"
      data-testid={testId}
    >
      <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 border-2 transition-colors ${
        selected ? "bg-[var(--yo-teal)] border-[var(--yo-teal)]" : "border-[var(--yo-divider)] bg-white"
      }`}>
        {selected && <Check className="w-4 h-4 text-black" />}
      </div>
      <span className="text-[15px] font-medium text-[var(--yo-dark)]">{label}</span>
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
  const toggleFeature = (val: string) => {
    const arr = filters.extraFeatures;
    updateFilters({ extraFeatures: arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val] });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-page-title mb-1.5" data-testid="text-step-title">
          Extra eigenschappen
        </h2>
        <p className="text-subtitle">
          Selecteer gewenste voorzieningen. Overslaan kan ook.
        </p>
      </div>

      <div className="bg-white rounded-lg">
        {EXTRA_FEATURE_OPTIONS.map((opt) => (
          <CheckboxRow
            key={opt.value}
            label={opt.label}
            selected={filters.extraFeatures.includes(opt.value)}
            onToggle={() => toggleFeature(opt.value)}
            testId={`option-feature-${opt.value}`}
          />
        ))}
      </div>

      {filters.extraFeatures.length === 0 && (
        <p className="text-[13px] text-[var(--yo-dark)] opacity-60 text-center">
          Geen selectie = alle eigenschappen worden meegenomen
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
  const toggleCategory = (val: string) => {
    const arr = filters.targetCategories;
    updateFilters({ targetCategories: arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val] });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-page-title mb-1.5" data-testid="text-step-title">
          Doelgroepen & categorie&#235;n
        </h2>
        <p className="text-subtitle">
          Voor welke doelgroep of categorie zoek je? Selecteer een of meerdere.
        </p>
      </div>

      <div className="bg-white rounded-lg">
        {TARGET_CATEGORY_OPTIONS.map((opt) => (
          <CheckboxRow
            key={opt.value}
            label={opt.label}
            selected={filters.targetCategories.includes(opt.value)}
            onToggle={() => toggleCategory(opt.value)}
            testId={`option-category-${opt.value}`}
          />
        ))}
      </div>

      {filters.targetCategories.length === 0 && (
        <p className="text-[13px] text-[var(--yo-dark)] opacity-60 text-center">
          Geen selectie = alle categorie&#235;n worden meegenomen
        </p>
      )}
    </div>
  );
}

function ReviewRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="flex items-start justify-between py-3.5 border-b border-[var(--yo-divider)] last:border-b-0">
      <div className="flex-1 min-w-0 mr-3">
        <p className="text-[13px] font-medium text-[var(--yo-dark)] opacity-60 mb-0.5">{label}</p>
        <p className="text-[15px] font-semibold text-[var(--yo-dark)]">{value}</p>
      </div>
      <button
        onClick={onEdit}
        className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--yo-surface)] flex items-center justify-center hover:bg-[var(--yo-chip-bg)] transition-colors"
        data-testid={`button-review-edit-${label.toLowerCase().replace(/\s/g, "-")}`}
      >
        <Pencil className="w-3.5 h-3.5 text-[var(--yo-dark)]" />
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
  const locationLabel = locationData.tab === "reistijd"
    ? `Reistijd naar ${locationData.commuteDestination}`
    : locationData.tab === "radius"
      ? `${cityForProfile} (${locationData.radiusKm} km)`
      : cityForProfile;

  const districtsLabel = locationData.districts.length > 0
    ? locationData.districts.join(", ")
    : "Alle wijken";

  const priceLabel = (() => {
    const min = filters.priceMin ? `\u20AC${parseInt(filters.priceMin).toLocaleString("nl-NL")}` : "";
    const max = filters.priceMax ? `\u20AC${parseInt(filters.priceMax).toLocaleString("nl-NL")}` : "";
    if (min && max) return `${min} - ${max}`;
    if (min) return `Vanaf ${min}`;
    if (max) return `Tot ${max}`;
    return "Geen voorkeur";
  })();

  const bedroomsLabel = BEDROOM_OPTIONS.find(o => o.value === filters.bedroomsMin)?.label || "Geen voorkeur";
  const sizeLabel = SIZE_OPTIONS.find(o => o.value === filters.sizeMin)?.label || "Geen voorkeur";

  const extraFeaturesLabel = filters.extraFeatures.length > 0
    ? filters.extraFeatures.map(v => EXTRA_FEATURE_OPTIONS.find(o => o.value === v)?.label || v).join(", ")
    : "Geen selectie";

  const targetLabel = filters.targetCategories.length > 0
    ? filters.targetCategories.map(v => TARGET_CATEGORY_OPTIONS.find(o => o.value === v)?.label || v).join(", ")
    : "Geen selectie";

  return (
    <div className="pb-28">
      <div className="space-y-6">
        <div>
          <h2 className="text-page-title mb-1.5" data-testid="text-step-title">
            Controleer je zoekopdracht
          </h2>
          <p className="text-subtitle">
            Bekijk je instellingen en sla op.
          </p>
        </div>

        {!estimateLoading && (
          <div className="rounded-xl bg-[#0F172A] p-5 flex items-center gap-3" data-testid="card-review-estimate">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[15px] font-bold text-white">
                {perWeek > 0
                  ? `Verwacht: ~${perWeek} matches per week`
                  : "Nog geen matches verwacht"}
              </p>
              <p className="text-[13px] text-white/60 mt-0.5">
                {perWeek > 0
                  ? "Op basis van je zoekinstellingen"
                  : "Je kunt je filters later altijd aanpassen"}
              </p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg">
          <ReviewRow label="Locatie" value={locationLabel} onEdit={() => onEdit(1)} />
          {locationData.tab === "wijken" && (
            <ReviewRow label="Wijken" value={districtsLabel} onEdit={() => onEdit(1)} />
          )}
          <ReviewRow label="Huurprijs" value={priceLabel} onEdit={() => onEdit(2)} />
          <ReviewRow label="Slaapkamers" value={bedroomsLabel} onEdit={() => onEdit(2)} />
          <ReviewRow label="Oppervlakte" value={sizeLabel} onEdit={() => onEdit(2)} />
          <ReviewRow label="Extra eigenschappen" value={extraFeaturesLabel} onEdit={() => onEdit(3)} />
          <ReviewRow label="Overige voorkeuren" value={targetLabel} onEdit={() => onEdit(4)} />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[var(--yo-divider)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="max-w-lg mx-auto">
          <Button
            onClick={onSubmit}
            disabled={submitting}
            className="w-full h-[56px] rounded-lg bg-[var(--yo-teal)] hover:bg-[var(--yo-teal-hover)] text-black text-[16px] font-bold disabled:opacity-40 shadow-[0_2px_12px_rgba(0,0,0,0.25)]"
            data-testid="button-wizard-submit"
          >
            {submitting ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Opslaan...
              </div>
            ) : (
              <>
                <Search className="w-4 h-4 mr-1.5" />
                {isEditMode ? "Zoekopdracht bijwerken" : "Zoekopdracht opslaan"}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
