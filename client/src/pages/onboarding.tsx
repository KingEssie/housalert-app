import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { createSearchProfile } from "@/lib/search-profiles";
import { Bell, MapPin, Search, ChevronRight, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import LocationModeSelector, { type LocationData, type SelectedPlace, DEFAULT_LOCATION_DATA, isLocationValid } from "@/components/location-mode-selector";

const PROPERTY_TYPES = [
  { value: "studio", label: "Studio" },
  { value: "appartement", label: "Appartement" },
  { value: "kamer", label: "Kamer" },
  { value: "gedeeld", label: "Gedeeld appartement" },
  { value: "any", label: "Maakt niet uit" },
];

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2 px-6 pt-6 pb-2">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className="h-[4px] flex-1 rounded-full transition-colors duration-300"
          style={{ backgroundColor: i < step ? "var(--yo-teal)" : "#EEEEEE" }}
          data-testid={`progress-step-${i + 1}`}
        />
      ))}
      <span className="text-[13px] font-medium text-[var(--yo-dark)] ml-1 whitespace-nowrap">
        {step}/{total}
      </span>
    </div>
  );
}

function WelcomeStep({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <div
        className="w-[72px] h-[72px] rounded-lg bg-[#E6FAF5] flex items-center justify-center mb-8"
      >
        <Search className="w-8 h-8 text-[var(--yo-teal)]" />
      </div>

      <h1
        className="text-[28px] font-bold leading-tight text-[var(--yo-dark)] mb-4 max-w-[320px] uppercase tracking-wide"
        data-testid="text-welcome-title"
      >
        Vind huurwoningen sneller dan iedereen
      </h1>

      <p
        className="text-[16px] leading-relaxed text-[var(--yo-dark)] mb-10 max-w-[320px]"
        data-testid="text-welcome-subtitle"
      >
        Wij verzamelen woningen van meerdere websites en sturen je direct een match zodra er iets nieuws verschijnt.
      </p>

      <button
        onClick={onStart}
        className="w-full max-w-[320px] min-h-[56px] rounded-lg bg-[var(--yo-teal)] hover:bg-[var(--yo-teal-hover)] text-white font-bold text-[16px] transition-colors flex items-center justify-center gap-2 shadow-[0_2px_12px_rgba(0,0,0,0.25)]"
        data-testid="button-start-onboarding"
      >
        Start met zoeken
        <ChevronRight className="w-5 h-5" />
      </button>

      <p className="text-[13px] text-[var(--yo-dark)] mt-4" data-testid="text-duration-hint">
        Duurt minder dan 1 minuut
      </p>
    </div>
  );
}

function LocationStep({
  locationData,
  setLocationData,
  onNext,
}: {
  locationData: LocationData;
  setLocationData: (v: LocationData) => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col min-h-screen px-6 pt-4">
      <div className="flex-1">
        <div className="w-[56px] h-[56px] rounded-lg bg-[#E6FAF5] flex items-center justify-center mb-6">
          <MapPin className="w-6 h-6 text-[var(--yo-teal)]" />
        </div>

        <h2 className="text-page-title mb-2" data-testid="text-city-title">
          Waar wil je wonen?
        </h2>
        <p className="text-subtitle mb-6">
          Kies een locatie, wijken, straal of reistijd.
        </p>

        <LocationModeSelector value={locationData} onChange={setLocationData} />
      </div>

      <div className="pb-8 pt-4">
        <button
          onClick={onNext}
          disabled={!isLocationValid(locationData)}
          className="w-full min-h-[56px] rounded-lg bg-[var(--yo-teal)] hover:bg-[var(--yo-teal-hover)] text-white font-bold text-[16px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_2px_12px_rgba(0,0,0,0.25)]"
          data-testid="button-city-next"
        >
          Volgende
        </button>
      </div>
    </div>
  );
}

