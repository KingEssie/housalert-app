import { useLocation } from "wouter";
import { useTranslation } from "@/i18n";
import { useV2Onboarding } from "@/lib/v2-onboarding-store";
import {
  V2DarkScreenLayout,
  V2ProgressHeader,
  V2BottomCTA,
  V2Toggle,
  V2SegmentedControl,
} from "@/components/v2";

export default function V2OnboardingPreferencesPage() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const { data, update } = useV2Onboarding();

  const frequencyOptions = [
    { value: "instant", label: t("v2.preferences.instant") },
    { value: "daily", label: t("v2.preferences.daily") },
    { value: "weekly", label: t("v2.preferences.weekly") },
  ];

  const furnishedOptions = [
    { value: "any", label: t("v2.preferences.any") },
    { value: "furnished", label: t("v2.preferences.furnished") },
    { value: "unfurnished", label: t("v2.preferences.unfurnished") },
  ];

  return (
    <V2DarkScreenLayout>
      <V2ProgressHeader
        step={3}
        totalSteps={4}
        title={t("v2.preferences.headerTitle")}
        onBack={() => navigate("/v2/onboarding/filters")}
      />

      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-[160px]">
        <div className="max-w-[420px] mx-auto">
          <h2
            className="text-[22px] font-bold text-white mb-2"
            data-testid="text-v2-preferences-title"
          >
            {t("v2.preferences.title")}
          </h2>
          <p className="text-[14px] text-white/45 mb-8">
            {t("v2.preferences.subtitle")}
          </p>

          <div className="space-y-8">
            <div>
              <label className="text-[13px] font-semibold text-white/55 tracking-wide mb-3 block">
                {t("v2.preferences.furnishing")}
              </label>
              <V2SegmentedControl
                options={furnishedOptions}
                value={data.furnished}
                onChange={(val) => update({ furnished: val })}
              />
            </div>

            <div>
              <label className="text-[13px] font-semibold text-white/55 tracking-wide mb-3 block">
                {t("v2.preferences.notificationSpeed")}
              </label>
              <V2SegmentedControl
                options={frequencyOptions}
                value={data.notificationFrequency}
                onChange={(val) => update({ notificationFrequency: val })}
              />
              <p className="text-[12px] text-white/30 mt-2">
                {t("v2.preferences.speedHint")}
              </p>
            </div>

            <div className="bg-white/5 rounded-xl border border-white/10 px-4 divide-y divide-white/5">
              <V2Toggle
                label={t("v2.preferences.emailAlerts")}
                description={t("v2.preferences.emailAlertsDesc")}
                checked={data.emailNotifications}
                onChange={(val) => update({ emailNotifications: val })}
              />
              <V2Toggle
                label={t("v2.preferences.pushAlerts")}
                description={t("v2.preferences.pushAlertsDesc")}
                checked={data.pushNotifications}
                onChange={(val) => update({ pushNotifications: val })}
              />
              <V2Toggle
                label={t("v2.preferences.whatsappAlerts")}
                description={t("v2.preferences.whatsappAlertsDesc")}
                checked={data.whatsappNotifications}
                onChange={(val) => update({ whatsappNotifications: val })}
              />
            </div>
          </div>
        </div>
      </div>

      <V2BottomCTA
        primaryLabel={t("v2.preferences.continue")}
        onPrimary={() => navigate("/v2/onboarding/value")}
      />
    </V2DarkScreenLayout>
  );
}
