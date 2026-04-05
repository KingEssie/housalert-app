import { useLocation } from "wouter";
import { useTranslation } from "@/i18n";
import { HousAlertLogo } from "@/components/housalert-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { OB } from "@/components/onboarding-ui";

const STEPS = [
  { num: 1, titleKey: "onboarding.intro.step1.title", descKey: "onboarding.intro.step1.desc" },
  { num: 2, titleKey: "onboarding.intro.step2.title", descKey: "onboarding.intro.step2.desc" },
  { num: 3, titleKey: "onboarding.intro.step3.title", descKey: "onboarding.intro.step3.desc" },
];

export default function OnboardingIntro() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();

  return (
    <div className="min-h-[100dvh] flex flex-col" style={{ background: OB.gradient }} data-testid="screen-onboarding-intro">
      <header className="w-full pt-[max(16px,env(safe-area-inset-top))] px-5">
        <div className="max-w-[480px] mx-auto flex items-center justify-between h-[56px]">
          <HousAlertLogo size={28} />
          <LanguageSwitcher />
        </div>
      </header>

      <main className="flex-1 flex flex-col justify-center max-w-[480px] mx-auto w-full px-5 pb-[140px]">
        <h1
          className="text-[34px] font-semibold tracking-[-0.02em] leading-[1.1] mb-5 max-w-[320px]"
          style={{ color: OB.text }}
          data-testid="text-intro-title"
        >
          {t("onboarding.intro.headline")}
        </h1>

        <div className="flex flex-col gap-4">
          {STEPS.map((step) => (
            <div key={step.num} className="flex items-start gap-3" data-testid={`step-${step.num}`}>
              <div
                className="w-[26px] h-[26px] rounded-full flex items-center justify-center shrink-0 text-[14px] font-bold mt-[2px]"
                style={{ backgroundColor: "#F3F4F6", color: "#111111" }}
              >
                {step.num}
              </div>
              <div>
                <p className="text-[16px] font-semibold leading-[1.25]" style={{ color: "#111111" }}>
                  {t(step.titleKey)}
                </p>
                <p className="text-[15px] mt-1 leading-[1.45]" style={{ color: "#6B7280" }}>
                  {t(step.descKey)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </main>

      <div
        className="fixed bottom-0 left-0 right-0 z-30"
        style={{
          borderTop: "1px solid #E5E7EB",
          backgroundColor: "rgba(255,255,255,0.9)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          paddingBottom: "max(8px, env(safe-area-inset-bottom, 8px))",
        }}
      >
        <div className="max-w-[480px] mx-auto px-5 pt-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="w-[56px] h-[56px] rounded-[6px] flex items-center justify-center shrink-0 active:scale-95 transition-transform"
              style={{
                border: "1.5px solid #E5E7EB",
                backgroundColor: "#F7F7F7",
              }}
              data-testid="button-intro-back"
            >
              <ChevronLeft className="w-[18px] h-[18px]" style={{ color: "#111111" }} />
            </button>
            <button
              onClick={() => navigate("/onboarding/city")}
              className="flex-1 ha-btn text-white font-semibold"
              style={{ background: OB.pink, boxShadow: "0 8px 20px rgba(255,56,92,0.25)" }}
              data-testid="button-intro-start"
            >
              {t("onboarding.intro.cta")}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center justify-center gap-1 mt-2.5 pb-0.5">
            <span className="text-[14px]" style={{ color: "#6B7280" }}>
              {t("onboarding.intro.alreadyAccount")}
            </span>
            <button
              onClick={() => navigate("/login")}
              className="text-[14px] font-semibold"
              style={{ color: "rgb(var(--ha-primary))" }}
              data-testid="link-intro-login"
            >
              {t("onboarding.intro.login")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
