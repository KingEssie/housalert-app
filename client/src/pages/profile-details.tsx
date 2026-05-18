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

const FIELD_LABEL = "text-[15px] font-bold text-[#111111] mb-2 block";
const INPUT_CLS = "w-full h-[60px] px-4 rounded-[18px] bg-white text-[16px] font-normal text-[#111111] placeholder:text-[#aaa] outline-none transition-all";
const INPUT_STYLE = { border: "1px solid #d9d3e3" };

export default function ProfileDetailsPage() {
  const { user, session } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [emailValue, setEmailValue] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("");

  const [birthDate, setBirthDate] = useState("");

  useEffect(() => {
    if (!session?.access_token) return;
    apiFetch("/api/profile-data", { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then(r => {
        if (!r.ok) throw new Error(`Status ${r.status}`);
        return r.json();
      })
      .then((pd: ProfileData) => {
        setFirstName(pd.first_name || "");
        setLastName(pd.last_name || "");
        setPhone(pd.phone || "");
        setGender(pd.gender || "");
        setEmailValue(user?.email || "");
        if (pd.birth_date) {
          setBirthDate(pd.birth_date);
        }
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
      navigate("/dashboard?tab=profile");
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

  return (
    <div className="min-h-screen flex flex-col bg-ha-bg">
      <AppHeader title={t("profileDetails.title")} onBack={() => navigate("/dashboard?tab=profile")} />

      <div className="flex-1 max-w-[480px] mx-auto w-full px-4 py-5 pb-4">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-ha-text-placeholder" />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div
              className="bg-white rounded-[28px] p-5"
              style={{ border: "1px solid #ece7ef", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
            >
              <div className="flex flex-col gap-5">

                {/* Voornaam + Achternaam — side by side */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={FIELD_LABEL}>{t("profileDetails.firstName")}</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      placeholder={t("profileDetails.firstNamePlaceholder")}
                      className={INPUT_CLS}
                      style={INPUT_STYLE}
                      onFocus={e => { e.currentTarget.style.borderColor = "#b9a7ff"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(185,167,255,0.2)"; }}
                      onBlur={e => { e.currentTarget.style.borderColor = "#d9d3e3"; e.currentTarget.style.boxShadow = "none"; }}
                      data-testid="input-first-name"
                    />
                  </div>
                  <div>
                    <label className={FIELD_LABEL}>{t("profileDetails.lastName")}</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      placeholder={t("profileDetails.lastNamePlaceholder")}
                      className={INPUT_CLS}
                      style={INPUT_STYLE}
                      onFocus={e => { e.currentTarget.style.borderColor = "#b9a7ff"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(185,167,255,0.2)"; }}
                      onBlur={e => { e.currentTarget.style.borderColor = "#d9d3e3"; e.currentTarget.style.boxShadow = "none"; }}
                      data-testid="input-last-name"
                    />
                  </div>
                </div>

                {/* E-mail */}
                <div>
                  <label className={FIELD_LABEL}>{t("profileDetails.email")}</label>
                  <input
                    type="email"
                    value={emailValue}
                    onChange={e => setEmailValue(e.target.value)}
                    placeholder={t("profileDetails.emailPlaceholder")}
                    className={INPUT_CLS}
                    style={INPUT_STYLE}
                    onFocus={e => { e.currentTarget.style.borderColor = "#b9a7ff"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(185,167,255,0.2)"; }}
                    onBlur={e => { e.currentTarget.style.borderColor = "#d9d3e3"; e.currentTarget.style.boxShadow = "none"; }}
                    data-testid="input-email"
                  />
                  {emailValue && emailValue !== user?.email && (
                    <button
                      onClick={handleEmailChange}
                      disabled={saving}
                      className="mt-2 text-[13px] font-semibold underline underline-offset-2"
                      style={{ color: "#b9a7ff" }}
                      data-testid="button-change-email"
                    >
                      {t("profileDetails.changeEmail")}
                    </button>
                  )}
                </div>

                {/* Telefoonnummer */}
                <div>
                  <label className={FIELD_LABEL}>{t("profileDetails.phone")}</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder={t("profileDetails.phonePlaceholder")}
                    className={INPUT_CLS}
                    style={INPUT_STYLE}
                    onFocus={e => { e.currentTarget.style.borderColor = "#b9a7ff"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(185,167,255,0.2)"; }}
                    onBlur={e => { e.currentTarget.style.borderColor = "#d9d3e3"; e.currentTarget.style.boxShadow = "none"; }}
                    data-testid="input-phone"
                  />
                </div>

                {/* Date of birth — native date input */}
                <div>
                  <label className={FIELD_LABEL}>{t("profileDetails.birthDate")}</label>
                  <input
                    type="date"
                    value={birthDate}
                    onChange={e => setBirthDate(e.target.value)}
                    max={new Date().toISOString().split("T")[0]}
                    min="1900-01-01"
                    className={INPUT_CLS}
                    style={INPUT_STYLE}
                    onFocus={e => { e.currentTarget.style.borderColor = "#b9a7ff"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(185,167,255,0.2)"; }}
                    onBlur={e => { e.currentTarget.style.borderColor = "#d9d3e3"; e.currentTarget.style.boxShadow = "none"; }}
                    data-testid="input-birth-date"
                  />
                </div>

                {/* Geslacht — select with chevron */}
                <div>
                  <label className={FIELD_LABEL}>{t("profileDetails.gender")}</label>
                  <div className="relative">
                    <select
                      value={gender}
                      onChange={e => setGender(e.target.value)}
                      className={`${INPUT_CLS} appearance-none pr-10 ${!gender ? "text-[#aaa]" : "text-[#111111]"}`}
                      style={INPUT_STYLE}
                      data-testid="select-gender"
                    >
                      {GENDER_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] pointer-events-none" style={{ color: "#6b6677" }} strokeWidth={2} />
                  </div>
                </div>

              </div>
            </div>

          </div>
        )}
      </div>

      {!loading && (
        <div className="sticky bottom-0 bg-white border-t border-ha-card-border px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="max-w-[480px] mx-auto">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full h-[56px] rounded-full font-bold text-white text-[16px] transition-colors active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ backgroundColor: "#223546" }}
              data-testid="button-save-details"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {t("settings.save")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
