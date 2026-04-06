import { apiFetch } from "@/lib/api-base";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useTranslation } from "@/i18n";
import { generateOnboardingLetter, type OnboardingLetterData } from "@/lib/application-letter";
import { RotateCcw, Loader2, ChevronDown } from "lucide-react";
import { AppHeader } from "@/components/ui/app-header";
import elisePhoto from "@assets/A5C2A5AD-87B0-4076-94E3-D2ED9BAC419E_1774778653522.png";

interface ProfileData {
  application_template: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  birth_date?: string | null;
  gender?: string | null;
  living_with?: string | null;
  work_status?: string | null;
  move_reason?: string | null;
  monthly_income?: number | null;
  pets_count?: number | null;
  occupation?: string | null;
}

function buildLetterData(profile: ProfileData, email?: string): OnboardingLetterData {
  return {
    firstName: profile.first_name || undefined,
    lastName: profile.last_name || undefined,
    phone: profile.phone || undefined,
    email: email || undefined,
    gender: profile.gender || undefined,
    livingWith: profile.living_with || undefined,
    workStatus: profile.work_status || undefined,
    moveReason: profile.move_reason || undefined,
    grossIncome: profile.monthly_income || undefined,
    petsCount: profile.pets_count ?? undefined,
  };
}

type Step = 1 | 2 | 3 | 4;

