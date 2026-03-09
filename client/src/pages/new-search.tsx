import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { createSearchProfile, getSearchProfiles } from "@/lib/search-profiles";
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
  Building,
  ChevronDown,
  ListChecks,
  Check,
} from "lucide-react";

const MAX_PROFILES = 4;
const TOTAL_STEPS = 4;

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
];

const FURNISHED_OPTIONS = [
  { value: "", label: "Maakt niet uit" },
  { value: "furnished", label: "Gemeubileerd" },
  { value: "unfurnished", label: "Niet gemeubileerd" },
];

const PROPERTY_TYPE_OPTIONS = [
  { value: "appartement", label: "Appartement", desc: "Flat of bovenwoning" },
  { value: "huis", label: "Huis", desc: "Eengezinswoning of rijtjeshuis" },
  { value: "studio", label: "Studio", desc: "Eenkamerwoning" },
  { value: "kamer", label: "Kamer", desc: "Kamer in gedeelde woning" },
  { value: "woonboot", label: "Woonboot", desc: "Wonen op het water" },
  { value: "overig", label: "Overig", desc: "Andere woningtypes" },
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
  propertyTypes: string[];
  extraFeatures: string[];
}

export default function NewSearchPage() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [locationData, setLocationData] = useState<LocationData>({ ...DEFAULT_BERLIN });

  const [filters, setFilters] = useState<FilterData>({
    priceMin: "",
    priceMax: "",
    bedroomsMin: 0,
    sizeMin: 0,
    furnished: "",
    propertyTypes: [],
    extraFeatures: [],
  });

  const profilesQuery = useQuery({
    queryKey: ["/search-profiles"],
    queryFn: getSearchProfiles,
    enabled: !!user,
  });

  const profileCount = profilesQuery.data?.length ?? 0;
  const atLimit = profileCount >= MAX_PROFILES;

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
  const goBack = () => { if (step > 1) setStep(step - 1); else navigate("/dashboard"); };

  async function handleSubmit() {
    if (atLimit) {
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

    const locationMode = locationData.tab === "wijken"
      ? (locationData.districts.length > 0 ? "districts" as const : "city" as const)
      : locationData.tab === "radius"
        ? "radius" as const
        : "commute" as const;

    setSubmitting(true);
    try {
      const profile = await createSearchProfile({
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
        districts: locationData.districts.length > 0 ? locationData.districts : undefined,
        radius_km: locationData.tab === "radius" ? locationData.radiusKm : undefined,
        commute_destination: locationData.tab === "reistijd" ? locationData.commuteDestination : undefined,
        commute_lat: locationData.tab === "reistijd" ? locationData.commuteLat ?? undefined : undefined,
        commute_lng: locationData.tab === "reistijd" ? locationData.commuteLng ?? undefined : undefined,
        commute_mode: locationData.tab === "reistijd" ? locationData.commuteMode : undefined,
        commute_minutes: locationData.tab === "reistijd" ? locationData.commuteMinutes : undefined,
        furnished: filters.furnished || undefined,
        property_types: filters.propertyTypes.length > 0 ? filters.propertyTypes : undefined,
        extra_features: filters.extraFeatures.length > 0 ? filters.extraFeatures : undefined,
      });

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
      navigate("/dashboard?tab=filters");
    } catch (err: any) {
      console.error("[new-search] Save failed:", err);
      toast({
        title: "Opslaan mislukt",
        description: "Zoekopdracht opslaan mislukt. Controleer je locatie en probeer opnieuw.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
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
        <WizardHeader step={0} total={0} onBack={() => navigate("/dashboard")} />
        <div className="flex-1 flex items-center justify-center px-5">
          <div className="bg-white rounded-lg shadow-[0_4px_20px_rgba(0,0,0,0.06)] p-8 text-center max-w-sm w-full border border-[var(--yo-divider)]">
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
      <WizardHeader step={step} total={TOTAL_STEPS} onBack={goBack} />

      <main className="flex-1 w-full max-w-lg mx-auto px-5 pt-5 pb-32">
        {step === 1 && <Step1Location locationData={locationData} setLocationData={setLocationData} />}
        {step === 2 && <Step2Requirements filters={filters} updateFilters={updateFilters} />}
        {step === 3 && <Step3ExtraFeatures filters={filters} updateFilters={updateFilters} />}
        {step === 4 && <Step4PropertyTypes filters={filters} updateFilters={updateFilters} perWeek={perWeek} estimateLoading={estimateQuery.isLoading} />}
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-[var(--yo-divider)] z-50">
        <div className="max-w-lg mx-auto px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex gap-3">
          {step > 1 && (
            <Button
              variant="outline"
              onClick={goBack}
              className="h-[56px] px-5 rounded-lg border-[var(--yo-divider)] text-[var(--yo-dark)] text-[15px] font-semibold"
              data-testid="button-wizard-back"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Vorige
            </Button>
          )}
          {step < TOTAL_STEPS ? (
            <Button
              onClick={goNext}
              disabled={!canProceed()}
              className="flex-1 h-[56px] rounded-lg bg-[var(--yo-teal)] hover:bg-[var(--yo-teal-hover)] text-black text-[16px] font-bold disabled:opacity-40 shadow-[0_2px_12px_rgba(0,0,0,0.25)]"
              data-testid="button-wizard-next"
            >
              Volgende
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitting || !isLocationValid(locationData)}
              className="flex-1 h-[56px] rounded-lg bg-[var(--yo-teal)] hover:bg-[var(--yo-teal-hover)] text-black text-[16px] font-bold disabled:opacity-40 shadow-[0_2px_12px_rgba(0,0,0,0.25)]"
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
                  Maak zoekopdracht aan
                </>
              )}
            </Button>
          )}
        </div>
      </div>
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

      <div className="bg-white rounded-lg shadow-[0_2px_16px_rgba(0,0,0,0.05)] overflow-visible border border-[var(--yo-divider)]">
        <div className="p-5">
          <LocationModeSelector
            value={locationData}
            onChange={setLocationData}
            segmentedTabs
            alwaysShowMap
            mapMaxHeight="40vh"
          />
        </div>
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

      <div className="bg-white rounded-lg shadow-[0_2px_16px_rgba(0,0,0,0.05)] p-5 space-y-6 border border-[var(--yo-divider)]">
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

        <div className="h-px bg-[var(--yo-divider)]" />

        <div>
          <label className="text-[15px] font-bold text-[var(--yo-dark)] mb-2.5 flex items-center gap-2">
            <BedDouble className="w-4 h-4 text-[var(--yo-teal)]" />
            Slaapkamers
          </label>
          <div className="flex flex-wrap gap-2">
            {BEDROOM_OPTIONS.map((opt) => {
              const selected = filters.bedroomsMin === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => updateFilters({ bedroomsMin: opt.value })}
                  className={`px-4 py-2.5 rounded-lg text-[14px] font-medium transition-all ${
                    selected
                      ? "bg-[var(--yo-teal)] text-black shadow-sm"
                      : "bg-[var(--yo-surface)] text-[var(--yo-dark)]"
                  }`}
                  data-testid={`option-bedrooms-${opt.value}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="text-[15px] font-bold text-[var(--yo-dark)] mb-2.5 flex items-center gap-2">
            <Ruler className="w-4 h-4 text-[var(--yo-teal)]" />
            Oppervlakte
          </label>
          <div className="flex flex-wrap gap-2">
            {SIZE_OPTIONS.map((opt) => {
              const selected = filters.sizeMin === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => updateFilters({ sizeMin: opt.value })}
                  className={`px-4 py-2.5 rounded-lg text-[14px] font-medium transition-all ${
                    selected
                      ? "bg-[var(--yo-teal)] text-black shadow-sm"
                      : "bg-[var(--yo-surface)] text-[var(--yo-dark)]"
                  }`}
                  data-testid={`option-size-${opt.value}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-px bg-[var(--yo-divider)]" />

        <div>
          <label className="text-[15px] font-bold text-[var(--yo-dark)] mb-2.5 flex items-center gap-2">
            <Sofa className="w-4 h-4 text-[var(--yo-teal)]" />
            Gemeubileerd
          </label>
          <div className="flex flex-wrap gap-2">
            {FURNISHED_OPTIONS.map((opt) => {
              const selected = filters.furnished === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => updateFilters({ furnished: opt.value })}
                  className={`px-4 py-2.5 rounded-lg text-[14px] font-medium transition-all ${
                    selected
                      ? "bg-[var(--yo-teal)] text-black shadow-sm"
                      : "bg-[var(--yo-surface)] text-[var(--yo-dark)]"
                  }`}
                  data-testid={`option-furnished-${opt.value || "any"}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
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

      <div className="flex flex-col gap-3">
        {EXTRA_FEATURE_OPTIONS.map((opt) => {
          const selected = filters.extraFeatures.includes(opt.value);
          return (
            <button
              key={opt.value}
              onClick={() => toggleFeature(opt.value)}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-lg border-2 transition-all text-left ${
                selected
                  ? "border-[var(--yo-teal)] bg-[var(--yo-teal)]/5"
                  : "border-[var(--yo-divider)] bg-white"
              }`}
              data-testid={`option-feature-${opt.value}`}
            >
              <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                selected
                  ? "bg-[var(--yo-teal)] border-[var(--yo-teal)]"
                  : "border-[var(--yo-divider)]"
              }`}>
                {selected && <Check className="w-3.5 h-3.5 text-black" />}
              </div>
              <span className="text-[16px] font-medium text-[var(--yo-dark)]">{opt.label}</span>
            </button>
          );
        })}
      </div>

      {filters.extraFeatures.length === 0 && (
        <p className="text-[13px] text-[var(--yo-dark)] opacity-60 text-center">
          Geen selectie = alle eigenschappen worden meegenomen
        </p>
      )}
    </div>
  );
}

function Step4PropertyTypes({
  filters,
  updateFilters,
  perWeek,
  estimateLoading,
}: {
  filters: FilterData;
  updateFilters: (partial: Partial<FilterData>) => void;
  perWeek: number;
  estimateLoading: boolean;
}) {
  const toggleType = (val: string) => {
    const arr = filters.propertyTypes;
    updateFilters({ propertyTypes: arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val] });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-page-title mb-1.5" data-testid="text-step-title">
          Woningtypes
        </h2>
        <p className="text-subtitle">
          Welk type woning zoek je? Selecteer een of meerdere.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {PROPERTY_TYPE_OPTIONS.map((opt) => {
          const selected = filters.propertyTypes.includes(opt.value);
          return (
            <button
              key={opt.value}
              onClick={() => toggleType(opt.value)}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-lg border-2 transition-all text-left ${
                selected
                  ? "border-[var(--yo-teal)] bg-[var(--yo-teal)]/5"
                  : "border-[var(--yo-divider)] bg-white"
              }`}
              data-testid={`option-type-${opt.value}`}
            >
              <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                selected
                  ? "bg-[var(--yo-teal)] border-[var(--yo-teal)]"
                  : "border-[var(--yo-divider)]"
              }`}>
                {selected && <Check className="w-3.5 h-3.5 text-black" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[16px] font-medium text-[var(--yo-dark)]">{opt.label}</p>
                <p className="text-[13px] text-[var(--yo-dark)] opacity-60">{opt.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {filters.propertyTypes.length === 0 && (
        <p className="text-[13px] text-[var(--yo-dark)] opacity-60 text-center">
          Geen selectie = alle woningtypes worden meegenomen
        </p>
      )}

      {!estimateLoading && (
        <div className="bg-[var(--yo-chip-bg)] rounded-lg p-4 flex items-start gap-3" data-testid="card-estimate-inline">
          <Sparkles className="w-5 h-5 text-[var(--yo-teal)] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[14px] font-semibold text-[var(--yo-dark)]">
              Verwacht: ~{perWeek} matches per week
            </p>
            {perWeek === 0 && (
              <p className="text-[13px] text-[var(--yo-dark)] opacity-70 mt-1">
                Dit zoekprofiel ontvangt momenteel naar verwachting weinig of geen matches. Je kunt het altijd later aanpassen.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function WizardHeader({ step, total, onBack }: { step: number; total: number; onBack: () => void }) {
  const progress = total > 0 ? (step / total) * 100 : 0;

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-[var(--yo-divider)]">
      <div className="max-w-lg mx-auto flex items-center h-[56px] px-5">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-[var(--yo-surface)] flex items-center justify-center mr-3 active:scale-95 transition-transform"
          data-testid="button-wizard-header-back"
        >
          <ArrowLeft className="w-4 h-4 text-[var(--yo-dark)]" />
        </button>
        <h1 className="text-[17px] font-bold text-[var(--yo-dark)] flex-1 uppercase tracking-wide">Nieuwe zoekopdracht</h1>
        {total > 0 && (
          <span className="text-[13px] font-semibold text-[var(--yo-pink)] bg-[var(--yo-pink-light)] px-2.5 py-1 rounded-full">
            {step}/{total}
          </span>
        )}
      </div>
      {total > 0 && (
        <div className="h-[3px] bg-[var(--yo-divider)]">
          <div
            className="h-full bg-[var(--yo-pink)] transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
            data-testid="progress-wizard"
          />
        </div>
      )}
    </header>
  );
}
