import type { LucideIcon } from "lucide-react";

interface HighlightCardProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  overline?: string;
  ctaLabel?: string;
  onClick?: () => void;
  testId?: string;
}

export function HighlightCard({ icon: Icon, title, subtitle, overline, ctaLabel, onClick, testId }: HighlightCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-[16px] bg-[#F5F0EB] p-6 text-center active:bg-[#EDE7E1] transition-colors"
      data-testid={testId}
    >
      <div className="flex flex-col items-center">
        <Icon className="w-[32px] h-[32px] text-[#111111] mb-4" strokeWidth={1.6} />
        {overline && (
          <p className="text-[13px] font-semibold text-[#334855] mb-1">{overline}</p>
        )}
        <p className="text-[18px] font-semibold text-[#111111] leading-snug">{title}</p>
        {subtitle && (
          <p className="text-[15px] text-[#334855] mt-1.5 leading-relaxed max-w-[280px]">{subtitle}</p>
        )}
      </div>
      {ctaLabel && (
        <div className="mt-5">
          <span className="inline-flex h-[48px] px-8 rounded-full bg-white text-[#111111] text-[15px] font-semibold items-center hover:bg-[#F9F9F9] transition-colors">
            {ctaLabel}
          </span>
        </div>
      )}
    </button>
  );
}
