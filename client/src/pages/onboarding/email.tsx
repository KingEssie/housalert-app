import { useState } from "react";
import { useLocation, Redirect } from "wouter";
import { useHashSearch } from "@/lib/hash-search";
import { useTranslation } from "@/i18n";
import { Mail, ChevronLeft } from "lucide-react";
import { useWebsiteMode, OBW, OBStickyBar, OB } from "@/components/onboarding-ui";
import { OnboardingFlowLayout } from "@/components/onboarding-flow-layout";
import { HousAlertLogo } from "@/components/housalert-logo";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function OnboardingEmail() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const searchString = useHashSearch();
  const w = useWebsiteMode();
  const T = w ? OBW : OB;
  const incomingParams = new URLSearchParams(searchString);

  const [email, setEmail] = useState(incomingParams.get("email") || "");

  const city = incomingParams.get("city") || "";
  const firstName = incomingParams.get("firstName") || "";
  if (!city || !firstName) return <Redirect to="/onboarding/intro" />;

  function forwardParams() {
    const out = new URLSearchParams(searchString);
    out.set("email", email.trim().toLowerCase());
    return out.toString();
  }

  function handleNext() {
    if (!isValidEmail(email)) return;
    navigate(`/onboarding/password?${forwardParams()}`);
  }

  function handleBack() {
    const out = new URLSearchParams(searchString);
    out.set("email", email.trim().toLowerCase());
    navigate(`/onboarding/name?${out.toString()}`);
  }

  function handleClose() {
    navigate("/");
  }

  if (w) {
    return (
      <div
        className="min-h-[100dvh] flex flex-col"
        style={{ background: T.gradient }}
        data-testid="screen-onboarding-email"
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
              data-testid="button-email-back"
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
            data-testid="text-email-title"
          >
            {t("onboarding.email.title")}
          </h1>
          <p className="text-[14px] mb-6 leading-relaxed" style={{ color: T.textSecondary }}>
            {t("onboarding.email.subtitle")}
          </p>

          <div>
            <label className="text-[13px] font-medium mb-1.5 block" style={{ color: T.textSecondary }}>
              {t("onboarding.email.label")}
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px]" style={{ color: "#334855" }} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("onboarding.email.placeholder")}
                className="w-full h-[56px] pl-12 pr-4 text-[16px] font-medium ha-field"
                style={{ backgroundColor: OBW.inputBg, borderColor: OBW.inputBorder, color: OBW.text }}
                autoFocus
                data-testid="input-email"
              />
            </div>
          </div>
        </main>

        <OBStickyBar websiteMode={w}>
          <button
            onClick={handleNext}
            disabled={!isValidEmail(email)}
            className="w-full h-[48px] rounded-[12px] text-[16px] font-semibold text-white transition-all active:scale-[0.97] disabled:opacity-50"
            style={{ background: T.pink, boxShadow: isValidEmail(email) ? T.pinkShadow : "none" }}
            data-testid="button-email-next"
          >
            {t("common.next")}
          </button>
        </OBStickyBar>
      </div>
    );
  }

  const emailFormContent = (
    <div>
      <label className="text-[13px] font-medium mb-1.5 block text-[#334855]">
        {t("onboarding.email.label")}
      </label>
      <div className="relative">
        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#334855]" />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("onboarding.email.placeholder")}
          className="w-full h-[56px] pl-12 pr-4 rounded-[8px] border border-[#D1D5DB] bg-white text-[16px] font-medium text-[#111111] placeholder:text-[#334855] placeholder:opacity-55 outline-none transition-all focus:border-ha-primary focus:ring-1 focus:ring-ha-primary/25"
          autoFocus
          data-testid="input-email"
        />
      </div>
    </div>
  );

  return (
    <OnboardingFlowLayout
      flowTitle={t("onboarding.accountCreate.flowTitle")}
      currentStep={2}
      totalSteps={3}
      stepTitle={t("onboarding.email.title")}
      stepDescription={t("onboarding.email.subtitle")}
      onBack={handleBack}
      onNext={handleNext}
      onClose={handleClose}
      nextLabel={t("common.next")}
      nextDisabled={!isValidEmail(email)}
      backTestId="button-email-back"
      nextTestId="button-email-next"
      screenTestId="screen-onboarding-email"
    >
      {emailFormContent}
    </OnboardingFlowLayout>
  );
}
