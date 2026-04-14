import { X, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

interface OnboardingFlowLayoutProps {
  flowTitle: string;
  currentStep: number;
  totalSteps: number;
  stepTitle: string;
  stepDescription?: string;
  onBack?: (() => void) | null;
  onNext: () => void;
  onClose: () => void;
  nextLabel: string;
  backLabel?: string;
  nextDisabled?: boolean;
  saving?: boolean;
  children?: React.ReactNode;
  footerExtra?: React.ReactNode;
  hideCard?: boolean;
  backTestId?: string;
  nextTestId?: string;
  closeTestId?: string;
  screenTestId?: string;
}

export function OnboardingFlowLayout({
  flowTitle,
  currentStep,
  totalSteps,
  stepTitle,
  stepDescription,
  onBack,
  onNext,
  onClose,
  nextLabel,
  backLabel,
  nextDisabled,
  saving,
  children,
  footerExtra,
  hideCard,
  backTestId,
  nextTestId,
  closeTestId,
  screenTestId,
}: OnboardingFlowLayoutProps) {
  const progress = totalSteps > 0 ? ((currentStep) / totalSteps) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 bg-[#eaeaeb] flex flex-col" data-testid={screenTestId || "onboarding-flow-layout"}>
      <div className="bg-white" style={{ paddingTop: "max(0px, env(safe-area-inset-top))" }}>
        <div className="flex items-center justify-between px-5 h-[64px]">
          <div className="flex-1 min-w-0">
            <p className="text-[17px] font-semibold text-[#111111] truncate" data-testid="text-ob-flow-title">{flowTitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[16px] font-bold text-[#111111] tabular-nums whitespace-nowrap" data-testid="text-ob-flow-progress">
              {currentStep}<span className="text-[#C4C4C4] font-semibold">/{totalSteps}</span>
            </span>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-[#F4F4F5] hover:bg-[#E5E7EB] transition-colors"
              data-testid={closeTestId || "button-ob-flow-close"}
            >
              <X className="w-[18px] h-[18px] text-[#111111]" strokeWidth={2.5} />
            </button>
          </div>
        </div>
        <div className="h-[6px] bg-[#F0F0F0] mx-5 rounded-full overflow-hidden">
          <div
            className="h-full bg-ha-primary rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
            data-testid="progress-ob-flow-bar"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 pt-6 pb-8">
          {hideCard ? (
            <div>
              <div className="text-left mb-6">
                <h1 className="text-[22px] font-bold text-[#111111] leading-tight mb-3" data-testid="text-ob-step-title">
                  <span className="text-ha-primary mr-1.5">{currentStep}</span>
                  {stepTitle}
                </h1>
                {stepDescription && (
                  <p className="text-[15px] text-[#334855] leading-relaxed" data-testid="text-ob-step-description">
                    {stepDescription}
                  </p>
                )}
              </div>
              {children}
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.06)] px-6 py-7">
              <div className="text-left mb-6">
                <h1 className="text-[22px] font-bold text-[#111111] leading-tight mb-3" data-testid="text-ob-step-title">
                  <span className="text-ha-primary mr-1.5">{currentStep}</span>
                  {stepTitle}
                </h1>
                {stepDescription && (
                  <p className="text-[15px] text-[#334855] leading-relaxed" data-testid="text-ob-step-description">
                    {stepDescription}
                  </p>
                )}
              </div>
              {children}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border-t border-[#E5E7EB]">
        {footerExtra && (
          <div className="max-w-lg mx-auto px-5 pt-4">
            {footerExtra}
          </div>
        )}
        <div className="max-w-lg mx-auto px-5 py-4 pb-[max(16px,env(safe-area-inset-bottom))] flex items-center justify-between gap-3">
          {onBack ? (
            <button
              onClick={onBack}
              className="h-[48px] px-6 rounded-full border border-[#E5E7EB] text-[15px] font-semibold text-[#111111] hover:bg-[#F9FAFB] active:scale-[0.97] transition-all flex items-center gap-1.5"
              data-testid={backTestId || "button-ob-flow-prev"}
            >
              <ChevronLeft className="w-4 h-4" />
              {backLabel || "Terug"}
            </button>
          ) : (
            <div />
          )}

          <button
            onClick={onNext}
            disabled={nextDisabled || saving}
            className="h-[48px] px-8 rounded-full bg-ha-primary text-white text-[15px] font-semibold disabled:opacity-20 disabled:cursor-not-allowed hover:brightness-95 active:scale-[0.97] transition-all flex items-center gap-1.5 shadow-[0_2px_8px_rgba(217,26,104,0.18)]"
            data-testid={nextTestId || "button-ob-flow-next"}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {nextLabel}
            {!saving && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
