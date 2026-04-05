import { useHashSearch } from "@/lib/hash-search";

export const ONBOARDING_TOTAL_STEPS = 3;

export const OB = {
  gradient: "linear-gradient(180deg, #111111 0%, #0a0a0a 100%)",
  headerBg: "rgba(17,17,17,0.95)",
  headerBorder: "rgba(255,255,255,0.08)",
  card: "rgba(255,255,255,0.06)",
  cardBorder: "rgba(255,255,255,0.10)",
  inputBg: "rgba(255,255,255,0.08)",
  inputBorder: "rgba(255,255,255,0.12)",
  text: "#ffffff",
  textSecondary: "rgba(255,255,255,0.7)",
  textMuted: "rgba(255,255,255,0.45)",
  pink: "rgb(var(--ha-primary))",
  pinkHover: "rgb(var(--ha-primary-hover))",
  pinkGradient: "linear-gradient(135deg, rgb(var(--ha-primary)) 0%, #D70466 100%)",
  pinkShadow: "0 4px 15px rgba(255,56,92,0.3)",
  surface: "rgba(255,255,255,0.05)",
  divider: "rgba(255,255,255,0.08)",
  progressInactive: "rgba(255,255,255,0.15)",
  backBtnBg: "rgba(255,255,255,0.1)",
  selectedBg: "rgba(255,56,92,0.12)",
  selectedBorder: "rgb(var(--ha-primary))",
  accentBg: "rgba(255,56,92,0.08)",
  greenBg: "rgb(var(--ha-success) / 0.12)",
  greenBorder: "rgb(var(--ha-success) / 0.25)",
  redBg: "rgba(220,38,38,0.12)",
  redBorder: "rgba(220,38,38,0.25)",
} as const;

export const OBW = {
  gradient: "#ffffff",
  headerBg: "#ffffff",
  headerBorder: "#E5E7EB",
  card: "#F7F7F7",
  cardBorder: "#E5E7EB",
  inputBg: "#ffffff",
  inputBorder: "#E5E7EB",
  text: "#111111",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",
  pink: "rgb(var(--ha-primary))",
  pinkHover: "rgb(var(--ha-primary-hover))",
  pinkGradient: "linear-gradient(135deg, rgb(var(--ha-primary)) 0%, #D70466 100%)",
  pinkShadow: "0 4px 15px rgba(255,56,92,0.3)",
  surface: "#F7F7F7",
  divider: "#E5E7EB",
  progressInactive: "#E5E7EB",
  backBtnBg: "#F7F7F7",
  selectedBg: "rgba(255,56,92,0.08)",
  selectedBorder: "rgb(var(--ha-primary))",
  accentBg: "rgba(255,56,92,0.06)",
  greenBg: "rgb(var(--ha-success) / 0.08)",
  greenBorder: "rgb(var(--ha-success) / 0.2)",
  redBg: "rgba(220,38,38,0.08)",
  redBorder: "rgba(220,38,38,0.2)",
  footerBg: "#ffffff",
  footerBorder: "#E5E7EB",
  backBtnBorder: "#E5E7EB",
  backBtnColor: "#111111",
  badgeBg: "rgba(255,56,92,0.08)",
  badgeColor: "rgb(var(--ha-primary))",
  closeBtnBg: "#F7F7F7",
  closeBtnColor: "#6B7280",
  tabBg: "#F7F7F7",
  tabActiveBg: "#E5E7EB",
  tabActiveColor: "#111111",
  tabInactiveColor: "#6B7280",
  chipBorder: "#E5E7EB",
  chipActiveColor: "#ffffff",
  mapBorder: "#E5E7EB",
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

export function getWebsiteParams(searchString: string): string {
  const params = new URLSearchParams(searchString);
  const parts: string[] = [];
  if (params.get("source")) parts.push(`source=${encodeURIComponent(params.get("source")!)}`);
  if (params.get("theme")) parts.push(`theme=${encodeURIComponent(params.get("theme")!)}`);
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
            backgroundColor: i <= current ? OB.pink : OB.progressInactive,
          }}
        />
      ))}
    </div>
  );
}

