import { useState } from "react";
import { useLocation } from "wouter";
import { useHashSearch } from "@/lib/hash-search";
import { useTranslation } from "@/i18n";
import { HousAlertLogo } from "@/components/housalert-logo";
import { ChevronLeft, Mail } from "lucide-react";

const BRAND = "rgb(var(--ha-primary))";
const BRAND_HOVER = "rgb(var(--ha-primary-hover))";

const INPUT_CLS = "w-full h-[48px] pl-11 pr-4 rounded-[6px] border border-ha-card-border bg-ha-card text-[15px] font-medium text-ha-text placeholder:text-ha-text-muted placeholder:font-normal focus:border-ha-primary focus:shadow-[0_0_0_3px_rgba(233,30,99,0.08)] outline-none transition-all";

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-1.5 justify-center py-3" data-testid="progress-dots">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="h-[6px] rounded-full transition-all"
          style={{
            width: i === current ? 24 : 6,
            backgroundColor: i <= current ? BRAND : "rgba(var(--ha-text-rgb, 26,26,46), 0.12)",
          }}
        />
      ))}
    </div>
  );
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function OnboardingEmail() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const searchString = useHashSearch();
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
    <div className="min-h-[100dvh] flex flex-col bg-ha-bg" data-testid="screen-onboarding-email">
      <header className="sticky top-0 z-20 bg-ha-card border-b border-ha-card-border">
        <div className="max-w-[480px] mx-auto px-5 h-[56px] flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-10 h-10 rounded-full bg-ha-surface flex items-center justify-center active:scale-95 transition-transform"
            data-testid="button-email-back"
          >
            <ChevronLeft className="w-5 h-5 text-ha-text-muted" />
          </button>
          <div className="flex-1 flex justify-center">
            <HousAlertLogo size={28} />
          </div>
          <div className="w-10" />
        </div>
      </header>

      <div className="max-w-[480px] mx-auto px-5 w-full">
        <ProgressDots current={4} total={7} />
      </div>

      <main className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-5 pt-4 pb-8">
        <h1
          className="text-[24px] font-bold tracking-[-0.02em] text-ha-text mb-2"
          data-testid="text-email-title"
        >
          {t("onboarding.email.title") || "Wie lautet deine E-Mail?"}
        </h1>
        <p className="text-[14px] text-ha-text-secondary mb-6 leading-relaxed">
          {t("onboarding.email.subtitle") || "Hierhin senden wir deine Wohnungsalarme."}
        </p>

        <div>
          <label className="text-[13px] font-medium text-ha-text-secondary mb-1.5 block">
            {t("onboarding.email.label") || "E-Mail-Adresse"}
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-ha-text-muted" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("onboarding.email.placeholder") || "deine@email.de"}
              className={INPUT_CLS}
              autoFocus
              data-testid="input-email"
            />
          </div>
        </div>

        <div className="mt-auto pt-8">
          <button
            onClick={handleNext}
            disabled={!isValidEmail(email)}
            className="w-full h-[52px] rounded-[6px] text-[15px] font-bold text-white transition-all active:scale-[0.97] disabled:opacity-50"
            style={{ backgroundColor: BRAND }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = BRAND_HOVER)}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = BRAND)}
            data-testid="button-email-next"
          >
            {t("common.next") || "Weiter"}
          </button>
        </div>
      </main>
    </div>
  );
}
