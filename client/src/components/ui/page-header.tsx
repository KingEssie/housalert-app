import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";

interface PageHeaderProps {
  title: string;
  onBack?: () => void;
  trailing?: React.ReactNode;
}

export function PageHeader({ title, onBack, trailing }: PageHeaderProps) {
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

  return (
    <header
      className="sticky top-0 z-20 bg-white border-b border-[#E5E7EB]"
      data-testid="page-header"
    >
      <div className="max-w-xl mx-auto flex items-center h-[56px] px-4">
        <button
          onClick={handleBack}
          className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[#F8FAFC] transition-colors flex-shrink-0"
          data-testid="button-back"
        >
          <ArrowLeft className="w-5 h-5 text-[#111827]" />
        </button>
        <h1 className="text-[18px] font-bold text-[#111827] flex-1 ml-1" data-testid="text-page-title">{title}</h1>
        {trailing && <div className="flex-shrink-0">{trailing}</div>}
      </div>
    </header>
  );
}
