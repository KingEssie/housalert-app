import { useState, useEffect } from "react";
import { MapPin, Check, ChevronRight, ExternalLink, Download, Sparkles, Search } from "lucide-react";
import LocationModeSelector, {
  type LocationData,
  DEFAULT_LOCATION_DATA,
  isLocationValid,
} from "@/components/location-mode-selector";

const APP_DOMAIN = import.meta.env.VITE_APP_DOMAIN || "https://housalert.de";

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
      className="flex items-center gap-3 bg-gradient-to-r from-[#E6FAF5] to-[#E6FAF5] rounded-lg px-4 py-3.5"
      data-testid="embed-estimate-block"
    >
      <div className="w-9 h-9 rounded-lg bg-[var(--yo-teal)] flex items-center justify-center flex-shrink-0">
        <Sparkles className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        {loading ? (
          <div className="h-4 w-48 bg-[#E6FAF5] rounded animate-pulse" />
        ) : estimate !== null ? (
          <p className="text-[13px] sm:text-[14px] font-semibold text-[var(--yo-dark)] leading-snug">
            ~<span className="text-[var(--yo-teal)] text-[15px] font-bold">{estimate}</span> matches per week verwacht
          </p>
        ) : null}
      </div>
    </div>
  );
}

function CompletionScreen({ draftId }: { draftId: string }) {
  const continueUrl = `${APP_DOMAIN}/continue?draft=${draftId}`;

  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="w-[56px] h-[56px] rounded-lg bg-[#E6FAF5] flex items-center justify-center mb-5">
        <Check className="w-7 h-7 text-[var(--yo-teal)]" />
      </div>

      <h2 className="text-[20px] font-bold text-[var(--yo-dark)] mb-1.5 uppercase tracking-wide" data-testid="embed-text-done-title">
        Je zoekopdracht is opgeslagen!
      </h2>
      <p className="text-[14px] text-[var(--yo-dark)] mb-7 max-w-[300px] leading-relaxed">
        Maak een account aan om direct meldingen te ontvangen zodra er een match verschijnt.
      </p>

      <div className="w-full max-w-[320px] space-y-2.5">
        <a
          href={continueUrl}
          target="_top"
          className="w-full min-h-[56px] rounded-lg bg-[var(--yo-teal)] hover:bg-[var(--yo-teal-hover)] text-black font-bold text-[15px] transition-all flex items-center justify-center gap-2 shadow-[0_2px_12px_rgba(0,0,0,0.3)]"
          data-testid="embed-link-continue-browser"
        >
          <ExternalLink className="w-4 h-4" />
          Ga verder in browser
        </a>

        <button
          className="w-full h-[56px] rounded-lg border border-[var(--yo-divider)] bg-white text-[var(--yo-dark)] font-semibold text-[14px] transition-colors flex items-center justify-center gap-2"
          data-testid="embed-button-download-app"
          onClick={() => window.open(continueUrl, "_top")}
        >
          <Download className="w-4 h-4" />
          Download de app
        </button>
      </div>

      <p className="text-[11px] text-[var(--yo-dark)] mt-6">
        Powered by HousAlert
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

  const countryCode = locationData.place?.country_code || "DE";

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
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="w-full max-w-[440px] bg-white rounded-lg border border-[var(--yo-divider)] shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden">
          <CompletionScreen draftId={draftId} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-start justify-center px-4 py-6 sm:py-8">
      <div className="w-full max-w-[440px]">

        <div className="text-center mb-5">
          <h1
            className="text-[21px] sm:text-[24px] font-extrabold text-[var(--yo-dark)] leading-[1.25] tracking-tight uppercase"
            data-testid="embed-text-hero-title"
          >
            Ontdek hoeveel matches we voor jou gaan vinden.
          </h1>
        </div>

        <div className="bg-white rounded-lg border border-[var(--yo-divider)] shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-visible">

          <div className="px-5 pt-5 pb-1">
            <LocationModeSelector
              value={locationData}
              onChange={setLocationData}
              segmentedTabs
              alwaysShowMap
            />
          </div>

          <div className="h-px bg-[var(--yo-divider)] mx-5 my-1" />

          <div className="px-5 py-3 space-y-3.5">

            <div>
              <label className="text-[13px] font-semibold text-[var(--yo-dark)] uppercase tracking-wide mb-2 block">
                Woningtype
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PROPERTY_TYPES.map((pt) => (
                  <button
                    key={pt.value}
                    onClick={() => setPropertyType(pt.value)}
                    className={`px-3.5 py-[7px] rounded-full text-[13px] font-medium transition-all ${
                      propertyType === pt.value
                        ? "bg-[var(--yo-teal)] text-black shadow-sm"
                        : "bg-[var(--yo-surface)] text-[var(--yo-dark)]"
                    }`}
                    data-testid={`embed-chip-property-${pt.value}`}
                  >
                    {pt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[13px] font-semibold text-[var(--yo-dark)] uppercase tracking-wide mb-2 block">
                Maandbudget
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--yo-dark)] text-[13px] font-medium">EUR</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="min"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className="w-full h-[42px] rounded-lg bg-[var(--yo-surface)] border-0 pl-[52px] pr-3 text-[14px] text-[var(--yo-dark)] placeholder:text-[var(--yo-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--yo-teal)]/40 transition-shadow"
                    data-testid="embed-input-min-price"
                  />
                </div>
                <div className="w-3 h-px bg-[var(--yo-divider)]" />
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--yo-dark)] text-[13px] font-medium">EUR</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="max"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="w-full h-[42px] rounded-lg bg-[var(--yo-surface)] border-0 pl-[52px] pr-3 text-[14px] text-[var(--yo-dark)] placeholder:text-[var(--yo-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--yo-teal)]/40 transition-shadow"
                    data-testid="embed-input-max-price"
                  />
                </div>
              </div>
            </div>

            <EstimateBlock city={cityName} maxPrice={maxPrice} />

            <div className="flex items-center gap-2 text-[12px] text-[var(--yo-dark)]">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Voeg tot 4 zoekopdrachten toe.</span>
            </div>
          </div>

          {error && (
            <div className="mx-5 mb-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[13px]" data-testid="embed-error">
              {error}
            </div>
          )}

          <div className="px-5 pb-5 pt-1">
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="w-full h-[56px] rounded-lg bg-[var(--yo-teal)] hover:bg-[var(--yo-teal-hover)] active:scale-[0.98] text-black font-bold text-[16px] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 shadow-[0_2px_12px_rgba(0,0,0,0.35)]"
              data-testid="embed-button-submit"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Search className="w-[18px] h-[18px]" />
                  Plaats zoekopdracht
                </>
              )}
            </button>
          </div>
        </div>

        <p className="text-center text-[11px] text-[var(--yo-dark)] mt-4">
          Powered by HousAlert
        </p>
      </div>
    </div>
  );
}
