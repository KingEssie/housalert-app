import { type ReactNode } from "react";
import { Loader2 } from "lucide-react";

interface V2BottomCTAProps {
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  backLabel?: string;
  onBack?: () => void;
  children?: ReactNode;
}

const BRAND = "rgb(var(--ha-primary))";

export function V2BottomCTA({
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  primaryLoading = false,
  secondaryLabel,
  onSecondary,
  backLabel,
  onBack,
  children,
}: V2BottomCTAProps) {
  return (
    <div className="sticky bottom-0 z-30 bg-[#111111]/95 backdrop-blur-sm border-t border-white/10">
      <div className="max-w-lg mx-auto px-5 py-4 flex flex-col gap-2.5 pb-[max(env(safe-area-inset-bottom),16px)]">
        {children}

        <button
          onClick={onPrimary}
          disabled={primaryDisabled || primaryLoading}
          className="w-full h-[56px] rounded-[6px] text-[16px] font-bold text-white transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_14px_rgba(233,30,99,0.3)]"
          style={{ backgroundColor: BRAND }}
          data-testid="button-v2-primary-cta"
        >
          {primaryLoading ? (
            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          ) : (
            primaryLabel
          )}
        </button>

        {secondaryLabel && onSecondary && (
          <button
            onClick={onSecondary}
            className="w-full h-[56px] rounded-[6px] text-[14px] font-semibold text-white border border-white/20 bg-transparent hover:bg-white/5 transition-colors active:scale-[0.97]"
            data-testid="button-v2-secondary-cta"
          >
            {secondaryLabel}
          </button>
        )}

        {backLabel && onBack && (
          <button
            onClick={onBack}
            className="text-[13px] font-medium text-white/50 hover:text-white/70 transition-colors text-center py-1"
            data-testid="button-v2-back-cta"
          >
            {backLabel}
          </button>
        )}
      </div>
    </div>
  );
}
