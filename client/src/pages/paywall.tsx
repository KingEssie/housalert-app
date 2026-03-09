import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { ArrowLeft, Home, Check, Crown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

interface Plan {
  id: string;
  name: string;
  duration: string;
  price: string;
  pricePerMonth: string;
  popular: boolean;
  savings?: string;
}

const PLANS: Plan[] = [
  {
    id: "monthly",
    name: "1 maand",
    duration: "1 maand",
    price: "€14,99",
    pricePerMonth: "€14,99/maand",
    popular: false,
  },
  {
    id: "two_month",
    name: "2 maanden",
    duration: "2 maanden",
    price: "€24,99",
    pricePerMonth: "€12,50/maand",
    popular: true,
    savings: "Bespaar 17%",
  },
  {
    id: "three_month",
    name: "3 maanden",
    duration: "3 maanden",
    price: "€29,99",
    pricePerMonth: "€10,00/maand",
    popular: false,
    savings: "Bespaar 33%",
  },
];

const FEATURES = [
  "Tot 4 zoekprofielen",
  "Directe meldingen via e-mail",
  "Pushmeldingen (binnenkort)",
  "Nieuwe woningen als eerste",
];

export default function PaywallPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const searchString = useSearch();
  const queryParams = new URLSearchParams(searchString);
  const planFromUrl = queryParams.get("plan");
  const autoCheckout = queryParams.get("autoCheckout") === "true";

  const [selectedPlan, setSelectedPlan] = useState(
    planFromUrl && PLANS.some((p) => p.id === planFromUrl) ? planFromUrl : "two_month"
  );
  const [loading, setLoading] = useState(false);
  const autoCheckoutTriggered = useRef(false);

  useEffect(() => {
    if (autoCheckout && user && !authLoading && !autoCheckoutTriggered.current) {
      autoCheckoutTriggered.current = true;
      handleCheckout();
    }
  }, [autoCheckout, user, authLoading]);

  async function handleCheckout() {
    if (!user) {
      navigate(`/signup?plan=${selectedPlan}`);
      return;
    }

    setLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        toast({ title: "Je bent niet ingelogd", description: "Log opnieuw in.", variant: "destructive" });
        navigate("/login");
        return;
      }

      const res = await fetch("/api/checkout/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan: selectedPlan }),
      });

      const data = await res.json();

      if (data.error) {
        toast({
          title: "Betaling mislukt",
          description: data.message || data.error || "Probeer het later opnieuw.",
          variant: "destructive",
        });
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({
          title: "Betaling niet beschikbaar",
          description: "Geen checkout URL ontvangen. Probeer het later opnieuw.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Er ging iets mis",
        description: "Probeer het later opnieuw.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="w-full bg-white sticky top-0 z-20 border-b border-[var(--yo-divider)]">
        <div className="max-w-xl mx-auto px-6 h-[60px] flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="w-9 h-9 rounded-full bg-[var(--yo-surface)] flex items-center justify-center active:scale-95 transition-transform"
            data-testid="button-paywall-back"
          >
            <ArrowLeft className="w-4 h-4 text-[var(--yo-dark)]" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[var(--yo-dark)] flex items-center justify-center">
              <Home className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-[var(--yo-dark)] text-base">HousAlert</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-xl mx-auto w-full px-6 pt-10 pb-32">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-lg bg-[var(--yo-chip-bg)] flex items-center justify-center mx-auto mb-4">
            <Crown className="w-7 h-7 text-[var(--yo-dark)]" />
          </div>
          <h1 className="text-[32px] font-[800] text-[var(--yo-dark)] tracking-[-0.03em] leading-[1.1] uppercase mb-3" data-testid="text-paywall-title">
            Kies je abonnement
          </h1>
          <p className="text-[15px] text-[var(--yo-dark)]">
            Start met 14 dagen gratis proefperiode. Daarna automatisch verlengd.
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {PLANS.map((plan) => (
            <button
              key={plan.id}
              onClick={() => setSelectedPlan(plan.id)}
              className={`w-full p-6 rounded-lg border-2 transition-all text-left relative bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)] ${
                selectedPlan === plan.id
                  ? "border-[var(--yo-teal)]"
                  : "border-transparent hover:border-[var(--yo-divider)]"
              }`}
              data-testid={`card-plan-${plan.id}`}
            >
              {plan.popular && (
                <span
                  className="absolute -top-3 left-5 px-3 py-0.5 bg-[var(--yo-dark)] text-white text-xs font-bold rounded-full"
                  data-testid="badge-popular"
                >
                  Meest gekozen
                </span>
              )}

              <div className="flex items-center justify-between gap-4 pr-8">
                <div>
                  <p className="text-[18px] font-bold text-[var(--yo-dark)]">{plan.name}</p>
                  <p className="text-[15px] text-[var(--yo-dark)]">{plan.pricePerMonth}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-extrabold text-[var(--yo-dark)]">{plan.price}</p>
                  {plan.savings && (
                    <p className="text-xs font-semibold text-[var(--yo-pink)]">{plan.savings}</p>
                  )}
                </div>
              </div>

              <div
                className={`absolute top-6 right-6 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                  selectedPlan === plan.id
                    ? "bg-[var(--yo-teal)] border-[var(--yo-teal)]"
                    : "border-[var(--yo-divider)]"
                }`}
              >
                {selectedPlan === plan.id && <Check className="w-3.5 h-3.5 text-white" />}
              </div>
            </button>
          ))}
        </div>

        <div className="bg-white rounded-lg shadow-[0_4px_20px_rgba(0,0,0,0.06)] p-6">
          <p className="text-[16px] font-[700] text-[var(--yo-dark)] mb-3">Dit zit er allemaal in:</p>
          <div className="space-y-2.5">
            {FEATURES.map((feature, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-[var(--yo-chip-bg)] flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-[var(--yo-dark)]" />
                </div>
                <span className="text-[15px] text-[var(--yo-dark)]">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[var(--yo-divider)] p-5 z-10">
        <div className="max-w-xl mx-auto">
          <Button
            size="lg"
            className="w-full h-[56px] rounded-lg text-[16px] font-bold shadow-none bg-[var(--yo-teal)]"
            onClick={handleCheckout}
            disabled={loading}
            data-testid="button-select-payment"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Even geduld...
              </>
            ) : (
              "Start gratis proefperiode"
            )}
          </Button>
          <p className="text-center text-[13px] text-[var(--yo-dark)] mt-3 opacity-60">
            14 dagen gratis. Daarna automatisch verlengd. Opzeggen kan altijd.
          </p>
        </div>
      </div>
    </div>
  );
}
