import type { LucideIcon } from "lucide-react";

interface HighlightCardProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  overline?: string;
  ctaLabel?: string;
  onClick?: () => void;
  testId?: string;
  bgColor?: string;
  layout?: "centered" | "horizontal";
  inverted?: boolean;
}

export function HighlightCard({ icon: Icon, title, subtitle, overline, ctaLabel, onClick, testId, bgColor, layout = "centered", inverted = false }: HighlightCardProps) {
  const bg = bgColor ?? "rgb(var(--ha-highlight))";

  if (layout === "horizontal") {
    return (
      <button
        onClick={onClick}
        className="w-full rounded-[12px] p-4 text-left transition-colors"
        style={{
          backgroundColor: bg,
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          border: inverted ? "none" : "1px solid rgb(var(--ha-card-border))",
        }}
        data-testid={testId}
      >
        <div className="flex items-center gap-3 mb-2">
          {inverted ? (
            <div className="w-[44px] h-[44px] rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#85fb8c" }}>
              <Icon className="w-[22px] h-[22px] text-[#111111]" strokeWidth={1.6} />
            </div>
          ) : (
            <Icon className="w-[26px] h-[26px] shrink-0 text-ha-text" strokeWidth={1.6} />
          )}
          <p className={`text-[17px] font-semibold leading-snug ${inverted ? "text-[#85fb8c]" : "text-ha-text"}`}>
            {title}
          </p>
        </div>
        {subtitle && (
          <p className={`text-[14px] leading-relaxed mb-3 ${inverted ? "text-white/80" : "text-ha-text-secondary"}`}>
            {subtitle}
          </p>
        )}
        {ctaLabel && (
          <span
            className={`flex w-full h-[48px] rounded-full text-[14px] font-semibold items-center justify-center transition-colors ${
              inverted
                ? "text-[#111111]"
                : "bg-ha-primary-hover text-white"
            }`}
            style={inverted ? { backgroundColor: "#85fb8c" } : {}}
          >
            {ctaLabel}
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="w-full rounded-[12px] p-4 text-center transition-colors"
      style={{
        backgroundColor: bg,
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        border: "1px solid rgb(var(--ha-card-border))",
      }}
      data-testid={testId}
    >
      <div className="flex flex-col items-center">
        <Icon className="w-[28px] h-[28px] text-ha-text mb-2" strokeWidth={1.6} />
        {overline && (
          <p className="text-[13px] font-semibold text-ha-text-secondary mb-1">{overline}</p>
        )}
        <p className="text-[17px] font-semibold text-ha-text leading-snug">{title}</p>
        {subtitle && (
          <p className="text-[15px] text-ha-text-secondary mt-1.5 leading-relaxed max-w-[280px]">{subtitle}</p>
        )}
      </div>
      {ctaLabel && (
        <div className="mt-3 flex justify-center">
          <span className="inline-flex h-[44px] px-7 rounded-full bg-white text-ha-text text-[14px] font-semibold items-center transition-colors" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
            {ctaLabel}
          </span>
        </div>
      )}
    </button>
  );
}
