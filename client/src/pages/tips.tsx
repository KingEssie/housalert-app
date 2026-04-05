import { useState } from "react";
import {
  MessageSquare,
  FileText,
  FolderOpen,
  TrendingUp,
  PenTool,
  ChevronRight,
  CheckCircle2,
  Gift,
} from "lucide-react";
import { useTranslation } from "@/i18n";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api-base";
import { ReferralCodeModal } from "@/components/referral-code-modal";

export const TIP_IDS = [
  "reageren",
  "bezichtiging",
  "kansen",
  "documenten",
  "introductiebrief",
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
      id: "reageren" as TipId,
      icon: MessageSquare,
      title: t("tips.guide.reageren"),
      description: t("tips.guideDesc.reageren"),
      route: "/tips/flow",
    },
    {
      id: "bezichtiging" as TipId,
      icon: TrendingUp,
      title: t("tips.guide.bezichtiging"),
      description: t("tips.guideDesc.bezichtiging"),
      route: "/tips/flow",
    },
    {
      id: "kansen" as TipId,
      icon: TrendingUp,
      title: t("tips.guide.kansen"),
      description: t("tips.guideDesc.kansen"),
      route: "/tips/flow",
    },
    {
      id: "documenten" as TipId,
      icon: FolderOpen,
      title: t("tips.guide.documenten"),
      description: t("tips.guideDesc.documenten"),
      route: "/tips/flow",
    },
    {
      id: "introductiebrief" as TipId,
      icon: PenTool,
      title: t("tips.guide.introductiebrief"),
      description: t("tips.guideDesc.introductiebrief"),
      route: "/application-letter?from=tips",
    },
  ];
}

const FLOW_TIP_MAPPING: Record<TipId, string[]> = {
  reageren: ["reaktion"],
  bezichtiging: ["besichtigung"],
  kansen: ["plattformen", "neubau", "netzwerk"],
  documenten: ["dokumente", "finanzen"],
  introductiebrief: [],
};

function isTipCompleted(tipId: TipId, readSet: Set<string>): boolean {
  if (readSet.has(tipId)) return true;
  const mapped = FLOW_TIP_MAPPING[tipId] || [];
  return mapped.length > 0 && mapped.some((id) => readSet.has(id));
}

export default function TipsPage({ navigate }: { navigate: (path: string) => void }) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const guides = getTipConfig(t);
  const readSet = getTipsReadSet();
  const [referralModalOpen, setReferralModalOpen] = useState(false);

  const { data: referralData, isLoading: referralLoading } = useQuery<{
    code: string;
    totalInvited: number;
    pending: number;
    qualified: number;
    rewarded: number;
  }>({
    queryKey: ["/api/referrals/me"],
    queryFn: async () => {
      const token = session?.access_token;
      if (!token) throw new Error("No token");
      const res = await apiFetch("/api/referrals/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!session?.access_token,
  });

  return (
    <div className="flex flex-col pb-8">
      <div className="sticky top-0 z-10 bg-white px-5 pt-6 pb-4">
        <h1 className="text-page-title" data-testid="heading-tips">
          {t("tips.pageTitle")}
        </h1>
        <p className="text-[14px] text-[#6B7280] mt-1 leading-relaxed" data-testid="text-tips-subtitle">
          {t("tips.pageSubtitle")}
        </p>
      </div>

      <div className="px-4 flex flex-col gap-6 pt-2">
        <div data-testid="section-recommended">
          <h2 className="text-[16px] font-bold text-[#111111] mb-3" data-testid="text-recommended-title">
            {t("tips.recommendedTitle")}
          </h2>
          <button
            onClick={() => setReferralModalOpen(true)}
            className="w-full rounded-[16px] bg-white border border-[#E5E7EB] p-4 text-left active:bg-[#F9FAFB] transition-colors"
            data-testid="card-referral-promo"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-full bg-[#FFF1F3] flex items-center justify-center flex-shrink-0">
                <Gift className="w-5 h-5 text-ha-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-[#9CA3AF] tracking-wide mb-0.5">
                  {t("tips.referralOverline")}
                </p>
                <p className="text-[15px] font-semibold text-[#111111]">
                  {t("tips.referralText")}
                </p>
              </div>
            </div>
            <div className="mt-3">
              <span className="inline-flex h-[36px] px-5 rounded-full bg-ha-primary text-white text-[13px] font-bold items-center hover:bg-ha-primary-hover transition-colors">
                {t("tips.referralCta")}
              </span>
            </div>
          </button>
        </div>

        <div data-testid="section-guides">
          <h2 className="text-[16px] font-bold text-[#111111] mb-3" data-testid="text-guides-title">
            {t("tips.guidesTitle")}
          </h2>
          <div className="rounded-[16px] bg-white border border-[#E5E7EB] overflow-hidden">
            {guides.map((guide, idx) => {
              const isRead = isTipCompleted(guide.id, readSet);
              return (
                <div key={guide.id}>
                  {idx > 0 && <div className="h-px bg-[#F0F0F0] mx-4" />}
                  <button
                    onClick={() => navigate(guide.route)}
                    className="w-full flex items-center gap-3 px-4 h-[52px] text-left active:bg-[#F9FAFB] transition-colors"
                    data-testid={`row-guide-${guide.id}`}
                  >
                    <p className={`flex-1 text-[15px] min-w-0 truncate ${isRead ? "text-[#9CA3AF]" : "font-medium text-[#111111]"}`}>
                      {guide.title}
                    </p>
                    {isRead ? (
                      <CheckCircle2 className="w-[18px] h-[18px] text-ha-primary flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-[18px] h-[18px] text-[#C4C4C4] flex-shrink-0" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <ReferralCodeModal
        open={referralModalOpen}
        onClose={() => setReferralModalOpen(false)}
        code={referralData?.code || null}
        loading={referralLoading}
      />
    </div>
  );
}
