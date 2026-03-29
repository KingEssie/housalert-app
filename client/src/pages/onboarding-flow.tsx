import { useState, useCallback, useRef, useEffect } from "react";
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
  MapPin, Search, ChevronLeft, Loader2, Check, ArrowRight,
  Euro, BedDouble, Maximize2, Eye, Shield, Star, Zap, Bell, Lock,
  AlertTriangle, Clock, X, CheckCircle2, Copy, Send, Mail, BellRing,
  User, Heart, Briefcase, Home, PawPrint, FileText, Users, Sparkles,
} from "lucide-react";

const BRAND = "rgb(var(--ha-primary))";
const BRAND_HOVER = "rgb(var(--ha-primary-hover))";
const TEXT_PRIMARY = "rgb(var(--ha-text))";
const TEXT_SECONDARY = "rgb(var(--ha-text-secondary))";
const BG_SURFACE = "rgb(var(--ha-surface))";
const BG_CARD = "rgb(var(--ha-card))";
const BORDER = "rgb(var(--ha-card-border))";

type FlowStep =
  | "paywall"
  | "welcome" | "push-test" | "letter-personal" | "letter-living"
  | "letter-preview" | "search-buddy" | "success";

const ALL_STEPS: FlowStep[] = ["paywall", "welcome", "push-test", "letter-personal", "letter-living", "letter-preview", "search-buddy", "success"];
const POST_PAYWALL_STEPS: FlowStep[] = ["welcome", "push-test", "letter-personal", "letter-living", "letter-preview", "search-buddy", "success"];


