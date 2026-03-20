import { apiFetch } from "@/lib/api-base";
import { useState, useEffect } from "react";
import { MapPin, Check, ChevronRight, ExternalLink, Download, Sparkles, Search } from "lucide-react";
import { useTranslation } from "@/i18n";
import { getMatchEstimateRange } from "@/lib/match-estimate";
import LocationModeSelector, {
  type LocationData,
  DEFAULT_LOCATION_DATA,
  isLocationValid,
} from "@/components/location-mode-selector";

const APP_DOMAIN = import.meta.env.VITE_APP_DOMAIN || "https://www.housalert.com";

function EstimateBlock({ city, maxPrice }: { city: string; maxPrice: string }) {
  const { t } = useTranslation();
  const [estimate, setEstimate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!city || !maxPrice || Number(maxPrice) <= 0) {
      setEstimate(null);
      return;
    }

    setLoading(true);
    const params = new URLSearchParams({ city, maxPrice });
    apiFetch(`/api/estimate?${params}`)
      .then((r) => r.json())
      .then((d) => setEstimate(d.perWeekEstimate ?? 0))
      .catch(() => setEstimate(null))
      .finally(() => setLoading(false));
  }, [city, maxPrice]);

  if (!city || !maxPrice || Number(maxPrice) <= 0) return null;

  return (
    <div
      className="flex items-center gap-3 bg-gradient-to-r from-[#EBF2FF] to-[#EBF2FF] rounded-2xl px-4 py-3.5"
      data-testid="embed-estimate-block"
    >
      <div className="w-9 h-9 rounded-full bg-[#0D6EFD] flex items-center justify-center flex-shrink-0">
        <Sparkles className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        {loading ? (
          <div className="h-4 w-48 bg-[#EBF2FF] rounded animate-pulse" />
        ) : estimate !== null ? (
          <p className="text-[13px] sm:text-[14px] font-medium text-[#222222] leading-snug">
            <span className="text-[#0D6EFD] text-[15px] font-medium">{getMatchEstimateRange(estimate).low}–{getMatchEstimateRange(estimate).high}</span> {t("onboardingEmbed.matchesPerWeek")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function CompletionScreen({ draftId }: { draftId: string }) {
  const { t } = useTranslation();
  const continueUrl = `${APP_DOMAIN}/continue?draft=${draftId}`;

  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="w-[56px] h-[56px] rounded-2xl bg-[#EBF2FF] flex items-center justify-center mb-5">
        <Check className="w-7 h-7 text-[#0D6EFD]" />
      </div>

      <h2 className="text-[20px] font-medium text-[#222222] mb-1.5 tracking-wide" data-testid="embed-text-done-title">
        {t("onboardingEmbed.doneTitle")}
      </h2>
      <p className="text-[14px] text-[#222222] mb-7 max-w-[300px] leading-relaxed">
        {t("onboardingEmbed.doneSubtitle")}
      </p>

      <div className="w-full max-w-[320px] space-y-2.5">
        <a
          href={continueUrl}
          target="_top"
          className="w-full min-h-[56px] rounded-full bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white font-medium text-[15px] transition-all flex items-center justify-center gap-2 shadow-[0_2px_12px_rgba(0,0,0,0.3)]"
          data-testid="embed-link-continue-browser"
        >
          <ExternalLink className="w-4 h-4" />
          {t("onboardingEmbed.continueInBrowser")}
        </a>

        <button
          className="w-full h-[56px] rounded-full border border-[#E5E7EB] bg-white text-[#222222] font-medium text-[14px] transition-colors flex items-center justify-center gap-2"
          data-testid="embed-button-download-app"
          onClick={() => window.open(continueUrl, "_top")}
        >
          <Download className="w-4 h-4" />
          {t("onboardingEmbed.downloadApp")}
        </button>
      </div>

      <p className="text-[11px] text-[#222222] mt-6">
        Powered by HousAlert
      </p>
    </div>
  );
}

export default function OnboardingEmbedPage() {
  const { t } = useTranslation();
  const [locationData, setLocationData] = useState<LocationData>({ ...DEFAULT_LOCATION_DATA });
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("1500");
  const [propertyType, setPropertyType] = useState("any");
  const [submitting, setSubmitting] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const PROPERTY_TYPES = [
    { value: "any", label: t("onboardingEmbed.propertyTypes.any") },
    { value: "appartement", label: t("onboardingEmbed.propertyTypes.apartment") },
    { value: "studio", label: t("onboardingEmbed.propertyTypes.studio") },
    { value: "kamer", label: t("onboardingEmbed.propertyTypes.room") },
    { value: "gedeeld", label: t("onboardingEmbed.propertyTypes.shared") },
  ];

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
      const res = await apiFetch("/api/onboarding-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || t("onboardingEmbed.saveFailed"));
      }

      const { id } = await res.json();
      setDraftId(id);
    } catch (err: any) {
      setError(err.message || t("onboardingEmbed.genericError"));
    } finally {
      setSubmitting(false);
    }
  }

  if (draftId) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="w-full max-w-[440px] bg-white rounded-[24px] border border-[#F0F0F0] shadow-[0_2px_8px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)] shadow-[0_2px_8px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)] overflow-hidden">
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
            className="text-[21px] sm:text-[24px] font-medium text-[#222222] leading-[1.25] tracking-tight"
            data-testid="embed-text-hero-title"
          >
            {t("onboardingEmbed.heroTitle")}
          </h1>
        </div>

        <div className="bg-white rounded-[24px] border border-[#F0F0F0] shadow-[0_2px_8px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)] shadow-[0_2px_8px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)] overflow-visible">

          <div className="px-5 pt-5 pb-1">
            <LocationModeSelector
              value={locationData}
              onChange={setLocationData}
              segmentedTabs
              alwaysShowMap
            />
          </div>

          <div className="h-px bg-[#E5E7EB] mx-5 my-1" />

          <div className="px-5 py-3 space-y-3.5">

            <div>
              <label className="text-[13px] font-medium text-[#222222] tracking-wide mb-2 block">
                {t("onboardingEmbed.propertyType")}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PROPERTY_TYPES.map((pt) => (
                  <button
                    key={pt.value}
                    onClick={() => setPropertyType(pt.value)}
                    className={`px-3.5 py-[7px] rounded-full text-[13px] font-medium transition-all ${
                      propertyType === pt.value
                        ? "bg-[#0D6EFD] text-white shadow-sm"
                        : "bg-[#F5F7FA] text-[#222222]"
                    }`}
                    data-testid={`embed-chip-property-${pt.value}`}
                  >
                    {pt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[13px] font-medium text-[#222222] tracking-wide mb-2 block">
                {t("onboardingEmbed.monthlyBudget")}
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#222222] text-[13px] font-medium">EUR</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="min"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className="w-full h-[42px] rounded-[20px] bg-[#F3F4F6] border border-transparent pl-[52px] pr-3 text-[14px] text-[#222222] placeholder:text-[#717171]"
                    data-testid="embed-input-min-price"
                  />
                </div>
                <div className="w-3 h-px bg-[#E5E7EB]" />
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#222222] text-[13px] font-medium">EUR</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="max"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="w-full h-[42px] rounded-[20px] bg-[#F3F4F6] border border-transparent pl-[52px] pr-3 text-[14px] text-[#222222] placeholder:text-[#717171]"
                    data-testid="embed-input-max-price"
                  />
                </div>
              </div>
            </div>

            <EstimateBlock city={cityName} maxPrice={maxPrice} />

            <div className="flex items-center gap-2 text-[12px] text-[#222222]">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{t("onboardingEmbed.maxSearches")}</span>
            </div>
          </div>

          {error && (
            <div className="mx-5 mb-2 p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-[13px]" data-testid="embed-error">
              {error}
            </div>
          )}

          <div className="px-5 pb-5 pt-1">
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="w-full h-[56px] rounded-full bg-[#0D6EFD] hover:bg-[#0B5ED7] active:scale-[0.98] text-white font-medium text-[16px] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 shadow-[0_2px_12px_rgba(0,0,0,0.35)]"
              data-testid="embed-button-submit"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Search className="w-[18px] h-[18px]" />
                  {t("onboardingEmbed.submitButton")}
                </>
              )}
            </button>
          </div>
        </div>

        <p className="text-center text-[11px] text-[#222222] mt-4">
          Powered by HousAlert
        </p>
      </div>
    </div>
  );
}
