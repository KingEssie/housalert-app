import { useLocation } from "wouter";
import { FolderOpen, Shield, Search, Users, CheckCircle2 } from "lucide-react";
import { AppHeader } from "@/components/ui/app-header";
import { useTranslation } from "@/i18n";

function GuideSection({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="bg-white rounded-[6px] border border-[#E5E7EB] p-4">
      <h3 className="text-[16px] font-medium text-[#000] mb-3">{title}</h3>
      <ul className="flex flex-col gap-2.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-3 text-[14px] text-[#000] leading-relaxed">
            <CheckCircle2 className="w-4 h-4 text-ha-primary flex-shrink-0 mt-0.5" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function useGuideContent() {
  const { t } = useTranslation();

  return {
    documenten: {
      title: t("guide.documenten.title"),
      icon: FolderOpen,
      intro: t("guide.documenten.intro"),
      sections: [
        {
          title: t("guide.documenten.forEveryone"),
          items: [
            t("guide.documenten.idCopy"),
            t("guide.documenten.schufa"),
            t("guide.documenten.incomeProof"),
            t("guide.documenten.rentalHistory"),
            t("guide.documenten.photo"),
          ],
        },
        {
          title: t("guide.documenten.employed"),
          items: [
            t("guide.documenten.employmentContract"),
            t("guide.documenten.payslips"),
          ],
        },
        {
          title: t("guide.documenten.selfEmployed"),
          items: [
            t("guide.documenten.businessReg"),
            t("guide.documenten.taxReturns"),
            t("guide.documenten.bankStatements"),
          ],
        },
      ],
    },
    schufa: {
      title: t("guide.schufa.title"),
      icon: Shield,
      intro: t("guide.schufa.intro"),
      sections: [
        {
          title: t("guide.schufa.whatIsTitle"),
          items: [
            t("guide.schufa.whatIs1"),
            t("guide.schufa.whatIs2"),
            t("guide.schufa.whatIs3"),
          ],
        },
        {
          title: t("guide.schufa.howToTitle"),
          items: [
            t("guide.schufa.howTo1"),
            t("guide.schufa.howTo2"),
            t("guide.schufa.howTo3"),
            t("guide.schufa.howTo4"),
          ],
        },
        {
          title: t("guide.schufa.tipsTitle"),
          items: [
            t("guide.schufa.tips1"),
            t("guide.schufa.tips2"),
            t("guide.schufa.tips3"),
          ],
        },
      ],
    },
    zoekstrategie: {
      title: t("guide.zoekstrategie.title"),
      icon: Search,
      intro: t("guide.zoekstrategie.intro"),
      sections: [
        {
          title: t("guide.zoekstrategie.profilesTitle"),
          items: [
            t("guide.zoekstrategie.profiles1"),
            t("guide.zoekstrategie.profiles2"),
            t("guide.zoekstrategie.profiles3"),
            t("guide.zoekstrategie.profiles4"),
          ],
        },
        {
          title: t("guide.zoekstrategie.speedTitle"),
          items: [
            t("guide.zoekstrategie.speed1"),
            t("guide.zoekstrategie.speed2"),
            t("guide.zoekstrategie.speed3"),
            t("guide.zoekstrategie.speed4"),
          ],
        },
        {
          title: t("guide.zoekstrategie.chanceTitle"),
          items: [
            t("guide.zoekstrategie.chance1"),
            t("guide.zoekstrategie.chance2"),
            t("guide.zoekstrategie.chance3"),
            t("guide.zoekstrategie.chance4"),
          ],
        },
      ],
    },
    netwerk: {
      title: t("guide.netwerk.title"),
      icon: Users,
      intro: t("guide.netwerk.intro"),
      sections: [
        {
          title: t("guide.netwerk.tellEveryoneTitle"),
          items: [
            t("guide.netwerk.tell1"),
            t("guide.netwerk.tell2"),
            t("guide.netwerk.tell3"),
            t("guide.netwerk.tell4"),
          ],
        },
        {
          title: t("guide.netwerk.buddyTitle"),
          items: [
            t("guide.netwerk.buddy1"),
            t("guide.netwerk.buddy2"),
            t("guide.netwerk.buddy3"),
          ],
        },
        {
          title: t("guide.netwerk.shareTitle"),
          items: [
            t("guide.netwerk.share1"),
            t("guide.netwerk.share2"),
            t("guide.netwerk.share3"),
          ],
        },
      ],
    },
  } as Record<string, { title: string; icon: typeof Shield; intro: string; sections: { title: string; items: string[] }[] }>;
}

export function GuidePage({ guideId }: { guideId: string }) {
  const [, navigate] = useLocation();
  const guideContent = useGuideContent();
  const guide = guideContent[guideId];

  if (!guide) {
    navigate("/dashboard?tab=tips");
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#EBEBF0" }}>
      <AppHeader title={guide.title} onBack={() => navigate("/dashboard?tab=tips")} />
      <main className="flex-1 max-w-xl mx-auto w-full px-6 pb-32">
        <p className="text-[15px] text-[#000] leading-relaxed mb-6" data-testid={`text-guide-intro-${guideId}`}>
          {guide.intro}
        </p>
        <div className="flex flex-col gap-4">
          {guide.sections.map((section, i) => (
            <GuideSection key={i} title={section.title} items={section.items} />
          ))}
        </div>
      </main>
    </div>
  );
}

export function DocumentenGuidePage() { return <GuidePage guideId="documenten" />; }
export function SchufaGuidePage() { return <GuidePage guideId="schufa" />; }
export function ZoekstrategieGuidePage() { return <GuidePage guideId="zoekstrategie" />; }
export function NetwerkGuidePage() { return <GuidePage guideId="netwerk" />; }