function BudgetStep({
  minPrice,
  maxPrice,
  setMinPrice,
  setMaxPrice,
  onNext,
}: {
  minPrice: string;
  maxPrice: string;
  setMinPrice: (v: string) => void;
  setMaxPrice: (v: string) => void;
  onNext: () => void;
}) {
  const valid =
    maxPrice.trim() !== "" &&
    Number(maxPrice) > 0 &&
    (minPrice.trim() === "" || Number(minPrice) < Number(maxPrice));

  return (
    <div className="flex flex-col min-h-screen px-6 pt-4">
      <div className="flex-1">
        <div className="w-[56px] h-[56px] rounded-lg bg-[#E6FAF5] flex items-center justify-center mb-6">
          <span className="text-[24px] font-bold text-[var(--yo-teal)]">&#8364;</span>
        </div>

        <h2 className="text-page-title mb-2" data-testid="text-budget-title">
          Wat is je maandbudget?
        </h2>
        <p className="text-subtitle mb-6">
          We zoeken alleen woningen binnen je prijsklasse.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-[13px] font-semibold text-[var(--yo-dark)] uppercase tracking-wide mb-1.5">
              Minimale huurprijs (optioneel)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--yo-dark)] text-[15px]">&#8364;</span>
              <input
                type="number"
                inputMode="numeric"
                placeholder="0"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="w-full min-h-[56px] rounded-lg bg-[var(--yo-surface)] border border-[var(--yo-divider)] pl-9 pr-4 text-[16px] text-[var(--yo-dark)] placeholder:text-[var(--yo-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--yo-teal)] focus:border-transparent"
                data-testid="input-min-price"
              />
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[var(--yo-dark)] uppercase tracking-wide mb-1.5">
              Maximale huurprijs
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--yo-dark)] text-[15px]">&#8364;</span>
              <input
                type="number"
                inputMode="numeric"
                placeholder="1500"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="w-full min-h-[56px] rounded-lg bg-[var(--yo-surface)] border border-[var(--yo-divider)] pl-9 pr-4 text-[16px] text-[var(--yo-dark)] placeholder:text-[var(--yo-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--yo-teal)] focus:border-transparent"
                data-testid="input-max-price"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="pb-8 pt-4">
        <button
          onClick={onNext}
          disabled={!valid}
          className="w-full min-h-[56px] rounded-lg bg-[var(--yo-teal)] hover:bg-[var(--yo-teal-hover)] text-white font-bold text-[16px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_2px_12px_rgba(0,0,0,0.25)]"
          data-testid="button-budget-next"
        >
          Volgende
        </button>
      </div>
    </div>
  );
}

