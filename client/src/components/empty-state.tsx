import noMatchesImg from "@assets/7C66CAE0-9FEC-4D54-BEC9-F057AC871640_1772873830485.png";
import noSavedImg from "@assets/CA6F3392-145F-4FE0-B07C-8EB23BCB72F4_1772873830485.png";
import noApplicationsImg from "@assets/FB1DBCD2-ED1C-43B9-B2B6-37609353C92A_1772873830485.png";
import noFiltersImg from "@assets/68671DBF-0C5D-446A-80D3-DAAD6B9A93BB_1772873830485.png";

export const EMPTY_STATE_IMAGES = {
  noMatches: noMatchesImg,
  noSaved: noSavedImg,
  noApplications: noApplicationsImg,
  noFilters: noFiltersImg,
} as const;

interface EmptyStateProps {
  illustration: string;
  title: string;
  description: string;
  ctaLabel: string;
  onCtaClick: () => void;
  testId?: string;
}

export function EmptyState({ illustration, title, description, ctaLabel, onCtaClick, testId }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center text-center pt-10" data-testid={testId}>
      <img
        src={illustration}
        alt=""
        className="w-[240px] h-auto mb-6"
        draggable={false}
      />
      <h2 className="text-[20px] font-bold text-[#111C3D] leading-snug mb-2" data-testid="text-empty-title">
        {title}
      </h2>
      <p className="text-[14px] text-[#1F2937] leading-relaxed max-w-[280px] mb-6" data-testid="text-empty-description">
        {description}
      </p>
      <button
        onClick={onCtaClick}
        className="h-[48px] px-8 rounded-full bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white text-[15px] font-semibold transition-colors"
        data-testid="button-empty-cta"
      >
        {ctaLabel}
      </button>
    </div>
  );
}
