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

export function OBStickyBar({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 border-t backdrop-blur-xl"
      style={{
        backgroundColor: OB.headerBg,
        borderColor: OB.headerBorder,
        paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))",
      }}
    >
      <div className="max-w-[480px] mx-auto px-5 pt-3">
        {children}
      </div>
    </div>
  );
}
