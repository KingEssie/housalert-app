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
  type LocationTab,
  DEFAULT_LOCATION_DATA,
  isLocationValid,
} from "@/components/location-mode-selector";
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  Euro,
  BedDouble,
  Ruler,
  Sparkles,
  AlertCircle,
  Search,
  Navigation,
  Clock,
  CheckCircle2,
} from "lucide-react";

const MAX_PROFILES = 4;
const TOTAL_STEPS = 4;

const LOCATION_METHODS: { id: LocationTab; label: string; desc: string; icon: typeof MapPin }[] = [
  { id: "wijken", label: "Wijken", desc: "Zoek in specifieke wijken van een stad", icon: MapPin },
  { id: "radius", label: "Radius", desc: "Zoek binnen een straal rondom een locatie", icon: Navigation },
  { id: "reistijd", label: "Reistijd", desc: "Zoek op basis van reistijd naar je werk", icon: Clock },
];

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
  const [locationData, setLocationData] = useState<LocationData>({ ...DEFAULT_LOCATION_DATA });

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
    enabled: !!cityForProfile && step >= 3,
    staleTime: 30000,
  });

  const updateFilters = useCallback((partial: Partial<FilterData>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
  }, []);

  const canProceed = (): boolean => {
    switch (step) {
      case 1: return true;
      case 2: return isLocationValid(locationData);
      case 3: return true;
      case 4: return true;
      default: return false;
    }
  };

  const goNext = () => {
    if (step < TOTAL_STEPS) setStep(step + 1);
  };

  const goBack = () => {
    if (step > 1) setStep(step - 1);
    else navigate("/dashboard");
  };

  async function handleSubmit() {
    if (atLimit) {
      toast({ title: "Limiet bereikt", description: `Max ${MAX_PROFILES} zoekopdrachten.`, variant: "destructive" });
      return;
    }
    if (!isLocationValid(locationData)) {
      toast({ title: "Locatie is verplicht", variant: "destructive" });
      setStep(2);
      return;
    }

    const parsedPriceMin = parseInt(filters.priceMin) || 0;
    const parsedPriceMax = parseInt(filters.priceMax) || 0;

    if (parsedPriceMax > 0 && parsedPriceMin > parsedPriceMax) {
      toast({ title: "Min prijs kan niet hoger zijn dan max prijs", variant: "destructive" });
      setStep(3);
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#673DE5] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) { navigate("/login"); return null; }

  if (atLimit) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <WizardHeader step={0} total={0} onBack={() => navigate("/dashboard")} />
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="bg-white rounded-[16px] shadow-[0_4px_16px_rgba(0,0,0,0.06)] p-8 text-center max-w-sm">
            <div className="w-14 h-14 rounded-full bg-[#DCDBFA] flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-[#673DE5]" />
            </div>
            <h2 className="text-[18px] font-bold text-[#111827] mb-2">Limiet bereikt</h2>
            <p className="text-[14px] text-[#6B7280] mb-5">
              Je hebt al {MAX_PROFILES} zoekopdrachten. Verwijder eerst een bestaande om een nieuwe aan te maken.
            </p>
            <Button
              onClick={() => navigate("/dashboard")}
              className="w-full h-[48px] rounded-xl bg-[#673DE5] hover:bg-[#5B30D6] text-white text-[15px] font-semibold"
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
    <div className="min-h-screen bg-white flex flex-col">
      <WizardHeader step={step} total={TOTAL_STEPS} onBack={goBack} />

      <main className="flex-1 max-w-xl mx-auto w-full px-6 pt-6 pb-32">
        {step === 1 && (
          <StepContainer
            title="Hoe wil je zoeken?"
            subtitle="Kies een locatiemethode om te starten."
          >
            <div className="flex flex-col gap-3">
              {LOCATION_METHODS.map((method) => {
                const Icon = method.icon;
                const selected = locationData.tab === method.id;
                return (
                  <button
                    key={method.id}
                    onClick={() => {
                      setLocationData({ ...locationData, tab: method.id });
                      goNext();
                    }}
                    className={`w-full flex items-center gap-4 p-4 rounded-[14px] border-2 transition-all text-left ${
                      selected
                        ? "border-[#673DE5] bg-[#DCDBFA]"
                        : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB]"
                    }`}
                    data-testid={`option-method-${method.id}`}
                  >
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${
                      selected ? "bg-[#673DE5]" : "bg-[#F3F4F6]"
                    }`}>
                      <Icon className={`w-5 h-5 ${selected ? "text-white" : "text-[#6B7280]"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[15px] font-semibold ${selected ? "text-[#673DE5]" : "text-[#111827]"}`}>
                        {method.label}
                      </p>
                      <p className="text-[13px] font-[500] text-[#6B7280]">{method.desc}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          </StepContainer>
        )}

        {step === 2 && (
          <StepContainer
            title={
              locationData.tab === "wijken"
                ? "Kies je stad en wijken"
                : locationData.tab === "radius"
                  ? "Kies locatie en straal"
                  : "Stel je reistijd in"
            }
            subtitle={
              locationData.tab === "wijken"
                ? "Zoek een stad en selecteer optioneel specifieke wijken."
                : locationData.tab === "radius"
                  ? "Zoek een stad en stel de zoekstraal in."
                  : "Vul je werkadres in en stel de maximale reistijd in."
            }
          >
            <LocationModeSelector
              value={locationData}
              onChange={(ld) => setLocationData(ld)}
              segmentedTabs
              alwaysShowMap
            />
          </StepContainer>
        )}

        {step === 3 && (
          <StepContainer
            title="Woningfilters"
            subtitle="Stel je budget en woonwensen in."
          >
            <div className="flex flex-col gap-6">
              <div>
                <label className="text-[16px] font-[700] text-[#111827] mb-3 block">
                  <Euro className="w-4 h-4 inline mr-1.5 text-[#673DE5]" />
                  Min prijs
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-[14px] font-medium">EUR</span>
                  <input
                    type="number"
                    value={filters.priceMin}
                    onChange={(e) => updateFilters({ priceMin: e.target.value })}
                    placeholder="0"
                    min="0"
                    className="w-full h-[52px] pl-[56px] pr-4 rounded-[14px] border-0 bg-[#F3F4F6] text-[15px] font-medium text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#673DE5]/20 focus:bg-[#F8FAFC] transition-all"
                    data-testid="input-price-min"
                  />
                </div>
              </div>

              <div>
                <label className="text-[16px] font-[700] text-[#111827] mb-3 block">
                  <Euro className="w-4 h-4 inline mr-1.5 text-[#673DE5]" />
                  Max prijs
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-[14px] font-medium">EUR</span>
                  <input
                    type="number"
                    value={filters.priceMax}
                    onChange={(e) => updateFilters({ priceMax: e.target.value })}
                    placeholder="2000"
                    min="0"
                    className="w-full h-[52px] pl-[56px] pr-4 rounded-[14px] border-0 bg-[#F3F4F6] text-[15px] font-medium text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#673DE5]/20 focus:bg-[#F8FAFC] transition-all"
                    data-testid="input-price-max"
                  />
                </div>
              </div>

              <div>
                <label className="text-[16px] font-[700] text-[#111827] mb-3 block">
                  <BedDouble className="w-4 h-4 inline mr-1.5 text-[#673DE5]" />
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
                <label className="text-[16px] font-[700] text-[#111827] mb-3 block">
                  <Ruler className="w-4 h-4 inline mr-1.5 text-[#673DE5]" />
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
          </StepContainer>
        )}

        {step === 4 && (
          <StepContainer
            title="Verwachte matches"
            subtitle="Op basis van je zoekopdracht verwachten we dit resultaat."
          >
            <div className="flex flex-col gap-5">
              <div className="bg-gradient-to-br from-[#F0EDFC] to-[#E8E4FA] rounded-[18px] p-6" data-testid="card-result-preview">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-[14px] bg-[#673DE5] flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-[#6B7280] uppercase tracking-wide">Verwachte resultaten</p>
                  </div>
                </div>

                {estimateQuery.isLoading ? (
                  <div className="space-y-3">
                    <div className="h-8 bg-[#DCDBFA] rounded-lg w-48 animate-pulse" />
                    <div className="h-4 bg-[#DCDBFA] rounded w-56 animate-pulse" />
                  </div>
                ) : estimateQuery.data ? (
                  <>
                    <p className="text-[18px] sm:text-[20px] font-bold text-[#111827] leading-snug mb-1" data-testid="text-estimate-sentence">
                      Met deze zoekopdracht kun je <span className="text-[#673DE5] text-[24px] sm:text-[28px] font-extrabold">{estimateQuery.data.perWeekEstimate ?? 0}</span> matches per week verwachten.
                    </p>
                    <p className="text-[14px] text-[#6B7280]">
                      {estimateQuery.data.last7dCount ?? 0} woningen gevonden in de afgelopen 7 dagen
                    </p>
                  </>
                ) : (
                  <p className="text-[14px] text-[#6B7280]">
                    Vul je locatie en filters in om een schatting te zien.
                  </p>
                )}
              </div>

              <div className="bg-[#F8FAFC] rounded-[14px] p-4 space-y-2.5">
                <p className="text-[13px] font-semibold text-[#6B7280] uppercase tracking-wide mb-2">Samenvatting</p>
                <SummaryRow label="Locatie" value={cityForProfile || "Niet ingesteld"} />
                <SummaryRow label="Methode" value={
                  locationData.tab === "wijken" ? "Wijken" : locationData.tab === "radius" ? "Radius" : "Reistijd"
                } />
                {filters.priceMax && <SummaryRow label="Budget" value={`${filters.priceMin || "0"} - ${filters.priceMax} EUR`} />}
                {filters.bedroomsMin > 0 && <SummaryRow label="Slaapkamers" value={`${filters.bedroomsMin}+`} />}
                {filters.sizeMin > 0 && <SummaryRow label="Oppervlakte" value={`${filters.sizeMin}+ m\u00B2`} />}
              </div>
            </div>
          </StepContainer>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] z-10">
        <div className="max-w-xl mx-auto px-6 py-4 flex gap-3">
          {step > 1 && (
            <Button
              variant="outline"
              onClick={goBack}
              className="h-[48px] px-5 rounded-[14px] border-[#E5E7EB] text-[#111827] text-[15px] font-medium"
              data-testid="button-wizard-back"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Vorige
            </Button>
          )}
          {step === 1 ? null : step < TOTAL_STEPS ? (
            <Button
              onClick={goNext}
              disabled={!canProceed()}
              className="flex-1 h-[56px] rounded-[14px] bg-[#673DE5] hover:bg-[#5B30D6] text-white text-[16px] font-bold disabled:opacity-50 shadow-[0_2px_12px_rgba(103,61,229,0.25)]"
              data-testid="button-wizard-next"
            >
              {step === 2 ? "Plaats zoekopdracht" : "Volgende"}
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitting || !isLocationValid(locationData)}
              className="flex-1 h-[56px] rounded-[14px] bg-[#673DE5] hover:bg-[#5B30D6] text-white text-[16px] font-bold disabled:opacity-50 shadow-[0_2px_12px_rgba(103,61,229,0.25)]"
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

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] text-[#6B7280]">{label}</span>
      <span className="text-[13px] font-semibold text-[#111827]">{value}</span>
    </div>
  );
}

function WizardHeader({ step, total, onBack }: { step: number; total: number; onBack: () => void }) {
  const progress = total > 0 ? (step / total) * 100 : 0;

  return (
    <header className="sticky top-0 z-10 bg-white border-b border-[#E5E7EB]">
      <div className="max-w-xl mx-auto flex items-center h-[60px] px-6">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-[#F3F4F6] flex items-center justify-center mr-3"
          data-testid="button-wizard-header-back"
        >
          <ArrowLeft className="w-4 h-4 text-[#6B7280]" />
        </button>
        <h1 className="text-[18px] font-bold text-[#111827] flex-1">Nieuwe zoekopdracht</h1>
        {total > 0 && (
          <span className="text-[13px] font-medium text-[#6B7280]">
            {step}/{total}
          </span>
        )}
      </div>
      {total > 0 && (
        <div className="h-[3px] bg-[#F3F4F6]">
          <div
            className="h-full bg-[#673DE5] transition-all duration-300"
            style={{ width: `${progress}%` }}
            data-testid="progress-wizard"
          />
        </div>
      )}
    </header>
  );
}

function StepContainer({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-[28px] font-[800] text-[#111827] tracking-[-0.03em] leading-[1.1] mb-2" data-testid="text-step-title">{title}</h2>
        <p className="text-[15px] text-[#6B7280]">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}
