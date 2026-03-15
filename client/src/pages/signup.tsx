import { useState } from "react";
import { useHashSearch } from "@/lib/hash-search";
import { useLocation } from "wouter";
import { Home, ChevronLeft, User, Mail, Lock, MailCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { ensureTrialForCurrentUser } from "@/lib/auth";
import { createSearchProfile } from "@/lib/search-profiles";
import { useTranslation } from "@/i18n";

function ProgressDots({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 py-4">
      {[1, 2, 3, 4].map((step) => (
        <div
          key={step}
          className={`w-2.5 h-2.5 rounded-full transition-all ${
            step <= current ? "bg-[#0D6EFD]" : "bg-[#E5E7EB]"
          }`}
          data-testid={`dot-step-${step}`}
        />
      ))}
    </div>
  );
}

export default function SignupPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();
  const searchString = useHashSearch();
  const params = new URLSearchParams(searchString);

  const city = params.get("city") || "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailConfirmationPending, setEmailConfirmationPending] = useState(false);

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

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        toast({ title: t("auth.signup.failed"), description: error.message, variant: "destructive" });
        setLoading(false);
        return;
      }

      if (!data.user) {
        toast({ title: t("auth.signup.failed"), description: t("common.error"), variant: "destructive" });
        setLoading(false);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const hasSession = !!sessionData?.session?.access_token;

      if (hasSession) {
        import("@/lib/track-event").then(({ trackEvent }) => {
          trackEvent("account_created");
        }).catch(() => {});

        if (city) {
          try {
            await saveSearchProfile(data.user.id);
          } catch (err) {
            console.error("[signup] Failed to create search profile:", err);
          }
        }

        const trialOk = await ensureTrialForCurrentUser();
        if (!trialOk) {
          console.error("[signup] Trial creation failed after signup");
        }
        navigate("/onboarding/value");
      } else {
        setEmailConfirmationPending(true);
      }
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    navigate(`/onboarding/preferences?${searchString}`);
  }

  if (emailConfirmationPending) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <header className="w-full bg-white sticky top-0 z-20 border-b border-[#E5E7EB]">
          <div className="max-w-xl mx-auto px-6 h-[60px] flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#0D6EFD] flex items-center justify-center">
                <Home className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-bold text-[#111C3D] text-base">HousAlert</span>
            </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-[72px] h-[72px] rounded-2xl bg-[#EBF2FF] flex items-center justify-center mb-8">
            <MailCheck className="w-8 h-8 text-[#0D6EFD]" />
          </div>

          <h1
            className="text-[28px] font-[800] text-[#111C3D] tracking-[-0.03em] leading-[1.1] mb-4 max-w-[320px]"
            data-testid="text-email-confirm-title"
          >
            {t("auth.signup.confirmTitle")}
          </h1>

          <p
            className="text-[16px] leading-relaxed text-[#1F2937] mb-3 max-w-[340px]"
            data-testid="text-email-confirm-description"
          >
            {t("auth.signup.confirmText")}
          </p>

          <p
            className="text-[16px] font-semibold text-[#111C3D] mb-8"
            data-testid="text-email-confirm-address"
          >
            {email}
          </p>

          <p className="text-[15px] text-[#1F2937] mb-10 max-w-[340px] leading-relaxed">
            {t("auth.signup.confirmInstructions")}
          </p>

          <button
            onClick={() => navigate("/login")}
            className="w-full max-w-[320px] min-h-[56px] rounded-full bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white font-bold text-[16px] transition-colors shadow-[0_2px_12px_rgba(0,0,0,0.25)]"
            data-testid="button-go-login-after-confirm"
          >
            {t("auth.signup.toLogin")}
          </button>

          <p className="text-[13px] text-[#1F2937] mt-6 max-w-[300px]">
            {t("auth.signup.noEmail")}
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="w-full bg-white sticky top-0 z-20 border-b border-[#E5E7EB]">
        <div className="max-w-xl mx-auto px-6 h-[60px] flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-12 h-12 rounded-full bg-[#F3F4F6] shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center justify-center active:scale-95 transition-colors"
            data-testid="button-back-signup"
          >
            <ChevronLeft className="w-5 h-5 text-[#1F2937]" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#0D6EFD] flex items-center justify-center">
              <Home className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-[#111C3D] text-base">HousAlert</span>
          </div>
        </div>
      </header>

      <ProgressDots current={4} />

      <main className="flex-1 max-w-xl mx-auto w-full px-6 pb-8 pt-2">
        <h1
          className="text-[28px] font-[800] text-[#111C3D] leading-[1.1] tracking-[-0.03em] mb-2"
          data-testid="text-signup-title"
        >
          {t("auth.signup.funnelTitle")}
        </h1>
        <p className="text-[15px] text-[#6B7280] mb-6">
          {t("auth.signup.funnelSubtitle")}
        </p>

        <form onSubmit={handleSignup} className="space-y-5">
          <div className="space-y-2">
            <Label className="text-[14px] font-semibold text-[#111C3D]">{t("auth.signup.name")}</Label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#6B7280]" />
              <input
                type="text"
                placeholder={t("auth.signup.namePlaceholder")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-[60px] pl-11 pr-4 rounded-[20px] border-0 bg-[#F3F4F6] text-[15px] font-medium text-[#1F2937] placeholder:text-[#9CA3AF] placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/15 focus:bg-[#F5F7FA] transition-all"
                data-testid="input-signup-name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[14px] font-semibold text-[#111C3D]">{t("auth.signup.email")}</Label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#6B7280]" />
              <input
                type="email"
                placeholder={t("auth.signup.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full h-[60px] pl-11 pr-4 rounded-[20px] border-0 bg-[#F3F4F6] text-[15px] font-medium text-[#1F2937] placeholder:text-[#9CA3AF] placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/15 focus:bg-[#F5F7FA] transition-all"
                data-testid="input-signup-email"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[14px] font-semibold text-[#111C3D]">{t("auth.signup.password")}</Label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#6B7280]" />
              <input
                type="password"
                placeholder={t("auth.signup.passwordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full h-[60px] pl-11 pr-4 rounded-[20px] border-0 bg-[#F3F4F6] text-[15px] font-medium text-[#1F2937] placeholder:text-[#9CA3AF] placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/15 focus:bg-[#F5F7FA] transition-all"
                data-testid="input-signup-password"
              />
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full h-[56px] rounded-full text-[16px] font-bold shadow-none bg-[#0D6EFD] hover:bg-[#0B5ED7] mt-2"
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

        <p className="text-center text-[15px] text-[#6B7280] mt-6">
          {t("auth.signup.hasAccount")}{" "}
          <button
            onClick={() => navigate("/login")}
            className="text-[#0D6EFD] font-semibold hover:underline"
            data-testid="link-login"
          >
            {t("auth.signup.loginLink")}
          </button>
        </p>

        <p className="text-center text-[13px] text-[#9CA3AF] mt-4">
          {t("auth.signup.footer")}
        </p>
      </main>
    </div>
  );
}
