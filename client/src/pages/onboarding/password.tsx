import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useHashSearch } from "@/lib/hash-search";
import { useTranslation } from "@/i18n";
import { HousAlertLogo } from "@/components/housalert-logo";
import { ChevronLeft, Loader2, Eye, EyeOff, Gift, MapPin } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { clearAllUserData } from "@/lib/queryClient";
import { createSearchProfile } from "@/lib/search-profiles";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-base";
import { OB, OBW, OBStickyBar, OBWebHeader, OBInfoBox, useWebsiteMode, appendWebsiteParams } from "@/components/onboarding-ui";
import { OnboardingFlowLayout } from "@/components/onboarding-flow-layout";
import { validatePassword, isPasswordValid } from "@/lib/password-validation";
import { PasswordRules } from "@/components/password-rules";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function OnboardingPassword() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const { toast } = useToast();
  const searchString = useHashSearch();
  const w = useWebsiteMode();
  const T = w ? OBW : OB;
  const params = new URLSearchParams(searchString);

  const city = params.get("city") || "";
  const radiusKm = params.get("radiusKm") || "";
  const minPrice = params.get("minPrice") || "";
  const maxPrice = params.get("maxPrice") || "";
  const minRooms = params.get("minRooms") || "";

  const [firstName, setFirstName] = useState(params.get("firstName") || "");
  const [lastName, setLastName] = useState(params.get("lastName") || "");
  const [email, setEmail] = useState(params.get("email") || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const storedRef = typeof window !== "undefined" ? localStorage.getItem("ha_referral_code") : null;
  const [referralCode, setReferralCode] = useState(storedRef || "");
  const [showReferral, setShowReferral] = useState(!!storedRef);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  async function saveSearchProfile(userId: string) {
    const spMinPrice = parseInt(params.get("minPrice") || "") || 0;
    const spMaxPrice = parseInt(params.get("maxPrice") || "") || 0;
    const bedroomsMin = parseInt(params.get("minRooms") || "") || 0;
    const sizeMin = parseInt(params.get("minSize") || "") || 0;
    const furnished = params.get("furnished") || undefined;
    const propertyTypes = params.get("propertyTypes")?.split(",").filter(Boolean) || undefined;
    const locationMode = params.get("locationMode") as any || undefined;
    const districts = params.get("districts")?.split(",").filter(Boolean) || undefined;
    const spRadiusKm = parseInt(params.get("radiusKm") || "") || undefined;
    const lat = parseFloat(params.get("lat") || "") || undefined;
    const lng = parseFloat(params.get("lng") || "") || undefined;
    const amenities = params.get("amenities")?.split(",").filter(Boolean) || undefined;
    const sendUnclear = params.get("sendUnclear") !== "false";
    const priceFlexible = params.get("priceFlexible") === "true";

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
    });
  }

  async function handleCreateAccount() {
    const pwOk = isPasswordValid(validatePassword(password));
    if (!email || !pwOk || password !== confirmPassword) return;
    if (w && !firstName.trim()) return;
    if (loading || submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);

    const fullName = [firstName, lastName].filter(Boolean).join(" ");
    console.log(`[IDENTITY] Signup attempt — email="${email}"`);
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
        toast({ title: t("auth.signup.failed"), description: msg, variant: "destructive" });
        setLoading(false);
        submittingRef.current = false;
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
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
        try {
          await saveSearchProfile(userId);
        } catch (err) {
          console.error("[signup] Failed to create search profile:", err);
        }
      }

      if (sessionData?.session?.access_token) {
        try {
          await apiFetch("/api/profile-data", {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${sessionData.session.access_token}`,
            },
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
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${sessionData.session.access_token}`,
            },
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

      if (w) {
        const paywallParams = new URLSearchParams();
        paywallParams.set("source", "website");
        paywallParams.set("theme", "light");
        ["city", "lat", "lng", "locationMode", "districts", "radiusKm",
         "minPrice", "maxPrice", "minRooms", "minSize", "furnished",
         "propertyTypes", "amenities", "sendUnclear", "priceFlexible",
         "includeRooms"].forEach((key) => {
          const val = params.get(key);
          if (val) paywallParams.set(key, val);
        });
        navigate(`/paywall?${paywallParams.toString()}`);
      } else {
        navigate("/onboarding/setup");
      }
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }

  function handleBack() {
    if (w) {
      const backParams = new URLSearchParams(searchString);
      backParams.delete("source");
      backParams.delete("theme");
      navigate(appendWebsiteParams(`/onboarding/preferences?${backParams.toString()}`, searchString));
    } else {
      const out = new URLSearchParams(searchString);
      navigate(`/onboarding/email?${out.toString()}`);
    }
  }

  function handleClose() {
    navigate("/");
  }

  const pwStrength = validatePassword(password);
  const passwordOk = isPasswordValid(pwStrength);
  const confirmOk = confirmPassword.length > 0 && password === confirmPassword;
  const canSubmit = w
    ? (firstName.trim() && isValidEmail(email) && passwordOk && confirmOk && !loading)
    : (passwordOk && confirmOk && !!email && !loading);

  const roomsLabel = minRooms === "0" ? "Studio+" : `${minRooms}+`;

  if (w) {
    return (
      <div
        className="min-h-[100dvh] flex flex-col"
        style={{ background: "#ffffff" }}
        data-testid="screen-onboarding-password"
      >
        <OBWebHeader onClose={handleClose} />

        <main className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-5 pt-6 pb-[130px] overflow-y-auto">
          <h2
            className="text-[30px] font-semibold tracking-[-0.025em] mb-4"
            style={{ color: OBW.text }}
            data-testid="text-password-title"
          >
            {t("onboarding.password.web.title")}
          </h2>
          {city && (
            <div
              className="rounded-[4px] p-3.5 mb-4 flex items-start gap-3"
              style={{
                backgroundColor: "#FFFFFF",
                border: `1px solid rgba(217,26,104,0.15)`,
              }}
              data-testid="search-summary-card"
            >
              <MapPin className="w-4 h-4 shrink-0 mt-0.5" style={{ color: OBW.pink }} />
              <div className="min-w-0">
                <p className="text-[14px] font-semibold" style={{ color: OBW.text }}>
                  {city}{radiusKm ? ` · ${radiusKm} km` : ""}
                </p>
                <p className="text-[12px]" style={{ color: OBW.textSecondary }}>
                  €{minPrice}–€{maxPrice} · {roomsLabel} {t("onboarding.password.web.apartments")}
                </p>
              </div>
            </div>
          )}

          <div className="mb-4">
            <OBInfoBox>
              {t("onboarding.password.web.infoBox").replace("{city}", city || t("onboarding.password.web.yourRegion"))}
            </OBInfoBox>
          </div>

          <div className="flex flex-col gap-2.5">
            <div>
              <label className="text-[14px] font-semibold mb-1 block" style={{ color: OBW.textSecondary }}>
                {t("onboarding.name.firstNameLabel")}
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Max"
                className="w-full ha-field-web"
                style={{ backgroundColor: OBW.inputBg, borderColor: OBW.inputBorder, color: OBW.text }}
                autoFocus
                data-testid="input-first-name"
              />
            </div>

            <div>
              <label className="text-[14px] font-semibold mb-1 block" style={{ color: OBW.textSecondary }}>
                {t("onboarding.name.lastNameLabel")}
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Müller"
                className="w-full ha-field-web"
                style={{ backgroundColor: OBW.inputBg, borderColor: OBW.inputBorder, color: OBW.text }}
                data-testid="input-last-name"
              />
            </div>

            <div>
              <label className="text-[14px] font-semibold mb-1 block" style={{ color: OBW.textSecondary }}>
                {t("onboarding.email.label")}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("onboarding.email.placeholder")}
                className="w-full ha-field-web"
                style={{ backgroundColor: OBW.inputBg, borderColor: OBW.inputBorder, color: OBW.text }}
                data-testid="input-email"
              />
            </div>

            <div>
              <label className="text-[14px] font-semibold mb-1 block" style={{ color: OBW.textSecondary }}>
                {t("onboarding.password.label")}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("onboarding.password.web.passwordPlaceholder")}
                  className="w-full ha-field-web"
                  style={{ backgroundColor: OBW.inputBg, borderColor: OBW.inputBorder, color: OBW.text, paddingRight: "44px" }}
                  autoComplete="new-password"
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: "#334855" }}
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff className="w-[16px] h-[16px]" /> : <Eye className="w-[16px] h-[16px]" />}
                </button>
              </div>
              <PasswordRules password={password} />
            </div>

            <div>
              <label className="text-[14px] font-semibold mb-1 block" style={{ color: OBW.textSecondary }}>
                {t("onboarding.password.confirmLabel")}
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t("onboarding.password.confirmPlaceholder")}
                  className="w-full ha-field-web"
                  style={{ backgroundColor: OBW.inputBg, borderColor: OBW.inputBorder, color: OBW.text, paddingRight: "44px" }}
                  autoComplete="new-password"
                  data-testid="input-confirm-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: "#334855" }}
                  data-testid="button-toggle-confirm-password"
                >
                  {showConfirmPassword ? <EyeOff className="w-[16px] h-[16px]" /> : <Eye className="w-[16px] h-[16px]" />}
                </button>
              </div>
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <p className="text-[12px] mt-1.5 text-ha-danger" data-testid="text-confirm-mismatch">
                  {t("onboarding.password.passwordMismatch")}
                </p>
              )}
            </div>

            {!showReferral ? (
              <button
                type="button"
                onClick={() => setShowReferral(true)}
                className="flex items-center gap-2 text-[14px] py-1 transition-colors"
                style={{ color: OBW.textSecondary }}
                data-testid="button-show-referral"
              >
                <Gift className="w-4 h-4" />
                {}
              </button>
            ) : (
              <div>
                <label className="text-[14px] font-semibold mb-1.5 block" style={{ color: OBW.text }}>
                  {}
                </label>
                <input
                  type="text"
                  placeholder="ABC123"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  className="w-full ha-field-web"
                  style={{ backgroundColor: OBW.inputBg, borderColor: OBW.inputBorder, color: OBW.text }}
                  autoCapitalize="characters"
                  data-testid="input-referral-code"
                />
                <p className="text-[12px] mt-1 ml-1" style={{ color: OBW.textMuted }}>
                  {t("onboarding.password.web.optional")}
                </p>
              </div>
            )}
          </div>
        </main>

        <div
          className="fixed bottom-0 left-0 right-0 z-30"
          style={{ borderTop: `1px solid ${OBW.footerBorder}`, backgroundColor: OBW.footerBg }}
        >
          <div className="max-w-[480px] mx-auto px-5 pt-3 pb-3">
            <div className="flex items-center gap-3 mb-2.5">
              <button
                onClick={handleBack}
                className="w-[44px] h-[44px] rounded-[4px] flex items-center justify-center shrink-0 active:scale-95 transition-transform"
                style={{ border: `1.5px solid ${OBW.pink}`, backgroundColor: "transparent" }}
                data-testid="button-password-back"
              >
                <ChevronLeft className="w-[17px] h-[17px]" style={{ color: OBW.pink }} />
              </button>
              <button
                onClick={handleCreateAccount}
                disabled={!canSubmit}
                className="flex-1 h-[44px] rounded-[4px] text-[14px] font-semibold text-white transition-all active:scale-[0.97] disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: OBW.pink, boxShadow: canSubmit ? "0 4px 14px rgba(217,26,104,0.2)" : "none" }}
                data-testid="button-create-account"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("onboarding.password.creating")}
                  </>
                ) : (
                  t("onboarding.password.cta")
                )}
              </button>
            </div>

            <p className="text-center text-[10px] leading-relaxed" style={{ color: OBW.textMuted }}>
              {t("onboarding.password.terms")}
            </p>

            <p className="text-center text-[12px] mt-1" style={{ color: OBW.textSecondary }}>
              {t("auth.signup.hasAccount")}{" "}
              <button
                onClick={() => navigate("/")}
                className="font-semibold hover:underline"
                style={{ color: OB.pink }}
                data-testid="link-login"
              >
                {t("auth.signup.loginLink")}
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const passwordFormContent = (
    <div className="flex flex-col gap-5">
      <div>
        <label className="text-[15px] font-semibold mb-2 block text-[#111111]">
          {t("onboarding.password.label")}
        </label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("onboarding.password.placeholder")}
            className="w-full h-[56px] border border-[#D1D5DB] rounded-[8px] bg-white px-4 pr-12 text-[15px] text-[#111111] placeholder:text-[#9CA3AF] outline-none transition-all focus:border-ha-primary"
            autoFocus
            autoComplete="new-password"
            data-testid="input-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors text-[#9CA3AF] hover:text-[#6B7280]"
            data-testid="button-toggle-password"
          >
            {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
          </button>
        </div>
        <PasswordRules password={password} />
      </div>

      <div>
        <label className="text-[15px] font-semibold mb-2 block text-[#111111]">
          {t("onboarding.password.confirmLabel")}
        </label>
        <div className="relative">
          <input
            type={showConfirmPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={t("onboarding.password.confirmPlaceholder")}
            className="w-full h-[56px] border border-[#D1D5DB] rounded-[8px] bg-white px-4 pr-12 text-[15px] text-[#111111] placeholder:text-[#9CA3AF] outline-none transition-all focus:border-ha-primary"
            autoComplete="new-password"
            data-testid="input-confirm-password"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors text-[#9CA3AF] hover:text-[#6B7280]"
            data-testid="button-toggle-confirm-password"
          >
            {showConfirmPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
          </button>
        </div>
        {confirmPassword.length > 0 && password !== confirmPassword && (
          <p className="text-[13px] mt-2 text-[#E11D48]" data-testid="text-confirm-mismatch">
            {t("onboarding.password.passwordMismatch")}
          </p>
        )}
      </div>

      {!showReferral ? (
        <button
          type="button"
          onClick={() => setShowReferral(true)}
          className="flex items-center gap-2 text-[14px] py-1 transition-colors text-[#334855]"
          data-testid="button-show-referral"
        >
          <Gift className="w-4 h-4" />
          {t("referral.inputLabel")}
        </button>
      ) : (
        <div>
          <label className="text-[14px] font-medium mb-1.5 block text-[#334855]">
            {t("referral.inputLabel")}
          </label>
          <div className="relative">
            <Gift className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#334855]" />
            <input
              type="text"
              placeholder={t("referral.inputPlaceholder")}
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
              className="w-full h-[56px] pl-12 pr-4 rounded-[8px] border border-[#D1D5DB] bg-white text-[16px] font-medium text-[#111111] placeholder:text-[#334855] placeholder:opacity-55 outline-none transition-all focus:border-ha-primary focus:ring-1 focus:ring-ha-primary/25"
              autoCapitalize="characters"
              data-testid="input-referral-code"
            />
          </div>
          <p className="text-[12px] mt-1 ml-1 text-[#334855]">
            {t("referral.inputHelper")}
          </p>
        </div>
      )}
    </div>
  );

  const footerTerms = (
    <div className="text-center">
      <p className="text-[12px] leading-relaxed text-[#334855]">
        {t("onboarding.password.terms")}
      </p>
      <p className="text-[14px] mt-2 text-[#334855]">
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
      currentStep={3}
      totalSteps={3}
      stepTitle={t("onboarding.password.title")}
      stepDescription={t("onboarding.password.subtitle")}
      onBack={handleBack}
      onNext={handleCreateAccount}
      onClose={handleClose}
      nextLabel={loading
        ? t("onboarding.password.creating")
        : t("onboarding.password.cta")}
      nextDisabled={!canSubmit}
      saving={loading}
      footerExtra={footerTerms}
      backTestId="button-password-back"
      nextTestId="button-create-account"
      screenTestId="screen-onboarding-password"
    >
      {passwordFormContent}
    </OnboardingFlowLayout>
  );
}
