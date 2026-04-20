import { useState } from "react";
import { Check, ChevronDown, ChevronRight, ClipboardList, CheckCircle2 } from "lucide-react";

export type StepType = "navigate" | "modal" | "inline";

export interface CompletionStep {
  id: string;
  label: string;
  completed: boolean;
  action: () => void;
  stepType?: StepType;
  inlineContent?: React.ReactNode;
}

interface ExpandableCompletionCardProps {
  title: string;
  icon?: React.ReactNode;
  steps: CompletionStep[];
  completedLabel: string;
  subtitleFormat?: string;
  testId: string;
  defaultExpanded?: boolean;
}

export function ExpandableCompletionCard({
  title,
  steps,
  completedLabel,
  testId,
  defaultExpanded = false,
}: ExpandableCompletionCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [expandedInline, setExpandedInline] = useState<string | null>(null);

  const doneCount = steps.filter((s) => s.completed).length;
  const totalCount = steps.length;
  const percentage = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const allDone = doneCount === totalCount;

  function handleStepClick(step: CompletionStep) {
    if (step.stepType === "inline" && step.inlineContent) {
      setExpandedInline((prev) => (prev === step.id ? null : step.id));
    } else {
      step.action();
    }
  }

  return (
    <div
      className={`rounded-[18px] bg-white border-[1.5px] overflow-hidden transition-colors duration-300 ${
        allDone
          ? "border-ha-success/40 shadow-[0_0_0_1px_rgb(var(--ha-success)_/_0.15)]"
          : "border-ha-card-border shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
      }`}
      data-testid={testId}
    >
      <button
        className="w-full px-5 py-5 text-left active:bg-ha-surface transition-colors"
        onClick={() => setExpanded(!expanded)}
        data-testid={`${testId}-toggle`}
      >
        <div className="flex items-center gap-3">
          {allDone ? (
            <CheckCircle2 className="w-5 h-5 text-ha-success flex-shrink-0" />
          ) : (
            <ClipboardList className="w-5 h-5 text-ha-primary flex-shrink-0" />
          )}
          <p className="text-[17px] font-bold text-ha-text leading-snug tracking-[-0.01em] flex-1 min-w-0">
            {title}
          </p>
          <span
            className={`text-[13px] font-semibold flex-shrink-0 ${
              allDone ? "text-ha-success" : "text-ha-text-muted"
            }`}
          >
            {percentage}%
          </span>
          <ChevronDown
            className={`w-5 h-5 text-ha-text-secondary flex-shrink-0 transition-transform duration-200 ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </div>

        <div className="mt-3 h-[8px] rounded-full overflow-hidden bg-ha-bg">
          <div
            className="h-full rounded-full bg-ha-highlight transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>

        {allDone && (
          <p className="text-[12px] mt-2 text-ha-success font-semibold">{completedLabel}</p>
        )}
      </button>

      <div
        className={`transition-all duration-200 ease-in-out overflow-hidden ${
          expanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-5 pb-5 flex flex-col gap-2">
          {steps.map((step, index) => {
            const isInlineOpen = expandedInline === step.id && step.stepType === "inline";
            return (
              <div key={step.id} className="flex flex-col">
                <button
                  onClick={() => handleStepClick(step)}
                  className={`w-full min-h-[56px] flex items-center gap-3.5 px-4 text-left rounded-[14px] transition-all duration-150 ${
                    step.completed
                      ? "bg-ha-surface active:bg-ha-divider"
                      : "bg-ha-surface hover:bg-ha-surface active:bg-ha-surface active:scale-[0.99]"
                  }`}
                  data-testid={`${testId}-step-${step.id}`}
                >
                  <span
                    className={`w-[26px] h-[26px] rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-bold ${
                      step.completed
                        ? "bg-ha-card-border text-ha-text-secondary"
                        : "bg-ha-primary text-white"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span
                    className={`text-[14px] flex-1 leading-snug ${
                      step.completed
                        ? "text-ha-text-secondary font-normal line-through decoration-ha-border-input"
                        : "text-ha-text font-medium"
                    }`}
                  >
                    {step.label}
                  </span>
                  <div className="flex-shrink-0">
                    {step.completed ? (
                      <div className="w-[26px] h-[26px] rounded-full bg-ha-bg border border-ha-card-border flex items-center justify-center">
                        <Check className="w-[14px] h-[14px] text-ha-text" strokeWidth={3} />
                      </div>
                    ) : step.stepType === "inline" ? (
                      <ChevronDown
                        className={`w-[18px] h-[18px] text-ha-text-secondary transition-transform duration-200 ${isInlineOpen ? "rotate-180" : ""}`}
                        strokeWidth={2}
                      />
                    ) : (
                      <ChevronRight className="w-[18px] h-[18px] text-ha-text-secondary" strokeWidth={2} />
                    )}
                  </div>
                </button>

                {step.stepType === "inline" && step.inlineContent && (
                  <div
                    className={`overflow-hidden transition-all duration-200 ease-in-out ${
                      isInlineOpen ? "max-h-[500px] opacity-100 mt-1" : "max-h-0 opacity-0"
                    }`}
                  >
                    <div className="px-2 py-3" data-testid={`${testId}-inline-${step.id}`}>
                      {step.inlineContent}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
