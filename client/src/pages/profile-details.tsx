import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ChevronRight, Loader2 } from "lucide-react";

interface ProfileData {
  first_name?: string | null;
  last_name?: string | null;
  date_of_birth?: string | null;
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
    return "";
  }

  function isEditable(key: string): boolean {
    return key !== "email";
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-10 bg-white border-b border-[#F3F4F6]">
        <div className="max-w-lg mx-auto flex items-center h-14 px-5">
          <button
            onClick={() => navigate("/dashboard?tab=profiel")}
            className="w-9 h-9 rounded-full flex items-center justify-center -ml-1"
            data-testid="button-back-details"
          >
            <ArrowLeft className="w-5 h-5 text-[#1F2937]" />
          </button>
          <h1 className="flex-1 text-center text-[17px] font-semibold text-[#1F2937]">Persoonlijke gegevens</h1>
          <div className="w-9" />
        </div>
      </div>

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
                      className="w-full flex items-center justify-between px-5 py-4 text-left active:bg-[#F9FAFB] transition-colors"
                      data-testid={`field-${field.key}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] text-[#6B7280] mb-0.5">{field.label}</p>
                        <p className="text-[16px] font-[500] text-[#1F2937] truncate">
                          {value || <span className="text-[#9CA3AF]">Toevoegen</span>}
                        </p>
                      </div>
                      <ChevronRight className="w-[18px] h-[18px] text-[#9CA3AF] flex-shrink-0 ml-3" />
                    </button>
                  ) : (
                    <div className="px-5 py-4" data-testid={`field-${field.key}`}>
                      <p className="text-[13px] text-[#6B7280] mb-0.5">{field.label}</p>
                      <p className="text-[16px] font-[500] text-[#1F2937] truncate">{value || "-"}</p>
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
