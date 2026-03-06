import { useState } from "react";
import { useLocation } from "wouter";
import { Home, Check, Crown, Loader2, AlertCircle } from "lucide-react";
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
  "Onbeperkt zoekprofielen",
  "Directe meldingen via e-mail",
  "SMS & WhatsApp meldingen",
  "Nieuwe woningen als eerste",
];

export default function PaywallPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState("two_month");
  const [loading, setLoading] = useState(false);
  const [stripeUnavailable, setStripeUnavailable] = useState(false);

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

      const res = await fetch("/api/checkout/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan: selectedPlan }),
      });

      const data = await res.json();

      if (data.error === "stripe_not_configured") {
        setStripeUnavailable(true);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({
          title: "Betaling niet beschikbaar",
          description: "Probeer het later opnieuw.",
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
      <header className="w-full bg-white sticky top-0 z-20 border-b border-[#E8EDF2]">
        <div className="max-w-xl mx-auto px-5 h-14 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#2D6CDF] flex items-center justify-center">
              <Home className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-[#0B1F44] text-base">Stekkies</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-xl mx-auto w-full px-5 pt-10 pb-32">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#fef9ec] flex items-center justify-center mx-auto mb-4">
            <Crown className="w-7 h-7 text-amber-500" />
          </div>
          <h1 className="text-[26px] font-extrabold text-[#0B1F44] mb-2" data-testid="text-paywall-title">
            Kies je abonnement
          </h1>
          <p className="text-[15px] text-[#6B7280]">
            Start vandaag en ontvang direct meldingen voor nieuwe woningen.
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {PLANS.map((plan) => (
            <button
              key={plan.id}
              onClick={() => setSelectedPlan(plan.id)}
              className={`w-full p-5 rounded-2xl border-2 transition-all text-left relative bg-white shadow-[0_6px_20px_rgba(0,0,0,0.06)] ${
                selectedPlan === plan.id
                  ? "border-[#2D6CDF]"
                  : "border-transparent hover:border-[#E8EDF2]"
              }`}
              data-testid={`card-plan-${plan.id}`}
            >
              {plan.popular && (
                <span
                  className="absolute -top-3 left-5 px-3 py-0.5 bg-[#2D6CDF] text-white text-xs font-bold rounded-full"
                  data-testid="badge-popular"
                >
                  Meest gekozen
                </span>
              )}

              <div className="flex items-center justify-between pr-8">
                <div>
                  <p className="text-lg font-bold text-[#0B1F44]">{plan.name}</p>
                  <p className="text-sm text-[#6B7280]">{plan.pricePerMonth}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-extrabold text-[#0B1F44]">{plan.price}</p>
                  {plan.savings && (
                    <p className="text-xs font-semibold text-emerald-600">{plan.savings}</p>
                  )}
                </div>
              </div>

              <div
                className={`absolute top-5 right-5 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                  selectedPlan === plan.id
                    ? "bg-[#2D6CDF] border-[#2D6CDF]"
                    : "border-[#E8EDF2]"
                }`}
              >
                {selectedPlan === plan.id && <Check className="w-3.5 h-3.5 text-white" />}
              </div>
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-[0_6px_20px_rgba(0,0,0,0.06)] p-5">
          <p className="text-sm font-semibold text-[#0B1F44] mb-3">Dit zit er allemaal in:</p>
          <div className="space-y-2.5">
            {FEATURES.map((feature, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-[#ecfdf5] flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-emerald-600" />
                </div>
                <span className="text-sm text-[#6B7280]">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E8EDF2] p-4 z-10">
        <div className="max-w-xl mx-auto">
          {stripeUnavailable ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3" data-testid="stripe-unavailable-notice">
              <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[14px] font-semibold text-[#0B1F44]">Betaling wordt binnenkort beschikbaar</p>
                <p className="text-[12px] text-[#6B7280] mt-1">We werken aan de betalingsintegratie. Probeer het later opnieuw.</p>
              </div>
            </div>
          ) : (
            <>
              <Button
                size="lg"
                className="w-full h-[52px] rounded-xl text-[16px] font-semibold shadow-none bg-[#2D6CDF] hover:bg-[#2560C8]"
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
              <p className="text-center text-xs text-[#6B7280] mt-3 opacity-60">
                Veilig betalen via Stripe. Opzeggen kan altijd.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
