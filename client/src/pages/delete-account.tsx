import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, AlertTriangle } from "lucide-react";

export default function DeleteAccountPage() {
  const { user, signOut } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      toast({
        title: "Account verwijderen",
        description: "Neem contact op met support@stekkies.nl om je account definitief te verwijderen.",
      });
      await signOut();
      navigate("/login");
    } catch {
      setDeleting(false);
      toast({ title: "Fout", description: "Er ging iets mis. Probeer het opnieuw.", variant: "destructive" });
    }
  }

  if (!user) {
    navigate("/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="sticky top-0 z-10 bg-white border-b border-[var(--yo-divider)]">
        <div className="max-w-lg mx-auto flex items-center h-[56px] px-5">
          <button
            onClick={() => navigate("/dashboard?tab=profiel&sub=account")}
            className="w-9 h-9 rounded-full bg-[var(--yo-surface)] flex items-center justify-center mr-3 active:scale-95 transition-transform"
            data-testid="button-delete-account-back"
          >
            <ArrowLeft className="w-4 h-4 text-[var(--yo-dark)]" />
          </button>
          <h1 className="text-[17px] font-bold text-[var(--yo-dark)] flex-1 uppercase tracking-wide">Account verwijderen</h1>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-[var(--yo-pink-light)] flex items-center justify-center mb-6">
          <AlertTriangle className="w-8 h-8 text-[var(--yo-pink)]" />
        </div>
        <h2 className="text-[22px] font-bold text-[var(--yo-dark)] mb-3 text-center" data-testid="text-delete-account-title">
          Account definitief verwijderen?
        </h2>
        <p className="text-[15px] text-[var(--yo-dark)] text-center max-w-[320px] mb-10 leading-relaxed" data-testid="text-delete-account-body">
          Al je gegevens, zoekprofielen en matches worden permanent verwijderd. Dit kan niet ongedaan worden gemaakt.
        </p>
        <div className="w-full max-w-[320px] flex flex-col gap-3">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="w-full h-[56px] rounded-lg bg-[var(--yo-pink)] text-white text-[16px] font-bold transition-colors hover:opacity-90 disabled:opacity-50"
            data-testid="button-delete-account-confirm"
          >
            {deleting ? "Verwijderen..." : "Ja, account verwijderen"}
          </button>
          <button
            onClick={() => navigate("/dashboard?tab=profiel&sub=account")}
            className="w-full h-[56px] rounded-lg border border-[var(--yo-divider)] text-[var(--yo-dark)] text-[16px] font-bold hover:bg-[var(--yo-surface)] transition-colors"
            data-testid="button-delete-account-cancel"
          >
            Annuleren
          </button>
        </div>
      </main>
    </div>
  );
}
