import { apiFetch } from "@/lib/api-base";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useTranslation } from "@/i18n";
import { getDefaultTemplate, PLACEHOLDERS } from "@/lib/application-letter";
import { RotateCcw } from "lucide-react";
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
    <div className="min-h-screen bg-[#1A1A2E] flex flex-col">
      <PageHeader title={t("applicationLetter.title")} onBack={() => navigate("/dashboard?tab=profiel")} />

      <main className="flex-1 max-w-xl mx-auto w-full px-6 pb-32">
        <div className="flex flex-col gap-6">

          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-[14px] font-medium text-[#9CA3AF]">{t("applicationLetter.placeholders")}</h3>
              <button
                onClick={handleReset}
                className="flex items-center gap-1 text-[13px] text-[#9CA3AF] active:text-white transition-colors"
                data-testid="button-reset-template"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {t("applicationLetter.resetDefault")}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PLACEHOLDERS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => {
                    const textarea = document.querySelector("[data-testid='input-template']") as HTMLTextAreaElement;
                    if (textarea) {
                      const start = textarea.selectionStart;
                      const end = textarea.selectionEnd;
                      const before = template.slice(0, start);
                      const after = template.slice(end);
                      setTemplate(before + p.key + after);
                      setTimeout(() => {
                        textarea.focus();
                        textarea.setSelectionRange(start + p.key.length, start + p.key.length);
                      }, 0);
                    } else {
                      setTemplate(template + p.key);
                    }
                  }}
                  className="text-[11px] font-mono bg-[#252547] text-[#E91E63] px-2.5 py-1.5 rounded-lg active:bg-[#353560] transition-colors border border-[#353560]"
                  title={t(p.labelKey)}
                  data-testid={`placeholder-${p.key.replace(/\[|\]/g, "")}`}
                >
                  {p.key}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="rounded-[20px] bg-[#252547] p-6 animate-pulse">
              <div className="h-[300px] bg-[#353560] rounded-2xl" />
            </div>
          ) : (
            <div>
              <textarea
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                placeholder={t("applicationLetter.placeholderText")}
                className="w-full min-h-[340px] px-5 py-5 rounded-[20px] border border-[#353560] bg-[#252547] text-[15px] text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#E91E63] focus:shadow-[0_0_0_3px_rgba(233,30,99,0.08)] resize-y leading-relaxed transition-all"
                data-testid="input-template"
              />
              {!isLongEnough && template.length > 0 && (
                <p className="text-[12px] text-[#9CA3AF] mt-2 px-1">{t("applicationLetter.minChars")}</p>
              )}
            </div>
          )}
        </div>
      </main>

      <div className="fixed bottom-7 left-0 right-0 z-10 flex justify-center pointer-events-none">
        <button
          onClick={() => saveMutation.mutate(template)}
          disabled={!isLongEnough || saveMutation.isPending}
          className="pointer-events-auto h-[48px] px-8 rounded-full bg-[#E91E63] hover:bg-[#D81B60] text-white text-[15px] font-medium disabled:opacity-40 shadow-[0_4px_16px_rgba(0,0,0,0.16)] active:scale-95 transition-all"
          data-testid="button-save-template"
        >
          {saveMutation.isPending ? t("applicationLetter.saving") : t("applicationLetter.saveLetter")}
        </button>
      </div>
    </div>
  );
}
