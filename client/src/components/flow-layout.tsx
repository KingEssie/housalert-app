import { X, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { useTranslation } from "@/i18n";

interface FlowLayoutProps {
  flowTitle: string;
  currentStep: number;
  totalSteps: number;
  stepTitle: string;
  stepDescription: string;
  stepIcon: React.ReactNode;
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
    <div className="fixed inset-0 z-50 bg-white flex flex-col" data-testid="flow-layout">
      <div className="bg-white">
        <div className="flex items-center justify-between px-5 h-[60px]">
          <div className="flex-1 min-w-0">
            <p className="text-[17px] font-semibold text-[#111111] truncate" data-testid="text-flow-title">{flowTitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[15px] font-semibold text-[#111111] whitespace-nowrap" data-testid="text-flow-progress">
              {currentStep + 1}/{totalSteps}
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
        <div className="h-[5px] bg-[#F0F0F0] mx-5 rounded-full overflow-hidden">
          <div
            className="h-full bg-ha-primary rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
            data-testid="progress-flow-bar"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-[#FAFAFA]">
        <div className="max-w-lg mx-auto px-6 pt-10 pb-8">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-[72px] h-[72px] rounded-2xl bg-[#FDF1F6] flex items-center justify-center mb-6" data-testid="icon-flow-step">
              {stepIcon}
            </div>
            <h1 className="text-[26px] font-semibold text-[#111111] leading-tight mb-3" data-testid="text-step-title">
              {stepTitle}
            </h1>
            <p className="text-[16px] text-[#4B5563] leading-relaxed max-w-[340px]" data-testid="text-step-description">
              {stepDescription}
            </p>
          </div>

          {isCompleted && (
            <div className="flex items-center gap-2.5 justify-center mb-6 py-3.5 px-5 bg-[#F0FDF4] border border-[#BBF7D0] rounded-2xl" data-testid="badge-step-completed">
              <div className="w-[22px] h-[22px] rounded-full bg-[#16A34A] flex items-center justify-center">
                <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
              </div>
              <span className="text-[15px] font-semibold text-[#16A34A]">{t("taskFlow.ui.completed")}</span>
            </div>
          )}

          {children && (
            <div data-testid="flow-step-content">
              {children}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border-t border-[#E5E7EB] px-5 py-4 pb-[max(16px,env(safe-area-inset-bottom))]">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button
            onClick={onPrev ?? undefined}
            disabled={!onPrev}
            className="h-[50px] px-5 rounded-full border border-[#E5E7EB] text-[15px] font-semibold text-[#111111] disabled:opacity-25 disabled:cursor-not-allowed hover:bg-[#F9FAFB] transition-colors flex items-center gap-1.5"
            data-testid="button-flow-prev"
          >
            <ChevronLeft className="w-4 h-4" />
            {t("taskFlow.ui.prev")}
          </button>

          <div className="flex-1" />

          {completionType === "manual" && !isCompleted && onMarkComplete && (
            <button
              onClick={onMarkComplete}
              disabled={isPending}
              className="h-[50px] px-5 rounded-full bg-[#111111] text-white text-[14px] font-semibold hover:bg-[#333333] transition-colors disabled:opacity-50 flex items-center gap-2"
              data-testid="button-flow-mark-complete"
            >
              <Check className="w-4 h-4" />
              {isPending ? "..." : t("taskFlow.ui.markComplete")}
            </button>
          )}

          <button
            onClick={onNext ?? undefined}
            disabled={!onNext}
            className="h-[50px] px-7 rounded-full bg-ha-primary text-white text-[15px] font-semibold disabled:opacity-25 disabled:cursor-not-allowed hover:brightness-95 transition-all flex items-center gap-1.5"
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
