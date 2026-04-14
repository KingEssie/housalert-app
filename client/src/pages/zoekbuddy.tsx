import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-base";
import { queryClient } from "@/lib/queryClient";
import { useBuddyConnections } from "@/lib/buddy";
import { AppHeader } from "@/components/ui/app-header";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Copy,
  Share2,
  UserMinus,
  Clock,
  Mail,
} from "lucide-react";

const PROD_BASE = "https://app.housalert.com";

function buildInviteLink(token: string) {
  const base =
    typeof window !== "undefined" && window.location.hostname !== "localhost"
      ? PROD_BASE
      : window.location.origin;
  return `${base}/buddy/accept?token=${encodeURIComponent(token)}`;
}

const INPUT_CLS =
  "w-full h-[52px] px-4 rounded-[8px] border border-[#D1D5DB] bg-white text-[16px] font-normal text-[#000000] placeholder:text-[#9CA3AF] outline-none transition-all focus:border-ha-primary focus:ring-1 focus:ring-ha-primary/20";

const ALLOWED_ITEMS = [
  "Woningalerts ontvangen via de app",
  "Woningen markeren als favoriet",
  "Reageren op woningen",
];
const NOT_ALLOWED_ITEMS = [
  "Zoekopdrachten beheren",
  "Reactiebrief beheren",
];

