import { useState, useCallback, useEffect } from "react";
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
  CheckCircle2,
  Shield,
  Zap,
  Bell,
  Crown,
} from "lucide-react";

const MAX_PROFILES = 4;
const TOTAL_STEPS = 3;

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

interface FilterData {
  priceMin: string;
  priceMax: string;
  bedroomsMin: number;
  sizeMin: number;
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
      case 2: return true;
      case 3: return true;
      default: return false;
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
      navigate("/dashboard");
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
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#673DE5] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) { navigate("/login"); return null; }

  if (atLimit) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
        <WizardHeader step={0} total={0} onBack={() => navigate("/dashboard")} />
        <div className="flex-1 flex items-center justify-center px-5">
          <div className="bg-white rounded-[20px] shadow-[0_4px_20px_rgba(0,0,0,0.06)] p-8 text-center max-w-sm w-full">
            <div className="w-14 h-14 rounded-[14px] bg-[#DCDBFA] flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-[#673DE5]" />
            </div>
            <h2 className="text-[18px] font-bold text-[#111827] mb-2">Limiet bereikt</h2>
            <p className="text-[14px] text-[#6B7280] mb-5">
              Je hebt al {MAX_PROFILES} zoekopdrachten. Verwijder eerst een bestaande om een nieuwe aan te maken.
            </p>
            <Button
              onClick={() => navigate("/dashboard")}
              className="w-full h-[52px] rounded-[14px] bg-[#673DE5] hover:bg-[#5B30D6] text-white text-[15px] font-bold"
              data-testid="button-back-to-dashboard-limit"
            >
              Terug naar dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      <WizardHeader step={step} total={TOTAL_STEPS} onBack={goBack} />