import { ChevronLeft, Loader2, X, Info } from "lucide-react";
import { HousAlertLogo } from "@/components/housalert-logo";

export function OBWebHeader({ step, totalSteps = 3 }: { step?: number; totalSteps?: number; onClose?: () => void }) {
  return (
    <header
      className="w-full sticky top-0 z-20"
      style={{ backgroundColor: OBW.headerBg, borderBottom: `1px solid ${OBW.headerBorder}` }}
    >
      <div className="max-w-[480px] mx-auto px-5 h-[52px] flex items-center justify-between">
        <HousAlertLogo size={26} />
        {step ? (
          <span
            className="text-[11px] font-bold px-2.5 py-1 rounded-[4px]"
            style={{ backgroundColor: "rgb(var(--ha-primary))", color: "#ffffff" }}
            data-testid="badge-step"
          >
            {step}/{totalSteps}
          </span>
        ) : (
          <div className="w-[30px]" />
        )}
      </div>
    </header>
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
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30"
      style={{ borderTop: `1px solid ${OBW.footerBorder}`, backgroundColor: OBW.footerBg }}
    >
      <div className="max-w-[480px] mx-auto px-5 py-2.5 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.06em]" style={{ color: OBW.textMuted }}>
            Geschatte matches
          </p>
          <p className="text-[16px] font-bold flex items-center gap-1" style={{ color: OBW.text }}>
            {matchCount} per week <span className="text-[13px]">🔥</span>
          </p>
        </div>
        {onBack && (
          <button
            onClick={onBack}
            className="w-[44px] h-[44px] rounded-[4px] flex items-center justify-center shrink-0 active:scale-95 transition-transform"
            style={{ border: `1.5px solid ${OBW.pink}`, backgroundColor: "transparent" }}
            data-testid={backTestId || "button-back"}
          >
            <ChevronLeft className="w-[17px] h-[17px]" style={{ color: OBW.pink }} />
          </button>
        )}
        <button
          onClick={onNext}
          disabled={nextDisabled || saving}
          className="min-w-[120px] px-6 h-[44px] rounded-[4px] text-[14px] font-bold text-white transition-all active:scale-[0.97] disabled:opacity-40 flex items-center justify-center gap-1.5 shrink-0"
          style={{ background: OBW.pink, boxShadow: nextDisabled ? "none" : "0 4px 14px rgba(255,56,92,0.25)" }}
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
      style={{ backgroundColor: "#F7F7F7", border: "1px solid #E5E7EB" }}
    >
      <Info className="w-[15px] h-[15px] shrink-0 mt-[1px]" style={{ color: "rgb(var(--ha-primary))" }} />
      <div className="text-[13px] leading-[1.55]" style={{ color: "rgb(var(--ha-primary))" }}>
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
  const w = websiteMode;
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30"
      style={{
        borderTop: `1px solid ${w ? OBW.footerBorder : "rgba(255,255,255,0.08)"}`,
        backgroundColor: w ? OBW.footerBg : "rgba(10,10,30,0.4)",
        backdropFilter: w ? undefined : "blur(10px)",
        WebkitBackdropFilter: w ? undefined : "blur(10px)",
        paddingBottom: "max(8px, env(safe-area-inset-bottom, 8px))",
      }}
    >
      <div className="max-w-[480px] mx-auto px-5 pt-3">
        {topContent && <div className="mb-2.5">{topContent}</div>}
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-[56px] h-[56px] rounded-[6px] flex items-center justify-center shrink-0 active:scale-95 transition-transform"
            style={{
              border: `1.5px solid ${w ? OBW.backBtnBorder : "rgba(255,255,255,0.25)"}`,
              backgroundColor: w ? OBW.backBtnBg : "transparent",
            }}
            data-testid={backTestId || "button-back"}
          >
            <ChevronLeft className="w-[18px] h-[18px]" style={{ color: w ? OBW.backBtnColor : "#ffffff" }} />
          </button>
          <button
            onClick={onNext}
            disabled={nextDisabled || saving}
            className="flex-1 ha-btn text-white font-bold disabled:opacity-40"
            style={{ background: OB.pink, boxShadow: "0 8px 20px rgba(255,56,92,0.25)" }}
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
