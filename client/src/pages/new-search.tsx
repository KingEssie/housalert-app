import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { createSearchProfile, getSearchProfiles } from "@/lib/search-profiles";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { cityDistricts } from "../../../config/market";
import CityPicker, { type SelectedPlace } from "@/components/city-picker";
import {
  ArrowLeft,
  ArrowRight,
  Home as HomeIcon,
  Users,
  Building2,
  MapPin,
  Euro,
  BedDouble,
  Ruler,
  Armchair,
  TreePine,
  Bath,
  Car,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Search,
  ChevronDown,
} from "lucide-react";

const MAX_PROFILES = 4;
const TOTAL_STEPS = 6;

const PROPERTY_TYPES = [
  { id: "apartment", label: "Appartement / studio", icon: Building2, desc: "Zelfstandige woning" },
  { id: "room", label: "Kamer in gedeeld huis", icon: Users, desc: "Gedeelde woonruimte" },
  { id: "both", label: "Allebei", icon: HomeIcon, desc: "Alle woningtypes" },
];

const BEDROOM_OPTIONS = [
  { value: 0, label: "Studio" },
  { value: 1, label: "1 kamer" },
  { value: 2, label: "2 kamers" },
  { value: 3, label: "3 kamers" },
  { value: 4, label: "4+ kamers" },
];

const SIZE_OPTIONS = [
  { value: 0, label: "Geen voorkeur" },
  { value: 20, label: "20+ m²" },
  { value: 30, label: "30+ m²" },
  { value: 40, label: "40+ m²" },
  { value: 50, label: "50+ m²" },
  { value: 60, label: "60+ m²" },
  { value: 80, label: "80+ m²" },
  { value: 100, label: "100+ m²" },
];

const EXTRA_PREFERENCES = [
  { id: "balcony", label: "Balkon", icon: TreePine },
  { id: "garden", label: "Tuin", icon: TreePine },
  { id: "bath", label: "Badkuip", icon: Bath },
  { id: "parking", label: "Parkeerplaats", icon: Car },
  { id: "furnished", label: "Gemeubileerd", icon: Armchair },
];

const ADDITIONAL_FILTERS = [
  { id: "paid_sites", label: "Toon ook betaalde woningsites" },
  { id: "temporary", label: "Inclusief tijdelijke huur" },
  { id: "corporations", label: "Woningcorporaties" },
];

interface WizardData {
  propertyType: string;
  city: string;
  districts: string[];
  priceMin: string;
  priceMax: string;
  bedroomsMin: number;
  sizeMin: number;
  furnished: boolean;
  extras: string[];
  additionalFilters: string[];
}

