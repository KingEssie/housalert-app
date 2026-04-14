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
  living_with: string;
  work_status: string;
  move_reason: string;
  monthly_income: string;
  pets_count: string;
}

const FIELD_LABEL = "text-[15px] font-semibold text-[#000000] mb-2 block";
const SELECT_CLS = "w-full h-[52px] px-4 pr-10 rounded-[8px] border border-[#D1D5DB] bg-white text-[16px] font-normal appearance-none outline-none transition-all focus:border-ha-primary focus:ring-1 focus:ring-ha-primary/20";
const INPUT_CLS  = "w-full h-[52px] px-4 rounded-[8px] border border-[#D1D5DB] bg-white text-[16px] font-normal text-[#000000] placeholder:text-[#9CA3AF] outline-none transition-all focus:border-ha-primary focus:ring-1 focus:ring-ha-primary/20";

export default function HousingSituationPage() {
  const { session } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [data, setData] = useState<HousingData>({
    living_with: "",
    work_status: "",
    move_reason: "",
    monthly_income: "",
    pets_count: "",
  });
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

  const WORK_STATUS_OPTIONS = [
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
      .then(r => r.json())
      .then(d => {
        setData({
          living_with:    d.living_with    ?? "",
          work_status:    d.work_status    ?? "",
          move_reason:    d.move_reason    ?? "",
          monthly_income: d.monthly_income != null ? String(d.monthly_income) : "",
          pets_count:     d.pets_count     != null ? String(d.pets_count)     : "",
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session?.access_token]);

  async function handleSave() {
    if (!session?.access_token) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        living_with:  data.living_with  || null,
        work_status:  data.work_status  || null,
        move_reason:  data.move_reason  || null,
        monthly_income: data.monthly_income !== "" ? Number(data.monthly_income) : null,
        pets_count:   data.pets_count   !== "" ? Number(data.pets_count)   : null,
      };
      const res = await apiFetch("/api/profile-data", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed");
      queryClient.invalidateQueries({ queryKey: ["/api/profile-data"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile-strength"] });
      toast({ title: t("settings.saved") });
      navigate("/dashboard?tab=profiel");
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function renderSelect(
    value: string,
    options: { value: string; label: string }[],
    onChange: (v: string) => void,
    testId: string,
  ) {
    return (
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className={`${SELECT_CLS} ${!value ? "text-[#9CA3AF]" : "text-[#000000]"}`}
          data-testid={testId}
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-[16px] h-[16px] text-[#000000] pointer-events-none" strokeWidth={2} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#eaeaeb" }}>
      <AppHeader title={t("settings.housingSituation")} onBack={() => navigate("/dashboard?tab=profiel")} />

      <div className="max-w-[480px] mx-auto px-4 py-5 pb-10">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-[#9CA3AF]" />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="app-card !p-5">
              <div className="flex flex-col gap-5">

                {/* Met wie ga je wonen? */}
                <div>
                  <label className={FIELD_LABEL}>{t("settings.livingWith")}</label>
                  {renderSelect(data.living_with, LIVING_WITH_OPTIONS, v => setData(d => ({ ...d, living_with: v })), "select-living-with")}
                </div>

                {/* Werksituatie */}
                <div>
                  <label className={FIELD_LABEL}>{t("settings.workSituation")}</label>
                  {renderSelect(data.work_status, WORK_STATUS_OPTIONS, v => setData(d => ({ ...d, work_status: v })), "select-work-situation")}
                </div>

                {/* Reden voor verhuizing */}
                <div>
                  <label className={FIELD_LABEL}>{t("settings.moveReason")}</label>
                  {renderSelect(data.move_reason, MOVE_REASON_OPTIONS, v => setData(d => ({ ...d, move_reason: v })), "select-move-reason")}
                </div>

                {/* Bruto maandinkomen */}
                <div>
                  <label className={FIELD_LABEL}>{t("settings.grossIncome")}</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={data.monthly_income}
                    onChange={e => setData(d => ({ ...d, monthly_income: e.target.value }))}
                    placeholder={t("settings.grossIncomePlaceholder")}
                    className={INPUT_CLS}
                    data-testid="input-gross-income"
                  />
                </div>

                {/* Huisdieren */}
                <div>
                  <label className={FIELD_LABEL}>{t("settings.pets")}</label>
                  {renderSelect(data.pets_count, PETS_OPTIONS, v => setData(d => ({ ...d, pets_count: v })), "select-pets")}
                </div>

              </div>
            </div>

            {/* Opslaan — white anchored container */}
            <div className="app-card !p-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full h-[52px] rounded-[10px] bg-ha-primary hover:bg-ha-primary-hover text-white text-[16px] font-semibold transition-colors active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                data-testid="button-housing-save"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {t("settings.save")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
