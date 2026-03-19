import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiFetch } from "@/lib/api-base";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";
import { CheckCircle2, Circle, FileText } from "lucide-react";

const DOCUMENT_ITEMS = [
  "id_copy",
  "income_proof",
  "schufa",
  "rental_history",
  "bank_statements",
  "employment_proof",
] as const;

type DocKey = (typeof DOCUMENT_ITEMS)[number];

export default function DocumentsPage() {
  const { session } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const accessToken = session?.access_token;

  const { data: profileData } = useQuery<{ document_checklist?: Record<string, boolean> | null }>({
    queryKey: ["/api/profile-data"],
    queryFn: async () => {
      const res = await apiFetch("/api/profile-data", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return { document_checklist: null };
      return res.json();
    },
    enabled: !!accessToken,
  });

  const serverChecklist = profileData?.document_checklist ?? {};
  const [localChecklist, setLocalChecklist] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (serverChecklist) {
      setLocalChecklist(serverChecklist);
    }
  }, [JSON.stringify(serverChecklist)]);

  const checkedCount = DOCUMENT_ITEMS.filter((k) => localChecklist[k]).length;
  const allDone = checkedCount === DOCUMENT_ITEMS.length;

  async function toggleItem(key: DocKey) {
    const updated = { ...localChecklist, [key]: !localChecklist[key] };
    setLocalChecklist(updated);
    setSaving(true);
    try {
      await apiFetch("/api/profile-data", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ document_checklist: updated }),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/profile-data"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile-strength"] });
    } catch {
      toast({ title: t("documents.saveFailed"), variant: "destructive" });
      setLocalChecklist(localChecklist);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA]" data-testid="page-documents">
      <PageHeader title={t("documents.title")} />

      <div className="max-w-xl mx-auto p-4 space-y-4 pb-8">
        <div className="bg-white rounded-[24px] border border-[#F0F0F0] shadow-[0_2px_8px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)] p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-[#EBF2FF] flex items-center justify-center">
              <FileText className="w-5 h-5 text-[#0D6EFD]" />
            </div>
            <div>
              <p className="text-[15px] font-bold text-[#1F2937]">{t("documents.heading")}</p>
              <p className="text-[12px] text-[#6B7280]">
                {checkedCount}/{DOCUMENT_ITEMS.length} {t("documents.collected")}
              </p>
            </div>
          </div>

          {allDone && (
            <div className="bg-[#0F172A] rounded-xl p-4 mb-4" data-testid="documents-complete-banner">
              <p className="text-[14px] font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                {t("documents.completeTitle")}
              </p>
              <p className="text-[13px] text-white/80 mt-1">{t("documents.completeDesc")}</p>
            </div>
          )}

          <div className="flex flex-col gap-1">
            {DOCUMENT_ITEMS.map((key) => {
              const checked = !!localChecklist[key];
              return (
                <button
                  key={key}
                  onClick={() => toggleItem(key)}
                  disabled={saving}
                  className="flex items-center gap-3 py-3.5 px-2 rounded-xl text-left transition-colors hover:bg-[#F9FAFB] active:bg-[#F3F4F6]"
                  data-testid={`doc-${key}`}
                >
                  {checked ? (
                    <CheckCircle2 className="w-5 h-5 text-[#0D6EFD] flex-shrink-0" />
                  ) : (
                    <Circle className="w-5 h-5 text-[#D1D5DB] flex-shrink-0" />
                  )}
                  <span className={`text-[14px] font-medium flex-1 ${checked ? "text-[#9CA3AF] line-through" : "text-[#1F2937]"}`}>
                    {t(`documents.items.${key}`)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-[24px] border border-[#F0F0F0] bg-[#F9FAFB] shadow-[0_2px_8px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)] p-5">
          <p className="text-[13px] text-[#6B7280] leading-relaxed">
            {t("documents.tip")}
          </p>
        </div>
      </div>
    </div>
  );
}
