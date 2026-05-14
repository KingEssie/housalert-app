import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useState } from "react";
import { logoSrc } from "@/components/housalert-logo";
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
        { label: t("settings.termsConditions"), route: "https://www.housalert.com/terms-of-service", external: true },
        { label: t("settings.privacyPolicy"), route: "https://www.housalert.com/privacy", external: true },
      ],
    },
  ];

  const logoutIcon = (
    <button
      onClick={() => setShowLogoutConfirm(true)}
      className="w-10 h-10 flex items-center justify-center rounded-full hover:opacity-80 transition-opacity"
      style={{ backgroundColor: "#f1eef5" }}
      aria-label={t("profile.logout")}
      data-testid="button-logout-icon"
    >
      <LogOut className="w-[20px] h-[20px] text-[#111111]" strokeWidth={2} />
    </button>
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f9f7f8" }}>
      <AppHeader
        title={t("settings.title")}
        onBack={() => { if (window.history.length > 1) window.history.back(); else navigate("/dashboard?tab=profile"); }}
        trailing={logoutIcon}
      />

      <div className="max-w-[480px] mx-auto px-4 py-5 pb-8">
        <div className="flex flex-col gap-4">

          {/* Profile header card */}
          <div
            className="flex items-center gap-4 bg-white rounded-[28px] p-5"
            style={{ border: "1px solid #ece7ef", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
            data-testid="card-profile-header"
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "#b9a7ff" }}
            >
              <User className="w-[22px] h-[22px] text-[#111111]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[16px] font-bold text-[#111111] truncate" data-testid="text-profile-name">
                {displayName}
              </p>
              <p className="text-[14px] truncate mt-0.5" style={{ color: "#444444" }} data-testid="text-profile-email">
                {user?.email}
              </p>
            </div>
          </div>

          {sections.map((section, si) => (
            <div key={si}>
              <p
                className="text-[12px] font-semibold px-1 mb-2 uppercase tracking-wider"
                style={{ color: "#8f8798" }}
                data-testid={`text-section-${si}`}
              >
                {section.title}
              </p>
              <div
                className="bg-white rounded-[28px] overflow-hidden"
                style={{ border: "1px solid #ece7ef", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
              >
                {section.rows.map((row, ri) => (
                  <div key={ri}>
                    {ri > 0 && <div className="h-px mx-5" style={{ backgroundColor: "#ece7ef" }} />}
                    <button
                      onClick={() => {
                        if (row.external) {
                          window.location.href = row.route;
                        } else {
                          navigate(row.route);
                        }
                      }}
                      className="w-full flex items-center gap-3 py-[15px] px-5 text-left transition-colors"
                      style={{ WebkitTapHighlightColor: "transparent" }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#f5f1fb")}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = "")}
                      data-testid={`button-settings-${si}-${ri}`}
                    >
                      <p className="text-[15px] font-bold text-[#111111] flex-1">{row.label}</p>
                      {row.external ? (
                        <ExternalLink className="w-4 h-4 flex-shrink-0" style={{ color: "#6b6677" }} />
                      ) : (
                        <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "#6b6677" }} />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Delete account row */}
          <div
            className="bg-white rounded-[28px] overflow-hidden"
            style={{ border: "1px solid #ece7ef", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
          >
            <button
              onClick={() => navigate("/account/delete")}
              className="w-full flex items-center gap-3 py-[15px] px-5 text-left transition-colors active:bg-[#fff0f0]"
              data-testid="button-delete-account"
            >
              <Trash2 className="w-5 h-5 text-ha-danger flex-shrink-0" />
              <p className="text-[15px] text-ha-danger flex-1">{t("profile.deleteAccount")}</p>
            </button>
          </div>

          <div className="flex flex-col items-center gap-2 pt-4 pb-2">
            <img
              src={logoSrc}
              alt="HousAlert"
              className="object-contain block"
              style={{ height: 22, width: "auto", filter: "brightness(0)" }}
            />
            <p className="text-[12px]" style={{ color: "#8f8798" }}>v1.0.0</p>
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
