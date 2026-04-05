import { useState } from "react";
import { Check, ChevronDown, ChevronRight } from "lucide-react";

export interface CompletionStep {
  id: string;
  label: string;
  completed: boolean;
  action: () => void;
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

function CircularProgress({ percentage, size = 44 }: { percentage: number; size?: number }) {
  const strokeWidth = 3.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#F0F0F0"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgb(var(--ha-primary))"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[12px] font-bold text-[#111111]">
        {percentage}%
      </span>
    </div>
  );
}

export function ExpandableCompletionCard({
  title,
  steps,
  completedLabel,
  subtitleFormat,
  testId,
  defaultExpanded = false,
}: ExpandableCompletionCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const doneCount = steps.filter((s) => s.completed).length;
  const totalCount = steps.length;
  const percentage = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  if (doneCount === totalCount) return null;

  return (
    <div
      className="rounded-[16px] bg-white border border-[#E5E7EB] overflow-hidden"
      data-testid={testId}
    >
      <button
        className="w-full px-4 py-4 flex items-center gap-3.5 text-left"
        onClick={() => setExpanded(!expanded)}
        data-testid={`${testId}-toggle`}
      >
        <CircularProgress percentage={percentage} />
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-[#111111] leading-snug">{title}</p>
          <p className="text-[13px] text-[#6B7280] mt-0.5">
            {subtitleFormat
              ? subtitleFormat.replace("{done}", String(doneCount)).replace("{total}", String(totalCount))
              : `${doneCount} / ${totalCount} ${completedLabel}`}
          </p>
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
        <div className="px-4 pb-3 flex flex-col gap-1.5">
          {steps.map((step) => (
            <button
              key={step.id}
              onClick={step.completed ? undefined : step.action}
              disabled={step.completed}
              className={`w-full h-[48px] flex items-center gap-3 px-3.5 text-left rounded-[12px] transition-colors ${
                step.completed ? "bg-[#F9FAFB]" : "bg-[#F9FAFB] active:bg-[#EBEBEB]"
              }`}
              data-testid={`${testId}-step-${step.id}`}
            >
              <span
                className={`text-[14px] flex-1 leading-snug ${
                  step.completed
                    ? "text-[#9CA3AF] line-through font-normal"
                    : "text-[#111111] font-medium"
                }`}
              >
                {step.label}
              </span>
              <div className="flex-shrink-0">
                {step.completed ? (
                  <div className="w-[24px] h-[24px] rounded-full bg-ha-primary flex items-center justify-center">
                    <Check className="w-[13px] h-[13px] text-white" strokeWidth={3} />
                  </div>
                ) : (
                  <div className="w-[24px] h-[24px] rounded-full border-[1.5px] border-[#9CA3AF] flex items-center justify-center">
                    <ChevronRight className="w-[13px] h-[13px] text-[#9CA3AF]" strokeWidth={2.5} />
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
