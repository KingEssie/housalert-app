import { useState, useEffect } from "react";
import { useLocation, Redirect } from "wouter";
import { useTranslation } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api-base";
import { HousAlertLogo } from "@/components/housalert-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ArrowRight, ChevronRight, X } from "lucide-react";

const STEPS = [
  { num: 1, titleKey: "onboarding.intro.step1.title", descKey: "onboarding.intro.step1.desc" },
  { num: 2, titleKey: "onboarding.intro.step2.title", descKey: "onboarding.intro.step2.desc" },
  { num: 3, titleKey: "onboarding.intro.step3.title", descKey: "onboarding.intro.step3.desc" },
];

export default function OnboardingIntro() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const { user, session, signOut } = useAuth();
  const [redirectHome, setRedirectHome] = useState(false);

  useEffect(() => {
    if (!user || !session?.access_token) return;
    let cancelled = false;
    apiFetch("/api/onboarding-status", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && (data.onboarding_completed === true || data.post_paywall_onboarding_completed === true)) {
          console.log("[INTRO] User already completed onboarding → redirect /home");
          setRedirectHome(true);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user, session]);

  if (redirectHome) return <Redirect to="/home" />;

  function handleClose() {
    (async () => {
      try { if (user) await signOut(); } catch {}
      window.location.href = "/";
    })();
  }

  return (
    <div className="fixed inset-0 z-50 bg-ha-bg flex flex-col" data-testid="screen-onboarding-intro">
      <div className="bg-white" style={{ paddingTop: "max(0px, env(safe-area-inset-top))" }}>
        <div className="flex items-center justify-between px-5 h-[64px]">
          <HousAlertLogo size={28} />
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <button
              onClick={handleClose}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-ha-surface hover:bg-ha-card-border transition-colors"
              data-testid="button-intro-close"
            >
              <X className="w-[18px] h-[18px] text-ha-text" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 pt-6 pb-8">
          <div className="bg-white rounded-2xl px-6 py-7">
            <h1
              className="text-[24px] font-bold tracking-[-0.025em] leading-[1.15] mb-6 text-ha-text"
              data-testid="text-intro-title"
            >
              {t("onboarding.intro.headline")}
            </h1>

            <div className="flex flex-col gap-5">
              {STEPS.map((step) => (
                <div key={step.num} className="flex items-start gap-3.5" data-testid={`step-${step.num}`}>
                  <div className="w-[28px] h-[28px] rounded-full flex items-center justify-center shrink-0 text-[14px] font-bold mt-[1px] bg-ha-primary/10 text-ha-primary">
                    {step.num}
                  </div>
                  <div>
                    <p className="text-[16px] font-semibold leading-[1.25] text-ha-text">
                      {t(step.titleKey)}
                    </p>
                    <p className="text-[16px] mt-1 leading-[1.45] text-ha-text-secondary">
                      {t(step.descKey)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border-t border-ha-card-border">
        <div className="max-w-lg mx-auto px-5 py-4 pb-[max(16px,env(safe-area-inset-bottom))]">
          <button
            onClick={() => navigate("/onboarding/city")}
            className="w-full h-[48px] rounded-full bg-ha-accent text-white text-[16px] font-semibold hover:bg-ha-accent-hover active:scale-[0.97] transition-all flex items-center justify-center gap-1.5 shadow-[0_2px_10px_rgba(187,173,251,0.35)]"
            data-testid="button-intro-start"
          >
            {t("onboarding.intro.cta")}
            <ArrowRight className="w-4 h-4" />
          </button>
          <div className="flex items-center justify-center gap-1 mt-3">
            <span className="text-[14px] text-ha-text-secondary">
              {t("onboarding.intro.alreadyAccount")}
            </span>
            <button
              onClick={handleClose}
              className="text-[14px] font-semibold text-ha-primary"
              data-testid="link-intro-login"
            >
              {t("onboarding.intro.login")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
