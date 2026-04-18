import { useState } from "react";
import { useLocation } from "wouter";
import { useHashSearch } from "@/lib/hash-search";
import { Check } from "lucide-react";
import { OBW, OBWebHeader, OBWebFooter, OBInfoBox, useWebsiteMode, appendWebsiteParams } from "@/components/onboarding-ui";
import { useTranslation } from "@/i18n";

export default function OnboardingPreferences() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const searchString = useHashSearch();
  const w = useWebsiteMode();
  const params = new URLSearchParams(searchString);

  const PREFERENCE_OPTIONS = [
    { value: "balcony", label: t("amenities.balcony") },
    { value: "garden", label: t("amenities.garden") },
    { value: "bath", label: t("amenities.bath") },
    { value: "energy_c", label: t("amenities.energyC") },
    { value: "rooftop", label: t("amenities.rooftop") },
  ];

  const [amenities, setAmenities] = useState<string[]>(() => {
    const a = params.get("amenities");
    return a ? a.split(",").filter(Boolean) : [];
  });
  const [sendUnclear, setSendUnclear] = useState(() => {
    return params.get("sendUnclear") !== "false";
  });

  function toggleAmenity(a: string) {
    setAmenities((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
    );
  }

  function handleNext() {
    const outParams = new URLSearchParams(searchString);
    outParams.delete("source");
    outParams.delete("theme");

    if (amenities.length > 0) {
      outParams.set("amenities", amenities.join(","));
    } else {
      outParams.delete("amenities");
    }
    outParams.set("sendUnclear", String(sendUnclear));

    if (w) {
      // VITE_APP_URL should be set to the app's base URL in production (e.g. https://app.housalert.com).
      // If unset, falls back to window.location.origin which works correctly in most deployments.
      const appBase = import.meta.env.VITE_APP_URL || window.location.origin;
      const accountUrl = new URL(`${appBase}/onboarding/password`);
      accountUrl.searchParams.set("source", "website");
      accountUrl.searchParams.set("theme", "light");
      outParams.forEach((value, key) => {
        accountUrl.searchParams.set(key, value);
      });
      try {
        window.top!.location.href = accountUrl.toString();
      } catch {
        window.location.href = accountUrl.toString();
      }
      return;
    }

    navigate(appendWebsiteParams(`/onboarding/password?${outParams.toString()}`, searchString));
  }

  function handleBack() {
    const backParams = new URLSearchParams(searchString);
    backParams.delete("source");
    backParams.delete("theme");
    if (amenities.length > 0) {
      backParams.set("amenities", amenities.join(","));
    } else {
      backParams.delete("amenities");
    }
    backParams.set("sendUnclear", String(sendUnclear));
    navigate(appendWebsiteParams(`/onboarding/filters?${backParams.toString()}`, searchString));
  }

  function handleClose() {
    navigate("/");
  }

  if (!w) {
    navigate("/onboarding/filters");
    return null;
  }

  return (
    <div
      className="min-h-[100dvh] flex flex-col"
      style={{ background: "#ffffff" }}
      data-testid="screen-onboarding-preferences"
    >
      <OBWebHeader step={3} onClose={handleClose} />

      <main className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-5 pt-6 pb-[100px] overflow-y-auto">
        <h2
          className="text-[30px] font-semibold tracking-[-0.025em] mb-1"
          style={{ color: OBW.text }}
          data-testid="text-preferences-title"
        >
          {t("onboarding.filters.specificWishesTitle")}
        </h2>
        <p className="text-[13px] mb-4 leading-relaxed" style={{ color: OBW.textSecondary }}>
          {t("onboarding.filters.specificWishesSubtitle")}
        </p>

        <div className="mb-4">
          <OBInfoBox>
            {t("onboarding.filters.specificWishesWarning")}
          </OBInfoBox>
        </div>

        <div className="flex flex-col" data-testid="preference-options">
          {PREFERENCE_OPTIONS.map((opt, i) => {
            const active = amenities.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggleAmenity(opt.value)}
                className="w-full flex items-center justify-between py-2.5 text-left transition-colors"
                style={{
                  borderBottom: i < PREFERENCE_OPTIONS.length - 1 ? `1px solid ${OBW.divider}` : "none",
                }}
                data-testid={`preference-${opt.value}`}
              >
                <span className="text-[14px]" style={{ color: OBW.text }}>
                  {opt.label}
                </span>
                <div
                  className="w-[18px] h-[18px] rounded-[3px] flex items-center justify-center shrink-0"
                  style={{
                    border: active ? "none" : `1.5px solid ${OBW.chipBorder}`,
                    backgroundColor: active ? "rgb(var(--ha-primary))" : "transparent",
                  }}
                >
                  {active && <Check className="w-3 h-3 text-white" />}
                </div>
              </button>
            );
          })}
        </div>

        <div className="h-px my-3" style={{ backgroundColor: OBW.divider }} />

        <label
          className="flex items-center gap-3 cursor-pointer py-1"
          data-testid="toggle-send-unclear"
          onClick={() => setSendUnclear(!sendUnclear)}
        >
          <div
            className="w-[40px] h-[22px] rounded-full p-[2px] transition-colors shrink-0 cursor-pointer"
            style={{ backgroundColor: sendUnclear ? "rgb(var(--ha-success))" : "#E5E7EB" }}
          >
            <div
              className="w-[18px] h-[18px] rounded-full bg-white transition-transform shadow-sm"
              style={{ transform: sendUnclear ? "translateX(18px)" : "translateX(0)" }}
            />
          </div>
          <span className="text-[13px] leading-snug" style={{ color: OBW.text }}>
            {t("onboarding.filters.sendUnclear")}
          </span>
        </label>
      </main>

      <OBWebFooter
        onBack={handleBack}
        onNext={handleNext}
        nextLabel={t("common.next")}
        backTestId="button-preferences-back"
        nextTestId="button-preferences-next"
      />
    </div>
  );
}
