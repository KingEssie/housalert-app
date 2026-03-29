import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, X, Check } from "lucide-react";
import { getTipsReadSet, markTipRead } from "./tips";

const FLOW_TIP_IDS = [
  "dokumente",
  "finanzen",
  "reaktion",
  "plattformen",
  "neubau",
  "netzwerk",
  "besichtigung",
  "followup",
] as const;

type FlowTipId = (typeof FLOW_TIP_IDS)[number];

interface TipStepContent {
  id: FlowTipId;
  title: string;
  body: string;
  sections?: { heading: string; items: string[] }[];
}

const STEPS: TipStepContent[] = [
  {
    id: "dokumente",
    title: "Verzamel je documenten",
    body: "Verhuurders in Duitsland hechten veel waarde aan een complete en professionele aanvraag. Zorg dat je deze documenten alvast klaar hebt staan.",
    sections: [
      {
        heading: "Als je in loondienst werkt:",
        items: [
          "Kopie ID / paspoort",
          "Arbeitsvertrag (arbeidsovereenkomst)",
          "Laatste 3 loonstroken",
          "SCHUFA-Auskunft (zeer belangrijk in Duitsland)",
          "Mietschuldenfreiheitsbescheinigung (verklaring vorige verhuurder)",
          "Bankafschriften (optioneel)",
        ],
      },
      {
        heading: "Als je zelfstandig bent:",
        items: [
          "Kopie ID / paspoort",
          "Gewerbeanmeldung (uittreksel bedrijfsregistratie)",
          "Inkomensoverzicht / belastingaangifte laatste 2–3 jaar",
          "SCHUFA-Auskunft",
        ],
      },
    ],
  },
  {
    id: "finanzen",
    title: "Check je financiële situatie",
    body: "De meeste verhuurders in Duitsland hanteren een inkomenseis van minimaal 3x de kale huurprijs.\n\nBijvoorbeeld: bij een huur van €1.000 per maand heb je een netto-inkomen van minimaal €3.000 nodig. Sommige verhuurders hanteren 2,5x tot 3,5x de huur.\n\nControleer vooraf of je aan deze eis voldoet, zodat je gerichter kunt zoeken en teleurstellingen voorkomt.",
  },
  {
    id: "reaktion",
    title: "Zorg voor een sterke reactie",
    body: "In Duitsland reageren verhuurders vaak op basis van wie het meest professioneel en compleet reageert. Gebruik een duidelijke en persoonlijke reactiebrief.\n\nZorg ervoor dat je brief bevat:\n• Een korte introductie over jezelf\n• Je werk- en inkomenssituatie\n• Een blijk van betrouwbaarheid\n• Eventueel: dat je geen huisdieren hebt (indien relevant)",
  },
  {
    id: "plattformen",
    title: "Meld je aan voor lokale groepen",
    body: "In Duitsland worden veel woningen gedeeld via platforms en communities.\n\nBelangrijke platforms:\n• Facebook-groepen (zoek op: \"Wohnung Berlin\", \"Wohnung München\", \"WG Zimmer Hamburg\")\n• WG-Gesucht — dé website voor gedeelde woningen en kamers\n• Kleinanzeigen.de — voorheen eBay Kleinanzeigen, veel particuliere aanbiedingen\n\nMeld je aan bij zoveel mogelijk relevante groepen in jouw stad.",
  },
  {
    id: "neubau",
    title: "Houd nieuwbouwprojecten in de gaten",
    body: "Neubauprojekte bieden vaak kansen omdat er minder concurrentie is dan bij bestaande woningen.\n\nBekijk nieuwbouwprojecten via ImmobilienScout24 of projectwebsites van lokale projectontwikkelaars. Veel nieuwbouwprojecten worden maanden van tevoren aangekondigd, dus vroeg aanmelden vergroot je kansen.",
  },
  {
    id: "netzwerk",
    title: "Gebruik je netwerk",
    body: "In Duitsland worden veel woningen via via verhuurd. Laat je netwerk weten dat je op zoek bent.\n\nVertel collega's, vrienden en kennissen dat je een woning zoekt. Plaats een bericht op social media. Vraag je werkgever of zij een relocation service of contacten hebben. Veel woningen worden verhuurd voordat ze openbaar worden aangeboden.",
  },
  {
    id: "besichtigung",
    title: "Maak een sterke indruk bij bezichtigingen",
    body: "Een bezichtiging is je kans om je als ideale huurder te presenteren.\n\n• Kom op tijd — liefst 5 minuten eerder\n• Kleed je netjes en verzorgd\n• Stel slimme vragen over het gebouw, de buurt of de servicekosten\n• Laat zien dat je serieus bent: neem je documenten mee\n• Wees vriendelijk en professioneel tegen de verhuurder of makelaar",
  },
  {
    id: "followup",
    title: "Stuur een sterke follow-up",
    body: "Na een bezichtiging kan een goede follow-up het verschil maken. Stuur een korte bevestiging en eventueel je reactiebrief.\n\n• Herhaal je interesse in de woning\n• Voeg je documenten toe als bijlage\n• Wees snel — stuur je follow-up dezelfde dag nog\n\nEen snelle en professionele opvolging laat zien dat je gemotiveerd en betrouwbaar bent.",
  },
];

