import { useLocation } from "wouter";
import { useTranslation } from "@/i18n";
import { useV2Onboarding } from "@/lib/v2-onboarding-store";
import {
  V2DarkScreenLayout,
  V2ProgressHeader,
  V2BottomCTA,
  V2Slider,
} from "@/components/v2";
import { Euro } from "lucide-react";
import { getMatchEstimateRange } from "@/lib/match-estimate";

function computeRawEstimate(radius: number, maxPrice: number): number {
  return Math.round(radius * 2.5 + maxPrice * 0.015);
}

export default function V2OnboardingFiltersPage() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const { data, update } = useV2Onboarding();

  const estimate = data.city
    ? getMatchEstimateRange(computeRawEstimate(data.radius, data.maxPrice || 2000))
    : null;

  const roomOptions = [
    { value: "any", label: t("v2.filters.doesntMatter") },
    { value: "0", label: "Studio+" },
    { value: "1", label: "1+" },
    { value: "2", label: "2+" },
    { value: "3", label: "3+" },
    { value: "4", label: "4+" },
    { value: "5", label: "5+" },
  ];

  return (
    <V2DarkScreenLayout>
      <V2ProgressHeader
        step={2}
        totalSteps={4}
        title={t("v2.filters.headerTitle")}
        onBack={() => navigate("/v2/onboarding/location")}
      />

      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-[180px]">
        <div className="max-w-[420px] mx-auto">
          <h2
            className="text-[22px] font-bold text-white mb-2"
            data-testid="text-v2-filters-title"
          >
            {t("v2.filters.title")}
          </h2>
          <p className="text-[14px] text-white/45 mb-8">
            {t("v2.filters.subtitle")}
          </p>

          <div className="space-y-7">
            <div>
              <label className="text-[13px] font-semibold text-white/55 tracking-wide mb-3 block">
                {t("v2.filters.priceRange")}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <Euro className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <input
                    type="number"
                    placeholder="€ 0"
                    value={data.minPrice || ""}
                    onChange={(e) => update({ minPrice: Number(e.target.value) || 0 })}
                    className="w-full h-[52px] rounded-xl bg-white/10 border border-white/15 pl-11 pr-4 text-[15px] text-white placeholder-white/30 outline-none focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316]/40 transition-all"
                    data-testid="input-v2-min-price"
                  />
                </div>
                <div className="relative">
                  <Euro className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <input
                    type="number"
                    placeholder="€ 2000"
                    value={data.maxPrice || ""}
                    onChange={(e) => update({ maxPrice: Number(e.target.value) || 0 })}
                    className="w-full h-[52px] rounded-xl bg-white/10 border border-white/15 pl-11 pr-4 text-[15px] text-white placeholder-white/30 outline-none focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316]/40 transition-all"
                    data-testid="input-v2-max-price"
                  />
                </div>
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[11px] text-white/30">{t("v2.filters.minLabel")}</span>
                <span className="text-[11px] text-white/30">{t("v2.filters.maxLabel")}</span>
              </div>
            </div>

            <div>
              <label className="text-[13px] font-semibold text-white/55 tracking-wide mb-3 block">
                {t("v2.filters.bedrooms")}
              </label>
              <div className="flex flex-wrap gap-2" data-testid="v2-room-selector">
                {roomOptions.map((opt) => {
                  const active = (data.minRooms === 0 && opt.value === "any") ||
                    String(data.minRooms) === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => update({ minRooms: opt.value === "any" ? 0 : Number(opt.value) })}
                      className={`h-[42px] px-5 rounded-xl text-[14px] font-medium border transition-all active:scale-95 ${
                        active
                          ? "bg-[#F97316]/20 border-[#F97316] text-[#F97316]"
                          : "bg-white/5 border-white/15 text-white/60 hover:border-white/30"
                      }`}
                      data-testid={`room-option-${opt.value}`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <V2Slider
              label={t("v2.filters.minArea")}
              value={data.minSize}
              onChange={(val) => update({ minSize: val })}
              min={0}
              max={200}
              step={5}
              formatValue={(v) => `${v} m²`}
            />

            {estimate && (
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-white/50">
                    {t("v2.filters.estimatedMatches")}
                  </span>
                  <span className="text-[16px] font-bold text-[#F97316]" data-testid="text-v2-filter-estimate">
                    {estimate.low}–{estimate.high} / {t("v2.filters.perWeek")}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <V2BottomCTA
        primaryLabel={t("v2.filters.continue")}
        onPrimary={() => navigate("/v2/onboarding/preferences")}
      >
        {estimate && (
          <div className="text-center text-[13px] text-white/40 mb-1">
            🎯 {estimate.low}–{estimate.high} {t("v2.filters.matchesPerWeek")}
          </div>
        )}
      </V2BottomCTA>
    </V2DarkScreenLayout>
  );
}
