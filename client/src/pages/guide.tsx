import { useLocation } from "wouter";
import { ArrowLeft, FolderOpen, Shield, Search, Users, CheckCircle2 } from "lucide-react";

function PageHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="sticky top-0 z-10 bg-white border-b border-[var(--yo-divider)]">
      <div className="max-w-xl mx-auto flex items-center gap-3 px-4 h-14">
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-[var(--yo-surface)] flex items-center justify-center" data-testid="button-back">
          <ArrowLeft className="w-4 h-4 text-[var(--yo-dark)]" />
        </button>
        <h1 className="text-[17px] font-bold text-[var(--yo-dark)]">{title}</h1>
      </div>
    </header>
  );
}

function GuideSection({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="bg-white rounded-lg border border-[var(--yo-divider)] p-5">
      <h3 className="text-[16px] font-bold text-[var(--yo-dark)] mb-3">{title}</h3>
      <ul className="flex flex-col gap-2.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-3 text-[14px] text-[var(--yo-dark)] leading-relaxed">
            <CheckCircle2 className="w-4 h-4 text-[var(--yo-teal)] flex-shrink-0 mt-0.5" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const GUIDE_CONTENT: Record<string, { title: string; icon: typeof Shield; intro: string; sections: { title: string; items: string[] }[] }> = {
  documenten: {
    title: "Documenten checklist",
    icon: FolderOpen,
    intro: "In Duitsland vragen verhuurders bijna altijd om een set documenten voordat je kunt reageren. Zorg dat je deze klaar hebt.",
    sections: [
      {
        title: "Voor iedereen",
        items: [
          "Kopie identiteitsbewijs (paspoort of ID-kaart)",
          "SCHUFA-rapport (Bonitätsauskunft)",
          "Inkomensbewijs van de laatste 3 maanden",
          "Huurgeschiedenis of Mietschuldenfreiheitsbescheinigung",
          "Pasfoto",
        ],
      },
      {
        title: "In loondienst",
        items: [
          "Arbeidsovereenkomst",
          "Loonstroken van de laatste 3 maanden",
        ],
      },
      {
        title: "Voor ondernemers / zzp'ers",
        items: [
          "Gewerbeanmeldung of KvK-uittreksel",
          "Belastingaangifte van de laatste 2 jaar",
          "Bankafschriften van de laatste 3 maanden",
        ],
      },
    ],
  },
  schufa: {
    title: "SCHUFA-rapport aanvragen",
    icon: Shield,
    intro: "De SCHUFA (Schutzgemeinschaft für allgemeine Kreditsicherung) is het Duitse equivalent van een kredietrapport. Verhuurders vragen dit bijna altijd.",
    sections: [
      {
        title: "Wat is de SCHUFA?",
        items: [
          "Een overzicht van je kredietwaardigheid in Duitsland",
          "Wordt gevraagd door 90% van de verhuurders",
          "Toont je betaalgedrag en eventuele schulden",
        ],
      },
      {
        title: "Hoe vraag je het aan?",
        items: [
          "Ga naar meineschufa.de en maak een account aan",
          "Kies de gratis 'Datenkopie' (artikel 15 AVG/GDPR)",
          "Of bestel de betaalde 'SCHUFA-BonitätsAuskunft' (€29,95) voor een officieel document",
          "De betaalde versie wordt sneller geleverd en is professioneler",
        ],
      },
      {
        title: "Tips",
        items: [
          "Vraag je SCHUFA aan zodra je begint met zoeken — het kan 1-2 weken duren",
          "Geen Duitse bankrekening? Open eerst een N26 of bunq-rekening",
          "Nieuwe bewoners zonder kredietgeschiedenis krijgen meestal een neutrale score",
        ],
      },
    ],
  },
  zoekstrategie: {
    title: "Zoekstrategie optimaliseren",
    icon: Search,
    intro: "Met de juiste strategie vind je sneller een woning. Hier zijn bewezen tips van succesvolle huurders.",
    sections: [
      {
        title: "Zoekprofielen instellen",
        items: [
          "Maak meerdere zoekprofielen voor verschillende steden of budgetten",
          "Stel realistische prijsgrenzen in — te laag betekent minder matches",
          "Overweeg ook aangrenzende wijken van je ideale locatie",
          "Gebruik minimaal 2 zoekprofielen voor de beste resultaten",
        ],
      },
      {
        title: "Snelheid is alles",
        items: [
          "Activeer alle meldingskanalen (e-mail, SMS, WhatsApp)",
          "Reageer binnen 30 minuten op nieuwe woningen",
          "Heb je documenten en aanmeldingsbrief al klaarliggen",
          "Sla je favoriete woningen direct op",
        ],
      },
      {
        title: "Verhoog je kansen",
        items: [
          "Schrijf een persoonlijke aanmeldingsbrief per woning",
          "Vermeld je beroep, inkomen en verhuisdatum",
          "Wees flexibel met bezichtigingsmomenten",
          "Vraag een zoekbuddy om ook te zoeken",
        ],
      },
    ],
  },
  netwerk: {
    title: "Gebruik je netwerk",
    icon: Users,
    intro: "Veel woningen worden nooit openbaar geadverteerd. Je netwerk is een van je sterkste wapens bij het zoeken naar een huurwoning.",
    sections: [
      {
        title: "Vertel iedereen dat je zoekt",
        items: [
          "Laat vrienden, familie en collega's weten dat je een woning zoekt",
          "Post op LinkedIn of sociale media over je zoektocht",
          "Vraag in Facebook-groepen voor expats en woningzoekers",
          "Informeer bij je werkgever — sommige bedrijven helpen met huisvesting",
        ],
      },
      {
        title: "Zoekbuddy instellen",
        items: [
          "Voeg een zoekbuddy toe in HousAlert — zij ontvangen dezelfde meldingen",
          "Ideaal voor een partner, vriend of familielid",
          "Meer ogen op nieuwe woningen = sneller reageren",
        ],
      },
      {
        title: "Deeltekst voor je netwerk",
        items: [
          "Kopieer: 'Ik zoek een huurwoning in Duitsland via HousAlert. Ken je iets? Stuur het door!'",
          "Deel via WhatsApp, Telegram of e-mail",
          "Hoe meer mensen weten dat je zoekt, hoe groter je kans",
        ],
      },
    ],
  },
};

export function GuidePage({ guideId }: { guideId: string }) {
  const [, navigate] = useLocation();
  const guide = GUIDE_CONTENT[guideId];

  if (!guide) {
    navigate("/dashboard?tab=tips");
    return null;
  }

  const Icon = guide.icon;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <PageHeader title={guide.title} onBack={() => navigate("/dashboard?tab=tips")} />
      <main className="flex-1 max-w-xl mx-auto w-full px-6 pt-6 pb-32">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(45,212,191,0.1)" }}>
            <Icon className="w-6 h-6 text-[var(--yo-teal)]" />
          </div>
          <h2 className="text-[24px] font-[800] tracking-[-0.03em] text-[var(--yo-dark)]" data-testid={`heading-guide-${guideId}`}>
            {guide.title}
          </h2>
        </div>
        <p className="text-[15px] text-[var(--yo-dark)] leading-relaxed mb-6" data-testid={`text-guide-intro-${guideId}`}>
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
