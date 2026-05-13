import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";
import { apiFetch } from "@/lib/api-base";
import { queryClient } from "@/lib/queryClient";
import { useBuddyConnections } from "@/lib/buddy";
import { AppHeader } from "@/components/ui/app-header";
import { OwnerDisconnectSheet } from "@/components/ui/owner-disconnect-sheet";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Copy,
  Share2,
  Link2Off,
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
  "w-full h-[60px] px-4 rounded-[18px] bg-white text-[16px] font-normal text-[#111111] placeholder:text-[#aaa] outline-none transition-all";

const INPUT_STYLE = { border: "1px solid #d9d3e3" };

export default function ZoekbuddyPage() {
  const { session } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();

  const { data: connections, isLoading } = useBuddyConnections();

  const [emailInput, setEmailInput] = useState("");
  const [inviting, setInviting] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [showDisconnectSheet, setShowDisconnectSheet] = useState(false);

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
      setShowDisconnectSheet(false);
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
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#f9f7f8" }}>
      <AppHeader title={t("zoekbuddyPage.pageTitle")} onBack={() => { if (window.history.length > 1) window.history.back(); else navigate("/dashboard?tab=profile"); }} />

      <div className="flex-1 max-w-[480px] mx-auto w-full px-4 py-5 pb-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-ha-text-placeholder" />
          </div>
        ) : isConnected ? (
          /* ── STATE B: CONNECTED ── */
          <div
            className="bg-white rounded-[28px] p-5"
            style={{ border: "1px solid #ece7ef", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
          >
            <h2 className="text-[21px] font-bold text-[#111111] mb-1">{t("zoekbuddyPage.connectedTitle")}</h2>
            <p className="text-[16px] mb-5 leading-snug" style={{ color: "#444444" }}>
              {t("zoekbuddyPage.connectedDesc")}
            </p>

            <div className="flex items-center gap-3 py-3 border-t" style={{ borderColor: "#ece7ef" }}>
              <Mail className="w-[19px] h-[19px] text-[#111111] flex-shrink-0" strokeWidth={1.8} />
              <span className="text-[16px] text-[#111111] font-medium break-all" data-testid="text-buddy-email">
                {asOwner?.invite_email}
              </span>
            </div>
          </div>
        ) : (
          /* ── STATE A: NO BUDDY (or pending) ── */
          <div className="flex flex-col gap-3">
            {/* Pending status banner */}
            {isPending && (
              <div
                className="bg-white rounded-[28px] p-4 flex items-start gap-3"
                style={{ border: "1px solid #ece7ef", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
              >
                <Clock className="w-[19px] h-[19px] text-ha-warning flex-shrink-0 mt-0.5" strokeWidth={2} />
                <div>
                  <p className="text-[15px] font-bold text-[#111111]">{t("zoekbuddyPage.pendingTitle")}</p>
                  <p className="text-[14px] font-medium leading-snug mt-0.5" style={{ color: "#444444" }}>
                    {t("zoekbuddyPage.waitingFor").replace("{email}", asOwner?.invite_email || "")}
                  </p>
                </div>
              </div>
            )}

            {/* Info panel */}
            <div
              className="bg-white rounded-[28px] p-5"
              style={{ border: "1px solid #ece7ef", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
            >
              {/* Purple info banner */}
              <div className="rounded-[16px] px-4 py-3 mb-5" style={{ backgroundColor: "#f3edff" }}>
                <h2 className="text-[18px] font-bold text-[#111111] mb-1">
                  {t("zoekbuddyPage.introTitle")}
                </h2>
                <p className="text-[14px] leading-snug" style={{ color: "#444444" }}>
                  {t("zoekbuddyPage.introSubtitle")}
                </p>
              </div>

              {/* Permission list */}
              <div className="flex flex-col gap-3 mb-5">
                {ALLOWED_ITEMS.map(item => (
                  <div key={item} className="flex items-center gap-3">
                    <div
                      className="w-[22px] h-[22px] rounded-full flex items-center justify-center flex-shrink-0 bg-white"
                      style={{ border: "1.5px solid rgb(var(--ha-success))" }}
                    >
                      <CheckCircle2
                        className="w-[18px] h-[18px]"
                        fill="rgb(var(--ha-success))"
                        stroke="white"
                        strokeWidth={2}
                      />
                    </div>
                    <span className="text-[15px] font-medium text-[#111111]">{item}</span>
                  </div>
                ))}
                {NOT_ALLOWED_ITEMS.map(item => (
                  <div key={item} className="flex items-center gap-3">
                    <XCircle
                      className="flex-shrink-0 w-[20px] h-[20px]"
                      fill="rgb(var(--ha-danger))"
                      stroke="white"
                      strokeWidth={2}
                    />
                    <span className="text-[15px] font-medium text-[#111111]">{item}</span>
                  </div>
                ))}
              </div>

              {/* Email input — only when no pending invite */}
              {!isPending && (
                <div>
                  <label className="text-[15px] font-bold text-[#111111] mb-2 block">
                    {t("zoekbuddyPage.emailLabel")}
                  </label>
                  <input
                    type="email"
                    inputMode="email"
                    value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                    placeholder={t("zoekbuddyPage.emailPlaceholder")}
                    className={INPUT_CLS}
                    style={INPUT_STYLE}
                    onFocus={e => { e.currentTarget.style.borderColor = "#b9a7ff"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(185,167,255,0.2)"; }}
                    onBlur={e => { e.currentTarget.style.borderColor = "#d9d3e3"; e.currentTarget.style.boxShadow = "none"; }}
                    data-testid="input-buddy-email"
                  />
                </div>
              )}

              {/* Copy link row when pending */}
              {isPending && inviteLink && (
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-3 py-3 border-t w-full text-left mt-1 transition-opacity active:opacity-70"
                  style={{ borderColor: "#ece7ef" }}
                  data-testid="button-copy-link-pending"
                >
                  <Copy className="w-[19px] h-[19px] text-[#111111] flex-shrink-0" strokeWidth={1.8} />
                  <span className="text-[16px] font-medium text-[#111111]">{t("zoekbuddyPage.copyLink")}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sticky bottom bar */}
      {!isLoading && (
        <div className="sticky bottom-0 bg-white border-t border-ha-card-border px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="max-w-[480px] mx-auto flex flex-col gap-2">
            {isConnected ? (
              <button
                onClick={() => setShowDisconnectSheet(true)}
                className="w-full h-[56px] rounded-full border border-ha-danger/20 bg-ha-danger/5 hover:bg-ha-danger/10 text-[16px] font-bold text-ha-btn-destructive transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
                data-testid="button-unlink-buddy"
              >
                <Link2Off className="w-[18px] h-[18px]" strokeWidth={2} />
                {t("zoekbuddyPage.removeLabel")}
              </button>
            ) : isPending ? (
              <>
                <button
                  onClick={handleShareLink}
                  className="w-full h-[56px] rounded-full font-bold text-white text-[16px] transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
                  style={{ backgroundColor: "#223546" }}
                  data-testid="button-share-pending"
                >
                  <Share2 className="w-4 h-4" strokeWidth={2} />
                  {t("zoekbuddyPage.shareInviteLink")}
                </button>
                <button
                  onClick={() => setShowDisconnectSheet(true)}
                  className="w-full h-[48px] rounded-full border text-[14px] font-medium transition-colors hover:opacity-80 active:scale-[0.98] flex items-center justify-center gap-2"
                  style={{ borderColor: "#ece7ef", color: "#666666" }}
                  data-testid="button-cancel-invite"
                >
                  {t("zoekbuddyPage.cancelInvite")}
                </button>
              </>
            ) : (
              <button
                onClick={handleInvite}
                disabled={inviting || !emailInput.trim()}
                className="w-full h-[56px] rounded-full font-bold text-white text-[16px] transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
                style={
                  inviting || !emailInput.trim()
                    ? { backgroundColor: "#dcefd8", color: "rgba(0,0,0,0.35)", cursor: "not-allowed" }
                    : { backgroundColor: "#223546" }
                }
                data-testid="button-invite-buddy"
              >
                {inviting && <Loader2 className="w-4 h-4 animate-spin" />}
                {t("zoekbuddyPage.invite")}
              </button>
            )}
          </div>
        </div>
      )}

      <OwnerDisconnectSheet
        open={showDisconnectSheet}
        onClose={() => setShowDisconnectSheet(false)}
        onConfirm={handleRevoke}
        loading={revoking}
      />
    </div>
  );
}
