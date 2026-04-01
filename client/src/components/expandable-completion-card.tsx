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
      className="ha-card !p-0 overflow-hidden"
      data-testid={testId}
    >
      <button
        className="w-full px-5 py-5 flex items-center gap-3 text-left"
        onClick={() => setExpanded(!expanded)}
        data-testid={`${testId}-toggle`}
      >
        <div className="flex-shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-[17px] font-bold text-black">{title}</p>
            <ChevronDown
              className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200 ml-2 ${
                expanded ? "rotate-180" : ""
              }`}
            />
          </div>
          <div className="mt-2.5 flex items-center gap-3">
            <div className="flex-1 h-[8px] rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-ha-status-green transition-all duration-500"
                style={{ width: `${percentage}%` }}
              />
            </div>
            <span className="text-[14px] font-semibold text-ha-status-green whitespace-nowrap">
              {percentage}% {completedLabel}
            </span>
          </div>
        </div>
      </button>

      <div
        className={`transition-all duration-200 ease-in-out overflow-hidden ${
          expanded ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="border-t border-gray-50 px-5 pb-3">
          {steps.map((step, idx) => (
            <button
              key={step.id}
              onClick={step.completed ? undefined : step.action}
              disabled={step.completed}
              className={`w-full h-[56px] flex items-center gap-3 text-left transition-colors rounded-[--ha-card-inner-radius] ${
                !step.completed ? "active:bg-ha-surface-hover" : ""
              } ${idx < steps.length - 1 ? "border-b border-gray-50" : ""}`}
              data-testid={`${testId}-step-${step.id}`}
            >
              <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[12px] font-semibold text-[#6B7280] flex-shrink-0">
                {idx + 1}
              </span>
              <span
                className={`text-[15px] font-medium flex-1 leading-snug ${
                  step.completed
                    ? "text-[#6B7280] line-through"
                    : "text-black"
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
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
