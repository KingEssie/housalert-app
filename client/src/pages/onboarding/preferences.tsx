import { useState } from "react";
import { useLocation, Redirect } from "wouter";
import { useHashSearch } from "@/lib/hash-search";
import { Check, Info } from "lucide-react";
import { OBW, OBWebHeader, OBWebFooter, useWebsiteMode, appendWebsiteParams } from "@/components/onboarding-ui";
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

  const city = params.get("city") || "";
  if (!city) return <Redirect to="/onboarding/filters" />;

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
      <OBWebHeader step={4} totalSteps={4} onClose={handleClose} />

      <main className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-5 pt-6 pb-[100px] overflow-y-auto">
        <h2
          className="text-[30px] font-semibold tracking-[-0.025em]"
          style={{ color: OBW.text, marginBottom: 7 }}
          data-testid="text-preferences-title"
        >
          {t("onboarding.filters.specificWishesTitle")}
        </h2>
        <p className="text-[13px] mb-4 leading-snug" style={{ color: OBW.textSecondary }}>
          {t("onboarding.filters.specificWishesSubtitle")}
        </p>

        <div
          className="rounded-[4px] mb-5 flex items-start gap-2"
          style={{ backgroundColor: "#FFFFFF", border: "1px solid #C4C8CE", padding: "10px 12px" }}
        >
          <Info className="w-[13px] h-[13px] shrink-0 mt-[2px]" style={{ color: "rgb(var(--ha-primary))" }} />
          <div className="text-[13px] leading-[1.5]" style={{ color: "rgb(var(--ha-primary))" }}>
            {t("onboarding.filters.specificWishesWarning")}
          </div>
        </div>

        <div className="flex flex-col" data-testid="preference-options">
          {PREFERENCE_OPTIONS.map((opt, i) => {
            const active = amenities.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggleAmenity(opt.value)}
                className="w-full flex items-center justify-between py-[14px] text-left transition-colors"
                style={{
                  borderBottom: i < PREFERENCE_OPTIONS.length - 1 ? `1px solid rgba(0,0,0,0.07)` : "none",
                }}
                data-testid={`preference-${opt.value}`}
              >
                <span className="text-[15px]" style={{ color: OBW.text }}>
                  {opt.label}
                </span>
                <div
                  className="w-[22px] h-[22px] rounded-[4px] flex items-center justify-center shrink-0"
                  style={{
                    border: active ? "none" : `1.5px solid ${OBW.chipBorder}`,
                    backgroundColor: active ? "rgb(var(--ha-primary))" : "transparent",
                  }}
                >
                  {active && <Check className="w-[14px] h-[14px] text-white" />}
                </div>
              </button>
            );
          })}
        </div>

        <div className="h-px my-4" style={{ backgroundColor: "rgba(0,0,0,0.07)" }} />

        <label
          className="flex items-center gap-3 cursor-pointer py-3"
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
          <span className="text-[14px] leading-snug" style={{ color: OBW.text }}>
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
