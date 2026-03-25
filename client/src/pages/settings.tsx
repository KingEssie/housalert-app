import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";
import { apiFetch } from "@/lib/api-base";
import {
  ArrowLeft,
  User,
  Globe,
  Shield,
  HelpCircle,
  FileText,
  LogOut,
  Trash2,
  ChevronRight,
  Check,
} from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t, locale, setLocale } = useTranslation();

  const [signingOut, setSigningOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showLangSheet, setShowLangSheet] = useState(false);

  const currentLangLabel = locale === "de" ? "Deutsch" : locale === "en" ? "English" : "Nederlands";

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      navigate("/welcome");
    } catch {
      setSigningOut(false);
    }
  };

  const handleLanguageChange = (lang: string) => {
    setLocale(lang as "de" | "en" | "nl");
    setShowLangSheet(false);
    if (user) {
      apiFetch("/api/profile-data", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: lang }),
      }).catch(() => {});
    }
  };

  return (
    <div className="min-h-screen bg-ha-bg">
      <div className="sticky top-0 z-10 bg-ha-bg border-b border-ha-card-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate("/dashboard")}
          className="w-9 h-9 rounded-[6px] flex items-center justify-center active:bg-ha-surface transition-colors"
          data-testid="button-settings-back"
        >
          <ArrowLeft className="w-5 h-5 text-ha-text" />
        </button>
        <h1 className="text-[18px] font-semibold text-ha-text" data-testid="text-settings-title">
          {t("settings.title")}
        </h1>
      </div>

      <div className="max-w-[480px] mx-auto px-4 py-5 pb-8">
        <div className="flex flex-col gap-3">

          <div className="rounded-[6px] bg-ha-card px-5 py-1">
            <button
              onClick={() => navigate("/profile/details")}
              className="w-full flex items-center gap-3 py-3.5 text-left active:opacity-80 transition-opacity"
              data-testid="button-personal-info"
            >
              <User className="w-5 h-5 text-ha-text-secondary flex-shrink-0" />
              <p className="text-[15px] text-ha-text flex-1">{t("profile.personalInfo")}</p>
              <ChevronRight className="w-4 h-4 text-ha-text-muted flex-shrink-0" />
            </button>
            <div className="h-px bg-ha-surface" />
            <button
              onClick={() => setShowLangSheet(true)}
              className="w-full flex items-center gap-3 py-3.5 text-left active:opacity-80 transition-opacity"
              data-testid="button-language"
            >
              <Globe className="w-5 h-5 text-ha-text-secondary flex-shrink-0" />
              <p className="text-[15px] text-ha-text flex-1">{t("profile.language")}</p>
              <span className="text-[13px] text-ha-text-secondary mr-1">{currentLangLabel}</span>
              <ChevronRight className="w-4 h-4 text-ha-text-muted flex-shrink-0" />
            </button>
          </div>

          <div className="rounded-[6px] bg-ha-card px-5 py-1">
            <button
              onClick={() => navigate("/datenschutz")}
              className="w-full flex items-center gap-3 py-3.5 text-left active:opacity-80 transition-opacity"
              data-testid="button-privacy"
            >
              <Shield className="w-5 h-5 text-ha-text-secondary flex-shrink-0" />
              <p className="text-[15px] text-ha-text flex-1">{t("profile.privacy")}</p>
              <ChevronRight className="w-4 h-4 text-ha-text-muted flex-shrink-0" />
            </button>
            <div className="h-px bg-ha-surface" />
            <button
              onClick={() => { window.location.href = "mailto:support@housalert.com"; }}
              className="w-full flex items-center gap-3 py-3.5 text-left active:opacity-80 transition-opacity"
              data-testid="button-help-support"
            >
              <HelpCircle className="w-5 h-5 text-ha-text-secondary flex-shrink-0" />
              <p className="text-[15px] text-ha-text flex-1">{t("profile.helpSupport")}</p>
              <ChevronRight className="w-4 h-4 text-ha-text-muted flex-shrink-0" />
            </button>
            <div className="h-px bg-ha-surface" />
            <button
              onClick={() => navigate("/terms")}
              className="w-full flex items-center gap-3 py-3.5 text-left active:opacity-80 transition-opacity"
              data-testid="button-terms"
            >
              <FileText className="w-5 h-5 text-ha-text-secondary flex-shrink-0" />
              <p className="text-[15px] text-ha-text flex-1">{t("profile.terms")}</p>
              <ChevronRight className="w-4 h-4 text-ha-text-muted flex-shrink-0" />
            </button>
          </div>

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
      </div>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowLogoutConfirm(false)}>
          <div className="bg-ha-card w-full max-w-[400px] rounded-t-[6px] sm:rounded-[6px] px-6 pt-8 pb-6 animate-in slide-in-from-bottom-4 duration-200" onClick={e => e.stopPropagation()}>
            <p className="text-[17px] font-semibold text-ha-text text-center">{t("profile.logoutConfirm")}</p>
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

      {showLangSheet && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowLangSheet(false)}>
          <div className="bg-ha-card w-full max-w-[400px] rounded-t-[6px] sm:rounded-[6px] px-6 pt-8 pb-6 animate-in slide-in-from-bottom-4 duration-200" onClick={e => e.stopPropagation()}>
            <p className="text-[17px] font-semibold text-ha-text text-center mb-4">{t("profile.language")}</p>
            {[
              { code: "de", label: "Deutsch" },
              { code: "en", label: "English" },
              { code: "nl", label: "Nederlands" },
            ].map(lang => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`w-full flex items-center justify-between py-3.5 px-2 rounded-[6px] text-left active:bg-ha-surface transition-colors ${locale === lang.code ? "bg-ha-primary-light" : ""}`}
                data-testid={`button-lang-${lang.code}`}
              >
                <span className="text-[15px] text-ha-text">{lang.label}</span>
                {locale === lang.code && <Check className="w-5 h-5 text-ha-primary" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
