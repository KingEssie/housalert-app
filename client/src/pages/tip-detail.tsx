import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useTranslation } from "@/i18n";
import { ArrowLeft, Check, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getTipConfig, TIP_IDS, getTipsReadSet, markTipRead, type TipId } from "./tips";

export default function TipDetailPage() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/tip/:id");
  const tipId = params?.id as TipId | undefined;
  const { t } = useTranslation();
  const [isRead, setIsRead] = useState(false);

  const tips = getTipConfig(t);
  const currentIndex = tipId ? TIP_IDS.indexOf(tipId as TipId) : -1;
  const tip = currentIndex >= 0 ? tips[currentIndex] : null;
  const nextTip = currentIndex >= 0 && currentIndex < tips.length - 1 ? tips[currentIndex + 1] : null;

  useEffect(() => {
    if (tipId) {
      setIsRead(getTipsReadSet().has(tipId));
    }
  }, [tipId]);

  if (!tip) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <p className="text-[#6B7280]">{t("tips.notFound")}</p>
      </div>
    );
  }

  const Icon = tip.icon;

  function handleMarkRead() {
    if (!tipId) return;
    markTipRead(tipId);
    setIsRead(true);
  }

  function handleNext() {
    if (nextTip) {
      navigate(`/tip/${nextTip.id}`);
    } else {
      navigate("/dashboard?tab=tips");
    }
  }

  function handleGoToContent() {
    if (!tipId) return;
    markTipRead(tipId);
    setIsRead(true);

    const tipConfig = tips[currentIndex];
    if (tipConfig) {
      navigate(tipConfig.route);
    }
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      <header className="sticky top-0 z-10 bg-[#F9FAFB] border-b border-[#E5E7EB]">
        <div className="max-w-xl mx-auto flex items-center h-[48px] px-5">
          <button
            onClick={() => navigate("/dashboard?tab=tips")}
            className="w-9 h-9 rounded-full bg-white flex items-center justify-center mr-3 active:scale-95 transition-transform"
            data-testid="button-back-tip"
          >
            <ArrowLeft className="w-4 h-4 text-[#6B7280]" />
          </button>
          <h1 className="text-[17px] font-medium text-[#111111] flex-1 tracking-wide">
            {t("tips.tipLabel")} {currentIndex + 1}/{TIP_IDS.length}
          </h1>
        </div>
      </header>

      <div className="max-w-xl mx-auto w-full px-5 pt-3">
        <div className="w-full bg-[#F9FAFB] rounded-full h-1.5" data-testid="progress-bar">
          <div
            className="bg-ha-primary h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / TIP_IDS.length) * 100}%` }}
          />
        </div>
      </div>

      <main className="flex-1 max-w-xl mx-auto w-full px-5 pt-8 pb-32">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-[6px] flex items-center justify-center flex-shrink-0 bg-ha-primary/10">
            <Icon className="w-7 h-7 text-ha-primary" />
          </div>
          <div>
            <p className="text-[12px] font-medium text-ha-primary uppercase tracking-wide">
              {t("tips.tipLabel")} {currentIndex + 1}
            </p>
            <h2 className="text-[22px] font-medium text-[#111111] leading-tight" data-testid="text-tip-title">
              {tip.title}
            </h2>
          </div>
        </div>

        <p className="text-[15px] text-[#6B7280] leading-relaxed mb-6" data-testid="text-tip-description">
          {tip.description}
        </p>

        <button
          onClick={handleGoToContent}
          className="w-full bg-white rounded-[6px] p-5 flex items-center gap-3 text-left hover:bg-[#F9FAFB] transition-colors active:scale-[0.985]"
          data-testid="button-open-content"
        >
          <Icon className="w-5 h-5 text-ha-primary flex-shrink-0" />
          <span className="text-[14px] font-medium text-[#111111] flex-1">{t("tips.openContent")}</span>
          <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
        </button>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-[#F9FAFB] border-t border-[#E5E7EB] p-4 pb-5 z-10">
        <div className="max-w-xl mx-auto flex gap-3">
          <Button
            onClick={handleMarkRead}
            disabled={isRead}
            className={`flex-1 ha-btn font-medium ${
              isRead
                ? "bg-ha-success-light text-ha-success border border-ha-success/30 hover:bg-ha-success-light"
                : "bg-white text-[#111111] border border-[#E5E7EB] hover:bg-[#F9FAFB]"
            }`}
            data-testid="button-mark-read"
          >
            <Check className="w-4 h-4" />
            {isRead ? t("tips.markedRead") : t("tips.markRead")}
          </Button>
          <Button
            onClick={handleNext}
            className="flex-1 ha-btn bg-ha-primary hover:bg-ha-primary-hover text-white font-medium"
            data-testid="button-next-tip"
          >
            {nextTip ? t("common.next") : t("tips.backToOverview")}
            {nextTip && <ChevronRight className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
