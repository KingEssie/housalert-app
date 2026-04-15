import { useState, useRef } from "react";
import { useHashSearch } from "@/lib/hash-search";
import { useLocation } from "wouter";
import { ChevronLeft, User, Mail, Lock, Loader2, Gift } from "lucide-react";
import { HousAlertLogo } from "@/components/housalert-logo";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { clearAllUserData } from "@/lib/queryClient";
import { createSearchProfile } from "@/lib/search-profiles";
import { useTranslation } from "@/i18n";
import { apiFetch } from "@/lib/api-base";
import { useEmbedded } from "@/hooks/use-embedded";

const INPUT_CLS = "w-full h-[56px] pl-11 pr-4 rounded-[8px] border border-[#D1D5DB] bg-white text-[16px] font-medium text-[#111111] placeholder:text-[#334855] placeholder:opacity-55 placeholder:font-normal focus:border-ha-primary focus:ring-1 focus:ring-ha-primary/25 outline-none transition-all";

export default function SignupPage() {
  const [, navigate] = useLocation();
  const { isEmbedded, containerClass } = useEmbedded();
  const { toast } = useToast();
  const { t } = useTranslation();
  const searchString = useHashSearch();
  const params = new URLSearchParams(searchString);

  const city = params.get("city") || "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    const targetGroup = params.get("targetGroup");
    const targetCategories = targetGroup && targetGroup !== "any" ? [targetGroup] : undefined;
    const extraFeatures = params.get("amenities")?.split(",").filter(Boolean) || undefined;
    const sendUnclear = params.get("sendUnclear") !== "false";
    const priceFlexible = params.get("priceFlexible") === "true";

    const locationMode = params.get("locationMode") as any || undefined;
    const districts = params.get("districts")?.split(",").filter(Boolean) || undefined;
    const radiusKm = parseInt(params.get("radiusKm") || "0") || undefined;
    const lat = parseFloat(params.get("lat") || "0") || undefined;
    const lng = parseFloat(params.get("lng") || "0") || undefined;
    const commuteAddress = params.get("commuteAddress") || undefined;
    const commuteMode = params.get("commuteMode") || undefined;
    const commuteTime = parseInt(params.get("commuteTime") || "0") || undefined;

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
      commute_destination: commuteAddress,
      commute_mode: commuteMode,
      commute_minutes: commuteTime,
      furnished: furnished && furnished !== "any" ? furnished : undefined,
      property_types: propertyTypes && propertyTypes.length > 0 ? propertyTypes : undefined,
      target_categories: targetCategories,
      extra_features: extraFeatures && extraFeatures.length > 0 ? extraFeatures : undefined,
      send_unclear: sendUnclear,
      price_flexible: priceFlexible,
    });
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    if (loading || submittingRef.current) return;
    submittingRef.current = true;

    setLoading(true);
    console.log(`[IDENTITY] Signup attempt — email="${email}"`);
    clearAllUserData();
    try {
      const res = await apiFetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, fullName: name }),
      });

      const result = await res.json();

      if (!res.ok) {
        const msg = result.error === "user_exists"
          ? t("auth.signup.emailExists")
          : (result.message || result.error || t("auth.signup.failed"));
        toast({ title: t("auth.signup.failed"), description: msg, variant: "destructive" });
        setLoading(false);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        toast({ title: t("auth.signup.failed"), description: signInError.message, variant: "destructive" });
        setLoading(false);
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
          const refRes = await apiFetch("/api/referrals/apply", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${sessionData.session.access_token}`,
            },
            body: JSON.stringify({ code: referralCode.trim() }),
          });
          if (refRes.ok) {
            toast({ title: t("referral.inputSuccess") });
          } else {
            const refData = await refRes.json().catch(() => ({ error: "unknown" }));
            const errorKey = refData.error === "own_code" ? "referral.ownCode"
              : refData.error === "already_used" ? "referral.alreadyUsed"
              : "referral.inputError";
            toast({ title: t(errorKey), variant: "destructive" });
          }
        } catch (err) {
          console.error("[signup] Failed to apply referral code:", err);
        }
      }

      navigate("/onboarding/setup");
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }

  function handleBack() {
    navigate(`/onboarding/filters`);
  }

  return (
    <div className="min-h-screen bg-ha-bg flex flex-col">
      {!isEmbedded && (
        <header className="w-full bg-ha-bg sticky top-0 z-20 border-b border-ha-card-border" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <div className={`${containerClass} mx-auto px-5 h-[56px] flex items-center gap-3`}>
            <button
              onClick={handleBack}
              className="w-10 h-10 rounded-full bg-[#E5E7EB] hover:bg-[#D1D5DB] active:bg-[#D1D5DB] flex items-center justify-center transition-colors"
              data-testid="button-back-signup"
            >
              <ChevronLeft className="w-5 h-5 text-[#374151]" />
            </button>
            <HousAlertLogo size={28} />
          </div>
        </header>
      )}

      <div className={`${containerClass} mx-auto w-full px-5 pt-4 pb-1`}>
        <div className="flex items-center justify-center gap-2 py-2">
          {[1, 2, 3, 4].map((step) => (
            <div
              key={step}
              className={`w-2 h-2 rounded-full transition-all ${
                step <= 4 ? "bg-ha-primary" : "bg-ha-surface"
              }`}
              data-testid={`dot-step-${step}`}
            />
          ))}
        </div>
      </div>

      <main className={`flex-1 ${containerClass} mx-auto w-full px-5 pb-8 pt-3`}>
        <h1
          className="text-[24px] font-medium text-ha-text leading-[1.15] tracking-[-0.02em] mb-1"
          data-testid="text-signup-title"
        >
          {t("auth.signup.funnelTitle")}
        </h1>
        <p className="text-[14px] text-ha-text-secondary mb-5">
          {t("auth.signup.funnelSubtitle")}
        </p>

        <div className="bg-ha-card rounded-[6px] border border-ha-card-border p-5">
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-ha-text-muted" />
              <input
                type="text"
                placeholder={t("auth.signup.namePlaceholder")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={INPUT_CLS}
                data-testid="input-signup-name"
              />
            </div>

            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-ha-text-muted" />
              <input
                type="email"
                placeholder={t("auth.signup.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={INPUT_CLS}
                data-testid="input-signup-email"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-ha-text-muted" />
              <input
                type="password"
                placeholder={t("auth.signup.passwordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className={INPUT_CLS}
                data-testid="input-signup-password"
              />
            </div>

            {!showReferral ? (
              <button
                type="button"
                onClick={() => setShowReferral(true)}
                className="flex items-center gap-2 text-[13px] text-ha-text-secondary hover:text-ha-primary transition-colors py-1"
                data-testid="button-show-referral"
              >
                <Gift className="w-4 h-4" />
                {t("referral.inputLabel")}
              </button>
            ) : (
              <div>
                <div className="relative">
                  <Gift className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-ha-text-muted" />
                  <input
                    type="text"
                    placeholder={t("referral.inputPlaceholder")}
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    className={INPUT_CLS}
                    data-testid="input-referral-code"
                    autoCapitalize="characters"
                  />
                </div>
                <p className="text-[12px] text-ha-text-muted mt-1 ml-1">{t("referral.inputHelper")}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full ha-btn bg-ha-primary hover:bg-ha-primary-hover text-white font-medium shadow-none mt-1"
              disabled={loading || !email || !password}
              data-testid="button-signup-submit"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t("auth.signup.submitAlt")}
                </span>
              ) : (
                t("auth.signup.funnelCta")
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-[14px] text-ha-text-secondary mt-5">
          {t("auth.signup.hasAccount")}{" "}
          <button
            onClick={() => navigate("/")}
            className="text-ha-primary font-medium hover:underline"
            data-testid="link-login"
          >
            {t("auth.signup.loginLink")}
          </button>
        </p>

        <p className="text-center text-[12px] text-ha-text-muted mt-3">
          {t("auth.signup.footer")}
        </p>
      </main>
    </div>
  );
}
