import { useState, useRef } from "react";
import { useLocation, Redirect } from "wouter";
import { useHashSearch } from "@/lib/hash-search";
import { useTranslation } from "@/i18n";
import { Mail, ChevronLeft, Eye, EyeOff, Gift } from "lucide-react";
import { useWebsiteMode, OBW, OBStickyBar, OB } from "@/components/onboarding-ui";
import { OnboardingFlowLayout } from "@/components/onboarding-flow-layout";
import { HousAlertLogo } from "@/components/housalert-logo";
import { supabase } from "@/lib/supabase";
import { clearAllUserData } from "@/lib/queryClient";
import { createSearchProfile } from "@/lib/search-profiles";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-base";
import { validatePassword, isPasswordValid } from "@/lib/password-validation";
import { PasswordRules } from "@/components/password-rules";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function OnboardingEmail() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const { toast } = useToast();
  const searchString = useHashSearch();
  const w = useWebsiteMode();
  const T = w ? OBW : OB;
  const incomingParams = new URLSearchParams(searchString);

  const [email, setEmail] = useState(incomingParams.get("email") || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const storedRef = typeof window !== "undefined" ? localStorage.getItem("ha_referral_code") : null;
  const [referralCode, setReferralCode] = useState(storedRef || "");
  const [showReferral, setShowReferral] = useState(!!storedRef);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string>("");
  const submittingRef = useRef(false);

  const city = incomingParams.get("city") || "";
  const firstName = incomingParams.get("firstName") || "";
  if (!city) return <Redirect to="/onboarding/filters" />;
  if (!firstName) return <Redirect to="/onboarding/name" />;

  function forwardParams() {
    const out = new URLSearchParams(searchString);
    out.set("email", email.trim().toLowerCase());
    return out.toString();
  }

  async function saveSearchProfile(userId: string) {
    const p = incomingParams;
    const spMinPrice = parseInt(p.get("minPrice") || "") || 0;
    const spMaxPrice = parseInt(p.get("maxPrice") || "") || 0;
    const bedroomsMin = parseInt(p.get("minRooms") || "") || 0;
    const sizeMin = parseInt(p.get("minSize") || "") || 0;
    const furnished = p.get("furnished") || undefined;
    const propertyTypes = p.get("propertyTypes")?.split(",").filter(Boolean) || undefined;
    const locationMode = p.get("locationMode") as any || undefined;
    const districts = p.get("districts")?.split(",").filter(Boolean) || undefined;
    const spRadiusKm = parseInt(p.get("radiusKm") || "") || undefined;
    const lat = parseFloat(p.get("lat") || "") || undefined;
    const lng = parseFloat(p.get("lng") || "") || undefined;
    const amenities = p.get("amenities")?.split(",").filter(Boolean) || undefined;
    const sendUnclear = p.get("sendUnclear") !== "false";
    const priceFlexible = p.get("priceFlexible") === "true";
    const searchName = p.get("searchName")?.trim() || city;
    await createSearchProfile({
      user_id: userId,
      city_name: city,
      country_code: "DE",
      latitude: lat,
      longitude: lng,
      price_min: spMinPrice,
      price_max: spMaxPrice,
      bedrooms_min: bedroomsMin,
      size_min: sizeMin,
      location_mode: locationMode,
      districts: districts && districts.length > 0 ? districts : undefined,
      radius_km: spRadiusKm,
      furnished: furnished && furnished !== "any" ? furnished : undefined,
      property_types: propertyTypes && propertyTypes.length > 0 ? propertyTypes : undefined,
      extra_features: amenities && amenities.length > 0 ? amenities : undefined,
      send_unclear: sendUnclear,
      price_flexible: priceFlexible,
      search_name: searchName,
    });
  }

  async function handleCreateAccount() {
    setSubmitError("");
    const pwOk = isPasswordValid(validatePassword(password));
    if (!email || !pwOk || password !== confirmPassword) return;
    if (loading || submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    const fullName = [firstName, incomingParams.get("lastName") || ""].filter(Boolean).join(" ");
    clearAllUserData();
    try {
      const res = await apiFetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, fullName }),
      });
      const result = await res.json();
      if (!res.ok) {
        const msg = result.error === "user_exists"
          ? t("common.authAccountExists")
          : (result.message || result.error || t("auth.signup.failed"));
        setSubmitError(msg);
        toast({ title: t("auth.signup.failed"), description: msg, variant: "destructive" });
        setLoading(false);
        submittingRef.current = false;
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setSubmitError(signInError.message);
        toast({ title: t("common.error"), description: signInError.message, variant: "destructive" });
        setLoading(false);
        submittingRef.current = false;
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      import("@/lib/track-event").then(({ trackEvent }) => {
        trackEvent("account_created");
      }).catch(() => {});
      if (userId && city) {
        try { await saveSearchProfile(userId); } catch (err) {
          console.error("[signup] Failed to create search profile:", err);
        }
      }
      if (sessionData?.session?.access_token) {
        try {
          await apiFetch("/api/profile-data", {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session.access_token}` },
            body: JSON.stringify({ onboarding_completed: true }),
          });
        } catch (err) {
          console.error("[signup] Failed to set onboarding_completed:", err);
        }
      }
      if (referralCode.trim() && sessionData?.session?.access_token) {
        try {
          const refRes = await apiFetch("/api/referrals/apply", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session.access_token}` },
            body: JSON.stringify({ code: referralCode.trim() }),
          });
          const refData = await refRes.json();
          if (refRes.ok && refData.success) {
            localStorage.removeItem("ha_referral_code");
          } else {
            console.warn("[signup] Referral code not applied:", refData.error);
            localStorage.removeItem("ha_referral_code");
          }
        } catch (err) {
          console.error("[signup] Failed to apply referral code:", err);
        }
      }
      navigate("/onboarding/setup");
    } catch (err: any) {
      const msg = err?.message || t("common.error");
      setSubmitError(msg);
      toast({ title: t("common.error"), description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }

  function handleWebsiteNext() {
    if (!isValidEmail(email)) return;
    navigate(`/onboarding/password?${forwardParams()}`);
  }

  function handleBack() {
    const out = new URLSearchParams(searchString);
    out.set("email", email.trim().toLowerCase());
    navigate(`/onboarding/name?${out.toString()}`);
  }

  function handleClose() {
    navigate("/");
  }

  if (w) {
    return (
      <div
        className="min-h-[100dvh] flex flex-col"
        style={{ background: T.gradient }}
        data-testid="screen-onboarding-email"
      >
        <header
          className="sticky top-0 z-20 backdrop-blur-md border-b"
          style={{ backgroundColor: T.headerBg, borderColor: T.headerBorder }}
        >
          <div className="max-w-[480px] mx-auto px-5 h-[56px] flex items-center gap-3">
            <button
              onClick={handleBack}
              className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-transform"
              style={{ backgroundColor: OBW.backBtnBg }}
              data-testid="button-email-back"
            >
              <ChevronLeft className="w-5 h-5" style={{ color: T.textSecondary }} />
            </button>
            <div className="flex-1 flex justify-center">
              <HousAlertLogo size={28} />
            </div>
            <div className="w-10" />
          </div>
        </header>

        <main className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-5 pt-4 pb-[100px]">
          <h1
            className="text-[30px] font-semibold tracking-[-0.025em] mb-2"
            style={{ color: T.text }}
            data-testid="text-email-title"
          >
            {t("onboarding.email.title")}
          </h1>
          <p className="text-[14px] mb-6 leading-relaxed" style={{ color: T.textSecondary }}>
            {t("onboarding.email.subtitle")}
          </p>

          <div>
            <label className="text-[13px] font-medium mb-1.5 block" style={{ color: T.textSecondary }}>
              {t("onboarding.email.label")}
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px]" style={{ color: "rgb(var(--ha-text-secondary))" }} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("onboarding.email.placeholder")}
                className="w-full h-[56px] pl-12 pr-4 text-[16px] font-medium ha-field"
                style={{ backgroundColor: OBW.inputBg, borderColor: OBW.inputBorder, color: OBW.text }}
                autoFocus
                data-testid="input-email"
              />
            </div>
          </div>
        </main>

        <OBStickyBar websiteMode={w}>
          <button
            onClick={handleWebsiteNext}
            disabled={!isValidEmail(email)}
            className="w-full h-[48px] rounded-full text-[16px] font-semibold transition-all active:scale-[0.97] disabled:opacity-50"
            style={{ background: T.primary, color: "#223546", boxShadow: isValidEmail(email) ? T.primaryShadow : "none" }}
            data-testid="button-email-next"
          >
            {t("common.next")}
          </button>
        </OBStickyBar>
      </div>
    );
  }

  const pwStrength = validatePassword(password);
  const passwordOk = isPasswordValid(pwStrength);
  const confirmOk = confirmPassword.length > 0 && password === confirmPassword;
  const canSubmit = isValidEmail(email) && passwordOk && confirmOk && !loading;

  const formContent = (
    <div className="flex flex-col gap-5">
      <div>
        <label className="text-[13px] font-medium mb-1.5 block text-ha-text-secondary">
          {t("onboarding.email.label")}
        </label>
        <div className="relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-ha-text-secondary" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("onboarding.email.placeholder")}
            className="w-full h-[56px] pl-12 pr-4 rounded-[8px] border border-ha-border-input bg-white text-[16px] font-medium text-ha-text placeholder:text-ha-text-secondary placeholder:opacity-55 outline-none transition-all focus:border-ha-primary focus:ring-1 focus:ring-ha-primary/25"
            autoFocus
            data-testid="input-email"
          />
        </div>
      </div>

      <div>
        <label className="text-[15px] font-semibold mb-2 block text-ha-text">
          {t("onboarding.password.label")}
        </label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("onboarding.password.placeholder")}
            className="w-full h-[56px] border border-ha-border-input rounded-[8px] bg-white px-4 pr-12 text-[15px] text-ha-text placeholder:text-ha-text-placeholder outline-none transition-all focus:border-ha-primary"
            autoComplete="new-password"
            data-testid="input-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors text-ha-text-placeholder hover:text-ha-text-muted"
            data-testid="button-toggle-password"
          >
            {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
          </button>
        </div>
        <PasswordRules password={password} />
      </div>

      <div>
        <label className="text-[15px] font-semibold mb-2 block text-ha-text">
          {t("onboarding.password.confirmLabel")}
        </label>
        <div className="relative">
          <input
            type={showConfirmPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={t("onboarding.password.confirmPlaceholder")}
            className="w-full h-[56px] border border-ha-border-input rounded-[8px] bg-white px-4 pr-12 text-[15px] text-ha-text placeholder:text-ha-text-placeholder outline-none transition-all focus:border-ha-primary"
            autoComplete="new-password"
            data-testid="input-confirm-password"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors text-ha-text-placeholder hover:text-ha-text-muted"
            data-testid="button-toggle-confirm-password"
          >
            {showConfirmPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
          </button>
        </div>
        {confirmPassword.length > 0 && password !== confirmPassword && (
          <p className="text-[13px] mt-2 text-ha-danger" data-testid="text-confirm-mismatch">
            {t("onboarding.password.passwordMismatch")}
          </p>
        )}
      </div>

      {!showReferral ? (
        <button
          type="button"
          onClick={() => setShowReferral(true)}
          className="flex items-center gap-2 text-[14px] py-1 transition-colors text-ha-text-secondary"
          data-testid="button-show-referral"
        >
          <Gift className="w-4 h-4" />
          {t("referral.inputLabel")}
        </button>
      ) : (
        <div>
          <label className="text-[14px] font-medium mb-1.5 block text-ha-text-secondary">
            {t("referral.inputLabel")}
          </label>
          <div className="relative">
            <Gift className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-ha-text-secondary" />
            <input
              type="text"
              placeholder={t("referral.inputPlaceholder")}
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
              className="w-full h-[56px] pl-12 pr-4 rounded-[8px] border border-ha-border-input bg-white text-[16px] font-medium text-ha-text placeholder:text-ha-text-secondary placeholder:opacity-55 outline-none transition-all focus:border-ha-primary focus:ring-1 focus:ring-ha-primary/25"
              autoCapitalize="characters"
              data-testid="input-referral-code"
            />
          </div>
          <p className="text-[12px] mt-1 ml-1 text-ha-text-secondary">
            {t("referral.inputHelper")}
          </p>
        </div>
      )}

      {submitError && (
        <p className="text-[13px] text-center font-medium" style={{ color: "rgb(var(--ha-danger))" }} data-testid="text-submit-error">
          {submitError}
        </p>
      )}
    </div>
  );

  const footerTerms = (
    <div className="text-center">
      <p className="text-[12px] leading-relaxed text-ha-text-secondary">
        {t("onboarding.password.termsAgree")}{" "}
        <a href="https://www.housalert.com/terms-of-service" target="_blank" rel="noopener noreferrer" className="underline text-ha-text-secondary">{t("onboarding.password.termsLink")}</a>{" "}
        {t("onboarding.password.termsAnd")}{" "}
        <a href="https://www.housalert.com/privacy" target="_blank" rel="noopener noreferrer" className="underline text-ha-text-secondary">{t("onboarding.password.privacyLink")}</a>.
      </p>
      <p className="text-[14px] mt-2 text-ha-text-secondary">
        {t("onboarding.intro.alreadyAccount")}{" "}
        <button
          onClick={() => navigate("/")}
          className="font-medium hover:underline text-ha-primary"
          data-testid="link-login"
        >
          {t("onboarding.intro.login")}
        </button>
      </p>
    </div>
  );

  return (
    <OnboardingFlowLayout
      flowTitle={t("onboarding.accountCreate.flowTitle")}
      currentStep={2}
      totalSteps={2}
      stepTitle={t("onboarding.email.title")}
      stepDescription={t("onboarding.email.subtitle")}
      onBack={handleBack}
      onNext={handleCreateAccount}
      onClose={handleClose}
      nextLabel={loading ? t("onboarding.password.creating") : t("onboarding.password.cta")}
      nextDisabled={!canSubmit}
      saving={loading}
      footerExtra={footerTerms}
      backTestId="button-email-back"
      nextTestId="button-create-account"
      screenTestId="screen-onboarding-email"
    >
      {formContent}
    </OnboardingFlowLayout>
  );
}
