import { useState } from "react";
import { useLocation } from "wouter";
import { Home, Check, Crown, Loader2 } from "lucide-react";
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
    id: "1-month",
    name: "1 maand",
    duration: "1 maand",
    price: "€14,99",
    pricePerMonth: "€14,99/maand",
    popular: false,
  },
  {
    id: "2-months",
    name: "2 maanden",
    duration: "2 maanden",
    price: "€24,99",
    pricePerMonth: "€12,50/maand",
    popular: true,
    savings: "Bespaar 17%",
  },
  {
    id: "3-months",
    name: "3 maanden",
    duration: "3 maanden",
    price: "€29,99",
    pricePerMonth: "€10,00/maand",
    popular: false,
    savings: "Bespaar 33%",
  },
];

const FEATURES = [
  "Onbeperkt zoekprofielen",
  "Directe meldingen via e-mail",
  "SMS & WhatsApp meldingen",
  "Nieuwe woningen als eerste",
];

export default function PaywallPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState("2-months");
  const [loading, setLoading] = useState(false);

  async function handleCheckout() {
    if (!user) {
      navigate("/signup");
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

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ priceId: selectedPlan }),
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({
          title: "Betaling niet beschikbaar",
          description: "Stripe is nog niet volledig geconfigureerd. Probeer het later opnieuw.",
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
    <div className="min-h-screen bg-[#f5f6f8] flex flex-col">
      <header className="w-full bg-white sticky top-0 z-20 shadow-sm">
        <div className="max-w-xl mx-auto px-5 h-14 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Home className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-[#1a2744] text-base">Stekkies</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-xl mx-auto w-full px-5 pt-10 pb-32">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#fef9ec] flex items-center justify-center mx-auto mb-4">
            <Crown className="w-7 h-7 text-amber-500" />
          </div>
          <h1 className="text-[26px] font-extrabold text-[#1a2744] mb-2" data-testid="text-paywall-title">
            Kies je abonnement
          </h1>
          <p className="text-[15px] text-[#6b7280]">
            Start vandaag en ontvang direct meldingen voor nieuwe woningen.
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {PLANS.map((plan) => (
            <button
              key={plan.id}
              onClick={() => setSelectedPlan(plan.id)}
              className={`w-full p-5 rounded-2xl border-2 transition-all text-left relative bg-white shadow-sm ${
                selectedPlan === plan.id
                  ? "border-primary shadow-md"
                  : "border-[#e5e7eb] hover:border-[#c5c9d2]"
              }`}
              data-testid={`card-plan-${plan.id}`}
            >
              {plan.popular && (
                <span
                  className="absolute -top-3 left-5 px-3 py-0.5 bg-primary text-white text-xs font-bold rounded-full"
                  data-testid="badge-popular"
                >
                  Meest gekozen
                </span>
              )}

              <div className="flex items-center justify-between pr-8">
                <div>
                  <p className="text-lg font-bold text-[#1a2744]">{plan.name}</p>
                  <p className="text-sm text-[#9ca3af]">{plan.pricePerMonth}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-extrabold text-[#1a2744]">{plan.price}</p>
                  {plan.savings && (
                    <p className="text-xs font-semibold text-emerald-600">{plan.savings}</p>
                  )}
                </div>
              </div>

              <div
                className={`absolute top-5 right-5 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                  selectedPlan === plan.id
                    ? "bg-primary border-primary"
                    : "border-[#d1d5db]"
                }`}
              >
                {selectedPlan === plan.id && <Check className="w-3.5 h-3.5 text-white" />}
              </div>
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-[#eceef1] p-5">
          <p className="text-sm font-semibold text-[#1a2744] mb-3">Dit zit er allemaal in:</p>
          <div className="space-y-2.5">
            {FEATURES.map((feature, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-[#ecfdf5] flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-emerald-600" />
                </div>
                <span className="text-sm text-[#4a5568]">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#eceef1] p-4 z-10 shadow-[0_-2px_10px_rgba(0,0,0,0.04)]">
        <div className="max-w-xl mx-auto">
          <Button
            size="lg"
            className="w-full h-[52px] rounded-xl text-[16px] font-semibold shadow-none bg-primary hover:bg-primary/90"
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
              "Selecteer betaalmethode"
            )}
          </Button>
          <p className="text-center text-xs text-[#c5c9d2] mt-3">
            Veilig betalen via Stripe. Opzeggen kan altijd.
          </p>
        </div>
      </div>
    </div>
  );
}
