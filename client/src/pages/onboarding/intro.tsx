import { useLocation } from "wouter";
import { useTranslation } from "@/i18n";
import { HousAlertLogo } from "@/components/housalert-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Search, Zap, Bell, ArrowRight } from "lucide-react";
import { OB, OBStickyBar } from "@/components/onboarding-ui";

const BENEFITS = [
  {
    icon: Search,
    titleKey: "onboarding.intro.benefit1.title",
    titleFallback: "Alle woningen op één plek",
    descKey: "onboarding.intro.benefit1.desc",
    descFallback: "Wij doorzoeken Kamernet, Pararius en meer tegelijk — je mist niets.",
  },
  {
    icon: Zap,
    titleKey: "onboarding.intro.benefit2.title",
    titleFallback: "Sneller dan wie dan ook",
    descKey: "onboarding.intro.benefit2.desc",
    descFallback: "Ontvang nieuwe huurwoningen binnen minuten — reageer als eerste.",
  },
  {
    icon: Bell,
    titleKey: "onboarding.intro.benefit3.title",
    titleFallback: "Directe meldingen",
    descKey: "onboarding.intro.benefit3.desc",
    descFallback: "Push, e-mail of WhatsApp — je wordt direct geïnformeerd.",
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

      <main className="flex-1 flex flex-col justify-center max-w-[480px] mx-auto w-full px-5 pb-[120px]">
        <h1
          className="text-[30px] font-bold tracking-[-0.03em] leading-[1.15] mb-3"
          style={{ color: OB.text }}
          data-testid="text-intro-title"
        >
          {t("onboarding.intro.title") || "Vind jouw droomwoning"}
        </h1>
        <p className="text-[15px] mb-10 leading-relaxed" style={{ color: OB.textSecondary }}>
          {t("onboarding.intro.subtitle") || "HousAlert doorzoekt alle grote woningportalen en stuurt je direct een melding bij nieuwe woningen."}
        </p>

        <div className="flex flex-col gap-6">
          {BENEFITS.map((b, i) => (
            <div key={i} className="flex items-center gap-4" data-testid={`benefit-${i}`}>
              <div
                className="w-11 h-11 rounded-[6px] flex items-center justify-center shrink-0"
                style={{ backgroundColor: OB.accentBg }}
              >
                <b.icon className="w-5 h-5" style={{ color: OB.pink }} />
              </div>
              <div>
                <p className="text-[15px] font-semibold" style={{ color: OB.text }}>
                  {t(b.titleKey) || b.titleFallback}
                </p>
                <p className="text-[13px] mt-0.5 leading-relaxed" style={{ color: OB.textSecondary }}>
                  {t(b.descKey) || b.descFallback}
                </p>
              </div>
            </div>
          ))}
        </div>
      </main>

      <OBStickyBar>
        <button
          onClick={() => navigate("/onboarding/city")}
          className="w-full h-[56px] rounded-[6px] text-[15px] font-bold text-white transition-all active:scale-[0.97] flex items-center justify-center gap-2"
          style={{ background: OB.pinkGradient, boxShadow: OB.pinkShadow }}
          data-testid="button-intro-start"
        >
          {t("onboarding.intro.cta") || "Nu starten"}
          <ArrowRight className="w-4 h-4" />
        </button>
        <div className="flex items-center justify-center gap-1 mt-3 pb-1">
          <span className="text-[12px]" style={{ color: OB.textMuted }}>
            {t("onboarding.intro.alreadyAccount") || "Al een account?"}
          </span>
          <button
            onClick={() => navigate("/login")}
            className="text-[12px] font-semibold"
            style={{ color: OB.pink }}
            data-testid="link-intro-login"
          >
            {t("onboarding.intro.login") || "Inloggen"}
          </button>
        </div>
      </OBStickyBar>
    </div>
  );
}
