import { apiFetch } from "@/lib/api-base";
import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useTranslation } from "@/i18n";
import { supabase } from "@/lib/supabase";
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

type SectionKey = "name" | "email" | "birth_date" | "phone" | "occupation" | "monthly_income";

export default function ProfileDetailsPage() {
  const { user, session } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSection, setExpandedSection] = useState<SectionKey | null>(null);
  const [saving, setSaving] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [emailValue, setEmailValue] = useState("");
  const [emailPending, setEmailPending] = useState(false);
  const [editValue, setEditValue] = useState("");

  const firstNameRef = useRef<HTMLInputElement>(null);
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

  const fullName = [profileData?.first_name, profileData?.last_name].filter(Boolean).join(" ");

  function getSimpleValue(key: SectionKey): string {
    if (key === "email") return user?.email ?? "";
    if (key === "name") return fullName;
    if (key === "birth_date") return profileData?.birth_date ?? "";
    if (key === "phone") return profileData?.phone ?? "";
    if (key === "occupation") return profileData?.occupation ?? "";
    if (key === "monthly_income") return profileData?.monthly_income != null ? String(profileData.monthly_income) : "";
    return "";
  }

  function getDisplayValue(key: SectionKey): string {
    const raw = getSimpleValue(key);
    if (!raw) return t("profileDetails.notProvided");
    if (key === "monthly_income") return `€${raw}`;
    return raw;
  }

  function handleExpand(key: SectionKey) {
    if (expandedSection === key) {
      setExpandedSection(null);
      return;
    }
    setExpandedSection(key);

    if (key === "name") {
      setFirstName(profileData?.first_name ?? "");
      setLastName(profileData?.last_name ?? "");
      setTimeout(() => firstNameRef.current?.focus(), 50);
    } else if (key === "email") {
      setEmailValue("");
      setEmailPending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setEditValue(getSimpleValue(key));
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleCancel() {
    setExpandedSection(null);
  }

  async function handleSaveName() {
    if (!session?.access_token) return;
    setSaving(true);
    try {
      const res = await apiFetch("/api/profile-data", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ first_name: firstName.trim() || null, last_name: lastName.trim() || null }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        console.error("[profile-details] Save name failed:", res.status, errBody);
        throw new Error(errBody.error || t("profileEdit.saveFailed"));
      }

      queryClient.invalidateQueries({ queryKey: ["/api/profile-data"] });
      setProfileData(prev => prev ? { ...prev, first_name: firstName.trim() || null, last_name: lastName.trim() || null } : prev);
      setExpandedSection(null);
      toast({ title: t("profileEdit.saved") });
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEmail() {
    if (!emailValue.trim() || !emailValue.includes("@")) return;
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: emailValue.trim() });
      if (error) throw error;
      setEmailPending(true);
      toast({ title: t("profileDetails.emailConfirmationSent"), description: t("profileDetails.emailConfirmationDesc") });
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message || t("profileEdit.saveFailed"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveField(dbField: string) {
    if (!session?.access_token) return;
    setSaving(true);
    try {
      const fieldValue = dbField === "monthly_income"
        ? (editValue.trim() ? parseInt(editValue.trim(), 10) || null : null)
        : (editValue.trim() || null);

      const res = await apiFetch("/api/profile-data", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ [dbField]: fieldValue }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        console.error("[profile-details] Save failed:", dbField, res.status, errBody);
        throw new Error(errBody.error || t("profileEdit.saveFailed"));
      }

      queryClient.invalidateQueries({ queryKey: ["/api/profile-data"] });
      if (dbField === "phone") {
        queryClient.invalidateQueries({ queryKey: ["/api/notifications/settings"] });
      }
      setProfileData(prev => prev ? { ...prev, [dbField]: fieldValue } : prev);
      setExpandedSection(null);
      setEditValue("");
      toast({ title: t("profileEdit.saved") });
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const SECTIONS: { key: SectionKey; label: string; dbField: string; type: string; placeholder: string }[] = [
    { key: "name", label: t("profileDetails.name"), dbField: "name", type: "text", placeholder: "" },
    { key: "birth_date", label: t("profileEdit.birthDate"), dbField: "birth_date", type: "date", placeholder: t("profileEdit.birthDatePlaceholder") },
    { key: "email", label: t("profileDetails.email"), dbField: "email", type: "email", placeholder: t("profileDetails.newEmailPlaceholder") },
    { key: "phone", label: t("profileEdit.phone"), dbField: "phone", type: "tel", placeholder: t("profileEdit.phonePlaceholder") },
    { key: "occupation", label: t("profileEdit.occupation"), dbField: "occupation", type: "text", placeholder: t("profileEdit.occupationPlaceholder") },
    { key: "monthly_income", label: t("profileEdit.income"), dbField: "monthly_income", type: "number", placeholder: t("profileEdit.incomePlaceholder") },
  ];

  function renderInput(type: string, value: string, onChange: (v: string) => void, placeholder: string, ref?: any, onEnter?: () => void) {
    return (
      <div className="relative">
        <input
          ref={ref}
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          onKeyDown={e => { if (e.key === "Enter" && onEnter) onEnter(); }}
          className="w-full bg-white rounded-2xl px-5 py-4 text-[16px] text-[#222222] placeholder:text-[#C4C4C4] border border-[#E5E7EB] focus:border-[#F97316] focus:shadow-[0_0_0_3px_rgba(249,115,22,0.08)] focus:outline-none transition-all h-[56px]"
          data-testid="input-edit-field"
        />
        {value && (
          <button
            type="button"
            onClick={() => { onChange(""); ref?.current?.focus(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-[#F3F4F6] flex items-center justify-center active:scale-90 transition-transform"
            data-testid="button-clear-field"
          >
            <X className="w-3.5 h-3.5 text-[#717171]" />
          </button>
        )}
      </div>
    );
  }

  function renderSaveButton(onClick: () => void) {
    return (
      <button
        onClick={onClick}
        disabled={saving}
        className="h-[48px] px-8 rounded-xl bg-[#222222] text-white text-[15px] font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
        data-testid="button-save-field"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t("profileDetails.saveAndContinue")}
      </button>
    );
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
            {SECTIONS.map((section, idx) => {
              const hasValue = !!getSimpleValue(section.key);
              const isExpanded = expandedSection === section.key;
              const isLast = idx === SECTIONS.length - 1;

              return (
                <div key={section.key} className={!isLast ? "border-b border-[#F0F0F0]" : ""}>
                  <div className="flex items-start justify-between py-6" data-testid={`field-${section.key}`}>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] text-[#717171] mb-1">{section.label}</p>
                      <p className={`text-[15px] leading-snug ${hasValue ? "text-[#222222]" : "text-[#D1D5DB]"}`}>
                        {getDisplayValue(section.key)}
                      </p>
                      {section.key === "email" && emailPending && isExpanded && (
                        <p className="text-[12px] text-[#F59E0B] mt-1">{t("profileDetails.emailPending")}</p>
                      )}
                    </div>
                    <button
                      onClick={() => isExpanded ? handleCancel() : handleExpand(section.key)}
                      className="text-[14px] font-medium text-[#222222] underline underline-offset-2 ml-4 flex-shrink-0 mt-3 active:text-[#717171] transition-colors"
                      data-testid={`button-edit-${section.key}`}
                    >
                      {isExpanded ? t("profileDetails.cancel") : (hasValue ? t("profileDetails.edit") : t("profileDetails.add"))}
                    </button>
                  </div>

                  {isExpanded && section.key === "name" && (
                    <div className="pb-6 animate-in slide-in-from-top-1 duration-200" data-testid="editor-name">
                      <div className="flex flex-col gap-3 mb-4">
                        <div>
                          <label className="text-[12px] text-[#717171] mb-1.5 block">{t("profileEdit.firstName")}</label>
                          {renderInput("text", firstName, setFirstName, t("profileEdit.firstNamePlaceholder"), firstNameRef)}
                        </div>
                        <div>
                          <label className="text-[12px] text-[#717171] mb-1.5 block">{t("profileEdit.lastName")}</label>
                          {renderInput("text", lastName, setLastName, t("profileEdit.lastNamePlaceholder"), undefined, handleSaveName)}
                        </div>
                      </div>
                      {renderSaveButton(handleSaveName)}
                    </div>
                  )}

                  {isExpanded && section.key === "email" && !emailPending && (
                    <div className="pb-6 animate-in slide-in-from-top-1 duration-200" data-testid="editor-email">
                      <div className="mb-4">
                        <label className="text-[12px] text-[#717171] mb-1.5 block">{t("profileDetails.newEmail")}</label>
                        {renderInput("email", emailValue, setEmailValue, t("profileDetails.newEmailPlaceholder"), inputRef, handleSaveEmail)}
                      </div>
                      {renderSaveButton(handleSaveEmail)}
                    </div>
                  )}

                  {isExpanded && section.key !== "name" && section.key !== "email" && (
                    <div className="pb-6 animate-in slide-in-from-top-1 duration-200" data-testid={`editor-${section.key}`}>
                      <div className="mb-4">
                        {renderInput(section.type, editValue, setEditValue, section.placeholder, inputRef, () => handleSaveField(section.dbField))}
                      </div>
                      {renderSaveButton(() => handleSaveField(section.dbField))}
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
