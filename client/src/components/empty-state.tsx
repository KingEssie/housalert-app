import laptopImg from "@assets/laptop_1775723516771.png";
import emailImg from "@assets/email_1775723524624.png";
import searchImg from "@assets/search_1775723541638.png";
import loveImg from "@assets/love_1775723501992.png";

export const EMPTY_STATE_IMAGES = {
  createSearch: laptopImg,
  noMatches: searchImg,
  noApplications: emailImg,
  noFavorites: loveImg,
} as const;

interface EmptyStateProps {
  illustration: string;
  title: string;
  description: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
  testId?: string;
  compact?: boolean;
}

export function EmptyState({ illustration, title, description, ctaLabel, onCtaClick, testId, compact }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center px-6 ${compact ? "py-6" : "min-h-[calc(100dvh-260px)]"}`}
      data-testid={testId}
    >
      <img
        src={illustration}
        alt=""
        className="w-[64px] max-h-[64px] h-auto mb-4 object-contain"
        draggable={false}
      />
      <h2 className="text-[18px] font-semibold text-[#111111] leading-snug mb-2" data-testid="text-empty-title">
        {title}
      </h2>
      <p className="text-[15px] text-[#6B7280] leading-relaxed max-w-[260px] mb-4" data-testid="text-empty-description">
        {description}
      </p>
      {ctaLabel && onCtaClick && (
        <button
          onClick={onCtaClick}
          className="py-[14px] px-8 rounded-[10px] bg-transparent border-2 border-ha-primary text-ha-primary text-[16px] font-semibold hover:bg-ha-primary/5 transition-colors active:scale-[0.97]"
          data-testid="button-empty-cta"
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
