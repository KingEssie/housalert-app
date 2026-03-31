import { ChevronLeft, X } from "lucide-react";

interface V2ProgressHeaderProps {
  step: number;
  totalSteps: number;
  title?: string;
  onBack?: () => void;
  onClose?: () => void;
}

export function V2ProgressHeader({
  step,
  totalSteps,
  title,
  onBack,
  onClose,
}: V2ProgressHeaderProps) {
  return (
    <header className="w-full sticky top-0 z-20 bg-[#151226]/95 backdrop-blur-sm border-b border-white/10">
      <div className="max-w-lg mx-auto px-4 h-[56px] flex items-center gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/15 transition-colors active:scale-95"
            data-testid="button-v2-back"
          >
            <ChevronLeft className="w-5 h-5 text-white/80" />
          </button>
        )}

        {title && (
          <span className="text-[14px] font-medium text-white/70 flex-1 truncate">
            {title}
          </span>
        )}

        <div className="ml-auto flex items-center gap-3">
          <span
            className="text-[13px] font-semibold text-white/50 bg-white/10 px-3 py-1 rounded-full"
            data-testid="text-v2-progress"
          >
            {step}/{totalSteps}
          </span>

          {onClose && (
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/15 transition-colors active:scale-95"
              data-testid="button-v2-close"
            >
              <X className="w-5 h-5 text-white/80" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
