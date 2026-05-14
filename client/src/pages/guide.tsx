import { useLocation } from "wouter";
import { FolderOpen, Shield, Search, Users, CheckCircle2, Wallet, Building2, Facebook, Building, Share2, MessageSquare } from "lucide-react";
import { AppHeader } from "@/components/ui/app-header";
import { useTranslation } from "@/i18n";

function GuideSection({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="bg-white rounded-[6px] border border-ha-card-border p-4">
      <h3 className="text-[16px] font-medium text-ha-text mb-3">{title}</h3>
      <ul className="flex flex-col gap-2.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-3 text-[14px] text-ha-text leading-relaxed">
            <CheckCircle2 className="w-4 h-4 text-ha-text flex-shrink-0 mt-0.5" />
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
    financien: {
      title: "Check je financiële situatie",
      icon: Wallet,
      intro: "In de meeste gevallen geldt: inkomen = minimaal 3x de kale huur. Weet wat je kunt lenen en toon dit direct aan verhuurders.",
      sections: [
        {
          title: "Wat verhuurders controleren",
          items: [
            "Netto maandinkomen is minimaal 3x de kale huurprijs.",
            "Vaste dienstverbanden worden sterk geprefereerd boven zzp of tijdelijk werk.",
            "Schulden en betalingsachterstanden worden zichtbaar via BKR- of Schufa-check.",
            "Verhuurders vragen soms om 3 à 6 maanden bankafschriften ter verificatie.",
          ],
        },
        {
          title: "Hoe je je situatie verbetert",
          items: [
            "Vraag een recente BKR- of Schufa-verklaring op — zo weet je wat verhuurders zien.",
            "Heb je een tijdelijk contract? Vraag je werkgever om een intentieverklaring voor verlenging.",
            "Als zzp'er: zorg voor belastingaangiften van de laatste 2 jaar en recente bankafschriften.",
            "Overweeg een garant (borg) als je inkomen net niet voldoet aan de 3x-norm.",
            "Bied een extra maand borg aan als je situatie afwijkt van het standaard profiel.",
          ],
        },
        {
          title: "Documenten die je inkomen bewijzen",
          items: [
            "Salarisstroken van de afgelopen 3 maanden.",
            "Recente werkgeversverklaring met huidig salaris en contracttype.",
            "Voor zzp: jaarrekening, IB-aangifte en banktransacties.",
            "Pensioenoverzicht of uitkeringsspecificatie indien van toepassing.",
          ],
        },
      ],
    },
    verhuurders: {
      title: "Maak accounts aan bij verhuurders",
      icon: Building2,
      intro: "Veel woningen gaan via platforms waar je moet inloggen. Zonder account ben je te laat — registreer je dus van tevoren.",
      sections: [
        {
          title: "Platforms om je op aan te melden",
          items: [
            "Funda — grootste platform voor huurwoningen in Nederland.",
            "Pararius — veel vrije sector woningen en particuliere verhuurders.",
            "Kamernet — populair voor kamers en studio's.",
            "WG-Gesucht.de — toonaangevend in Duitsland voor gedeelde woningen.",
            "Immowelt & ImmoScout24 — breed aanbod van huurwoningen in Duitsland.",
            "Vesteda, Amvest, Bouwinvest — grote institutionele verhuurders met eigen portalen.",
          ],
        },
        {
          title: "Tips voor je profiel op de platforms",
          items: [
            "Gebruik een professionele profielfoto — verhuurders zien dit als eerste.",
            "Vul je profiel volledig in, inclusief inkomen en huishoudsamenstelling.",
            "Zet notificaties aan zodat je direct wordt gewaarschuwd bij nieuwe woningen.",
            "Sla je documenten op in je profiel zodat je snel kunt reageren.",
          ],
        },
        {
          title: "Snel reageren is cruciaal",
          items: [
            "Reageer binnen 1 uur op nieuw aanbod — populaire woningen zijn snel weg.",
            "Installeer de app van elk platform voor directe meldingen.",
            "Stel zoekalerts in met de juiste filters zodat je niets mist.",
            "Wees voorbereid: houd je documenten digitaal klaarstaan.",
          ],
        },
      ],
    },
    facebook: {
      title: "Zoek via Facebook-groepen",
      icon: Facebook,
      intro: "Veel woningen komen nooit op grote platforms. Via Facebook-groepen vind je aanbod dat nergens anders staat — van particulieren die direct verhuren.",
      sections: [
        {
          title: "Hoe je de juiste groepen vindt",
          items: [
            "Zoek op Facebook naar: '[stad] huurwoning', '[stad] kamers te huur', '[stad] expats housing'.",
            "Sluit je aan bij lokale buurtgroepen — verhuurders posten hier soms direct.",
            "Zoek ook op: 'Huurwoningen [regio]', 'Kamer gezocht/aangeboden [stad]'.",
            "Volg meerdere groepen — in elke stad zijn er vaak 3 tot 10 actieve groepen.",
          ],
        },
        {
          title: "Hoe je reageert op aanbiedingen",
          items: [
            "Reageer direct — niet wachten tot morgen. Anderen zijn sneller.",
            "Stuur een kort berichtje: wie je bent, wanneer je wilt huren, en je budget.",
            "Vermeld dat je documenten klaar hebt — dat wekt vertrouwen.",
            "Wees beleefd en professioneel, ook in een informele groep.",
          ],
        },
        {
          title: "Waarschuwingen",
          items: [
            "Betaal nooit een borg zonder de woning te hebben bezichtigd.",
            "Ga niet in op verzoeken om geld te storten voordat je iets hebt getekend.",
            "Controleer het profiel van de verhuurder op authenticiteit.",
            "Bij twijfel: vraag om een videobezichtiging voordat je persoonlijke gegevens deelt.",
          ],
        },
      ],
    },
    nieuwbouw: {
      title: "Nieuwbouwprojecten in de gaten",
      icon: Building,
      intro: "Nieuwbouw is vaak al vol vóór oplevering. Door vroeg in te schrijven vergroot je je kansen aanzienlijk — wacht niet tot de oplevering.",
      sections: [
        {
          title: "Waar je nieuwbouw kunt vinden",
          items: [
            "Funda Nieuwbouw — speciale sectie voor nieuwbouwwoningen in aanbouw.",
            "Gemeentelijke websites — stadsdeelprojecten worden hier aangekondigd.",
            "Websites van projectontwikkelaars: Dura Vermeer, BPD, AM, Heijmans.",
            "Inschrijfportalen van woningcorporaties voor sociale nieuwbouw.",
            "In Duitsland: gewoba.de, saga.de en regionale gemeenteportalen.",
          ],
        },
        {
          title: "Tips om je vroeg in te schrijven",
          items: [
            "Schrijf je in bij de eerste 'interesse registratie' — nog vóór de officiële verkoop.",
            "Houd de nieuwssecties van projectontwikkelaars bij op social media.",
            "Meld je aan voor nieuwsbrieven van grote verhuurders over toekomstig aanbod.",
            "Vraag makelaars in de regio naar projecten die nog niet online staan.",
          ],
        },
        {
          title: "Voordelen van nieuwbouw",
          items: [
            "Geen achterstallig onderhoud — alles is nieuw en energiezuinig.",
            "Vaak langere huurtermijnen en stabielere huurprijzen in de beginfase.",
            "Kans om als eerste huurder wensen kenbaar te maken over inrichting of oplevering.",
            "Lagere energiekosten door moderne isolatie en installaties.",
          ],
        },
      ],
    },
    opvolging: {
      title: "Stuur een sterke huurpitch",
      icon: MessageSquare,
      intro: "Na de bezichtiging ben je nog niet klaar. Een sterke, persoonlijke huurpitch kan het verschil maken wanneer de verhuurder tussen meerdere kandidaten kiest.",
      sections: [
        {
          title: "Wat je huurpitch moet bevatten",
          items: [
            "Een korte, persoonlijke introductie: wie je bent, wat je doet en waarom je wilt huren.",
            "Waarom juist dít huis bij je past — wees specifiek over de locatie of indeling.",
            "Bevestiging dat je financieel voldoet: inkomen, vaste baan, geen schulden.",
            "Geruststelling over betrouwbaarheid: referenties van vorige verhuurder indien beschikbaar.",
            "Een concrete ingangsdatum en jouw bereidheid om snel te tekenen.",
          ],
        },
        {
          title: "Hoe je jezelf onderscheidt",
          items: [
            "Stuur de pitch binnen 24 uur na de bezichtiging — wacht niet te lang.",
            "Houd het kort: maximaal 200 woorden. Verhuurders lezen tientallen reacties.",
            "Schrijf in de taal van de verhuurder — Nederlands of Duits, afhankelijk van de markt.",
            "Voeg een vriendelijke afsluiting toe: 'Ik hoor graag van u' of 'Ik ben bereikbaar voor vragen'.",
          ],
        },
        {
          title: "Na de pitch",
          items: [
            "Wacht 2 à 3 werkdagen voordat je een vriendelijke follow-up stuurt.",
            "Blijf beschikbaar en reageer snel op eventuele vragen van de verhuurder.",
            "Accepteer ook een afwijzing professioneel — vraag eventueel om feedback voor de volgende keer.",
            "Noteer welke woningen je hebt bezichtigd en wat je hebt gestuurd, om bij te houden.",
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
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "rgb(var(--ha-bg))" }}>
      <AppHeader title={guide.title} onBack={() => { if (window.history.length > 1) window.history.back(); else navigate("/dashboard?tab=tips"); }} />
      <main className="flex-1 max-w-xl mx-auto w-full px-6 pb-32">
        <p className="text-[15px] text-ha-text leading-relaxed mb-6" data-testid={`text-guide-intro-${guideId}`}>
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
export function FinancienGuidePage() { return <GuidePage guideId="financien" />; }
export function VerhuurdersGuidePage() { return <GuidePage guideId="verhuurders" />; }
export function FacebookGuidePage() { return <GuidePage guideId="facebook" />; }
export function NieuwbouwGuidePage() { return <GuidePage guideId="nieuwbouw" />; }
export function OpvolgingGuidePage() { return <GuidePage guideId="opvolging" />; }
