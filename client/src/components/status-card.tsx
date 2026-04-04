import { CheckCircle2, XCircle, ChevronRight } from "lucide-react";

interface StatusCardProps {
  icon: React.ReactNode;
  title: string;
  configured: boolean;
  configuredText: string;
  unconfiguredText: string;
  description?: string;
  actionLabel?: string;
  onAction: () => void;
  testId: string;
}

export function StatusCard({
  icon,
  title,
  configured,
  configuredText,
  unconfiguredText,
  description,
  actionLabel,
  onAction,
  testId,
}: StatusCardProps) {
  return (
    <div className="rounded-[--ha-card-radius] bg-white overflow-hidden" data-testid={testId}>
      <button
        onClick={onAction}
        className="w-full px-5 py-4 flex items-center gap-4 text-left active:bg-[#F7F7F7] transition-colors"
        data-testid={`${testId}-action`}
      >
        <div className="w-11 h-11 rounded-full bg-[#F7F7F7] flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-[#111111] leading-snug">{title}</p>
          <div className="flex items-center gap-1.5 mt-0.5" data-testid={`${testId}-status`}>
            {configured ? (
              <>
                <CheckCircle2 className="w-[14px] h-[14px] text-ha-success flex-shrink-0" />
                <span className="text-[13px] font-medium text-ha-success">{configuredText}</span>
              </>
            ) : (
              <>
                <XCircle className="w-[14px] h-[14px] text-ha-danger flex-shrink-0" />
                <span className="text-[13px] font-medium text-ha-danger">{unconfiguredText}</span>
              </>
            )}
          </div>
          {description && (
            <p className="text-[13px] text-[#9CA3AF] mt-0.5 leading-snug line-clamp-2">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {actionLabel && (
            <span className="text-[13px] font-semibold text-ha-primary">{actionLabel}</span>
          )}
          <ChevronRight className="w-4 h-4 text-[#D1D5DB]" />
        </div>
      </button>
    </div>
  );
}

export function StatusCardInline({
  icon,
  title,
  configured,
  configuredText,
  unconfiguredText,
  actionLabel,
  onAction,
  testId,
}: StatusCardProps) {
  return (
    <button
      onClick={onAction}
      className="w-full px-5 py-3.5 flex items-center gap-3.5 text-left active:bg-[#F7F7F7] transition-colors"
      data-testid={`${testId}-action`}
    >
      <div className="w-9 h-9 rounded-full bg-[#F7F7F7] flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-bold text-[#111111] leading-snug">{title}</p>
        <div className="flex items-center gap-1.5 mt-0.5" data-testid={`${testId}-status`}>
          {configured ? (
            <>
              <CheckCircle2 className="w-[13px] h-[13px] text-ha-success flex-shrink-0" />
              <span className="text-[13px] text-ha-success">{configuredText}</span>
            </>
          ) : (
            <>
              <XCircle className="w-[13px] h-[13px] text-ha-danger flex-shrink-0" />
              <span className="text-[13px] text-ha-danger">{unconfiguredText}</span>
            </>
          )}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-[#D1D5DB] flex-shrink-0" />
    </button>
  );
}
