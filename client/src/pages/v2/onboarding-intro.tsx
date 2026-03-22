import { useLocation } from "wouter";
import { useTranslation } from "@/i18n";
import { V2DarkScreenLayout, V2DarkHeader, V2DarkContent, V2BottomCTA } from "@/components/v2";
import { HousAlertLogo } from "@/components/housalert-logo";
import { Search, Zap, Bell, Shield } from "lucide-react";

const BENEFITS = [
  { num: "1", icon: Search, key: "benefit1" as const },
  { num: "2", icon: Zap, key: "benefit2" as const },
  { num: "3", icon: Bell, key: "benefit3" as const },
];

export default function V2OnboardingIntroPage() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();

  return (
    <V2DarkScreenLayout>
      <V2DarkHeader
        logo={
          <HousAlertLogo
            size={28}
            textClassName="font-semibold text-white text-[17px] tracking-[-0.01em]"
          />
        }
        right={
          <button
            onClick={() => navigate("/v2/welcome")}
            className="text-[13px] text-white/50 hover:text-white/70 transition-colors"
            data-testid="button-v2-intro-login"
          >
            {t("v2.intro.alreadyAccount")}
          </button>
        }
      />

      <V2DarkContent className="pt-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="flex -space-x-1">
            {["⭐", "⭐", "⭐", "⭐", "⭐"].map((s, i) => (
              <span key={i} className="text-[13px]">{s}</span>
            ))}
          </div>
          <span className="text-[13px] text-white/40">{t("v2.intro.trustScore")}</span>
        </div>

        <h1
          className="text-[28px] font-bold leading-[1.15] tracking-[-0.02em] text-white mb-3"
          data-testid="text-v2-intro-title"
        >
          {t("v2.intro.title")}
        </h1>
        <p
          className="text-[15px] text-white/50 leading-relaxed mb-10"
          data-testid="text-v2-intro-subtitle"
        >
          {t("v2.intro.subtitle")}
        </p>

        <div className="flex flex-col gap-5 mb-8">
          {BENEFITS.map(({ num, icon: Icon, key }) => (
            <div
              key={key}
              className="flex items-start gap-4"
              data-testid={`v2-benefit-${num}`}
            >
              <div className="w-11 h-11 rounded-xl bg-[#F97316]/15 flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-[#F97316]" />
              </div>
              <div className="flex-1 pt-0.5">
                <p className="text-[15px] font-semibold text-white leading-snug">
                  {t(`v2.intro.${key}.title`)}
                </p>
                <p className="text-[13px] text-white/45 leading-relaxed mt-1">
                  {t(`v2.intro.${key}.desc`)}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 mb-6">
          <Shield className="w-4 h-4 text-white/30 flex-shrink-0" />
          <span className="text-[12px] text-white/35">{t("v2.intro.guarantee")}</span>
        </div>
      </V2DarkContent>

      <V2BottomCTA
        primaryLabel={t("v2.intro.cta")}
        onPrimary={() => navigate("/v2/onboarding/location")}
        secondaryLabel={t("v2.intro.secondary")}
        onSecondary={() => navigate("/v2/welcome")}
      />
    </V2DarkScreenLayout>
  );
}
