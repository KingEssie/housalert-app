import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";
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
  "w-full h-[52px] px-4 rounded-[8px] border border-[#C7CDD4] bg-white text-[16px] font-normal text-[#000000] placeholder:text-[#9CA3AF] outline-none transition-all focus:border-ha-primary focus:ring-1 focus:ring-ha-primary/20";

export default function ZoekbuddyPage() {
  const { session } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();

  const { data: connections, isLoading } = useBuddyConnections();

  const [emailInput, setEmailInput] = useState("");
  const [inviting, setInviting] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const asOwner = connections?.asOwner ?? null;
  const isConnected = asOwner?.invite_status === "accepted";
  const isPending  = asOwner?.invite_status === "pending";

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
      if (!res.ok) throw new Error(data.error || t("zoekbuddyPage.inviteError"));
      queryClient.invalidateQueries({ queryKey: ["/api/buddy/connections"] });
      toast({ title: t("zoekbuddyPage.inviteSentToast") });
      setEmailInput("");
    } catch (err: any) {
      toast({ title: err.message || t("zoekbuddyPage.inviteError"), variant: "destructive" });
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
      if (!res.ok) throw new Error(t("zoekbuddyPage.removeError"));
      queryClient.invalidateQueries({ queryKey: ["/api/buddy/connections"] });
      toast({ title: t("zoekbuddyPage.removedToast") });
    } catch {
      toast({ title: t("zoekbuddyPage.removeError"), variant: "destructive" });
    } finally {
      setRevoking(false);
    }
  }

  async function handleCopyLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast({ title: t("zoekbuddyPage.linkCopied") });
    } catch {
      toast({ title: t("zoekbuddyPage.linkCopyFailed"), variant: "destructive" });
    }
  }

  async function handleShareLink() {
    if (!inviteLink) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: t("zoekbuddyPage.shareAppTitle"), url: inviteLink });
      } catch {}
    } else {
      await handleCopyLink();
    }
  }

  const ALLOWED_ITEMS = [
    t("zoekbuddyPage.allow1"),
    t("zoekbuddyPage.allow2"),
    t("zoekbuddyPage.allow3"),
  ];
  const NOT_ALLOWED_ITEMS = [
    t("zoekbuddyPage.deny1"),
    t("zoekbuddyPage.deny2"),
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#eaeaeb" }}>
      <AppHeader title={t("zoekbuddyPage.pageTitle")} onBack={() => navigate("/dashboard?tab=profiel")} />

      <div className="flex-1 max-w-[480px] mx-auto w-full px-4 py-5 pb-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-[#9CA3AF]" />
          </div>
        ) : isConnected ? (
          /* ── STATE B: CONNECTED ── */
          <div className="flex flex-col gap-3">
            <div className="app-card !p-5">
              <h2 className="text-[21px] font-bold text-[#000000] mb-1">{t("zoekbuddyPage.connectedTitle")}</h2>
              <p className="text-[16px] text-[#000000] mb-5 leading-snug">
                {t("zoekbuddyPage.connectedDesc")}
              </p>

              {/* Buddy email row */}
              <div className="flex items-center gap-3 py-3 border-t border-[#E5E7EB]">
                <Mail className="w-[19px] h-[19px] text-[#000000] flex-shrink-0" strokeWidth={1.8} />
                <span className="text-[16px] text-[#000000] font-medium break-all" data-testid="text-buddy-email">
                  {asOwner?.invite_email}
                </span>
              </div>

              {/* Action rows */}
              {inviteLink && (
                <>
                  <button
                    onClick={handleShareLink}
                    className="flex items-center gap-3 w-full py-3 border-t border-[#E5E7EB] text-left"
                    data-testid="button-share-link"
                  >
                    <Share2 className="w-[19px] h-[19px] text-[#000000] flex-shrink-0" strokeWidth={1.8} />
                    <span className="text-[16px] text-[#000000] font-medium">{t("zoekbuddyPage.shareLink")}</span>
                  </button>

                  <button
                    onClick={handleCopyLink}
                    className="flex items-center gap-3 w-full py-3 border-t border-[#E5E7EB] text-left"
                    data-testid="button-copy-link-connected"
                  >
                    <Copy className="w-[19px] h-[19px] text-[#000000] flex-shrink-0" strokeWidth={1.8} />
                    <span className="text-[16px] text-[#000000] font-medium">{t("zoekbuddyPage.copyLink")}</span>
                  </button>
                </>
              )}

              {/* Subtle revoke — intentionally de-emphasised */}
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
                <span className="text-[14px] text-[#9CA3AF]">{t("zoekbuddyPage.removeLabel")}</span>
              </button>
            </div>
          </div>
        ) : (
          /* ── STATE A: NO BUDDY (or pending) ── */
          <div className="flex flex-col gap-3">
            {/* Pending status banner */}
            {isPending && (
              <div className="app-card !p-4 flex items-start gap-3">
                <Clock className="w-[19px] h-[19px] text-[#F59E0B] flex-shrink-0 mt-0.5" strokeWidth={2} />
                <div>
                  <p className="text-[15px] font-semibold text-[#000000]">{t("zoekbuddyPage.pendingTitle")}</p>
                  <p className="text-[14px] font-medium text-[#000000] leading-snug mt-0.5">
                    {t("zoekbuddyPage.waitingFor").replace("{email}", asOwner?.invite_email || "")}
                  </p>
                </div>
              </div>
            )}

            {/* Info panel */}
            <div className="app-card !p-5">
              <h2 className="text-[21px] font-bold text-[#000000] mb-2">
                {t("zoekbuddyPage.introTitle")}
              </h2>
              <p className="text-[16px] font-medium text-[#000000] mb-4 leading-snug">
                {t("zoekbuddyPage.introSubtitle")}
              </p>

              {/* Permission list */}
              <div className="flex flex-col gap-3 mb-5">
                {ALLOWED_ITEMS.map(item => (
                  <div key={item} className="flex items-center gap-3">
                    <CheckCircle2
                      className="flex-shrink-0 w-[20px] h-[20px]"
                      fill="#16A34A"
                      stroke="white"
                      strokeWidth={2}
                    />
                    <span className="text-[16px] font-medium text-[#000000]">{item}</span>
                  </div>
                ))}
                {NOT_ALLOWED_ITEMS.map(item => (
                  <div key={item} className="flex items-center gap-3">
                    <XCircle
                      className="flex-shrink-0 w-[20px] h-[20px]"
                      fill="#DC2626"
                      stroke="white"
                      strokeWidth={2}
                    />
                    <span className="text-[16px] font-medium text-[#000000]">{item}</span>
                  </div>
                ))}
              </div>

              {/* Email input — only when no pending invite */}
              {!isPending && (
                <div>
                  <label className="text-[16px] font-semibold text-[#000000] mb-2 block">
                    {t("zoekbuddyPage.emailLabel")}
                  </label>
                  <input
                    type="email"
                    inputMode="email"
                    value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                    placeholder={t("zoekbuddyPage.emailPlaceholder")}
                    className={INPUT_CLS}
                    data-testid="input-buddy-email"
                  />
                </div>
              )}

              {/* Copy link row when pending */}
              {isPending && inviteLink && (
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-3 py-3 border-t border-[#E5E7EB] w-full text-left mt-1"
                  data-testid="button-copy-link-pending"
                >
                  <Copy className="w-[19px] h-[19px] text-[#000000] flex-shrink-0" strokeWidth={1.8} />
                  <span className="text-[16px] font-medium text-[#000000]">{t("zoekbuddyPage.copyLink")}</span>
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
              <button
                onClick={handleShareLink}
                className="w-full h-[52px] rounded-[10px] bg-ha-primary hover:bg-ha-primary-hover text-white text-[16px] font-semibold transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
                data-testid="button-share-link-bottom"
              >
                <Share2 className="w-4 h-4" strokeWidth={2} />
                {t("zoekbuddyPage.shareInviteLink")}
              </button>
            ) : isPending ? (
              <>
                <button
                  onClick={handleShareLink}
                  className="w-full h-[52px] rounded-[10px] bg-ha-primary hover:bg-ha-primary-hover text-white text-[16px] font-semibold transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
                  data-testid="button-share-pending"
                >
                  <Share2 className="w-4 h-4" strokeWidth={2} />
                  {t("zoekbuddyPage.shareInviteLink")}
                </button>
                <button
                  onClick={handleRevoke}
                  disabled={revoking}
                  className="w-full h-[44px] rounded-[10px] border border-[#E5E7EB] bg-white text-[14px] text-[#9CA3AF] font-medium transition-colors hover:bg-[#F9FAFB] active:scale-[0.98] flex items-center justify-center gap-2"
                  data-testid="button-cancel-invite"
                >
                  {revoking ? <Loader2 className="w-4 h-4 animate-spin" /> : t("zoekbuddyPage.cancelInvite")}
                </button>
              </>
            ) : (
              <button
                onClick={handleInvite}
                disabled={inviting || !emailInput.trim()}
                className="w-full h-[52px] rounded-[10px] bg-ha-primary hover:bg-ha-primary-hover text-white text-[16px] font-semibold transition-colors active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                data-testid="button-invite-buddy"
              >
                {inviting && <Loader2 className="w-4 h-4 animate-spin" />}
                {t("zoekbuddyPage.invite")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
