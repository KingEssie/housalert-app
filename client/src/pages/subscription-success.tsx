import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { CheckCircle } from "lucide-react";

export default function SubscriptionSuccessPage() {
  const [, navigate] = useLocation();
  const [countdown, setCountdown] = useState(2);

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/subscription/status"] });
    queryClient.invalidateQueries({ queryKey: ["/api/profile-stats"] });

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate("/dashboard");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-5">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-full bg-[#E8FFF5] flex items-center justify-center mx-auto mb-5">
          <CheckCircle className="w-8 h-8 text-[var(--yo-teal)]" />
        </div>
        <h1 className="text-[22px] font-bold text-[var(--yo-dark)] mb-2" data-testid="text-success-title">
          Abonnement succesvol geactiveerd
        </h1>
        <p className="text-[15px] text-[var(--yo-dark)] opacity-70" data-testid="text-success-redirect">
          Je wordt doorgestuurd naar je dashboard...
        </p>
      </div>
    </div>
  );
}
