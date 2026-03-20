import { apiFetch } from "@/lib/api-base";
import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useTranslation } from "@/i18n";
import { Loader2, X } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

interface ProfileData {
  first_name?: string | null;
  last_name?: string | null;
  birth_date?: string | null;
  phone?: string | null;
  bio?: string | null;
  occupation?: string | null;
  monthly_income?: number | null;
}

interface FieldConfig {
  key: string;
  label: string;
  type: string;
  placeholder: string;
  dbField: string;
  editable: boolean;
}

export default function ProfileDetailsPage() {
  const { user, session } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();

  const FIELDS: FieldConfig[] = [
    { key: "first_name", label: t("profileEdit.firstName"), type: "text", placeholder: t("profileEdit.firstNamePlaceholder"), dbField: "first_name", editable: true },
    { key: "last_name", label: t("profileEdit.lastName"), type: "text", placeholder: t("profileEdit.lastNamePlaceholder"), dbField: "last_name", editable: true },
    { key: "birth_date", label: t("profileEdit.birthDate"), type: "date", placeholder: t("profileEdit.birthDatePlaceholder"), dbField: "birth_date", editable: true },
    { key: "email", label: t("profileDetails.email"), type: "email", placeholder: "", dbField: "email", editable: false },
    { key: "phone", label: t("profileEdit.phone"), type: "tel", placeholder: t("profileEdit.phonePlaceholder"), dbField: "phone", editable: true },
    { key: "occupation", label: t("profileEdit.occupation"), type: "text", placeholder: t("profileEdit.occupationPlaceholder"), dbField: "occupation", editable: true },
    { key: "monthly_income", label: t("profileEdit.income"), type: "number", placeholder: t("profileEdit.incomePlaceholder"), dbField: "monthly_income", editable: true },
  ];

  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedField, setExpandedField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!session?.access_token) return;
    apiFetch("/api/profile-data", { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then(r => {
        if (!r.ok) throw new Error(`Status ${r.status}`);
        return r.json();
      })
      .then(pd => {
        setProfileData(pd);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        toast({ title: t("common.error"), description: t("profileDetails.loadFailed"), variant: "destructive" });
      });
  }, [session?.access_token]);

  function getFieldValue(key: string): string {
    if (key === "email") return user?.email ?? "";
    if (key === "phone") return profileData?.phone ?? "";
    if (key === "first_name") return profileData?.first_name ?? "";
    if (key === "last_name") return profileData?.last_name ?? "";
    if (key === "birth_date") return profileData?.birth_date ?? "";
    if (key === "occupation") return profileData?.occupation ?? "";
    if (key === "monthly_income") return profileData?.monthly_income != null ? String(profileData.monthly_income) : "";
    return "";
  }

  function getDisplayValue(key: string): string {
    const raw = getFieldValue(key);
    if (!raw) return t("profileDetails.notProvided");
    if (key === "monthly_income") return `€${raw}`;
    return raw;
  }

  function handleExpand(field: FieldConfig) {
    if (expandedField === field.key) {
      setExpandedField(null);
      return;
    }
    setExpandedField(field.key);
    setEditValue(getFieldValue(field.key));
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleCancel() {
    setExpandedField(null);
    setEditValue("");
  }

  async function handleSave(field: FieldConfig) {
    if (!session?.access_token) return;
    setSaving(true);

    try {
      const fieldValue = field.dbField === "monthly_income"
        ? (editValue.trim() ? parseInt(editValue.trim(), 10) || null : null)
        : (editValue.trim() || null);

      const res = await apiFetch("/api/profile-data", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ [field.dbField]: fieldValue }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t("profileEdit.saveFailed"));
      }

      queryClient.invalidateQueries({ queryKey: ["/api/profile-data"] });
      if (field.dbField === "phone") {
        queryClient.invalidateQueries({ queryKey: ["/api/notifications/settings"] });
      }

      setProfileData(prev => prev ? { ...prev, [field.dbField]: fieldValue } : prev);
      setExpandedField(null);
      setEditValue("");
      toast({ title: t("profileEdit.saved") });
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message || t("profileEdit.saveFailed"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <PageHeader title={t("profileDetails.title")} onBack={() => navigate("/dashboard?tab=profiel")} />

      <div className="max-w-lg mx-auto px-6 pt-2 pb-12">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-[#D1D5DB]" />
          </div>
        ) : (
          <div className="flex flex-col">
            {FIELDS.map((field, idx) => {
              const hasValue = !!getFieldValue(field.key);
              const isExpanded = expandedField === field.key;
              const isLast = idx === FIELDS.length - 1;

              return (
                <div key={field.key} className={!isLast ? "border-b border-[#F0F0F0]" : ""}>
                  <div
                    className="flex items-start justify-between py-6"
                    data-testid={`field-${field.key}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] text-[#9CA3AF] mb-1">{field.label}</p>
                      <p className={`text-[15px] leading-snug ${hasValue ? "text-[#18181B]" : "text-[#D1D5DB]"}`}>
                        {getDisplayValue(field.key)}
                      </p>
                    </div>
                    {field.editable && (
                      <button
                        onClick={() => isExpanded ? handleCancel() : handleExpand(field)}
                        className="text-[14px] font-medium text-[#18181B] underline underline-offset-2 ml-4 flex-shrink-0 mt-3 active:text-[#6B7280] transition-colors"
                        data-testid={`button-edit-${field.key}`}
                      >
                        {isExpanded ? t("profileDetails.cancel") : (hasValue ? t("profileDetails.edit") : t("profileDetails.add"))}
                      </button>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="pb-6 animate-in slide-in-from-top-1 duration-200" data-testid={`editor-${field.key}`}>
                      <div className="relative mb-4">
                        <input
                          ref={inputRef}
                          type={field.type}
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          placeholder={field.placeholder}
                          onKeyDown={e => { if (e.key === "Enter") handleSave(field); }}
                          className="w-full bg-white rounded-2xl px-5 py-4 text-[16px] text-[#18181B] placeholder:text-[#C4C4C4] border border-[#E5E7EB] focus:border-[#18181B] focus:outline-none transition-colors h-[56px]"
                          data-testid="input-edit-field"
                        />
                        {editValue && (
                          <button
                            type="button"
                            onClick={() => { setEditValue(""); inputRef.current?.focus(); }}
                            className="absolute right-4 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-[#F3F4F6] flex items-center justify-center active:scale-90 transition-transform"
                            data-testid="button-clear-field"
                          >
                            <X className="w-3.5 h-3.5 text-[#6B7280]" />
                          </button>
                        )}
                      </div>
                      <button
                        onClick={() => handleSave(field)}
                        disabled={saving}
                        className="h-[48px] px-8 rounded-xl bg-[#18181B] text-white text-[15px] font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
                        data-testid="button-save-field"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t("profileDetails.saveAndContinue")}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
