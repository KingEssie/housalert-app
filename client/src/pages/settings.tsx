import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";
import {
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  LogOut,
  Trash2,
} from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [signingOut, setSigningOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      navigate("/");
    } catch {
      setSigningOut(false);
    }
  };

  const sections = [
    {
      title: t("settings.sectionAccount"),
      rows: [
        { label: t("settings.preferences"), route: "/settings/preferences", external: false },
        { label: t("settings.password"), route: "/account/change-password", external: false },
        { label: t("settings.subscription"), route: "/account/subscription", external: false },
      ],
    },
    {
      title: t("settings.sectionPersonal"),
      rows: [
        { label: t("settings.myDetails"), route: "/profile/details", external: false },
        { label: t("settings.housingSituation"), route: "/settings/housing", external: false },
      ],
    },
    {
      title: t("settings.sectionSearchReact"),
      rows: [
        { label: t("settings.zoekbuddy"), route: "/profile/edit/search_buddy_email", external: false },
        { label: t("settings.reactionLetter"), route: "/application-letter", external: false },
      ],
    },
    {
      title: t("settings.sectionHelp"),
      rows: [
        { label: t("settings.faq"), route: "mailto:support@housalert.com", external: true },
        { label: t("settings.contactUs"), route: "mailto:support@housalert.com", external: true },
      ],
    },
    {
      title: t("settings.sectionLegal"),
      rows: [
        { label: t("settings.termsConditions"), route: "/terms", external: false },
        { label: t("settings.privacyPolicy"), route: "/datenschutz", external: false },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-ha-bg">
      <div className="sticky top-0 z-10 bg-ha-bg border-b border-ha-card-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate("/dashboard?tab=profiel")}
          className="w-9 h-9 rounded-[6px] flex items-center justify-center active:bg-ha-surface transition-colors"
          data-testid="button-settings-back"
        >
          <ArrowLeft className="w-5 h-5 text-ha-text" />
        </button>
        <h1 className="text-[18px] text-title text-ha-text flex-1" data-testid="text-settings-title">
          {t("settings.title")}
        </h1>
      </div>

      <div className="max-w-[480px] mx-auto px-4 py-5 pb-8">
        <div className="flex flex-col gap-5">
          {sections.map((section, si) => (
            <div key={si}>
              <p className="text-[12px] font-semibold text-ha-text-secondary uppercase tracking-wider px-1 mb-2" data-testid={`text-section-${si}`}>
                {section.title}
              </p>
              <div className="rounded-[6px] bg-ha-card px-5 py-1">
                {section.rows.map((row, ri) => (
                  <div key={ri}>
                    {ri > 0 && <div className="h-px bg-ha-surface" />}
                    <button
                      onClick={() => {
                        if (row.external) {
                          window.location.href = row.route;
                        } else {
                          navigate(row.route);
                        }
                      }}
                      className="w-full flex items-center gap-3 py-3.5 text-left active:opacity-80 transition-opacity"
                      data-testid={`button-settings-${si}-${ri}`}
                    >
                      <p className="text-[15px] text-ha-text flex-1">{row.label}</p>
                      {row.external ? (
                        <ExternalLink className="w-4 h-4 text-ha-text-muted flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-ha-text-muted flex-shrink-0" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div>
            <div className="rounded-[6px] bg-ha-card px-5 py-1">
              <button
                onClick={() => setShowLogoutConfirm(true)}
                disabled={signingOut}
                className={`w-full flex items-center gap-3 py-3.5 text-left active:opacity-80 transition-opacity ${signingOut ? "opacity-60 pointer-events-none" : ""}`}
                data-testid="button-logout"
              >
                <LogOut className="w-5 h-5 text-ha-danger flex-shrink-0" />
                <p className="text-[15px] text-ha-danger flex-1">{signingOut ? t("profile.signingOut") : t("profile.logout")}</p>
              </button>
              <div className="h-px bg-ha-surface" />
              <button
                onClick={() => navigate("/account/delete")}
                className="w-full flex items-center gap-3 py-3.5 text-left active:opacity-80 transition-opacity"
                data-testid="button-delete-account"
              >
                <Trash2 className="w-5 h-5 text-ha-text-secondary flex-shrink-0" />
                <p className="text-[15px] text-ha-text-secondary flex-1">{t("profile.deleteAccount")}</p>
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center gap-1 pt-4 pb-2">
            <p className="text-[14px] font-semibold text-ha-text">HousAlert</p>
            <p className="text-[12px] text-ha-text-muted">v1.0.0</p>
          </div>
        </div>
      </div>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowLogoutConfirm(false)}>
          <div className="bg-ha-card w-full max-w-[400px] rounded-t-[6px] sm:rounded-[6px] px-6 pt-8 pb-6 animate-in slide-in-from-bottom-4 duration-200" onClick={e => e.stopPropagation()}>
            <p className="text-[17px] text-title text-ha-text text-center">{t("profile.logoutConfirm")}</p>
            <p className="text-[14px] text-ha-text-secondary text-center mt-2 mb-6">{t("profile.logoutDesc")}</p>
            <button
              onClick={handleLogout}
              className="w-full h-[48px] rounded-[6px] bg-ha-danger text-white text-[15px] font-semibold mb-3 active:scale-[0.98] transition-transform"
              data-testid="button-logout-confirm"
            >
              {t("profile.logoutYes")}
            </button>
            <button
              onClick={() => setShowLogoutConfirm(false)}
              className="w-full h-[48px] rounded-[6px] text-ha-text text-[15px] font-medium active:bg-ha-surface transition-colors"
              data-testid="button-logout-cancel"
            >
              {t("profileDetails.cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
