import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { User, Mail, Lock, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { createSearchProfile } from "@/lib/search-profiles";
import { useTranslation } from "@/i18n";
import { apiFetch } from "@/lib/api-base";
import { useEmbedded } from "@/hooks/use-embedded";
import { useHashSearch } from "@/lib/hash-search";

const INPUT_CLS = "w-full h-[44px] pl-11 pr-4 rounded-xl border border-transparent bg-[#F3F4F6] text-[15px] font-medium text-[#1F2937] placeholder:text-[#9CA3AF] placeholder:font-normal focus:bg-white";

export default function EmbedSuccessPage() {
  const [, navigate] = useLocation();
  const { containerClass } = useEmbedded();
  const { toast } = useToast();
  const { t } = useTranslation();
  const searchString = useHashSearch();
  const params = new URLSearchParams(searchString);
  const sessionId = params.get("session_id") || "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const submittingRef = useRef(false);

  async function saveFunnelSearchProfile(userId: string) {
    try {
      const raw = localStorage.getItem("housalert_embed_funnel");
      if (!raw) return;
      const funnel = JSON.parse(raw);

      await createSearchProfile({
        user_id: userId,
        city_name: funnel.city || "",
        country_code: "DE",
        latitude: funnel.lat ? parseFloat(funnel.lat) : undefined,
        longitude: funnel.lng ? parseFloat(funnel.lng) : undefined,
        price_min: parseInt(funnel.minPrice || "0") || 0,
        price_max: parseInt(funnel.maxPrice || "0") || 0,
        bedrooms_min: parseInt(funnel.minRooms || "0") || 0,
        size_min: parseInt(funnel.minSize || "0") || 0,
        location_mode: funnel.locationMode || undefined,
        districts: funnel.districts ? funnel.districts.split(",").filter(Boolean) : undefined,
        radius_km: funnel.radiusKm ? parseInt(funnel.radiusKm) : undefined,
        commute_destination: funnel.commuteAddress || undefined,
        commute_mode: funnel.commuteMode || undefined,
        commute_minutes: funnel.commuteTime ? parseInt(funnel.commuteTime) : undefined,
      });

      localStorage.removeItem("housalert_embed_funnel");
    } catch (err) {
      console.error("[embed-success] Failed to create search profile:", err);
    }
  }

  async function linkStripeSession(token: string) {
    if (!sessionId) return;
    try {
      await apiFetch("/api/checkout/link-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ session_id: sessionId }),
      });
    } catch (err) {
      console.error("[embed-success] Failed to link session:", err);
    }
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
      const token = sessionData?.session?.access_token;

      if (token) {
        await linkStripeSession(token);
      }

      if (userId) {
        await saveFunnelSearchProfile(userId);
      }

      setDone(true);
      setTimeout(() => navigate("/dashboard"), 2000);
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-5">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-[#E8FFF5] flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-8 h-8 text-[#0D6EFD]" />
          </div>
          <h1 className="text-[22px] font-medium text-[#111C3D] mb-2" data-testid="text-embed-success-title">
            {t("subscription.activated")}
          </h1>
          <p className="text-[15px] text-[#1F2937] opacity-70" data-testid="text-embed-success-redirect">
            {t("subscription.redirecting")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className={`flex-1 ${containerClass} mx-auto w-full px-5 pb-8 pt-6`}>
        <div className="w-16 h-16 rounded-full bg-[#E8FFF5] flex items-center justify-center mx-auto mb-5">
          <CheckCircle className="w-8 h-8 text-[#16A34A]" />
        </div>

        <h1
          className="text-[22px] font-medium text-[#111C3D] leading-[1.15] tracking-[-0.02em] mb-1 text-center"
          data-testid="text-embed-signup-title"
        >
          {t("embedSuccess.title")}
        </h1>
        <p className="text-[14px] text-[#6B7280] mb-6 text-center">
          {t("embedSuccess.subtitle")}
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
                data-testid="input-embed-signup-name"
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
                data-testid="input-embed-signup-email"
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
                data-testid="input-embed-signup-password"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-[48px] rounded-full text-[15px] font-medium shadow-none bg-[#0D6EFD] hover:bg-[#0B5ED7] mt-1"
              disabled={loading || !email || !password}
              data-testid="button-embed-signup-submit"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t("auth.signup.submitAlt")}
                </span>
              ) : (
                t("embedSuccess.createAccount")
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-[12px] text-[#9CA3AF] mt-4">
          {t("auth.signup.footer")}
        </p>
      </main>
    </div>
  );
}
