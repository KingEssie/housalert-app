import { useLocation } from "wouter";
import { useTranslation } from "@/i18n";
import { useV2Onboarding } from "@/lib/v2-onboarding-store";
import {
  V2DarkScreenLayout,
  V2ProgressHeader,
  V2BottomCTA,
} from "@/components/v2";
import { Clock, Bell, Shield, Zap } from "lucide-react";
import { getMatchEstimateRange } from "@/lib/match-estimate";

function computeRawEstimate(radius: number, maxPrice: number): number {
  return Math.round(radius * 2.5 + maxPrice * 0.015);
}

const VALUE_ITEMS = [
  { icon: Clock, key: "speed" as const },
  { icon: Bell, key: "alerts" as const },
  { icon: Zap, key: "advantage" as const },
];

export default function V2OnboardingValuePage() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const { data } = useV2Onboarding();

  const estimate = data.city
    ? getMatchEstimateRange(computeRawEstimate(data.radius, data.maxPrice || 2000))
    : null;

  return (
    <V2DarkScreenLayout>
      <V2ProgressHeader
        step={4}
        totalSteps={4}
        title={t("v2.value.headerTitle")}
        onBack={() => navigate("/v2/onboarding/preferences")}
      />

      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-[180px]">
        <div className="max-w-[420px] mx-auto">
          <h2
            className="text-[22px] font-bold text-white mb-2"
            data-testid="text-v2-value-title"
          >
            {t("v2.value.title")}
          </h2>
          <p className="text-[14px] text-white/45 mb-8">
            {t("v2.value.subtitle")}
          </p>

          {data.city && (
            <div className="bg-[#F97316]/10 border border-[#F97316]/20 rounded-xl p-4 mb-8">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] text-white/50">{t("v2.value.yourSearch")}</span>
              </div>
              <p className="text-[16px] font-semibold text-white">{data.city}</p>
              <p className="text-[13px] text-white/40 mt-1">
                {data.radius} km • €{data.minPrice || 0}–€{data.maxPrice || 2000} • {data.minRooms || 0}+ {t("v2.value.rooms")}
              </p>
              {estimate && (
                <p className="text-[14px] font-bold text-[#F97316] mt-3" data-testid="text-v2-value-estimate">
                  ~{estimate.low}–{estimate.high} {t("v2.value.matchesWeek")}
                </p>
              )}
            </div>
          )}

          <div className="space-y-4 mb-8">
            {VALUE_ITEMS.map(({ icon: Icon, key }) => (
              <div
                key={key}
                className="flex items-start gap-3.5 bg-white/5 rounded-xl border border-white/10 p-4"
                data-testid={`v2-value-${key}`}
              >
                <div className="w-10 h-10 rounded-xl bg-[#F97316]/15 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-[#F97316]" />
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-white leading-snug">
                    {t(`v2.value.${key}.title`)}
                  </p>
                  <p className="text-[13px] text-white/40 leading-relaxed mt-1">
                    {t(`v2.value.${key}.desc`)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
            <Shield className="w-4 h-4 text-white/30 flex-shrink-0" />
            <span className="text-[12px] text-white/35">{t("v2.value.guarantee")}</span>
          </div>
        </div>
      </div>

      <V2BottomCTA
        primaryLabel={t("v2.value.createAccount")}
        onPrimary={() => navigate("/signup")}
        secondaryLabel={t("v2.value.alreadyAccount")}
        onSecondary={() => navigate("/v2/welcome")}
      />
    </V2DarkScreenLayout>
  );
}