export default function NewSearchPage() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null);

  const [data, setData] = useState<WizardData>({
    propertyType: "",
    city: "",
    districts: [],
    priceMin: "",
    priceMax: "",
    bedroomsMin: 0,
    sizeMin: 0,
    furnished: false,
    extras: [],
    additionalFilters: [],
  });

  const profilesQuery = useQuery({
    queryKey: ["/search-profiles"],
    queryFn: getSearchProfiles,
    enabled: !!user,
  });

  const profileCount = profilesQuery.data?.length ?? 0;
  const atLimit = profileCount >= MAX_PROFILES;

  const cityName = selectedPlace?.city_name ?? data.city;

  const estimateQuery = useQuery({
    queryKey: ["/api/estimate", cityName, data.priceMin, data.priceMax, data.bedroomsMin, data.sizeMin],
    queryFn: async () => {
      const params = new URLSearchParams({ city: cityName });
      if (data.priceMin) params.set("minPrice", data.priceMin);
      if (data.priceMax) params.set("maxPrice", data.priceMax);
      if (data.bedroomsMin > 0) params.set("minRooms", String(data.bedroomsMin));
      if (data.sizeMin > 0) params.set("minSize", String(data.sizeMin));
      const res = await fetch(`/api/estimate?${params}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!cityName && step >= 3,
    staleTime: 30000,
  });

  const availableDistricts = cityDistricts[cityName] ?? [];

  const update = useCallback((partial: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...partial }));
  }, []);

  const canProceed = (): boolean => {
    switch (step) {
      case 1: return !!data.propertyType;
      case 2: return !!selectedPlace;
      case 3: return true;
      case 4: return true;
      case 5: return true;
      case 6: return true;
      default: return false;
    }
  };

  const goNext = () => {
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    }
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
    if (!selectedPlace) {
      toast({ title: "Stad is verplicht", variant: "destructive" });
      setStep(2);
      return;
    }

    const parsedPriceMin = parseInt(data.priceMin) || 0;
    const parsedPriceMax = parseInt(data.priceMax) || 0;

    if (parsedPriceMax > 0 && parsedPriceMin > parsedPriceMax) {
      toast({ title: "Min prijs kan niet hoger zijn dan max prijs", variant: "destructive" });
      setStep(3);
      return;
    }

    setSubmitting(true);
    try {
      const profile = await createSearchProfile({
        user_id: user!.id,
        city_name: selectedPlace.city_name,
        country_code: selectedPlace.country_code,
        latitude: selectedPlace.latitude,
        longitude: selectedPlace.longitude,
        place_id: selectedPlace.place_id,
        price_min: parsedPriceMin,
        price_max: parsedPriceMax,
        bedrooms_min: data.bedroomsMin,
        size_min: data.sizeMin,
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
            title="Wat zoek je?"
            subtitle="Kies het type woning dat bij je past."
          >
            <div className="flex flex-col gap-3">
              <p className="text-[13px] font-[500] text-[#6B7280] -mt-2 mb-1">
                Type-filtering wordt binnenkort actief. Selecteer alvast je voorkeur.
              </p>
              {PROPERTY_TYPES.map((pt) => {
                const Icon = pt.icon;
                const selected = data.propertyType === pt.id;
                return (
                  <button
                    key={pt.id}
                    onClick={() => update({ propertyType: pt.id })}
                    className={`w-full flex items-center gap-4 p-4 rounded-[14px] border-2 transition-all text-left ${
                      selected
                        ? "border-[#673DE5] bg-[#DCDBFA]"
                        : "border-[#E5E7EB] bg-white hover:border-[#E5E7EB]"
                    }`}
                    data-testid={`option-type-${pt.id}`}
                  >
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${
                      selected ? "bg-[#673DE5]" : "bg-[#F3F4F6]"
                    }`}>
                      <Icon className={`w-5 h-5 ${selected ? "text-white" : "text-[#6B7280]"}`} />
                    </div>
                    <div>
                      <p className={`text-[15px] font-semibold ${selected ? "text-[#673DE5]" : "text-[#111827]"}`}>
                        {pt.label}
                      </p>
                      <p className="text-[13px] font-[500] text-[#6B7280]">{pt.desc}</p>
                    </div>
                    {selected && <CheckCircle2 className="w-5 h-5 text-[#673DE5] ml-auto flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </StepContainer>
        )}

        {step === 2 && (
          <StepContainer
            title="Waar zoek je?"
            subtitle="Kies een stad en optioneel wijken."
          >
            <div className="flex flex-col gap-5">
              <div>
                <label className="text-[16px] font-[700] text-[#111827] mb-3 block">Stad</label>
                <CityPicker
                  value={selectedPlace}
                  onChange={(place) => {
                    setSelectedPlace(place);
                    update({ city: place?.city_name ?? "", districts: [] });
                  }}
                />
              </div>

              {availableDistricts.length > 0 && (
                <div>
                  <label className="text-[16px] font-[700] text-[#111827] mb-3 block">
                    Wijken <span className="font-normal text-[13px] text-[#6B7280]">(optioneel, binnenkort actief)</span>
                  </label>
                  <p className="text-[13px] font-[500] text-[#6B7280] mb-2">Wijkfiltering wordt binnenkort toegepast.</p>
                  <div className="flex flex-wrap gap-2">
                    {availableDistricts.map((d) => {
                      const selected = data.districts.includes(d);
                      return (
                        <button
                          key={d}
                          onClick={() => {
                            update({
                              districts: selected
                                ? data.districts.filter((x) => x !== d)
                                : [...data.districts, d],
                            });
                          }}
                          className={`px-3.5 py-2 rounded-full text-[13px] font-medium border transition-all ${
                            selected
                              ? "border-[#673DE5] bg-[#DCDBFA] text-[#673DE5]"
                              : "border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#E5E7EB]"
                          }`}
                          data-testid={`chip-district-${d}`}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </StepContainer>
        )}

        {step === 3 && (
          <StepContainer
            title="Wat is je budget?"
            subtitle="Stel je prijsrange in."
          >
            <div className="flex flex-col gap-6">
              <div>
                <label className="text-[16px] font-[700] text-[#111827] mb-3 block">Minimale huur</label>
                <div className="relative">
                  <Euro className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                  <input
                    type="number"
                    value={data.priceMin}
                    onChange={(e) => update({ priceMin: e.target.value })}
                    placeholder="0"
                    min="0"
                    className="w-full h-[52px] pl-10 pr-4 rounded-xl border-0 bg-[#F3F4F6] text-[15px] font-medium text-[#111827] placeholder:text-[#6B7280] placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[#673DE5]/15 focus:bg-[#F8FAFC] transition-all"
                    data-testid="input-price-min"
                  />
                </div>
              </div>
              <div>
                <label className="text-[16px] font-[700] text-[#111827] mb-3 block">Maximale huur</label>
                <div className="relative">
                  <Euro className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                  <input
                    type="number"
                    value={data.priceMax}
                    onChange={(e) => update({ priceMax: e.target.value })}
                    placeholder="2000"
                    min="0"
                    className="w-full h-[52px] pl-10 pr-4 rounded-xl border-0 bg-[#F3F4F6] text-[15px] font-medium text-[#111827] placeholder:text-[#6B7280] placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[#673DE5]/15 focus:bg-[#F8FAFC] transition-all"
                    data-testid="input-price-max"
                  />
                </div>
              </div>

              <EstimateBadge estimate={estimateQuery.data} loading={estimateQuery.isLoading} />
            </div>
          </StepContainer>
        )}

        {step === 4 && (
          <StepContainer
            title="Basisvereisten"
            subtitle="Hoeveel kamers en ruimte heb je nodig?"
          >
            <div className="flex flex-col gap-6">
              <div>
                <label className="text-[16px] font-[700] text-[#111827] mb-3 block">
                  <BedDouble className="w-4 h-4 inline mr-1.5 text-[#673DE5]" />
                  Slaapkamers
                </label>
                <div className="flex flex-wrap gap-2">
                  {BEDROOM_OPTIONS.map((opt) => {
                    const selected = data.bedroomsMin === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => update({ bedroomsMin: opt.value })}
                        className={`px-4 py-2.5 rounded-xl text-[14px] font-medium border-0 transition-all ${
                          selected
                            ? "bg-[#DCDBFA] text-[#673DE5] ring-2 ring-[#673DE5]/20"
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
                  Minimum oppervlakte
                </label>
                <div className="flex flex-wrap gap-2">
                  {SIZE_OPTIONS.map((opt) => {
                    const selected = data.sizeMin === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => update({ sizeMin: opt.value })}
                        className={`px-4 py-2.5 rounded-xl text-[14px] font-medium border-0 transition-all ${
                          selected
                            ? "bg-[#DCDBFA] text-[#673DE5] ring-2 ring-[#673DE5]/20"
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

              <EstimateBadge estimate={estimateQuery.data} loading={estimateQuery.isLoading} />
            </div>
          </StepContainer>
        )}

        {step === 5 && (
          <StepContainer
            title="Extra voorkeuren"
            subtitle="Optioneel — selecteer wat belangrijk voor je is."
          >
            <div className="flex flex-col gap-3">
              {EXTRA_PREFERENCES.map((pref) => {
                const Icon = pref.icon;
                const selected = data.extras.includes(pref.id);
                return (
                  <button
                    key={pref.id}
                    onClick={() => {
                      update({
                        extras: selected
                          ? data.extras.filter((x) => x !== pref.id)
                          : [...data.extras, pref.id],
                      });
                    }}
                    className={`w-full flex items-center gap-4 p-4 rounded-[14px] border-2 transition-all text-left ${
                      selected
                        ? "border-[#673DE5] bg-[#DCDBFA]"
                        : "border-[#E5E7EB] bg-white hover:border-[#E5E7EB]"
                    }`}
                    data-testid={`option-extra-${pref.id}`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      selected ? "bg-[#673DE5]" : "bg-[#F3F4F6]"
                    }`}>
                      <Icon className={`w-4.5 h-4.5 ${selected ? "text-white" : "text-[#6B7280]"}`} />
                    </div>
                    <span className={`text-[15px] font-medium flex-1 ${selected ? "text-[#673DE5]" : "text-[#111827]"}`}>
                      {pref.label}
                    </span>
                    {selected && <CheckCircle2 className="w-5 h-5 text-[#673DE5] flex-shrink-0" />}
                  </button>
                );
              })}
              <p className="text-[13px] font-[500] text-[#6B7280] mt-2">
                Deze voorkeuren helpen ons betere matches te vinden. Ze worden binnenkort actief als filter.
              </p>
            </div>
          </StepContainer>
        )}

        {step === 6 && (
          <StepContainer
            title="Aanvullende filters"
            subtitle="Verfijn je zoekopdracht verder."
          >
            <div className="flex flex-col gap-3">
              {ADDITIONAL_FILTERS.map((filter) => {
                const selected = data.additionalFilters.includes(filter.id);
                return (
                  <button
                    key={filter.id}
                    onClick={() => {
                      update({
                        additionalFilters: selected
                          ? data.additionalFilters.filter((x) => x !== filter.id)
                          : [...data.additionalFilters, filter.id],
                      });
                    }}
                    className={`w-full flex items-center gap-4 p-4 rounded-[14px] border-2 transition-all text-left ${
                      selected
                        ? "border-[#673DE5] bg-[#DCDBFA]"
                        : "border-[#E5E7EB] bg-white hover:border-[#E5E7EB]"
                    }`}
                    data-testid={`option-filter-${filter.id}`}
                  >
                    <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                      selected ? "border-[#673DE5] bg-[#673DE5]" : "border-[#E5E7EB]"
                    }`}>
                      {selected && <CheckCircle2 className="w-4 h-4 text-white" />}
                    </div>
                    <span className={`text-[15px] font-medium ${selected ? "text-[#673DE5]" : "text-[#111827]"}`}>
                      {filter.label}
                    </span>
                  </button>
                );
              })}
              <p className="text-[13px] font-[500] text-[#6B7280] mt-2">
                Deze filters worden binnenkort toegepast op je zoekresultaten.
              </p>

              <EstimateBadge estimate={estimateQuery.data} loading={estimateQuery.isLoading} />
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
              className="h-[48px] px-5 rounded-xl border-[#E5E7EB] text-[#111827] text-[15px] font-medium"
              data-testid="button-wizard-back"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Terug
            </Button>
          )}
          {step < TOTAL_STEPS ? (
            <Button
              onClick={goNext}
              disabled={!canProceed()}
              className="flex-1 h-[56px] rounded-xl bg-[#673DE5] hover:bg-[#5B30D6] text-white text-[16px] font-semibold disabled:opacity-50"
              data-testid="button-wizard-next"
            >
              Volgende
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitting || !data.city}
              className="flex-1 h-[56px] rounded-xl bg-[#673DE5] hover:bg-[#5B30D6] text-white text-[16px] font-semibold disabled:opacity-50"
              data-testid="button-wizard-submit"
            >
              {submitting ? (
                "Opslaan..."
              ) : (
                <>
                  <Search className="w-4 h-4 mr-1.5" />
                  Zoekopdracht starten
                </>
              )}
            </Button>
          )}
        </div>
      </div>
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

function EstimateBadge({ estimate, loading }: { estimate: any; loading: boolean }) {
  if (loading) {
    return (
      <div className="bg-[#DCDBFA] rounded-xl p-4 flex items-center gap-3 animate-pulse">
        <div className="w-9 h-9 rounded-full bg-[#673DE5]/10" />
        <div className="flex-1">
          <div className="h-3 bg-[#673DE5]/10 rounded w-32 mb-1" />
          <div className="h-3 bg-[#673DE5]/10 rounded w-24" />
        </div>
      </div>
    );
  }

  if (!estimate) return null;

  const count = estimate.last7dCount ?? 0;
  const perWeek = estimate.perWeekEstimate ?? count;

  return (
    <div className="bg-[#DCDBFA] rounded-xl p-4 flex items-center gap-3" data-testid="badge-estimate">
      <div className="w-9 h-9 rounded-full bg-[#673DE5]/10 flex items-center justify-center flex-shrink-0">
        <Sparkles className="w-4 h-4 text-[#673DE5]" />
      </div>
      <div>
        <p className="text-[14px] font-semibold text-[#111827]">
          ~{perWeek} {perWeek === 1 ? "match" : "matches"} per week
        </p>
        <p className="text-[13px] font-[500] text-[#6B7280]">
          {count} {count === 1 ? "woning" : "woningen"} in de afgelopen 7 dagen
        </p>
      </div>
    </div>
  );
}
