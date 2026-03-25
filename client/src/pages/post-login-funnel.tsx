import { apiFetch } from "@/lib/api-base";
import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { getDefaultTemplate } from "@/lib/application-letter";
import { HousAlertLogo } from "@/components/housalert-logo";
import { trackEvent } from "@/lib/track-event";
import {
  Check, Bell, User, Home, MessageSquare, Users, Sparkles, ChevronRight,
  Shield, Star, Clock, Zap, Eye, EyeOff, Loader2, CheckCircle2, ArrowRight,
} from "lucide-react";

const BRAND = "rgb(var(--ha-primary))";
const BRAND_HOVER = "rgb(var(--ha-primary-hover))";
const TEXT_PRIMARY = "rgb(var(--ha-text))";
const TEXT_SECONDARY = "rgb(var(--ha-text-secondary))";
const BG_LIGHT = "rgb(var(--ha-surface))";
const BORDER = "rgb(var(--ha-card-border))";

type Step = "paywall" | "objection" | "push" | "personalInfo" | "housing" | "extras" | "letter" | "buddy" | "success";

const STEP_ORDER: Step[] = ["paywall", "objection", "push", "personalInfo", "housing", "extras", "letter", "buddy", "success"];

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-1.5 w-full max-w-[200px] mx-auto" data-testid="funnel-progress">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="h-1 flex-1 rounded-full transition-all duration-300"
          style={{ backgroundColor: i < current ? BRAND : "rgb(var(--ha-card-border))" }}
        />
      ))}
    </div>
  );
}

function StepShell({
  children,
  step,
  stepIndex,
}: {
  children: React.ReactNode;
  step: Step;
  stepIndex: number;
}) {
  return (
    <div
      className="min-h-[100dvh] flex flex-col bg-ha-card"
      data-testid={`funnel-step-${step}`}
    >
      <div className="pt-4 pb-2 px-6">
        <div className="flex items-center justify-center mb-4">
          <HousAlertLogo size={28} />
        </div>
        <ProgressBar current={stepIndex + 1} total={STEP_ORDER.length} />
      </div>
      <div className="flex-1 flex flex-col px-6 pb-8">
        {children}
      </div>
    </div>
  );
}

function PrimaryButton({
  onClick,
  children,
  loading,
  disabled,
  testId,
}: {
  onClick: () => void;
  children: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  testId: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full h-[52px] rounded-[6px] text-[15px] font-bold text-white transition-all active:scale-[0.97] disabled:opacity-50 shadow-[0_4px_16px_rgba(249,115,22,0.3)]"
      style={{ backgroundColor: BRAND }}
      onMouseOver={(e) => (e.currentTarget.style.backgroundColor = BRAND_HOVER)}
      onMouseOut={(e) => (e.currentTarget.style.backgroundColor = BRAND)}
      data-testid={testId}
    >
      {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : children}
    </button>
  );
}

function SecondaryButton({
  onClick,
  children,
  testId,
}: {
  onClick: () => void;
  children: React.ReactNode;
  testId: string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full h-[44px] text-[14px] font-medium transition-all active:scale-[0.97]"
      style={{ color: TEXT_SECONDARY }}
      data-testid={testId}
    >
      {children}
    </button>
  );
}

