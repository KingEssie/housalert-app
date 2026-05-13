import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { HousAlertLogo } from "@/components/housalert-logo";
import { Zap, Layers, MousePointerClick, Gift, Loader2, ArrowRight } from "lucide-react";
import { apiFetch } from "@/lib/api-base";
import { useTranslation } from "@/i18n";

const HA_PRIMARY = "rgb(var(--ha-primary))";

interface ReferralInfo {
  firstName: string;
  code: string;
}

export default function ReferralLandingPage() {
  const [, navigate] = useLocation();
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { t } = useTranslation();

  const urlParams = new URLSearchParams(window.location.search);
  const refCode = urlParams.get("ref") || "";

  useEffect(() => {
    if (!refCode) {
      setLoading(false);
      setError(true);
      return;
    }

    apiFetch(`/api/referral/info/${encodeURIComponent(refCode)}`)
      .then((res) => {
        if (!res.ok) throw new Error("invalid");
        return res.json();
      })
      .then((data) => {
        if (data.valid) {
          localStorage.setItem("ha_referral_code", data.code);
          setInfo({ firstName: data.firstName, code: data.code });
        } else {
          setError(true);
        }
      })
      .catch(() => {
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [refCode]);

  function handleStart() {
    navigate("/onboarding/location?source=website");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-ha-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: HA_PRIMARY }} />
      </div>
    );
  }

  if (error) {
    window.location.href = window.location.origin;
    return null;
  }

  const benefits = [
    { icon: Zap, text: t("referralLanding.benefit1") },
    { icon: Layers, text: t("referralLanding.benefit2") },
    { icon: MousePointerClick, text: t("referralLanding.benefit3") },
  ];

  return (
    <div className="min-h-screen bg-ha-bg flex flex-col" data-testid="page-referral-landing">
      <header className="px-5 pt-6 pb-2 flex items-center justify-center">
        <HousAlertLogo size="md" />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 max-w-[440px] mx-auto w-full">
        <div className="text-center mb-8">
          <h1
            className="text-[30px] font-semibold leading-[1.2] text-ha-text"
            data-testid="text-referral-title"
          >
            {t("referralLanding.title")}
          </h1>

          {info?.firstName && (
            <p
              className="text-[16px] text-ha-text-secondary mt-3"
              data-testid="text-referral-inviter"
            >
              {t("referralLanding.invitedBy", { name: info.firstName })}
            </p>
          )}
        </div>

        <div
          className="w-full rounded-[12px] p-5 mb-6"
          style={{ background: "linear-gradient(135deg, rgba(133,251,140,0.08) 0%, rgba(133,251,140,0.03) 100%)" }}
          data-testid="card-referral-reward"
        >
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(133,251,140,0.15)" }}
            >
              <Gift className="w-5 h-5" style={{ color: HA_PRIMARY }} />
            </div>
            <div>
              <p className="text-[16px] font-semibold text-ha-text">
                {t("referralLanding.discountTitle")}
              </p>
              <p className="text-[13px] text-ha-text-secondary mt-0.5">
                {t("referralLanding.discountSubtitle")}
              </p>
            </div>
          </div>
        </div>

        <div className="w-full space-y-3 mb-8">
          {benefits.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3" data-testid={`benefit-${text.substring(0, 10)}`}>
              <div className="w-9 h-9 rounded-full bg-ha-hover-bg flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-ha-text" />
              </div>
              <span className="text-[15px] text-ha-text font-medium">{text}</span>
            </div>
          ))}
        </div>

        <button
          onClick={handleStart}
          className="w-full h-[52px] rounded-[10px] text-white text-[16px] font-semibold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
          style={{
            background: "linear-gradient(135deg, rgb(var(--ha-primary)) 0%, rgb(var(--ha-primary-hover)) 100%)",
            boxShadow: "0 4px 15px rgba(133,251,140,0.30)",
          }}
          data-testid="button-start-referral"
        >
          {t("referralLanding.cta")}
          <ArrowRight className="w-5 h-5" />
        </button>

        <p className="text-[12px] text-ha-text-secondary text-center mt-4">
          {t("referralLanding.noCard")}
        </p>
      </main>

      <footer className="px-6 py-6 text-center">
        <p className="text-[11px] text-ha-text-secondary">
          © {new Date().getFullYear()} HousAlert · {t("referralLanding.copyright")}
        </p>
      </footer>
    </div>
  );
}
