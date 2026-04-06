import { useState } from "react";
import { useLocation } from "wouter";
import { useHashSearch } from "@/lib/hash-search";
import { useTranslation } from "@/i18n";
import { HousAlertLogo } from "@/components/housalert-logo";
import { ChevronLeft, Mail } from "lucide-react";
import { OB, OBW, OBStickyBar, useWebsiteMode } from "@/components/onboarding-ui";

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

  return (
    <div
      className="min-h-[100dvh] flex flex-col"
      style={{ background: T.gradient }}
      data-testid="screen-onboarding-email"
    >
      <header
        className="sticky top-0 z-20 backdrop-blur-md border-b"
        style={{
          backgroundColor: T.headerBg,
          borderColor: T.headerBorder,
          paddingTop: w ? "0px" : undefined,
        }}
      >
        <div className="max-w-[480px] mx-auto px-5 h-[56px] flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-transform"
            style={{ backgroundColor: w ? OBW.backBtnBg : OB.backBtnBg }}
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
          {t("onboarding.email.title") || "Wie lautet deine E-Mail?"}
        </h1>
        <p className="text-[14px] mb-6 leading-relaxed" style={{ color: T.textSecondary }}>
          {t("onboarding.email.subtitle") || "Hierhin senden wir deine Wohnungsalarme."}
        </p>

        <div>
          <label className="text-[13px] font-medium mb-1.5 block" style={{ color: T.textSecondary }}>
            {t("onboarding.email.label") || "E-Mail-Adresse"}
          </label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px]" style={{ color: "#6B7280" }} />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("onboarding.email.placeholder") || "deine@email.de"}
              className={`w-full h-[56px] pl-12 pr-4 rounded-[6px] text-[15px] font-medium ${w ? "ha-field" : "ob-input"}`}
              style={w ? { backgroundColor: OBW.inputBg, borderColor: OBW.inputBorder, color: OBW.text } : undefined}
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
          className="w-full h-[56px] rounded-[6px] text-[15px] font-semibold text-white transition-all active:scale-[0.97] disabled:opacity-50"
          style={{ background: T.pink, boxShadow: isValidEmail(email) ? T.pinkShadow : "none" }}
          data-testid="button-email-next"
        >
          {t("common.next") || "Weiter"}
        </button>
      </OBStickyBar>
    </div>
  );
}
