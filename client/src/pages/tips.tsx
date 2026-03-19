import {
  Eye,
  FileText,
  FolderOpen,
  Search,
  Users,
  Shield,
  ArrowRight,
  Lightbulb,
  CheckCircle2,
} from "lucide-react";
import { useTranslation } from "@/i18n";

export const TIP_IDS = [
  "bezichtiging",
  "aanmeldingsbrief",
  "documenten",
  "schufa",
  "zoekstrategie",
  "netwerk",
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

export function getTipsProgress(): { read: number; total: number } {
  const readSet = getTipsReadSet();
  const read = TIP_IDS.filter((id) => readSet.has(id)).length;
  return { read, total: TIP_IDS.length };
}

export function getTipConfig(t: (key: string) => string) {
  return [
    {
      id: "bezichtiging" as TipId,
      icon: Eye,
      title: t("tips.viewingTips"),
      description: t("tips.viewingTipsDesc"),
      route: "/tips/bezichtiging",
    },
    {
      id: "aanmeldingsbrief" as TipId,
      icon: FileText,
      title: t("tips.applicationLetter"),
      description: t("tips.applicationLetterDesc"),
      route: "/application-letter",
    },
    {
      id: "documenten" as TipId,
      icon: FolderOpen,
      title: t("tips.documentsChecklist"),
      description: t("tips.documentsChecklistDesc"),
      route: "/tips/documenten",
    },
    {
      id: "schufa" as TipId,
      icon: Shield,
      title: t("tips.schufa"),
      description: t("tips.schufaDesc"),
      route: "/tips/schufa",
    },
    {
      id: "zoekstrategie" as TipId,
      icon: Search,
      title: t("tips.searchStrategy"),
      description: t("tips.searchStrategyDesc"),
      route: "/tips/zoekstrategie",
    },
    {
      id: "netwerk" as TipId,
      icon: Users,
      title: t("tips.useNetwork"),
      description: t("tips.useNetworkDesc"),
      route: "/tips/netwerk",
    },
  ];
}

export default function TipsPage({ navigate }: { navigate: (path: string) => void }) {
  const { t } = useTranslation();
  const guides = getTipConfig(t);
  const readSet = getTipsReadSet();
  const { read, total } = getTipsProgress();

  return (
    <div className="flex flex-col pb-6">
      <div className="sticky top-0 z-10 bg-white pt-5 pb-3 px-6">
        <h1 className="text-page-title" data-testid="heading-tips">
          {t("tips.title")}
        </h1>
        {read > 0 && (
          <p className="text-[13px] text-[#6B7280] mt-1" data-testid="text-tips-progress">
            {read}/{total} {t("tips.completed")}
          </p>
        )}
      </div>

      <div className="px-6 flex flex-col gap-5">
        <div className="bg-[#F3F4F6] rounded-2xl p-5 flex items-start gap-4" data-testid="card-tips-intro">
          <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
            <Lightbulb className="w-5 h-5 text-[#71717A]" />
          </div>
          <div>
            <p className="text-[15px] font-medium text-[#18181B]">{t("tips.didYouKnow")}</p>
            <p className="text-[13px] text-[#1F2937] mt-0.5 leading-relaxed">
              {t("tips.intro")}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3" data-testid="section-guides">
          {guides.map((guide, index) => {
            const Icon = guide.icon;
            const isRead = readSet.has(guide.id);
            return (
              <button
                key={guide.id}
                onClick={() => navigate(`/tip/${guide.id}`)}
                className={`bg-white rounded-[24px] border border-[#F0F0F0] shadow-[0_2px_8px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)] p-5 flex items-center gap-4 text-left hover:shadow-[0_4px_16px_rgba(15,23,42,0.08),0_12px_36px_rgba(15,23,42,0.08)] transition-all duration-200 active:scale-[0.985] w-full ${isRead ? "opacity-70" : ""}`}
                data-testid={`card-guide-${guide.id}`}
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "rgba(13,110,253,0.1)" }}>
                  <Icon className="w-5 h-5 text-[#0D6EFD]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[15px] font-medium text-[#18181B] ${isRead ? "line-through text-[#9CA3AF]" : ""}`}>
                    {index + 1}. {guide.title}
                  </p>
                </div>
                {isRead ? (
                  <CheckCircle2 className="w-5 h-5 text-[#0D6EFD] flex-shrink-0" />
                ) : (
                  <ArrowRight className="w-4 h-4 text-[#71717A] flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