function PropertyTypeStep({
  propertyType,
  setPropertyType,
  onNext,
}: {
  propertyType: string;
  setPropertyType: (v: string) => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col min-h-screen px-6 pt-4">
      <div className="flex-1">
        <div className="w-[56px] h-[56px] rounded-lg bg-[#E6FAF5] flex items-center justify-center mb-6">
          <Search className="w-6 h-6 text-[var(--yo-teal)]" />
        </div>

        <h2 className="text-page-title mb-2" data-testid="text-property-title">
          Wat zoek je?
        </h2>
        <p className="text-subtitle mb-6">
          Kies het type woning dat je zoekt.
        </p>

        <div className="space-y-3">
          {PROPERTY_TYPES.map((pt) => (
            <button
              key={pt.value}
              onClick={() => setPropertyType(pt.value)}
              className={`w-full min-h-[56px] rounded-lg border-2 px-5 text-left text-[16px] font-medium transition-all flex items-center justify-between ${
                propertyType === pt.value
                  ? "border-[var(--yo-teal)] bg-[#E6FAF5] text-[var(--yo-teal)]"
                  : "border-[var(--yo-divider)] bg-white text-[var(--yo-dark)]"
              }`}
              data-testid={`option-property-${pt.value}`}
            >
              {pt.label}
              {propertyType === pt.value && (
                <div className="w-6 h-6 rounded-full bg-[var(--yo-teal)] flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="pb-8 pt-4">
        <button
          onClick={onNext}
          disabled={!propertyType}
          className="w-full min-h-[56px] rounded-lg bg-[var(--yo-teal)] hover:bg-[var(--yo-teal-hover)] text-white font-bold text-[16px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_2px_12px_rgba(0,0,0,0.25)]"
          data-testid="button-property-next"
        >
          Volgende
        </button>
      </div>
    </div>
  );
}

function AlertsStep({ onActivate, saving }: { onActivate: () => void; saving: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <div className="w-[72px] h-[72px] rounded-lg bg-[#E6FAF5] flex items-center justify-center mb-8">
        <Bell className="w-8 h-8 text-[var(--yo-teal)]" />
      </div>

      <h2
        className="text-[24px] font-bold text-[var(--yo-dark)] mb-3 max-w-[300px] uppercase tracking-wide"
        data-testid="text-alerts-title"
      >
        Mis nooit een nieuwe woning
      </h2>

      <p className="text-[16px] text-[var(--yo-dark)] mb-10 max-w-[300px] leading-relaxed">
        Je krijgt direct een melding zodra er een nieuwe match verschijnt.
      </p>

      <button
        onClick={onActivate}
        disabled={saving}
        className="w-full max-w-[320px] min-h-[56px] rounded-lg bg-[var(--yo-teal)] hover:bg-[var(--yo-teal-hover)] text-white font-bold text-[16px] transition-colors disabled:opacity-60 flex items-center justify-center gap-2 shadow-[0_2px_12px_rgba(0,0,0,0.25)]"
        data-testid="button-activate-alerts"
      >
        {saving ? (
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            <Bell className="w-5 h-5" />
            Zet meldingen aan
          </>
        )}
      </button>
    </div>
  );
}

export default function OnboardingPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [locationData, setLocationData] = useState<LocationData>({ ...DEFAULT_LOCATION_DATA });
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [saving, setSaving] = useState(false);

  const place = locationData.place;

  async function handleActivate() {
    if (!user) return;
    setSaving(true);

    const cityForProfile = locationData.tab === "reistijd"
      ? locationData.commuteCity || locationData.commuteDestination.split(",")[0].trim()
      : place?.city_name ?? "";

    const locationMode = locationData.tab === "wijken"
      ? (locationData.districts.length > 0 ? "districts" as const : "city" as const)
      : locationData.tab === "radius"
        ? "radius" as const
        : "commute" as const;

    try {
      await createSearchProfile({
        user_id: user.id,
        city_name: cityForProfile,
        country_code: place?.country_code,
        latitude: place?.latitude,
        longitude: place?.longitude,
        place_id: place?.place_id,
        price_min: minPrice ? Number(minPrice) : 0,
        price_max: Number(maxPrice),
        bedrooms_min: 1,
        size_min: 0,
        location_mode: locationMode,
        districts: locationData.districts.length > 0 ? locationData.districts : undefined,
        radius_km: locationData.tab === "radius" ? locationData.radiusKm : undefined,
        commute_destination: locationData.tab === "reistijd" ? locationData.commuteDestination : undefined,
        commute_lat: locationData.tab === "reistijd" ? locationData.commuteLat ?? undefined : undefined,
        commute_lng: locationData.tab === "reistijd" ? locationData.commuteLng ?? undefined : undefined,
        commute_mode: locationData.tab === "reistijd" ? locationData.commuteMode : undefined,
        commute_minutes: locationData.tab === "reistijd" ? locationData.commuteMinutes : undefined,
      });

      try {
        const session = await (await import("@/lib/supabase")).supabase.auth.getSession();
        const token = session.data.session?.access_token;
        if (token) {
          await fetch("/api/notifications/settings", {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              email_enabled: true,
              sms_enabled: false,
              whatsapp_enabled: false,
              phone_e164: null,
            }),
          });
        }
      } catch {
      }

      try {
        const session = await (await import("@/lib/supabase")).supabase.auth.getSession();
        const token = session.data.session?.access_token;
        if (token) {
          await fetch("/api/search-profiles/backfill", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ city: place?.city_name ?? "" }),
          });
        }
      } catch {
      }

      navigate("/dashboard?tab=matches");
    } catch (err: any) {
      console.error("[onboarding] Save failed:", err);
      toast({
        title: "Er ging iets mis",
        description: "Zoekopdracht opslaan mislukt. Controleer je locatie en probeer opnieuw.",
        variant: "destructive",
      });
      setSaving(false);
    }
  }

  if (step === 0) {
    return <WelcomeStep onStart={() => setStep(1)} />;
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <ProgressBar step={step} total={4} />

      {step === 1 && (
        <LocationStep locationData={locationData} setLocationData={setLocationData} onNext={() => setStep(2)} />
      )}
      {step === 2 && (
        <BudgetStep
          minPrice={minPrice}
          maxPrice={maxPrice}
          setMinPrice={setMinPrice}
          setMaxPrice={setMaxPrice}
          onNext={() => setStep(3)}
        />
      )}
      {step === 3 && (
        <PropertyTypeStep
          propertyType={propertyType}
          setPropertyType={setPropertyType}
          onNext={() => setStep(4)}
        />
      )}
      {step === 4 && (
        <AlertsStep onActivate={handleActivate} saving={saving} />
      )}
    </div>
  );
}
