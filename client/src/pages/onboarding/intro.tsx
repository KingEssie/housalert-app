import { useLocation } from "wouter";
import { useTranslation } from "@/i18n";
import { HousAlertLogo } from "@/components/housalert-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Search, Zap, Bell, ArrowRight, ChevronLeft } from "lucide-react";
import { OB, OBStickyBar } from "@/components/onboarding-ui";

const BENEFITS = [
  {
    icon: Search,
    titleKey: "onboarding.intro.benefit1.title",
    descKey: "onboarding.intro.benefit1.desc",
  },
  {
    icon: Zap,
    titleKey: "onboarding.intro.benefit2.title",
    descKey: "onboarding.intro.benefit2.desc",
  },
  {
    icon: Bell,
    titleKey: "onboarding.intro.benefit3.title",
    descKey: "onboarding.intro.benefit3.desc",
  },
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
          className="text-[30px] font-extrabold tracking-[-0.03em] leading-[1.15] mb-3"
          style={{ color: OB.text }}
          data-testid="text-intro-title"
        >
          {t("onboarding.intro.title")}
        </h1>
        <p className="text-[15px] mb-10 leading-relaxed" style={{ color: OB.textSecondary }}>
          {t("onboarding.intro.subtitle")}
        </p>

        <div className="flex flex-col gap-6">
          {BENEFITS.map((b, i) => (
            <div key={i} className="flex items-center gap-4" data-testid={`benefit-${i}`}>
              <div
                className="w-12 h-12 rounded-[10px] flex items-center justify-center shrink-0"
                style={{ backgroundColor: OB.accentBg }}
              >
                <b.icon className="w-5 h-5" style={{ color: OB.pink }} />
              </div>
              <div>
                <p className="text-[15px] font-semibold" style={{ color: OB.text }}>
                  {t(b.titleKey)}
                </p>
                <p className="text-[13px] mt-0.5 leading-relaxed" style={{ color: OB.textSecondary }}>
                  {t(b.descKey)}
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
