import { useState } from "react";
import { Check, ChevronDown, ChevronRight, ClipboardList, CheckCircle2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

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
  icon?: LucideIcon;
  steps: CompletionStep[];
  completedLabel: string;
  subtitleFormat?: string;
  testId: string;
  defaultExpanded?: boolean;
}

export function ExpandableCompletionCard({
  title,
  icon: CardIconProp,
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

  const CardIcon = CardIconProp ?? ClipboardList;

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
          ? "border-[#bbadfb]/40 shadow-[0_0_0_1px_rgba(187,173,251,0.15)]"
          : "border-ha-card-border shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
      }`}
      data-testid={testId}
    >
      <button
        className="w-full px-5 py-5 text-left active:bg-ha-surface transition-colors"
        onClick={() => setExpanded(!expanded)}
        data-testid={`${testId}-toggle`}
      >
        <div className="flex items-center gap-3 mb-3">
          {allDone ? (
            <CheckCircle2 className="w-5 h-5 text-[#bbadfb] flex-shrink-0" />
          ) : (
            <div className="w-[36px] h-[36px] rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#bbadfb" }}>
              <CardIcon className="w-[20px] h-[20px] text-[#111111]" />
            </div>
          )}
          <p className="text-[22px] font-semibold text-ha-text leading-snug tracking-[-0.01em] flex-1 min-w-0">
            {title}
          </p>
          <ChevronDown
            className={`w-5 h-5 text-ha-text-secondary flex-shrink-0 transition-transform duration-200 ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-[8px] rounded-full overflow-hidden bg-ha-bg">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${percentage}%`, backgroundColor: "#bbadfb" }}
            />
          </div>
          <span
            className={`text-[13px] flex-shrink-0 whitespace-nowrap font-semibold ${
              allDone ? "text-[#bbadfb]" : "text-[#111111]"
            }`}
          >
            {percentage}% voltooid
          </span>
        </div>

        {allDone && (
          <p className="text-[12px] mt-2 text-[#bbadfb] font-semibold">{completedLabel}</p>
        )}
      </button>

      <div
        className={`transition-all duration-200 ease-in-out overflow-hidden ${
          expanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-5 pb-5 flex flex-col gap-1">
          {steps.map((step, index) => {
            const isInlineOpen = expandedInline === step.id && step.stepType === "inline";
            return (
              <div key={step.id} className="flex flex-col">
                <button
                  onClick={() => handleStepClick(step)}
                  className="w-full min-h-[52px] flex items-center gap-3 text-left transition-all duration-150 active:opacity-70 active:scale-[0.99]"
                  data-testid={`${testId}-step-${step.id}`}
                >
                  <span className="text-[14px] font-bold text-ha-text w-[20px] text-center flex-shrink-0">
                    {index + 1}
                  </span>
                  <span
                    className={`text-[14px] flex-1 leading-snug ${
                      step.completed
                        ? "text-ha-text-secondary font-normal line-through"
                        : "text-black font-semibold"
                    }`}
                  >
                    {step.label}
                  </span>
                  <div className="flex-shrink-0">
                    {step.completed ? (
                      <div
                        className="w-[26px] h-[26px] rounded-full flex items-center justify-center"
                        style={{ backgroundColor: "#bbadfb" }}
                      >
                        <Check className="w-[14px] h-[14px] text-[#111111]" strokeWidth={3} />
                      </div>
                    ) : step.stepType === "inline" ? (
                      <div className={`transition-transform duration-200 ${isInlineOpen ? "rotate-180" : ""}`}>
                        <ChevronDown className="w-[18px] h-[18px] text-ha-text-secondary" strokeWidth={2} />
                      </div>
                    ) : (
                      <div className="w-[26px] h-[26px] rounded-full border-[1.5px] border-ha-card-border" />
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
