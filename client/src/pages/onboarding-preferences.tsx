import { useState } from "react";
import { useHashSearch } from "@/lib/hash-search";
import { useLocation } from "wouter";
import { Home, ChevronLeft, Sofa, ListChecks, Building2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";

const FURNISHED_OPTIONS = ["any", "furnished", "unfurnished"] as const;
const HOUSING_TYPES = ["apartment", "studio", "room", "house", "wg"] as const;
const TARGET_GROUPS = ["any", "students", "couples", "families", "singles", "seniors"] as const;

function ProgressDots({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 py-4">
      {[1, 2, 3, 4].map((step) => (
        <div
          key={step}
          className={`w-2.5 h-2.5 rounded-full transition-all ${
            step <= current ? "bg-[#0D6EFD]" : "bg-[#E5E7EB]"
          }`}
          data-testid={`dot-step-${step}`}
        />
      ))}
    </div>
  );
}

export default function OnboardingPreferencesPage() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const searchString = useHashSearch();
  const params = new URLSearchParams(searchString);

  const [furnished, setFurnished] = useState(params.get("furnished") || "any");
  const [housingTypes, setHousingTypes] = useState<string[]>(
    params.get("propertyTypes")?.split(",").filter(Boolean) || []
  );
  const [targetGroup, setTargetGroup] = useState(params.get("targetGroup") || "any");
  const [extraWishes, setExtraWishes] = useState(params.get("extraWishes") || "");

  function toggleHousingType(type: string) {
    setHousingTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  function buildParams(): URLSearchParams {
    const p = new URLSearchParams(searchString);
    if (furnished && furnished !== "any") p.set("furnished", furnished);
    else p.delete("furnished");
    if (housingTypes.length > 0) p.set("propertyTypes", housingTypes.join(","));
    else p.delete("propertyTypes");
    if (targetGroup && targetGroup !== "any") p.set("targetGroup", targetGroup);
    else p.delete("targetGroup");
    if (extraWishes.trim()) p.set("extraWishes", extraWishes.trim());
    else p.delete("extraWishes");
    return p;
  }

  function handleNext() {
    navigate(`/signup?${buildParams().toString()}`);
  }

  function handleBack() {
    navigate(`/onboarding/filters?${new URLSearchParams(searchString).toString()}`);
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="w-full bg-white sticky top-0 z-20 border-b border-[#E5E7EB]">
        <div className="max-w-xl mx-auto px-6 h-[60px] flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-12 h-12 rounded-full bg-[#F3F4F6] shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center justify-center active:scale-95 transition-colors"
            data-testid="button-back-preferences"
          >
            <ChevronLeft className="w-5 h-5 text-[#1F2937]" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#0D6EFD] flex items-center justify-center">
              <Home className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-[#111C3D] text-base">HousAlert</span>
          </div>
        </div>
      </header>

      <ProgressDots current={3} />

      <main className="flex-1 max-w-xl mx-auto w-full px-6 pb-8 pt-2">
        <h1
          className="text-[28px] font-[800] text-[#111C3D] leading-[1.1] tracking-[-0.03em] mb-2"
          data-testid="text-preferences-title"
        >
          {t("onboardingPreferences.title")}
        </h1>
        <p className="text-[15px] text-[#6B7280] mb-6">
          {t("onboardingPreferences.subtitle")}
        </p>

        <div className="flex flex-col gap-6">
          <div>
            <label className="text-[15px] font-[700] text-[#111C3D] mb-3 flex items-center gap-2">
              <Sofa className="w-4 h-4 text-[#0D6EFD]" />
              {t("onboardingPreferences.furnished")}
            </label>
            <div className="flex flex-wrap gap-2">
              {FURNISHED_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setFurnished(opt)}
                  className={`px-4 py-2.5 rounded-full text-[14px] font-medium transition-all ${
                    furnished === opt
                      ? "bg-[#0D6EFD] text-white"
                      : "bg-[#F3F4F6] text-[#1F2937] hover:bg-[#E5E7EB]"
                  }`}
                  data-testid={`chip-furnished-${opt}`}
                >
                  {t(`onboardingPreferences.furnishedOption.${opt}`)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[15px] font-[700] text-[#111C3D] mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#0D6EFD]" />
              {t("onboardingPreferences.housingType")}
            </label>
            <div className="flex flex-wrap gap-2">
              {HOUSING_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => toggleHousingType(type)}
                  className={`px-4 py-2.5 rounded-full text-[14px] font-medium transition-all ${
                    housingTypes.includes(type)
                      ? "bg-[#0D6EFD] text-white"
                      : "bg-[#F3F4F6] text-[#1F2937] hover:bg-[#E5E7EB]"
                  }`}
                  data-testid={`chip-type-${type}`}
                >
                  {t(`onboardingPreferences.housingTypeOption.${type}`)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[15px] font-[700] text-[#111C3D] mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-[#0D6EFD]" />
              {t("onboardingPreferences.targetGroup")}
            </label>
            <div className="flex flex-wrap gap-2">
              {TARGET_GROUPS.map((group) => (
                <button
                  key={group}
                  onClick={() => setTargetGroup(group)}
                  className={`px-4 py-2.5 rounded-full text-[14px] font-medium transition-all ${
                    targetGroup === group
                      ? "bg-[#0D6EFD] text-white"
                      : "bg-[#F3F4F6] text-[#1F2937] hover:bg-[#E5E7EB]"
                  }`}
                  data-testid={`chip-target-${group}`}
                >
                  {t(`onboardingPreferences.targetGroupOption.${group}`)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[15px] font-[700] text-[#111C3D] mb-3 flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-[#0D6EFD]" />
              {t("onboardingPreferences.extraWishes")}
            </label>
            <textarea
              value={extraWishes}
              onChange={(e) => setExtraWishes(e.target.value)}
              placeholder={t("onboardingPreferences.extraWishesPlaceholder")}
              rows={3}
              className="w-full px-4 py-3 rounded-[20px] border-0 bg-[#F3F4F6] text-[15px] font-medium text-[#1F2937] placeholder:text-[#9CA3AF] placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/15 focus:bg-[#F5F7FA] transition-all resize-none"
              data-testid="textarea-extra-wishes"
            />
          </div>

          <div className="pt-4 flex gap-3">
            <Button
              variant="outline"
              size="lg"
              className="h-[48px] px-6 rounded-full text-[15px] font-semibold border-[#E5E7EB] text-[#1F2937] hover:bg-[#F5F7FA]"
              onClick={handleBack}
              data-testid="button-back-preferences"
            >
              {t("onboardingPreferences.back")}
            </Button>
            <Button
              size="lg"
              className="flex-1 h-[56px] rounded-full text-[16px] font-semibold shadow-none bg-[#0D6EFD] hover:bg-[#0B5ED7]"
              onClick={handleNext}
              data-testid="button-next-preferences"
            >
              {t("onboardingPreferences.next")}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
