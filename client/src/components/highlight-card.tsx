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
}

export function HighlightCard({ icon: Icon, title, subtitle, overline, ctaLabel, onClick, testId, bgColor }: HighlightCardProps) {
  const bg = bgColor ?? "#F5F0EB";

  return (
    <button
      onClick={onClick}
      className="w-full rounded-[16px] p-4 text-center transition-colors"
      style={{
        backgroundColor: bg,
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        border: "1px solid #E5E7EB",
      }}
      data-testid={testId}
    >
      <div className="flex flex-col items-center">
        <Icon className="w-[28px] h-[28px] text-[#111111] mb-2" strokeWidth={1.6} />
        {overline && (
          <p className="text-[13px] font-semibold text-[#334855] mb-1">{overline}</p>
        )}
        <p className="text-[17px] font-semibold text-[#111111] leading-snug">{title}</p>
        {subtitle && (
          <p className="text-[15px] text-[#334855] mt-1.5 leading-relaxed max-w-[280px]">{subtitle}</p>
        )}
      </div>
      {ctaLabel && (
        <div className="mt-3 flex justify-center">
          <span className="inline-flex h-[44px] px-7 rounded-full bg-white text-[#111111] text-[14px] font-semibold items-center transition-colors" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
            {ctaLabel}
          </span>
        </div>
      )}
    </button>
  );
}
