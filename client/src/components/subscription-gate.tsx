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
    <div className="relative min-h-[60vh]">
      <div className="blur-[8px] pointer-events-none select-none opacity-50">
        {children}
      </div>
      <div className="absolute inset-0 flex items-start justify-center z-10 pt-32">
        <div className="bg-white rounded-xl shadow-[0_8px_40px_rgba(0,0,0,0.15)] p-8 mx-6 max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-xl bg-[var(--yo-chip-bg)] flex items-center justify-center mx-auto mb-5">
            <Crown className="w-8 h-8 text-[var(--yo-dark)]" />
          </div>
          <h3 className="text-[18px] font-bold text-[var(--yo-dark)] mb-2 leading-snug" data-testid="text-gate-title">
            Activeer een abonnement om je matches te bekijken
          </h3>
          <p className="text-[14px] text-[var(--yo-dark)] mb-6 opacity-70">
            Ontvang direct meldingen en bekijk al je woningmatches.
          </p>
          <button
            onClick={() => navigate("/paywall")}
            className="w-full h-[56px] rounded-lg bg-[var(--yo-teal)] hover:bg-[var(--yo-teal-hover)] text-black font-bold text-[16px] transition-colors flex items-center justify-center gap-2"
            data-testid="button-gate-upgrade"
          >
            <Lock className="w-4 h-4" />
            Kies abonnement
          </button>
        </div>
      </div>
    </div>
  );
}
