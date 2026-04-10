import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useAcceptInvite, useBuddyInvites } from "@/lib/buddy";
import { useTranslation } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";

export default function BuddyAcceptPage() {
  const { t } = useTranslation();
  const { user, session, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const acceptMutation = useAcceptInvite();
  const invitesQuery = useBuddyInvites();

  const [status, setStatus] = useState<"loading" | "ready" | "accepted" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [ownerName, setOwnerName] = useState<string | null>(null);

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") || "";

  useEffect(() => {
    if (authLoading) return;

    if (!user || !session) {
      if (token) {
        localStorage.setItem("housalert_buddy_accept_token", token);
      }
      navigate("/");
      return;
    }

    const storedToken = localStorage.getItem("housalert_buddy_accept_token");
    const effectiveToken = token || storedToken || "";

    if (!effectiveToken) {
      setStatus("error");
      setErrorMsg(t("buddyV2.acceptError"));
      return;
    }

    if (storedToken && !token) {
      window.history.replaceState({}, "", `/buddy/accept?token=${encodeURIComponent(effectiveToken)}`);
    }

    if (invitesQuery.data?.invites) {
      const matching = invitesQuery.data.invites.find(inv => inv.invite_token === effectiveToken);
      if (matching?.owner_name) {
        setOwnerName(matching.owner_name);
      }
    }

    setStatus("ready");
  }, [authLoading, user, session, token, invitesQuery.data]);

  async function handleAccept() {
    const storedToken = localStorage.getItem("housalert_buddy_accept_token");
    const effectiveToken = token || storedToken || "";
    if (!effectiveToken) return;
    try {
      await acceptMutation.mutateAsync(effectiveToken);
      localStorage.removeItem("housalert_buddy_accept_token");
      setStatus("accepted");
      toast({ title: t("buddyV2.acceptSuccess") });
      setTimeout(() => navigate("/home"), 2000);
    } catch (err: any) {
      const msg = err.message || "";
      if (msg.includes("different email")) {
        setErrorMsg(t("buddyV2.acceptEmailMismatch"));
      } else if (msg.includes("Already accepted")) {
        setErrorMsg(t("buddyV2.acceptAlready"));
      } else {
        setErrorMsg(t("buddyV2.acceptError"));
      }
      setStatus("error");
    }
  }

  if (authLoading || status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
        <Loader2 className="w-8 h-8 animate-spin text-ha-primary" />
      </div>
    );
  }

  if (status === "accepted") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] px-5">
        <div className="w-full max-w-[400px] text-center">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-[22px] font-bold text-[#111111] mb-2" data-testid="text-accept-success">{t("buddyV2.acceptSuccess")}</h1>
          <p className="text-[15px] text-[#334855] leading-relaxed">
            {ownerName ? t("buddyV2.modeBanner").replace("{name}", ownerName) : ""}
          </p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] px-5">
        <div className="w-full max-w-[400px] text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-[22px] font-bold text-[#111111] mb-2">{errorMsg}</h1>
          <button
            onClick={() => navigate("/home")}
            className="mt-6 h-[48px] px-8 rounded-[16px] bg-ha-primary text-white text-[15px] font-semibold hover:bg-ha-primary-hover transition-colors active:scale-[0.97]"
            data-testid="button-accept-go-home"
          >
            {t("common.back")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] px-5">
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-[#FFF0F5] flex items-center justify-center mx-auto mb-6">
            <Users className="w-8 h-8 text-ha-primary" />
          </div>
          <h1 className="text-[24px] font-bold text-[#111111] mb-3 leading-tight" data-testid="text-accept-title">
            {t("buddyV2.acceptTitle")}
          </h1>
          {ownerName && (
            <p className="text-[16px] text-[#111111] font-medium mb-1" data-testid="text-accept-owner">
              {t("buddyV2.modeBanner").replace("{name}", ownerName)}
            </p>
          )}
        </div>

        <div className="rounded-[16px] bg-white border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.03)] p-5 mb-6">
          <p className="text-[15px] text-[#334855] leading-relaxed mb-4" data-testid="text-accept-body">
            {t("buddyV2.acceptBody").replace("{name}", ownerName || "")}
          </p>
          <div className="flex items-start gap-2.5 bg-[#F9FAFB] rounded-[12px] p-3.5">
            <ShieldCheck className="w-[18px] h-[18px] text-[#334855] mt-0.5 flex-shrink-0" />
            <p className="text-[13px] text-[#334855] leading-relaxed" data-testid="text-accept-note">
              {t("buddyV2.acceptNote")}
            </p>
          </div>
        </div>

        <button
          onClick={handleAccept}
          disabled={acceptMutation.isPending}
          className="w-full h-[56px] rounded-[16px] bg-ha-primary text-white text-[16px] font-semibold hover:bg-ha-primary-hover transition-colors active:scale-[0.97] disabled:opacity-50 flex items-center justify-center gap-2"
          data-testid="button-accept-invite"
        >
          {acceptMutation.isPending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            t("buddyV2.acceptCta")
          )}
        </button>

        <button
          onClick={() => navigate("/home")}
          className="w-full h-[48px] mt-3 text-[15px] font-medium text-[#334855] hover:text-[#111111] transition-colors"
          data-testid="button-accept-decline"
        >
          {t("buddyV2.acceptDecline")}
        </button>
      </div>
    </div>
  );
}
