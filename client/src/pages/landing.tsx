import { useEffect } from "react";
import { useLocation } from "wouter";
import { Search, Bell, Zap, ArrowRight, CheckCircle2 } from "lucide-react";
import { HousAlertLogo } from "@/components/housalert-logo";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { trackEventLazy } from "@/lib/track-event";

export default function LandingPage() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();

  useEffect(() => {
    trackEventLazy("landing_viewed");
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="w-full bg-background sticky top-0 z-20 border-b" style={{ borderColor: "#E5E7EB" }}>
        <div className="max-w-5xl mx-auto px-6 h-[60px] flex items-center justify-between gap-4">
          <HousAlertLogo size={36} textClassName="font-medium text-xl tracking-tight text-[#222222]" />
          <Button
            variant="ghost"
            className="text-muted-foreground font-medium text-sm"
            onClick={() => navigate("/login")}
            data-testid="button-login-nav"
          >
            {t("landing.login")}
          </Button>
        </div>
      </header>

      <main>
        <section className="bg-background">
          <div className="max-w-2xl mx-auto px-6 pt-20 pb-24 md:pt-28 md:pb-32 text-center">
            <h1
              className="text-[40px] md:text-[56px] font-semibold leading-[1.05] tracking-[-0.03em] mb-6"
              style={{ color: "#222222" }}
              data-testid="text-headline"
            >
              {t("landing.headline")}
            </h1>
            <p
              className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-12 max-w-lg mx-auto"
              data-testid="text-subheadline"
            >
              {t("landing.subheadline")}
            </p>
            <Button
              size="lg"
              className="h-[56px] px-10 rounded-full text-[16px] font-medium bg-primary text-primary-foreground"
              onClick={() => navigate("/onboarding/location")}
              data-testid="button-start-search"
            >
              {t("landing.startSearch")}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>

            <div className="flex items-center justify-center gap-6 mt-10 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" style={{ color: "#0D6EFD" }} />
                {t("landing.freeStart")}
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" style={{ color: "#0D6EFD" }} />
                {t("landing.instantAlerts")}
              </span>
            </div>
          </div>
        </section>

        <section className="px-6 py-20 md:py-28">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-[30px] md:text-[36px] font-medium text-center tracking-[-0.03em] leading-[1.1] mb-14" style={{ color: "#222222" }} data-testid="text-features-heading">
              {t("landing.featuresHeading")}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-card rounded-lg p-6 shadow-sm" data-testid="card-feature-search">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-5" style={{ backgroundColor: "#EBF2FF" }}>
                  <Search className="w-6 h-6" style={{ color: "#0D6EFD" }} />
                </div>
                <h3 className="text-[18px] font-medium mb-2" style={{ color: "#222222" }}>{t("landing.smartSearch")}</h3>
                <p className="text-[15px] text-muted-foreground leading-relaxed">
                  {t("landing.smartSearchDesc")}
                </p>
              </div>

              <div className="bg-card rounded-lg p-6 shadow-sm" data-testid="card-feature-alerts">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-5" style={{ backgroundColor: "#EBF2FF" }}>
                  <Bell className="w-6 h-6" style={{ color: "#0D6EFD" }} />
                </div>
                <h3 className="text-[18px] font-medium mb-2" style={{ color: "#222222" }}>{t("landing.instantAlertsTitle")}</h3>
                <p className="text-[15px] text-muted-foreground leading-relaxed">
                  {t("landing.instantAlertsDesc")}
                </p>
              </div>

              <div className="bg-card rounded-lg p-6 shadow-sm" data-testid="card-feature-fast">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-5" style={{ backgroundColor: "#EBF2FF" }}>
                  <Zap className="w-6 h-6" style={{ color: "#0D6EFD" }} />
                </div>
                <h3 className="text-[18px] font-medium mb-2" style={{ color: "#222222" }}>{t("landing.fasterTitle")}</h3>
                <p className="text-[15px] text-muted-foreground leading-relaxed">
                  {t("landing.fasterDesc")}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 pb-20 md:pb-28">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-[30px] md:text-[36px] font-medium text-center tracking-[-0.03em] leading-[1.1] mb-14" style={{ color: "#222222" }} data-testid="text-how-it-works">
              {t("landing.howItWorks")}
            </h2>
            <div className="space-y-0">
              {[
                { step: "1", title: t("landing.step1Title"), desc: t("landing.step1Desc") },
                { step: "2", title: t("landing.step2Title"), desc: t("landing.step2Desc") },
                { step: "3", title: t("landing.step3Title"), desc: t("landing.step3Desc") },
              ].map((item, i) => (
                <div key={item.step} className="flex items-start gap-5" data-testid={`step-${item.step}`}>
                  <div className="flex flex-col items-center">
                    <div className="w-11 h-11 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <span className="text-primary-foreground font-medium text-sm">{item.step}</span>
                    </div>
                    {i < 2 && <div className="w-0.5 h-10 mt-2" style={{ backgroundColor: "#E5E7EB" }} />}
                  </div>
                  <div className="pt-2 pb-6">
                    <h3 className="text-[18px] font-medium mb-1" style={{ color: "#222222" }}>{item.title}</h3>
                    <p className="text-[15px] text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 pb-24 md:pb-32">
          <div className="max-w-xl mx-auto bg-card rounded-lg p-8 md:p-12 text-center shadow-sm">
            <h2 className="text-[32px] font-medium tracking-[-0.03em] leading-[1.1] mb-4" style={{ color: "#222222" }} data-testid="text-cta-bottom">
              {t("landing.ctaBottom")}
            </h2>
            <p className="text-[15px] text-muted-foreground mb-8">
              {t("landing.ctaDesc")}
            </p>
            <Button
              size="lg"
              className="h-[56px] px-10 rounded-full text-[16px] font-medium bg-primary text-primary-foreground"
              onClick={() => navigate("/onboarding/location")}
              data-testid="button-start-search-bottom"
            >
              {t("landing.startSearch")}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 px-6 bg-background" style={{ borderColor: "#E5E7EB" }}>
        <div className="max-w-5xl mx-auto flex flex-col items-center gap-3">
          <div className="flex items-center gap-4 flex-wrap justify-center text-sm text-muted-foreground">
            <a href="/impressum" className="hover:text-foreground transition-colors" data-testid="link-impressum">Impressum</a>
            <a href="/datenschutz" className="hover:text-foreground transition-colors" data-testid="link-datenschutz">Datenschutz</a>
            <a href="/terms" className="hover:text-foreground transition-colors" data-testid="link-terms">AGB</a>
          </div>
          <p className="text-[13px] text-muted-foreground">
            {t("landing.copyright", { year: String(new Date().getFullYear()) })}
          </p>
        </div>
      </footer>
    </div>
  );
}
