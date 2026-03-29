import { useHashSearch } from "@/lib/hash-search";

export const ONBOARDING_TOTAL_STEPS = 3;

export const OB = {
  gradient: "linear-gradient(180deg, #1e1b4b 0%, #0f0e2a 100%)",
  headerBg: "rgba(30,27,75,0.95)",
  headerBorder: "rgba(255,255,255,0.08)",
  card: "rgba(255,255,255,0.06)",
  cardBorder: "rgba(255,255,255,0.10)",
  inputBg: "rgba(255,255,255,0.08)",
  inputBorder: "rgba(255,255,255,0.12)",
  text: "#ffffff",
  textSecondary: "rgba(255,255,255,0.7)",
  textMuted: "rgba(255,255,255,0.45)",
  pink: "#e91e63",
  pinkHover: "#d81b60",
  pinkGradient: "linear-gradient(135deg, #e91e63 0%, #ec407a 100%)",
  pinkShadow: "0 4px 15px rgba(233,30,99,0.3)",
  surface: "rgba(255,255,255,0.05)",
  divider: "rgba(255,255,255,0.08)",
  progressInactive: "rgba(255,255,255,0.15)",
  backBtnBg: "rgba(255,255,255,0.1)",
  selectedBg: "rgba(233,30,99,0.12)",
  selectedBorder: "#e91e63",
  accentBg: "rgba(233,30,99,0.08)",
  greenBg: "rgba(34,197,94,0.12)",
  greenBorder: "rgba(34,197,94,0.25)",
  redBg: "rgba(239,68,68,0.12)",
  redBorder: "rgba(239,68,68,0.25)",
} as const;

export const OBW = {
  gradient: "#ffffff",
  headerBg: "#ffffff",
  headerBorder: "#e5e7eb",
  card: "#f9fafb",
  cardBorder: "#e5e7eb",
  inputBg: "#f3f4f6",
  inputBorder: "#d1d5db",
  text: "#111827",
  textSecondary: "#6b7280",
  textMuted: "#9ca3af",
  pink: "#e91e63",
  pinkHover: "#d81b60",
  pinkGradient: "linear-gradient(135deg, #e91e63 0%, #ec407a 100%)",
  pinkShadow: "0 4px 15px rgba(233,30,99,0.3)",
  surface: "#f9fafb",
  divider: "#e5e7eb",
  progressInactive: "#d1d5db",
  backBtnBg: "#f3f4f6",
  selectedBg: "rgba(233,30,99,0.08)",
  selectedBorder: "#e91e63",
  accentBg: "rgba(233,30,99,0.06)",
  greenBg: "rgba(34,197,94,0.08)",
  greenBorder: "rgba(34,197,94,0.2)",
  redBg: "rgba(239,68,68,0.08)",
  redBorder: "rgba(239,68,68,0.2)",
  footerBg: "#ffffff",
  footerBorder: "#e5e7eb",
  backBtnBorder: "#d1d5db",
  backBtnColor: "#374151",
  badgeBg: "rgba(233,30,99,0.08)",
  badgeColor: "#e91e63",
  closeBtnBg: "#f3f4f6",
  closeBtnColor: "#6b7280",
  tabBg: "#f3f4f6",
  tabActiveBg: "#e5e7eb",
  tabActiveColor: "#111827",
  tabInactiveColor: "#6b7280",
  chipBorder: "#d1d5db",
  chipActiveColor: "#ffffff",
  mapBorder: "#e5e7eb",
} as const;

export function useWebsiteMode(): boolean {
  const searchString = useHashSearch();
  const params = new URLSearchParams(searchString);
  return params.get("source") === "website" || params.get("theme") === "light";
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

import { ChevronLeft, Loader2 } from "lucide-react";

export function OBStickyBar({ children, websiteMode }: { children: React.ReactNode; websiteMode?: boolean }) {
  const t = websiteMode ? OBW : OB;
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 border-t backdrop-blur-xl"
      style={{
        backgroundColor: t.footerBg || t.headerBg,
        borderColor: t.footerBorder || t.headerBorder,
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
            style={{ background: OB.pinkGradient, boxShadow: "0 8px 20px rgba(255,0,100,0.25)" }}
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
