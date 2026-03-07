import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { ChevronRight, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

interface ProfileData {
  first_name?: string | null;
  last_name?: string | null;
  date_of_birth?: string | null;
  occupation?: string | null;
  monthly_income?: number | null;
}

interface NotificationSettings {
  phone_e164?: string | null;
}

const FIELDS = [
  { key: "first_name", label: "Voornaam" },
  { key: "last_name", label: "Achternaam" },
  { key: "date_of_birth", label: "Geboortedatum" },
  { key: "email", label: "E-mailadres" },
  { key: "phone", label: "Mobiele nummer" },
  { key: "occupation", label: "Beroep" },
  { key: "monthly_income", label: "Maandelijks inkomen" },
] as const;

export default function ProfileDetailsPage() {
  const { user, session } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.access_token) return;
    const headers = { Authorization: `Bearer ${session.access_token}` };

    Promise.all([
      fetch("/api/profile-data", { headers }).then(r => r.json()),
      fetch("/api/notifications/settings", { headers }).then(r => r.json()),
    ]).then(([pd, ns]) => {
      setProfileData(pd);
      setPhone(ns?.phone_e164 ?? null);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
      toast({ title: "Fout", description: "Kon gegevens niet laden.", variant: "destructive" });
    });
  }, [session?.access_token]);

  function getFieldValue(key: string): string {
    if (key === "email") return user?.email ?? "";
    if (key === "phone") return phone ?? "";
    if (key === "first_name") return profileData?.first_name ?? "";
    if (key === "last_name") return profileData?.last_name ?? "";
    if (key === "date_of_birth") return profileData?.date_of_birth ?? "";
    if (key === "occupation") return profileData?.occupation ?? "";
    if (key === "monthly_income") return profileData?.monthly_income != null ? `€${profileData.monthly_income}` : "";
    return "";
  }

  function isEditable(key: string): boolean {
    return key !== "email";
  }

  return (
    <div className="min-h-screen bg-white">
      <PageHeader title="Persoonlijke gegevens" onBack={() => navigate("/dashboard?tab=profiel")} />

      <div className="max-w-lg mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-[#6B7280]" />
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
                      className="w-full flex items-center justify-between px-5 py-4 text-left active:bg-[#F8FAFC] transition-colors"
                      data-testid={`field-${field.key}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] text-[#6B7280] mb-0.5">{field.label}</p>
                        <p className="text-[16px] font-[500] text-[#111827] truncate">
                          {value || <span className="text-[#9CA3AF]">Toevoegen</span>}
                        </p>
                      </div>
                      <ChevronRight className="w-[18px] h-[18px] text-[#9CA3AF] flex-shrink-0 ml-3" />
                    </button>
                  ) : (
                    <div className="px-5 py-4" data-testid={`field-${field.key}`}>
                      <p className="text-[13px] text-[#6B7280] mb-0.5">{field.label}</p>
                      <p className="text-[16px] font-[500] text-[#111827] truncate">{value || "-"}</p>
                    </div>
                  )}
                  {i < FIELDS.length - 1 && (
                    <div className="h-px bg-[#F3F4F6] mx-5" />
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
