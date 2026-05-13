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
      className="sticky top-0 z-30 bg-white border-b border-ha-card-border"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
      data-testid="app-header"
    >
      <div className="flex items-center h-14 px-4 gap-3">
        <button
          onClick={handleBack}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:opacity-80 active:opacity-60 transition-opacity shrink-0"
          style={{ backgroundColor: "#f1eef5" }}
          aria-label={closeButton ? "Close" : "Back"}
          data-testid="button-back"
        >
          <Icon className="w-5 h-5 text-[#111111]" strokeWidth={2} />
        </button>
        <h1 className="flex-1 text-[17px] font-semibold text-ha-text" data-testid="text-page-title">
          {title}
        </h1>
        {trailing && (
          <div className="shrink-0 flex justify-end">{trailing}</div>
        )}
      </div>
    </div>
  );
}
