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
}

export function EmptyState({ illustration, title, description, ctaLabel, onCtaClick, testId }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center min-h-[calc(100dvh-260px)] px-6" data-testid={testId}>
      <img
        src={illustration}
        alt=""
        className="w-[72px] max-h-[72px] h-auto mb-5 object-contain"
        draggable={false}
      />
      <h2 className="text-[20px] font-bold text-[#000000] leading-snug mb-2" data-testid="text-empty-title">
        {title}
      </h2>
      <p className="text-[16px] text-[#334855] leading-relaxed max-w-[280px] mb-8" data-testid="text-empty-description">
        {description}
      </p>
      {ctaLabel && onCtaClick && (
        <button
          onClick={onCtaClick}
          className="h-[48px] px-8 rounded-[12px] bg-ha-primary hover:bg-ha-primary-hover text-white text-[16px] font-semibold transition-colors active:scale-[0.97]"
          data-testid="button-empty-cta"
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
