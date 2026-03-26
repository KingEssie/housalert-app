import { useLocation } from "wouter";
import { useTranslation } from "@/i18n";
import { HousAlertLogo } from "@/components/housalert-logo";
import { Search, Zap, Bell, ArrowRight } from "lucide-react";
import heroImg from "@assets/50F77D08-ED68-40B2-AFD3-67D49A86100C_1774074748083.png";

const BRAND = "rgb(var(--ha-primary))";
const BRAND_HOVER = "rgb(var(--ha-primary-hover))";

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
    <div className="min-h-[100dvh] flex flex-col bg-ha-bg" data-testid="screen-onboarding-intro">
      <header className="sticky top-0 z-20 bg-ha-card border-b border-ha-card-border">
        <div className="max-w-[480px] mx-auto px-5 h-[56px] flex items-center justify-center">
          <HousAlertLogo size={28} />
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-5 pb-10">
        <div className="w-full aspect-[16/9] rounded-[6px] overflow-hidden mt-6 mb-6">
          <img
            src={heroImg}
            alt="HousAlert"
            className="w-full h-full object-cover"
            data-testid="img-intro-hero"
          />
        </div>

        <h1
          className="text-[26px] font-bold tracking-[-0.02em] text-ha-text mb-2"
          data-testid="text-intro-title"
        >
          {t("onboarding.intro.title") || "Finde deine Traumwohnung"}
        </h1>
        <p className="text-[15px] text-ha-text-secondary mb-8 leading-relaxed">
          {t("onboarding.intro.subtitle") || "HousAlert durchsucht alle großen Wohnungsportale und benachrichtigt dich sofort bei neuen Treffern."}
        </p>

        <div className="flex flex-col gap-5 mb-10">
          {BENEFITS.map((b, i) => (
            <div key={i} className="flex items-start gap-4" data-testid={`benefit-${i}`}>
              <div
                className="w-11 h-11 rounded-[6px] flex items-center justify-center shrink-0"
                style={{ backgroundColor: "rgba(var(--ha-primary-rgb, 233,30,99), 0.08)" }}
              >
                <b.icon className="w-5 h-5" style={{ color: BRAND }} />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-ha-text">
                  {t(b.titleKey) || b.titleFallback}
                </p>
                <p className="text-[13px] text-ha-text-secondary mt-0.5 leading-relaxed">
                  {t(b.descKey) || b.descFallback}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-auto">
          <button
            onClick={() => navigate("/onboarding/city")}
            className="w-full h-[52px] rounded-[6px] text-[15px] font-bold text-white transition-all active:scale-[0.97] flex items-center justify-center gap-2"
            style={{ backgroundColor: BRAND }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = BRAND_HOVER)}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = BRAND)}
            data-testid="button-intro-start"
          >
            {t("onboarding.intro.cta") || "Jetzt starten"}
            <ArrowRight className="w-4 h-4" />
          </button>

          <p className="text-center text-[12px] text-ha-text-muted mt-4">
            {t("onboarding.intro.footerNote") || "Einrichtung dauert weniger als 2 Minuten"}
          </p>
        </div>
      </main>
    </div>
  );
}
