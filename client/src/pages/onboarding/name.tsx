import { useState } from "react";
import { useLocation, Redirect } from "wouter";
import { useHashSearch } from "@/lib/hash-search";
import { useTranslation } from "@/i18n";
import { User } from "lucide-react";
import { useWebsiteMode, OBW, OBStickyBar, OB } from "@/components/onboarding-ui";
import { OnboardingFlowLayout } from "@/components/onboarding-flow-layout";
import { HousAlertLogo } from "@/components/housalert-logo";
import { ChevronLeft } from "lucide-react";

export default function OnboardingName() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const searchString = useHashSearch();
  const w = useWebsiteMode();
  const T = w ? OBW : OB;
  const incomingParams = new URLSearchParams(searchString);

  const [firstName, setFirstName] = useState(incomingParams.get("firstName") || "");
  const [lastName, setLastName] = useState(incomingParams.get("lastName") || "");

  const city = incomingParams.get("city") || "";
  if (!city) return <Redirect to="/onboarding/filters" />;

  function forwardParams() {
    const out = new URLSearchParams(searchString);
    out.set("firstName", firstName.trim());
    out.set("lastName", lastName.trim());
    return out.toString();
  }

  function handleNext() {
    if (!firstName.trim()) return;
    navigate(`/onboarding/email?${forwardParams()}`);
  }

  function handleBack() {
    navigate(`/onboarding/filters?${searchString}`);
  }

  function handleClose() {
    navigate("/");
  }

  if (w) {
    return (
      <div
        className="min-h-[100dvh] flex flex-col"
        style={{ background: T.gradient }}
        data-testid="screen-onboarding-name"
      >
        <header
          className="sticky top-0 z-20 backdrop-blur-md border-b"
          style={{ backgroundColor: T.headerBg, borderColor: T.headerBorder }}
        >
          <div className="max-w-[480px] mx-auto px-5 h-[56px] flex items-center gap-3">
            <button
              onClick={handleBack}
              className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-transform"
              style={{ backgroundColor: OBW.backBtnBg }}
              data-testid="button-name-back"
            >
              <ChevronLeft className="w-5 h-5" style={{ color: T.textSecondary }} />
            </button>
            <div className="flex-1 flex justify-center">
              <HousAlertLogo size={28} />
            </div>
            <div className="w-10" />
          </div>
        </header>

        <main className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-5 pt-4 pb-[100px]">
          <h1
            className="text-[30px] font-semibold tracking-[-0.025em] mb-2"
            style={{ color: T.text }}
            data-testid="text-name-title"
          >
            {t("onboarding.name.title")}
          </h1>
          <p className="text-[14px] mb-6 leading-relaxed" style={{ color: T.textSecondary }}>
            {t("onboarding.name.subtitle")}
          </p>

          <div className="flex flex-col gap-6">
            <div>
              <label className="text-[13px] font-medium mb-1.5 block" style={{ color: T.textSecondary }}>
                {t("onboarding.name.firstNameLabel")}
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px]" style={{ color: "rgb(var(--ha-text-secondary))" }} />
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder={t("onboarding.name.firstNamePlaceholder")}
                  className="w-full h-[56px] pl-12 pr-4 text-[16px] font-medium ha-field"
                  style={{ backgroundColor: OBW.inputBg, borderColor: OBW.inputBorder, color: OBW.text }}
                  autoFocus
                  data-testid="input-first-name"
                />
              </div>
            </div>
            <div>
              <label className="text-[13px] font-medium mb-1.5 block" style={{ color: T.textSecondary }}>
                {t("onboarding.name.lastNameLabel")}
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px]" style={{ color: "rgb(var(--ha-text-secondary))" }} />
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder={t("onboarding.name.lastNamePlaceholder")}
                  className="w-full h-[56px] pl-12 pr-4 text-[16px] font-medium ha-field"
                  style={{ backgroundColor: OBW.inputBg, borderColor: OBW.inputBorder, color: OBW.text }}
                  data-testid="input-last-name"
                />
              </div>
            </div>
          </div>
        </main>

        <OBStickyBar websiteMode={w}>
          <button
            onClick={handleNext}
            disabled={!firstName.trim()}
            className="w-full h-[48px] rounded-[12px] text-[16px] font-semibold text-white transition-all active:scale-[0.97] disabled:opacity-50"
            style={{ background: T.pink, boxShadow: firstName.trim() ? T.pinkShadow : "none" }}
            data-testid="button-name-next"
          >
            {t("common.next")}
          </button>
        </OBStickyBar>
      </div>
    );
  }

  const nameFormContent = (
    <div className="flex flex-col gap-5">
      <div>
        <label className="text-[13px] font-medium mb-1.5 block text-ha-text-secondary">
          {t("onboarding.name.firstNameLabel")}
        </label>
        <div className="relative">
          <User className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-ha-text-secondary" />
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder={t("onboarding.name.firstNamePlaceholder")}
            className="w-full h-[56px] pl-12 pr-4 rounded-[8px] border border-ha-border-input bg-white text-[16px] font-medium text-ha-text placeholder:text-ha-text-secondary placeholder:opacity-55 outline-none transition-all focus:border-ha-primary focus:ring-1 focus:ring-ha-primary/25"
            autoFocus
            data-testid="input-first-name"
          />
        </div>
      </div>
      <div>
        <label className="text-[13px] font-medium mb-1.5 block text-ha-text-secondary">
          {t("onboarding.name.lastNameLabel")}
        </label>
        <div className="relative">
          <User className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-ha-text-secondary" />
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder={t("onboarding.name.lastNamePlaceholder")}
            className="w-full h-[56px] pl-12 pr-4 rounded-[8px] border border-ha-border-input bg-white text-[16px] font-medium text-ha-text placeholder:text-ha-text-secondary placeholder:opacity-55 outline-none transition-all focus:border-ha-primary focus:ring-1 focus:ring-ha-primary/25"
            data-testid="input-last-name"
          />
        </div>
      </div>
    </div>
  );

  return (
    <OnboardingFlowLayout
      flowTitle={t("onboarding.accountCreate.flowTitle")}
      currentStep={1}
      totalSteps={3}
      stepTitle={t("onboarding.name.title")}
      stepDescription={t("onboarding.name.subtitle")}
      onBack={handleBack}
      onNext={handleNext}
      onClose={handleClose}
      nextLabel={t("common.next")}
      nextDisabled={!firstName.trim()}
      backTestId="button-name-back"
      nextTestId="button-name-next"
      screenTestId="screen-onboarding-name"
    >
      {nameFormContent}
    </OnboardingFlowLayout>
  );
}