export default function ApplicationLetterPage() {
  const [, navigate] = useLocation();
  const { session, user } = useAuth();
  const { toast } = useToast();
  const { t, locale } = useTranslation();

  const returnPath = (() => {
    try {
      const params = new URLSearchParams(window.location.search || window.location.hash.split("?")[1] || "");
      const from = params.get("from");
      if (from === "tips") return "/dashboard?tab=tips";
      if (from === "profile") return "/dashboard?tab=profiel";
    } catch {}
    return "/dashboard?tab=home";
  })();

  const [step, setStep] = useState<Step>(1);
  const [template, setTemplate] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);

  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");

  const [livingWith, setLivingWith] = useState("");
  const [workStatus, setWorkStatus] = useState("");
  const [moveReason, setMoveReason] = useState("");
  const [monthlyIncome, setMonthlyIncome] = useState<number | undefined>();
  const [petsCount, setPetsCount] = useState("");

  const { data: profileData, isLoading } = useQuery<ProfileData>({
    queryKey: ["/api/profile-data"],
    queryFn: async () => {
      const res = await apiFetch("/api/profile-data", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!session?.access_token,
  });

  useEffect(() => {
    if (profileData && !initialized) {
      setPhone(profileData.phone || "");
      setBirthDate(profileData.birth_date || "");
      setGender(profileData.gender || "");
      setLivingWith(profileData.living_with || "");
      setWorkStatus(profileData.work_status || "");
      setMoveReason(profileData.move_reason || "");
      setMonthlyIncome(profileData.monthly_income || undefined);
      setPetsCount(profileData.pets_count !== null && profileData.pets_count !== undefined ? String(profileData.pets_count) : "");

      const existing = profileData.application_template;
      if (existing && existing.trim().length > 0) {
        setTemplate(existing);
        setStep(4);
      }
      setInitialized(true);
    }
  }, [profileData, initialized]);

  function generatePersonalLetter(): string {
    const data: OnboardingLetterData = {
      firstName: profileData?.first_name || undefined,
      lastName: profileData?.last_name || undefined,
      phone: phone || profileData?.phone || undefined,
      email: user?.email || undefined,
      gender: gender || profileData?.gender || undefined,
      livingWith: livingWith || profileData?.living_with || undefined,
      workStatus: workStatus || profileData?.work_status || undefined,
      moveReason: moveReason || profileData?.move_reason || undefined,
      grossIncome: monthlyIncome || profileData?.monthly_income || undefined,
      petsCount: petsCount !== "" ? Number(petsCount) : (profileData?.pets_count ?? undefined),
    };
    return generateOnboardingLetter(data, locale);
  }

  async function saveProfileFields(fields: Record<string, any>) {
    if (!session?.access_token) return;
    const res = await apiFetch("/api/profile-data", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(fields),
    });
    if (!res.ok) throw new Error("Failed to save");
    queryClient.invalidateQueries({ queryKey: ["/api/profile-data"] });
  }

  async function handleStep2Next() {
    setSaving(true);
    try {
      await saveProfileFields({
        phone: phone.trim() || null,
        birth_date: birthDate || null,
        gender: gender || null,
      });
      setStep(3);
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleStep3Generate() {
    setSaving(true);
    try {
      await saveProfileFields({
        living_with: livingWith || null,
        work_status: workStatus || null,
        move_reason: moveReason || null,
        monthly_income: monthlyIncome || null,
        pets_count: petsCount !== "" ? Number(petsCount) : null,
      });
      const letter = generatePersonalLetter();
      setTemplate(letter);
      setStep(4);
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const saveMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await apiFetch("/api/profile-data", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ application_template: text }),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile-data"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile-strength"] });
      toast({ title: t("applicationLetter.saved"), description: t("applicationLetter.savedDesc") });
    },
    onError: () => {
      toast({ title: t("common.error"), description: t("applicationLetter.saveFailedDesc"), variant: "destructive" });
    },
  });

  const handleReset = () => {
    const letter = generatePersonalLetter();
    setTemplate(letter);
    toast({ title: t("applicationLetter.resetDone"), description: t("applicationLetter.resetDoneDesc") });
  };

  function handleBack() {
    if (step === 1) navigate(returnPath);
    else if (step === 4 && profileData?.application_template && profileData.application_template.trim().length > 0) navigate(returnPath);
    else setStep((step - 1) as Step);
  }

  const GENDER_OPTIONS = [
    { value: "", label: t("profileDetails.genderSelect") },
    { value: "male", label: t("profileDetails.genderMale") },
    { value: "female", label: t("profileDetails.genderFemale") },
    { value: "other", label: t("profileDetails.genderOther") },
    { value: "prefer_not_to_say", label: t("profileDetails.genderPreferNot") },
  ];

  const LIVING_WITH_OPTIONS = [
    { value: "", label: t("housing.selectOption") },
    { value: "alone", label: t("housing.livingAlone") },
    { value: "partner", label: t("housing.livingPartner") },
    { value: "partner_children", label: t("housing.livingPartnerChildren") },
    { value: "children", label: t("housing.livingChildren") },
    { value: "friend", label: t("housing.livingFriend") },
    { value: "family", label: t("housing.livingFamily") },
    { value: "other", label: t("housing.livingOther") },
  ];

  const WORK_OPTIONS = [
    { value: "", label: t("housing.selectOption") },
    { value: "employed", label: t("housing.workEmployed") },
    { value: "self_employed", label: t("housing.workSelfEmployed") },
    { value: "student", label: t("housing.workStudent") },
    { value: "retired", label: t("housing.workRetired") },
    { value: "unemployed", label: t("housing.workUnemployed") },
    { value: "other", label: t("housing.workOther") },
  ];

  const MOVE_REASON_OPTIONS = [
    { value: "", label: t("housing.selectOption") },
    { value: "job_change", label: t("housing.moveJobChange") },
    { value: "study", label: t("housing.moveStudy") },
    { value: "relationship", label: t("housing.moveRelationship") },
    { value: "larger_home", label: t("housing.moveLargerHome") },
    { value: "smaller_home", label: t("housing.moveSmallerHome") },
    { value: "cheaper", label: t("housing.moveCheaper") },
    { value: "neighborhood", label: t("housing.moveNeighborhood") },
    { value: "other", label: t("housing.moveOther") },
  ];

  const PETS_OPTIONS = [
    { value: "", label: t("housing.selectOption") },
    ...Array.from({ length: 11 }, (_, i) => ({ value: String(i), label: String(i) })),
  ];

  function renderSelect(value: string, options: { value: string; label: string }[], onChange: (v: string) => void, testId: string) {
    const hasValue = !!value;
    return (
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className={`app-select ${hasValue ? "" : "text-ha-icon-secondary"}`}
          data-testid={testId}
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#111111] pointer-events-none" />
      </div>
    );
  }

  const labelClass = "text-field-label mb-2 block";

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#F9FAFB" }}>
        <AppHeader title="Reactiebrief" onBack={() => navigate("/dashboard?tab=home")} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-ha-icon-secondary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#F9FAFB" }}>
      <AppHeader title="Reactiebrief" onBack={handleBack} />

      <main className="flex-1 max-w-[480px] mx-auto w-full px-4 py-5 pb-32">

        {step === 1 && (
          <div className="flex flex-col gap-4" data-testid="step-intro">
            <h1 className="text-[22px] font-bold text-black px-1" data-testid="text-intro-heading">
              AI Reactiebrief genereren
            </h1>

            <div className="ha-card">
              <div className="rounded-[--ha-card-inner-radius] bg-[#F9FAFB] px-4 py-4 mb-5" data-testid="card-speech-bubble">
                <p className="text-[15px] text-[#111111] leading-relaxed">
                  Een reactiebrief helpt je sneller te reageren op woningen. Met onze AI-generator maak je in een paar stappen een professionele brief die je direct kunt kopiëren en gebruiken. In de volgende stappen verzamelen we de informatie die nodig is.
                </p>
              </div>

              <div className="flex items-center gap-3" data-testid="card-elise-intro">
                <img
                  src={elisePhoto}
                  alt="Elise — COO HousAlert"
                  className="w-20 h-20 rounded-full object-cover flex-shrink-0"
                  style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.12)", objectPosition: "50% 35%" }}
                  data-testid="img-elise-photo"
                />
                <div>
                  <p className="text-[16px] font-semibold text-[#111111]">Elise</p>
                  <p className="text-[13px] text-ha-text-muted mt-0.5">COO</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full h-[48px] rounded-[--ha-btn-radius] bg-ha-primary text-white text-[16px] font-semibold hover:bg-ha-primary-hover transition-colors active:scale-[0.98]"
              data-testid="button-intro-next"
            >
              Volgende
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4" data-testid="step-personal">
            <h1 className="text-[22px] font-bold text-black px-1" data-testid="text-personal-heading">
              Persoonlijke gegevens
            </h1>

            <div className="ha-card">
              <div className="flex flex-col gap-5">
                <div>
                  <label className={labelClass}>Telefoonnummer</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="06 12345678"
                    className="app-input"
                    data-testid="input-phone"
                  />
                </div>

                <div>
                  <label className={labelClass}>Geboortedatum</label>
                  <input
                    type="date"
                    value={birthDate}
                    onChange={e => setBirthDate(e.target.value)}
                    className="app-input"
                    data-testid="input-birthdate"
                  />
                </div>

                <div>
                  <label className={labelClass}>Geslacht</label>
                  {renderSelect(gender, GENDER_OPTIONS, setGender, "select-gender")}
                </div>
              </div>
            </div>

            <button
              onClick={handleStep2Next}
              disabled={saving}
              className="w-full h-[48px] rounded-[--ha-btn-radius] bg-ha-primary text-white text-[16px] font-semibold hover:bg-ha-primary-hover transition-colors active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              data-testid="button-personal-next"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Volgende
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4" data-testid="step-housing">
            <h1 className="text-[22px] font-bold text-black px-1" data-testid="text-housing-heading">
              Woonsituatie
            </h1>

            <div className="ha-card">
              <div className="flex flex-col gap-5">
                <div>
                  <label className={labelClass}>{t("settings.livingWith")}</label>
                  {renderSelect(livingWith, LIVING_WITH_OPTIONS, setLivingWith, "select-living-with")}
                </div>

                <div>
                  <label className={labelClass}>{t("settings.workSituation")}</label>
                  {renderSelect(workStatus, WORK_OPTIONS, setWorkStatus, "select-work-status")}
                </div>

                <div>
                  <label className={labelClass}>{t("settings.moveReason")}</label>
                  {renderSelect(moveReason, MOVE_REASON_OPTIONS, setMoveReason, "select-move-reason")}
                </div>

                <div>
                  <label className={labelClass}>{t("settings.grossIncome")}</label>
                  <input
                    type="number"
                    value={monthlyIncome || ""}
                    onChange={e => setMonthlyIncome(e.target.value ? Number(e.target.value) : undefined)}
                    placeholder={t("settings.grossIncomePlaceholder")}
                    className="app-input"
                    data-testid="input-income"
                  />
                </div>

                <div>
                  <label className={labelClass}>{t("settings.pets")}</label>
                  {renderSelect(petsCount, PETS_OPTIONS, setPetsCount, "select-pets")}
                </div>
              </div>
            </div>

            <button
              onClick={handleStep3Generate}
              disabled={saving}
              className="w-full h-[48px] rounded-[--ha-btn-radius] bg-ha-primary text-white text-[16px] font-semibold hover:bg-ha-primary-hover transition-colors active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              data-testid="button-generate-letter"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              AI reactiebrief maken
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-4" data-testid="step-preview">
            <h1 className="text-[22px] font-bold text-black px-1" data-testid="text-preview-heading">
              Reactiebrief
            </h1>

            <div className="ha-card">
              <div className="rounded-[--ha-card-inner-radius] bg-[#F9FAFB] px-4 py-3 mb-4">
                <p className="text-[14px] text-[#111111] leading-relaxed">
                  {t("applicationLetter.helperText")}
                </p>
              </div>

              <div className="flex items-center justify-between mb-3">
                <label className="text-field-label">{t("applicationLetter.letterLabel")}</label>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1 text-[14px] text-ha-text-secondary active:text-[#111111] transition-colors"
                  data-testid="button-reset-template"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {t("applicationLetter.resetDefault")}
                </button>
              </div>
              <textarea
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                placeholder={t("applicationLetter.placeholderText")}
                className="app-textarea min-h-[300px] leading-relaxed"
                data-testid="input-template"
              />
              {template.length > 0 && template.trim().length < 20 && (
                <p className="text-[12px] text-ha-text-muted mt-2">{t("applicationLetter.minChars")}</p>
              )}
            </div>

            <button
              onClick={() => saveMutation.mutate(template)}
              disabled={template.trim().length < 20 || saveMutation.isPending}
              className="w-full h-[48px] rounded-[--ha-btn-radius] bg-ha-primary text-white text-[16px] font-semibold hover:bg-ha-primary-hover transition-colors active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              data-testid="button-save-template"
            >
              {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {saveMutation.isPending ? t("applicationLetter.saving") : t("applicationLetter.saveLetter")}
            </button>

            <button
              onClick={() => {
                const letter = generatePersonalLetter();
                setTemplate(letter);
              }}
              className="w-full h-[48px] rounded-[--ha-btn-radius] border border-ha-primary text-ha-primary text-[15px] font-semibold hover:bg-ha-primary/5 transition-colors active:scale-[0.98]"
              data-testid="button-regenerate-letter"
            >
              Nieuwe AI reactiebrief maken
            </button>
          </div>
        )}

      </main>
    </div>
  );
}
