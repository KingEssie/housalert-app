import { useState, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api-base";
import { HousAlertLogo } from "@/components/housalert-logo";
import { trackEvent } from "@/lib/track-event";
import { generateOnboardingLetter, type OnboardingLetterData } from "@/lib/application-letter";
import {
  ChevronLeft, ChevronDown, Loader2, Check, ArrowRight,
  Euro, Bell, AlertTriangle, X, CheckCircle2, Send,
  BellRing,
} from "lucide-react";
import elisePhoto from "@assets/A5C2A5AD-87B0-4076-94E3-D2ED9BAC419E_1774778653522.png";

const BRAND = "rgb(var(--ha-primary))";
const TEXT_PRIMARY = "rgb(var(--ha-text))";
const TEXT_SECONDARY = "rgb(var(--ha-text-secondary))";

type FlowStep =
  | "paywall" | "limited-access"
  | "welcome" | "push-test"
  | "letter-personal" | "letter-living"
  | "letter-preview" | "search-buddy" | "success";

const ALL_STEPS: FlowStep[] = [
  "paywall", "limited-access",
  "welcome",
  "letter-personal", "letter-living",
  "letter-preview", "search-buddy", "success",
];

const RESUMABLE_STEPS: FlowStep[] = [
  "welcome",
  "letter-personal", "letter-living",
  "letter-preview", "search-buddy", "success",
];

interface Plan {
  id: string;
  label: string;
  price: string;
  perMonth: string;
  popular: boolean;
  discountLabel?: string;
  discountColor?: string;
}

function getPlans(t: (k: string) => string): Plan[] {
  return [
    {
      id: "three_month",
      label: t("paywall.plans.threeMonth"),
      price: "€44,99",
      perMonth: "€15,00 " + t("paywall.perMonth"),
      popular: false,
      discountLabel: "-40%",
      discountColor: "rgb(var(--ha-success))",
    },
    {
      id: "two_month",
      label: t("paywall.plans.twoMonth"),
      price: "€34,99",
      perMonth: "€17,50 " + t("paywall.perMonth"),
      popular: true,
      discountLabel: "-30%",
      discountColor: "rgb(var(--ha-primary))",
    },
    {
      id: "monthly",
      label: t("paywall.plans.monthly"),
      price: "€24,99",
      perMonth: "€24,99 " + t("paywall.perMonth"),
      popular: false,
      discountLabel: "",
    },
  ];
}

const BENEFIT_KEYS = [
  { titleKey: "paywall.benefits.speed.title", descKey: "paywall.benefits.speed.desc" },
  { titleKey: "paywall.benefits.sources.title", descKey: "paywall.benefits.sources.desc" },
  { titleKey: "paywall.benefits.letter.title", descKey: "paywall.benefits.letter.desc" },
];

function SetupShell({
  children,
  step,
  onBack,
  showBack,
}: {
  children: React.ReactNode;
  step: FlowStep;
  onBack?: () => void;
  showBack?: boolean;
}) {
  return (
    <div className="min-h-[100dvh] flex flex-col" style={{ background: "#ffffff" }} data-testid={`setup-step-${step}`}>
      <header className="sticky top-0 z-20 backdrop-blur-md border-b" style={{ backgroundColor: "#ffffff", borderColor: "#E5E7EB" }}>
        <div className="max-w-[480px] mx-auto px-5 h-[56px] flex items-center gap-3">
          {showBack && onBack ? (
            <button
              onClick={onBack}
              className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-transform"
              style={{ backgroundColor: "#F5F5F5" }}
              data-testid="button-setup-back"
            >
              <ChevronLeft className="w-5 h-5" style={{ color: "#334855" }} />
            </button>
          ) : (
            <div className="w-10" />
          )}
          <div className="flex-1 flex justify-center">
            <HousAlertLogo size={28} />
          </div>
          <div className="w-10" />
        </div>
      </header>
      <main className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-5 pt-5 pb-10" style={{ paddingBottom: "max(40px, env(safe-area-inset-bottom, 40px))" }}>
        {children}
      </main>
    </div>
  );
}

function PrimaryBtn({ onClick, children, loading, disabled, testId }: {
  onClick: () => void; children: React.ReactNode; loading?: boolean; disabled?: boolean; testId: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full h-[56px] rounded-[6px] text-[16px] font-semibold text-white transition-all active:scale-[0.97] disabled:opacity-50"
      style={{ background: "rgb(var(--ha-primary))", boxShadow: "0 4px 15px rgba(217,26,104,0.2)" }}
      data-testid={testId}
    >
      {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : children}
    </button>
  );
}

function SecondaryBtn({ onClick, children, testId }: {
  onClick: () => void; children: React.ReactNode; testId: string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full h-[56px] rounded-[6px] text-[16px] font-semibold transition-all active:scale-[0.97] border-2"
      style={{ borderColor: "rgb(var(--ha-card-border))", color: TEXT_SECONDARY }}
      data-testid={testId}
    >
      {children}
    </button>
  );
}


interface PersonalData {
  phone: string;
  birthDay: string;
  birthMonth: string;
  birthYear: string;
  gender: string;
}

interface LivingData {
  livingWith: string;
  workStatus: string;
  moveReason: string;
  income: string;
  petsCount: string;
}

function PaywallStep({ onSelectPlan, onSkip, t }: {
  onSelectPlan: (plan: string) => void;
  onSkip: () => void;
  t: (k: string, p?: Record<string, any>) => string;
}) {
  const plans = getPlans(t);
  const [selectedPlan, setSelectedPlan] = useState("two_month");
  const [loading, setLoading] = useState(false);

  function handleCheckout() {
    setLoading(true);
    onSelectPlan(selectedPlan);
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <HousAlertLogo size={24} />
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-medium" style={{ color: TEXT_SECONDARY }}>
            4,6 {t("paywall.outOf")} 5 ★
          </span>
        </div>
      </div>

      <h1 className="text-[30px] font-semibold tracking-[-0.025em] leading-[1.15] mb-6" style={{ color: TEXT_PRIMARY }} data-testid="text-paywall-title">
        {t("paywall.headline")}
      </h1>

      <div className="space-y-4 mb-8">
        {BENEFIT_KEYS.map((b, i) => (
          <div key={i} className="flex items-start gap-3" data-testid={`paywall-benefit-${i}`}>
            <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: "rgb(var(--ha-success) / 0.15)" }}>
              <Check className="w-3.5 h-3.5 text-[#111111]" />
            </div>
            <div>
              <p className="text-[16px] font-semibold" style={{ color: TEXT_PRIMARY }}>{t(b.titleKey)}</p>
              <p className="text-[14px] mt-0.5" style={{ color: TEXT_SECONDARY }}>{t(b.descKey)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3 mb-6">
        {plans.map((plan) => {
          const isSelected = selectedPlan === plan.id;
          return (
            <button
              key={plan.id}
              onClick={() => setSelectedPlan(plan.id)}
              className="w-full rounded-[--ha-card-radius] border-2 transition-all text-left relative overflow-hidden"
              style={{
                borderColor: isSelected ? BRAND : "#E5E7EB",
                backgroundColor: isSelected ? "rgba(217,26,104,0.08)" : "#ffffff",
              }}
              data-testid={`card-plan-${plan.id}`}
            >
              {plan.popular && (
                <div className="w-full text-center py-1 text-[11px] font-semibold" style={{ backgroundColor: BRAND, color: "#fff" }} data-testid="badge-popular">
                  {t("paywall.mostChosen")}
                </div>
              )}
              <div className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <div
                    className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors"
                    style={{
                      borderColor: isSelected ? BRAND : "#D1D5DB",
                      backgroundColor: isSelected ? BRAND : "transparent",
                    }}
                  >
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div>
                    <p className="text-[16px] font-semibold" style={{ color: TEXT_PRIMARY }}>{plan.label}</p>
                    <p className="text-[12px]" style={{ color: TEXT_SECONDARY }}>{plan.perMonth}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-[18px] font-semibold" style={{ color: TEXT_PRIMARY }}>{plan.price}</span>
                  {plan.discountLabel && (
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-[4px]"
                      style={{ backgroundColor: plan.discountColor + "20", color: plan.discountColor }}
                    >
                      {plan.discountLabel}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-auto space-y-3">
        <PrimaryBtn onClick={handleCheckout} loading={loading} testId="button-setup-checkout">
          {t("paywall.selectPlan")} →
        </PrimaryBtn>
        <button
          onClick={onSkip}
          className="w-full text-center text-[14px] font-medium py-3 transition-colors"
          style={{ color: TEXT_SECONDARY }}
          data-testid="button-setup-skip-paywall"
        >
          {t("paywall.skipFree")}
        </button>
      </div>
    </>
  );
}

function LimitedAccessStep({ onGoBack, onContinue, t }: {
  onGoBack: () => void;
  onContinue: () => void;
  t: (k: string, p?: Record<string, any>) => string;
}) {
  const blocks = [
    {
      title: t("onboardingFlow.limitedAccess.block1Title"),
      desc: t("onboardingFlow.limitedAccess.block1Desc"),
    },
    {
      title: t("onboardingFlow.limitedAccess.block2Title"),
      desc: t("onboardingFlow.limitedAccess.block2Desc"),
    },
    {
      title: t("onboardingFlow.limitedAccess.block3Title"),
      desc: t("onboardingFlow.limitedAccess.block3Desc"),
    },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <HousAlertLogo size={24} />
        <div className="text-right">
          <p className="text-[13px] font-semibold" style={{ color: "#00b67a" }}>★ 4,6 uit 5</p>
          <p className="text-[11px]" style={{ color: "#334855" }}>Trustpilot</p>
        </div>
      </div>

      <h1 className="text-[30px] font-semibold tracking-[-0.025em] mb-6" style={{ color: "#111111" }} data-testid="text-limited-title">
        {t("onboardingFlow.limitedAccess.title")}
      </h1>

      <div className="space-y-4 flex-1">
        {blocks.map((block, i) => (
          <div key={i} className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-ha-danger/15">
              <X className="w-4 h-4 text-ha-danger" />
            </div>
            <div>
              <p className="text-[16px] font-semibold text-ha-danger mb-0.5">{block.title}</p>
              <p className="text-[14px] leading-relaxed" style={{ color: "#334855" }}>{block.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto space-y-3 pt-6">
        <PrimaryBtn onClick={onGoBack} testId="button-limited-goback">
          {t("onboardingFlow.limitedAccess.goBack")}
        </PrimaryBtn>
        <button
          onClick={onContinue}
          className="w-full h-[56px] rounded-[6px] text-[16px] font-semibold transition-all active:scale-[0.97]"
          style={{
            border: "1.5px solid #E5E7EB",
            backgroundColor: "transparent",
            color: "#334855",
          }}
          data-testid="button-limited-continue"
        >
          {t("onboardingFlow.limitedAccess.continueAnyway")}
        </button>
      </div>

      <div className="mt-4 rounded-[6px] p-4" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E7EB" }}>
        <p className="text-[14px] font-semibold mb-1" style={{ color: "#111111" }}>
          {t("onboardingFlow.limitedAccess.infoTitle")}
        </p>
        <p className="text-[14px] leading-relaxed" style={{ color: "#334855" }}>
          {t("onboardingFlow.limitedAccess.infoDesc")}
        </p>
      </div>
    </>
  );
}

function LightShell({
  children,
  step,
  onBack,
  showBack,
  topContent,
}: {
  children: React.ReactNode;
  step: string;
  onBack?: () => void;
  showBack?: boolean;
  topContent?: React.ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] flex flex-col" style={{ backgroundColor: "#FFFFFF" }} data-testid={`setup-step-${step}`}>
      <header className="sticky top-0 z-20 border-b" style={{ backgroundColor: "#ffffff", borderColor: "#E5E7EB" }}>
        <div className="max-w-[480px] mx-auto px-5 h-[56px] flex items-center gap-3">
          {showBack && onBack ? (
            <button
              onClick={onBack}
              className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-transform"
              style={{ backgroundColor: "#E5E7EB" }}
              data-testid="button-setup-back"
            >
              <ChevronLeft className="w-5 h-5 text-[#334855]" />
            </button>
          ) : (
            <div className="w-10" />
          )}
          <div className="flex-1 flex justify-center">
            <HousAlertLogo size={28} />
          </div>
          <div className="w-10 flex items-center justify-end">
            <span className="text-[11px] font-semibold" style={{ color: "#00b67a" }}>★ 4,6</span>
          </div>
        </div>
      </header>
      {topContent}
      <main className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-5 pt-6 pb-10" style={{ paddingBottom: "max(40px, env(safe-area-inset-bottom, 40px))" }}>
        {children}
      </main>
    </div>
  );
}

function LightPrimaryBtn({ onClick, children, loading, disabled, testId }: {
  onClick: () => void; children: React.ReactNode; loading?: boolean; disabled?: boolean; testId: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full h-[56px] rounded-[6px] text-[16px] font-semibold text-white transition-all active:scale-[0.97] disabled:opacity-50 flex items-center justify-center gap-2"
      style={{ background: "rgb(var(--ha-primary))", boxShadow: "0 4px 15px rgba(217,26,104,0.2)" }}
      data-testid={testId}
    >
      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>{children} <ArrowRight className="w-4 h-4" /></>}
    </button>
  );
}

function WelcomeStep({ onNext, t }: {
  onNext: () => void;
  t: (k: string, p?: Record<string, any>) => string;
}) {
  return (
    <LightShell step="welcome">
      <h1 className="text-[30px] font-semibold tracking-[-0.025em] mb-5 text-[#111111]" data-testid="text-welcome-title">
        {t("onboardingFlow.welcome.title")}
      </h1>

      <div className="rounded-[6px] bg-white p-5 border border-[#E5E7EB]" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
        <div className="relative rounded-[6px] px-5 py-5 mb-5" style={{ backgroundColor: "#FFFFFF" }}>
          <p className="text-[17px] font-semibold text-[#111111] mb-3">Welkom!</p>
          <p className="text-[16px] leading-[1.65] text-[#111111]" style={{ whiteSpace: "pre-line" }}>
            {t("onboardingFlow.welcome.speechBody")}
          </p>
          <div className="absolute -bottom-[8px] left-10 w-4 h-4 rotate-45" style={{ backgroundColor: "#FFFFFF" }} />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <img
            src={elisePhoto}
            alt="Elise — COO HousAlert"
            className="w-24 h-24 rounded-full object-cover flex-shrink-0"
            style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.12)", objectPosition: "50% 35%" }}
            data-testid="img-elise-photo"
          />
          <div>
            <p className="text-[16px] font-semibold text-[#111111]" style={{ fontStyle: "italic" }}>Elise</p>
            <p className="text-[13px] text-[#334855] mt-0.5" style={{ fontStyle: "italic" }}>COO</p>
          </div>
        </div>
      </div>

      <div className="mt-auto pt-8">
        <LightPrimaryBtn onClick={onNext} testId="button-welcome-next">
          {t("onboardingFlow.welcome.cta")}
        </LightPrimaryBtn>
      </div>
    </LightShell>
  );
}

function PushTestStep({ onNext, onEnable, pushState, t }: {
  onNext: () => void;
  onEnable: () => void;
  pushState: "idle" | "requesting" | "granted" | "denied";
  t: (k: string, p?: Record<string, any>) => string;
}) {
  return (
    <LightShell step="push-test" showBack={false}>
      <h1 className="text-[30px] font-semibold tracking-[-0.025em] mb-5 text-[#111111]" data-testid="text-push-title">
        {t("onboardingFlow.pushTest.title")}
      </h1>

      <div className="rounded-[6px] bg-white p-5" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
        {pushState === "granted" && (
          <div className="rounded-[6px] px-4 py-3 mb-5 flex items-start gap-3" style={{ backgroundColor: "rgb(var(--ha-success) / 0.08)", border: "1px solid rgb(var(--ha-success) / 0.25)" }}>
            <CheckCircle2 className="w-5 h-5 text-[#111111] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[14px] font-semibold text-ha-success mb-0.5">{t("onboardingFlow.pushTest.infoTitle")}</p>
              <p className="text-[13px] text-ha-success leading-snug">{t("onboardingFlow.pushTest.infoText")}</p>
            </div>
          </div>
        )}

        {pushState === "denied" && (
          <div className="rounded-[6px] px-4 py-3 mb-5 flex items-start gap-3" style={{ backgroundColor: "#FFFFFF", border: "1px solid #FFFFFF" }}>
            <AlertTriangle className="w-5 h-5 text-[#334855] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[14px] font-medium text-[#111111] mb-1">{t("onboardingFlow.pushTest.denied")}</p>
              <p className="text-[13px] text-[#334855] leading-snug">{t("onboardingFlow.pushTest.deniedHint")}</p>
            </div>
          </div>
        )}

        {pushState !== "granted" && pushState !== "denied" && (
          <div className="rounded-[6px] px-4 py-3 mb-5" style={{ backgroundColor: "#FFFFFF" }}>
            <p className="text-[13px] text-[#334855] leading-snug">
              {t("onboardingFlow.pushTest.idleHint")}
            </p>
          </div>
        )}

        <div className="flex items-center justify-center py-8">
          <div className="relative">
            <div className="w-[240px] h-[140px] rounded-[--ha-card-radius] overflow-hidden" style={{ background: "#FFFFFF", border: "1px solid #E5E7EB" }}>
              <div className="absolute top-3 left-3 flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: BRAND }} />
                <div className="h-2 w-14 rounded-full bg-[#E5E7EB]" />
              </div>
              <div className="absolute top-9 left-3 right-3 space-y-2">
                <div className="h-2 w-full rounded-full bg-[#E5E7EB]" />
                <div className="h-2 w-3/4 rounded-full bg-[#E5E7EB]" />
                <div className="h-2 w-5/6 rounded-full bg-[#E5E7EB]" />
              </div>
            </div>
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-[200px] rounded-[8px] bg-white px-3 py-2.5 flex items-center gap-2.5" style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: pushState === "granted" ? "rgb(var(--ha-success))" : BRAND }}>
                {pushState === "granted" ? (
                  <BellRing className="w-4 h-4 text-white" />
                ) : pushState === "requesting" ? (
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                ) : (
                  <Bell className="w-4 h-4 text-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-[#111111] truncate">HousAlert</p>
                <p className="text-[10px] text-[#334855] truncate">{t("onboardingFlow.pushTest.sampleNotification")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto space-y-3 pt-8">
        {pushState === "idle" ? (
          <>
            <LightPrimaryBtn onClick={onEnable} testId="button-push-enable">
              {t("onboardingFlow.pushTest.enablePush")}
            </LightPrimaryBtn>
            <button
              onClick={onNext}
              className="w-full h-[56px] text-[14px] font-semibold transition-all active:scale-[0.97]"
              style={{ color: "#334855" }}
              data-testid="button-push-skip"
            >
              {t("onboardingFlow.pushTest.cta")}
            </button>
          </>
        ) : (
          <LightPrimaryBtn onClick={onNext} testId="button-push-next">
            {t("onboardingFlow.pushTest.cta")}
          </LightPrimaryBtn>
        )}
      </div>
    </LightShell>
  );
}

function LetterPersonalStep({ personalData, onChange, onNext, onSkip, t }: {
  personalData: PersonalData;
  onChange: (d: Partial<PersonalData>) => void;
  onNext: () => void;
  onSkip: () => void;
  t: (k: string, p?: Record<string, any>) => string;
}) {
  const INPUT_CLS = "w-full h-[56px] px-4 rounded-[16px] border border-[#E5E7EB] bg-white text-[16px] text-[#111111] placeholder:text-[#334855] placeholder:opacity-55 focus:outline-none focus:ring-1 focus:ring-ha-primary/25 focus:border-ha-primary transition-all";
  const [showForm, setShowForm] = useState(false);

  const genderOptions = [
    { value: "male", label: t("onboardingFlow.letterPersonal.genderOptions.male") },
    { value: "female", label: t("onboardingFlow.letterPersonal.genderOptions.female") },
    { value: "other", label: t("onboardingFlow.letterPersonal.genderOptions.other") },
    { value: "prefer_not", label: t("onboardingFlow.letterPersonal.genderOptions.prefer_not") },
  ];

  if (!showForm) {
    return (
      <LightShell step="letter-personal" showBack>
        <h1 className="text-[30px] font-semibold tracking-[-0.025em] mb-5 text-[#111111]" data-testid="text-letter-personal-title">
          {t("onboardingFlow.letterPersonal.title")}
        </h1>

        <div className="rounded-[6px] bg-white p-5 border border-[#E5E7EB]" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div className="relative rounded-[6px] px-5 py-5 mb-5" style={{ backgroundColor: "#FFFFFF" }}>
            <p className="text-[17px] font-semibold text-[#111111] mb-3">
              {t("onboardingFlow.letterPersonal.speechTitle")}
            </p>
            <p className="text-[16px] leading-[1.65] text-[#111111]" style={{ whiteSpace: "pre-line" }}>
              {t("onboardingFlow.letterPersonal.speechBody")}
            </p>
            <div className="absolute -bottom-[8px] left-10 w-4 h-4 rotate-45" style={{ backgroundColor: "#FFFFFF" }} />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <img
              src={elisePhoto}
              alt="Elise — COO HousAlert"
              className="w-24 h-24 rounded-full object-cover flex-shrink-0"
              style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.12)", objectPosition: "50% 35%" }}
            />
            <div>
              <p className="text-[16px] font-semibold text-[#111111]" style={{ fontStyle: "italic" }}>Elise</p>
              <p className="text-[13px] text-[#334855] mt-0.5" style={{ fontStyle: "italic" }}>COO</p>
            </div>
          </div>
        </div>

        <div className="mt-auto space-y-3 pt-8">
          <LightPrimaryBtn onClick={() => setShowForm(true)} testId="button-letter-intro-next">
            {t("onboardingFlow.welcome.cta")}
          </LightPrimaryBtn>
          <button
            onClick={onSkip}
            className="w-full h-[56px] text-[14px] font-semibold transition-all active:scale-[0.97]"
            style={{ color: "#334855" }}
            data-testid="button-personal-skip"
          >
            {t("onboardingFlow.letterPersonal.skip")}
          </button>
        </div>
      </LightShell>
    );
  }

  return (
    <LightShell step="letter-personal-form" showBack onBack={() => setShowForm(false)}>
      <h1 className="text-[30px] font-semibold tracking-[-0.025em] mb-6 text-[#111111]">
        {t("onboardingFlow.letterPersonal.formTitle")}
      </h1>

      <div className="rounded-[6px] bg-white p-5 space-y-5 border border-[#E5E7EB]" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
        <div>
          <label className="text-[14px] font-semibold text-[#111111] mb-2 block">
            {t("onboardingFlow.letterPersonal.phone")}
          </label>
          <input
            type="tel"
            inputMode="tel"
            value={personalData.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
            placeholder={t("onboardingFlow.letterPersonal.phonePlaceholder")}
            className={INPUT_CLS}
            data-testid="input-phone"
          />
        </div>

        <div>
          <label className="text-[14px] font-semibold text-[#111111] mb-2 block">
            {t("onboardingFlow.letterPersonal.birthDate")}
          </label>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder={t("onboardingFlow.letterPersonal.day")}
              value={personalData.birthDay}
              onChange={(e) => onChange({ birthDay: e.target.value.replace(/\D/g, "").slice(0, 2) })}
              className={INPUT_CLS + " text-center"}
              data-testid="input-birth-day"
            />
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder={t("onboardingFlow.letterPersonal.month")}
              value={personalData.birthMonth}
              onChange={(e) => onChange({ birthMonth: e.target.value.replace(/\D/g, "").slice(0, 2) })}
              className={INPUT_CLS + " text-center"}
              data-testid="input-birth-month"
            />
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder={t("onboardingFlow.letterPersonal.year")}
              value={personalData.birthYear}
              onChange={(e) => onChange({ birthYear: e.target.value.replace(/\D/g, "").slice(0, 4) })}
              className={INPUT_CLS + " text-center"}
              data-testid="input-birth-year"
            />
          </div>
        </div>

        <div>
          <label className="text-[14px] font-semibold text-[#111111] mb-2 block">
            {t("onboardingFlow.letterPersonal.gender")}
          </label>
          <div className="relative" data-testid="select-gender">
            <select
              value={personalData.gender}
              onChange={(e) => onChange({ gender: e.target.value })}
              className={`w-full h-[56px] px-4 pr-10 rounded-[16px] border border-[#E5E7EB] bg-white text-[16px] text-[#111111] appearance-none focus:outline-none focus:ring-1 focus:ring-ha-primary/25 focus:border-ha-primary transition-all ${!personalData.gender ? "text-[#334855] opacity-55" : ""}`}
              data-testid="input-gender"
            >
              <option value="">{t("onboardingFlow.letterPersonal.genderPlaceholder") || "Selecteer geslacht"}</option>
              {genderOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#111111] pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="mt-auto pt-8">
        <LightPrimaryBtn onClick={onNext} testId="button-personal-next">
          {t("onboardingFlow.letterPersonal.cta")}
        </LightPrimaryBtn>
      </div>
    </LightShell>
  );
}

function LetterLivingStep({ livingData, onChange, onNext, onBack, t }: {
  livingData: LivingData;
  onChange: (d: Partial<LivingData>) => void;
  onNext: () => void;
  onBack: () => void;
  t: (k: string, p?: Record<string, any>) => string;
}) {
  const livingOptions = [
    { value: "alone", label: t("onboardingFlow.letterLiving.livingOptions.alone") },
    { value: "partner", label: t("onboardingFlow.letterLiving.livingOptions.partner") },
    { value: "partner_kids", label: t("onboardingFlow.letterLiving.livingOptions.partner_kids") },
    { value: "kids", label: t("onboardingFlow.letterLiving.livingOptions.kids") },
    { value: "roommates", label: t("onboardingFlow.letterLiving.livingOptions.roommates") },
    { value: "family", label: t("onboardingFlow.letterLiving.livingOptions.family") },
    { value: "other", label: t("onboardingFlow.letterLiving.livingOptions.other") },
  ];
  const workOptions = [
    { value: "employed", label: t("onboardingFlow.letterLiving.workOptions.employed") },
    { value: "self_employed", label: t("onboardingFlow.letterLiving.workOptions.self_employed") },
    { value: "student", label: t("onboardingFlow.letterLiving.workOptions.student") },
    { value: "expat", label: t("onboardingFlow.letterLiving.workOptions.expat") },
    { value: "benefits", label: t("onboardingFlow.letterLiving.workOptions.benefits") },
    { value: "other", label: t("onboardingFlow.letterLiving.workOptions.other") },
  ];
  const moveOptions = [
    { value: "work_study", label: t("onboardingFlow.letterLiving.moveOptions.work_study") },
    { value: "first_together", label: t("onboardingFlow.letterLiving.moveOptions.first_together") },
    { value: "family_growth", label: t("onboardingFlow.letterLiving.moveOptions.family_growth") },
    { value: "breakup", label: t("onboardingFlow.letterLiving.moveOptions.breakup") },
    { value: "first_own", label: t("onboardingFlow.letterLiving.moveOptions.first_own") },
    { value: "bigger", label: t("onboardingFlow.letterLiving.moveOptions.bigger") },
    { value: "cheaper", label: t("onboardingFlow.letterLiving.moveOptions.cheaper") },
    { value: "new_area", label: t("onboardingFlow.letterLiving.moveOptions.new_area") },
    { value: "other", label: t("onboardingFlow.letterLiving.moveOptions.other") },
  ];

  const INPUT_CLS = "w-full h-[56px] px-4 rounded-[16px] border border-[#E5E7EB] bg-white text-[16px] text-[#111111] placeholder:text-[#334855] placeholder:opacity-55 focus:outline-none focus:ring-1 focus:ring-ha-primary/25 focus:border-ha-primary transition-all";

  return (
    <LightShell step="letter-living" showBack onBack={onBack}>
      <h1 className="text-[30px] font-semibold tracking-[-0.025em] mb-6 text-[#111111]" data-testid="text-letter-living-title">
        {t("onboardingFlow.letterLiving.title")}
      </h1>

      <div className="rounded-[6px] bg-white p-5 space-y-5 border border-[#E5E7EB]" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
        <div>
          <label className="text-[14px] font-semibold text-[#111111] mb-2 block">
            {t("onboardingFlow.letterLiving.livingWith")}
          </label>
          <div className="relative">
            <select
              value={livingData.livingWith}
              onChange={(e) => onChange({ livingWith: e.target.value })}
              className={`w-full h-[56px] px-4 pr-10 rounded-[16px] border border-[#E5E7EB] bg-white text-[16px] text-[#111111] appearance-none focus:outline-none focus:ring-1 focus:ring-ha-primary/25 focus:border-ha-primary transition-all ${!livingData.livingWith ? "text-[#334855] opacity-55" : ""}`}
              data-testid="select-living-with"
            >
              <option value="">{t("onboardingFlow.letterLiving.selectPlaceholder") || "Selecteer..."}</option>
              {livingOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#111111] pointer-events-none" />
          </div>
        </div>

        <div>
          <label className="text-[14px] font-semibold text-[#111111] mb-2 block">
            {t("onboardingFlow.letterLiving.workStatus")}
          </label>
          <div className="relative">
            <select
              value={livingData.workStatus}
              onChange={(e) => onChange({ workStatus: e.target.value })}
              className={`w-full h-[56px] px-4 pr-10 rounded-[16px] border border-[#E5E7EB] bg-white text-[16px] text-[#111111] appearance-none focus:outline-none focus:ring-1 focus:ring-ha-primary/25 focus:border-ha-primary transition-all ${!livingData.workStatus ? "text-[#334855] opacity-55" : ""}`}
              data-testid="select-work-status"
            >
              <option value="">{t("onboardingFlow.letterLiving.selectPlaceholder") || "Selecteer..."}</option>
              {workOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#111111] pointer-events-none" />
          </div>
        </div>

        <div>
          <label className="text-[14px] font-semibold text-[#111111] mb-2 block">
            {t("onboardingFlow.letterLiving.moveReason")}
          </label>
          <div className="relative">
            <select
              value={livingData.moveReason}
              onChange={(e) => onChange({ moveReason: e.target.value })}
              className={`w-full h-[56px] px-4 pr-10 rounded-[16px] border border-[#E5E7EB] bg-white text-[16px] text-[#111111] appearance-none focus:outline-none focus:ring-1 focus:ring-ha-primary/25 focus:border-ha-primary transition-all ${!livingData.moveReason ? "text-[#334855] opacity-55" : ""}`}
              data-testid="select-move-reason"
            >
              <option value="">{t("onboardingFlow.letterLiving.selectPlaceholder") || "Selecteer..."}</option>
              {moveOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#111111] pointer-events-none" />
          </div>
        </div>

        <div>
          <label className="text-[14px] font-semibold text-[#111111] mb-2 block">
            {t("onboardingFlow.letterLiving.income")}
          </label>
          <div className="relative">
            <Euro className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#334855]" />
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={livingData.income}
              onChange={(e) => onChange({ income: e.target.value.replace(/\D/g, "") })}
              placeholder={t("onboardingFlow.letterLiving.incomePlaceholder")}
              className={INPUT_CLS + " pl-10"}
              data-testid="input-income"
            />
          </div>
        </div>

        <div>
          <label className="text-[14px] font-semibold text-[#111111] mb-2 block">
            {t("onboardingFlow.letterLiving.pets")}
          </label>
          <div className="flex gap-2" data-testid="input-pets">
            {["0", "1", "2", "3", "4", "5+"].map((v) => {
              const active = livingData.petsCount === v;
              return (
                <button
                  key={v}
                  onClick={() => onChange({ petsCount: v })}
                  className="h-[40px] w-[48px] rounded-full text-[13px] font-semibold transition-all active:scale-[0.96]"
                  style={{
                    backgroundColor: active ? "rgb(var(--ha-primary))" : "#F3F4F6",
                    color: active ? "#fff" : "#334855",
                  }}
                  data-testid={`pets-${v}`}
                >
                  {v}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-auto pt-8">
        <LightPrimaryBtn onClick={onNext} testId="button-living-next">
          {t("onboardingFlow.letterLiving.cta")}
        </LightPrimaryBtn>
      </div>
    </LightShell>
  );
}

function LetterPreviewStep({ letterText, onLetterChange, onNext, onBack, t }: {
  letterText: string;
  onLetterChange: (text: string) => void;
  onNext: () => void;
  onBack: () => void;
  t: (k: string, p?: Record<string, any>) => string;
}) {
  return (
    <LightShell step="letter-preview" showBack onBack={onBack}>
      <h1 className="text-[30px] font-semibold tracking-[-0.025em] mb-5 text-[#111111]" data-testid="text-letter-preview-title">
        {t("onboardingFlow.letterPreview.title")}
      </h1>

      <div className="rounded-[6px] px-4 py-3 mb-5 flex items-start gap-2.5" style={{ backgroundColor: "#FFFFFF", border: "1px solid #FFFFFF" }}>
        <span className="text-[16px] mt-0.5">💡</span>
        <p className="text-[14px] leading-snug text-[#111111]">
          {t("onboardingFlow.letterPreview.addressNote")}
        </p>
      </div>

      <div className="rounded-[6px] bg-white p-5 flex-1 flex flex-col border border-[#E5E7EB]" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
        <textarea
          value={letterText}
          onChange={(e) => onLetterChange(e.target.value)}
          className="w-full flex-1 min-h-[280px] p-0 bg-transparent text-[17px] leading-[1.75] text-[#111111] placeholder:text-[#334855] focus:outline-none resize-none"
          data-testid="textarea-letter"
        />
      </div>

      <div className="mt-auto pt-6">
        <LightPrimaryBtn onClick={onNext} testId="button-letter-next">
          {t("onboardingFlow.letterPreview.cta")}
        </LightPrimaryBtn>
      </div>
    </LightShell>
  );
}

function SearchBuddyStep({ buddyEmail, onBuddyEmailChange, onInvite, onSkip, invited, loading, t }: {
  buddyEmail: string;
  onBuddyEmailChange: (e: string) => void;
  onInvite: () => void;
  onSkip: () => void;
  invited: boolean;
  loading: boolean;
  t: (k: string, p?: Record<string, any>) => string;
}) {
  return (
    <LightShell step="search-buddy">
      <h1 className="text-[30px] font-semibold tracking-[-0.025em] mb-5 text-[#111111]" data-testid="text-buddy-title">
        {t("onboardingFlow.searchBuddy.title")}
      </h1>

      <div className="rounded-[6px] bg-white p-5 border border-[#E5E7EB]" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
        <p className="text-[17px] font-semibold text-[#111111] mb-1">{t("onboardingFlow.searchBuddy.subtitle")}</p>
        <p className="text-[14px] font-semibold text-[#111111] mb-4">{t("onboardingFlow.searchBuddy.allowed")}</p>
        <div className="space-y-4 mb-6">
          {[
            t("onboardingFlow.searchBuddy.canAlerts"),
            t("onboardingFlow.searchBuddy.canFavorite"),
            t("onboardingFlow.searchBuddy.canApply"),
          ].map((text, i) => (
            <div key={i} className="flex items-center gap-3">
              <CheckCircle2 className="w-[22px] h-[22px] flex-shrink-0" style={{ color: "rgb(var(--ha-success))" }} />
              <span className="text-[16px] text-[#111111] leading-snug">{text}</span>
            </div>
          ))}
        </div>
        <div className="space-y-4">
          {[
            t("onboardingFlow.searchBuddy.cannotProfiles"),
            t("onboardingFlow.searchBuddy.cannotLetter"),
          ].map((text, i) => (
            <div key={i} className="flex items-center gap-3">
              <X className="w-[22px] h-[22px] text-ha-danger flex-shrink-0" />
              <span className="text-[16px] text-[#111111] leading-snug">{text}</span>
            </div>
          ))}
        </div>
      </div>

      {invited && (
        <div className="rounded-[6px] px-4 py-3.5 mt-4 flex items-center gap-2.5" style={{ backgroundColor: "rgb(var(--ha-success) / 0.08)", border: "1px solid rgb(var(--ha-success) / 0.25)" }}>
          <CheckCircle2 className="w-5 h-5 text-[#111111] flex-shrink-0" />
          <span className="text-[14px] font-medium text-[#111111]">{t("onboardingFlow.searchBuddy.invited")}</span>
        </div>
      )}

      {!invited && (
        <div className="mt-5">
          <input
            type="email"
            inputMode="email"
            value={buddyEmail}
            onChange={(e) => onBuddyEmailChange(e.target.value)}
            placeholder={t("onboardingFlow.searchBuddy.emailPlaceholder")}
            className="w-full h-[56px] px-4 rounded-[16px] border border-[#E5E7EB] bg-white text-[16px] text-[#111111] placeholder:text-[#334855] placeholder:opacity-55 focus:outline-none focus:ring-1 focus:ring-ha-primary/25 focus:border-ha-primary transition-all"
            data-testid="input-buddy-email"
          />
        </div>
      )}

      <div className="mt-auto pt-6 space-y-3">
        {!invited && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(window.location.origin + "/invite");
                }
              }}
              className="flex-1 h-[56px] rounded-[6px] text-[14px] font-semibold transition-all active:scale-[0.97] flex items-center justify-center gap-2 border-2"
              style={{ borderColor: BRAND, color: BRAND }}
              data-testid="button-buddy-copy"
            >
              {t("onboardingFlow.searchBuddy.copyLink")} 📋
            </button>
            <button
              onClick={onInvite}
              disabled={!buddyEmail.includes("@") || loading}
              className="flex-1 h-[56px] rounded-[6px] text-[14px] font-semibold text-white transition-all active:scale-[0.97] disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: "rgb(var(--ha-primary))" }}
              data-testid="button-buddy-invite"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{t("onboardingFlow.searchBuddy.invite")} <Send className="w-4 h-4" /></>}
            </button>
          </div>
        )}
        <button
          onClick={onSkip}
          className="w-full h-[56px] text-[14px] font-semibold transition-all active:scale-[0.97]"
          style={{ color: BRAND }}
          data-testid="button-buddy-skip"
        >
          {t("onboardingFlow.searchBuddy.maybeLater")}
        </button>
      </div>
    </LightShell>
  );
}

function SuccessStep({ onFinish, t }: {
  onFinish: () => void;
  t: (k: string, p?: Record<string, any>) => string;
}) {
  return (
    <LightShell step="success">
      <h1 className="text-[30px] font-semibold tracking-[-0.025em] mb-5 text-[#111111]" data-testid="text-success-title">
        {t("onboardingFlow.success.title")}
      </h1>

      <div className="rounded-[6px] bg-white p-5 border border-[#E5E7EB]" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
        <div className="relative rounded-[6px] px-5 py-5 mb-5" style={{ backgroundColor: "#FFFFFF" }}>
          <p className="text-[16px] font-semibold text-[#111111] mb-3">
            {t("onboardingFlow.success.speechTitle")}
          </p>
          <p className="text-[14px] leading-[1.65] text-[#111111]" style={{ whiteSpace: "pre-line" }}>
            {t("onboardingFlow.success.speechBody")}
          </p>
          <div className="absolute -bottom-[8px] left-10 w-4 h-4 rotate-45" style={{ backgroundColor: "#FFFFFF" }} />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <img
            src={elisePhoto}
            alt="Elise — COO HousAlert"
            className="w-24 h-24 rounded-full object-cover flex-shrink-0"
            style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.12)", objectPosition: "50% 35%" }}
          />
          <div>
            <p className="text-[16px] font-semibold text-[#111111]" style={{ fontStyle: "italic" }}>Elise</p>
            <p className="text-[13px] text-[#334855] mt-0.5" style={{ fontStyle: "italic" }}>COO</p>
          </div>
        </div>
      </div>

      <div className="mt-auto pt-8">
        <LightPrimaryBtn onClick={onFinish} testId="button-success-finish">
          {t("onboardingFlow.success.cta")}
        </LightPrimaryBtn>
      </div>
    </LightShell>
  );
}

export default function OnboardingSetup() {
  const [, navigate] = useLocation();
  const { user, session } = useAuth();
  const { t, locale } = useTranslation();
  const { toast } = useToast();

  const [step, setStep] = useState<FlowStep>("paywall");
  const [profileLoaded, setProfileLoaded] = useState(false);

  const [personalData, setPersonalData] = useState<PersonalData>({
    phone: "", birthDay: "", birthMonth: "", birthYear: "", gender: "",
  });
  const [livingData, setLivingData] = useState<LivingData>({
    livingWith: "", workStatus: "", moveReason: "", income: "", petsCount: "0",
  });
  const [letterText, setLetterText] = useState("");
  const [buddyEmail, setBuddyEmail] = useState("");
  const [buddyInvited, setBuddyInvited] = useState(false);
  const [buddyLoading, setBuddyLoading] = useState(false);
  const [pushState, setPushState] = useState<"idle" | "requesting" | "granted" | "denied">("idle");

  useEffect(() => {
    if (!session?.access_token) {
      setProfileLoaded(true);
      return;
    }
    (async () => {
      try {
        const res = await apiFetch("/api/profile-data", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const d = await res.json();

          if (d.phone) setPersonalData((p) => ({ ...p, phone: d.phone }));
          if (d.birth_date) {
            const [y, m, day] = d.birth_date.split("-");
            setPersonalData((p) => ({ ...p, birthYear: y, birthMonth: String(parseInt(m)), birthDay: String(parseInt(day)) }));
          }
          if (d.gender) setPersonalData((p) => ({ ...p, gender: d.gender }));
          if (d.living_with) setLivingData((l) => ({ ...l, livingWith: d.living_with }));
          if (d.work_status) setLivingData((l) => ({ ...l, workStatus: d.work_status }));
          if (d.move_reason) setLivingData((l) => ({ ...l, moveReason: d.move_reason }));
          if (d.monthly_income) setLivingData((l) => ({ ...l, income: String(d.monthly_income) }));
          if (d.pets_count != null) setLivingData((l) => ({ ...l, petsCount: String(d.pets_count) }));
          if (d.application_template) setLetterText(d.application_template);
          if (d.search_buddy_email) {
            setBuddyEmail(d.search_buddy_email);
            setBuddyInvited(true);
          }
          if (d.push_test_completed === true) setPushState("granted");
          else if (d.push_test_completed === false) setPushState("denied");

          if (d.post_paywall_onboarding_completed) {
            navigate("/home");
            return;
          }

          const paywallDone = d.paywall_completed === true;

          let savedStep = d.onboarding_current_step;
          if (savedStep === "push-test") savedStep = "letter-personal";
          if (savedStep && RESUMABLE_STEPS.includes(savedStep as FlowStep)) {
            setStep(savedStep as FlowStep);
          } else if (paywallDone) {
            setStep("welcome");
          } else {
            setStep("paywall");
          }
        }
      } catch (err) {
        console.error("[SETUP] Failed to load profile data", err);
      } finally {
        setProfileLoaded(true);
      }
    })();
  }, [session?.access_token]);

  const updatePersonalData = useCallback((partial: Partial<PersonalData>) => {
    setPersonalData((prev) => ({ ...prev, ...partial }));
  }, []);

  const updateLivingData = useCallback((partial: Partial<LivingData>) => {
    setLivingData((prev) => ({ ...prev, ...partial }));
  }, []);

  function goStep(s: FlowStep) {
    setStep(s);
    window.scrollTo(0, 0);
    if (s !== "paywall" && s !== "limited-access") {
      saveProfileField({ onboarding_current_step: s });
    }
  }

  function handleBack() {
    const currentIdx = ALL_STEPS.indexOf(step);
    if (step === "limited-access") {
      setStep("paywall");
      return;
    }
    for (let i = currentIdx - 1; i >= 0; i--) {
      const prev = ALL_STEPS[i];
      if (prev === "limited-access") continue;
      if (prev === "paywall") continue;
      goStep(prev);
      return;
    }
  }

  async function saveProfileField(fields: Record<string, any>) {
    if (!session?.access_token) return;
    try {
      await apiFetch("/api/profile-data", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(fields),
      });
    } catch (err) {
      console.error("[SETUP] Failed to save profile fields", err);
    }
  }

  async function handleSelectPlan(plan: string) {
    trackEvent("setup_plan_selected", { plan });

    try {
      const s = await supabase.auth.getSession();
      const token = s.data.session?.access_token;
      if (!token) {
        navigate("/");
        return;
      }

      const res = await apiFetch("/api/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Checkout failed");
      }
      const result = await res.json();

      if (result.url) {
        if (typeof (window as any).ReactNativeWebView?.postMessage === "function") {
          (window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: "openExternal", url: result.url }));
        } else {
          window.location.href = result.url;
        }
      }
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    }
  }

  function handleSkipPaywall() {
    trackEvent("setup_paywall_skipped");
    saveProfileField({ paywall_completed: true, onboarding_current_step: "limited-access" });
    setStep("limited-access");
    window.scrollTo(0, 0);
  }

  function handleLimitedGoBack() {
    setStep("paywall");
    window.scrollTo(0, 0);
  }

  function handleLimitedContinue() {
    trackEvent("setup_limited_continue");
    goStep("welcome");
  }

  async function handleLetterPersonalNext() {
    trackEvent("setup_personal_done");
    const birthDate = personalData.birthYear && personalData.birthMonth && personalData.birthDay
      ? `${personalData.birthYear}-${personalData.birthMonth.padStart(2, "0")}-${personalData.birthDay.padStart(2, "0")}`
      : undefined;

    const fields: Record<string, any> = {};
    if (personalData.phone) fields.phone = personalData.phone;
    if (birthDate) fields.birth_date = birthDate;
    if (personalData.gender) fields.gender = personalData.gender;
    if (Object.keys(fields).length > 0) await saveProfileField(fields);

    goStep("letter-living");
  }

  async function handleLetterLivingNext() {
    trackEvent("setup_living_done");
    const fields: Record<string, any> = {};
    if (livingData.livingWith) fields.living_with = livingData.livingWith;
    if (livingData.workStatus) fields.work_status = livingData.workStatus;
    if (livingData.moveReason) fields.move_reason = livingData.moveReason;
    if (livingData.income) fields.monthly_income = parseInt(livingData.income) || undefined;
    if (livingData.petsCount) fields.pets_count = parseInt(livingData.petsCount) || 0;
    if (Object.keys(fields).length > 0) await saveProfileField(fields);

    const letterData: OnboardingLetterData = {
      firstName: user?.user_metadata?.first_name || user?.user_metadata?.full_name?.split(" ")[0],
      lastName: user?.user_metadata?.last_name || user?.user_metadata?.full_name?.split(" ").slice(1).join(" "),
      phone: personalData.phone || undefined,
      email: user?.email,
      gender: personalData.gender || undefined,
      livingWith: livingData.livingWith || undefined,
      workStatus: livingData.workStatus || undefined,
      moveReason: livingData.moveReason || undefined,
      grossIncome: parseInt(livingData.income) || undefined,
      petsCount: parseInt(livingData.petsCount) || 0,
    };
    const generated = generateOnboardingLetter(letterData, locale as any);
    setLetterText(generated);

    goStep("letter-preview");
  }

  async function handleLetterPreviewNext() {
    trackEvent("setup_letter_done");
    await saveProfileField({ application_template: letterText });
    goStep("search-buddy");
  }

  async function handleBuddyInvite() {
    if (!buddyEmail.includes("@")) return;
    setBuddyLoading(true);
    try {
      await saveProfileField({
        search_buddy_email: buddyEmail,
        search_buddy_enabled: true,
      });
      trackEvent("setup_buddy_invited", { email: buddyEmail });
      setBuddyInvited(true);
    } catch (err) {
      console.error("[SETUP] buddy invite failed", err);
    } finally {
      setBuddyLoading(false);
    }
  }

  function handleBuddySkip() {
    trackEvent("setup_buddy_skipped");
    goStep("success");
  }

  async function handlePushEnable() {
    setPushState("requesting");
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        const vapidRes = await apiFetch("/api/push/vapid-key");
        if (!vapidRes.ok) throw new Error("No VAPID key");
        const { publicKey } = await vapidRes.json();

        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: publicKey,
        });

        const subJson = sub.toJSON();
        const token = session?.access_token;
        if (token && subJson.keys) {
          await apiFetch("/api/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              endpoint: subJson.endpoint,
              p256dh: subJson.keys.p256dh,
              auth: subJson.keys.auth,
            }),
          });
        }

        if (token) {
          apiFetch("/api/push/test-self", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => {});
        }

        await saveProfileField({ push_test_completed: true });
        setPushState("granted");
        trackEvent("setup_push_granted");
      } else {
        setPushState("denied");
        await saveProfileField({ push_test_completed: false });
        trackEvent("setup_push_denied");
      }
    } catch (err) {
      console.error("[SETUP] push setup failed", err);
      setPushState("denied");
      saveProfileField({ push_test_completed: false });
    }
  }

  async function handleSuccessFinish() {
    trackEvent("setup_complete");
    await saveProfileField({
      onboarding_completed: true,
      post_paywall_onboarding_completed: true,
      onboarding_current_step: "done",
    });
    navigate("/home");
  }

  useEffect(() => {
    trackEvent("setup_step", { step });
  }, [step]);

  if (!profileLoaded) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center" style={{ background: "#ffffff" }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: BRAND }} />
      </div>
    );
  }

  const showBack = step !== "paywall" && step !== "welcome" && step !== "success" && step !== "limited-access";

  if (step === "welcome") {
    return <WelcomeStep onNext={() => goStep("letter-personal")} t={t} />;
  }
  if (step === "push-test") return null;
  if (step === "letter-personal") {
    return (
      <LetterPersonalStep
        personalData={personalData}
        onChange={updatePersonalData}
        onNext={handleLetterPersonalNext}
        onSkip={() => goStep("letter-living")}
        t={t}
      />
    );
  }
  if (step === "letter-living") {
    return (
      <LetterLivingStep
        livingData={livingData}
        onChange={updateLivingData}
        onNext={handleLetterLivingNext}
        onBack={() => goStep("letter-personal")}
        t={t}
      />
    );
  }
  if (step === "letter-preview") {
    return (
      <LetterPreviewStep
        letterText={letterText}
        onLetterChange={setLetterText}
        onNext={handleLetterPreviewNext}
        onBack={() => goStep("letter-living")}
        t={t}
      />
    );
  }

  if (step === "search-buddy") {
    return (
      <SearchBuddyStep
        buddyEmail={buddyEmail}
        onBuddyEmailChange={setBuddyEmail}
        onInvite={handleBuddyInvite}
        onSkip={handleBuddySkip}
        invited={buddyInvited}
        loading={buddyLoading}
        t={t}
      />
    );
  }
  if (step === "success") {
    return <SuccessStep onFinish={handleSuccessFinish} t={t} />;
  }

  return (
    <SetupShell step={step} onBack={handleBack} showBack={showBack}>
      {step === "paywall" && (
        <PaywallStep onSelectPlan={handleSelectPlan} onSkip={handleSkipPaywall} t={t} />
      )}
      {step === "limited-access" && (
        <LimitedAccessStep onGoBack={handleLimitedGoBack} onContinue={handleLimitedContinue} t={t} />
      )}
    </SetupShell>
  );
}
