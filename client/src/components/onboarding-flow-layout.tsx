import { X, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useTranslation } from "@/i18n";

interface OnboardingFlowLayoutProps {
  flowTitle: string;
  currentStep: number;
  totalSteps: number;
  showStepBadge?: boolean;
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
  showStepBadge = true,
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
  const { t } = useTranslation();
  const progress = totalSteps > 0 ? ((currentStep) / totalSteps) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 bg-ha-bg flex flex-col" data-testid={screenTestId || "onboarding-flow-layout"}>
      <div className="bg-white" style={{ paddingTop: "max(0px, env(safe-area-inset-top))" }}>
        <div className="flex items-center justify-between px-5 h-[64px]">
          <div className="flex-1 min-w-0">
            <p className="text-[17px] font-semibold text-ha-text truncate" data-testid="text-ob-flow-title">{flowTitle}</p>
          </div>
          <div className="flex items-center gap-3">
            {showStepBadge && (
              <span
                className="text-[12px] font-bold px-2.5 py-1 rounded-full tabular-nums whitespace-nowrap"
                style={{ backgroundColor: "#171429", color: "rgb(var(--ha-primary))" }}
                data-testid="text-ob-flow-progress"
              >
                {currentStep}/{totalSteps}
              </span>
            )}
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-ha-surface hover:bg-ha-card-border transition-colors"
              data-testid={closeTestId || "button-ob-flow-close"}
            >
              <X className="w-[18px] h-[18px] text-ha-text" strokeWidth={2.5} />
            </button>
          </div>
        </div>
        <div className="h-[6px] bg-ha-card-border mx-5 rounded-full overflow-hidden">
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
                <h1 className="text-[22px] font-bold text-ha-text leading-tight mb-3" data-testid="text-ob-step-title">
                  {stepTitle}
                </h1>
                {stepDescription && (
                  <p className="text-[15px] text-ha-text-secondary leading-relaxed" data-testid="text-ob-step-description">
                    {stepDescription}
                  </p>
                )}
              </div>
              {children}
            </div>
          ) : (
            <div className="bg-white rounded-2xl px-6 py-7">
              <div className="text-left mb-6">
                <h1 className="text-[22px] font-bold text-ha-text leading-tight mb-3" data-testid="text-ob-step-title">
                  {stepTitle}
                </h1>
                {stepDescription && (
                  <p className="text-[15px] text-ha-text-secondary leading-relaxed" data-testid="text-ob-step-description">
                    {stepDescription}
                  </p>
                )}
              </div>
              {children}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border-t border-ha-card-border">
        {footerExtra && (
          <div className="max-w-lg mx-auto px-5 pt-4">
            {footerExtra}
          </div>
        )}
        <div className="max-w-lg mx-auto px-5 py-4 pb-[max(16px,env(safe-area-inset-bottom))] flex items-center justify-between gap-3">
          {onBack ? (
            <button
              onClick={onBack}
              className="h-[48px] px-6 rounded-full border border-ha-card-border text-[15px] font-semibold text-ha-text hover:bg-ha-surface active:scale-[0.97] transition-all flex items-center gap-1.5"
              data-testid={backTestId || "button-ob-flow-prev"}
            >
              <ChevronLeft className="w-4 h-4" />
              {backLabel || t("common.back")}
            </button>
          ) : (
            <div />
          )}

          <button
            onClick={onNext}
            disabled={nextDisabled || saving}
            className="h-[48px] px-8 rounded-full bg-ha-primary text-[15px] font-semibold disabled:opacity-20 disabled:cursor-not-allowed hover:brightness-95 active:scale-[0.97] transition-all flex items-center gap-1.5 shadow-[0_2px_8px_rgba(133,251,140,0.30)]"
            style={{ color: "#223546" }}
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
