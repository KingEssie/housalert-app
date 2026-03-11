import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { ensureTrialForCurrentUser } from "@/lib/auth";
import { Loader2 } from "lucide-react";

export default function AuthCallbackPage() {
  const [, navigate] = useLocation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (!code) {
      setError("Kein Bestätigungscode gefunden.");
      return;
    }

    supabase.auth
      .exchangeCodeForSession(code)
      .then(async ({ error: exchangeErr }) => {
        if (exchangeErr) {
          console.error("[auth-callback] Exchange failed:", exchangeErr.message);
          setError("Verifizierung fehlgeschlagen. Bitte erneut anmelden.");
          return;
        }

        const trialOk = await ensureTrialForCurrentUser();
        if (!trialOk) {
          console.error("[auth-callback] Trial creation failed after email verification — continuing anyway");
        }

        navigate("/dashboard", { replace: true });
      })
      .catch((err) => {
        console.error("[auth-callback] Unexpected error:", err);
        setError("Etwas ist schiefgelaufen. Bitte erneut anmelden.");
      });
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FFFFFF] px-6">
        <p className="text-[#1F2937] font-semibold text-lg mb-4" data-testid="text-auth-error">{error}</p>
        <button
          onClick={() => navigate("/login")}
          className="min-h-[56px] px-8 rounded-full bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white font-bold text-[16px] transition-colors"
          data-testid="button-go-login"
        >
          Zum Login
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FFFFFF]">
      <Loader2 className="w-8 h-8 animate-spin text-[#0D6EFD]" />
      <p className="mt-4 text-[#1F2937] font-medium" data-testid="text-auth-verifying">E-Mail wird verifiziert...</p>
    </div>
  );
}
