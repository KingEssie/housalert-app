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
    <div className="ha-card !p-0 overflow-hidden" data-testid={testId}>
      <button
        onClick={onAction}
        className="w-full px-5 py-[18px] flex items-center gap-3.5 text-left active:bg-ha-surface-hover transition-colors"
        data-testid={`${testId}-action`}
      >
        <div className="w-10 h-10 rounded-[--ha-card-inner-radius] bg-ha-surface flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[16px] font-bold text-black leading-snug">{title}</p>
          <div className="flex items-center gap-1.5 mt-1">
            {configured ? (
              <>
                <CheckCircle2 className="w-[15px] h-[15px] text-ha-success flex-shrink-0" />
                <span className="text-[13px] font-medium text-ha-success">{configuredText}</span>
              </>
            ) : (
              <>
                <XCircle className="w-[15px] h-[15px] text-ha-danger flex-shrink-0" />
                <span className="text-[13px] font-medium text-ha-danger">{unconfiguredText}</span>
              </>
            )}
          </div>
          {description && (
            <p className="text-[13px] text-ha-text-muted mt-1 leading-snug line-clamp-2">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {actionLabel && (
            <span className="text-[13px] font-semibold text-ha-primary">{actionLabel}</span>
          )}
          <ChevronRight className="w-4 h-4 text-ha-icon-secondary" />
        </div>
      </button>
    </div>
  );
}
