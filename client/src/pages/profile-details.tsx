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

const FIELD_LABEL = "text-[15px] font-semibold text-[#000000] mb-2 block";
const INPUT_CLS = "w-full h-[52px] px-4 rounded-[8px] border border-[#D1D5DB] bg-white text-[16px] font-normal text-[#000000] placeholder:text-[#9CA3AF] outline-none transition-all focus:border-ha-primary focus:ring-1 focus:ring-ha-primary/20";

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

  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");

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
          const [y, m, d] = pd.birth_date.split("-");
          setBirthYear(y || "");
          setBirthMonth(m ? String(parseInt(m, 10)) : "");
          setBirthDay(d ? String(parseInt(d, 10)) : "");
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

  function composeBirthDate(): string | null {
    if (!birthYear || !birthMonth || !birthDay) return null;
    const y = birthYear.padStart(4, "0");
    const m = birthMonth.padStart(2, "0");
    const d = birthDay.padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

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
          birth_date: composeBirthDate(),
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

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#eaeaeb" }}>
      <AppHeader title={t("profileDetails.title")} onBack={() => navigate("/dashboard?tab=profiel")} />

      <div className="max-w-[480px] mx-auto px-4 py-5 pb-10">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-[#9CA3AF]" />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="app-card !p-5">
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

                {/* Telefoonnummer */}
                <div>
                  <label className={FIELD_LABEL}>{t("profileDetails.phone")}</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder={t("profileDetails.phonePlaceholder")}
                    className={INPUT_CLS}
                    data-testid="input-phone"
                  />
                </div>

                {/* Geboortedatum — 3 dropdowns: dag / maand / jaar */}
                <div>
                  <label className={FIELD_LABEL}>{t("profileDetails.birthDate")}</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: "10px", width: "100%" }}>
                    {/* Dag — 1fr */}
                    <div className="relative min-w-0">
                      <select
                        value={birthDay}
                        onChange={e => setBirthDay(e.target.value)}
                        className={`${INPUT_CLS} appearance-none text-center px-2 pr-6 ${!birthDay ? "text-[#9CA3AF]" : "text-[#000000]"}`}
                        data-testid="select-birth-day"
                      >
                        <option value="">Dag</option>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                          <option key={d} value={String(d)}>{d}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-[13px] h-[13px] text-[#000000] pointer-events-none" strokeWidth={2} />
                    </div>
                    {/* Maand — 2fr, full names, left-aligned */}
                    <div className="relative min-w-0">
                      <select
                        value={birthMonth}
                        onChange={e => setBirthMonth(e.target.value)}
                        className={`${INPUT_CLS} appearance-none text-left px-3 pr-7 ${!birthMonth ? "text-[#9CA3AF]" : "text-[#000000]"}`}
                        data-testid="select-birth-month"
                      >
                        <option value="">Maand</option>
                        {[
                          "Januari","Februari","Maart","April","Mei","Juni",
                          "Juli","Augustus","September","Oktober","November","December"
                        ].map((name, i) => (
                          <option key={i + 1} value={String(i + 1)}>{name}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-[13px] h-[13px] text-[#000000] pointer-events-none" strokeWidth={2} />
                    </div>
                    {/* Jaar — 1fr, 1940–now */}
                    <div className="relative min-w-0">
                      <select
                        value={birthYear}
                        onChange={e => setBirthYear(e.target.value)}
                        className={`${INPUT_CLS} appearance-none text-center px-2 pr-6 ${!birthYear ? "text-[#9CA3AF]" : "text-[#000000]"}`}
                        data-testid="select-birth-year"
                      >
                        <option value="">Jaar</option>
                        {Array.from({ length: new Date().getFullYear() - 1939 }, (_, i) => new Date().getFullYear() - i).map(y => (
                          <option key={y} value={String(y)}>{y}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-[13px] h-[13px] text-[#000000] pointer-events-none" strokeWidth={2} />
                    </div>
                  </div>
                </div>

                {/* Geslacht — select with chevron */}
                <div>
                  <label className={FIELD_LABEL}>{t("profileDetails.gender")}</label>
                  <div className="relative">
                    <select
                      value={gender}
                      onChange={e => setGender(e.target.value)}
                      className={`${INPUT_CLS} appearance-none pr-10 ${!gender ? "text-[#9CA3AF]" : "text-[#000000]"}`}
                      data-testid="select-gender"
                    >
                      {GENDER_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#000000] pointer-events-none" strokeWidth={2} />
                  </div>
                </div>

              </div>
            </div>

            {/* Opslaan — white anchored container */}
            <div className="app-card !p-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full h-[52px] rounded-[10px] bg-ha-primary hover:bg-ha-primary-hover text-white text-[16px] font-semibold transition-colors active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                data-testid="button-save-details"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {t("settings.save")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
