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

const BRAND = "rgb(var(--ha-primary))";
const BRAND_HOVER = "rgb(var(--ha-primary-hover))";

const INPUT_CLS = "w-full h-[48px] pl-11 pr-4 rounded-[6px] border border-ha-card-border bg-ha-card text-[15px] font-medium text-ha-text placeholder:text-ha-text-muted placeholder:font-normal focus:border-ha-primary focus:shadow-[0_0_0_3px_rgba(233,30,99,0.08)] outline-none transition-all";

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-1.5 justify-center py-3" data-testid="progress-dots">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="h-[6px] rounded-full transition-all"
          style={{
            width: i === current ? 24 : 6,
            backgroundColor: i <= current ? BRAND : "rgba(var(--ha-text-rgb, 26,26,46), 0.12)",
          }}
        />
      ))}
    </div>
  );
}

export default function OnboardingPassword() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const { toast } = useToast();
  const searchString = useHashSearch();
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
    <div className="min-h-[100dvh] flex flex-col bg-ha-bg" data-testid="screen-onboarding-password">
      <header className="sticky top-0 z-20 bg-ha-card border-b border-ha-card-border">
        <div className="max-w-[480px] mx-auto px-5 h-[56px] flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-10 h-10 rounded-full bg-ha-surface flex items-center justify-center active:scale-95 transition-transform"
            data-testid="button-password-back"
          >
            <ChevronLeft className="w-5 h-5 text-ha-text-muted" />
          </button>
          <div className="flex-1 flex justify-center">
            <HousAlertLogo size={28} />
          </div>
          <div className="w-10" />
        </div>
      </header>

      <div className="max-w-[480px] mx-auto px-5 w-full">
        <ProgressDots current={5} total={7} />
      </div>

      <main className="flex-1 flex flex-col max-w-[480px] mx-auto w-full px-5 pt-4 pb-8">
        <h1
          className="text-[24px] font-bold tracking-[-0.02em] text-ha-text mb-2"
          data-testid="text-password-title"
        >
          {t("onboarding.password.title") || "Wähle ein Passwort"}
        </h1>
        <p className="text-[14px] text-ha-text-secondary mb-6 leading-relaxed">
          {t("onboarding.password.subtitle") || "Mindestens 6 Zeichen, damit dein Konto sicher ist."}
        </p>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-[13px] font-medium text-ha-text-secondary mb-1.5 block">
              {t("onboarding.password.label") || "Passwort"}
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-ha-text-muted" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("onboarding.password.placeholder") || "Mindestens 6 Zeichen"}
                minLength={6}
                className={`${INPUT_CLS} !pr-11`}
                autoFocus
                data-testid="input-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ha-text-muted hover:text-ha-text transition-colors"
                data-testid="button-toggle-password"
              >
                {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
              </button>
            </div>
            {password.length > 0 && password.length < 6 && (
              <p className="text-[12px] text-red-500 mt-1.5" data-testid="text-password-hint">
                {t("onboarding.password.tooShort") || "Mindestens 6 Zeichen erforderlich"}
              </p>
            )}
          </div>

          {!showReferral ? (
            <button
              type="button"
              onClick={() => setShowReferral(true)}
              className="flex items-center gap-2 text-[13px] text-ha-text-secondary hover:text-ha-primary transition-colors py-1"
              data-testid="button-show-referral"
            >
              <Gift className="w-4 h-4" />
              {t("referral.inputLabel") || "Empfehlungscode eingeben"}
            </button>
          ) : (
            <div>
              <label className="text-[13px] font-medium text-ha-text-secondary mb-1.5 block">
                {t("referral.inputLabel") || "Empfehlungscode"}
              </label>
              <div className="relative">
                <Gift className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-ha-text-muted" />
                <input
                  type="text"
                  placeholder={t("referral.inputPlaceholder") || "ABC123"}
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  className={INPUT_CLS}
                  autoCapitalize="characters"
                  data-testid="input-referral-code"
                />
              </div>
              <p className="text-[12px] text-ha-text-muted mt-1 ml-1">
                {t("referral.inputHelper") || "Optional"}
              </p>
            </div>
          )}
        </div>

        <div className="mt-auto pt-8">
          <button
            onClick={handleCreateAccount}
            disabled={!canSubmit}
            className="w-full h-[52px] rounded-[6px] text-[15px] font-bold text-white transition-all active:scale-[0.97] disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: BRAND }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = BRAND_HOVER)}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = BRAND)}
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

          <p className="text-center text-[12px] text-ha-text-muted mt-4 leading-relaxed">
            {t("onboarding.password.terms") || "Mit der Registrierung akzeptierst du unsere Nutzungsbedingungen und Datenschutzrichtlinie."}
          </p>

          <p className="text-center text-[14px] text-ha-text-secondary mt-4">
            {t("auth.signup.hasAccount") || "Hast du schon ein Konto?"}{" "}
            <button
              onClick={() => navigate("/")}
              className="text-ha-primary font-medium hover:underline"
              data-testid="link-login"
            >
              {t("auth.signup.loginLink") || "Anmelden"}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}
