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
    <div data-testid="page-header">
      <div className="fixed top-[max(0.75rem,env(safe-area-inset-top))] left-4 z-30 flex items-center gap-2">
        <button
          onClick={handleBack}
          className="w-12 h-12 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.10)] flex items-center justify-center active:scale-95 transition-transform"
          aria-label={closeButton ? "Close" : "Back"}
          data-testid="button-back"
        >
          <Icon className="w-5 h-5 text-[#71717A]" />
        </button>
        {trailing && <div className="flex-shrink-0">{trailing}</div>}
      </div>

      {title && (
        <div className="max-w-xl mx-auto px-5 pt-[calc(max(0.75rem,env(safe-area-inset-top))+80px)]">
          <h1
            className="text-page-title mb-5"
            data-testid="text-page-title"
          >
            {title}
          </h1>
        </div>
      )}
    </div>
  );
}
