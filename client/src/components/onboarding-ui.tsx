import { useHashSearch } from "@/lib/hash-search";
import { useTranslation } from "@/i18n";

export const ONBOARDING_TOTAL_STEPS = 3;

/* ─── Semantic CSS variable shorthand helpers ─────────────────────────────────
   All colors resolve to CSS variables. No hardcoded hex values.
   OB = native app mode (dark header), OBW = website/light mode.
   Both share the same semantic tokens; OBW uses slightly tighter borders.
─────────────────────────────────────────────────────────────────────────────── */

export const OB = {
  gradient: "rgb(var(--ha-card))",
  headerBg: "rgb(var(--ha-card))",
  headerBorder: "rgb(var(--ha-card-border))",
  card: "rgb(var(--ha-card))",
  cardBorder: "rgb(var(--ha-card-border))",
  inputBg: "rgb(var(--ha-card))",
  inputBorder: "rgb(var(--ha-card-border))",
  text: "rgb(var(--ha-text))",
  textSecondary: "rgb(var(--ha-text-secondary))",
  textMuted: "rgb(var(--ha-text-muted))",
  primary: "rgb(var(--ha-primary))",
  primaryHover: "rgb(var(--ha-primary-hover))",
  primaryGradient: "linear-gradient(135deg, rgb(var(--ha-primary)) 0%, rgb(var(--ha-primary-hover)) 100%)",
  primaryShadow: "0 4px 15px rgb(var(--ha-primary) / 0.2)",
  surface: "rgb(var(--ha-card))",
  divider: "rgb(var(--ha-card-border))",
  progressInactive: "rgb(var(--ha-card-border))",
  backBtnBg: "rgb(var(--ha-card))",
  selectedBg: "var(--ha-primary-light)",
  selectedBorder: "rgb(var(--ha-primary))",
  accentBg: "var(--ha-primary-light)",
  greenBg: "var(--ha-success-light)",
  greenBorder: "rgb(var(--ha-success) / 0.2)",
  redBg: "var(--ha-danger-light)",
  redBorder: "rgb(var(--ha-danger) / 0.2)",
} as const;

export const OBW = {
  gradient: "rgb(var(--ha-card))",
  headerBg: "rgb(var(--ha-card))",
  headerBorder: "rgb(var(--ha-border-input))",
  card: "rgb(var(--ha-card))",
  cardBorder: "rgb(var(--ha-border-input))",
  inputBg: "rgb(var(--ha-card))",
  inputBorder: "rgb(var(--ha-border-input))",
  text: "rgb(var(--ha-text))",
  textSecondary: "rgb(var(--ha-text-secondary))",
  textMuted: "rgb(var(--ha-text-muted))",
  primary: "rgb(var(--ha-primary))",
  primaryHover: "rgb(var(--ha-primary-hover))",
  primaryGradient: "linear-gradient(135deg, rgb(var(--ha-primary)) 0%, rgb(var(--ha-primary-hover)) 100%)",
  primaryShadow: "0 4px 15px rgb(var(--ha-primary) / 0.2)",
  surface: "rgb(var(--ha-card))",
  divider: "rgb(var(--ha-border-input))",
  progressInactive: "rgb(var(--ha-card-border))",
  backBtnBg: "rgb(var(--ha-card))",
  selectedBg: "var(--ha-primary-light)",
  selectedBorder: "rgb(var(--ha-primary))",
  accentBg: "var(--ha-primary-light)",
  greenBg: "var(--ha-success-light)",
  greenBorder: "rgb(var(--ha-success) / 0.2)",
  redBg: "var(--ha-danger-light)",
  redBorder: "rgb(var(--ha-danger) / 0.2)",
  footerBg: "rgb(var(--ha-card))",
  footerBorder: "rgb(var(--ha-border-input))",
  backBtnBorder: "rgb(var(--ha-border-input))",
  backBtnColor: "rgb(var(--ha-text))",
  badgeBg: "var(--ha-primary-light)",
  badgeColor: "rgb(var(--ha-primary))",
  closeBtnBg: "rgb(var(--ha-hover-bg))",
  closeBtnColor: "rgb(var(--ha-text-secondary))",
  tabBg: "rgb(var(--ha-hover-bg))",
  tabActiveBg: "rgb(var(--ha-text))",
  tabActiveColor: "rgb(var(--ha-card))",
  tabInactiveColor: "rgb(var(--ha-text-secondary))",
  chipBorder: "rgb(var(--ha-border-input))",
  chipActiveColor: "rgb(var(--ha-card))",
  mapBorder: "rgb(var(--ha-border-input))",
} as const;

