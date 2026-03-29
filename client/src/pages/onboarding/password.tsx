import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useHashSearch } from "@/lib/hash-search";
import { useTranslation } from "@/i18n";
import { HousAlertLogo } from "@/components/housalert-logo";
import { ChevronLeft, Lock, Loader2, Eye, EyeOff, Gift } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { clearAllUserData } from "@/lib/queryClient";
import { createSearchProfile } from "@/lib/search-profiles";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-base";
import { OB, OBW, OBStickyBar, useWebsiteMode } from "@/components/onboarding-ui";

export default function OnboardingPassword() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const { toast } = useToast();
  const searchString = useHashSearch();
  const w = useWebsiteMode();
  const T = w ? OBW : OB;
  const params = new URLSearchParams(searchString);

  const firstName = params.get("firstName") || "";
  const lastName = params.get("lastName") || "";
  const email = params.get("email") || "";
  const city = params.get("city") || "";

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [showReferral, setShowReferral] = useState(false);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  async function saveSearchProfile(userId: string) {
    const minPrice = parseInt(params.get("minPrice") || "0") || 0;
    const maxPrice = parseInt(params.get("maxPrice") || "0") || 0;
    const bedroomsMin = parseInt(params.get("minRooms") || "0") || 0;
    const sizeMin = parseInt(params.get("minSize") || "0") || 0;
    const furnished = params.get("furnished") || undefined;
    const propertyTypes = params.get("propertyTypes")?.split(",").filter(Boolean) || undefined;
    const locationMode = params.get("locationMode") as any || undefined;
    const districts = params.get("districts")?.split(",").filter(Boolean) || undefined;
    const radiusKm = parseInt(params.get("radiusKm") || "0") || undefined;
    const lat = parseFloat(params.get("lat") || "0") || undefined;
    const lng = parseFloat(params.get("lng") || "0") || undefined;

    await createSearchProfile({
      user_id: userId,
      city_name: city,
      country_code: "DE",
      latitude: lat,
      longitude: lng,
      price_min: minPrice,
      price_max: maxPrice,
      bedrooms_min: bedroomsMin,
      size_min: sizeMin,
      location_mode: locationMode,
      districts: districts && districts.length > 0 ? districts : undefined,
      radius_km: radiusKm,
      furnished: furnished && furnished !== "any" ? furnished : undefined,
      property_types: propertyTypes && propertyTypes.length > 0 ? propertyTypes : undefined,
    });
  }

  async function handleCreateAccount() {
    if (!email || !password || password.length < 6) return;
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

      navigate("/onboarding/setup");
    } catch (err: any) {
      toast({ title: t("common.error") || "Fehler", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }

  function handleBack() {
    const out = new URLSearchParams(searchString);
    navigate(`/onboarding/email?${out.toString()}`);
  }

  const canSubmit = password.length >= 6 && email && !loading;

  return (
    <div
      className={`min-h-[100dvh] flex flex-col ${w ? "" : "ob-dark"}`}
      style={{ background: T.gradient }}
      data-testid="screen-onboarding-password"
    >
      <header
        className="sticky top-0 z-20 backdrop-blur-md border-b"
        style={{
          backgroundColor: T.headerBg,
          borderColor: T.headerBorder,
          paddingTop: w ? "0px" : undefined,
        }}
      >
        <div className="max-w-[480px] mx-auto px-5 h-[56px] flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-transform"
            style={{ backgroundColor: w ? OBW.backBtnBg : OB.backBtnBg }}
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
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px]" style={{ color: "#999" }} />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("onboarding.password.placeholder") || "Mindestens 6 Zeichen"}
                minLength={6}
                className={`w-full h-[56px] pl-12 pr-12 rounded-[6px] text-[15px] font-medium ${w ? "ha-field" : "ob-input"}`}
                style={w ? { backgroundColor: OBW.inputBg, borderColor: OBW.inputBorder, color: OBW.text } : undefined}
                autoFocus
                data-testid="input-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: "#999" }}
                data-testid="button-toggle-password"
              >
                {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
              </button>
            </div>
            {password.length > 0 && password.length < 6 && (
              <p className={`text-[12px] mt-1.5 ${w ? "text-red-500" : "text-red-400"}`} data-testid="text-password-hint">
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
                <Gift className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px]" style={{ color: "#999" }} />
                <input
                  type="text"
                  placeholder={t("referral.inputPlaceholder") || "ABC123"}
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  className={`w-full h-[56px] pl-12 pr-4 rounded-[6px] text-[15px] font-medium ${w ? "ha-field" : "ob-input"}`}
                  style={w ? { backgroundColor: OBW.inputBg, borderColor: OBW.inputBorder, color: OBW.text } : undefined}
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

      <OBStickyBar websiteMode={w}>
        <button
          onClick={handleCreateAccount}
          disabled={!canSubmit}
          className="w-full h-[56px] rounded-[6px] text-[15px] font-bold text-white transition-all active:scale-[0.97] disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ background: T.pinkGradient, boxShadow: canSubmit ? T.pinkShadow : "none" }}
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
