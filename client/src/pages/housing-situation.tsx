import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";
import { apiFetch } from "@/lib/api-base";
import { queryClient } from "@/lib/queryClient";
import { Loader2, ChevronDown } from "lucide-react";
import { AppHeader } from "@/components/ui/app-header";

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

  const LIVING_WITH_OPTIONS = [
    { value: "", label: t("housing.selectOption") },
    { value: "alone", label: t("housing.livingAlone") },
    { value: "partner", label: t("housing.livingPartner") },
    { value: "partner_children", label: t("housing.livingPartnerChildren") },
    { value: "children", label: t("housing.livingChildren") },
    { value: "friend", label: t("housing.livingFriend") },
    { value: "family", label: t("housing.livingFamily") },
    { value: "other", label: t("housing.livingOther") },
  ];

  const WORK_SITUATION_OPTIONS = [
    { value: "", label: t("housing.selectOption") },
    { value: "employed", label: t("housing.workEmployed") },
    { value: "self_employed", label: t("housing.workSelfEmployed") },
    { value: "student", label: t("housing.workStudent") },
    { value: "retired", label: t("housing.workRetired") },
    { value: "unemployed", label: t("housing.workUnemployed") },
    { value: "other", label: t("housing.workOther") },
  ];

  const MOVE_REASON_OPTIONS = [
    { value: "", label: t("housing.selectOption") },
    { value: "job_change", label: t("housing.moveJobChange") },
    { value: "study", label: t("housing.moveStudy") },
    { value: "relationship", label: t("housing.moveRelationship") },
    { value: "larger_home", label: t("housing.moveLargerHome") },
    { value: "smaller_home", label: t("housing.moveSmallerHome") },
    { value: "cheaper", label: t("housing.moveCheaper") },
    { value: "neighborhood", label: t("housing.moveNeighborhood") },
    { value: "other", label: t("housing.moveOther") },
  ];

  const PETS_OPTIONS = [
    { value: "", label: t("housing.selectOption") },
    ...Array.from({ length: 11 }, (_, i) => ({
      value: String(i),
      label: String(i),
    })),
  ];

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
      navigate("/dashboard?tab=profiel");
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const labelClass = "text-field-label mb-2 block";

  function renderSelect(value: string, options: { value: string; label: string }[], onChange: (v: string) => void, testId: string) {
    const hasValue = !!value;
    return (
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className={`app-select ${hasValue ? "" : "text-ha-icon-secondary"}`}
          data-testid={testId}
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#111111] pointer-events-none" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#eaeaeb" }}>
      <AppHeader title={t("settings.housingSituation")} onBack={() => navigate("/dashboard?tab=profiel")} />

      <div className="max-w-[480px] mx-auto px-4 py-5 pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-ha-icon-secondary" />
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="app-card">
              <div className="flex flex-col gap-5">
                <div>
                  <label className={labelClass}>{t("settings.livingWith")}</label>
                  {renderSelect(data.living_with || "", LIVING_WITH_OPTIONS, v => setData({ ...data, living_with: v }), "select-living-with")}
                </div>

                <div>
                  <label className={labelClass}>{t("settings.workSituation")}</label>
                  {renderSelect(data.work_situation || "", WORK_SITUATION_OPTIONS, v => setData({ ...data, work_situation: v }), "select-work-situation")}
                </div>

                <div>
                  <label className={labelClass}>{t("settings.moveReason")}</label>
                  {renderSelect(data.move_reason || "", MOVE_REASON_OPTIONS, v => setData({ ...data, move_reason: v }), "select-move-reason")}
                </div>

                <div>
                  <label className={labelClass}>{t("settings.grossIncome")}</label>
                  <input
                    type="number"
                    value={data.gross_income || ""}
                    onChange={(e) => setData({ ...data, gross_income: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder={t("settings.grossIncomePlaceholder")}
                    className="app-input"
                    data-testid="input-gross-income"
                  />
                </div>

                <div>
                  <label className={labelClass}>{t("settings.pets")}</label>
                  {renderSelect(data.pets || "", PETS_OPTIONS, v => setData({ ...data, pets: v }), "select-pets")}
                </div>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full ha-btn bg-ha-primary text-white font-semibold hover:bg-ha-primary-hover"
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