function FlowShell({
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
    <div className="min-h-[100dvh] flex flex-col bg-ha-surface" data-testid={`onboarding-step-${step}`}>
      <header className="sticky top-0 z-20 bg-ha-card border-b border-ha-card-border">
        <div className="max-w-[480px] mx-auto px-5 h-[56px] flex items-center gap-3">
          {showBack && onBack ? (
            <button
              onClick={onBack}
              className="w-10 h-10 rounded-full bg-ha-surface flex items-center justify-center active:scale-95 transition-transform"
              data-testid="button-flow-back"
            >
              <ChevronLeft className="w-5 h-5 text-ha-text-muted" />
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

function PrimaryBtn({
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

function WelcomeStep({
  onNext,
  t,
}: {
  onNext: () => void;
  t: (k: string, p?: Record<string, any>) => string;
}) {
  const points = [
    { icon: FileText, text: t("onboardingFlow.welcome.point1") },
    { icon: Users, text: t("onboardingFlow.welcome.point2") },
    { icon: Bell, text: t("onboardingFlow.welcome.point3") },
  ];

  return (
    <>
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-5" style={{ backgroundColor: "rgba(249,115,22,0.12)" }}>
          <Sparkles className="w-8 h-8" style={{ color: BRAND }} />
        </div>
        <h1 className="text-[24px] font-bold tracking-[-0.02em] mb-2" style={{ color: TEXT_PRIMARY }} data-testid="text-welcome-title">
          {t("onboardingFlow.welcome.title")}
        </h1>
        <p className="text-[14px] mb-8 max-w-[320px]" style={{ color: TEXT_SECONDARY }}>
          {t("onboardingFlow.welcome.subtitle")}
        </p>

        <div className="w-full space-y-4">
          {points.map((p, i) => (
            <div key={i} className="flex items-center gap-4 bg-ha-card rounded-[6px] border border-ha-card-border px-5 py-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "rgba(249,115,22,0.12)" }}>
                <p.icon className="w-5 h-5" style={{ color: BRAND }} />
              </div>
              <span className="text-[14px] font-medium text-left" style={{ color: TEXT_PRIMARY }}>{p.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto pt-6">
        <PrimaryBtn onClick={onNext} testId="button-welcome-next">
          {t("onboardingFlow.welcome.cta")}
        </PrimaryBtn>
      </div>
    </>
  );
}

interface PersonalData {
  phone: string;
  birthDay: string;
  birthMonth: string;
  birthYear: string;
  gender: string;
}

function LetterPersonalStep({
  personalData,
  onChange,
  onNext,
  onSkip,
  t,
}: {
  personalData: PersonalData;
  onChange: (d: Partial<PersonalData>) => void;
  onNext: () => void;
  onSkip: () => void;
  t: (k: string, p?: Record<string, any>) => string;
}) {
  const INPUT_CLS = "w-full h-[48px] px-4 rounded-[6px] border border-ha-card-border bg-ha-card text-[15px] text-ha-text placeholder:text-ha-text-secondary focus:outline-none focus:ring-2 focus:ring-orange-200";

  const genderOptions = [
    { value: "male", label: t("onboardingFlow.letterPersonal.genderOptions.male") },
    { value: "female", label: t("onboardingFlow.letterPersonal.genderOptions.female") },
    { value: "other", label: t("onboardingFlow.letterPersonal.genderOptions.other") },
    { value: "prefer_not", label: t("onboardingFlow.letterPersonal.genderOptions.prefer_not") },
  ];

  return (
    <>
      <h1 className="text-[24px] font-bold tracking-[-0.02em] mb-2" style={{ color: TEXT_PRIMARY }} data-testid="text-letter-personal-title">
        {t("onboardingFlow.letterPersonal.title")}
      </h1>
      <p className="text-[14px] mb-6" style={{ color: TEXT_SECONDARY }}>
        {t("onboardingFlow.letterPersonal.subtitle")}
      </p>

      <div className="space-y-5 flex-1">
        <div>
          <label className="text-[13px] font-medium text-ha-text-secondary mb-1.5 block">
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
          <label className="text-[13px] font-medium text-ha-text-secondary mb-1.5 block">
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
          <label className="text-[13px] font-medium text-ha-text-secondary mb-2 block">
            {t("onboardingFlow.letterPersonal.gender")}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {genderOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onChange({ gender: opt.value })}
                className="h-[46px] rounded-[6px] border-2 text-[14px] font-medium transition-all active:scale-[0.97]"
                style={{
                  borderColor: personalData.gender === opt.value ? BRAND : "rgb(var(--ha-card-border))",
                  backgroundColor: personalData.gender === opt.value ? "rgba(249,115,22,0.06)" : "transparent",
                  color: personalData.gender === opt.value ? BRAND : TEXT_PRIMARY,
                }}
                data-testid={`gender-${opt.value}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-auto space-y-3 pt-6">
        <PrimaryBtn onClick={onNext} testId="button-personal-next">
          {t("onboardingFlow.letterPersonal.cta")}
        </PrimaryBtn>
        <SecondaryBtn onClick={onSkip} testId="button-personal-skip">
          {t("onboardingFlow.letterPersonal.skip")}
        </SecondaryBtn>
      </div>
    </>
  );
}

interface LivingData {
  livingWith: string;
  workStatus: string;
  moveReason: string;
  income: string;
  petsCount: string;
}

function OptionGrid({
  options,
  selected,
  onSelect,
  columns,
}: {
  options: { value: string; label: string }[];
  selected: string;
  onSelect: (v: string) => void;
  columns?: number;
}) {
  return (
    <div className={`grid gap-2 ${columns === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onSelect(opt.value)}
          className="px-3 py-3 rounded-[6px] border-2 text-[13px] font-medium transition-all active:scale-[0.97] text-left"
          style={{
            borderColor: selected === opt.value ? BRAND : "rgb(var(--ha-card-border))",
            backgroundColor: selected === opt.value ? "rgba(249,115,22,0.06)" : "transparent",
            color: selected === opt.value ? BRAND : TEXT_PRIMARY,
          }}
          data-testid={`option-${opt.value}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function LetterLivingStep({
  livingData,
  onChange,
  onNext,
  onSkip,
  t,
}: {
  livingData: LivingData;
  onChange: (d: Partial<LivingData>) => void;
  onNext: () => void;
  onSkip: () => void;
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

  const INPUT_CLS = "w-full h-[48px] px-4 rounded-[6px] border border-ha-card-border bg-ha-card text-[15px] text-ha-text placeholder:text-ha-text-secondary focus:outline-none focus:ring-2 focus:ring-orange-200";

  return (
    <>
      <h1 className="text-[24px] font-bold tracking-[-0.02em] mb-2" style={{ color: TEXT_PRIMARY }} data-testid="text-letter-living-title">
        {t("onboardingFlow.letterLiving.title")}
      </h1>
      <p className="text-[14px] mb-6" style={{ color: TEXT_SECONDARY }}>
        {t("onboardingFlow.letterLiving.subtitle")}
      </p>

      <div className="space-y-6 flex-1 overflow-y-auto">
        <div>
          <label className="text-[13px] font-medium text-ha-text-secondary mb-2 block">
            {t("onboardingFlow.letterLiving.livingWith")}
          </label>
          <OptionGrid
            options={livingOptions}
            selected={livingData.livingWith}
            onSelect={(v) => onChange({ livingWith: v })}
          />
        </div>

        <div>
          <label className="text-[13px] font-medium text-ha-text-secondary mb-2 block">
            {t("onboardingFlow.letterLiving.workStatus")}
          </label>
          <OptionGrid
            options={workOptions}
            selected={livingData.workStatus}
            onSelect={(v) => onChange({ workStatus: v })}
          />
        </div>

        <div>
          <label className="text-[13px] font-medium text-ha-text-secondary mb-2 block">
            {t("onboardingFlow.letterLiving.moveReason")}
          </label>
          <OptionGrid
            options={moveOptions}
            selected={livingData.moveReason}
            onSelect={(v) => onChange({ moveReason: v })}
          />
        </div>

        <div>
          <label className="text-[13px] font-medium text-ha-text-secondary mb-1.5 block">
            {t("onboardingFlow.letterLiving.income")}
          </label>
          <div className="relative">
            <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ha-text-muted" />
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
          <label className="text-[13px] font-medium text-ha-text-secondary mb-1.5 block">
            {t("onboardingFlow.letterLiving.pets")}
          </label>
          <div className="flex gap-2">
            {["0", "1", "2", "3+"].map((val) => (
              <button
                key={val}
                onClick={() => onChange({ petsCount: val })}
                className="flex-1 h-[46px] rounded-[6px] border-2 text-[14px] font-medium transition-all active:scale-[0.97]"
                style={{
                  borderColor: livingData.petsCount === val ? BRAND : "rgb(var(--ha-card-border))",
                  backgroundColor: livingData.petsCount === val ? "rgba(249,115,22,0.06)" : "transparent",
                  color: livingData.petsCount === val ? BRAND : TEXT_PRIMARY,
                }}
                data-testid={`pets-${val}`}
              >
                {val}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-auto space-y-3 pt-6">
        <PrimaryBtn onClick={onNext} testId="button-living-next">
          {t("onboardingFlow.letterLiving.cta")}
        </PrimaryBtn>
        <SecondaryBtn onClick={onSkip} testId="button-living-skip">
          {t("onboardingFlow.letterLiving.skip")}
        </SecondaryBtn>
      </div>
    </>
  );
}

function LetterPreviewStep({
  letterText,
  onLetterChange,
  onNext,
  onBack,
  t,
}: {
  letterText: string;
  onLetterChange: (text: string) => void;
  onNext: () => void;
  onBack: () => void;
  t: (k: string, p?: Record<string, any>) => string;
}) {
  return (
    <>
      <h1 className="text-[24px] font-bold tracking-[-0.02em] mb-2" style={{ color: TEXT_PRIMARY }} data-testid="text-letter-preview-title">
        {t("onboardingFlow.letterPreview.title")}
      </h1>
      <p className="text-[14px] mb-4" style={{ color: TEXT_SECONDARY }}>
        {t("onboardingFlow.letterPreview.subtitle")}
      </p>

      <div className="bg-orange-50 border border-orange-200 rounded-[6px] px-4 py-3 mb-4 flex items-start gap-2.5">
        <FileText className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: BRAND }} />
        <p className="text-[13px] leading-snug" style={{ color: BRAND }}>
          {t("onboardingFlow.letterPreview.addressNote")}
        </p>
      </div>

      <textarea
        value={letterText}
        onChange={(e) => onLetterChange(e.target.value)}
        className="w-full flex-1 min-h-[280px] p-4 rounded-[6px] border border-ha-card-border bg-ha-card text-[14px] leading-[1.7] text-ha-text placeholder:text-ha-text-secondary focus:outline-none focus:ring-2 focus:ring-orange-200 resize-none"
        style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
        data-testid="textarea-letter"
      />

      <div className="mt-auto space-y-3 pt-4">
        <PrimaryBtn onClick={onNext} testId="button-letter-next">
          {t("onboardingFlow.letterPreview.cta")}
        </PrimaryBtn>
        <SecondaryBtn onClick={onBack} testId="button-letter-back">
          {t("onboardingFlow.letterPreview.back")}
        </SecondaryBtn>
      </div>
    </>
  );
}

function SearchBuddyStep({
  buddyEmail,
  onBuddyEmailChange,
  onInvite,
  onSkip,
  invited,
  loading,
  t,
}: {
  buddyEmail: string;
  onBuddyEmailChange: (e: string) => void;
  onInvite: () => void;
  onSkip: () => void;
  invited: boolean;
  loading: boolean;
  t: (k: string, p?: Record<string, any>) => string;
}) {
  return (
    <>
      <h1 className="text-[24px] font-bold tracking-[-0.02em] mb-2" style={{ color: TEXT_PRIMARY }} data-testid="text-buddy-title">
        {t("onboardingFlow.searchBuddy.title")}
      </h1>
      <p className="text-[14px] mb-6" style={{ color: TEXT_SECONDARY }}>
        {t("onboardingFlow.searchBuddy.subtitle")}
      </p>

      <div className="bg-ha-card rounded-[6px] border border-ha-card-border p-5 mb-6">
        <div className="pb-4 mb-4 border-b border-ha-card-border">
          <p className="text-[13px] font-semibold mb-2.5" style={{ color: "rgb(34,197,94)" }}>
            {t("onboardingFlow.searchBuddy.allowed")}
          </p>
          <div className="space-y-2.5">
            {[
              t("onboardingFlow.searchBuddy.canAlerts"),
              t("onboardingFlow.searchBuddy.canFavorite"),
              t("onboardingFlow.searchBuddy.canApply"),
            ].map((text, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span className="text-[13px]" style={{ color: TEXT_PRIMARY }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[13px] font-semibold mb-2.5 text-red-500">
            {t("onboardingFlow.searchBuddy.notAllowed")}
          </p>
          <div className="space-y-2.5">
            {[
              t("onboardingFlow.searchBuddy.cannotProfiles"),
              t("onboardingFlow.searchBuddy.cannotLetter"),
            ].map((text, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <X className="w-4 h-4 text-red-500 flex-shrink-0" />
                <span className="text-[13px]" style={{ color: TEXT_PRIMARY }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {invited ? (
        <div className="bg-green-50 border border-green-200 rounded-[6px] px-4 py-3.5 mb-6 flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
          <span className="text-[14px] font-medium text-green-700">{t("onboardingFlow.searchBuddy.invited")}</span>
        </div>
      ) : (
        <div className="flex gap-2 mb-6">
          <input
            type="email"
            inputMode="email"
            value={buddyEmail}
            onChange={(e) => onBuddyEmailChange(e.target.value)}
            placeholder={t("onboardingFlow.searchBuddy.emailPlaceholder")}
            className="flex-1 h-[48px] px-4 rounded-[6px] border border-ha-card-border bg-ha-card text-[14px] text-ha-text placeholder:text-ha-text-secondary focus:outline-none focus:ring-2 focus:ring-orange-200"
            data-testid="input-buddy-email"
          />
          <button
            onClick={onInvite}
            disabled={!buddyEmail.includes("@") || loading}
            className="h-[48px] px-5 rounded-[6px] text-[14px] font-semibold text-white transition-all active:scale-[0.97] disabled:opacity-50 flex items-center gap-1.5"
            style={{ backgroundColor: BRAND }}
            data-testid="button-buddy-invite"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 flex-shrink-0" />{t("onboardingFlow.searchBuddy.invite")}</>}
          </button>
        </div>
      )}

      <div className="mt-auto space-y-3">
        {invited ? (
          <PrimaryBtn onClick={onSkip} testId="button-buddy-continue">
            {t("onboardingFlow.next")}
          </PrimaryBtn>
        ) : (
          <SecondaryBtn onClick={onSkip} testId="button-buddy-skip">
            {t("onboardingFlow.searchBuddy.maybeLater")}
          </SecondaryBtn>
        )}
      </div>
    </>
  );
}

function PushTestStep({
  onNext,
  onEnable,
  pushState,
  t,
}: {
  onNext: () => void;
  onEnable: () => void;
  pushState: "idle" | "requesting" | "granted" | "denied";
  t: (k: string, p?: Record<string, any>) => string;
}) {
  return (
    <>
      <h1 className="text-[24px] font-bold tracking-[-0.02em] mb-2" style={{ color: TEXT_PRIMARY }} data-testid="text-push-title">
        {t("onboardingFlow.pushTest.title")}
      </h1>

      {pushState === "granted" ? (
        <>
          <p className="text-[14px] mb-6" style={{ color: TEXT_SECONDARY }}>
            {t("onboardingFlow.pushTest.subtitle")}
          </p>
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-5" style={{ backgroundColor: "rgba(34,197,94,0.1)" }}>
              <BellRing className="w-8 h-8 text-green-500" />
            </div>

            <div className="bg-green-50 border border-green-200 rounded-[6px] px-5 py-4 w-full flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[14px] font-semibold mb-0.5 text-green-800">
                  {t("onboardingFlow.pushTest.infoTitle")}
                </p>
                <p className="text-[13px] text-green-700 leading-snug">
                  {t("onboardingFlow.pushTest.infoText")}
                </p>
              </div>
            </div>
          </div>
        </>
      ) : pushState === "denied" ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-5 bg-red-50">
            <Bell className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-[14px] text-center mb-4 max-w-[320px] font-medium" style={{ color: TEXT_PRIMARY }}>
            {t("onboardingFlow.pushTest.denied")}
          </p>
          <p className="text-[13px] text-center max-w-[300px]" style={{ color: TEXT_SECONDARY }}>
            {t("onboardingFlow.pushTest.deniedHint")}
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-5" style={{ backgroundColor: "rgba(249,115,22,0.12)" }}>
            <Bell className="w-8 h-8" style={{ color: BRAND }} />
          </div>
          {pushState === "requesting" ? (
            <Loader2 className="w-6 h-6 animate-spin mb-4" style={{ color: BRAND }} />
          ) : (
            <p className="text-[14px] text-center max-w-[300px]" style={{ color: TEXT_SECONDARY }}>
              {t("onboardingFlow.pushTest.idleHint")}
            </p>
          )}
        </div>
      )}

      <div className="mt-auto space-y-3 pt-6">
        {pushState === "idle" ? (
          <>
            <PrimaryBtn onClick={onEnable} testId="button-push-enable">
              {t("onboardingFlow.pushTest.enablePush")}
            </PrimaryBtn>
            <SecondaryBtn onClick={onNext} testId="button-push-skip">
              {t("onboardingFlow.pushTest.cta")}
            </SecondaryBtn>
          </>
        ) : (
          <PrimaryBtn onClick={onNext} testId="button-push-next">
            {t("onboardingFlow.pushTest.cta")}
          </PrimaryBtn>
        )}
      </div>
    </>
  );
}

function SuccessStep({
  onFinish,
  t,
}: {
  onFinish: () => void;
  t: (k: string, p?: Record<string, any>) => string;
}) {
  const points = [
    { icon: Zap, text: t("onboardingFlow.success.point1") },
    { icon: ArrowRight, text: t("onboardingFlow.success.point2") },
    { icon: Star, text: t("onboardingFlow.success.point3") },
  ];

  return (
    <>
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 animate-scale-in" style={{ backgroundColor: "rgba(34,197,94,0.12)" }}>
          <CheckCircle2 className="w-10 h-10 text-green-500" />
        </div>
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em] mb-2" style={{ color: TEXT_PRIMARY }} data-testid="text-success-title">
          {t("onboardingFlow.success.title")}
        </h1>
        <p className="text-[15px] mb-8 max-w-[320px] leading-relaxed" style={{ color: TEXT_SECONDARY }}>
          {t("onboardingFlow.success.subtitle")}
        </p>

        <div className="w-full space-y-3">
          {points.map((p, i) => (
            <div key={i} className="flex items-center gap-4 bg-ha-card rounded-[6px] border border-ha-card-border px-5 py-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "rgba(34,197,94,0.1)" }}>
                <p.icon className="w-5 h-5 text-green-500" />
              </div>
              <span className="text-[14px] font-medium text-left" style={{ color: TEXT_PRIMARY }}>{p.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto pt-6">
        <PrimaryBtn onClick={onFinish} testId="button-success-finish">
          <span className="inline-flex items-center gap-2">
            {t("onboardingFlow.success.cta")}
            <ArrowRight className="w-5 h-5" />
          </span>
        </PrimaryBtn>
      </div>
    </>
  );
}

export function PostPaywallContinue() {
  return <OnboardingFlow initialStep="welcome" />;
}

export default function OnboardingFlow({ initialStep }: { initialStep?: FlowStep }) {
  const [, navigate] = useLocation();
  const { user, session } = useAuth();
  const { t, locale } = useTranslation();
  const { toast } = useToast();

  const [step, setStep] = useState<FlowStep>(initialStep || "paywall");
  const [profileLoaded, setProfileLoaded] = useState(false);

  const [personalData, setPersonalData] = useState<PersonalData>({
    phone: "",
    birthDay: "",
    birthMonth: "",
    birthYear: "",
    gender: "",
  });
  const [livingData, setLivingData] = useState<LivingData>({
    livingWith: "",
    workStatus: "",
    moveReason: "",
    income: "",
    petsCount: "0",
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
          if (d.push_test_completed) setPushState("granted");

          if (d.post_paywall_onboarding_completed) {
            navigate("/home");
            return;
          }

          const paywallDone = d.paywall_completed === true;

          const savedStep = d.onboarding_current_step;
          if (savedStep && ALL_STEPS.includes(savedStep as FlowStep)) {
            if (paywallDone && savedStep === "paywall") {
              setStep("welcome");
            } else {
              setStep(savedStep as FlowStep);
            }
          } else if (paywallDone) {
            setStep("welcome");
          } else {
            setStep("paywall");
          }
        }
      } catch (err) {
        console.error("[ONBOARDING] Failed to load profile data", err);
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
    if (s !== "paywall") {
      saveProfileField({ onboarding_current_step: s });
    }
  }

  function handleBack() {
    const idx = ALL_STEPS.indexOf(step);
    if (idx > 0) {
      goStep(ALL_STEPS[idx - 1]);
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
      console.error("[ONBOARDING] Failed to save profile fields", err);
    }
  }

  async function handleSelectPlan(plan: string) {
    trackEvent("onboarding_plan_selected", { plan });

    try {
      const s = await supabase.auth.getSession();
      const token = s.data.session?.access_token;
      if (!token) {
        navigate("/login");
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
    trackEvent("onboarding_paywall_skipped");
    saveProfileField({ paywall_completed: true });
    goStep("welcome");
  }

  async function handleLetterPersonalNext() {
    trackEvent("onboarding_letter_personal_done");
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

  function handlePushNext() {
    goStep("letter-personal");
  }

  async function handleLetterLivingNext() {
    trackEvent("onboarding_letter_living_done");
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
    trackEvent("onboarding_letter_done");
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
      trackEvent("onboarding_buddy_invited", { email: buddyEmail });
      setBuddyInvited(true);
    } catch (err) {
      console.error("[ONBOARDING] buddy invite failed", err);
    } finally {
      setBuddyLoading(false);
    }
  }

  function handleBuddySkip() {
    trackEvent("onboarding_buddy_skipped");
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
        trackEvent("onboarding_push_granted");
      } else {
        setPushState("denied");
        await saveProfileField({ push_test_completed: false });
        trackEvent("onboarding_push_denied");
      }
    } catch (err) {
      console.error("[ONBOARDING] push setup failed", err);
      setPushState("denied");
      saveProfileField({ push_test_completed: false });
    }
  }

  async function handleSuccessFinish() {
    trackEvent("onboarding_complete");
    await saveProfileField({
      post_paywall_onboarding_completed: true,
      onboarding_current_step: "done",
    });
    navigate("/home");
  }

  useEffect(() => {
    trackEvent("onboarding_flow_step", { step });
  }, [step]);

  if (!profileLoaded) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-ha-surface">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: BRAND }} />
      </div>
    );
  }

  const showBack = step !== "paywall" && step !== "welcome" && step !== "success";

  return (
    <FlowShell step={step} onBack={handleBack} showBack={showBack}>
      {step === "paywall" && (
        <PaywallStep onSelectPlan={handleSelectPlan} onSkip={handleSkipPaywall} t={t} />
      )}
      {step === "welcome" && (
        <WelcomeStep onNext={() => goStep("push-test")} t={t} />
      )}
      {step === "push-test" && (
        <PushTestStep
          onNext={handlePushNext}
          onEnable={handlePushEnable}
          pushState={pushState}
          t={t}
        />
      )}
      {step === "letter-personal" && (
        <LetterPersonalStep
          personalData={personalData}
          onChange={updatePersonalData}
          onNext={handleLetterPersonalNext}
          onSkip={() => goStep("letter-living")}
          t={t}
        />
      )}
      {step === "letter-living" && (
        <LetterLivingStep
          livingData={livingData}
          onChange={updateLivingData}
          onNext={handleLetterLivingNext}
          onSkip={() => { handleLetterLivingNext(); }}
          t={t}
        />
      )}
      {step === "letter-preview" && (
        <LetterPreviewStep
          letterText={letterText}
          onLetterChange={setLetterText}
          onNext={handleLetterPreviewNext}
          onBack={() => goStep("letter-living")}
          t={t}
        />
      )}
      {step === "search-buddy" && (
        <SearchBuddyStep
          buddyEmail={buddyEmail}
          onBuddyEmailChange={setBuddyEmail}
          onInvite={handleBuddyInvite}
          onSkip={handleBuddySkip}
          invited={buddyInvited}
          loading={buddyLoading}
          t={t}
        />
      )}
      {step === "success" && (
        <SuccessStep onFinish={handleSuccessFinish} t={t} />
      )}
    </FlowShell>
  );
}
