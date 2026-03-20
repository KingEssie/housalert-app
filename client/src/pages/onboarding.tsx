import { apiFetch } from "@/lib/api-base";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { createSearchProfile, getSearchProfiles } from "@/lib/search-profiles";
import { Bell, MapPin, Search, ChevronRight, Check, Gift } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";
import { trackEvent } from "@/lib/track-event";
import LocationModeSelector, { type LocationData, type SelectedPlace, DEFAULT_LOCATION_DATA, isLocationValid } from "@/components/location-mode-selector";

function ProgressBar({ step, total }: { step: number; total: number }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 px-6 pt-6 pb-2">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className="h-[4px] flex-1 rounded-full transition-colors duration-300"
          style={{ backgroundColor: i < step ? "#0D6EFD" : "#E5E7EB" }}
          data-testid={`progress-step-${i + 1}`}
        />
      ))}
      <span className="text-[13px] font-medium text-[#222222] ml-1 whitespace-nowrap">
        {t("onboarding.step", { step, total })}
      </span>
    </div>
  );
}

function WelcomeStep({ onStart }: { onStart: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <div
        className="w-[72px] h-[72px] rounded-2xl bg-[#EBF2FF] flex items-center justify-center mb-8"
      >
        <Search className="w-8 h-8 text-[#0D6EFD]" />
      </div>

      <h1
        className="text-[28px] font-medium leading-tight text-[#222222] mb-4 max-w-[320px] tracking-wide"
        data-testid="text-welcome-title"
      >
        {t("onboarding.welcome.title")}
      </h1>

      <p
        className="text-[16px] leading-relaxed text-[#222222] mb-10 max-w-[320px]"
        data-testid="text-welcome-subtitle"
      >
        {t("onboarding.welcome.subtitle")}
      </p>

      <button
        onClick={onStart}
        className="w-full max-w-[320px] min-h-[56px] rounded-full bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white font-medium text-[16px] transition-colors flex items-center justify-center gap-2 shadow-[0_2px_12px_rgba(0,0,0,0.25)]"
        data-testid="button-start-onboarding"
      >
        {t("onboarding.welcome.button")}
        <ChevronRight className="w-5 h-5" />
      </button>

      <p className="text-[13px] text-[#222222] mt-4" data-testid="text-duration-hint">
        {t("onboarding.welcome.hint")}
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
  const { t } = useTranslation();
  return (
    <div className="flex flex-col min-h-screen px-6 pt-4">
      <div className="flex-1">
        <div className="w-[56px] h-[56px] rounded-2xl bg-[#EBF2FF] flex items-center justify-center mb-6">
          <MapPin className="w-6 h-6 text-[#0D6EFD]" />
        </div>

        <h2 className="text-page-title mb-2" data-testid="text-city-title">
          {t("onboarding.location.title")}
        </h2>
        <p className="text-subtitle mb-6">
          {t("onboarding.location.subtitle")}
        </p>

        <LocationModeSelector value={locationData} onChange={setLocationData} />
      </div>

      <div className="pb-8 pt-4">
        <button
          onClick={onNext}
          disabled={!isLocationValid(locationData)}
          className="w-full min-h-[56px] rounded-full bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white font-medium text-[16px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_2px_12px_rgba(0,0,0,0.25)]"
          data-testid="button-city-next"
        >
          {t("common.next")}
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
  const { t } = useTranslation();
  const valid =
    maxPrice.trim() !== "" &&
    Number(maxPrice) > 0 &&
    (minPrice.trim() === "" || Number(minPrice) < Number(maxPrice));

  return (
    <div className="flex flex-col min-h-screen px-6 pt-4">
      <div className="flex-1">
        <div className="w-[56px] h-[56px] rounded-2xl bg-[#EBF2FF] flex items-center justify-center mb-6">
          <span className="text-[24px] font-medium text-[#0D6EFD]">&#8364;</span>
        </div>

        <h2 className="text-page-title mb-2" data-testid="text-budget-title">
          {t("onboarding.budget.title")}
        </h2>
        <p className="text-subtitle mb-6">
          {t("onboarding.budget.subtitle")}
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-[#222222] tracking-wide mb-1.5">
              {t("onboarding.budget.minPrice")}
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#222222] text-[15px]">&#8364;</span>
              <input
                type="number"
                inputMode="numeric"
                placeholder={t("onboarding.budget.minPlaceholder")}
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="w-full min-h-[56px] rounded-[20px] bg-[#F3F4F6] border border-transparent pl-9 pr-4 text-[16px] text-[#222222] placeholder:text-[#717171]"
                data-testid="input-min-price"
              />
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[#222222] tracking-wide mb-1.5">
              {t("onboarding.budget.maxPrice")}
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#222222] text-[15px]">&#8364;</span>
              <input
                type="number"
                inputMode="numeric"
                placeholder={t("onboarding.budget.maxPlaceholder")}
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="w-full min-h-[56px] rounded-[20px] bg-[#F3F4F6] border border-transparent pl-9 pr-4 text-[16px] text-[#222222] placeholder:text-[#717171]"
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
          className="w-full min-h-[56px] rounded-full bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white font-medium text-[16px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_2px_12px_rgba(0,0,0,0.25)]"
          data-testid="button-budget-next"
        >
          {t("common.next")}
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
  const { t } = useTranslation();

  const PROPERTY_TYPES = [
    { value: "studio", label: t("onboarding.propertyType.studio") },
    { value: "appartement", label: t("onboarding.propertyType.apartment") },
    { value: "kamer", label: t("onboarding.propertyType.room") },
    { value: "gedeeld", label: t("onboarding.propertyType.shared") },
    { value: "any", label: t("onboarding.propertyType.any") },
  ];

  return (
    <div className="flex flex-col min-h-screen px-6 pt-4">
      <div className="flex-1">
        <div className="w-[56px] h-[56px] rounded-2xl bg-[#EBF2FF] flex items-center justify-center mb-6">
          <Search className="w-6 h-6 text-[#0D6EFD]" />
        </div>

        <h2 className="text-page-title mb-2" data-testid="text-property-title">
          {t("onboarding.propertyType.title")}
        </h2>
        <p className="text-subtitle mb-6">
          {t("onboarding.propertyType.subtitle")}
        </p>

        <div className="space-y-3">
          {PROPERTY_TYPES.map((pt) => (
            <button
              key={pt.value}
              onClick={() => setPropertyType(pt.value)}
              className={`w-full min-h-[56px] rounded-2xl border-2 px-5 text-left text-[16px] font-medium transition-all flex items-center justify-between ${
                propertyType === pt.value
                  ? "border-[#0D6EFD] bg-[#EBF2FF] text-[#0D6EFD]"
                  : "border-[#E5E7EB] bg-white text-[#222222]"
              }`}
              data-testid={`option-property-${pt.value}`}
            >
              {pt.label}
              {propertyType === pt.value && (
                <div className="w-6 h-6 rounded-full bg-[#0D6EFD] flex items-center justify-center">
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
          className="w-full min-h-[56px] rounded-full bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white font-medium text-[16px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_2px_12px_rgba(0,0,0,0.25)]"
          data-testid="button-property-next"
        >
          {t("common.next")}
        </button>
      </div>
    </div>
  );
}

function AlertsStep({ onActivate, onSkip, saving }: { onActivate: () => void; onSkip: () => void; saving: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <div className="w-[72px] h-[72px] rounded-2xl bg-[#EBF2FF] flex items-center justify-center mb-8">
        <Bell className="w-8 h-8 text-[#0D6EFD]" />
      </div>

      <h2
        className="text-[24px] font-medium text-[#222222] mb-3 max-w-[300px] tracking-wide"
        data-testid="text-alerts-title"
      >
        {t("onboarding.alerts.title")}
      </h2>

      <p className="text-[16px] text-[#222222] mb-4 max-w-[300px] leading-relaxed">
        {t("onboarding.alerts.subtitle")}
      </p>

      <div className="flex items-center gap-2.5 bg-[#F0FDF4] rounded-xl px-4 py-3 mb-8 max-w-[320px]" data-testid="trial-note">
        <Gift className="w-4 h-4 text-[#16A34A] flex-shrink-0" />
        <p className="text-[13px] font-medium text-[#15803D] text-left leading-snug">
          {t("onboarding.alerts.trialNote")}
        </p>
      </div>

      <button
        onClick={onActivate}
        disabled={saving}
        className="w-full max-w-[320px] min-h-[56px] rounded-full bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white font-medium text-[16px] transition-colors disabled:opacity-60 flex items-center justify-center gap-2 shadow-[0_2px_12px_rgba(0,0,0,0.25)]"
        data-testid="button-activate-alerts"
      >
        {saving ? (
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            <Bell className="w-5 h-5" />
            {t("onboarding.alerts.enable")}
          </>
        )}
      </button>

      <button
        onClick={onSkip}
        disabled={saving}
        className="mt-4 text-[#0D6EFD] font-medium text-[15px] hover:underline disabled:opacity-40"
        data-testid="button-skip-alerts"
      >
        {t("onboarding.alerts.skip")}
      </button>
    </div>
  );
}

export default function OnboardingPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    if (!user) return;
    getSearchProfiles().then((profiles) => {
      if (profiles.length > 0) {
        navigate("/dashboard", { replace: true });
      }
    }).catch(() => {});
  }, [user]);

  const [step, setStep] = useState(0);
  const [locationData, setLocationData] = useState<LocationData>({
    ...DEFAULT_LOCATION_DATA,
    place: {
      city_name: "Berlin",
      country_code: "DE",
      latitude: 52.52,
      longitude: 13.405,
      place_id: "berlin-default",
    },
  });
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [saving, setSaving] = useState(false);

  const place = locationData.place;

  async function saveProfileAndFinish(enableNotifications: boolean) {
    if (!user) return;
    setSaving(true);

    const timeout = setTimeout(() => {
      console.warn("[onboarding] Timeout reached, redirecting anyway");
      navigate("/dashboard?tab=matches");
    }, 5000);

    const cityForProfile = locationData.tab === "reistijd"
      ? locationData.commuteCity || locationData.commuteDestination.split(",")[0].trim()
      : place?.city_name ?? "";

    const locationMode = locationData.tab === "wijken"
      ? (locationData.districts.length > 0 ? "districts" as const : "city" as const)
      : locationData.tab === "radius"
        ? "radius" as const
        : "commute" as const;

    try {
      const newProfile = await createSearchProfile({
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
        property_types: propertyType && propertyType !== "any" ? [propertyType] : undefined,
      });

      if (enableNotifications) {
        try {
          const session = await (await import("@/lib/supabase")).supabase.auth.getSession();
          const token = session.data.session?.access_token;
          if (token) {
            await apiFetch("/api/notifications/settings", {
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
        } catch (notifErr) {
          console.error("[onboarding] Notification activation failed:", notifErr);
        }
      }

      try {
        const session = await (await import("@/lib/supabase")).supabase.auth.getSession();
        const token = session.data.session?.access_token;
        if (token && newProfile?.id) {
          await apiFetch("/api/search-profiles/backfill", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ searchProfileId: newProfile.id }),
          });
        }
      } catch {
      }

      trackEvent("profile_created", { city: cityForProfile });
      trackEvent("search_created", { city: cityForProfile });
      if (enableNotifications) {
        trackEvent("notifications_enabled", { source: "onboarding" });
      }

      clearTimeout(timeout);
      navigate("/dashboard?tab=matches");
    } catch (err: any) {
      clearTimeout(timeout);
      console.error("[onboarding] Save failed:", err);
      toast({
        title: t("onboarding.error"),
        description: t("onboarding.saveFailed"),
        variant: "destructive",
      });
      setSaving(false);
    }
  }

  function handleActivate() {
    saveProfileAndFinish(true);
  }

  function handleSkip() {
    saveProfileAndFinish(false);
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
        <AlertsStep onActivate={handleActivate} onSkip={handleSkip} saving={saving} />
      )}
    </div>
  );
}
