import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useHashSearch } from "@/lib/hash-search";
import { useTranslation } from "@/i18n";
import { HousAlertLogo } from "@/components/housalert-logo";
import { ChevronLeft, Lock, Loader2, Eye, EyeOff, Gift, MapPin } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { clearAllUserData } from "@/lib/queryClient";
import { createSearchProfile } from "@/lib/search-profiles";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-base";
import { OB, OBW, OBStickyBar, OBWebHeader, OBInfoBox, useWebsiteMode, appendWebsiteParams } from "@/components/onboarding-ui";

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
  const minPrice = params.get("minPrice") || "0";
  const maxPrice = params.get("maxPrice") || "0";
  const minRooms = params.get("minRooms") || "0";

  const [firstName, setFirstName] = useState(params.get("firstName") || "");
  const [lastName, setLastName] = useState(params.get("lastName") || "");
  const [email, setEmail] = useState(params.get("email") || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [showReferral, setShowReferral] = useState(false);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  async function saveSearchProfile(userId: string) {
    const spMinPrice = parseInt(params.get("minPrice") || "0") || 0;
    const spMaxPrice = parseInt(params.get("maxPrice") || "0") || 0;
    const bedroomsMin = parseInt(params.get("minRooms") || "0") || 0;
    const sizeMin = parseInt(params.get("minSize") || "0") || 0;
    const furnished = params.get("furnished") || undefined;
    const propertyTypes = params.get("propertyTypes")?.split(",").filter(Boolean) || undefined;
    const locationMode = params.get("locationMode") as any || undefined;
    const districts = params.get("districts")?.split(",").filter(Boolean) || undefined;
    const spRadiusKm = parseInt(params.get("radiusKm") || "0") || undefined;
    const lat = parseFloat(params.get("lat") || "0") || undefined;
    const lng = parseFloat(params.get("lng") || "0") || undefined;
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
    if (!email || !password || password.length < 6) return;
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
          ? (t("auth.signup.emailExists") || "Diese E-Mail wird bereits verwendet.")
          : (result.message || result.error || t("auth.signup.failed") || "Registrierung fehlgeschlagen.");
        toast({ title: t("auth.signup.failed") || "Fehler", description: msg, variant: "destructive" });
        setLoading(false);
        submittingRef.current = false;
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        toast({ title: t("auth.signup.failed") || "Fehler", description: signInError.message, variant: "destructive" });
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

      if (referralCode.trim() && sessionData?.session?.access_token) {
        try {
          await apiFetch("/api/referrals/apply", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${sessionData.session.access_token}`,
            },
            body: JSON.stringify({ code: referralCode.trim() }),
          });
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
      toast({ title: t("common.error") || "Fehler", description: err.message, variant: "destructive" });
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

  const canSubmit = w
    ? (firstName.trim() && isValidEmail(email) && password.length >= 6 && !loading)
    : (password.length >= 6 && email && !loading);

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
            className="text-[22px] font-bold tracking-[-0.02em] mb-4"
            style={{ color: OBW.text }}
            data-testid="text-password-title"
          >
            Waar kunnen we je matches heen sturen?
          </h2>
          {city && (
            <div
              className="rounded-[4px] p-3.5 mb-4 flex items-start gap-3"
              style={{
                backgroundColor: "#F7F7F7",
                border: `1px solid rgba(255,56,92,0.15)`,
              }}
              data-testid="search-summary-card"
            >
              <MapPin className="w-4 h-4 shrink-0 mt-0.5" style={{ color: OBW.pink }} />
              <div className="min-w-0">
                <p className="text-[14px] font-semibold" style={{ color: OBW.text }}>
                  {city}{radiusKm ? ` · ${radiusKm} km` : ""}
                </p>
                <p className="text-[12px]" style={{ color: OBW.textSecondary }}>
                  €{minPrice}–€{maxPrice} · {roomsLabel} kamers
                </p>
              </div>
            </div>
          )}

          <div className="mb-4">
            <OBInfoBox>
              Er waren afgelopen week <strong>121 woningen</strong> beschikbaar in {city || "jouw regio"}. Maak een account aan om ze niet te missen!
            </OBInfoBox>
          </div>

          <div className="flex flex-col gap-2.5">
            <div>
              <label className="text-[12px] font-semibold mb-1 block" style={{ color: OBW.textSecondary }}>
                Voornaam
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
              <label className="text-[12px] font-semibold mb-1 block" style={{ color: OBW.textSecondary }}>
                Achternaam
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
              <label className="text-[12px] font-semibold mb-1 block" style={{ color: OBW.textSecondary }}>
                E-mailadres
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jouw@email.de"
                className="w-full ha-field-web"
                style={{ backgroundColor: OBW.inputBg, borderColor: OBW.inputBorder, color: OBW.text }}
                data-testid="input-email"
              />
            </div>

            <div>
              <label className="text-[12px] font-semibold mb-1 block" style={{ color: OBW.textSecondary }}>
                Wachtwoord
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimaal 6 tekens"
                  minLength={6}
                  className="w-full ha-field-web"
                  style={{ backgroundColor: OBW.inputBg, borderColor: OBW.inputBorder, color: OBW.text, paddingRight: "44px" }}
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: "#9CA3AF" }}
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff className="w-[16px] h-[16px]" /> : <Eye className="w-[16px] h-[16px]" />}
                </button>
              </div>
              {password.length > 0 && password.length < 6 && (
                <p className="text-[12px] mt-1.5 text-red-500" data-testid="text-password-hint">
                  Minimaal 6 tekens vereist
                </p>
              )}
            </div>

            {!showReferral ? (
              <button
                type="button"
                onClick={() => setShowReferral(true)}
                className="flex items-center gap-2 text-[13px] py-1 transition-colors"
                style={{ color: OBW.textSecondary }}
                data-testid="button-show-referral"
              >
                <Gift className="w-4 h-4" />
                Empfehlungscode eingeben
              </button>
            ) : (
              <div>
                <label className="text-[13px] font-semibold mb-1.5 block" style={{ color: OBW.text }}>
                  Empfehlungscode
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
                  Optioneel
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
                className="flex-1 h-[44px] rounded-[4px] text-[14px] font-bold text-white transition-all active:scale-[0.97] disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: OBW.pink, boxShadow: canSubmit ? "0 4px 14px rgba(255,56,92,0.25)" : "none" }}
                data-testid="button-create-account"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Wordt aangemaakt...
                  </>
                ) : (
                  "Account aanmaken"
                )}
              </button>
            </div>

            <p className="text-center text-[10px] leading-relaxed" style={{ color: OBW.textMuted }}>
              Met de registratie accepteer je onze Nutzungsbedingungen en Datenschutzrichtlinie.
            </p>

            <p className="text-center text-[12px] mt-1" style={{ color: OBW.textSecondary }}>
              Heb je al een account?{" "}
              <button
                onClick={() => navigate("/")}
                className="font-semibold hover:underline"
                style={{ color: OB.pink }}
                data-testid="link-login"
              >
                Inloggen
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-[100dvh] flex flex-col ob-dark"
      style={{ background: T.gradient }}
      data-testid="screen-onboarding-password"
    >
      <header
        className="sticky top-0 z-20 backdrop-blur-md border-b"
        style={{
          backgroundColor: T.headerBg,
          borderColor: T.headerBorder,
        }}
      >
        <div className="max-w-[480px] mx-auto px-5 h-[56px] flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-transform"
            style={{ backgroundColor: OB.backBtnBg }}
            data-testid="button-password-back"
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
          className="text-[24px] font-bold tracking-[-0.02em] mb-2"
          style={{ color: T.text }}
          data-testid="text-password-title"
        >
          {t("onboarding.password.title") || "Wähle ein Passwort"}
        </h1>
        <p className="text-[14px] mb-6 leading-relaxed" style={{ color: T.textSecondary }}>
          {t("onboarding.password.subtitle") || "Mindestens 6 Zeichen, damit dein Konto sicher ist."}
        </p>

        <div className="flex flex-col gap-6">
          <div>
            <label className="text-[13px] font-medium mb-1.5 block" style={{ color: T.textSecondary }}>
              {t("onboarding.password.label") || "Passwort"}
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px]" style={{ color: "#9CA3AF" }} />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("onboarding.password.placeholder") || "Mindestens 6 Zeichen"}
                minLength={6}
                className="w-full h-[56px] pl-12 pr-12 rounded-[6px] text-[15px] font-medium ob-input"
                autoFocus
                data-testid="input-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: "#9CA3AF" }}
                data-testid="button-toggle-password"
              >
                {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
              </button>
            </div>
            {password.length > 0 && password.length < 6 && (
              <p className="text-[12px] mt-1.5 text-red-400" data-testid="text-password-hint">
                {t("onboarding.password.tooShort") || "Mindestens 6 Zeichen erforderlich"}
              </p>
            )}
          </div>

          {!showReferral ? (
            <button
              type="button"
              onClick={() => setShowReferral(true)}
              className="flex items-center gap-2 text-[13px] py-1 transition-colors"
              style={{ color: T.textSecondary }}
              data-testid="button-show-referral"
            >
              <Gift className="w-4 h-4" />
              {t("referral.inputLabel") || "Empfehlungscode eingeben"}
            </button>
          ) : (
            <div>
              <label className="text-[13px] font-medium mb-1.5 block" style={{ color: T.textSecondary }}>
                {t("referral.inputLabel") || "Empfehlungscode"}
              </label>
              <div className="relative">
                <Gift className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px]" style={{ color: "#9CA3AF" }} />
                <input
                  type="text"
                  placeholder={t("referral.inputPlaceholder") || "ABC123"}
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  className="w-full h-[56px] pl-12 pr-4 rounded-[6px] text-[15px] font-medium ob-input"
                  autoCapitalize="characters"
                  data-testid="input-referral-code"
                />
              </div>
              <p className="text-[12px] mt-1 ml-1" style={{ color: T.textMuted }}>
                {t("referral.inputHelper") || "Optional"}
              </p>
            </div>
          )}
        </div>
      </main>

      <OBStickyBar>
        <button
          onClick={handleCreateAccount}
          disabled={!canSubmit}
          className="w-full h-[56px] rounded-[6px] text-[15px] font-bold text-white transition-all active:scale-[0.97] disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ background: T.pink, boxShadow: canSubmit ? T.pinkShadow : "none" }}
          data-testid="button-create-account"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {t("onboarding.password.creating") || "Konto wird erstellt..."}
            </>
          ) : (
            t("onboarding.password.cta") || "Konto erstellen"
          )}
        </button>

        <p className="text-center text-[12px] mt-3 leading-relaxed" style={{ color: T.textMuted }}>
          {t("onboarding.password.terms") || "Mit der Registrierung akzeptierst du unsere Nutzungsbedingungen und Datenschutzrichtlinie."}
        </p>

        <p className="text-center text-[14px] mt-3 pb-1" style={{ color: T.textSecondary }}>
          {t("auth.signup.hasAccount") || "Hast du schon ein Konto?"}{" "}
          <button
            onClick={() => navigate("/")}
            className="font-medium hover:underline"
            style={{ color: OB.pink }}
            data-testid="link-login"
          >
            {t("auth.signup.loginLink") || "Anmelden"}
          </button>
        </p>
      </OBStickyBar>
    </div>
  );
}
