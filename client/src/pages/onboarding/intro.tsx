import { useLocation } from "wouter";
import { useTranslation } from "@/i18n";
import { HousAlertLogo } from "@/components/housalert-logo";
import { Search, Zap, Bell, ArrowRight } from "lucide-react";
import heroImg from "@assets/50F77D08-ED68-40B2-AFD3-67D49A86100C_1774074748083.png";
import { OB, OBStickyBar } from "@/components/onboarding-ui";

const BENEFITS = [
  {
    icon: Search,
    titleKey: "onboarding.intro.benefit1Title",
    titleFallback: "Alle Portale, ein Alert",
    descKey: "onboarding.intro.benefit1Desc",
    descFallback: "Wir durchsuchen alle großen Wohnungsportale gleichzeitig.",
  },
  {
    icon: Zap,
    titleKey: "onboarding.intro.benefit2Title",
    titleFallback: "Sofort benachrichtigt",
    descKey: "onboarding.intro.benefit2Desc",
    descFallback: "Du erhältst innerhalb von Minuten eine Nachricht bei neuen Treffern.",
  },
  {
    icon: Bell,
    titleKey: "onboarding.intro.benefit3Title",
    titleFallback: "Nie wieder verpassen",
    descKey: "onboarding.intro.benefit3Desc",
    descFallback: "Sei der Erste, der sich auf neue Wohnungen bewirbt.",
  },
];

export default function OnboardingIntro() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();

  return (
    <div className="min-h-[100dvh] flex flex-col ob-dark" style={{ background: OB.gradient }} data-testid="screen-onboarding-intro">
      <header
        className="sticky top-0 z-20 backdrop-blur-md border-b"
        style={{ backgroundColor: OB.headerBg, borderColor: OB.headerBorder }}
      >
        <div className="max-w-[480px] mx-auto px-5 h-[56px] flex items-center justify-center">
          <HousAlertLogo size={28} />
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-5 pb-[100px]">
        <div className="w-full aspect-[16/9] rounded-[6px] overflow-hidden mt-6 mb-6">
          <img
            src={heroImg}
            alt="HousAlert"
            className="w-full h-full object-cover"
            data-testid="img-intro-hero"
          />
        </div>

        <h1
          className="text-[26px] font-bold tracking-[-0.02em] mb-2"
          style={{ color: OB.text }}
          data-testid="text-intro-title"
        >
          {t("onboarding.intro.title") || "Finde deine Traumwohnung"}
        </h1>
        <p className="text-[15px] mb-8 leading-relaxed" style={{ color: OB.textSecondary }}>
          {t("onboarding.intro.subtitle") || "HousAlert durchsucht alle großen Wohnungsportale und benachrichtigt dich sofort bei neuen Treffern."}
        </p>

        <div className="flex flex-col gap-5 mb-10">
          {BENEFITS.map((b, i) => (
            <div key={i} className="flex items-start gap-4" data-testid={`benefit-${i}`}>
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
          {t("onboarding.intro.cta") || "Jetzt starten"}
          <ArrowRight className="w-4 h-4" />
        </button>
        <p className="text-center text-[12px] mt-3 pb-1" style={{ color: OB.textMuted }}>
          {t("onboarding.intro.footerNote") || "Einrichtung dauert weniger als 2 Minuten"}
        </p>
      </OBStickyBar>
    </div>
  );
}
