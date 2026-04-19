import { useState, useRef } from "react";
import { useLocation, Redirect } from "wouter";
import { useHashSearch } from "@/lib/hash-search";
import { useTranslation } from "@/i18n";
import { HousAlertLogo } from "@/components/housalert-logo";
import { ChevronLeft, ChevronDown, Loader2, Eye, EyeOff, Gift, MapPin, X, ShieldCheck, Building2 } from "lucide-react";
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
  const [accordionOpen, setAccordionOpen] = useState(true);
  const submittingRef = useRef(false);

  if (!city) return <Redirect to="/onboarding/filters" />;
  if (!w && !params.get("email")) return <Redirect to="/onboarding/email" />;

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
    const searchName = params.get("searchName")?.trim() || city;

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
    ? (firstName.trim() && isValidEmail(email) && passwordOk && !loading)
    : (passwordOk && confirmOk && !!email && !loading);

  const roomsLabel = minRooms === "0" ? "Studio+" : `${minRooms}+`;

  if (w) {
    const searchName = params.get("searchName")?.trim() || city;
    return (
      <div
        className="min-h-[100dvh] flex flex-col"
        style={{ background: "#F3F4F6" }}
        data-testid="screen-onboarding-password"
      >
        {/* Header — matches steps 3/4 and 4/4 exactly */}
        <header
          className="sticky top-0 z-20 w-full"
          style={{ backgroundColor: "#ffffff", borderBottom: "1px solid #E5E7EB" }}
        >
          <div className="relative max-w-[480px] mx-auto px-4 h-[56px] flex items-center justify-between">
            <HousAlertLogo size={26} />
            <span
              className="absolute inset-0 flex items-center justify-center text-[19px] font-bold pointer-events-none"
              style={{ color: "#111111" }}
            >
              Account aanmaken
            </span>
            <button
              onClick={handleClose}
              className="w-[36px] h-[36px] shrink-0 flex items-center justify-center rounded-full transition-opacity hover:opacity-70 active:opacity-50"
              style={{ backgroundColor: "#F2F2F2", color: "#444444" }}
              data-testid="button-password-close"
            >
              <X className="w-[22px] h-[22px]" />
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-[480px] mx-auto w-full px-4 pt-5 pb-8 overflow-y-auto">

          {/* Card 1 — Jouw zoekopdracht (accordion) — single unified grey card */}
          <div
            className="rounded-[16px] mb-4 overflow-hidden"
            style={{ backgroundColor: "#F0F2F5" }}
            data-testid="search-summary-card"
          >
            {/* Header — same background, no divider, unified padding */}
            <button
              onClick={() => setAccordionOpen(!accordionOpen)}
              className="w-full flex items-center justify-between px-4 pt-4 pb-3 transition-opacity active:opacity-70"
              data-testid="button-accordion-toggle"
            >
              <span className="text-[15px] font-semibold" style={{ color: "#0F172A" }}>
                Jouw zoekopdracht
              </span>
              <ChevronDown
                className="w-[17px] h-[17px] transition-transform duration-300"
                style={{
                  color: "#94A3B8",
                  transform: accordionOpen ? "rotate(0deg)" : "rotate(-90deg)",
                }}
              />
            </button>

            {/* Accordion body — animated, no divider */}
            <div
              style={{
                maxHeight: accordionOpen ? "600px" : "0px",
                overflow: "hidden",
                transition: "max-height 0.32s cubic-bezier(0.4,0,0.2,1)",
              }}
            >
              <div className="px-4 pb-4 flex flex-col gap-3">

                {/* Location row — inline, compact */}
                <div className="flex items-center gap-2">
                  <MapPin className="w-[13px] h-[13px] shrink-0" style={{ color: "#64748B" }} />
                  <span className="text-[14px] font-semibold" style={{ color: "#0F172A" }}>
                    {searchName}{radiusKm ? ` · ${radiusKm} km` : ""}
                  </span>
                  {(minPrice || maxPrice) && (
                    <span className="text-[13px]" style={{ color: "#64748B" }}>
                      · €{minPrice}–€{maxPrice} · {roomsLabel} {t("onboarding.password.web.apartments")}
                    </span>
                  )}
                </div>

                {/* Missed-matches block — softer, less saturated */}
                <div
                  className="rounded-[10px] flex items-center gap-3 px-3.5 py-3"
                  style={{ backgroundColor: "#E8EEF8", border: "1px solid #D0DCF0" }}
                  data-testid="match-summary-card"
                >
                  <span className="text-[17px] leading-none shrink-0">🏠</span>
                  <div className="flex items-baseline gap-1.5 shrink-0">
                    <span className="text-[24px] font-bold leading-none" style={{ color: "#2563EB" }}>121</span>
                    <span className="text-[11px] font-medium" style={{ color: "#93C5FD" }}>{t("onboardingUI.perWeek")}</span>
                  </div>
                  <p className="text-[12px] leading-[1.45] flex-1" style={{ color: "#475569" }}>
                    {t("onboarding.password.web.infoBox").replace("{city}", city || t("onboarding.password.web.yourRegion"))}
                  </p>
                </div>

                {/* Preview listing — top image, bottom meta row */}
                <div
                  className="rounded-[10px] overflow-hidden"
                  style={{ border: "1px solid #D8DCE3" }}
                  data-testid="listing-preview-placeholder"
                >
                  {/* Image area — blurred, clips inside radius */}
                  <div className="w-full h-[108px] overflow-hidden relative">
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{
                        backgroundColor: "#C8CDD6",
                        backgroundImage: "linear-gradient(135deg, #C8CDD6 0%, #B0B8C4 100%)",
                        filter: "blur(8px)",
                        transform: "scale(1.1)",
                      }}
                    >
                      <Building2 className="w-[40px] h-[40px]" style={{ color: "#8896A6", opacity: 0.7 }} />
                    </div>
                  </div>

                  {/* Meta row — real listing layout, blurred */}
                  <div
                    className="flex items-center gap-3 px-3 py-2.5"
                    style={{ backgroundColor: "#FFFFFF", filter: "blur(3.5px)" }}
                  >
                    <span className="text-[13px] font-bold" style={{ color: "#0F172A" }}>€850 /mnd</span>
                    <span className="text-[12px]" style={{ color: "#64748B" }}>45 m²</span>
                    <span className="text-[11.5px] ml-auto" style={{ color: "#94A3B8" }}>2 dagen geleden</span>
                  </div>

                  {/* Caption */}
                  <div
                    className="px-3 py-2 text-center"
                    style={{ backgroundColor: "#F8F9FB", borderTop: "1px solid #E2E6EC" }}
                  >
                    <p className="text-[11px] font-medium" style={{ color: "#94A3B8" }}>
                      Nieuwe woningen verschijnen hier zodra je een account aanmaakt
                    </p>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Card 2 — Account form */}
          <div
            className="bg-white rounded-[12px] mb-3 overflow-hidden"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}
          >
            <div className="px-5 pt-5 pb-5">
              {/* FIX 2: Section title — no caps, near-black, weight 600 */}
              <p className="text-[15px] font-semibold mb-4" style={{ color: "#1F2937" }}>
                Maak een gratis account aan
              </p>

              <div className="flex flex-col gap-4">
                {/* Voornaam */}
                <div>
                  <label className="text-[13px] font-semibold mb-1.5 block" style={{ color: "#374151" }}>
                    {t("onboarding.name.firstNameLabel")}
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Max"
                    className="w-full ha-field-web"
                    style={{ backgroundColor: "#ffffff", borderColor: "#D1D5DB", color: "#111111", borderRadius: 6 }}
                    autoFocus
                    data-testid="input-first-name"
                  />
                </div>

                {/* Achternaam */}
                <div>
                  <label className="text-[13px] font-semibold mb-1.5 block" style={{ color: "#374151" }}>
                    {t("onboarding.name.lastNameLabel")}
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Müller"
                    className="w-full ha-field-web"
                    style={{ backgroundColor: "#ffffff", borderColor: "#D1D5DB", color: "#111111", borderRadius: 6 }}
                    data-testid="input-last-name"
                  />
                </div>

                {/* E-mail */}
                <div>
                  <label className="text-[13px] font-semibold mb-1.5 block" style={{ color: "#374151" }}>
                    {t("onboarding.email.label")}
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("onboarding.email.placeholder")}
                    className="w-full ha-field-web"
                    style={{ backgroundColor: "#ffffff", borderColor: "#D1D5DB", color: "#111111", borderRadius: 6 }}
                    data-testid="input-email"
                  />
                </div>

                {/* Wachtwoord */}
                <div>
                  <label className="text-[13px] font-semibold mb-1.5 block" style={{ color: "#374151" }}>
                    {t("onboarding.password.label")}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t("onboarding.password.web.passwordPlaceholder")}
                      className="w-full ha-field-web"
                      style={{ backgroundColor: "#ffffff", borderColor: "#D1D5DB", color: "#111111", paddingRight: "44px", borderRadius: 6 }}
                      autoComplete="new-password"
                      data-testid="input-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                      style={{ color: "#9CA3AF" }}
                      data-testid="button-toggle-password"
                    >
                      {showPassword ? <EyeOff className="w-[17px] h-[17px]" /> : <Eye className="w-[17px] h-[17px]" />}
                    </button>
                  </div>
                  <PasswordRules password={password} />
                </div>
              </div>

              {/* FIX 7: Back link — moved above CTA, not below trust block */}
              <button
                onClick={handleBack}
                className="flex items-center gap-1 mt-5 mb-3 text-[13px] transition-opacity hover:opacity-70"
                style={{ color: "#9CA3AF" }}
                data-testid="button-password-back"
              >
                <ChevronLeft className="w-[14px] h-[14px]" />
                Terug naar vorige stap
              </button>

              {/* FIX 5: Primary CTA — full brand color, h-[52px], font-semibold, strong shadow */}
              <button
                onClick={handleCreateAccount}
                disabled={!canSubmit}
                className="w-full h-[52px] rounded-[8px] text-[16px] font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-2"
                style={{
                  background: "rgb(var(--ha-primary))",
                  boxShadow: canSubmit ? "0 6px 22px rgba(217,26,104,0.32)" : "none",
                }}
                data-testid="button-create-account"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-[18px] h-[18px] animate-spin" />
                    {t("onboarding.password.creating")}
                  </>
                ) : (
                  t("onboarding.password.cta")
                )}
              </button>

              {/* FIX 6: Legal text — narrower, more line-height, lighter */}
              <p className="text-center text-[11px] leading-[1.65] mt-3 mx-4" style={{ color: "#B0B7C3" }}>
                {t("onboarding.password.terms")}
              </p>

              {/* Login link */}
              <p className="text-center text-[13px] mt-2.5" style={{ color: "#6B7280" }}>
                {t("auth.signup.hasAccount")}{" "}
                <button
                  onClick={() => navigate("/")}
                  className="font-semibold hover:underline"
                  style={{ color: "rgb(var(--ha-primary))" }}
                  data-testid="link-login"
                >
                  {t("auth.signup.loginLink")}
                </button>
              </p>
            </div>
          </div>

          {/* Trust block */}
          <div
            className="bg-white rounded-[16px] overflow-hidden"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}
          >
            <div className="px-6 py-6">
              <div className="flex items-center justify-center gap-2.5 mb-5">
                <ShieldCheck className="w-[20px] h-[20px]" style={{ color: "rgb(var(--ha-primary))" }} />
                <p className="text-[17px] font-bold" style={{ color: "#111111" }}>
                  Zonder risico proberen
                </p>
              </div>
              <div className="flex flex-col gap-4">
                {[
                  "Gratis account — geen creditcard nodig",
                  "Direct actieve zoekopdracht na aanmaken",
                  "Meldingen zodra er een woning match is",
                ].map((text, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-[16px] font-bold shrink-0" style={{ color: "rgb(var(--ha-primary))" }}>✓</span>
                    <span className="text-[14.5px]" style={{ color: "#374151" }}>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </main>
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
