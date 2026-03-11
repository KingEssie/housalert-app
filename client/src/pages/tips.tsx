import {
  FileText,
  Eye,
  FolderOpen,
  Search,
  Users,
  Shield,
  ArrowRight,
  Lightbulb,
} from "lucide-react";
import { useTranslation } from "@/i18n";

export default function TipsPage({ navigate }: { navigate: (path: string) => void }) {
  const { t } = useTranslation();

  const GUIDES = [
    {
      id: "bezichtiging",
      icon: Eye,
      title: t("tips.viewingTips"),
      description: t("tips.viewingTipsDesc"),
      route: "/tips/bezichtiging",
    },
    {
      id: "aanmeldingsbrief",
      icon: FileText,
      title: t("tips.applicationLetter"),
      description: t("tips.applicationLetterDesc"),
      route: "/application-letter",
    },
    {
      id: "documenten",
      icon: FolderOpen,
      title: t("tips.documentsChecklist"),
      description: t("tips.documentsChecklistDesc"),
      route: "/tips/documenten",
    },
    {
      id: "schufa",
      icon: Shield,
      title: t("tips.schufa"),
      description: t("tips.schufaDesc"),
      route: "/tips/schufa",
    },
    {
      id: "zoekstrategie",
      icon: Search,
      title: t("tips.searchStrategy"),
      description: t("tips.searchStrategyDesc"),
      route: "/tips/zoekstrategie",
    },
    {
      id: "netwerk",
      icon: Users,
      title: t("tips.useNetwork"),
      description: t("tips.useNetworkDesc"),
      route: "/tips/netwerk",
    },
  ];

  return (
    <div className="flex flex-col gap-6 px-6 pt-6">
      <div className="mb-1">
        <h1 className="text-page-title" data-testid="heading-tips">
          {t("tips.title")}
        </h1>
        <p className="text-subtitle mt-1">
          {t("tips.subtitle")}
        </p>
      </div>

      <div className="bg-[#F5F7FA] rounded-lg p-5 flex items-start gap-4" data-testid="card-tips-intro">
        <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
          <Lightbulb className="w-5 h-5 text-[#1F2937]" />
        </div>
        <div>
          <p className="text-[15px] font-semibold text-[#1F2937]">{t("tips.didYouKnow")}</p>
          <p className="text-[13px] text-[#1F2937] mt-0.5 leading-relaxed">
            {t("tips.intro")}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3" data-testid="section-guides">
        {GUIDES.map((guide) => {
          const Icon = guide.icon;
          return (
            <button
              key={guide.id}
              onClick={() => navigate(guide.route)}
              className="bg-white rounded-lg border border-[#E5E7EB] p-5 flex items-start gap-4 text-left hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition-all duration-200 active:scale-[0.985] w-full"
              data-testid={`card-guide-${guide.id}`}
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "rgba(45,212,191,0.1)" }}>
                <Icon className="w-5 h-5 text-[#0D6EFD]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-[#1F2937]">{guide.title}</p>
                <p className="text-[13px] text-[#1F2937] mt-0.5 leading-relaxed">{guide.description}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-[#1F2937] flex-shrink-0 mt-1" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
