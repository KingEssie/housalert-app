import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

export default function AuthCallbackPage() {
  const [, navigate] = useLocation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (!code) {
      setError("Geen verificatiecode gevonden.");
      return;
    }

    supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error: exchangeErr }) => {
        if (exchangeErr) {
          console.error("[auth-callback] Exchange failed:", exchangeErr.message);
          setError("Verificatie mislukt. Probeer opnieuw in te loggen.");
          return;
        }
        navigate("/dashboard", { replace: true });
      })
      .catch((err) => {
        console.error("[auth-callback] Unexpected error:", err);
        setError("Er ging iets mis. Probeer opnieuw in te loggen.");
      });
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--yo-bg)] px-6">
        <p className="text-[var(--yo-dark)] font-semibold text-lg mb-4" data-testid="text-auth-error">{error}</p>
        <button
          onClick={() => navigate("/login")}
          className="min-h-[56px] px-8 rounded-lg bg-[var(--yo-teal)] hover:bg-[var(--yo-teal-hover)] text-black font-bold text-[16px] transition-colors"
          data-testid="button-go-login"
        >
          Naar inloggen
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--yo-bg)]">
      <Loader2 className="w-8 h-8 animate-spin text-[var(--yo-teal)]" />
      <p className="mt-4 text-[var(--yo-text)] font-medium" data-testid="text-auth-verifying">E-mail wordt geverifieerd...</p>
    </div>
  );
}
