import { useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { ensureTrialForCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Home } from "lucide-react";

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setLoading(false);
      toast({ title: "Inloggen mislukt", description: error.message, variant: "destructive" });
      return;
    }

    await ensureTrialForCurrentUser();
    setLoading(false);
    navigate("/dashboard");
  }

  async function handleForgotPassword() {
    if (!email) {
      toast({ title: "Vul je e-mailadres in", description: "Voer eerst je e-mailadres in om je wachtwoord te resetten.", variant: "destructive" });
      return;
    }
    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/account/change-password`,
    });
    setResetLoading(false);
    if (error) {
      toast({ title: "Reset mislukt", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "E-mail verzonden", description: "Controleer je inbox voor de reset-link." });
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="w-full bg-white sticky top-0 z-20 border-b border-[var(--yo-divider)]">
        <div className="max-w-5xl mx-auto px-6 h-[60px] flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[var(--yo-dark)] flex items-center justify-center">
              <Home className="w-4 h-4 text-white" />
            </div>
            <span className="font-extrabold text-[var(--yo-dark)] text-lg tracking-tight">HousAlert</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-[28px] font-[800] text-[var(--yo-dark)] tracking-[-0.03em] leading-[1.1] mb-3" data-testid="text-login-title">
              Welkom terug
            </h1>
            <p className="text-[15px] text-[var(--yo-dark)]">
              Log in op je HousAlert account.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6">
            <form onSubmit={handleLogin} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="login-email" className="text-[14px] font-semibold text-[var(--yo-dark)]">E-mailadres</Label>
                <input
                  id="login-email"
                  type="email"
                  placeholder="jouw@email.nl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-[52px] px-4 rounded-lg border-0 bg-[var(--yo-surface)] text-[15px] font-medium text-[var(--yo-dark)] placeholder:text-[var(--yo-dark)] placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[var(--yo-teal)]/15 focus:bg-white transition-all"
                  data-testid="input-login-email"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="login-password" className="text-[14px] font-semibold text-[var(--yo-dark)]">Wachtwoord</Label>
                <input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-[52px] px-4 rounded-lg border-0 bg-[var(--yo-surface)] text-[15px] font-medium text-[var(--yo-dark)] placeholder:text-[var(--yo-dark)] placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[var(--yo-teal)]/15 focus:bg-white transition-all"
                  data-testid="input-login-password"
                />
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resetLoading}
                  className="self-end text-[13px] font-semibold text-[var(--yo-pink)] hover:underline mt-1"
                  data-testid="link-forgot-password"
                >
                  {resetLoading ? "Verzenden..." : "Wachtwoord vergeten?"}
                </button>
              </div>
              <Button
                type="submit"
                className="w-full h-[56px] rounded-lg text-[16px] font-bold bg-[var(--yo-teal)] text-black"
                disabled={loading}
                data-testid="button-login-submit"
              >
                {loading ? "Inloggen..." : "Inloggen"}
              </Button>
            </form>
          </div>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-[var(--yo-divider)]" />
            <span className="text-[13px] text-[var(--yo-dark)]">of</span>
            <div className="flex-1 h-px bg-[var(--yo-divider)]" />
          </div>

          <div className="text-center">
            <p className="text-[15px] text-[var(--yo-dark)] mb-3">Nog geen account?</p>
            <Button
              variant="outline"
              className="w-full h-[48px] rounded-lg text-[15px] font-bold border-[var(--yo-teal)] text-[var(--yo-dark)]"
              onClick={() => navigate("/signup")}
              data-testid="link-signup"
            >
              Account aanmaken
            </Button>
          </div>

          <p className="text-center text-[13px] text-[var(--yo-dark)] mt-6">
            Door je aan te melden ga je akkoord met onze voorwaarden.
          </p>
        </div>
      </main>
    </div>
  );
}
