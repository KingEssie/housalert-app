import { apiFetch } from "@/lib/api-base";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useTranslation } from "@/i18n";
import { supabase } from "@/lib/supabase";
import { Loader2, ChevronDown } from "lucide-react";
import { AppHeader } from "@/components/ui/app-header";

interface ProfileData {
  first_name?: string | null;
  last_name?: string | null;
  birth_date?: string | null;
  phone?: string | null;
  gender?: string | null;
}

export default function ProfileDetailsPage() {
  const { user, session } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [emailValue, setEmailValue] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");

  useEffect(() => {
    if (!session?.access_token) return;
    apiFetch("/api/profile-data", { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then(r => {
        if (!r.ok) throw new Error(`Status ${r.status}`);
        return r.json();
      })
      .then(pd => {
        setProfileData(pd);
        setFirstName(pd.first_name || "");
        setLastName(pd.last_name || "");
        setPhone(pd.phone || "");
        setBirthDate(pd.birth_date || "");
        setGender(pd.gender || "");
        setEmailValue(user?.email || "");
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        toast({ title: t("common.error"), description: t("profileDetails.loadFailed"), variant: "destructive" });
      });
  }, [session?.access_token]);

  const GENDER_OPTIONS = [
    { value: "", label: t("profileDetails.genderSelect") },
    { value: "male", label: t("profileDetails.genderMale") },
    { value: "female", label: t("profileDetails.genderFemale") },
    { value: "other", label: t("profileDetails.genderOther") },
    { value: "prefer_not_to_say", label: t("profileDetails.genderPreferNot") },
  ];

  async function handleSave() {
    if (!session?.access_token) return;
    setSaving(true);
    try {
      const res = await apiFetch("/api/profile-data", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          phone: phone.trim() || null,
          birth_date: birthDate || null,
          gender: gender || null,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || t("profileEdit.saveFailed"));
      }
      queryClient.invalidateQueries({ queryKey: ["/api/profile-data"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile-strength"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/settings"] });
      toast({ title: t("profileEdit.saved") });
      navigate("/dashboard?tab=profiel");
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleEmailChange() {
    if (!emailValue.trim() || !emailValue.includes("@") || emailValue === user?.email) return;
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: emailValue.trim() });
      if (error) throw error;
      toast({ title: t("profileDetails.emailConfirmationSent"), description: t("profileDetails.emailConfirmationDesc") });
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message || t("profileEdit.saveFailed"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const labelClass = "text-field-label mb-2 block";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#EBEBF0" }}>
      <AppHeader title={t("profileDetails.title")} onBack={() => navigate("/dashboard?tab=profiel")} />

      <div className="max-w-[480px] mx-auto px-4 py-5 pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-ha-icon-secondary" />
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="app-card">
              <div className="flex flex-col gap-5">
                <div>
                  <label className={labelClass}>{t("profileDetails.firstName")}</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    placeholder={t("profileDetails.firstNamePlaceholder")}
                    className="app-input"
                    data-testid="input-first-name"
                  />
                </div>

                <div>
                  <label className={labelClass}>{t("profileDetails.lastName")}</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder={t("profileDetails.lastNamePlaceholder")}
                    className="app-input"
                    data-testid="input-last-name"
                  />
                </div>

                <div>
                  <label className={labelClass}>{t("profileDetails.email")}</label>
                  <input
                    type="email"
                    value={emailValue}
                    onChange={e => setEmailValue(e.target.value)}
                    placeholder={t("profileDetails.emailPlaceholder")}
                    className="app-input"
                    data-testid="input-email"
                  />
                  {emailValue && emailValue !== user?.email && (
                    <button
                      onClick={handleEmailChange}
                      disabled={saving}
                      className="mt-2 text-[13px] text-ha-primary font-medium underline underline-offset-2"
                      data-testid="button-change-email"
                    >
                      {t("profileDetails.changeEmail")}
                    </button>
                  )}
                </div>

                <div>
                  <label className={labelClass}>{t("profileDetails.phone")}</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder={t("profileDetails.phonePlaceholder")}
                    className="app-input"
                    data-testid="input-phone"
                  />
                </div>

                <div>
                  <label className={labelClass}>{t("profileDetails.birthDate")}</label>
                  <input
                    type="date"
                    value={birthDate}
                    onChange={e => setBirthDate(e.target.value)}
                    className="app-input"
                    data-testid="input-birth-date"
                  />
                </div>

                <div>
                  <label className={labelClass}>{t("profileDetails.gender")}</label>
                  <div className="relative">
                    <select
                      value={gender}
                      onChange={e => setGender(e.target.value)}
                      className={`app-select ${gender ? "" : "text-ha-icon-secondary"}`}
                      data-testid="select-gender"
                    >
                      {GENDER_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#000] pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full h-[56px] rounded-[6px] bg-ha-primary text-white text-[15px] font-semibold transition-colors hover:bg-ha-primary-hover active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              data-testid="button-save-details"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {t("settings.save")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
