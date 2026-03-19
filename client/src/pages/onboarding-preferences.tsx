import { useState } from "react";
import { useHashSearch } from "@/lib/hash-search";
import { useLocation } from "wouter";
import { ChevronLeft, ChevronDown } from "lucide-react";
import { HousAlertLogo } from "@/components/housalert-logo";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { useEmbedded } from "@/hooks/use-embedded";

const FURNISHED_OPTIONS = ["any", "furnished", "unfurnished"] as const;
const HOUSING_TYPES = ["any", "apartment", "studio", "room", "house", "wg"] as const;
const TARGET_GROUPS = ["any", "students", "couples", "families", "singles", "seniors"] as const;

const SELECT_CLS = "w-full h-[44px] px-4 rounded-xl border border-transparent bg-[#F3F4F6] text-[15px] font-medium text-[#1F2937] focus:bg-white cursor-pointer appearance-none";

export default function OnboardingPreferencesPage() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const searchString = useHashSearch();
  const { isEmbedded, containerClass } = useEmbedded();
  const params = new URLSearchParams(searchString);

  const [furnished, setFurnished] = useState(params.get("furnished") || "any");
  const [housingType, setHousingType] = useState(
    params.get("propertyTypes") || "any"
  );
  const [targetGroup, setTargetGroup] = useState(params.get("targetGroup") || "any");

  function buildParams(): URLSearchParams {
    const p = new URLSearchParams(searchString);
    if (furnished && furnished !== "any") p.set("furnished", furnished);
    else p.delete("furnished");
    if (housingType && housingType !== "any") p.set("propertyTypes", housingType);
    else p.delete("propertyTypes");
    if (targetGroup && targetGroup !== "any") p.set("targetGroup", targetGroup);
    else p.delete("targetGroup");
    p.delete("extraWishes");
    return p;
  }

  function handleNext() {
    navigate(`/signup?${buildParams().toString()}`);
  }

  function handleBack() {
    navigate(`/onboarding/filters?${new URLSearchParams(searchString).toString()}`);
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col">
      {!isEmbedded && (
        <header className="w-full bg-white sticky top-0 z-20 border-b border-[#E5E7EB]">
          <div className={`${containerClass} mx-auto px-5 h-[56px] flex items-center gap-3`}>
            <button
              onClick={handleBack}
              className="w-10 h-10 rounded-full bg-[#F3F4F6] flex items-center justify-center active:scale-95 transition-transform"
              data-testid="button-back-preferences"
            >
              <ChevronLeft className="w-5 h-5 text-[#71717A]" />
            </button>
            <HousAlertLogo size={28} />
          </div>
        </header>
      )}

      <div className={`${containerClass} mx-auto w-full px-5 pt-4 pb-1`}>
        <div className="flex items-center justify-center gap-2 py-2">
          {[1, 2, 3, 4].map((step) => (
            <div
              key={step}
              className={`w-2 h-2 rounded-full transition-all ${
                step <= 3 ? "bg-[#0D6EFD]" : "bg-[#D1D5DB]"
              }`}
              data-testid={`dot-step-${step}`}
            />
          ))}
        </div>
      </div>

      <main className={`flex-1 ${containerClass} mx-auto w-full px-5 pb-8 pt-3`}>
        <h1
          className="text-[24px] font-medium text-[#18181B] leading-[1.15] tracking-[-0.02em] mb-1"
          data-testid="text-preferences-title"
        >
          {t("onboardingPreferences.title")}
        </h1>
        <p className="text-[14px] text-[#6B7280] mb-5">
          {t("onboardingPreferences.subtitle")}
        </p>

        <div className="bg-white rounded-[24px] border border-[#F0F0F0] shadow-[0_2px_8px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)] p-5 space-y-5">
          <div>
            <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">
              {t("onboardingPreferences.furnished")}
            </label>
            <div className="relative">
              <select
                value={furnished}
                onChange={(e) => setFurnished(e.target.value)}
                className={SELECT_CLS}
                data-testid="select-furnished"
              >
                {FURNISHED_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {t(`onboardingPreferences.furnishedOption.${opt}`)}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717A] pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">
              {t("onboardingPreferences.housingType")}
            </label>
            <div className="relative">
              <select
                value={housingType}
                onChange={(e) => setHousingType(e.target.value)}
                className={SELECT_CLS}
                data-testid="select-housing-type"
              >
                {HOUSING_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type === "any"
                      ? t("onboardingPreferences.furnishedOption.any")
                      : t(`onboardingPreferences.housingTypeOption.${type}`)}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717A] pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">
              {t("onboardingPreferences.targetGroup")}
            </label>
            <div className="relative">
              <select
                value={targetGroup}
                onChange={(e) => setTargetGroup(e.target.value)}
                className={SELECT_CLS}
                data-testid="select-target-group"
              >
                {TARGET_GROUPS.map((group) => (
                  <option key={group} value={group}>
                    {t(`onboardingPreferences.targetGroupOption.${group}`)}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717A] pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="pt-5 flex gap-3">
          <Button
            variant="outline"
            className="h-[48px] px-6 rounded-full text-[15px] font-medium border-[#E5E7EB] text-[#374151] hover:bg-white"
            onClick={handleBack}
            data-testid="button-back-preferences"
          >
            {t("onboardingPreferences.back")}
          </Button>
          <Button
            className="flex-1 h-[48px] rounded-full text-[15px] font-medium shadow-none bg-[#0D6EFD] hover:bg-[#0B5ED7]"
            onClick={handleNext}
            data-testid="button-next-preferences"
          >
            {t("onboardingPreferences.next")}
          </Button>
        </div>
      </main>
    </div>
  );
}