export default function ZoekbuddyPage() {
  const { session } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: connections, isLoading } = useBuddyConnections();

  const [emailInput, setEmailInput] = useState("");
  const [inviting, setInviting] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const asOwner = connections?.asOwner ?? null;
  const isConnected = asOwner?.invite_status === "accepted";
  const isPending  = asOwner?.invite_status === "pending";
  const hasBuddy   = isConnected || isPending;

  const inviteLink = asOwner?.invite_token ? buildInviteLink(asOwner.invite_token) : null;

  async function handleInvite() {
    if (!session?.access_token || !emailInput.trim()) return;
    setInviting(true);
    try {
      const res = await apiFetch("/api/buddy/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ email: emailInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Uitnodiging mislukt");
      queryClient.invalidateQueries({ queryKey: ["/api/buddy/connections"] });
      toast({ title: "Uitnodiging verstuurd" });
      setEmailInput("");
    } catch (err: any) {
      toast({ title: err.message || "Fout bij uitnodigen", variant: "destructive" });
    } finally {
      setInviting(false);
    }
  }

  async function handleRevoke() {
    if (!session?.access_token || !asOwner?.id) return;
    setRevoking(true);
    try {
      const res = await apiFetch("/api/buddy/revoke", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ relationId: asOwner.id }),
      });
      if (!res.ok) throw new Error("Verwijderen mislukt");
      queryClient.invalidateQueries({ queryKey: ["/api/buddy/connections"] });
      toast({ title: "Zoekbuddy verwijderd" });
    } catch {
      toast({ title: "Fout bij verwijderen", variant: "destructive" });
    } finally {
      setRevoking(false);
    }
  }

  async function handleCopyLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast({ title: "Link gekopieerd" });
    } catch {
      toast({ title: "Kon link niet kopiëren", variant: "destructive" });
    }
  }

  async function handleShareLink() {
    if (!inviteLink) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "HousAlert Zoekbuddy", url: inviteLink });
      } catch {}
    } else {
      await handleCopyLink();
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#eaeaeb" }}>
      <AppHeader title="Zoekbuddy beheren" onBack={() => navigate("/dashboard?tab=profiel")} />

      <div className="flex-1 max-w-[480px] mx-auto w-full px-4 py-5 pb-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-[#9CA3AF]" />
          </div>
        ) : isConnected ? (
          /* ── STATE B: CONNECTED ── */
          <div className="flex flex-col gap-3">
            <div className="app-card !p-5">
              <h2 className="text-[18px] font-bold text-[#000000] mb-1">Zoekbuddy verbonden</h2>
              <p className="text-[14px] text-[#000000] mb-5 leading-snug">
                Je zoekbuddy is gekoppeld en kan meezoeken in de app.
              </p>

              {/* Buddy email row */}
              <div className="flex items-center gap-3 py-3 border-t border-[#E5E7EB]">
                <Mail className="w-[18px] h-[18px] text-[#000000] flex-shrink-0" strokeWidth={1.8} />
                <span className="text-[15px] text-[#000000] font-medium break-all" data-testid="text-buddy-email">
                  {asOwner?.invite_email}
                </span>
              </div>

              {/* Share link row */}
              {inviteLink && (
                <>
                  <button
                    onClick={handleShareLink}
                    className="flex items-center gap-3 w-full py-3 border-t border-[#E5E7EB] text-left"
                    data-testid="button-share-link"
                  >
                    <Share2 className="w-[18px] h-[18px] text-[#000000] flex-shrink-0" strokeWidth={1.8} />
                    <span className="text-[15px] text-[#000000] font-medium">Deel link</span>
                  </button>

                  <button
                    onClick={handleCopyLink}
                    className="flex items-center gap-3 w-full py-3 border-t border-[#E5E7EB] text-left"
                    data-testid="button-copy-link-connected"
                  >
                    <Copy className="w-[18px] h-[18px] text-[#000000] flex-shrink-0" strokeWidth={1.8} />
                    <span className="text-[15px] text-[#000000] font-medium">Link kopiëren</span>
                  </button>
                </>
              )}

              {/* Subtle revoke */}
              <button
                onClick={handleRevoke}
                disabled={revoking}
                className="flex items-center gap-3 w-full py-3 border-t border-[#E5E7EB] text-left mt-1"
                data-testid="button-revoke-buddy"
              >
                {revoking
                  ? <Loader2 className="w-[18px] h-[18px] animate-spin text-[#9CA3AF] flex-shrink-0" />
                  : <UserMinus className="w-[18px] h-[18px] text-[#9CA3AF] flex-shrink-0" strokeWidth={1.8} />
                }
                <span className="text-[14px] text-[#9CA3AF]">Zoekbuddy verwijderen</span>
              </button>
            </div>
          </div>
        ) : (
          /* ── STATE A: NO BUDDY (or pending) ── */
          <div className="flex flex-col gap-3">
            {/* Pending status banner */}
            {isPending && (
              <div className="app-card !p-4 flex items-start gap-3">
                <Clock className="w-[18px] h-[18px] text-[#F59E0B] flex-shrink-0 mt-0.5" strokeWidth={1.8} />
                <div>
                  <p className="text-[14px] font-semibold text-[#000000]">Uitnodiging verstuurd</p>
                  <p className="text-[13px] text-[#000000] leading-snug mt-0.5">
                    Wachtend op acceptatie van <strong>{asOwner?.invite_email}</strong>
                  </p>
                </div>
              </div>
            )}

            {/* Info panel */}
            <div className="app-card !p-5">
              <h2 className="text-[18px] font-bold text-[#000000] mb-1">
                Samen wonen? Samen zoeken!
              </h2>
              <p className="text-[14px] text-[#000000] mb-4 leading-snug">
                Je zoekbuddy kan:
              </p>

              <div className="flex flex-col gap-2.5 mb-5">
                {ALLOWED_ITEMS.map(item => (
                  <div key={item} className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-[17px] h-[17px] text-[#16A34A] flex-shrink-0" strokeWidth={2} />
                    <span className="text-[14px] text-[#000000]">{item}</span>
                  </div>
                ))}
                {NOT_ALLOWED_ITEMS.map(item => (
                  <div key={item} className="flex items-center gap-2.5">
                    <XCircle className="w-[17px] h-[17px] text-[#DC2626] flex-shrink-0" strokeWidth={2} />
                    <span className="text-[14px] text-[#000000]">{item}</span>
                  </div>
                ))}
              </div>

              {/* Email input — only when no pending */}
              {!isPending && (
                <div>
                  <label className="text-[14px] font-semibold text-[#000000] mb-2 block">
                    E-mailadres zoekbuddy
                  </label>
                  <input
                    type="email"
                    inputMode="email"
                    value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                    placeholder="naam@voorbeeld.nl"
                    className={INPUT_CLS}
                    data-testid="input-buddy-email"
                  />
                </div>
              )}

              {/* Copy link when pending */}
              {isPending && inviteLink && (
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-2.5 py-3 border-t border-[#E5E7EB] w-full text-left mt-1"
                  data-testid="button-copy-link-pending"
                >
                  <Copy className="w-[17px] h-[17px] text-[#000000] flex-shrink-0" strokeWidth={1.8} />
                  <span className="text-[14px] text-[#000000] font-medium">Link kopiëren</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sticky bottom bar */}
      {!isLoading && (
        <div className="sticky bottom-0 bg-white border-t border-[#E5E7EB] px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="max-w-[480px] mx-auto flex flex-col gap-2">
            {isConnected ? (
              /* Connected primary action */
              <button
                onClick={handleShareLink}
                className="w-full h-[52px] rounded-[10px] bg-ha-primary hover:bg-ha-primary-hover text-white text-[16px] font-semibold transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
                data-testid="button-share-link-bottom"
              >
                <Share2 className="w-4 h-4" strokeWidth={2} />
                Deel uitnodigingslink
              </button>
            ) : isPending ? (
              /* Pending: share + secondary resend option */
              <>
                <button
                  onClick={handleShareLink}
                  className="w-full h-[52px] rounded-[10px] bg-ha-primary hover:bg-ha-primary-hover text-white text-[16px] font-semibold transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
                  data-testid="button-share-pending"
                >
                  <Share2 className="w-4 h-4" strokeWidth={2} />
                  Deel uitnodigingslink
                </button>
                <button
                  onClick={handleRevoke}
                  disabled={revoking}
                  className="w-full h-[44px] rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] text-[#9CA3AF] font-medium transition-colors hover:bg-[#F9FAFB] active:scale-[0.98] flex items-center justify-center gap-2"
                  data-testid="button-cancel-invite"
                >
                  {revoking ? <Loader2 className="w-4 h-4 animate-spin" /> : "Uitnodiging annuleren"}
                </button>
              </>
            ) : (
              /* No buddy: invite button */
              <button
                onClick={handleInvite}
                disabled={inviting || !emailInput.trim()}
                className="w-full h-[52px] rounded-[10px] bg-ha-primary hover:bg-ha-primary-hover text-white text-[16px] font-semibold transition-colors active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                data-testid="button-invite-buddy"
              >
                {inviting && <Loader2 className="w-4 h-4 animate-spin" />}
                Uitnodigen
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
