import { apiFetch } from "@/lib/api-base";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { createSearchProfile } from "@/lib/search-profiles";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, AlertCircle } from "lucide-react";
import { useTranslation } from "@/i18n";

export default function ContinueDraftPage() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [status, setStatus] = useState<"loading" | "needs-auth" | "claiming" | "done" | "error">("loading");
  const [draftData, setDraftData] = useState<any>(null);

  const params = new URLSearchParams(window.location.search);
  const draftId = params.get("draft");

  useEffect(() => {
    if (!draftId) {
      setStatus("error");
      return;
    }

    apiFetch(`/api/onboarding-drafts/${draftId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Draft not found");
        return res.json();
      })
      .then((data) => {
        setDraftData(data);
        if (authLoading) return;
        if (!user) {
          setStatus("needs-auth");
        } else {
          setStatus("claiming");
        }
      })
      .catch(() => {
        setStatus("error");
      });
  }, [draftId, authLoading, user]);

  useEffect(() => {
    if (status !== "claiming" || !user || !draftData) return;

    if (draftData.claimed_by && draftData.claimed_by !== user.id) {
      toast({ title: t("continueDraft.alreadyUsed"), description: t("continueDraft.alreadyUsedDesc"), variant: "destructive" });
      setStatus("error");
      return;
    }

    async function claimAndCreate() {
      try {
        const claimRes = await apiFetch(`/api/onboarding-drafts/${draftData.id}/claim`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: user!.id }),
        });
        if (!claimRes.ok) {
          const err = await claimRes.json().catch(() => ({ error: "Claim failed" }));
          throw new Error(err.error);
        }

        await createSearchProfile({
          user_id: user!.id,
          city_name: draftData.city_name,
          country_code: draftData.country_code,
          latitude: draftData.latitude,
          longitude: draftData.longitude,
          place_id: draftData.place_id,
          price_min: draftData.price_min || 0,
          price_max: draftData.price_max || 0,
          bedrooms_min: 1,
          size_min: 0,
          location_mode: draftData.location_mode,
          districts: draftData.districts?.length > 0 ? draftData.districts : undefined,
          radius_km: draftData.radius_km ?? undefined,
          commute_destination: draftData.commute_destination ?? undefined,
          commute_lat: draftData.commute_lat ?? undefined,
          commute_lng: draftData.commute_lng ?? undefined,
          commute_mode: draftData.commute_mode ?? undefined,
          commute_minutes: draftData.commute_minutes ?? undefined,
        });

        queryClient.invalidateQueries({ queryKey: ["/search-profiles"] });
        toast({ title: t("continueDraft.claimedSuccess"), description: t("continueDraft.claimedSuccessDesc") });
        navigate("/dashboard");
      } catch (err: any) {
        toast({ title: t("continueDraft.claimFailed"), description: err.message || t("continueDraft.claimFailedDesc"), variant: "destructive" });
        setStatus("error");
      }
    }

    claimAndCreate();
  }, [status, user, draftData]);

  useEffect(() => {
    if (status === "needs-auth") {
      navigate(`/signup?redirect=/continue?draft=${draftId}`);
    }
  }, [status, draftId, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="text-center">
        {(status === "loading" || status === "claiming") && (
          <>
            <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4" style={{ color: "#0D6EFD" }} />
            <p className="text-[16px] text-muted-foreground">
              {status === "loading" ? t("continueDraft.loading") : t("continueDraft.claiming")}
            </p>
          </>
        )}
        {status === "error" && (
          <>
            <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-4" />
            <p className="text-[16px] font-semibold mb-2" style={{ color: "#1F2937" }}>{t("continueDraft.notFound")}</p>
            <p className="text-[14px] text-muted-foreground mb-6">{t("continueDraft.linkExpired")}</p>
            <button
              onClick={() => navigate("/")}
              className="min-h-[48px] px-8 rounded-full bg-primary text-primary-foreground font-semibold text-[15px] transition-colors"
              data-testid="button-continue-home"
            >
              {t("continueDraft.toHome")}
            </button>
          </>
        )}
        {status === "done" && (
          <>
            <Check className="w-10 h-10 mx-auto mb-4" style={{ color: "#16A34A" }} />
            <p className="text-[16px] font-semibold" style={{ color: "#1F2937" }}>{t("continueDraft.claimed")}</p>
          </>
        )}
      </div>
    </div>
  );
}
