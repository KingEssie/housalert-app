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
    <div className="min-h-screen bg-background">
      <PageHeader title={t("profileDetails.title")} onBack={() => navigate("/dashboard?tab=profiel&sub=account")} />

      <div className="max-w-lg mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div>
            {FIELDS.map((field, i) => {
              const value = getFieldValue(field.key);
              const editable = isEditable(field.key);
              return (
                <div key={field.key}>
                  {editable ? (
                    <button
                      onClick={() => navigate(`/profile/edit/${field.key}`)}
                      className="w-full flex items-center justify-between px-5 py-[18px] text-left active:bg-[#F9FAFB] transition-colors"
                      data-testid={`field-${field.key}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-field-label mb-1">{field.label}</p>
                        <p className="text-field-value truncate">
                          {value || <span className="text-[#9CA3AF]">{t("profileDetails.add")}</span>}
                        </p>
                      </div>
                      <ChevronRight className="w-[18px] h-[18px] text-[#9CA3AF] flex-shrink-0 ml-3" />
                    </button>
                  ) : (
                    <div className="px-5 py-[18px]" data-testid={`field-${field.key}`}>
                      <p className="text-field-label mb-1">{field.label}</p>
                      <p className="text-field-value truncate">{value || "-"}</p>
                    </div>
                  )}
                  {i < FIELDS.length - 1 && (
                    <div className="h-px bg-[#E5E7EB] mx-5" />
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
