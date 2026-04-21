import { apiFetch } from "@/lib/api-base";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useTranslation } from "@/i18n";
import { generateOnboardingLetter, type OnboardingLetterData } from "@/lib/application-letter";
import { useBuddyConnections, isBuddyMode } from "@/lib/buddy";
import { RotateCcw, Loader2, ChevronDown, Lock, Lightbulb } from "lucide-react";
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
  const buddyConns = useBuddyConnections();
  const isBuddy = buddyConns.isLoading ? false : isBuddyMode(buddyConns.data);

  const returnPath = (() => {
    try {
      const params = new URLSearchParams(window.location.search || window.location.hash.split("?")[1] || "");
      const from = params.get("from");
      if (from === "tips") return "/dashboard?tab=tips";
      if (from === "profile") return "/dashboard?tab=profile";
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
    enabled: !!session?.access_token && !buddyConns.isLoading && !isBuddy,
  });

  const { data: ownerProfileData, isLoading: ownerLoading } = useQuery<{ application_template: string | null; first_name: string | null }>({
    queryKey: ["/api/buddy/owner-profile-data"],
    queryFn: async () => {
      const res = await apiFetch("/api/buddy/owner-profile-data", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) return { application_template: null, first_name: null };
      return res.json();
    },
    enabled: !!session?.access_token && !buddyConns.isLoading && isBuddy,
  });

  useEffect(() => {
    if (buddyConns.isLoading) return;
    if (isBuddy) {
      if (ownerProfileData !== undefined && !initialized) {
        const existing = ownerProfileData.application_template;
        if (existing && existing.trim().length > 0) {
          setTemplate(existing);
        }
        setStep(4);
        setInitialized(true);
      }
      return;
    }
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
  }, [profileData, ownerProfileData, initialized, isBuddy, buddyConns.isLoading]);

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
    if (isBuddy) { navigate(returnPath); return; }
    if (step === 1) navigate(returnPath);
    else if (step === 4 && profileData?.application_template && profileData.application_template.trim().length > 0) navigate(returnPath);
    else setStep((step - 1) as Step);
  }

  function handleBirthChange(part: "year" | "month" | "day", value: string) {
    const parts = birthDate ? birthDate.split("-") : ["", "", ""];
    if (part === "year") parts[0] = value;
    if (part === "month") parts[1] = value;
    if (part === "day") parts[2] = value;
    setBirthDate(parts.join("-"));
  }

  const MONTHS_NL = t("profileDetails.months") as unknown as string[];
  const [bYear = "", bMonth = "", bDay = ""] = birthDate ? birthDate.split("-") : [];

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
          className={`app-select ${hasValue ? "" : "text-ha-text-secondary"}`}
          data-testid={testId}
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-ha-text pointer-events-none" />
      </div>
    );
  }

  const labelClass = "text-field-label mb-2 block";

  if (isLoading || ownerLoading) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: "rgb(var(--ha-bg))" }}>
        <AppHeader title={t("applicationLetter.title")} onBack={() => navigate("/dashboard?tab=home")} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-ha-text-secondary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "rgb(var(--ha-bg))" }}>
      <AppHeader title={t("applicationLetter.title")} onBack={handleBack} />

      <main className="flex-1 max-w-[480px] mx-auto w-full px-4 py-5 pb-32">

        {step === 1 && (
          <div className="flex flex-col gap-4" data-testid="step-intro">
            <h1 className="text-[28px] font-bold text-ha-text px-1" data-testid="text-intro-heading">
              {t("applicationLetter.introHeading")}
            </h1>

            <div className="ha-card">
              <div className="rounded-[--ha-card-inner-radius] bg-ha-surface px-4 py-4 mb-5" data-testid="card-speech-bubble">
                <p className="text-[15px] text-ha-text leading-relaxed">
                  {t("applicationLetter.introBody")}
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
                  <p className="text-[16px] font-semibold text-ha-text">Elise</p>
                  <p className="text-[13px] text-ha-text-muted mt-0.5">COO</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full h-[48px] rounded-[--ha-btn-radius] bg-ha-primary text-white text-[16px] font-semibold hover:bg-ha-primary-hover transition-colors active:scale-[0.98]"
              data-testid="button-intro-next"
            >
              {t("common.next")}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4" data-testid="step-personal">
            <div className="px-1">
              <p className="text-[13px] font-medium text-ha-text-muted mb-1" data-testid="text-step-indicator">{t("applicationLetter.step1of2")}</p>
              <h1 className="text-[28px] font-bold text-ha-text" data-testid="text-personal-heading">
                {t("applicationLetter.personalDataHeading")}
              </h1>
            </div>

            <div className="ha-card">
              <div className="flex flex-col gap-5">
                <div>
                  <label className={labelClass}>{t("applicationLetter.phoneLabel")}</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder={t("profileEdit.phonePlaceholder")}
                    className="app-input"
                    data-testid="input-phone"
                  />
                </div>

                <div>
                  <label className={labelClass}>{t("applicationLetter.birthDateLabel")}</label>
                  <div className="grid grid-cols-[1fr_2fr_1fr] gap-2" data-testid="input-birthdate-group">
                    {/* Day */}
                    <div className="relative">
                      <select
                        value={bDay}
                        onChange={e => handleBirthChange("day", e.target.value)}
                        className={`app-select ${bDay ? "" : "text-ha-text-secondary"}`}
                        data-testid="select-birth-day"
                      >
                        <option value="">{t("profileDetails.birthDay")}</option>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                          <option key={d} value={String(d).padStart(2, "0")}>{d}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-ha-text pointer-events-none" />
                    </div>
                    {/* Month */}
                    <div className="relative">
                      <select
                        value={bMonth}
                        onChange={e => handleBirthChange("month", e.target.value)}
                        className={`app-select ${bMonth ? "" : "text-ha-text-secondary"}`}
                        data-testid="select-birth-month"
                      >
                        <option value="">{t("profileDetails.birthMonth")}</option>
                        {MONTHS_NL.map((m, i) => (
                          <option key={i} value={String(i + 1).padStart(2, "0")}>{m}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-ha-text pointer-events-none" />
                    </div>
                    {/* Year */}
                    <div className="relative">
                      <select
                        value={bYear}
                        onChange={e => handleBirthChange("year", e.target.value)}
                        className={`app-select ${bYear ? "" : "text-ha-text-secondary"}`}
                        data-testid="select-birth-year"
                      >
                        <option value="">{t("profileDetails.birthYear")}</option>
                        {Array.from({ length: 80 }, (_, i) => new Date().getFullYear() - 18 - i).map(y => (
                          <option key={y} value={String(y)}>{y}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-ha-text pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>{t("applicationLetter.genderLabel")}</label>
                  {renderSelect(gender, GENDER_OPTIONS, setGender, "select-gender")}
                </div>
              </div>
            </div>

            <button
              onClick={handleStep2Next}
              disabled={saving}
              className="w-full h-[52px] rounded-[10px] bg-ha-primary text-white text-[16px] font-semibold hover:bg-ha-primary-hover transition-colors active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              data-testid="button-personal-next"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {t("common.next")}
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4" data-testid="step-housing">
            <div className="px-1">
              <p className="text-[13px] font-medium text-ha-text-muted mb-1" data-testid="text-step-indicator-3">{t("applicationLetter.step2of2")}</p>
              <h1 className="text-[28px] font-bold text-ha-text" data-testid="text-housing-heading">
                {t("applicationLetter.housingHeading")}
              </h1>
            </div>

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
              className="w-full h-[52px] rounded-[10px] bg-ha-primary text-white text-[16px] font-semibold hover:bg-ha-primary-hover transition-colors active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              data-testid="button-generate-letter"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {t("common.next")}
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-4" data-testid="step-preview">
            {isBuddy && (
              <div className="flex items-center gap-2 px-1 py-2 bg-ha-surface rounded-[8px]">
                <Lock className="w-4 h-4 text-ha-text-muted flex-shrink-0" />
                <p className="text-[13px] text-ha-text-muted">{t("applicationLetter.readOnlyBuddy")}</p>
              </div>
            )}
            <div className="bg-white rounded-[12px] border border-ha-card-border shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-5">
              {/* Card header */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-[16px] font-semibold text-ha-text">
                  {t("applicationLetter.yourLetter")}
                </span>
                {!isBuddy && (
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-1.5 text-[14px] text-ha-text-muted hover:text-ha-text-secondary transition-colors active:scale-95"
                    data-testid="button-reset-template"
                  >
                    <RotateCcw className="w-[14px] h-[14px]" strokeWidth={2} />
                    {t("applicationLetter.resetDefault")}
                  </button>
                )}
              </div>

              {/* Helper text */}
              {!isBuddy && (
                <div className="flex items-start gap-2.5 bg-ha-surface rounded-[8px] px-3 py-3 mb-4">
                  <Lightbulb className="w-4 h-4 text-ha-text-muted flex-shrink-0 mt-0.5" />
                  <p className="text-[13px] text-ha-text-muted leading-snug">
                    {t("applicationLetter.addressHelper")}
                  </p>
                </div>
              )}

              {/* Textarea — read-only for buddy */}
              {template ? (
                <textarea
                  value={template}
                  onChange={isBuddy ? undefined : e => setTemplate(e.target.value)}
                  readOnly={isBuddy}
                  placeholder={t("applicationLetter.placeholderText")}
                  style={{
                    width: "100%",
                    minHeight: "480px",
                    border: "1px solid rgb(var(--ha-border-input))",
                    borderRadius: "8px",
                    padding: "16px",
                    fontSize: "14px",
                    lineHeight: "1.7",
                    color: "rgb(var(--ha-text))",
                    background: isBuddy ? "rgb(var(--ha-surface))" : "rgb(var(--ha-card))",
                    outline: "none",
                    resize: isBuddy ? "none" : "vertical",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                    cursor: isBuddy ? "default" : "text",
                  }}
                  onFocus={isBuddy ? undefined : e => { e.currentTarget.style.borderColor = "rgb(var(--ha-primary))"; }}
                  onBlur={isBuddy ? undefined : e => { e.currentTarget.style.borderColor = "rgb(var(--ha-border-input))"; }}
                  data-testid="input-template"
                />
              ) : (
                isBuddy && (
                  <p className="text-[15px] text-ha-text-placeholder py-8 text-center">{t("applicationLetter.noLetterBuddy")}</p>
                )
              )}
              {!isBuddy && template.length > 0 && template.trim().length < 20 && (
                <p className="text-[12px] text-ha-text-placeholder mt-2">{t("applicationLetter.minChars")}</p>
              )}
            </div>
          </div>
        )}

      </main>

      {/* Sticky bottom bar — only for step 4 and non-buddy users */}
      {step === 4 && !isBuddy && (
        <div className="sticky bottom-0 bg-white border-t border-ha-card-border px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="max-w-[480px] mx-auto flex flex-col gap-3">
            <button
              onClick={() => saveMutation.mutate(template)}
              disabled={template.trim().length < 20 || saveMutation.isPending}
              className="w-full h-[52px] rounded-[10px] bg-ha-primary hover:bg-ha-primary-hover text-white text-[16px] font-semibold transition-colors active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              data-testid="button-save-template"
            >
              {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {saveMutation.isPending ? t("applicationLetter.saving") : t("applicationLetter.saveLetter")}
            </button>

            <button
              onClick={() => setStep(2)}
              className="w-full py-2 text-ha-text-muted text-[14px] hover:text-ha-text transition-colors active:opacity-70 flex items-center justify-center gap-1.5"
              data-testid="button-regenerate-letter"
            >
              <RotateCcw className="w-[13px] h-[13px]" strokeWidth={2} />
              {t("applicationLetter.regenerate")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
