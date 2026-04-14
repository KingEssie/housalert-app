import { X, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { useTranslation } from "@/i18n";

interface FlowLayoutProps {
  flowTitle: string;
  currentStep: number;
  totalSteps: number;
  stepTitle: string;
  stepDescription: string;
  stepIcon?: React.ReactNode;
  isCompleted: boolean;
  completionType: "auto" | "manual";
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  onMarkComplete: (() => void) | null;
  onClose: () => void;
  isPending?: boolean;
  children?: React.ReactNode;
}

export function FlowLayout({
  flowTitle,
  currentStep,
  totalSteps,
  stepTitle,
  stepDescription,
  stepIcon,
  isCompleted,
  completionType,
  onPrev,
  onNext,
  onMarkComplete,
  onClose,
  isPending,
  children,
}: FlowLayoutProps) {
  const { t } = useTranslation();
  const progress = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0;
  const isLastStep = currentStep === totalSteps - 1;

  return (
    <div className="fixed inset-0 z-50 bg-[#eaeaeb] flex flex-col" data-testid="flow-layout">
      <div className="bg-white">
        <div className="flex items-center justify-between px-5 h-[64px]">
          <div className="flex-1 min-w-0">
            <p className="text-[17px] font-semibold text-[#111111] truncate" data-testid="text-flow-title">{flowTitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[16px] font-bold text-[#111111] tabular-nums whitespace-nowrap" data-testid="text-flow-progress">
              {currentStep + 1}<span className="text-[#C4C4C4] font-semibold">/{totalSteps}</span>
            </span>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-[#F4F4F5] hover:bg-[#E5E7EB] transition-colors"
              data-testid="button-flow-close"
            >
              <X className="w-[18px] h-[18px] text-[#111111]" strokeWidth={2.5} />
            </button>
          </div>
        </div>
        <div className="h-[6px] bg-[#F0F0F0] mx-5 rounded-full overflow-hidden">
          <div
            className="h-full bg-ha-primary rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
            data-testid="progress-flow-bar"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 pt-6 pb-8">
          <div className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.06)] px-6 py-7">
            <div className="text-left mb-6">
              <h1 className="text-[22px] font-bold text-[#111111] leading-tight mb-3" data-testid="text-step-title">
                <span className="text-ha-primary mr-1.5">{currentStep + 1}</span>
                {stepTitle}
              </h1>
              <p className="text-[15px] text-[#334855] leading-relaxed" data-testid="text-step-description">
                {stepDescription}
              </p>
            </div>

            {children && (
              <div data-testid="flow-step-content">
                {children}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border-t border-[#E5E7EB]">
        {completionType === "manual" && onMarkComplete && (
          <div className="max-w-lg mx-auto px-5 pt-5 pb-2 flex justify-center">
            <button
              onClick={isCompleted ? undefined : onMarkComplete}
              disabled={isPending || isCompleted}
              className="flex items-center gap-2 group"
              data-testid="button-flow-mark-complete"
            >
              <div className={`w-[20px] h-[20px] rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isCompleted ? "bg-ha-primary border-ha-primary" : "border-[#D1D5DB] group-hover:border-[#334855]"}`}>
                {isCompleted && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
              </div>
              <span className={`text-[14px] font-medium transition-colors ${isCompleted ? "text-[#111111]" : "text-[#111111] group-hover:text-[#000000]"}`}>
                {isPending ? "..." : "Afgerond"}
              </span>
            </button>
          </div>
        )}
        <div className="max-w-lg mx-auto px-5 py-4 pb-[max(16px,env(safe-area-inset-bottom))] flex items-center justify-between gap-3">
          <button
            onClick={onPrev ?? undefined}
            disabled={!onPrev}
            className="h-[48px] px-6 rounded-full border border-[#E5E7EB] text-[15px] font-semibold text-[#111111] disabled:opacity-20 disabled:cursor-not-allowed hover:bg-[#F9FAFB] active:scale-[0.97] transition-all flex items-center gap-1.5"
            data-testid="button-flow-prev"
          >
            <ChevronLeft className="w-4 h-4" />
            {t("taskFlow.ui.prev")}
          </button>

          <button
            onClick={onNext ?? undefined}
            disabled={!onNext}
            className="h-[48px] px-8 rounded-full bg-ha-primary text-white text-[15px] font-semibold disabled:opacity-20 disabled:cursor-not-allowed hover:brightness-95 active:scale-[0.97] transition-all flex items-center gap-1.5 shadow-[0_2px_8px_rgba(217,26,104,0.18)]"
            data-testid="button-flow-next"
          >
            {isLastStep ? t("taskFlow.ui.finish") : t("taskFlow.ui.next")}
            {!isLastStep && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
