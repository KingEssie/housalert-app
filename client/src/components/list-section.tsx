import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

export function ListSectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-row-section-title">{children}</h2>
  );
}

export function ListDivider() {
  return <div className="h-px bg-[#E5E7EB]" />;
}

export function ListRow({
  title,
  subtitle,
  icon,
  onClick,
  trailing,
  titleClassName,
  disabled,
  testId,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  onClick?: () => void;
  trailing?: ReactNode;
  titleClassName?: string;
  disabled?: boolean;
  testId?: string;
}) {
  const Component = onClick ? "button" : "div";
  return (
    <Component
      {...(onClick ? { type: "button" as const, disabled } : {})}
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-5 py-4 text-left ${onClick ? "cursor-pointer active:bg-[#F9FAFB] transition-colors" : ""} ${disabled ? "opacity-60 pointer-events-none" : ""}`}
      data-testid={testId}
    >
      {icon && (
        <div className="flex-shrink-0">{icon}</div>
      )}
      <div className="flex-1 min-w-0">
        <p className={titleClassName ?? "text-row-title"}>{title}</p>
        {subtitle && (
          <p className="text-row-subtitle mt-0.5">{subtitle}</p>
        )}
      </div>
      {trailing ?? (onClick ? <ChevronRight className="w-[18px] h-[18px] text-[#9CA3AF] flex-shrink-0" /> : null)}
    </Component>
  );
}

export function ListSection({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col">
      {title && (
        <ListSectionTitle>{title}</ListSectionTitle>
      )}
      <div className={title ? "mt-2" : ""}>
        {children}
      </div>
    </div>
  );
}
