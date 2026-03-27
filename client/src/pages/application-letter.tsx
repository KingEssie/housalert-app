import { apiFetch } from "@/lib/api-base";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useTranslation } from "@/i18n";
import { getDefaultTemplate } from "@/lib/application-letter";
import { RotateCcw, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

interface ProfileData {
  application_template: string | null;
  occupation?: string | null;
  monthly_income?: number | null;
}

export default function ApplicationLetterPage() {
  const [, navigate] = useLocation();
  const { session } = useAuth();
  const { toast } = useToast();
  const { t, locale } = useTranslation();
  const [template, setTemplate] = useState("");
  const [initialized, setInitialized] = useState(false);
  const defaultTemplate = getDefaultTemplate(locale);

  const { data: profileData, isLoading } = useQuery<ProfileData>({
    queryKey: ["/api/profile-data"],
    queryFn: async () => {
      const res = await apiFetch("/api/profile-data", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!session?.access_token,
  });

  useEffect(() => {
    if (profileData && !initialized) {
      setTemplate(profileData.application_template || defaultTemplate);
      setInitialized(true);
    }
  }, [profileData, initialized]);

  useEffect(() => {
    if (initialized && profileData && !profileData.application_template) {
      setTemplate(defaultTemplate);
    }
  }, [locale]);

  const saveMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await apiFetch("/api/profile-data", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ application_template: text }),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile-data"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile-strength"] });
      toast({ title: t("applicationLetter.saved"), description: t("applicationLetter.savedDesc") });
    },
    onError: () => {
      toast({ title: t("common.error"), description: t("applicationLetter.saveFailedDesc"), variant: "destructive" });
    },
  });

  const handleReset = () => {
    setTemplate(defaultTemplate);
    toast({ title: t("applicationLetter.resetDone"), description: t("applicationLetter.resetDoneDesc") });
  };

  const isLongEnough = template.trim().length >= 20;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#F5F5F7" }}>
      <PageHeader title={t("applicationLetter.title")} onBack={() => navigate("/settings")} />

      <main className="flex-1 max-w-[480px] mx-auto w-full px-4 py-5 pb-32">
        <div className="flex flex-col gap-4">
          <div className="app-card">
            <p className="text-[14px] text-[#6B7280] leading-relaxed">
              {t("applicationLetter.helperText")}
            </p>
          </div>

          {isLoading ? (
            <div className="app-card animate-pulse">
              <div className="h-[300px] bg-[#F5F5F7] rounded-[6px]" />
            </div>
          ) : (
            <div className="app-card">
              <div className="flex items-center justify-between mb-3">
                <label className="text-field-label">{t("applicationLetter.letterLabel")}</label>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1 text-[13px] text-[#6B7280] active:text-[#000] transition-colors"
                  data-testid="button-reset-template"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {t("applicationLetter.resetDefault")}
                </button>
              </div>
              <textarea
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                placeholder={t("applicationLetter.placeholderText")}
                className="app-textarea min-h-[300px] leading-relaxed"
                data-testid="input-template"
              />
              {!isLongEnough && template.length > 0 && (
                <p className="text-[12px] text-[#6B7280] mt-2">{t("applicationLetter.minChars")}</p>
              )}
            </div>
          )}

          <button
            onClick={() => saveMutation.mutate(template)}
            disabled={!isLongEnough || saveMutation.isPending}
            className="w-full h-[56px] rounded-[6px] bg-ha-primary text-white text-[15px] font-semibold transition-colors hover:bg-ha-primary-hover active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            data-testid="button-save-template"
          >
            {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {saveMutation.isPending ? t("applicationLetter.saving") : t("applicationLetter.saveLetter")}
          </button>
        </div>
      </main>
    </div>
  );
}
