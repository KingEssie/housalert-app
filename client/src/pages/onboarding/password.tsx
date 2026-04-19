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
import { useQuery } from "@tanstack/react-query";
import { isValidImageUrl } from "@/components/listing-fallback";
import {
  normalizeOnboardingParams,
  matchEstimateQueryKey,
  fetchMatchEstimate,
  type MatchEstimateResult,
  type PreviewListingResult,
} from "@/lib/match-estimate";

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

  // Normalize all onboarding URL params into the shared filter format and
  // POST them to /api/match-estimate, which applies the full matching engine
  // (same logic used for real alerts) to count matches and find a preview listing.
  const normalizedFilters = normalizeOnboardingParams(params);

  const { data: estimate } = useQuery<MatchEstimateResult>({
    queryKey: matchEstimateQueryKey(normalizedFilters),
    queryFn: () => fetchMatchEstimate(normalizedFilters),
    enabled: !!city,
    staleTime: 2 * 60 * 1000,
  });

  // Preview listing — server already applied the fallback order:
  //   1. Newest matching listing with a valid image_url
  //   2. Newest matching listing without a valid image → client shows placeholder
  //   3. null → static card (no matching listings in DB)
  const previewListing: PreviewListingResult | null = estimate?.latestListingWithImage ?? null;
  const previewImageSrc = isValidImageUrl(previewListing?.image_url)
    ? previewListing!.image_url!
    : "/listing-placeholder.png";

  // Match count for the info card — real 30-day count, fallback to display value
  const matchCount30 = estimate?.matchesLast30Days ?? null;

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
        {/* Header — logo left, X right, no title text */}
        <header
          className="sticky top-0 z-20 w-full"
          style={{ backgroundColor: "#ffffff", borderBottom: "1px solid #EBEBEB" }}
        >
          <div className="max-w-[480px] mx-auto px-4 h-[52px] flex items-center justify-between">
            <HousAlertLogo size={26} />
            <button
              onClick={handleClose}
              className="w-[34px] h-[34px] shrink-0 flex items-center justify-center rounded-full transition-opacity hover:opacity-70 active:opacity-50"
              style={{ backgroundColor: "#F2F2F2", color: "#444444" }}
              data-testid="button-password-close"
            >
              <X className="w-[20px] h-[20px]" />
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-[480px] mx-auto w-full px-4 pt-5 pb-8 overflow-y-auto">

          {/* Main page title */}
          <h1
            className="text-[28px] font-bold leading-tight mb-5"
            style={{ color: "#111111" }}
            data-testid="text-page-title"
          >
            {t("onboarding.password.web.title")}
          </h1>

          {/* Card 1 — "Jouw zoekopdracht" accordion */}
          <div
            className="rounded-[4px] mb-3 overflow-hidden bg-white"
            style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.08)" }}
            data-testid="search-summary-card"
          >
            <div className="p-4 flex flex-col gap-3">

              {/* Header row — clickable toggle */}
              <button
                onClick={() => setAccordionOpen(!accordionOpen)}
                className="flex items-center justify-between w-full transition-opacity active:opacity-60"
                data-testid="button-accordion-toggle"
              >
                <span className="text-[16px] font-bold" style={{ color: "rgb(var(--ha-primary))" }}>
                  {t("onboarding.password.web.searchQuery")}
                </span>
                <ChevronDown
                  className="w-[17px] h-[17px] transition-transform duration-300"
                  style={{
                    color: "rgb(var(--ha-primary))",
                    transform: accordionOpen ? "rotate(0deg)" : "rotate(-90deg)",
                  }}
                />
              </button>

              {/* Info card — no border, just background tint */}
              <div
                className="rounded-[4px] px-4 py-3"
                style={{ backgroundColor: "#EBF2FC" }}
                data-testid="match-summary-card"
              >
                <p className="text-[13.5px] leading-[1.55]" style={{ color: "#1E3A8A" }}>
                  {(() => {
                    const raw = t("onboarding.password.web.missedMatchesStat", { count: "|||" });
                    const [pre, post] = raw.split("|||");
                    return (
                      <>
                        {pre}
                        <span className="font-bold" style={{ color: "#1D4ED8" }}>
                          {matchCount30 !== null ? Math.max(1, matchCount30) : "—"}
                        </span>
                        {post}
                      </>
                    );
                  })()}
                </p>
              </div>

            </div>

            {/* Collapsible: grey sub-card + caption + preview listing */}
            <div
              style={{
                maxHeight: accordionOpen ? "460px" : "0px",
                overflow: "hidden",
                transition: "max-height 0.32s cubic-bezier(0.4,0,0.2,1)",
              }}
            >
              <div className="px-4 pb-4 flex flex-col gap-2.5">

                {/* Grey sub-card: city + filter details — light, near page background */}
                <div
                  className="rounded-[4px] px-4 py-3 flex flex-col gap-1"
                  style={{ backgroundColor: "#ECEEF1" }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-[8px] h-[8px] rounded-full shrink-0"
                      style={{ backgroundColor: "rgb(var(--ha-primary))" }}
                    />
                    <span className="text-[15px] font-extrabold tracking-tight" style={{ color: "#0F172A" }}>
                      {searchName}
                    </span>
                  </div>
                  <p className="text-[12px] pl-[16px] font-medium" style={{ color: "#1F2937" }}>
                    {[
                      minPrice && maxPrice ? `€${minPrice}–€${maxPrice}` : null,
                      roomsLabel ? `${roomsLabel} ${t("onboarding.password.web.apartments")}` : null,
                      radiusKm ? `${radiusKm} km radius` : null,
                    ].filter(Boolean).join(" · ")}
                  </p>
                </div>

                {/* Caption text */}
                <p className="text-[11.5px] font-medium" style={{ color: "#374151" }}>
                  {t("onboarding.password.web.previewCaption")}
                </p>

                {/* Preview listing card — no hard border, shadow only */}
                <div
                  className="rounded-[4px] overflow-hidden bg-white"
                  style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.10)" }}
                  data-testid="listing-preview-card"
                >
                  {/* Image area — overlay badge top-right */}
                  <div className="relative w-full h-[148px] overflow-hidden" style={{ backgroundColor: "#EDF2F7" }}>
                    <img
                      src={previewImageSrc}
                      alt=""
                      className="w-full h-full object-cover"
                      draggable={false}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = "/listing-placeholder.png";
                      }}
                    />
                    {/* Upgrade badge — top-right overlay inside image */}
                    <span
                      className="absolute top-2 right-2 text-[10px] font-semibold px-2 py-[3px] rounded-[4px]"
                      style={{ backgroundColor: "rgba(255,255,255,0.92)", color: "rgb(var(--ha-primary))" }}
                    >
                      {t("onboarding.password.web.upgradeToView")}
                    </span>
                  </div>

                  {/* Meta row — price · size · time (no CTA, no /mnd) */}
                  <div className="flex items-center gap-2 px-3.5 py-3 min-w-0" style={{ borderTop: "1px solid #F3F4F6" }}>
                    <span className="text-[14px] font-bold shrink-0" style={{ color: "#111111" }}>
                      {previewListing?.price ? `€${previewListing.price}` : "€850"}
                    </span>
                    <span className="w-[3px] h-[3px] rounded-full shrink-0" style={{ backgroundColor: "#D1D5DB" }} />
                    <span className="text-[12px] font-medium shrink-0" style={{ color: "#111111" }}>
                      {previewListing?.size_m2 ? `${previewListing.size_m2} m²` : "45 m²"}
                    </span>
                    <span className="w-[3px] h-[3px] rounded-full shrink-0" style={{ backgroundColor: "#D1D5DB" }} />
                    <span className="text-[12px] truncate min-w-0" style={{ color: "#6B7280" }}>
                      {previewListing?.fresh_label
                        ? t(`freshness.${({ net_binnen: "justIn", vandaag: "today" } as Record<string, string>)[previewListing.fresh_label] ?? "daysAgo"}`, { n: "1" })
                        : t("onboarding.password.web.fallbackFreshLabel", { n: "2" })}
                    </span>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Card 2 — Account form */}
          <div
            className="bg-white rounded-[12px] mb-3 overflow-hidden"
            style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.10)" }}
          >
            <div className="px-5 pt-5 pb-5">
              <p className="text-[18px] font-bold mb-4" style={{ color: "#111111" }}>
                {t("onboarding.password.web.createFreeAccount")}
              </p>

              <div className="flex flex-col gap-4">
                {/* Voornaam */}
                <div>
                  <label className="text-[13px] font-semibold mb-1.5 block" style={{ color: "#111111" }}>
                    {t("onboarding.name.firstNameLabel")}
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Max"
                    className="w-full ha-field-web"
                    style={{ backgroundColor: "#ffffff", borderColor: "#C4C8D0", color: "#111111", borderRadius: 4 }}
                    autoFocus
                    data-testid="input-first-name"
                  />
                </div>

                {/* Achternaam */}
                <div>
                  <label className="text-[13px] font-semibold mb-1.5 block" style={{ color: "#111111" }}>
                    {t("onboarding.name.lastNameLabel")}
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Müller"
                    className="w-full ha-field-web"
                    style={{ backgroundColor: "#ffffff", borderColor: "#C4C8D0", color: "#111111", borderRadius: 4 }}
                    data-testid="input-last-name"
                  />
                </div>

                {/* E-mail */}
                <div>
                  <label className="text-[13px] font-semibold mb-1.5 block" style={{ color: "#111111" }}>
                    {t("onboarding.email.label")}
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("onboarding.email.placeholder")}
                    className="w-full ha-field-web"
                    style={{ backgroundColor: "#ffffff", borderColor: "#C4C8D0", color: "#111111", borderRadius: 4 }}
                    data-testid="input-email"
                  />
                </div>

                {/* Wachtwoord */}
                <div>
                  <label className="text-[13px] font-semibold mb-1.5 block" style={{ color: "#111111" }}>
                    {t("onboarding.password.label")}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t("onboarding.password.web.passwordPlaceholder")}
                      className="w-full ha-field-web"
                      style={{ backgroundColor: "#ffffff", borderColor: "#C4C8D0", color: "#111111", paddingRight: "44px", borderRadius: 4 }}
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

              {/* Primary CTA */}
              <button
                onClick={handleCreateAccount}
                disabled={!canSubmit}
                className="w-full mt-5 h-[52px] rounded-[8px] text-[16px] font-bold text-white transition-all active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-2"
                style={{
                  background: "rgb(var(--ha-primary))",
                  boxShadow: canSubmit ? "0 8px 28px rgba(217,26,104,0.38)" : "none",
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

              {/* Legal text */}
              <p className="text-center text-[12px] leading-[1.65] mt-3 mx-4" style={{ color: "#9CA3AF" }}>
                {t("onboarding.password.terms")}
              </p>

              {/* Login link */}
              <p className="text-center text-[13px] mt-2.5" style={{ color: "#4B5563" }}>
                {t("auth.signup.hasAccount")}{" "}
                <button
                  onClick={() => navigate("/")}
                  className="font-bold hover:underline"
                  style={{ color: "rgb(var(--ha-primary))" }}
                  data-testid="link-login"
                >
                  {t("auth.signup.loginLink")}
                </button>
              </p>
            </div>
          </div>

          {/* Trust block — 3 premium benefit rows */}
          <div
            className="bg-white rounded-[16px] overflow-hidden"
            style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.10)" }}
          >
            <div className="px-5 pt-5 pb-5">
              <div className="flex items-center gap-2.5 mb-5">
                <ShieldCheck className="w-[19px] h-[19px]" style={{ color: "rgb(var(--ha-primary))" }} />
                <p className="text-[18px] font-bold" style={{ color: "#111111" }}>
                  {t("onboarding.password.web.riskFreeTitle")}
                </p>
              </div>
              <div className="flex flex-col" style={{ gap: 0 }}>
                {[
                  {
                    icon: "💳",
                    title: t("onboarding.password.web.trust1Title"),
                    sub: t("onboarding.password.web.trust1Sub"),
                  },
                  {
                    icon: "⚡",
                    title: t("onboarding.password.web.trust2Title"),
                    sub: t("onboarding.password.web.trust2Sub"),
                  },
                  {
                    icon: "🔔",
                    title: t("onboarding.password.web.trust3Title"),
                    sub: t("onboarding.password.web.trust3Sub"),
                  },
                ].map((item, i, arr) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 py-4"
                    style={i < arr.length - 1 ? { borderBottom: "1px solid #E2E2E5" } : {}}
                  >
                    <div
                      className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center shrink-0 text-[18px]"
                      style={{ backgroundColor: "rgba(217,26,104,0.10)" }}
                    >
                      {item.icon}
                    </div>
                    <div>
                      <p className="text-[15px] font-bold leading-tight" style={{ color: "#111111" }}>
                        {item.title}
                      </p>
                      <p className="text-[13px] leading-snug mt-1" style={{ color: "#4B5563" }}>
                        {item.sub}
                      </p>
                    </div>
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
