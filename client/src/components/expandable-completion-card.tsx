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

function CircularProgress({ percentage, size = 52 }: { percentage: number; size?: number }) {
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
      <span className="absolute inset-0 flex items-center justify-center text-[13px] font-bold text-[#111111]">
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
  const allDone = doneCount === totalCount;

  return (
    <div
      className={`rounded-[18px] bg-white border-[1.5px] overflow-hidden transition-colors duration-300 ${
        allDone
          ? "border-[#86EFAC] shadow-[0_0_0_1px_rgba(134,239,172,0.15)]"
          : "border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
      }`}
      data-testid={testId}
    >
      <button
        className="w-full px-5 py-5 flex items-center gap-4 text-left active:bg-[#FAFAFA] transition-colors"
        onClick={() => setExpanded(!expanded)}
        data-testid={`${testId}-toggle`}
      >
        {allDone ? (
          <div className="w-[52px] h-[52px] rounded-full bg-[#F0FDF4] flex items-center justify-center flex-shrink-0">
            <Check className="w-7 h-7 text-[#16A34A]" strokeWidth={2.5} />
          </div>
        ) : (
          <CircularProgress percentage={percentage} />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[17px] font-bold text-[#111111] leading-snug tracking-[-0.01em]">{title}</p>
          <p className={`text-[13px] mt-1 ${allDone ? "text-[#16A34A] font-semibold" : "text-[#9CA3AF] font-medium"}`}>
            {allDone
              ? completedLabel
              : subtitleFormat
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
          expanded ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-5 pb-5 flex flex-col gap-2">
          {steps.map((step, index) => (
            <button
              key={step.id}
              onClick={step.action}
              className={`w-full min-h-[56px] flex items-center gap-3.5 px-4 text-left rounded-[14px] transition-all duration-150 ${
                step.completed
                  ? "bg-[#FAFAFA] active:bg-[#F0F0F0]"
                  : "bg-[#F9FAFB] hover:bg-[#F3F4F6] active:bg-[#EBEBEB] active:scale-[0.99]"
              }`}
              data-testid={`${testId}-step-${step.id}`}
            >
              <span
                className={`w-[26px] h-[26px] rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-bold ${
                  step.completed
                    ? "bg-[#E5E7EB] text-[#9CA3AF]"
                    : "bg-[#111111] text-white"
                }`}
              >
                {index + 1}
              </span>
              <span
                className={`text-[14px] flex-1 leading-snug ${
                  step.completed
                    ? "text-[#9CA3AF] font-normal line-through decoration-[#D1D5DB]"
                    : "text-[#111111] font-medium"
                }`}
              >
                {step.label}
              </span>
              <div className="flex-shrink-0">
                {step.completed ? (
                  <div className="w-[26px] h-[26px] rounded-full bg-[#16A34A] flex items-center justify-center">
                    <Check className="w-[14px] h-[14px] text-white" strokeWidth={3} />
                  </div>
                ) : (
                  <ChevronRight className="w-[18px] h-[18px] text-[#9CA3AF]" strokeWidth={2} />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