export function useWebsiteMode(): boolean {
  const searchString = useHashSearch();
  const params = new URLSearchParams(searchString);
  if (params.get("source") === "website" || params.get("theme") === "light") return true;
  try {
    const loc = new URLSearchParams(window.location.search);
    if (loc.get("source") === "website" || loc.get("theme") === "light") return true;
  } catch {}
  return false;
}

export function usePopupMode(): boolean {
  const searchString = useHashSearch();
  const params = new URLSearchParams(searchString);
  if (params.get("popup") === "1") return true;
  try {
    const loc = new URLSearchParams(window.location.search);
    if (loc.get("popup") === "1") return true;
  } catch {}
  return false;
}

export function closeOnboarding(isPopup: boolean, navigate: (to: string) => void) {
  if (isPopup) {
    try { window.close(); } catch {}
    navigate("/");
  } else {
    navigate("/");
  }
}

export function getWebsiteParams(searchString: string): string {
  const params = new URLSearchParams(searchString);
  const parts: string[] = [];
  if (params.get("source")) parts.push(`source=${encodeURIComponent(params.get("source")!)}`);
  if (params.get("theme")) parts.push(`theme=${encodeURIComponent(params.get("theme")!)}`);
  if (params.get("popup")) parts.push(`popup=${encodeURIComponent(params.get("popup")!)}`);
  return parts.join("&");
}

export function appendWebsiteParams(url: string, searchString: string): string {
  const extra = getWebsiteParams(searchString);
  if (!extra) return url;
  return url + (url.includes("?") ? "&" : "?") + extra;
}

export function OBProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-1.5 justify-center py-3" data-testid="progress-dots">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="h-[6px] rounded-full transition-all"
          style={{
            width: i === current ? 24 : 6,
            backgroundColor: i <= current ? OB.primary : OB.progressInactive,
          }}
        />
      ))}
    </div>
  );
}

import { ChevronLeft, Loader2, X, Info } from "lucide-react";
import { HousAlertLogo } from "@/components/housalert-logo";

