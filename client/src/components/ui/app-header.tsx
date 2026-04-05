import { useLocation } from "wouter";
import { ArrowLeft, X } from "lucide-react";

interface AppHeaderProps {
  title: string;
  onBack?: () => void;
  closeButton?: boolean;
  trailing?: React.ReactNode;
}

export function AppHeader({ title, onBack, closeButton, trailing }: AppHeaderProps) {
  const [, navigate] = useLocation();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate("/home");
    }
  };

  const Icon = closeButton ? X : ArrowLeft;

  return (
    <div
      className="sticky top-0 z-30 flex items-center gap-3 px-4 bg-white"
      style={{ paddingTop: "max(16px, env(safe-area-inset-top))" }}
      data-testid="app-header"
    >
      <button
        onClick={handleBack}
        className="w-10 h-10 flex items-center justify-center rounded-full active:bg-[#F9FAFB] transition-colors shrink-0"
        aria-label={closeButton ? "Close" : "Back"}
        data-testid="button-back"
      >
        <Icon className="w-5 h-5 text-[#111111]" strokeWidth={2} />
      </button>
      <h1 className="text-[18px] font-semibold text-[#111111] flex-1 min-w-0 truncate" data-testid="text-page-title">
        {title}
      </h1>
      {trailing && <div className="shrink-0">{trailing}</div>}
      <div className="absolute bottom-0 left-0 right-0" />
    </div>
  );
}
