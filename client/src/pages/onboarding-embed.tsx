import { useState } from "react";
import { MapPin, Search, Check, ChevronRight, ChevronLeft, ExternalLink, Download, Globe } from "lucide-react";
import LocationModeSelector, {
  type LocationData,
  DEFAULT_LOCATION_DATA,
  isLocationValid,
} from "@/components/location-mode-selector";

const APP_DOMAIN = import.meta.env.VITE_APP_DOMAIN || "https://stekkies.replit.app";

const COUNTRIES = [
  { code: "DE", label: "Deutschland", flag: "DE" },
  { code: "AT", label: "Österreich", flag: "AT" },
  { code: "NL", label: "Nederland", flag: "NL" },
];

const PROPERTY_TYPES = [
  { value: "studio", label: "Studio" },
  { value: "appartement", label: "Appartement" },
  { value: "kamer", label: "Kamer" },
  { value: "gedeeld", label: "Gedeeld appartement" },
  { value: "any", label: "Maakt niet uit" },
];

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2 px-5 pt-5 pb-2">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className="h-[4px] flex-1 rounded-full transition-colors duration-300"
          style={{ backgroundColor: i < step ? "#673DE5" : "#E5E7EB" }}
          data-testid={`embed-progress-step-${i + 1}`}
        />
      ))}
      <span className="text-[13px] font-medium text-[#6B7280] ml-1 whitespace-nowrap">
        {step}/{total}
      </span>
    </div>
  );
}