function PaywallStep({ onNext, onSkip, t }: { onNext: (plan: string) => void; onSkip: () => void; t: (k: string) => string }) {
  const [selected, setSelected] = useState("two_month");

  const plans = [
    { id: "monthly", nameKey: "funnel.paywall.monthly", price: "€14,99", perMonth: "€14,99", popular: false, savings: null },
    { id: "two_month", nameKey: "funnel.paywall.twoMonth", price: "€24,99", perMonth: "€12,50", popular: true, savings: "funnel.paywall.save17" },
    { id: "three_month", nameKey: "funnel.paywall.threeMonth", price: "€29,99", perMonth: "€10,00", popular: false, savings: "funnel.paywall.save33" },
  ];

  return (
    <>
      <div className="pt-6 pb-4">
        <h1 className="text-[26px] font-bold tracking-[-0.02em] text-center" style={{ color: TEXT_PRIMARY }} data-testid="text-paywall-title">
          {t("funnel.paywall.title")}
        </h1>
        <p className="text-[15px] text-center mt-2 leading-[1.5]" style={{ color: TEXT_SECONDARY }}>
          {t("funnel.paywall.subtitle")}
        </p>
      </div>

      <div className="space-y-3 mb-4">
        {[t("funnel.paywall.benefit1"), t("funnel.paywall.benefit2"), t("funnel.paywall.benefit3")].map((b, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${BRAND}15` }}>
              <Check className="w-3.5 h-3.5" style={{ color: BRAND }} />
            </div>
            <span className="text-[14px]" style={{ color: TEXT_PRIMARY }}>{b}</span>
          </div>
        ))}
      </div>

      <div className="space-y-3 mb-6 mt-2">
        {plans.map((plan) => (
          <button
            key={plan.id}
            onClick={() => setSelected(plan.id)}
            className="w-full rounded-[6px] p-4 border-2 transition-all relative text-left"
            style={{
              borderColor: selected === plan.id ? BRAND : BORDER,
              backgroundColor: selected === plan.id ? `${BRAND}08` : "white",
            }}
            data-testid={`plan-${plan.id}`}
          >
            {plan.popular && (
              <span
                className="absolute -top-2.5 left-4 text-[11px] font-bold text-white px-2.5 py-0.5 rounded-full"
                style={{ backgroundColor: BRAND }}
              >
                {t("funnel.paywall.mostChosen")}
              </span>
            )}
            <div className="flex justify-between items-center">
              <div>
                <span className="text-[15px] font-semibold" style={{ color: TEXT_PRIMARY }}>{t(plan.nameKey)}</span>
                {plan.savings && (
                  <span className="ml-2 text-[12px] font-semibold px-2 py-0.5 rounded-full" style={{ color: BRAND, backgroundColor: `${BRAND}15` }}>
                    {t(plan.savings)}
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className="text-[16px] font-bold" style={{ color: TEXT_PRIMARY }}>{plan.perMonth}</span>
                <span className="text-[12px]" style={{ color: TEXT_SECONDARY }}>{t("funnel.paywall.perMonth")}</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 justify-center mb-5">
        <Shield className="w-4 h-4" style={{ color: TEXT_SECONDARY }} />
        <span className="text-[12px]" style={{ color: TEXT_SECONDARY }}>{t("funnel.paywall.guarantee")}</span>
      </div>

      <div className="mt-auto space-y-2">
        <PrimaryButton onClick={() => onNext(selected)} testId="button-select-plan">
          {t("funnel.paywall.selectPlan")}
        </PrimaryButton>
        <SecondaryButton onClick={onSkip} testId="button-skip-paywall">
          {t("funnel.paywall.skipTrial")}
        </SecondaryButton>
      </div>
    </>
  );
}

function ObjectionStep({ onNext, onSkip, t }: { onNext: () => void; onSkip: () => void; t: (k: string) => string }) {
  const reviews = [
    { name: t("funnel.objection.review1Name"), city: t("funnel.objection.review1City"), text: t("funnel.objection.review1Text") },
    { name: t("funnel.objection.review2Name"), city: t("funnel.objection.review2City"), text: t("funnel.objection.review2Text") },
    { name: t("funnel.objection.review3Name"), city: t("funnel.objection.review3City"), text: t("funnel.objection.review3Text") },
  ];

  const stats = [
    { value: t("funnel.objection.stat1Value"), label: t("funnel.objection.stat1Label") },
    { value: t("funnel.objection.stat2Value"), label: t("funnel.objection.stat2Label") },
    { value: t("funnel.objection.stat3Value"), label: t("funnel.objection.stat3Label") },
  ];

  return (
    <>
      <div className="pt-6 pb-4">
        <h1 className="text-[26px] font-bold tracking-[-0.02em] text-center" style={{ color: TEXT_PRIMARY }} data-testid="text-objection-title">
          {t("funnel.objection.title")}
        </h1>
        <p className="text-[15px] text-center mt-2 leading-[1.5]" style={{ color: TEXT_SECONDARY }}>
          {t("funnel.objection.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {stats.map((s, i) => (
          <div key={i} className="text-center rounded-[6px] p-3" style={{ backgroundColor: BG_LIGHT }}>
            <div className="text-[20px] font-bold" style={{ color: BRAND }}>{s.value}</div>
            <div className="text-[11px] mt-1" style={{ color: TEXT_SECONDARY }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-3 flex-1">
        {reviews.map((r, i) => (
          <div key={i} className="rounded-[6px] p-4 border" style={{ borderColor: BORDER }}>
            <div className="flex items-center gap-1 mb-2">
              {Array.from({ length: 5 }).map((_, j) => (
                <Star key={j} className="w-3.5 h-3.5 fill-current" style={{ color: "rgb(var(--ha-warning))" }} />
              ))}
            </div>
            <p className="text-[13px] leading-[1.55] mb-2" style={{ color: TEXT_PRIMARY }}>"{r.text}"</p>
            <p className="text-[12px] font-medium" style={{ color: TEXT_SECONDARY }}>{r.name} — {r.city}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-2">
        <PrimaryButton onClick={onNext} testId="button-objection-continue">
          {t("funnel.objection.cta")}
        </PrimaryButton>
        <SecondaryButton onClick={onSkip} testId="button-objection-skip">
          {t("funnel.objection.skip")}
        </SecondaryButton>
      </div>
    </>
  );
}

function PushStep({ onNext, onSkip, t, session }: { onNext: () => void; onSkip: () => void; t: (k: string) => string; session: any }) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function handleEnable() {
    setLoading(true);
    try {
      if ("Notification" in window && Notification.permission !== "granted") {
        await Notification.requestPermission();
      }
      if (session?.access_token) {
        await apiFetch("/api/notifications/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ push_enabled: true }),
        });
      }
      trackEvent("funnel_push_enabled");
      onNext();
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    }
    setLoading(false);
  }

  return (
    <>
      <div className="pt-8 pb-6 flex flex-col items-center">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ backgroundColor: `${BRAND}15` }}>
          <Bell className="w-10 h-10" style={{ color: BRAND }} />
        </div>
        <h1 className="text-[26px] font-bold tracking-[-0.02em] text-center" style={{ color: TEXT_PRIMARY }} data-testid="text-push-title">
          {t("funnel.push.title")}
        </h1>
        <p className="text-[15px] text-center mt-2 leading-[1.5] max-w-[320px]" style={{ color: TEXT_SECONDARY }}>
          {t("funnel.push.subtitle")}
        </p>
      </div>

      <div className="space-y-4 mb-8 flex-1">
        {[
          { icon: Zap, text: t("funnel.push.benefit1") },
          { icon: Clock, text: t("funnel.push.benefit2") },
          { icon: Check, text: t("funnel.push.benefit3") },
        ].map((b, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[6px] flex items-center justify-center flex-shrink-0" style={{ backgroundColor: BG_LIGHT }}>
              <b.icon className="w-5 h-5" style={{ color: BRAND }} />
            </div>
            <span className="text-[14px] font-medium" style={{ color: TEXT_PRIMARY }}>{b.text}</span>
          </div>
        ))}
      </div>

      <div className="mt-auto space-y-2">
        <PrimaryButton onClick={handleEnable} loading={loading} testId="button-enable-push">
          {t("funnel.push.enablePush")}
        </PrimaryButton>
        <SecondaryButton onClick={onSkip} testId="button-skip-push">
          {t("funnel.push.skip")}
        </SecondaryButton>
      </div>
    </>
  );
}

function PersonalInfoStep({ onNext, onSkip, t, session }: { onNext: () => void; onSkip: () => void; t: (k: string) => string; session: any }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [occupation, setOccupation] = useState("");
  const [income, setIncome] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function handleSave() {
    setLoading(true);
    try {
      const body: Record<string, any> = {};
      if (firstName.trim()) body.first_name = firstName.trim();
      if (lastName.trim()) body.last_name = lastName.trim();
      if (birthDate) body.birth_date = birthDate;
      if (phone.trim()) body.phone = phone.trim();
      if (occupation.trim()) body.occupation = occupation.trim();
      if (income) body.monthly_income = parseInt(income, 10);

      if (Object.keys(body).length > 0 && session?.access_token) {
        await apiFetch("/api/profile-data", {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify(body),
        });
      }
      trackEvent("funnel_personal_info_saved");
      onNext();
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    }
    setLoading(false);
  }

  const inputStyle = "w-full h-[48px] rounded-[6px] border px-4 text-[14px] outline-none transition-all focus:ring-2 focus:ring-orange-200";

  return (
    <>
      <div className="pt-6 pb-4">
        <h1 className="text-[24px] font-bold tracking-[-0.02em] text-center" style={{ color: TEXT_PRIMARY }} data-testid="text-personal-title">
          {t("funnel.personalInfo.title")}
        </h1>
        <p className="text-[14px] text-center mt-2 leading-[1.5]" style={{ color: TEXT_SECONDARY }}>
          {t("funnel.personalInfo.subtitle")}
        </p>
      </div>

      <div className="space-y-3 flex-1">
        <div className="grid grid-cols-2 gap-3">
          <input
            className={inputStyle}
            style={{ borderColor: BORDER }}
            placeholder={t("funnel.personalInfo.firstName")}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            data-testid="input-first-name"
          />
          <input
            className={inputStyle}
            style={{ borderColor: BORDER }}
            placeholder={t("funnel.personalInfo.lastName")}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            data-testid="input-last-name"
          />
        </div>
        <input
          className={inputStyle}
          style={{ borderColor: BORDER }}
          type="date"
          placeholder={t("funnel.personalInfo.birthDate")}
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          data-testid="input-birth-date"
        />
        <input
          className={inputStyle}
          style={{ borderColor: BORDER }}
          type="tel"
          placeholder={t("funnel.personalInfo.phone")}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          data-testid="input-phone"
        />
        <input
          className={inputStyle}
          style={{ borderColor: BORDER }}
          placeholder={t("funnel.personalInfo.occupation")}
          value={occupation}
          onChange={(e) => setOccupation(e.target.value)}
          data-testid="input-occupation"
        />
        <input
          className={inputStyle}
          style={{ borderColor: BORDER }}
          type="number"
          placeholder={t("funnel.personalInfo.income")}
          value={income}
          onChange={(e) => setIncome(e.target.value)}
          data-testid="input-income"
        />
      </div>

      <div className="mt-6 space-y-2">
        <PrimaryButton onClick={handleSave} loading={loading} testId="button-save-personal">
          {t("funnel.personalInfo.cta")}
        </PrimaryButton>
        <SecondaryButton onClick={onSkip} testId="button-skip-personal">
          {t("funnel.personalInfo.skip")}
        </SecondaryButton>
      </div>
    </>
  );
}

function HousingStep({ onNext, onSkip, t, session }: { onNext: () => void; onSkip: () => void; t: (k: string) => string; session: any }) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [situation, setSituation] = useState("");
  const [moveIn, setMoveIn] = useState("");

  const situations = ["renting", "living_with_parents", "shared_housing", "temporary", "own_property", "other"];
  const moveInOptions = ["asap", "within_1_month", "within_3_months", "flexible"];

  return (
    <>
      <div className="pt-6 pb-4">
        <h1 className="text-[24px] font-bold tracking-[-0.02em] text-center" style={{ color: TEXT_PRIMARY }} data-testid="text-housing-title">
          {t("funnel.housing.title")}
        </h1>
        <p className="text-[14px] text-center mt-2 leading-[1.5]" style={{ color: TEXT_SECONDARY }}>
          {t("funnel.housing.subtitle")}
        </p>
      </div>

      <div className="mb-5">
        <label className="text-[13px] font-semibold mb-2 block" style={{ color: TEXT_PRIMARY }}>
          {t("funnel.housing.currentSituation")}
        </label>
        <div className="space-y-2">
          {situations.map((s) => (
            <button
              key={s}
              onClick={() => setSituation(s)}
              className="w-full rounded-[6px] p-3.5 border text-left text-[14px] transition-all"
              style={{
                borderColor: situation === s ? BRAND : BORDER,
                backgroundColor: situation === s ? `${BRAND}08` : "white",
                color: TEXT_PRIMARY,
              }}
              data-testid={`option-situation-${s}`}
            >
              {t(`funnel.housing.situationOptions.${s}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <label className="text-[13px] font-semibold mb-2 block" style={{ color: TEXT_PRIMARY }}>
          {t("funnel.housing.moveInDate")}
        </label>
        <div className="grid grid-cols-2 gap-2">
          {moveInOptions.map((m) => (
            <button
              key={m}
              onClick={() => setMoveIn(m)}
              className="rounded-[6px] p-3 border text-center text-[13px] font-medium transition-all"
              style={{
                borderColor: moveIn === m ? BRAND : BORDER,
                backgroundColor: moveIn === m ? `${BRAND}08` : "white",
                color: TEXT_PRIMARY,
              }}
              data-testid={`option-movein-${m}`}
            >
              {t(`funnel.housing.moveInOptions.${m}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-auto space-y-2">
        <PrimaryButton
          onClick={async () => {
            setLoading(true);
            try {
              const body: Record<string, any> = {};
              if (situation) body.housing_situation = situation;
              if (moveIn) body.move_in_date = moveIn;
              if (Object.keys(body).length > 0 && session?.access_token) {
                await apiFetch("/api/profile-data", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
                  body: JSON.stringify(body),
                });
              }
              trackEvent("funnel_housing_saved");
              onNext();
            } catch (err: any) {
              toast({ title: t("common.error"), description: err.message, variant: "destructive" });
            }
            setLoading(false);
          }}
          disabled={!situation}
          loading={loading}
          testId="button-save-housing"
        >
          {t("funnel.housing.cta")}
        </PrimaryButton>
        <SecondaryButton onClick={onSkip} testId="button-skip-housing">
          {t("funnel.housing.skip")}
        </SecondaryButton>
      </div>
    </>
  );
}

function ExtrasStep({ onNext, onSkip, t, session }: { onNext: () => void; onSkip: () => void; t: (k: string) => string; session: any }) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [pets, setPets] = useState<boolean | null>(null);
  const [smoking, setSmoking] = useState<boolean | null>(null);

  function ToggleRow({ label, value, onChange, testIdPrefix }: { label: string; value: boolean | null; onChange: (v: boolean) => void; testIdPrefix: string }) {
    return (
      <div className="rounded-[6px] p-4 border" style={{ borderColor: BORDER }}>
        <p className="text-[14px] font-medium mb-3" style={{ color: TEXT_PRIMARY }}>{label}</p>
        <div className="flex gap-3">
          <button
            onClick={() => onChange(true)}
            className="flex-1 h-[42px] rounded-[6px] border text-[14px] font-medium transition-all"
            style={{
              borderColor: value === true ? BRAND : BORDER,
              backgroundColor: value === true ? `${BRAND}08` : "white",
              color: value === true ? BRAND : TEXT_PRIMARY,
            }}
            data-testid={`${testIdPrefix}-yes`}
          >
            {t("funnel.extras.petsYes")}
          </button>
          <button
            onClick={() => onChange(false)}
            className="flex-1 h-[42px] rounded-[6px] border text-[14px] font-medium transition-all"
            style={{
              borderColor: value === false ? BRAND : BORDER,
              backgroundColor: value === false ? `${BRAND}08` : "white",
              color: value === false ? BRAND : TEXT_PRIMARY,
            }}
            data-testid={`${testIdPrefix}-no`}
          >
            {t("funnel.extras.petsNo")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="pt-6 pb-4">
        <h1 className="text-[24px] font-bold tracking-[-0.02em] text-center" style={{ color: TEXT_PRIMARY }} data-testid="text-extras-title">
          {t("funnel.extras.title")}
        </h1>
        <p className="text-[14px] text-center mt-2 leading-[1.5]" style={{ color: TEXT_SECONDARY }}>
          {t("funnel.extras.subtitle")}
        </p>
      </div>

      <div className="space-y-3 flex-1">
        <ToggleRow label={t("funnel.extras.pets")} value={pets} onChange={setPets} testIdPrefix="toggle-pets" />
        <ToggleRow label={t("funnel.extras.smoking")} value={smoking} onChange={setSmoking} testIdPrefix="toggle-smoking" />
      </div>

      <div className="mt-6 space-y-2">
        <PrimaryButton
          onClick={async () => {
            setLoading(true);
            try {
              const body: Record<string, any> = {};
              if (pets !== null) body.has_pets = pets;
              if (smoking !== null) body.is_smoker = smoking;
              if (Object.keys(body).length > 0 && session?.access_token) {
                await apiFetch("/api/profile-data", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
                  body: JSON.stringify(body),
                });
              }
              trackEvent("funnel_extras_saved");
              onNext();
            } catch (err: any) {
              toast({ title: t("common.error"), description: err.message, variant: "destructive" });
            }
            setLoading(false);
          }}
          loading={loading}
          testId="button-save-extras"
        >
          {t("funnel.extras.cta")}
        </PrimaryButton>
        <SecondaryButton onClick={onSkip} testId="button-skip-extras">
          {t("funnel.extras.skip")}
        </SecondaryButton>
      </div>
    </>
  );
}

function LetterStep({ onNext, onSkip, t, session, locale }: { onNext: () => void; onSkip: () => void; t: (k: string) => string; session: any; locale: string }) {
  const [letter, setLetter] = useState("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setLetter(getDefaultTemplate(locale as any));
  }, [locale]);

  async function handleSave() {
    setLoading(true);
    try {
      if (session?.access_token) {
        await apiFetch("/api/profile-data", {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ application_template: letter }),
        });
      }
      trackEvent("funnel_letter_saved");
      onNext();
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    }
    setLoading(false);
  }

  return (
    <>
      <div className="pt-6 pb-4">
        <h1 className="text-[24px] font-bold tracking-[-0.02em] text-center" style={{ color: TEXT_PRIMARY }} data-testid="text-letter-title">
          {t("funnel.letter.title")}
        </h1>
        <p className="text-[14px] text-center mt-2 leading-[1.5]" style={{ color: TEXT_SECONDARY }}>
          {t("funnel.letter.subtitle")}
        </p>
      </div>

      <div className="flex-1 relative">
        <div className="rounded-[6px] border overflow-hidden" style={{ borderColor: BORDER }}>
          <div className="flex items-center justify-between px-4 py-2.5" style={{ backgroundColor: BG_LIGHT }}>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" style={{ color: BRAND }} />
              <span className="text-[12px] font-semibold" style={{ color: TEXT_PRIMARY }}>
                {t("funnel.letter.title")}
              </span>
            </div>
            <button
              onClick={() => setEditing(!editing)}
              className="text-[12px] font-medium"
              style={{ color: BRAND }}
              data-testid="button-edit-letter"
            >
              {t("funnel.letter.edit")}
            </button>
          </div>
          {editing ? (
            <textarea
              value={letter}
              onChange={(e) => setLetter(e.target.value)}
              className="w-full p-4 text-[13px] leading-[1.6] min-h-[280px] outline-none resize-none"
              style={{ color: TEXT_PRIMARY }}
              data-testid="textarea-letter"
            />
          ) : (
            <div className="p-4 text-[13px] leading-[1.6] max-h-[300px] overflow-y-auto whitespace-pre-wrap" style={{ color: TEXT_PRIMARY }}>
              {letter}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 space-y-2">
        <PrimaryButton onClick={handleSave} loading={loading} testId="button-save-letter">
          {t("funnel.letter.cta")}
        </PrimaryButton>
        <SecondaryButton onClick={onSkip} testId="button-skip-letter">
          {t("funnel.letter.skip")}
        </SecondaryButton>
      </div>
    </>
  );
}

function BuddyStep({ onNext, onSkip, t, session }: { onNext: () => void; onSkip: () => void; t: (k: string) => string; session: any }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [invited, setInvited] = useState(false);
  const { toast } = useToast();

  async function handleInvite() {
    if (!email.trim() || !email.includes("@")) return;
    setLoading(true);
    try {
      if (session?.access_token) {
        await apiFetch("/api/profile-data", {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ search_buddy_email: email.trim(), search_buddy_enabled: true }),
        });
      }
      trackEvent("funnel_buddy_invited");
      setInvited(true);
      setTimeout(onNext, 1500);
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    }
    setLoading(false);
  }

  return (
    <>
      <div className="pt-8 pb-6 flex flex-col items-center">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ backgroundColor: `${BRAND}15` }}>
          <Users className="w-10 h-10" style={{ color: BRAND }} />
        </div>
        <h1 className="text-[24px] font-bold tracking-[-0.02em] text-center" style={{ color: TEXT_PRIMARY }} data-testid="text-buddy-title">
          {t("funnel.buddy.title")}
        </h1>
        <p className="text-[14px] text-center mt-2 leading-[1.5] max-w-[320px]" style={{ color: TEXT_SECONDARY }}>
          {t("funnel.buddy.subtitle")}
        </p>
      </div>

      <div className="flex-1">
        {invited ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <CheckCircle2 className="w-12 h-12" style={{ color: BRAND }} />
            <span className="text-[15px] font-semibold" style={{ color: TEXT_PRIMARY }}>{t("funnel.buddy.invited")}</span>
          </div>
        ) : (
          <input
            className="w-full h-[48px] rounded-[6px] border px-4 text-[14px] outline-none transition-all focus:ring-2 focus:ring-orange-200"
            style={{ borderColor: BORDER }}
            type="email"
            placeholder={t("funnel.buddy.emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            data-testid="input-buddy-email"
          />
        )}
      </div>

      <div className="mt-6 space-y-2">
        {!invited && (
          <PrimaryButton onClick={handleInvite} loading={loading} disabled={!email.includes("@")} testId="button-invite-buddy">
            {t("funnel.buddy.cta")}
          </PrimaryButton>
        )}
        <SecondaryButton onClick={onSkip} testId="button-skip-buddy">
          {t("funnel.buddy.skip")}
        </SecondaryButton>
      </div>
    </>
  );
}

function SuccessStep({ onFinish, t }: { onFinish: () => void; t: (k: string) => string }) {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 bg-ha-card" data-testid="funnel-step-success">
      <div className="w-24 h-24 rounded-full flex items-center justify-center mb-8" style={{ backgroundColor: `${BRAND}15` }}>
        <Sparkles className="w-12 h-12" style={{ color: BRAND }} />
      </div>

      <h1 className="text-[28px] font-bold tracking-[-0.02em] text-center mb-3" style={{ color: TEXT_PRIMARY }} data-testid="text-success-title">
        {t("funnel.success.title")}
      </h1>
      <p className="text-[15px] text-center leading-[1.5] mb-8 max-w-[320px]" style={{ color: TEXT_SECONDARY }}>
        {t("funnel.success.subtitle")}
      </p>

      <div className="space-y-3 w-full max-w-[320px] mb-10">
        {[t("funnel.success.bullet1"), t("funnel.success.bullet2"), t("funnel.success.bullet3")].map((b, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${BRAND}15` }}>
              <Check className="w-4 h-4" style={{ color: BRAND }} />
            </div>
            <span className="text-[14px] font-medium" style={{ color: TEXT_PRIMARY }}>{b}</span>
          </div>
        ))}
      </div>

      <div className="w-full max-w-[320px]">
        <PrimaryButton onClick={onFinish} testId="button-go-dashboard">
          <span className="flex items-center justify-center gap-2">
            {t("funnel.success.cta")}
            <ArrowRight className="w-4 h-4" />
          </span>
        </PrimaryButton>
      </div>
    </div>
  );
}

export default function PostLoginFunnel() {
  console.log("[PAGE] PostLoginFunnel v2.1 rendered (NEW onboarding/setup flow)");
  const [, navigate] = useLocation();
  const { user, session } = useAuth();
  const { t, locale } = useTranslation();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("paywall");

  const stepIndex = STEP_ORDER.indexOf(step);

  const goNext = useCallback(() => {
    const idx = STEP_ORDER.indexOf(step);
    if (idx < STEP_ORDER.length - 1) {
      setStep(STEP_ORDER[idx + 1]);
      window.scrollTo(0, 0);
    }
  }, [step]);

  function handlePaywallSelect(plan: string) {
    trackEvent("funnel_plan_selected", { plan });
    handleCheckout(plan);
  }

  async function handleCheckout(plan: string) {
    if (!user) {
      navigate(`/signup?plan=${plan}`);
      return;
    }

    try {
      const s = await supabase.auth.getSession();
      const token = s.data.session?.access_token;
      if (!token) {
        navigate("/login");
        return;
      }

      trackEvent("checkout_started", { plan });

      const res = await apiFetch("/api/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Checkout failed");
      }
      const data = await res.json();

      if (data.url) {
        if (typeof (window as any).ReactNativeWebView?.postMessage === "function") {
          (window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: "openExternal", url: data.url }));
        } else {
          window.location.href = data.url;
        }
      }
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    }
  }

  function handlePaywallSkip() {
    trackEvent("funnel_paywall_skipped");
    goNext();
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stepParam = params.get("step") as Step | null;
    if (stepParam && STEP_ORDER.includes(stepParam)) {
      setStep(stepParam);
    }
  }, []);

  useEffect(() => {
    trackEvent("funnel_step_viewed", { step });
  }, [step]);

  const stepProps = { t, session };

  if (step === "success") {
    return (
      <SuccessStep
        onFinish={async () => {
          trackEvent("funnel_completed");
          try {
            if (session?.access_token) {
              await apiFetch("/api/profile-data", {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify({ onboarding_completed: true }),
              });
              console.log("[FUNNEL] onboarding_completed=true saved, redirecting to dashboard");
            }
          } catch (err) {
            console.error("[FUNNEL] Failed to save onboarding_completed", err);
          }
          navigate("/dashboard");
        }}
        t={t}
      />
    );
  }

  return (
    <StepShell step={step} stepIndex={stepIndex}>
      {step === "paywall" && (
        <PaywallStep onNext={handlePaywallSelect} onSkip={handlePaywallSkip} t={t} />
      )}
      {step === "objection" && (
        <ObjectionStep onNext={goNext} onSkip={goNext} t={t} />
      )}
      {step === "push" && (
        <PushStep onNext={goNext} onSkip={goNext} {...stepProps} />
      )}
      {step === "personalInfo" && (
        <PersonalInfoStep onNext={goNext} onSkip={goNext} {...stepProps} />
      )}
      {step === "housing" && (
        <HousingStep onNext={goNext} onSkip={goNext} {...stepProps} />
      )}
      {step === "extras" && (
        <ExtrasStep onNext={goNext} onSkip={goNext} {...stepProps} />
      )}
      {step === "letter" && (
        <LetterStep onNext={goNext} onSkip={goNext} {...stepProps} locale={locale} />
      )}
      {step === "buddy" && (
        <BuddyStep onNext={goNext} onSkip={goNext} {...stepProps} />
      )}
    </StepShell>
  );
}
