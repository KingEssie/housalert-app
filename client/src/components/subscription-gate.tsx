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
    <div className="relative">
      <div className="blur-[6px] pointer-events-none select-none opacity-60">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] p-6 mx-4 max-w-sm w-full text-center">
          <div className="w-14 h-14 rounded-2xl bg-[var(--yo-surface)] flex items-center justify-center mx-auto mb-4">
            <Crown className="w-7 h-7 text-[var(--yo-teal)]" />
          </div>
          <h3 className="text-lg font-bold text-[var(--yo-dark)] mb-2" data-testid="text-gate-title">
            Activeer je abonnement
          </h3>
          <p className="text-sm text-[var(--yo-muted)] mb-5">
            Upgrade om al je matches te zien en direct meldingen te ontvangen.
          </p>
          <button
            onClick={() => navigate("/paywall")}
            className="w-full h-[56px] rounded-xl bg-[var(--yo-teal)] hover:bg-[var(--yo-teal-hover)] text-white font-semibold text-[15px] transition-colors flex items-center justify-center gap-2"
            data-testid="button-gate-upgrade"
          >
            <Lock className="w-4 h-4" />
            Kies een abonnement
          </button>
        </div>
      </div>
    </div>
  );
}
