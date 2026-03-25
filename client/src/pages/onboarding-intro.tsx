import { useLocation } from "wouter";
import { useTranslation } from "@/i18n";
import { HousAlertLogo } from "@/components/housalert-logo";
import { Search, Zap, Bell } from "lucide-react";

const BRAND = "rgb(var(--ha-primary))";
const BRAND_HOVER = "rgb(var(--ha-primary-hover))";

const BENEFITS = [
  { icon: Search, key: "benefit1" as const },
  { icon: Zap, key: "benefit2" as const },
  { icon: Bell, key: "benefit3" as const },
];

export default function OnboardingIntroPage() {
  console.log("[PAGE] OnboardingIntroPage rendered (pre-auth value prop)");
  const [, navigate] = useLocation();
  const { t } = useTranslation();

  return (
    <div className="min-h-[100dvh] bg-ha-bg flex flex-col" data-testid="onboarding-intro-page">
      <header className="w-full bg-ha-bg sticky top-0 z-20 border-b border-ha-card-border">
        <div className="max-w-lg mx-auto px-5 h-[56px] flex items-center justify-between">
          <HousAlertLogo size={32} textClassName="font-semibold text-ha-text text-[17px] tracking-[-0.01em]" />
          <button
            onClick={() => navigate("/welcome")}
            className="text-[13px] font-medium text-ha-text-secondary hover:text-ha-text transition-colors"
            data-testid="button-back-to-login"
          >
            {t("onboardingIntro.alreadyAccount")}
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-[max(env(safe-area-inset-bottom),24px)]">
        <div className="w-full max-w-[380px] flex flex-col items-center text-center">
          <div
            className="w-[72px] h-[72px] rounded-2xl flex items-center justify-center mb-8 bg-ha-primary/10"
          >
            <Search className="w-8 h-8 text-ha-primary" />
          </div>

          <h1
            className="text-[26px] font-bold leading-[1.15] tracking-[-0.02em] text-ha-text mb-3"
            data-testid="text-intro-title"
          >
            {t("onboardingIntro.title")}
          </h1>

          <p
            className="text-[15px] leading-relaxed text-ha-text-secondary mb-10"
            data-testid="text-intro-subtitle"
          >
            {t("onboardingIntro.subtitle")}
          </p>

          <div className="w-full flex flex-col gap-4 mb-10">
            {BENEFITS.map(({ icon: Icon, key }, i) => (
              <div
                key={i}
                className="flex items-start gap-3.5 text-left"
                data-testid={`benefit-${i + 1}`}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-ha-primary/10"
                >
                  <Icon className="w-5 h-5 text-ha-primary" />
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-ha-text leading-snug">
                    {t(`onboardingIntro.${key}.title`)}
                  </p>
                  <p className="text-[13px] text-ha-text-secondary leading-relaxed mt-0.5">
                    {t(`onboardingIntro.${key}.desc`)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => navigate("/onboarding/location")}
            className="w-full h-[52px] rounded-[14px] text-[16px] font-bold text-ha-text transition-all active:scale-[0.97] shadow-[0_4px_14px_rgba(233,30,99,0.3)]"
            style={{ backgroundColor: BRAND }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = BRAND_HOVER)}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = BRAND)}
            data-testid="button-create-profile"
          >
            {t("onboardingIntro.cta")}
          </button>

          <button
            onClick={() => navigate("/welcome")}
            className="mt-4 text-[13px] font-medium text-ha-text-secondary hover:text-ha-text transition-colors"
            data-testid="button-browse-listings"
          >
            {t("onboardingIntro.secondary")}
          </button>
        </div>
      </main>
    </div>
  );
}
