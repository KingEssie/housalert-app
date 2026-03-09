import { useLocation } from "wouter";
import { ArrowLeft, X } from "lucide-react";

interface PageHeaderProps {
  title: string;
  onBack?: () => void;
  trailing?: React.ReactNode;
  closeButton?: boolean;
}

export function PageHeader({ title, onBack, trailing, closeButton }: PageHeaderProps) {
  const [, navigate] = useLocation();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate("/dashboard");
    }
  };

  const Icon = closeButton ? X : ArrowLeft;

  return (
    <div className="max-w-xl mx-auto px-5 pt-[max(1rem,env(safe-area-inset-top))]" data-testid="page-header">
      <div className="flex items-center justify-between mb-6 pt-2">
        <button
          onClick={handleBack}
          className="w-10 h-10 rounded-full bg-[var(--yo-surface)] flex items-center justify-center hover:bg-[var(--yo-chip-bg)] transition-colors flex-shrink-0"
          data-testid="button-back"
        >
          <Icon className="w-5 h-5 text-[var(--yo-dark)]" />
        </button>
        {trailing && <div className="flex-shrink-0">{trailing}</div>}
      </div>
      {title && (
        <h1
          className="text-[24px] font-[800] text-[var(--yo-dark)] tracking-[-0.02em] leading-[1.2] uppercase mb-6"
          data-testid="text-page-title"
        >
          {title}
        </h1>
      )}
    </div>
  );
}