function CountryStep({
  country,
  setCountry,
  onNext,
}: {
  country: string;
  setCountry: (v: string) => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col h-full px-5 pt-3">
      <div className="flex-1">
        <div className="w-[48px] h-[48px] rounded-[12px] bg-[#DCDBFA] flex items-center justify-center mb-5">
          <Globe className="w-5 h-5 text-[#673DE5]" />
        </div>

        <h2 className="text-[22px] font-bold text-[#111827] mb-1.5" data-testid="embed-text-country-title">
          In welk land zoek je?
        </h2>
        <p className="text-[14px] text-[#6B7280] mb-5">
          Kies het land waar je een huurwoning zoekt.
        </p>

        <div className="space-y-2.5">
          {COUNTRIES.map((c) => (
            <button
              key={c.code}
              onClick={() => setCountry(c.code)}
              className={`w-full min-h-[52px] rounded-[14px] border-2 px-4 text-left text-[15px] font-medium transition-all flex items-center justify-between ${
                country === c.code
                  ? "border-[#673DE5] bg-[#DCDBFA] text-[#673DE5]"
                  : "border-[#E5E7EB] bg-white text-[#111827] hover:border-[#673DE5]/40"
              }`}
              data-testid={`embed-option-country-${c.code}`}
            >
              <span>{c.label}</span>
              {country === c.code && (
                <div className="w-5 h-5 rounded-full bg-[#673DE5] flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="pb-5 pt-3">
        <button
          onClick={onNext}
          disabled={!country}
          className="w-full min-h-[48px] rounded-[14px] bg-[#673DE5] hover:bg-[#5B30D6] text-white font-semibold text-[15px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          data-testid="embed-button-country-next"
        >
          Volgende
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function LocationStep({
  locationData,
  setLocationData,
  onNext,
  onBack,
}: {
  locationData: LocationData;
  setLocationData: (v: LocationData) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col h-full px-5 pt-3">
      <div className="flex-1 overflow-y-auto">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[13px] text-[#6B7280] hover:text-[#673DE5] mb-3 transition-colors"
          data-testid="embed-button-location-back"
        >
          <ChevronLeft className="w-4 h-4" />
          Terug
        </button>

        <div className="w-[48px] h-[48px] rounded-[12px] bg-[#DCDBFA] flex items-center justify-center mb-5">
          <MapPin className="w-5 h-5 text-[#673DE5]" />
        </div>

        <h2 className="text-[22px] font-bold text-[#111827] mb-1.5" data-testid="embed-text-location-title">
          Waar wil je wonen?
        </h2>
        <p className="text-[14px] text-[#6B7280] mb-5">
          Kies een locatie, wijken, straal of reistijd.
        </p>

        <LocationModeSelector value={locationData} onChange={setLocationData} />
      </div>

      <div className="pb-5 pt-3">
        <button
          onClick={onNext}
          disabled={!isLocationValid(locationData)}
          className="w-full min-h-[48px] rounded-[14px] bg-[#673DE5] hover:bg-[#5B30D6] text-white font-semibold text-[15px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          data-testid="embed-button-location-next"
        >
          Volgende
          <ChevronRight className="w-4 h-4" />
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
  onBack,
}: {
  minPrice: string;
  maxPrice: string;
  setMinPrice: (v: string) => void;
  setMaxPrice: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const valid =
    maxPrice.trim() !== "" &&
    Number(maxPrice) > 0 &&
    (minPrice.trim() === "" || Number(minPrice) < Number(maxPrice));

  return (
    <div className="flex flex-col h-full px-5 pt-3">
      <div className="flex-1">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[13px] text-[#6B7280] hover:text-[#673DE5] mb-3 transition-colors"
          data-testid="embed-button-budget-back"
        >
          <ChevronLeft className="w-4 h-4" />
          Terug
        </button>

        <div className="w-[48px] h-[48px] rounded-[12px] bg-[#DCDBFA] flex items-center justify-center mb-5">
          <span className="text-[22px] font-bold text-[#673DE5]">€</span>
        </div>

        <h2 className="text-[22px] font-bold text-[#111827] mb-1.5" data-testid="embed-text-budget-title">
          Wat is je maandbudget?
        </h2>
        <p className="text-[14px] text-[#6B7280] mb-5">
          We zoeken alleen woningen binnen je prijsklasse.
        </p>

        <div className="space-y-3.5">
          <div>
            <label className="block text-[13px] font-medium text-[#6B7280] mb-1.5">
              Minimale huurprijs (optioneel)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-[14px]">€</span>
              <input
                type="number"
                inputMode="numeric"
                placeholder="0"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="w-full min-h-[48px] rounded-[14px] bg-[#F3F4F6] border border-[#E5E7EB] pl-9 pr-4 text-[15px] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#673DE5] focus:border-transparent"
                data-testid="embed-input-min-price"
              />
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[#6B7280] mb-1.5">
              Maximale huurprijs
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-[14px]">€</span>
              <input
                type="number"
                inputMode="numeric"
                placeholder="1500"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="w-full min-h-[48px] rounded-[14px] bg-[#F3F4F6] border border-[#E5E7EB] pl-9 pr-4 text-[15px] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#673DE5] focus:border-transparent"
                data-testid="embed-input-max-price"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="pb-5 pt-3">
        <button
          onClick={onNext}
          disabled={!valid}
          className="w-full min-h-[48px] rounded-[14px] bg-[#673DE5] hover:bg-[#5B30D6] text-white font-semibold text-[15px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          data-testid="embed-button-budget-next"
        >
          Volgende
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function PropertyTypeStep({
  propertyType,
  setPropertyType,
  onSubmit,
  onBack,
  submitting,
}: {
  propertyType: string;
  setPropertyType: (v: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  submitting: boolean;
}) {
  return (
    <div className="flex flex-col h-full px-5 pt-3">
      <div className="flex-1">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[13px] text-[#6B7280] hover:text-[#673DE5] mb-3 transition-colors"
          data-testid="embed-button-property-back"
        >
          <ChevronLeft className="w-4 h-4" />
          Terug
        </button>

        <div className="w-[48px] h-[48px] rounded-[12px] bg-[#DCDBFA] flex items-center justify-center mb-5">
          <Search className="w-5 h-5 text-[#673DE5]" />
        </div>

        <h2 className="text-[22px] font-bold text-[#111827] mb-1.5" data-testid="embed-text-property-title">
          Wat zoek je?
        </h2>
        <p className="text-[14px] text-[#6B7280] mb-5">
          Kies het type woning dat je zoekt.
        </p>

        <div className="space-y-2.5">
          {PROPERTY_TYPES.map((pt) => (
            <button
              key={pt.value}
              onClick={() => setPropertyType(pt.value)}
              className={`w-full min-h-[52px] rounded-[14px] border-2 px-4 text-left text-[15px] font-medium transition-all flex items-center justify-between ${
                propertyType === pt.value
                  ? "border-[#673DE5] bg-[#DCDBFA] text-[#673DE5]"
                  : "border-[#E5E7EB] bg-white text-[#111827] hover:border-[#673DE5]/40"
              }`}
              data-testid={`embed-option-property-${pt.value}`}
            >
              {pt.label}
              {propertyType === pt.value && (
                <div className="w-5 h-5 rounded-full bg-[#673DE5] flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="pb-5 pt-3">
        <button
          onClick={onSubmit}
          disabled={!propertyType || submitting}
          className="w-full min-h-[48px] rounded-[14px] bg-[#673DE5] hover:bg-[#5B30D6] text-white font-semibold text-[15px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          data-testid="embed-button-submit"
        >
          {submitting ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              Opslaan
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function CompletionScreen({ draftId }: { draftId: string }) {
  const continueUrl = `${APP_DOMAIN}/continue?draft=${draftId}`;

  return (
    <div className="flex flex-col items-center justify-center h-full px-5 text-center">
      <div className="w-[56px] h-[56px] rounded-[14px] bg-[#DCDBFA] flex items-center justify-center mb-6">
        <Check className="w-7 h-7 text-[#673DE5]" />
      </div>

      <h2 className="text-[22px] font-bold text-[#111827] mb-2" data-testid="embed-text-done-title">
        Je zoekopdracht is opgeslagen!
      </h2>
      <p className="text-[14px] text-[#6B7280] mb-8 max-w-[300px] leading-relaxed">
        Maak een account aan om direct meldingen te ontvangen zodra er een match verschijnt.
      </p>

      <div className="w-full max-w-[320px] space-y-3">
        <a
          href={continueUrl}
          target="_top"
          className="w-full min-h-[48px] rounded-[14px] bg-[#673DE5] hover:bg-[#5B30D6] text-white font-semibold text-[15px] transition-colors flex items-center justify-center gap-2"
          data-testid="embed-link-continue-browser"
        >
          <ExternalLink className="w-4 h-4" />
          Ga verder in browser
        </a>

        <button
          className="w-full min-h-[48px] rounded-[14px] border-2 border-[#E5E7EB] bg-white text-[#111827] font-semibold text-[15px] hover:bg-[#F3F4F6] transition-colors flex items-center justify-center gap-2"
          data-testid="embed-button-download-app"
          onClick={() => {
            window.open(continueUrl, "_top");
          }}
        >
          <Download className="w-4 h-4" />
          Download de app
        </button>
      </div>

      <p className="text-[12px] text-[#9CA3AF] mt-6">
        Powered by Stekkies
      </p>
    </div>
  );
}

export default function OnboardingEmbedPage() {
  const [step, setStep] = useState(1);
  const [country, setCountry] = useState("DE");
  const [locationData, setLocationData] = useState<LocationData>({ ...DEFAULT_LOCATION_DATA });
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const TOTAL_STEPS = 4;

  async function handleSubmit() {
    setSubmitting(true);
    setError("");

    const place = locationData.place;
    const cityForProfile = locationData.tab === "reistijd"
      ? locationData.commuteCity || locationData.commuteDestination.split(",")[0].trim()
      : place?.city_name ?? "";

    const locationMode = locationData.tab === "wijken"
      ? (locationData.districts.length > 0 ? "districts" : "city")
      : locationData.tab === "radius"
        ? "radius"
        : locationData.tab === "reistijd"
          ? "commute"
          : "city";

    const body: Record<string, unknown> = {
      country_code: country,
      city_name: cityForProfile,
      latitude: place?.latitude,
      longitude: place?.longitude,
      place_id: place?.place_id,
      location_mode: locationMode,
      price_min: parseInt(minPrice) || 0,
      price_max: parseInt(maxPrice) || 0,
      property_type: propertyType,
    };

    if (locationData.districts.length > 0) body.districts = locationData.districts;
    if (locationData.tab === "radius") body.radius_km = locationData.radiusKm;
    if (locationData.tab === "reistijd") {
      body.commute_destination = locationData.commuteDestination;
      body.commute_lat = locationData.commuteLat;
      body.commute_lng = locationData.commuteLng;
      body.commute_mode = locationData.commuteMode;
      body.commute_minutes = locationData.commuteMinutes;
    }

    try {
      const res = await fetch("/api/onboarding-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || "Opslaan mislukt");
      }

      const { id } = await res.json();
      setDraftId(id);
    } catch (err: any) {
      setError(err.message || "Er is iets misgegaan. Probeer het opnieuw.");
    } finally {
      setSubmitting(false);
    }
  }

  if (draftId) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <CompletionScreen draftId={draftId} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <ProgressBar step={step} total={TOTAL_STEPS} />

      {error && (
        <div className="mx-5 mt-2 p-3 rounded-[10px] bg-red-50 border border-red-200 text-red-700 text-[13px]" data-testid="embed-error">
          {error}
        </div>
      )}

      <div className="flex-1 flex flex-col">
        {step === 1 && (
          <CountryStep country={country} setCountry={setCountry} onNext={() => setStep(2)} />
        )}
        {step === 2 && (
          <LocationStep
            locationData={locationData}
            setLocationData={setLocationData}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <BudgetStep
            minPrice={minPrice}
            maxPrice={maxPrice}
            setMinPrice={setMinPrice}
            setMaxPrice={setMaxPrice}
            onNext={() => setStep(4)}
            onBack={() => setStep(2)}
          />
        )}
        {step === 4 && (
          <PropertyTypeStep
            propertyType={propertyType}
            setPropertyType={setPropertyType}
            onSubmit={handleSubmit}
            onBack={() => setStep(3)}
            submitting={submitting}
          />
        )}
      </div>
    </div>
  );
}
