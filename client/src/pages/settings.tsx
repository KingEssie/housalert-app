import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "@/i18n";
import {
  ChevronRight,
  ExternalLink,
  LogOut,
  Trash2,
  User,
} from "lucide-react";
import { AppHeader } from "@/components/ui/app-header";
import { LogoutBottomSheet } from "@/components/ui/logout-bottom-sheet";

export default function SettingsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
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
        { label: t("settings.zoekbuddy"), route: "/profile/search-buddy", external: false },
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

  const logoutIcon = (
    <button
      onClick={() => setShowLogoutConfirm(true)}
      className="w-10 h-10 flex items-center justify-center rounded-full bg-[#E5E7EB] active:bg-[#D1D5DB] transition-colors"
      aria-label="Uitloggen"
      data-testid="button-logout-icon"
    >
      <LogOut className="w-[20px] h-[20px] text-[#111111]" strokeWidth={2} />
    </button>
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#eaeaeb" }}>
      <AppHeader
        title={t("settings.title")}
        onBack={() => navigate("/dashboard?tab=profiel")}
        trailing={logoutIcon}
      />

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
                      className="w-full flex items-center gap-3 py-[13px] px-5 text-left active:bg-ha-surface-active transition-colors"
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
              onClick={() => navigate("/account/delete")}
              className="w-full flex items-center gap-3 py-[13px] px-5 text-left active:bg-ha-surface-active transition-colors"
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

      <LogoutBottomSheet
        open={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        loading={signingOut}
      />
    </div>
  );
}
