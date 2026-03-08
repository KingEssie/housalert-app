import { useState, useEffect } from "react";
import { MapPin, Check, ChevronRight, ExternalLink, Download, Sparkles } from "lucide-react";
import LocationModeSelector, {
  type LocationData,
  DEFAULT_LOCATION_DATA,
  isLocationValid,
} from "@/components/location-mode-selector";

const APP_DOMAIN = import.meta.env.VITE_APP_DOMAIN || "https://stekkies.replit.app";

const PROPERTY_TYPES = [
  { value: "any", label: "Alles" },
  { value: "appartement", label: "Appartement" },
  { value: "studio", label: "Studio" },
  { value: "kamer", label: "Kamer" },
  { value: "gedeeld", label: "Gedeeld" },
];

function EstimateBlock({ city, maxPrice }: { city: string; maxPrice: string }) {
  const [estimate, setEstimate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!city || !maxPrice || Number(maxPrice) <= 0) {
      setEstimate(null);
      return;
    }

    setLoading(true);
    const params = new URLSearchParams({ city, maxPrice });
    fetch(`/api/estimate?${params}`)
      .then((r) => r.json())
      .then((d) => setEstimate(d.perWeekEstimate ?? 0))
      .catch(() => setEstimate(null))
      .finally(() => setLoading(false));
  }, [city, maxPrice]);

  if (!city || !maxPrice || Number(maxPrice) <= 0) return null;

  return (
    <div
      className="flex items-center gap-3 bg-[#F0EDFC] rounded-[14px] px-4 py-3"
      data-testid="embed-estimate-block"
    >
      <div className="w-9 h-9 rounded-[10px] bg-[#673DE5] flex items-center justify-center flex-shrink-0">
        <Sparkles className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        {loading ? (
          <div className="h-4 w-48 bg-[#DCDBFA] rounded animate-pulse" />
        ) : estimate !== null ? (
          <p className="text-[14px] font-semibold text-[#111827] leading-snug">
            Met deze zoekopdracht kun je ~<span className="text-[#673DE5]">{estimate}</span> matches per week verwachten.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function CompletionScreen({ draftId }: { draftId: string }) {
  const continueUrl = `${APP_DOMAIN}/continue?draft=${draftId}`;

  return (
    <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
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
  const [locationData, setLocationData] = useState<LocationData>({ ...DEFAULT_LOCATION_DATA });
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("1500");
  const [propertyType, setPropertyType] = useState("any");
  const [submitting, setSubmitting] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const cityName =
    locationData.tab === "reistijd"
      ? locationData.commuteCity || locationData.commuteDestination.split(",")[0].trim()
      : locationData.place?.city_name ?? "";

  const countryCode =
    locationData.place?.country_code || "DE";

  const locationReady = isLocationValid(locationData);
  const budgetReady = maxPrice.trim() !== "" && Number(maxPrice) > 0;
  const cityReady = cityName.trim().length > 0;
  const canSubmit = locationReady && budgetReady && cityReady;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");

    const place = locationData.place;

    const locationMode = locationData.tab === "wijken"
      ? (locationData.districts.length > 0 ? "districts" : "city")
      : locationData.tab === "radius"
        ? "radius"
        : locationData.tab === "reistijd"
          ? "commute"
          : "city";

    const body: Record<string, unknown> = {
      country_code: countryCode,
      city_name: cityName,
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
      <div className="min-h-screen bg-[#F8FAFC] flex items-start justify-center p-4">
        <div className="w-full max-w-[480px] bg-white rounded-[20px] shadow-sm border border-[#E5E7EB] overflow-hidden">
          <CompletionScreen draftId={draftId} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-start justify-center px-4 py-5">
      <div className="w-full max-w-[480px]">
        <div className="text-center mb-5">
          <h1
            className="text-[22px] sm:text-[26px] font-extrabold text-[#111827] leading-tight"
            data-testid="embed-text-hero-title"
          >
            Ontdek hoeveel matches we voor jou gaan vinden.
          </h1>
          <p className="text-[14px] text-[#6B7280] mt-2">
            Stel je zoekopdracht in en ontvang direct matches.
          </p>
        </div>

        <div className="bg-white rounded-[20px] shadow-sm border border-[#E5E7EB] overflow-visible">
          <div className="px-5 pt-5 pb-2">
            <LocationModeSelector value={locationData} onChange={setLocationData} />
          </div>

          <div className="px-5 pt-3 pb-2 space-y-4">
            <div className="flex items-center gap-2 text-[13px] text-[#6B7280] bg-[#F8FAFC] rounded-[10px] px-3 py-2.5">
              <MapPin className="w-4 h-4 text-[#673DE5] flex-shrink-0" />
              <span>Voeg tot 4 zoekopdrachten toe.</span>
            </div>

            <div>
              <label className="text-[14px] font-semibold text-[#111827] mb-2 block">
                Woningtype
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PROPERTY_TYPES.map((pt) => (
                  <button
                    key={pt.value}
                    onClick={() => setPropertyType(pt.value)}
                    className={`px-3.5 py-2 rounded-full text-[13px] font-medium border transition-all ${
                      propertyType === pt.value
                        ? "border-[#673DE5] bg-[#DCDBFA] text-[#673DE5]"
                        : "border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#D1D5DB]"
                    }`}
                    data-testid={`embed-chip-property-${pt.value}`}
                  >
                    {pt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[14px] font-semibold text-[#111827] mb-2 block">
                Maandbudget
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-[13px]">
                    €
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="min"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className="w-full h-[44px] rounded-[12px] bg-[#F3F4F6] border border-[#E5E7EB] pl-7 pr-3 text-[14px] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#673DE5] focus:border-transparent"
                    data-testid="embed-input-min-price"
                  />
                </div>
                <span className="text-[#9CA3AF] text-[13px] font-medium">-</span>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-[13px]">
                    €
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="max"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="w-full h-[44px] rounded-[12px] bg-[#F3F4F6] border border-[#E5E7EB] pl-7 pr-3 text-[14px] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#673DE5] focus:border-transparent"
                    data-testid="embed-input-max-price"
                  />
                </div>
              </div>
            </div>

            <EstimateBlock city={cityName} maxPrice={maxPrice} />
          </div>

          {error && (
            <div className="mx-5 mt-2 p-3 rounded-[10px] bg-red-50 border border-red-200 text-red-700 text-[13px]" data-testid="embed-error">
              {error}
            </div>
          )}

          <div className="px-5 pt-3 pb-5">
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="w-full min-h-[52px] rounded-[14px] bg-[#673DE5] hover:bg-[#5B30D6] text-white font-bold text-[16px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
              data-testid="embed-button-submit"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Plaats zoekopdracht
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>

        <p className="text-center text-[11px] text-[#9CA3AF] mt-4">
          Powered by Stekkies
        </p>
      </div>
    </div>
  );
}
