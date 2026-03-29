import { apiFetch } from "@/lib/api-base";
import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useTranslation } from "@/i18n";
import { Button } from "@/components/ui/button";
import {
  ClipboardCheck,
  MessageSquare,
  FileCheck,
  Send,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { AppHeader } from "@/components/ui/app-header";

export default function ViewingTipsPage() {
  const [, navigate] = useLocation();
  const { session } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [markedDone, setMarkedDone] = useState(false);

  const SECTIONS = [
    {
      icon: ClipboardCheck,
      title: t("viewingTips.before"),
      items: (t as any)("viewingTips.beforeItems") || [],
    },
    {
      icon: MessageSquare,
      title: t("viewingTips.during"),
      items: (t as any)("viewingTips.duringItems") || [],
    },
    {
      icon: FileCheck,
      title: t("viewingTips.bring"),
      items: (t as any)("viewingTips.bringItems") || [],
    },
    {
      icon: Send,
      title: t("viewingTips.after"),
      items: (t as any)("viewingTips.afterItems") || [],
    },
    {
      icon: AlertTriangle,
      title: t("viewingTips.redFlags"),
      items: (t as any)("viewingTips.redFlagItems") || [],
    },
  ];

  const markDoneMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/profile-data", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ viewing_tips_done: true }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile-data"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile-strength"] });
      setMarkedDone(true);
      toast({ title: t("viewingTips.markedDone"), description: t("viewingTips.markedDoneDesc") });
    },
    onError: () => {
      toast({ title: t("viewingTips.saveFailed"), description: t("viewingTips.saveFailedDesc"), variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen bg-[#EBEBF0] flex flex-col">
      <AppHeader title={t("viewingTips.title")} onBack={() => navigate("/dashboard?tab=tips")} />

      <main className="flex-1 max-w-xl mx-auto w-full px-6 pb-32">
        <div className="mb-6">
          <p className="text-[15px] text-[#6B7280] leading-relaxed">
            {t("viewingTips.intro")}
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {SECTIONS.map((section, idx) => {
            const Icon = section.icon;
            const items = Array.isArray(section.items) ? section.items : [];
            return (
              <div
                key={idx}
                className="bg-white rounded-[6px] border border-[#E5E7EB] overflow-hidden"
                data-testid={`card-tips-section-${idx}`}
              >
                <div className="flex items-center gap-3 p-6 pb-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-ha-primary/10">
                    <Icon className="w-4.5 h-4.5 text-ha-primary" />
                  </div>
                  <h3 className="text-[16px] font-medium text-[#000]">{section.title}</h3>
                </div>
                <div className="px-6 pb-6">
                  <ul className="flex flex-col gap-2.5">
                    {items.map((item: string, i: number) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 bg-ha-primary" />
                        <span className="text-[14px] text-[#4B5563] leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-[#EBEBF0] border-t border-[#E5E5E5] p-5 z-10">
        <div className="max-w-xl mx-auto">
          {markedDone ? (
            <div className="flex items-center justify-center gap-2 h-[56px] text-ha-primary">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-[16px] font-medium">{t("viewingTips.completed")}</span>
            </div>
          ) : (
            <Button
              onClick={() => markDoneMutation.mutate()}
              disabled={markDoneMutation.isPending}
              className="w-full h-[56px] rounded-[6px] text-[16px] font-medium bg-ha-primary hover:bg-ha-primary-hover text-white disabled:opacity-50"
              data-testid="button-mark-tips-done"
            >
              {markDoneMutation.isPending ? t("viewingTips.saving") : t("viewingTips.markComplete")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
