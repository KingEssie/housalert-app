import {
  FileText,
  FolderOpen,
  TrendingUp,
  PenTool,
  ChevronRight,
  CheckCircle2,
  Gift,
  Wallet,
  Globe,
  Building2,
  Users,
  Eye,
  Send,
} from "lucide-react";
import { useTranslation } from "@/i18n";
import { HighlightCard } from "@/components/highlight-card";
import { useReferralShare } from "@/lib/referral-share";

export const TIP_IDS = [
  "dokumente",
  "finanzen",
  "reaktion",
  "plattformen",
  "neubau",
  "netzwerk",
  "besichtigung",
  "followup",
] as const;

export type TipId = (typeof TIP_IDS)[number];

const TIPS_READ_KEY = "housalert_tips_read";

export function getTipsReadSet(): Set<string> {
  try {
    const stored = localStorage.getItem(TIPS_READ_KEY);
    return new Set(stored ? JSON.parse(stored) : []);
  } catch {
    return new Set();
  }
}

export function markTipRead(tipId: string) {
  const s = getTipsReadSet();
  s.add(tipId);
  localStorage.setItem(TIPS_READ_KEY, JSON.stringify(Array.from(s)));
}

export function unmarkTipRead(tipId: string) {
  const s = getTipsReadSet();
  s.delete(tipId);
  localStorage.setItem(TIPS_READ_KEY, JSON.stringify(Array.from(s)));
}

export function getTipsProgress(): { read: number; total: number } {
  const readSet = getTipsReadSet();
  const read = TIP_IDS.filter((id) => readSet.has(id)).length;
  return { read, total: TIP_IDS.length };
}

export function getTipConfig(t: (key: string) => string) {
  return [
    {
      id: "dokumente" as TipId,
      icon: FolderOpen,
      title: t("tips.guide.dokumente"),
      description: t("tips.guideDesc.dokumente"),
      route: "/tips/flow",
    },
    {
      id: "finanzen" as TipId,
      icon: Wallet,
      title: t("tips.guide.finanzen"),
      description: t("tips.guideDesc.finanzen"),
      route: "/tips/flow",
    },
    {
      id: "reaktion" as TipId,
      icon: PenTool,
      title: t("tips.guide.reaktion"),
      description: t("tips.guideDesc.reaktion"),
      route: "/tips/flow",
    },
    {
      id: "plattformen" as TipId,
      icon: Globe,
      title: t("tips.guide.plattformen"),
      description: t("tips.guideDesc.plattformen"),
      route: "/tips/flow",
    },
    {
      id: "neubau" as TipId,
      icon: Building2,
      title: t("tips.guide.neubau"),
      description: t("tips.guideDesc.neubau"),
      route: "/tips/flow",
    },
    {
      id: "netzwerk" as TipId,
      icon: Users,
      title: t("tips.guide.netzwerk"),
      description: t("tips.guideDesc.netzwerk"),
      route: "/tips/flow",
    },
    {
      id: "besichtigung" as TipId,
      icon: Eye,
      title: t("tips.guide.besichtigung"),
      description: t("tips.guideDesc.besichtigung"),
      route: "/tips/flow",
    },
    {
      id: "followup" as TipId,
      icon: Send,
      title: t("tips.guide.followup"),
      description: t("tips.guideDesc.followup"),
      route: "/tips/flow",
    },
  ];
}

function isTipCompleted(tipId: TipId, readSet: Set<string>): boolean {
  return readSet.has(tipId);
}

export default function TipsPage({ navigate }: { navigate: (path: string) => void }) {
  const { t } = useTranslation();
  const guides = getTipConfig(t);
  const readSet = getTipsReadSet();
  const { handleReferralShare } = useReferralShare();

  return (
    <div className="flex flex-col pb-8">
      <div className="sticky top-0 z-10 bg-white px-5 pt-8 pb-5">
        <h1 className="text-page-title" data-testid="heading-tips">
          {t("tips.pageTitle")}
        </h1>
        <p className="text-[15px] text-[#334855] mt-2 leading-relaxed" data-testid="text-tips-subtitle">
          {t("tips.pageSubtitle")}
        </p>
      </div>

      <div className="px-5 flex flex-col gap-8 pt-2">
        <div data-testid="section-recommended">
          <h2 className="text-[18px] font-semibold text-[#111111] mb-3" data-testid="text-recommended-title">
            {t("tips.recommendedTitle")}
          </h2>
          <HighlightCard
            icon={Gift}
            overline={t("tips.referralOverline")}
            title={t("tips.referralText")}
            ctaLabel={t("tips.referralCta")}
            onClick={handleReferralShare}
            testId="card-referral-promo"
          />
        </div>

        <div data-testid="section-guides">
          <h2 className="text-[18px] font-semibold text-[#111111] mb-3" data-testid="text-guides-title">
            {t("tips.guidesTitle")}
          </h2>
          <div className="rounded-[12px] bg-white border border-[#E5E7EB] overflow-hidden">
            {guides.map((guide, idx) => {
              const isRead = isTipCompleted(guide.id, readSet);
              const GuideIcon = guide.icon;
              return (
                <div key={guide.id}>
                  {idx > 0 && <div className="h-px bg-[#F3F4F6] mx-4" />}
                  <button
                    onClick={() => navigate(guide.route)}
                    className="w-full flex items-center gap-[14px] px-5 py-4 text-left active:bg-[#F9FAFB] transition-colors"
                    data-testid={`row-guide-${guide.id}`}
                  >
                    <GuideIcon className={`w-6 h-6 flex-shrink-0 ${isRead ? "text-[#334855]" : "text-[#111111]"}`} strokeWidth={1.6} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-[15px] leading-snug truncate ${isRead ? "text-[#334855]" : "font-medium text-[#111111]"}`}>
                        {guide.title}
                      </p>
                      {guide.description && (
                        <p className="text-[13px] text-[#334855] mt-0.5 truncate">{guide.description}</p>
                      )}
                    </div>
                    {isRead ? (
                      <CheckCircle2 className="w-[20px] h-[20px] text-ha-success flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-[18px] h-[18px] text-[#D1D5DB] flex-shrink-0" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