export function OBWebHeader({ step, totalSteps = 3, onClose }: { step?: number; totalSteps?: number; onClose?: () => void }) {
  const progress = step && totalSteps ? (step / totalSteps) * 100 : 0;
  return (
    <div
      className="w-full sticky top-0 z-20"
      style={{ backgroundColor: OBW.headerBg, borderBottom: `1px solid ${OBW.headerBorder}` }}
    >
      <div className="max-w-[480px] mx-auto px-5 h-[52px] flex items-center justify-between">
        <HousAlertLogo size={26} />
        <div className="flex items-center gap-2">
          {step ? (
            <span
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full tabular-nums"
              style={{ backgroundColor: "#171429", color: "rgb(var(--ha-primary))" }}
              data-testid="badge-step"
            >
              {step}/{totalSteps}
            </span>
          ) : null}
          {onClose && (
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-ha-surface hover:bg-ha-card-border transition-colors"
              data-testid="button-close"
            >
              <X className="w-[18px] h-[18px] text-ha-text-secondary" />
            </button>
          )}
        </div>
      </div>
      {onClose && step ? (
        <div className="h-[4px] overflow-hidden" style={{ backgroundColor: "rgb(var(--ha-card-border))" }}>
          <div
            className="h-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%`, backgroundColor: "rgb(var(--ha-primary))" }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function OBWebFooter({
  onBack,
  onNext,
  nextLabel,
  nextDisabled,
  saving,
  matchCount = 121,
  backTestId,
  nextTestId,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel: string;
  nextDisabled?: boolean;
  saving?: boolean;
  matchCount?: number;
  backTestId?: string;
  nextTestId?: string;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30"
      style={{ borderTop: `1px solid ${OBW.footerBorder}`, backgroundColor: OBW.footerBg }}
    >
      <div className="max-w-[480px] mx-auto px-5 py-2.5 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.06em]" style={{ color: OBW.textMuted }}>
            {t("onboardingUI.estimatedMatches")}
          </p>
          <p className="text-[16px] font-semibold flex items-center gap-1" style={{ color: OBW.text }}>
            {matchCount} {t("onboardingUI.perWeek")} <span className="text-[13px]">🔥</span>
          </p>
        </div>
        {onBack && (
          <button
            onClick={onBack}
            className="w-[44px] h-[44px] rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-transform"
            style={{ border: `1.5px solid ${OBW.backBtnBorder}`, backgroundColor: "transparent" }}
            data-testid={backTestId || "button-back"}
          >
            <ChevronLeft className="w-[17px] h-[17px]" style={{ color: OBW.backBtnColor }} />
          </button>
        )}
        <button
          onClick={onNext}
          disabled={nextDisabled || saving}
          className="min-w-[120px] px-6 h-[44px] rounded-full text-[14px] font-semibold transition-all active:scale-[0.97] disabled:opacity-40 flex items-center justify-center gap-1.5 shrink-0"
          style={{ background: OBW.primary, color: "#223546", boxShadow: nextDisabled ? "none" : "0 4px 14px rgb(var(--ha-primary) / 0.2)" }}
          data-testid={nextTestId || "button-next"}
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {nextLabel}
        </button>
      </div>
    </div>
  );
}

export function OBInfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-[4px] p-3.5 flex items-start gap-2.5"
      style={{ backgroundColor: "var(--ha-primary-light)", border: `1px solid rgb(var(--ha-primary) / 0.15)` }}
    >
      <Info className="w-[15px] h-[15px] shrink-0 mt-[1px]" style={{ color: "rgb(var(--ha-primary))" }} />
      <div className="text-[15px] leading-[1.55]" style={{ color: "rgb(var(--ha-text-secondary))" }}>
        {children}
      </div>
    </div>
  );
}

export function OBStickyBar({ children, websiteMode }: { children: React.ReactNode; websiteMode?: boolean }) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 border-t backdrop-blur-xl"
      style={{
        backgroundColor: websiteMode ? OBW.footerBg : OB.headerBg,
        borderColor: websiteMode ? OBW.footerBorder : OB.headerBorder,
        paddingBottom: websiteMode ? "12px" : "max(12px, env(safe-area-inset-bottom, 12px))",
      }}
    >
      <div className="max-w-[480px] mx-auto px-5 pt-3">
        {children}
      </div>
    </div>
  );
}

export function OBFooter({
  onBack,
  onNext,
  nextLabel,
  nextDisabled,
  saving,
  topContent,
  backTestId,
  nextTestId,
  websiteMode,
}: {
  onBack: () => void;
  onNext: () => void;
  nextLabel: string;
  nextDisabled?: boolean;
  saving?: boolean;
  topContent?: React.ReactNode;
  backTestId?: string;
  nextTestId?: string;
  websiteMode?: boolean;
}) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30"
      style={{
        borderTop: `1px solid ${OBW.footerBorder}`,
        backgroundColor: OBW.footerBg,
        paddingBottom: "max(8px, env(safe-area-inset-bottom, 8px))",
      }}
    >
      <div className="max-w-[480px] mx-auto px-5 pt-3">
        {topContent && <div className="mb-2.5">{topContent}</div>}
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-[56px] h-[56px] rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-transform"
            style={{
              border: `1.5px solid ${OBW.backBtnBorder}`,
              backgroundColor: OBW.backBtnBg,
            }}
            data-testid={backTestId || "button-back"}
          >
            <ChevronLeft className="w-[18px] h-[18px]" style={{ color: OBW.backBtnColor }} />
          </button>
          <button
            onClick={onNext}
            disabled={nextDisabled || saving}
            className="flex-1 ha-btn font-semibold disabled:opacity-40"
            style={{ background: OB.primary, color: "#223546", boxShadow: "0 8px 20px rgb(var(--ha-primary) / 0.2)" }}
            data-testid={nextTestId || "button-next"}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            {nextLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
