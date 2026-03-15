import { useLocation } from "wouter";
import { Home, Clock, Zap, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";

const VALUE_POINTS = [
  { icon: Clock, key: "saveTime" },
  { icon: Zap, key: "beFirst" },
  { icon: Search, key: "findMore" },
] as const;

export default function OnboardingValuePage() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="w-full bg-white sticky top-0 z-20 border-b border-[#E5E7EB]">
        <div className="max-w-xl mx-auto px-6 h-[60px] flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#0D6EFD] flex items-center justify-center">
              <Home className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-[#111C3D] text-base">HousAlert</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-xl mx-auto w-full px-6 pb-8 pt-10 flex flex-col">
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-[#EBF2FF] flex items-center justify-center mx-auto mb-6">
            <Home className="w-8 h-8 text-[#0D6EFD]" />
          </div>
          <h1
            className="text-[28px] font-[800] text-[#111C3D] leading-[1.1] tracking-[-0.03em] mb-3"
            data-testid="text-value-title"
          >
            {t("onboardingValue.title")}
          </h1>
          <p className="text-[15px] text-[#6B7280]" data-testid="text-value-subtitle">
            {t("onboardingValue.subtitle")}
          </p>
        </div>

        <div className="flex flex-col gap-4 mb-10">
          {VALUE_POINTS.map(({ icon: Icon, key }) => (
            <div
              key={key}
              className="flex items-start gap-4 bg-[#F5F7FA] rounded-2xl p-5"
              data-testid={`card-value-${key}`}
            >
              <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center flex-shrink-0 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                <Icon className="w-5 h-5 text-[#0D6EFD]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-[#111C3D] mb-0.5">
                  {t(`onboardingValue.${key}.title`)}
                </p>
                <p className="text-[14px] text-[#6B7280] leading-relaxed">
                  {t(`onboardingValue.${key}.desc`)}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-auto">
          <Button
            size="lg"
            className="w-full h-[56px] rounded-full text-[16px] font-bold shadow-none bg-[#0D6EFD] hover:bg-[#0B5ED7]"
            onClick={() => navigate("/paywall")}
            data-testid="button-value-continue"
          >
            {t("onboardingValue.continue")}
          </Button>
        </div>
      </main>
    </div>
  );
}
