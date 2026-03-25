import { apiFetch } from "@/lib/api-base";
import { useState, useEffect, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useTranslation } from "@/i18n";
import { Loader2, X } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

export default function ProfileEditPage() {
  const [, params] = useRoute("/profile/edit/:field");
  const field = params?.field ?? "";
  const { t } = useTranslation();

  const FIELD_CONFIG: Record<string, { question: string; label: string; type: string; placeholder: string; dbField: string; description?: string }> = {
    first_name: { question: t("profileEdit.firstNameQ"), label: t("profileEdit.firstName"), type: "text", placeholder: t("profileEdit.firstNamePlaceholder"), dbField: "first_name" },
    last_name: { question: t("profileEdit.lastNameQ"), label: t("profileEdit.lastName"), type: "text", placeholder: t("profileEdit.lastNamePlaceholder"), dbField: "last_name" },
    birth_date: { question: t("profileEdit.birthDateQ"), label: t("profileEdit.birthDate"), type: "date", placeholder: t("profileEdit.birthDatePlaceholder"), dbField: "birth_date" },
    phone: { question: t("profileEdit.phoneQ"), label: t("profileEdit.phone"), type: "tel", placeholder: t("profileEdit.phonePlaceholder"), dbField: "phone" },
    occupation: { question: t("profileEdit.occupationQ"), label: t("profileEdit.occupation"), type: "text", placeholder: t("profileEdit.occupationPlaceholder"), dbField: "occupation" },
    monthly_income: { question: t("profileEdit.incomeQ"), label: t("profileEdit.income"), type: "number", placeholder: t("profileEdit.incomePlaceholder"), dbField: "monthly_income" },
    search_buddy_email: { question: t("profileEdit.searchBuddyQ"), label: t("profileEdit.searchBuddyLabel"), type: "email", placeholder: t("profileEdit.searchBuddyPlaceholder"), dbField: "search_buddy_email", description: t("profileEdit.searchBuddyDesc") },
  };

  const config = FIELD_CONFIG[field];

  const { session } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session?.access_token || !config) return;
    const headers = { Authorization: `Bearer ${session.access_token}` };

    apiFetch("/api/profile-data", { headers })
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

      const res = await apiFetch("/api/profile-data", {
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
      navigate(field === "search_buddy_email" ? "/dashboard?tab=profiel" : "/profile/details");
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message || t("profileEdit.saveFailed"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function handleClear() {
    setValue("");
    inputRef.current?.focus();
  }

  return (
    <div className="min-h-screen bg-ha-bg flex flex-col">
      <PageHeader title={config.question} onBack={() => navigate(field === "search_buddy_email" ? "/dashboard?tab=profiel" : "/profile/details")} />

      <div className="flex-1 max-w-xl mx-auto px-5 w-full">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-ha-text-secondary" />
          </div>
        ) : (
          <div>
            {config.description && (
              <p className="text-[14px] text-ha-text-secondary leading-relaxed mb-4">{config.description}</p>
            )}
            <div className="relative">
            <input
              ref={inputRef}
              type={config.type}
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder={config.placeholder}
              aria-label={config.label}
              className="w-full bg-ha-card rounded-[20px] pl-6 pr-12 py-4 text-[16px] text-ha-text placeholder:text-ha-text-muted border border-ha-card-border focus:border-ha-primary focus:shadow-[0_0_0_3px_rgba(233,30,99,0.08)] focus:outline-none transition-all h-[60px]"
              data-testid="input-edit-field"
            />
            {value && (
              <button
                type="button"
                onClick={handleClear}
                aria-label="Clear"
                className="absolute right-4 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-ha-surface flex items-center justify-center active:scale-90 transition-transform"
                data-testid="button-clear-field"
              >
                <X className="w-3.5 h-3.5 text-ha-text-secondary" />
              </button>
            )}
            </div>
          </div>
        )}
      </div>

      {!loading && (
        <div className="sticky bottom-0 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 px-5 bg-gradient-to-t from-ha-bg via-ha-bg to-transparent">
          <div className="max-w-xl mx-auto flex justify-center">
            <button
              onClick={handleSave}
              disabled={saving}
              className="h-[48px] px-10 rounded-full bg-ha-primary hover:bg-ha-primary-hover text-white text-[16px] font-medium flex items-center justify-center transition-colors disabled:opacity-50"
              data-testid="button-save-field"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : t("common.save")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
