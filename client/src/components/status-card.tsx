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
    <div className="rounded-[--ha-card-radius] bg-white shadow-ha-card overflow-hidden" data-testid={testId}>
      <button
        onClick={onAction}
        className="w-full px-5 py-4 flex items-center gap-4 text-left active:bg-ha-surface-hover transition-colors"
        data-testid={`${testId}-action`}
      >
        <div className="w-11 h-11 rounded-full bg-ha-surface flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-[#111111] leading-snug">{title}</p>
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
            <p className="text-[13px] text-ha-text-muted mt-0.5 leading-snug line-clamp-2">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {actionLabel && (
            <span className="text-[13px] font-semibold text-ha-primary">{actionLabel}</span>
          )}
          <ChevronRight className="w-4 h-4 text-ha-icon-secondary" />
        </div>
      </button>
    </div>
  );
}
