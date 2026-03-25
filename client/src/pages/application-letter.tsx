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
    <div className="min-h-screen bg-ha-bg flex flex-col">
      <PageHeader title={t("applicationLetter.title")} onBack={() => navigate("/settings")} />

      <main className="flex-1 max-w-[480px] mx-auto w-full px-4 py-5 pb-32">
        <div className="flex flex-col gap-5">
          <div className="rounded-[6px] bg-ha-card px-5 py-5">
            <p className="text-[14px] text-ha-text-secondary leading-relaxed">
              {t("applicationLetter.helperText")}
            </p>
          </div>

          {isLoading ? (
            <div className="rounded-[6px] bg-ha-card p-6 animate-pulse">
              <div className="h-[300px] bg-ha-surface rounded-[6px]" />
            </div>
          ) : (
            <div className="rounded-[6px] bg-ha-card px-5 py-5">
              <div className="flex items-center justify-between mb-3">
                <label className="text-[13px] font-semibold text-ha-text">{t("applicationLetter.letterLabel")}</label>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1 text-[13px] text-ha-text-secondary active:text-ha-text transition-colors"
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
                className="w-full min-h-[340px] px-4 py-4 rounded-[6px] border border-ha-card-border bg-ha-bg text-[15px] text-ha-text placeholder:text-ha-text-muted focus:outline-none focus:border-ha-primary focus:shadow-[0_0_0_3px_rgba(233,30,99,0.08)] resize-y leading-relaxed transition-all"
                data-testid="input-template"
              />
              {!isLongEnough && template.length > 0 && (
                <p className="text-[12px] text-ha-text-secondary mt-2">{t("applicationLetter.minChars")}</p>
              )}
            </div>
          )}

          <button
            onClick={() => saveMutation.mutate(template)}
            disabled={!isLongEnough || saveMutation.isPending}
            className="w-full h-[52px] rounded-[6px] bg-ha-primary text-white text-[16px] font-semibold transition-colors hover:bg-ha-primary-hover active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
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
