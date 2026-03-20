import { useState, useRef } from "react";
import { useHashSearch } from "@/lib/hash-search";
import { useLocation } from "wouter";
import { ChevronLeft, User, Mail, Lock, Loader2, Gift } from "lucide-react";
import { HousAlertLogo } from "@/components/housalert-logo";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { createSearchProfile } from "@/lib/search-profiles";
import { useTranslation } from "@/i18n";
import { apiFetch } from "@/lib/api-base";
import { useEmbedded } from "@/hooks/use-embedded";

const INPUT_CLS = "w-full h-[44px] pl-11 pr-4 rounded-xl border border-transparent bg-[#F3F4F6] text-[15px] font-medium text-[#222222] placeholder:text-[#717171] placeholder:font-normal focus:bg-white";

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
    });
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    if (loading || submittingRef.current) return;
    submittingRef.current = true;

    setLoading(true);
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

      navigate("/onboarding/value");
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }

  function handleBack() {
    const p = new URLSearchParams(searchString);
    navigate(`/onboarding/preferences?${p.toString()}`);
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col">
      {!isEmbedded && (
        <header className="w-full bg-white sticky top-0 z-20 border-b border-[#E5E7EB]">
          <div className={`${containerClass} mx-auto px-5 h-[56px] flex items-center gap-3`}>
            <button
              onClick={handleBack}
              className="w-10 h-10 rounded-full bg-[#F3F4F6] flex items-center justify-center active:scale-95 transition-transform"
              data-testid="button-back-signup"
            >
              <ChevronLeft className="w-5 h-5 text-[#71717A]" />
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
                step <= 4 ? "bg-[#0D6EFD]" : "bg-[#D1D5DB]"
              }`}
              data-testid={`dot-step-${step}`}
            />
          ))}
        </div>
      </div>

      <main className={`flex-1 ${containerClass} mx-auto w-full px-5 pb-8 pt-3`}>
        <h1
          className="text-[24px] font-medium text-[#222222] leading-[1.15] tracking-[-0.02em] mb-1"
          data-testid="text-signup-title"
        >
          {t("auth.signup.funnelTitle")}
        </h1>
        <p className="text-[14px] text-[#717171] mb-5">
          {t("auth.signup.funnelSubtitle")}
        </p>

        <div className="bg-white rounded-[24px] border border-[#F0F0F0] shadow-[0_2px_8px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)] p-5">
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#71717A]" />
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
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#71717A]" />
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
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#71717A]" />
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
                className="flex items-center gap-2 text-[13px] text-[#717171] hover:text-[#0D6EFD] transition-colors py-1"
                data-testid="button-show-referral"
              >
                <Gift className="w-4 h-4" />
                {t("referral.inputLabel")}
              </button>
            ) : (
              <div>
                <div className="relative">
                  <Gift className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#71717A]" />
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
                <p className="text-[12px] text-[#717171] mt-1 ml-1">{t("referral.inputHelper")}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-[48px] rounded-full text-[15px] font-medium shadow-none bg-[#0D6EFD] hover:bg-[#0B5ED7] mt-1"
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

        <p className="text-center text-[14px] text-[#717171] mt-5">
          {t("auth.signup.hasAccount")}{" "}
          <button
            onClick={() => navigate("/login")}
            className="text-[#0D6EFD] font-medium hover:underline"
            data-testid="link-login"
          >
            {t("auth.signup.loginLink")}
          </button>
        </p>

        <p className="text-center text-[12px] text-[#717171] mt-3">
          {t("auth.signup.footer")}
        </p>
      </main>
    </div>
  );
}
