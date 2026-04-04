import { useLocation } from "wouter";
import { Lock, Crown } from "lucide-react";
import { useTranslation } from "@/i18n";

interface SubscriptionGateProps {
  isActive: boolean;
  children: React.ReactNode;
}

export function SubscriptionGate({ isActive, children }: SubscriptionGateProps) {
  const [, navigate] = useLocation();
  const { t } = useTranslation();

  if (isActive) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col items-center justify-center text-center px-6 pt-20 pb-10 min-h-[70vh]">
      <div className="w-20 h-20 rounded-[6px] bg-ha-surface flex items-center justify-center mx-auto mb-6">
        <Crown className="w-10 h-10 text-ha-text" />
      </div>
      <h2 className="text-[22px] font-medium text-ha-text mb-3 leading-snug" data-testid="text-gate-title">
        {t("subscription.gate.title")}
      </h2>
      <p className="text-[15px] text-ha-text opacity-70 max-w-[320px] mb-8 leading-relaxed">
        {t("subscription.gate.desc")}
      </p>
      <button
        onClick={() => navigate("/paywall")}
        className="w-full max-w-[320px] h-[48px] rounded-[6px] bg-ha-primary hover:bg-ha-primary-hover text-white font-medium text-[16px] transition-colors flex items-center justify-center gap-2"
        data-testid="button-gate-upgrade"
      >
        <Lock className="w-4 h-4" />
        {t("subscription.gate.button")}
      </button>
    </div>
  );
}
