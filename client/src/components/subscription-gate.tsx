import { useLocation } from "wouter";
import { Lock, Crown } from "lucide-react";

interface SubscriptionGateProps {
  isActive: boolean;
  children: React.ReactNode;
}

export function SubscriptionGate({ isActive, children }: SubscriptionGateProps) {
  const [, navigate] = useLocation();

  if (isActive) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col items-center justify-center text-center px-6 pt-20 pb-10 min-h-[70vh]">
      <div className="w-20 h-20 rounded-2xl bg-[var(--yo-chip-bg)] flex items-center justify-center mx-auto mb-6">
        <Crown className="w-10 h-10 text-[var(--yo-dark)]" />
      </div>
      <h2 className="text-[22px] font-bold text-[var(--yo-dark)] mb-3 leading-snug" data-testid="text-gate-title">
        Activeer een abonnement om je matches te bekijken
      </h2>
      <p className="text-[15px] text-[var(--yo-dark)] opacity-70 max-w-[320px] mb-8 leading-relaxed">
        Ontvang direct meldingen en bekijk al je woningmatches zodra je een abonnement hebt geactiveerd.
      </p>
      <button
        onClick={() => navigate("/paywall")}
        className="w-full max-w-[320px] h-[56px] rounded-lg bg-[var(--yo-teal)] hover:bg-[var(--yo-teal-hover)] text-black font-bold text-[16px] transition-colors flex items-center justify-center gap-2"
        data-testid="button-gate-upgrade"
      >
        <Lock className="w-4 h-4" />
        Kies abonnement
      </button>
    </div>
  );
}
