import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Home, ChevronLeft, User, Mail, Lock, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { ensureTrialForCurrentUser } from "@/lib/auth";

export default function SignupPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);

  const city = params.get("city") || "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailConfirmationPending, setEmailConfirmationPending] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        toast({ title: "Aanmaken mislukt", description: error.message, variant: "destructive" });
        setLoading(false);
        return;
      }

      if (!data.user) {
        toast({ title: "Aanmaken mislukt", description: "Er ging iets mis bij het aanmaken van je account.", variant: "destructive" });
        setLoading(false);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const hasSession = !!sessionData?.session?.access_token;

      if (hasSession) {
        const trialOk = await ensureTrialForCurrentUser();
        if (!trialOk) {
          console.error("[signup] Trial creation failed after signup — continuing to onboarding anyway");
        }
        navigate("/onboarding");
      } else {
        setEmailConfirmationPending(true);
      }
    } catch (err: any) {
      toast({ title: "Er ging iets mis", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    window.history.back();
  }

  if (emailConfirmationPending) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <header className="w-full bg-white sticky top-0 z-20 border-b border-[var(--yo-divider)]">
          <div className="max-w-xl mx-auto px-6 h-[60px] flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[var(--yo-dark)] flex items-center justify-center">
                <Home className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-extrabold text-[var(--yo-dark)] text-base">HousAlert</span>
            </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-[72px] h-[72px] rounded-lg bg-[#E6FAF5] flex items-center justify-center mb-8">
            <MailCheck className="w-8 h-8 text-[var(--yo-teal)]" />
          </div>

          <h1
            className="text-[28px] font-[800] text-[var(--yo-dark)] tracking-[-0.03em] leading-[1.1] uppercase mb-4 max-w-[320px]"
            data-testid="text-email-confirm-title"
          >
            Bevestig je e-mailadres
          </h1>

          <p
            className="text-[16px] leading-relaxed text-[var(--yo-dark)] mb-3 max-w-[340px]"
            data-testid="text-email-confirm-description"
          >
            We hebben een bevestigingslink gestuurd naar:
          </p>

          <p
            className="text-[16px] font-semibold text-[var(--yo-dark)] mb-8"
            data-testid="text-email-confirm-address"
          >
            {email}
          </p>

          <p className="text-[15px] text-[var(--yo-dark)] mb-10 max-w-[340px] leading-relaxed">
            Klik op de link in de e-mail om je account te activeren. Daarna kun je direct inloggen en beginnen met zoeken.
          </p>

          <button
            onClick={() => navigate("/login")}
            className="w-full max-w-[320px] min-h-[56px] rounded-lg bg-[var(--yo-teal)] hover:bg-[var(--yo-teal-hover)] text-black font-bold text-[16px] transition-colors shadow-[0_2px_12px_rgba(0,0,0,0.25)]"
            data-testid="button-go-login-after-confirm"
          >
            Naar inloggen
          </button>

          <p className="text-[13px] text-[var(--yo-dark)] mt-6 max-w-[300px]">
            Geen e-mail ontvangen? Controleer je spam-map of probeer opnieuw te registreren.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="w-full bg-white sticky top-0 z-20 border-b border-[var(--yo-divider)]">
        <div className="max-w-xl mx-auto px-6 h-[60px] flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--yo-surface)] transition-colors"
            data-testid="button-back-estimate"
          >
            <ChevronLeft className="w-5 h-5 text-[var(--yo-dark)]" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--yo-dark)] flex items-center justify-center">
              <Home className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-extrabold text-[var(--yo-dark)] text-base">HousAlert</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-xl mx-auto w-full px-6 pt-12 pb-16">
        <div className="text-center mb-10">
          <h1 className="text-[32px] font-[800] text-[var(--yo-dark)] tracking-[-0.03em] leading-[1.1] uppercase mb-4" data-testid="text-signup-title">
            Maak je account aan
          </h1>
          <p className="text-[15px] text-[var(--yo-dark)]">
            Ontvang direct meldingen voor nieuwe woningen{city ? <> in <span className="font-semibold text-[var(--yo-dark)]">{city}</span></> : ""}.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6">
          <form onSubmit={handleSignup} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-[14px] font-semibold text-[var(--yo-dark)]">Naam</Label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[var(--yo-dark)]" />
                <input
                  type="text"
                  placeholder="Je volledige naam"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-[52px] pl-11 pr-4 rounded-lg border-0 bg-[var(--yo-surface)] text-[15px] font-medium text-[var(--yo-dark)] placeholder:text-[var(--yo-dark)] placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[var(--yo-teal)]/15 focus:bg-white transition-all"
                  data-testid="input-signup-name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[14px] font-semibold text-[var(--yo-dark)]">E-mailadres</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[var(--yo-dark)]" />
                <input
                  type="email"
                  placeholder="jouw@email.nl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full h-[52px] pl-11 pr-4 rounded-lg border-0 bg-[var(--yo-surface)] text-[15px] font-medium text-[var(--yo-dark)] placeholder:text-[var(--yo-dark)] placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[var(--yo-teal)]/15 focus:bg-white transition-all"
                  data-testid="input-signup-email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[14px] font-semibold text-[var(--yo-dark)]">Wachtwoord</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[var(--yo-dark)]" />
                <input
                  type="password"
                  placeholder="Minimaal 6 tekens"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full h-[52px] pl-11 pr-4 rounded-lg border-0 bg-[var(--yo-surface)] text-[15px] font-medium text-[var(--yo-dark)] placeholder:text-[var(--yo-dark)] placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[var(--yo-teal)]/15 focus:bg-white transition-all"
                  data-testid="input-signup-password"
                />
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full h-[56px] rounded-lg text-[16px] font-bold shadow-none bg-[var(--yo-teal)] mt-1"
              disabled={loading || !email || !password}
              data-testid="button-signup-submit"
            >
              {loading ? "Account aanmaken..." : "Stuur me alle woningen"}
            </Button>
          </form>
        </div>

        <p className="text-center text-[15px] text-[var(--yo-dark)] mt-6">
          Heb je al een account?{" "}
          <button
            onClick={() => navigate("/login")}
            className="text-[var(--yo-pink)] font-semibold hover:underline"
            data-testid="link-login"
          >
            Inloggen
          </button>
        </p>

        <p className="text-center text-[13px] text-[var(--yo-dark)] mt-4">
          Door je aan te melden ga je akkoord met onze voorwaarden.
        </p>
      </main>
    </div>
  );
}
