import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-base";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";

export function useReferralShare() {
  const { session } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  const { data: referralData } = useQuery<{
    code: string;
    totalInvited: number;
    pending: number;
    qualified: number;
    rewarded: number;
  }>({
    queryKey: ["/api/referrals/me"],
    queryFn: async () => {
      const token = session?.access_token;
      if (!token) throw new Error("No token");
      const res = await apiFetch("/api/referrals/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!session?.access_token,
  });

  function getReferralUrl(): string {
    const code = referralData?.code;
    if (!code) return "";
    const isProd = window.location.hostname === "app.housalert.com";
    const base = isProd ? "https://app.housalert.com" : window.location.origin;
    return `${base}/?ref=${code}`;
  }

  const handleReferralShare = useCallback(async () => {
    const url = getReferralUrl();
    if (!url) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: t("referral.nativeShareTitle"),
          text: t("referral.nativeShareText"),
          url,
        });
        toast({ title: t("referral.linkShared"), description: t("referral.linkSharedDesc") });
        return;
      } catch {}
    }

    try {
      await navigator.clipboard.writeText(url);
      toast({ title: t("referral.linkCopied"), description: t("referral.linkCopiedDesc") });
    } catch {
      toast({ title: t("referral.copyFailed"), description: t("referral.copyFailedDesc"), variant: "destructive" });
    }
  }, [referralData, toast, t]);

  return { handleReferralShare, referralData };
}
