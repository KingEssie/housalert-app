import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";
import { apiFetch } from "@/lib/api-base";
import { queryClient } from "@/lib/queryClient";
import { ArrowLeft, Loader2 } from "lucide-react";

interface HousingData {
  living_with?: string | null;
  work_situation?: string | null;
  move_reason?: string | null;
  gross_income?: number | null;
  pets?: string | null;
}

export default function HousingSituationPage() {
  const { session } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [data, setData] = useState<HousingData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session?.access_token) return;
    apiFetch("/api/profile-data", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        setData({
          living_with: d.living_with || "",
          work_situation: d.work_situation || "",
          move_reason: d.move_reason || "",
          gross_income: d.gross_income || undefined,
          pets: d.pets || "",
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session?.access_token]);

  async function handleSave() {
    if (!session?.access_token) return;
    setSaving(true);
    try {
      const res = await apiFetch("/api/profile-data", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      queryClient.invalidateQueries({ queryKey: ["/api/profile-data"] });
      toast({ title: t("settings.saved") });
      navigate("/settings");
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const fieldClass = "w-full bg-ha-bg rounded-[6px] px-4 py-3.5 text-[15px] text-ha-text placeholder:text-ha-text-muted border border-ha-card-border focus:border-ha-primary focus:shadow-[0_0_0_3px_rgba(233,30,99,0.08)] focus:outline-none transition-all";

  return (
    <div className="min-h-screen bg-ha-bg">
      <div className="sticky top-0 z-10 bg-ha-bg border-b border-ha-card-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate("/settings")}
          className="w-9 h-9 rounded-[6px] flex items-center justify-center active:bg-ha-surface transition-colors"
          data-testid="button-housing-back"
        >
          <ArrowLeft className="w-5 h-5 text-ha-text" />
        </button>
        <h1 className="text-[18px] text-title text-ha-text" data-testid="text-housing-title">
          {t("settings.housingSituation")}
        </h1>
      </div>

      <div className="max-w-[480px] mx-auto px-4 py-5 pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-ha-text-muted" />
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="rounded-[6px] bg-ha-card px-5 py-5">
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-[13px] font-medium text-ha-text-secondary mb-1.5 block">{t("settings.livingWith")}</label>
                  <input
                    type="text"
                    value={data.living_with || ""}
                    onChange={(e) => setData({ ...data, living_with: e.target.value })}
                    placeholder={t("settings.livingWithPlaceholder")}
                    className={fieldClass}
                    data-testid="input-living-with"
                  />
                </div>

                <div>
                  <label className="text-[13px] font-medium text-ha-text-secondary mb-1.5 block">{t("settings.workSituation")}</label>
                  <input
                    type="text"
                    value={data.work_situation || ""}
                    onChange={(e) => setData({ ...data, work_situation: e.target.value })}
                    placeholder={t("settings.workSituationPlaceholder")}
                    className={fieldClass}
                    data-testid="input-work-situation"
                  />
                </div>

                <div>
                  <label className="text-[13px] font-medium text-ha-text-secondary mb-1.5 block">{t("settings.moveReason")}</label>
                  <input
                    type="text"
                    value={data.move_reason || ""}
                    onChange={(e) => setData({ ...data, move_reason: e.target.value })}
                    placeholder={t("settings.moveReasonPlaceholder")}
                    className={fieldClass}
                    data-testid="input-move-reason"
                  />
                </div>

                <div>
                  <label className="text-[13px] font-medium text-ha-text-secondary mb-1.5 block">{t("settings.grossIncome")}</label>
                  <input
                    type="number"
                    value={data.gross_income || ""}
                    onChange={(e) => setData({ ...data, gross_income: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder={t("settings.grossIncomePlaceholder")}
                    className={fieldClass}
                    data-testid="input-gross-income"
                  />
                </div>

                <div>
                  <label className="text-[13px] font-medium text-ha-text-secondary mb-1.5 block">{t("settings.pets")}</label>
                  <input
                    type="text"
                    value={data.pets || ""}
                    onChange={(e) => setData({ ...data, pets: e.target.value })}
                    placeholder={t("settings.petsPlaceholder")}
                    className={fieldClass}
                    data-testid="input-pets"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full h-[52px] rounded-[6px] bg-ha-primary text-white text-[16px] font-semibold transition-colors hover:bg-ha-primary-hover active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              data-testid="button-housing-save"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {t("settings.save")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
