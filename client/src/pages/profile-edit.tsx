import { apiFetch } from "@/lib/api-base";
import { useState, useEffect, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useTranslation } from "@/i18n";
import { Loader2, X } from "lucide-react";
import { AppHeader } from "@/components/ui/app-header";

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
  const [buddyRevokedByBuddy, setBuddyRevokedByBuddy] = useState(false);

  useEffect(() => {
    if (!session?.access_token || !config) return;
    const headers = { Authorization: `Bearer ${session.access_token}` };

    apiFetch("/api/profile-data", { headers })
      .then(r => r.json())
      .then(d => {
        if (config.dbField === "search_buddy_email" && d?.search_buddy_status === "revoked_by_buddy") {
          setBuddyRevokedByBuddy(true);
          setValue("");
        } else {
          setBuddyRevokedByBuddy(false);
          const v = d?.[config.dbField];
          setValue(v != null ? String(v) : "");
        }
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
      if (config.dbField === "search_buddy_email") {
        queryClient.invalidateQueries({ queryKey: ["/api/profile-strength"] });
      }

      toast({ title: t("profileEdit.saved") });
      navigate("/dashboard?tab=profiel");
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

  const isBuddyField = field === "search_buddy_email";

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#F9FAFB" }}>
      <AppHeader title={isBuddyField ? "" : config.question} onBack={() => navigate("/dashboard?tab=profiel")} />

      <div className="flex-1 max-w-xl mx-auto px-5 w-full">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-ha-icon-secondary" />
          </div>
        ) : isBuddyField ? (
          <div className="flex flex-col items-center pt-6">
            <h1 className="text-[24px] font-bold text-[#111111] text-center leading-tight" data-testid="text-buddy-title">{config.question}</h1>
            {config.description && (
              <p className="text-[15px] text-[#6B7280] text-center leading-relaxed mt-3 max-w-[320px]">{config.description}</p>
            )}
            {buddyRevokedByBuddy && (
              <p className="text-[13px] text-[#9CA3AF] text-center mt-2">{t("profileEdit.buddyUnsubscribed")}</p>
            )}
            <div className="w-full mt-6">
              <div className="relative">
                <input
                  ref={inputRef}
                  type={config.type}
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  placeholder={config.placeholder}
                  aria-label={config.label}
                  className="w-full h-[52px] rounded-[14px] border border-[#E5E7EB] bg-white px-4 text-[16px] text-[#111111] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-ha-primary/30 focus:border-ha-primary transition-all pr-12"
                  data-testid="input-edit-field"
                />
                {value && (
                  <button
                    type="button"
                    onClick={handleClear}
                    aria-label="Clear"
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-[#F3F4F6] flex items-center justify-center active:scale-90 transition-transform"
                    data-testid="button-clear-field"
                  >
                    <X className="w-3.5 h-3.5 text-[#6B7280]" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="app-card">
            {config.description && (
              <p className="text-[15px] text-ha-text-secondary leading-relaxed mb-4">{config.description}</p>
            )}
            <div className="relative">
              <input
                ref={inputRef}
                type={config.type}
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder={config.placeholder}
                aria-label={config.label}
                className="app-input !pr-12"
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
                  <X className="w-3.5 h-3.5 text-ha-text-muted" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {!loading && (
        <div className="sticky bottom-0 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 px-5" style={{ background: "linear-gradient(to top, #F9FAFB, #F9FAFB 80%, transparent)" }}>
          <div className="max-w-xl mx-auto">
            <button
              onClick={handleSave}
              disabled={saving}
              className={`w-full h-[52px] rounded-full bg-ha-primary hover:bg-ha-primary-hover text-white text-[16px] font-bold flex items-center justify-center transition-colors disabled:opacity-50 active:scale-[0.97]`}
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
