import { useLocation } from "wouter";
import { useTranslation } from "@/i18n";
import { HousAlertLogo } from "@/components/housalert-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { OB, OBStickyBar } from "@/components/onboarding-ui";

const STEPS = [
  { num: 1, titleKey: "onboarding.intro.step1.title", descKey: "onboarding.intro.step1.desc" },
  { num: 2, titleKey: "onboarding.intro.step2.title", descKey: "onboarding.intro.step2.desc" },
  { num: 3, titleKey: "onboarding.intro.step3.title", descKey: "onboarding.intro.step3.desc" },
];

export default function OnboardingIntro() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();

  return (
    <div className="min-h-[100dvh] flex flex-col ob-dark" style={{ background: OB.gradient }} data-testid="screen-onboarding-intro">
      <header className="w-full pt-[max(16px,env(safe-area-inset-top))] px-5">
        <div className="max-w-[480px] mx-auto flex items-center justify-between h-[56px]">
          <HousAlertLogo size={28} />
          <LanguageSwitcher />
        </div>
      </header>

      <main className="flex-1 flex flex-col justify-center max-w-[480px] mx-auto w-full px-5 pb-[140px]">
        <h1
          className="text-[33px] font-bold tracking-[-0.02em] leading-[1.1] mb-5 max-w-[320px]"
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
                style={{ backgroundColor: "#22C55E", color: "#111" }}
              >
                {step.num}
              </div>
              <div>
                <p className="text-[16px] font-bold leading-[1.25]" style={{ color: "#22C55E" }}>
                  {t(step.titleKey)}
                </p>
                <p className="text-[15px] mt-1 leading-[1.45]" style={{ color: "rgba(255,255,255,0.88)" }}>
                  {t(step.descKey)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </main>

      <OBStickyBar>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="w-[52px] h-[52px] rounded-[10px] flex items-center justify-center shrink-0 active:scale-95 transition-transform"
            style={{
              border: `2px solid ${OB.cardBorder}`,
              backgroundColor: "transparent",
            }}
            data-testid="button-intro-back"
          >
            <ChevronLeft className="w-5 h-5" style={{ color: OB.text }} />
          </button>
          <button
            onClick={() => navigate("/onboarding/city")}
            className="flex-1 h-[52px] rounded-[10px] text-[15px] font-bold text-white transition-all active:scale-[0.97] flex items-center justify-center gap-2"
            style={{ background: OB.pinkGradient, boxShadow: OB.pinkShadow }}
            data-testid="button-intro-start"
          >
            {t("onboarding.intro.cta")}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center justify-center gap-1 mt-3 pb-1">
          <span className="text-[12px]" style={{ color: OB.textMuted }}>
            {t("onboarding.intro.alreadyAccount")}
          </span>
          <button
            onClick={() => navigate("/login")}
            className="text-[12px] font-semibold"
            style={{ color: OB.pink }}
            data-testid="link-intro-login"
          >
            {t("onboarding.intro.login")}
          </button>
        </div>
      </OBStickyBar>
    </div>
  );
}