export default function TipsFlowPage() {
  const [, navigate] = useLocation();
  const [currentStep, setCurrentStep] = useState(0);
  const [checkedSteps, setCheckedSteps] = useState<Set<string>>(() => {
    const readSet = getTipsReadSet();
    const initial = new Set<string>();
    FLOW_TIP_IDS.forEach((id) => {
      if (readSet.has(id)) initial.add(id);
    });
    return initial;
  });

  const step = STEPS[currentStep];
  const isLastStep = currentStep === STEPS.length - 1;
  const isChecked = checkedSteps.has(step.id);
  const completedCount = Array.from(FLOW_TIP_IDS).filter((id) => checkedSteps.has(id)).length;
  const progressPercent = Math.round((completedCount / STEPS.length) * 100);

  function handleToggleCheck() {
    const next = new Set(checkedSteps);
    if (next.has(step.id)) {
      next.delete(step.id);
    } else {
      next.add(step.id);
      markTipRead(step.id);
    }
    setCheckedSteps(next);
  }

  function handleNext() {
    if (isLastStep) {
      navigate("/dashboard?tab=home");
    } else {
      setCurrentStep(currentStep + 1);
      window.scrollTo(0, 0);
    }
  }

  function handleBack() {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      window.scrollTo(0, 0);
    } else {
      navigate("/dashboard?tab=home");
    }
  }

  function handleClose() {
    navigate("/dashboard?tab=home");
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#EBEBF0" }}>
      <header className="sticky top-0 z-10 bg-white border-b border-[rgba(15,23,42,0.04)]">
        <div className="max-w-[480px] mx-auto flex items-center h-[56px] px-4">
          <button
            onClick={handleBack}
            className="w-9 h-9 rounded-full flex items-center justify-center active:bg-[#EBEBF0] transition-colors"
            data-testid="button-tips-back"
          >
            <ArrowLeft className="w-5 h-5 text-[#000]" />
          </button>
          <h1 className="flex-1 text-center text-[16px] font-semibold text-[#000] truncate px-2">
            Vergroot je kansen met deze tips!
          </h1>
          <button
            onClick={handleClose}
            className="w-9 h-9 rounded-full flex items-center justify-center active:bg-[#EBEBF0] transition-colors"
            data-testid="button-tips-close"
          >
            <X className="w-5 h-5 text-[#000]" />
          </button>
        </div>

        <div className="max-w-[480px] mx-auto px-4 pb-3">
          <div className="w-full h-[6px] rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#22c55e] transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
              data-testid="progress-bar-fill"
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[12px] text-[#6B7280]">
              Stap {currentStep + 1} van {STEPS.length}
            </span>
            <span className="text-[12px] font-semibold text-[#22c55e]">
              {progressPercent}% voltooid
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[480px] mx-auto w-full px-4 py-5 pb-[200px]">
        <div
          className="bg-white rounded-[12px] overflow-hidden"
          style={{ border: "1px solid rgba(15, 23, 42, 0.04)" }}
          data-testid={`card-step-${step.id}`}
        >
          <div className="px-5 py-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-[#1e1b4b] flex items-center justify-center flex-shrink-0">
                <span className="text-[14px] font-bold text-white">{currentStep + 1}</span>
              </div>
              <h2 className="text-[18px] font-semibold text-[#000] leading-tight" data-testid="text-step-title">
                {step.title}
              </h2>
            </div>

            <div className="text-[15px] text-[#374151] leading-relaxed whitespace-pre-line" data-testid="text-step-body">
              {step.body}
            </div>

            {step.sections?.map((section, sIdx) => (
              <div key={sIdx} className="mt-5">
                <p className="text-[14px] font-semibold text-[#000] mb-2">{section.heading}</p>
                <ul className="space-y-1.5">
                  {section.items.map((item, iIdx) => (
                    <li key={iIdx} className="flex items-start gap-2 text-[14px] text-[#374151] leading-relaxed">
                      <span className="text-[#22c55e] mt-0.5 flex-shrink-0">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[rgba(15,23,42,0.04)] z-10">
        <div className="max-w-[480px] mx-auto px-4 py-4 pb-5 space-y-3">
          <button
            onClick={handleToggleCheck}
            className="w-full h-[48px] rounded-[6px] flex items-center justify-center gap-2 text-[15px] font-medium transition-colors active:scale-[0.98]"
            style={{
              background: isChecked ? "rgba(34, 197, 94, 0.08)" : "#F3F4F6",
              color: isChecked ? "#22c55e" : "#374151",
              border: isChecked ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid transparent",
            }}
            data-testid="button-mark-complete"
          >
            {isChecked && <Check className="w-4 h-4" />}
            {isChecked ? "Voltooid" : "Markeer als voltooid"}
          </button>

          <button
            onClick={handleNext}
            className="w-full h-[56px] rounded-[6px] bg-[#e91e63] hover:bg-[#d81b60] text-white text-[16px] font-bold transition-colors active:scale-[0.98]"
            data-testid="button-tips-next"
          >
            {isLastStep ? "Afronden" : "Volgende"}
          </button>
        </div>
      </div>
    </div>
  );
}
