import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useTranslation } from "@/i18n";
import { Loader2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

export default function ProfileEditPage() {
  const [, params] = useRoute("/profile/edit/:field");
  const field = params?.field ?? "";
  const { t } = useTranslation();

  const FIELD_CONFIG: Record<string, { question: string; label: string; type: string; placeholder: string; dbField: string }> = {
    first_name: { question: t("profileEdit.firstNameQ"), label: t("profileEdit.firstName"), type: "text", placeholder: t("profileEdit.firstNamePlaceholder"), dbField: "first_name" },
    last_name: { question: t("profileEdit.lastNameQ"), label: t("profileEdit.lastName"), type: "text", placeholder: t("profileEdit.lastNamePlaceholder"), dbField: "last_name" },
    birth_date: { question: t("profileEdit.birthDateQ"), label: t("profileEdit.birthDate"), type: "date", placeholder: t("profileEdit.birthDatePlaceholder"), dbField: "birth_date" },
    phone: { question: t("profileEdit.phoneQ"), label: t("profileEdit.phone"), type: "tel", placeholder: t("profileEdit.phonePlaceholder"), dbField: "phone" },
    occupation: { question: t("profileEdit.occupationQ"), label: t("profileEdit.occupation"), type: "text", placeholder: t("profileEdit.occupationPlaceholder"), dbField: "occupation" },
    monthly_income: { question: t("profileEdit.incomeQ"), label: t("profileEdit.income"), type: "number", placeholder: t("profileEdit.incomePlaceholder"), dbField: "monthly_income" },
  };

  const config = FIELD_CONFIG[field];

  const { session } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session?.access_token || !config) return;
    const headers = { Authorization: `Bearer ${session.access_token}` };

    fetch("/api/profile-data", { headers })
      .then(r => r.json())
      .then(d => {
        const v = d?.[config.dbField];
        setValue(v != null ? String(v) : "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session?.access_token, field]);

  if (!config) {
    navigate("/profile/details");
    return null;
  }

  async function handleSave() {
    if (!session?.access_token) return;
    setSaving(true);

    try {
      const headers = { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` };

      const fieldValue = config.dbField === "monthly_income"
        ? (value.trim() ? parseInt(value.trim(), 10) || null : null)
        : (value.trim() || null);

      const res = await fetch("/api/profile-data", {
        method: "PUT",
        headers,
        body: JSON.stringify({ [config.dbField]: fieldValue }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("[profile-edit] Save failed:", config.dbField, err);
        throw new Error(err.error || t("profileEdit.saveFailed"));
      }

      queryClient.invalidateQueries({ queryKey: ["/api/profile-data"] });
      if (config.dbField === "phone") {
        queryClient.invalidateQueries({ queryKey: ["/api/notifications/settings"] });
      }

      toast({ title: t("profileEdit.saved") });
      navigate("/profile/details");
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message || t("profileEdit.saveFailed"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title={config.question} onBack={() => navigate("/profile/details")} />

      <div className="max-w-xl mx-auto px-5">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col gap-6">

            <input
              type={config.type}
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder={config.placeholder}
              className="w-full bg-muted rounded-lg px-4 py-3.5 text-[16px] text-foreground placeholder:text-muted-foreground border-0 outline-none focus:ring-2 focus:ring-primary h-[52px]"
              data-testid="input-edit-field"
            />

            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full h-[52px] rounded-lg bg-primary text-primary-foreground text-[15px] font-semibold"
              data-testid="button-save-field"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : t("common.save")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
