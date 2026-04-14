import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";
import {
  ChevronRight,
  ExternalLink,
  LogOut,
  Trash2,
  User,
} from "lucide-react";
import { AppHeader } from "@/components/ui/app-header";

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
      window.location.replace("/");
    } catch {
      setSigningOut(false);
    }
  };

  const displayName = user?.user_metadata?.first_name
    ? `${user.user_metadata.first_name}${user.user_metadata.last_name ? ` ${user.user_metadata.last_name}` : ""}`
    : user?.email?.split("@")[0] || "";

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
    <div className="min-h-screen" style={{ backgroundColor: "#edf2f7" }}>
      <AppHeader title={t("settings.title")} onBack={() => navigate("/dashboard?tab=profiel")} />

      <div className="max-w-[480px] mx-auto px-4 py-5 pb-8">
        <div className="flex flex-col gap-4">
          <div className="app-card flex items-center gap-4" data-testid="card-profile-header">
            <div className="w-14 h-14 rounded-full bg-[#F5F0EB] flex items-center justify-center flex-shrink-0">
              <User className="w-[22px] h-[22px] text-[#111111]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[16px] font-semibold text-[#111111] truncate" data-testid="text-profile-name">
                {displayName}
              </p>
              <p className="text-[15px] text-ha-text-secondary truncate" data-testid="text-profile-email">
                {user?.email}
              </p>
            </div>
          </div>

          {sections.map((section, si) => (
            <div key={si}>
              <p className="text-row-section-title px-1 mb-2" data-testid={`text-section-${si}`}>
                {section.title}
              </p>
              <div className="app-card !p-0">
                {section.rows.map((row, ri) => (
                  <div key={ri}>
                    {ri > 0 && <div className="h-px bg-ha-divider mx-5" />}
                    <button
                      onClick={() => {
                        if (row.external) {
                          window.location.href = row.route;
                        } else {
                          navigate(row.route);
                        }
                      }}
                      className="w-full flex items-center gap-3 py-4 px-5 text-left active:bg-ha-surface-active transition-colors"
                      data-testid={`button-settings-${si}-${ri}`}
                    >
                      <p className="text-[15px] font-semibold text-[#111111] flex-1">{row.label}</p>
                      {row.external ? (
                        <ExternalLink className="w-4 h-4 text-[#334855] flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-[#334855] flex-shrink-0" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="app-card !p-0">
            <button
              onClick={() => setShowLogoutConfirm(true)}
              disabled={signingOut}
              className={`w-full flex items-center gap-3 py-4 px-5 text-left active:bg-ha-surface-active transition-colors ${signingOut ? "opacity-60 pointer-events-none" : ""}`}
              data-testid="button-logout"
            >
              <LogOut className="w-5 h-5 text-ha-status-red flex-shrink-0" />
              <p className="text-[15px] font-semibold text-ha-status-red flex-1">{signingOut ? t("profile.signingOut") : t("profile.logout")}</p>
            </button>
            <div className="h-px bg-ha-divider mx-5" />
            <button
              onClick={() => navigate("/account/delete")}
              className="w-full flex items-center gap-3 py-4 px-5 text-left active:bg-ha-surface-active transition-colors"
              data-testid="button-delete-account"
            >
              <Trash2 className="w-5 h-5 text-[#334855] flex-shrink-0" />
              <p className="text-[15px] text-ha-text-muted flex-1">{t("profile.deleteAccount")}</p>
            </button>
          </div>

          <div className="flex flex-col items-center gap-1 pt-4 pb-2">
            <p className="text-[14px] font-semibold text-[#111111]">HousAlert</p>
            <p className="text-[12px] text-ha-icon-secondary">v1.0.0</p>
          </div>
        </div>
      </div>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowLogoutConfirm(false)}>
          <div className="bg-white w-full max-w-[400px] rounded-t-[--ha-card-radius] sm:rounded-[--ha-card-radius] px-6 pt-8 pb-6 animate-in slide-in-from-bottom-4 duration-200" onClick={e => e.stopPropagation()}>
            <p className="text-[17px] font-semibold text-[#111111] text-center">{t("profile.logoutConfirm")}</p>
            <p className="text-[15px] text-ha-text-secondary text-center mt-2 mb-6">{t("profile.logoutDesc")}</p>
            <button
              onClick={handleLogout}
              className="w-full ha-btn bg-ha-status-red text-white font-semibold mb-3"
              data-testid="button-logout-confirm"
            >
              {t("profile.logoutYes")}
            </button>
            <button
              onClick={() => setShowLogoutConfirm(false)}
              className="w-full ha-btn text-[#111111] font-medium active:bg-ha-surface-hover"
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
