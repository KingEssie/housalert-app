import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "@/i18n";
import { useV2Onboarding } from "@/lib/v2-onboarding-store";
import {
  V2DarkScreenLayout,
  V2ProgressHeader,
  V2BottomCTA,
  V2SegmentedControl,
  V2Slider,
} from "@/components/v2";
import { V2TextInput } from "@/components/v2";
import { Search, MapPin, Navigation } from "lucide-react";
import { defaultCities } from "../../../../config/market";
import { getMatchEstimateRange } from "@/lib/match-estimate";

function computeRawEstimate(radius: number, maxPrice: number): number {
  return Math.round(radius * 2.5 + maxPrice * 0.015);
}

export default function V2OnboardingLocationPage() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const { data, update } = useV2Onboarding();

  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);

  const filteredCities = searchQuery.trim()
    ? defaultCities.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : defaultCities;

  const selectCity = (city: typeof defaultCities[0]) => {
    update({
      city: city.name,
      lat: city.lat,
      lng: city.lng,
      locationMode: "city",
    });
    setSearchQuery(city.name);
    setShowResults(false);
  };

  const estimate = data.city
    ? getMatchEstimateRange(computeRawEstimate(data.radius, data.maxPrice || 2000))
    : null;

  const canContinue = !!data.city;

  return (
    <V2DarkScreenLayout>
      <V2ProgressHeader
        step={1}
        totalSteps={4}
        title={t("v2.location.headerTitle")}
        onBack={() => navigate("/v2/onboarding/intro")}
      />

      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-[180px]">
        <div className="max-w-[420px] mx-auto">
          <h2
            className="text-[22px] font-bold text-white mb-2"
            data-testid="text-v2-location-title"
          >
            {t("v2.location.title")}
          </h2>
          <p className="text-[14px] text-white/45 mb-6">
            {t("v2.location.subtitle")}
          </p>

          <div className="relative mb-6">
            <V2TextInput
              placeholder={t("v2.location.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowResults(true);
              }}
              onFocus={() => setShowResults(true)}
              icon={<Search className="w-5 h-5" />}
              data-testid="input-v2-city-search"
            />

            {showResults && searchQuery.trim() && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-[#2A2A42] border border-white/10 rounded-xl shadow-xl max-h-[240px] overflow-y-auto z-40">
                {filteredCities.length === 0 ? (
                  <div className="px-4 py-3 text-[14px] text-white/40">
                    {t("v2.location.noResults")}
                  </div>
                ) : (
                  filteredCities.map((city) => (
                    <button
                      key={city.name}
                      onClick={() => selectCity(city)}
                      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left ${
                        data.city === city.name
                          ? "text-[#F97316]"
                          : "text-white/70"
                      }`}
                      data-testid={`city-option-${city.name}`}
                    >
                      <MapPin className="w-4 h-4 flex-shrink-0" />
                      <span className="text-[14px] font-medium">{city.name}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {!searchQuery.trim() && !data.city && (
            <div className="mb-6">
              <p className="text-[13px] text-white/35 mb-3 font-medium uppercase tracking-wide">
                {t("v2.location.popularCities")}
              </p>
              <div className="flex flex-wrap gap-2">
                {defaultCities.slice(0, 8).map((city) => (
                  <button
                    key={city.name}
                    onClick={() => selectCity(city)}
                    className="h-[36px] px-4 rounded-full text-[13px] font-medium border border-white/15 text-white/60 hover:border-white/30 hover:text-white/80 transition-all active:scale-95 bg-white/5"
                    data-testid={`popular-city-${city.name}`}
                  >
                    {city.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {data.city && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#F97316]/10 border border-[#F97316]/20">
                <MapPin className="w-5 h-5 text-[#F97316]" />
                <div>
                  <p className="text-[15px] font-semibold text-white">{data.city}</p>
                  <p className="text-[12px] text-white/40">
                    {t("v2.location.selectedCity")}
                  </p>
                </div>
                <button
                  onClick={() => {
                    update({ city: "", lat: 52.52, lng: 13.405 });
                    setSearchQuery("");
                  }}
                  className="ml-auto text-[12px] text-white/40 hover:text-white/60"
                  data-testid="button-v2-change-city"
                >
                  {t("v2.location.change")}
                </button>
              </div>

              <V2Slider
                label={t("v2.location.radius")}
                value={data.radius}
                onChange={(val) => update({ radius: val })}
                min={1}
                max={50}
                step={1}
                formatValue={(v) => `${v} km`}
              />

              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-white/50">
                    {t("v2.location.estimatedMatches")}
                  </span>
                  {estimate && (
                    <span className="text-[16px] font-bold text-[#F97316]" data-testid="text-v2-estimate">
                      {estimate.low}–{estimate.high} / {t("v2.location.perWeek")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <V2BottomCTA
        primaryLabel={t("v2.location.continue")}
        onPrimary={() => navigate("/v2/onboarding/filters")}
        primaryDisabled={!canContinue}
      >
        {estimate && (
          <div className="text-center text-[13px] text-white/40 mb-1">
            🎯 {estimate.low}–{estimate.high} {t("v2.location.matchesPerWeek")}
          </div>
        )}
      </V2BottomCTA>
      {/* Note: /v2/onboarding/filters route will be added in Phase 2 */}
    </V2DarkScreenLayout>
  );
}
