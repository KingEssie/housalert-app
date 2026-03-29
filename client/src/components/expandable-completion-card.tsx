import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";

export interface CompletionStep {
  id: string;
  label: string;
  completed: boolean;
  action: () => void;
}

interface ExpandableCompletionCardProps {
  title: string;
  icon: React.ReactNode;
  steps: CompletionStep[];
  completedLabel: string;
  testId: string;
}

export function ExpandableCompletionCard({
  title,
  icon,
  steps,
  completedLabel,
  testId,
}: ExpandableCompletionCardProps) {
  const [expanded, setExpanded] = useState(false);

  const doneCount = steps.filter((s) => s.completed).length;
  const totalCount = steps.length;
  const percentage = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  if (doneCount === totalCount) return null;

  return (
    <div
      className="bg-white rounded-[6px] border border-[#E5E7EB] overflow-hidden"
      data-testid={testId}
    >
      <button
        className="w-full px-4 py-4 flex items-center gap-3 text-left"
        onClick={() => setExpanded(!expanded)}
        data-testid={`${testId}-toggle`}
      >
        <div className="flex-shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-[#111]">{title}</p>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex-1 h-[6px] rounded-full bg-[#F3F3F5] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${percentage}%`,
                  background: "linear-gradient(90deg, #e91e63 0%, #ec407a 100%)",
                }}
              />
            </div>
            <span className="text-[13px] font-medium text-[#6B7280] whitespace-nowrap">
              {percentage}% {completedLabel}
            </span>
          </div>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-[#9CA3AF] flex-shrink-0 transition-transform duration-200 ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      <div
        className={`transition-all duration-200 ease-in-out overflow-hidden ${
          expanded ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="border-t border-[#F3F3F5] px-4 pb-3">
          {steps.map((step, idx) => (
            <button
              key={step.id}
              onClick={step.completed ? undefined : step.action}
              disabled={step.completed}
              className={`w-full h-[56px] flex items-center gap-3.5 text-left transition-colors rounded-[6px] ${
                !step.completed ? "active:bg-[#F5F5F7]" : "opacity-60"
              } ${idx < steps.length - 1 ? "border-b border-[#F5F5F7]" : ""}`}
              data-testid={`${testId}-step-${step.id}`}
            >
              <span className="w-6 h-6 rounded-full bg-[#F3F3F5] flex items-center justify-center text-[12px] font-semibold text-[#6B7280] flex-shrink-0">
                {idx + 1}
              </span>
              <span
                className={`text-[14px] font-medium flex-1 leading-snug ${
                  step.completed
                    ? "text-[#9CA3AF] line-through"
                    : "text-[#111]"
                }`}
              >
                {step.label}
              </span>
              <div className="flex-shrink-0">
                {step.completed ? (
                  <div className="w-[22px] h-[22px] rounded-full bg-green-500 flex items-center justify-center">
                    <CheckCircle2 className="w-[14px] h-[14px] text-white" />
                  </div>
                ) : (
                  <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
