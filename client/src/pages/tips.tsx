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

const GUIDES = [
  {
    id: "bezichtiging",
    icon: Eye,
    title: "Bezichtigingtips",
    description: "Maak een goede eerste indruk en stel de juiste vragen.",
    route: "/tips/bezichtiging",
  },
  {
    id: "aanmeldingsbrief",
    icon: FileText,
    title: "Aanmeldingsbrief schrijven",
    description: "Bereid een sterke brief voor waarmee je opvalt bij verhuurders.",
    route: "/application-letter",
  },
  {
    id: "documenten",
    icon: FolderOpen,
    title: "Documenten checklist",
    description: "Welke documenten heb je nodig om te huren in Duitsland?",
    route: "/tips/documenten",
  },
  {
    id: "schufa",
    icon: Shield,
    title: "SCHUFA-rapport aanvragen",
    description: "Hoe vraag je een SCHUFA-rapport aan en waarom is het belangrijk?",
    route: "/tips/schufa",
  },
  {
    id: "zoekstrategie",
    icon: Search,
    title: "Zoekstrategie optimaliseren",
    description: "Tips om je zoekprofielen zo in te stellen dat je meer matches krijgt.",
    route: "/tips/zoekstrategie",
  },
  {
    id: "netwerk",
    icon: Users,
    title: "Gebruik je netwerk",
    description: "Hoe je vrienden, collega's en sociale media kunt inzetten bij je zoektocht.",
    route: "/tips/netwerk",
  },
];

export default function TipsPage({ navigate }: { navigate: (path: string) => void }) {
  return (
    <div className="flex flex-col gap-6 px-6 pt-6">
      <div className="mb-1">
        <h1 className="text-page-title" data-testid="heading-tips">
          Tips
        </h1>
        <p className="text-subtitle mt-1">
          Handige gidsen om je kansen te vergroten
        </p>
      </div>

      <div className="bg-[var(--yo-chip-bg)] rounded-lg p-5 flex items-start gap-4" data-testid="card-tips-intro">
        <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
          <Lightbulb className="w-5 h-5 text-[var(--yo-dark)]" />
        </div>
        <div>
          <p className="text-[15px] font-semibold text-[var(--yo-dark)]">Wist je dat?</p>
          <p className="text-[13px] text-[var(--yo-dark)] mt-0.5 leading-relaxed">
            Huurders die goed voorbereid zijn, reageren gemiddeld 3x sneller en krijgen vaker een woning.
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
              className="bg-white rounded-lg border border-[var(--yo-divider)] p-5 flex items-start gap-4 text-left hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition-all duration-200 active:scale-[0.985] w-full"
              data-testid={`card-guide-${guide.id}`}
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "rgba(45,212,191,0.1)" }}>
                <Icon className="w-5 h-5 text-[var(--yo-teal)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-[var(--yo-dark)]">{guide.title}</p>
                <p className="text-[13px] text-[var(--yo-dark)] mt-0.5 leading-relaxed">{guide.description}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-[var(--yo-dark)] flex-shrink-0 mt-1" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
