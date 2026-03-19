import { apiFetch } from "@/lib/api-base";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";
import { ChevronRight, Loader2 } from "lucide-react";
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

export default function ProfileDetailsPage() {
  const { user, session } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();

  const FIELDS = [
    { key: "first_name", label: t("profileEdit.firstName") },
    { key: "last_name", label: t("profileEdit.lastName") },
    { key: "birth_date", label: t("profileEdit.birthDate") },
    { key: "email", label: t("profileDetails.email") },
    { key: "phone", label: t("profileEdit.phone") },
    { key: "occupation", label: t("profileEdit.occupation") },
    { key: "monthly_income", label: t("profileEdit.income") },
  ] as const;

  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.access_token) return;
    const headers = { Authorization: `Bearer ${session.access_token}` };

    apiFetch("/api/profile-data", { headers })
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
    if (key === "monthly_income") return profileData?.monthly_income != null ? `€${profileData.monthly_income}` : "";
    return "";
  }

  function isEditable(key: string): boolean {
    return key !== "email";
  }

  return (
    <div className="min-h-screen bg-white">
      <PageHeader title={t("profileDetails.title")} onBack={() => navigate("/dashboard?tab=profiel&sub=account")} />

      <div className="max-w-lg mx-auto px-6 pt-4">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-[#D1D5DB]" />
          </div>
        ) : (
          <div className="rounded-2xl border border-[#F0F0F0] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.02)]">
            {FIELDS.map((field, idx) => {
              const value = getFieldValue(field.key);
              const editable = isEditable(field.key);
              const hasValue = !!value;
              const isLast = idx === FIELDS.length - 1;

              return editable ? (
                <button
                  key={field.key}
                  onClick={() => navigate(`/profile/edit/${field.key}`)}
                  className={`w-full flex items-center justify-between px-5 py-5 text-left active:bg-[#FAFAFA] transition-all ${!isLast ? "border-b border-[#F5F5F5]" : ""}`}
                  data-testid={`field-${field.key}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-[#9CA3AF] font-semibold uppercase tracking-wider mb-1.5">{field.label}</p>
                    <p className={`text-[15px] font-medium truncate leading-snug ${hasValue ? "text-[#111827]" : "text-[#D1D5DB]"}`}>
                      {value || t("profileDetails.add")}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#D1D5DB] flex-shrink-0 ml-4" />
                </button>
              ) : (
                <div key={field.key} className={`px-5 py-5 ${!isLast ? "border-b border-[#F5F5F5]" : ""}`} data-testid={`field-${field.key}`}>
                  <p className="text-[11px] text-[#9CA3AF] font-semibold uppercase tracking-wider mb-1.5">{field.label}</p>
                  <p className={`text-[15px] font-medium truncate leading-snug ${hasValue ? "text-[#111827]" : "text-[#D1D5DB]"}`}>
                    {value || "-"}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