      <main className="flex-1 w-full max-w-lg mx-auto px-5 pt-5 pb-32">
        {step === 1 && <Step1Location locationData={locationData} setLocationData={setLocationData} />}
        {step === 2 && <Step2Filters filters={filters} updateFilters={updateFilters} />}
        {step === 3 && (
          <Step3Subscription
            cityName={cityForProfile}
            estimate={estimateQuery.data}
            estimateLoading={estimateQuery.isLoading}
          />
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-[#E5E7EB] z-10">
        <div className="max-w-lg mx-auto px-5 py-4 flex gap-3">
          {step > 1 && (
            <Button
              variant="outline"
              onClick={goBack}
              className="h-[52px] px-5 rounded-[14px] border-[#E5E7EB] text-[#111827] text-[15px] font-semibold"
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
              className="flex-1 h-[56px] rounded-[14px] bg-[#673DE5] hover:bg-[#5B30D6] text-white text-[16px] font-bold disabled:opacity-40 shadow-[0_2px_12px_rgba(103,61,229,0.25)]"
              data-testid="button-wizard-next"
            >
              Volgende
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitting || !isLocationValid(locationData)}
              className="flex-1 h-[56px] rounded-[14px] bg-[#673DE5] hover:bg-[#5B30D6] text-white text-[16px] font-bold disabled:opacity-40 shadow-[0_2px_12px_rgba(103,61,229,0.25)]"
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
        <h2 className="text-[24px] sm:text-[28px] font-extrabold text-[#111827] tracking-tight leading-tight mb-1.5" data-testid="text-step-title">
          Selecteer locatie op basis van
        </h2>
        <p className="text-[15px] text-[#6B7280]">
          Kies een methode en configureer je zoekgebied.
        </p>
      </div>

      <div className="bg-white rounded-[20px] shadow-[0_2px_16px_rgba(0,0,0,0.05)] overflow-visible">
        <div className="p-5">
          <LocationModeSelector
            value={locationData}
            onChange={setLocationData}
            segmentedTabs
            alwaysShowMap
          />
        </div>
      </div>
    </div>
  );
}

function Step2Filters({
  filters,
  updateFilters,
}: {
  filters: FilterData;
  updateFilters: (partial: Partial<FilterData>) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[24px] sm:text-[28px] font-extrabold text-[#111827] tracking-tight leading-tight mb-1.5" data-testid="text-step-title">
          Zoekcriteria
        </h2>
        <p className="text-[15px] text-[#6B7280]">
          Stel je budget en woningwensen in.
        </p>
      </div>

      <div className="bg-white rounded-[20px] shadow-[0_2px_16px_rgba(0,0,0,0.05)] p-5 space-y-6">
        <div>
          <label className="text-[15px] font-bold text-[#111827] mb-2.5 flex items-center gap-2">
            <Euro className="w-4 h-4 text-[#673DE5]" />
            Min prijs
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-[14px] font-medium">EUR</span>
            <input
              type="number"
              inputMode="numeric"
              value={filters.priceMin}
              onChange={(e) => updateFilters({ priceMin: e.target.value })}
              placeholder="0"
              min="0"
              className="w-full h-[52px] pl-[56px] pr-4 rounded-[14px] border-0 bg-[#F3F4F6] text-[15px] font-medium text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#673DE5]/20 transition-all"
              data-testid="input-price-min"
            />
          </div>
        </div>

        <div>
          <label className="text-[15px] font-bold text-[#111827] mb-2.5 flex items-center gap-2">
            <Euro className="w-4 h-4 text-[#673DE5]" />
            Max prijs
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-[14px] font-medium">EUR</span>
            <input
              type="number"
              inputMode="numeric"
              value={filters.priceMax}
              onChange={(e) => updateFilters({ priceMax: e.target.value })}
              placeholder="2000"
              min="0"
              className="w-full h-[52px] pl-[56px] pr-4 rounded-[14px] border-0 bg-[#F3F4F6] text-[15px] font-medium text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#673DE5]/20 transition-all"
              data-testid="input-price-max"
            />
          </div>
        </div>

        <div className="h-px bg-[#F0F0F0]" />

        <div>
          <label className="text-[15px] font-bold text-[#111827] mb-2.5 flex items-center gap-2">
            <BedDouble className="w-4 h-4 text-[#673DE5]" />
            Slaapkamers
          </label>
          <div className="flex flex-wrap gap-2">
            {BEDROOM_OPTIONS.map((opt) => {
              const selected = filters.bedroomsMin === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => updateFilters({ bedroomsMin: opt.value })}
                  className={`px-4 py-2.5 rounded-[12px] text-[14px] font-medium transition-all ${
                    selected
                      ? "bg-[#673DE5] text-white shadow-sm"
                      : "bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]"
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
          <label className="text-[15px] font-bold text-[#111827] mb-2.5 flex items-center gap-2">
            <Ruler className="w-4 h-4 text-[#673DE5]" />
            Oppervlakte
          </label>
          <div className="flex flex-wrap gap-2">
            {SIZE_OPTIONS.map((opt) => {
              const selected = filters.sizeMin === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => updateFilters({ sizeMin: opt.value })}
                  className={`px-4 py-2.5 rounded-[12px] text-[14px] font-medium transition-all ${
                    selected
                      ? "bg-[#673DE5] text-white shadow-sm"
                      : "bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]"
                  }`}
                  data-testid={`option-size-${opt.value}`}
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

function Step3Subscription({
  cityName,
  estimate,
  estimateLoading,
}: {
  cityName: string;
  estimate: any;
  estimateLoading: boolean;
}) {
  const perWeek = estimate?.perWeekEstimate ?? 0;
  const last7d = estimate?.last7dCount ?? 0;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[24px] sm:text-[28px] font-extrabold text-[#111827] tracking-tight leading-tight mb-1.5" data-testid="text-step-title">
          Klaar om te starten
        </h2>
        <p className="text-[15px] text-[#6B7280]">
          Bekijk je verwachte resultaten en activeer je zoekopdracht.
        </p>
      </div>

      <div className="bg-gradient-to-br from-[#673DE5] to-[#5B30D6] rounded-[20px] p-6 text-white shadow-[0_4px_24px_rgba(103,61,229,0.3)]" data-testid="card-estimate-hero">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-[12px] bg-white/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <p className="text-[13px] font-semibold text-white/80 uppercase tracking-wide">Verwachte resultaten</p>
        </div>

        {estimateLoading ? (
          <div className="space-y-3">
            <div className="h-8 bg-white/20 rounded-lg w-48 animate-pulse" />
            <div className="h-4 bg-white/20 rounded w-56 animate-pulse" />
          </div>
        ) : (
          <>
            <p className="text-[20px] sm:text-[22px] font-bold leading-snug mb-1" data-testid="text-estimate-sentence">
              Met deze zoekopdracht kun je <span className="text-[#CBFF02] text-[28px] sm:text-[32px] font-extrabold">{perWeek}</span> matches per week verwachten.
            </p>
            <p className="text-[14px] text-white/70 mt-2">
              {last7d} woningen gevonden in de afgelopen 7 dagen in {cityName || "je zoekgebied"}
            </p>
          </>
        )}
      </div>

      <div className="bg-white rounded-[20px] shadow-[0_2px_16px_rgba(0,0,0,0.05)] p-5 space-y-4" data-testid="card-benefits">
        <h3 className="text-[16px] font-bold text-[#111827]">Wat je krijgt</h3>
        <BenefitRow icon={Zap} title="Razendsnelle meldingen" desc="Ontvang nieuwe woningen binnen minuten na publicatie." />
        <BenefitRow icon={Bell} title="Meerdere kanalen" desc="Meldingen via e-mail, WhatsApp of SMS — jij kiest." />
        <BenefitRow icon={Shield} title="Betrouwbare data" desc="We scannen 50+ woningplatformen automatisch." />
        <BenefitRow icon={Crown} title="Tot 4 zoekopdrachten" desc="Zoek in meerdere steden of met verschillende criteria." />
      </div>

      <div className="bg-white rounded-[20px] shadow-[0_2px_16px_rgba(0,0,0,0.05)] p-5" data-testid="card-social-proof">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex -space-x-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-8 h-8 rounded-full bg-[#DCDBFA] border-2 border-white flex items-center justify-center"
              >
                <span className="text-[11px] font-bold text-[#673DE5]">
                  {["MK", "JR", "TS"][i]}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[13px] text-[#6B7280]">
            <span className="font-semibold text-[#111827]">2.400+</span> actieve zoekers
          </p>
        </div>
        <p className="text-[14px] text-[#6B7280] leading-relaxed">
          Sluit je aan bij duizenden gebruikers die al sneller een woning vinden met Stekkies.
        </p>
      </div>

      <div className="bg-[#F0EDFC] rounded-[20px] p-5 border border-[#DCDBFA]" data-testid="card-guarantee">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-[10px] bg-[#673DE5] flex items-center justify-center flex-shrink-0 mt-0.5">
            <CheckCircle2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-[15px] font-bold text-[#111827] mb-1">Gratis starten</p>
            <p className="text-[14px] text-[#6B7280] leading-relaxed">
              Je eerste zoekopdracht is gratis. Geen creditcard nodig. Upgrade later als je meer wilt.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function BenefitRow({ icon: Icon, title, desc }: { icon: typeof Zap; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3.5">
      <div className="w-9 h-9 rounded-[10px] bg-[#F0EDFC] flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-[#673DE5]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-[#111827]">{title}</p>
        <p className="text-[13px] text-[#6B7280] leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function WizardHeader({ step, total, onBack }: { step: number; total: number; onBack: () => void }) {
  const progress = total > 0 ? (step / total) * 100 : 0;

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-[#E5E7EB]">
      <div className="max-w-lg mx-auto flex items-center h-[56px] px-5">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-[#F3F4F6] flex items-center justify-center mr-3 active:scale-95 transition-transform"
          data-testid="button-wizard-header-back"
        >
          <ArrowLeft className="w-4 h-4 text-[#6B7280]" />
        </button>
        <h1 className="text-[17px] font-bold text-[#111827] flex-1">Nieuwe zoekopdracht</h1>
        {total > 0 && (
          <span className="text-[13px] font-semibold text-[#673DE5] bg-[#F0EDFC] px-2.5 py-1 rounded-full">
            {step}/{total}
          </span>
        )}
      </div>
      {total > 0 && (
        <div className="h-[3px] bg-[#F3F4F6]">
          <div
            className="h-full bg-[#673DE5] transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
            data-testid="progress-wizard"
          />
        </div>
      )}
    </header>
  );
}
