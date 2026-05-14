import { log } from "./log";

export const FAQ_FALLBACK_URL = "https://www.housalert.com/faq";

export interface FaqItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  keywords: string[];
  subjects: string[];
}

export interface FaqSuggestion {
  id: string;
  title: string;
  summary: string;
  url: string;
  score: number;
}

export const FAQ_INDEX: FaqItem[] = [
  {
    id: "how-it-works",
    title: "Hoe werkt HousAlert?",
    summary: "HousAlert zoekt automatisch naar woningen die passen bij jouw zoekopdracht en stuurt je een melding zodra er een match is.",
    url: "https://www.housalert.com/faq#hoe-werkt-housalert",
    keywords: ["hoe werkt", "werking", "uitleg", "wat is housalert", "beginnen", "starten", "zoeken", "hoe gebruik"],
    subjects: ["Overig", "Mijn profiel"],
  },
  {
    id: "no-notifications",
    title: "Ik ontvang geen meldingen",
    summary: "Controleer je meldingsinstellingen: zorg dat e-mail of push-meldingen zijn ingeschakeld en dat je zoekprofiel actief is.",
    url: "https://www.housalert.com/faq#meldingen-ontvangen",
    keywords: ["geen melding", "geen notificatie", "ontvang niet", "melding werkt niet", "alert", "bericht", "e-mail niet", "push niet", "notificatie"],
    subjects: ["Meldingen ontvangen"],
  },
  {
    id: "edit-profile",
    title: "Hoe pas ik mijn zoekprofiel aan?",
    summary: "Ga naar Instellingen → Zoekprofiel en pas je stad, prijsrange, slaapkamers of andere criteria aan.",
    url: "https://www.housalert.com/faq#zoekprofiel-aanpassen",
    keywords: ["profiel aanpassen", "zoekprofiel", "criteria wijzigen", "stad wijzigen", "prijs aanpassen", "slaapkamers", "radius", "zoekgebied", "instellingen"],
    subjects: ["Mijn profiel"],
  },
  {
    id: "subscription-cancel",
    title: "Hoe zeg ik mijn abonnement op?",
    summary: "Je kunt je abonnement op elk moment opzeggen via Instellingen → Abonnement. Het blijft actief tot het einde van de betaalperiode.",
    url: "https://www.housalert.com/faq#abonnement-opzeggen",
    keywords: ["opzeggen", "annuleren", "stop", "abonnement beëindigen", "uitschrijven", "abonnement stopzetten", "cancel"],
    subjects: ["Abonnement & betaling"],
  },
  {
    id: "subscription-cost",
    title: "Wat kost HousAlert?",
    summary: "HousAlert biedt een gratis proefperiode. Daarna kies je een maandelijks of meerdere-maanden abonnement. Bekijk de actuele prijzen in de app.",
    url: "https://www.housalert.com/faq#abonnement-kosten",
    keywords: ["kosten", "prijs", "wat kost", "gratis", "proefperiode", "trial", "betalen", "abonnement prijs", "maandelijks"],
    subjects: ["Abonnement & betaling"],
  },
  {
    id: "payment-failed",
    title: "Mijn betaling is mislukt",
    summary: "Controleer je betaalgegevens in Instellingen → Abonnement. Zorg dat je kaart geldig is en voldoende saldo heeft.",
    url: "https://www.housalert.com/faq#betaling-mislukt",
    keywords: ["betaling mislukt", "niet betaald", "factuur", "betalingsprobleem", "creditcard", "iDEAL", "incasso", "betalen mislukt"],
    subjects: ["Abonnement & betaling"],
  },
  {
    id: "tech-app-crash",
    title: "De app werkt niet of crasht",
    summary: "Probeer de app te herladen. Als het probleem aanhoudt, log dan uit en opnieuw in, of verwijder en herinstalleer de app.",
    url: "https://www.housalert.com/faq#app-werkt-niet",
    keywords: ["app werkt niet", "crasht", "fout", "error", "laadt niet", "scherm leeg", "technisch", "haperen", "bug", "stuk", "kapot"],
    subjects: ["Technisch probleem"],
  },
  {
    id: "email-push-settings",
    title: "E-mail en push-meldingen instellen",
    summary: "Ga naar Instellingen → Meldingen om e-mail of push-meldingen in of uit te schakelen.",
    url: "https://www.housalert.com/faq#meldingen-instellen",
    keywords: ["e-mail instellen", "push instellen", "melding inschakelen", "notificatie toestaan", "meldingen uitschakelen", "e-mail uitschakelen"],
    subjects: ["Meldingen ontvangen"],
  },
  {
    id: "matches-not-showing",
    title: "Ik zie geen matches",
    summary: "Controleer of je zoekprofiel actief is en of je filters niet te streng zijn. Verbreed je zoekgebied of pas je prijsrange aan.",
    url: "https://www.housalert.com/faq#geen-matches",
    keywords: ["geen matches", "geen woningen", "geen resultaten", "lege lijst", "niets gevonden", "geen aanbod"],
    subjects: ["Meldingen ontvangen", "Mijn profiel"],
  },
  {
    id: "account-delete",
    title: "Hoe verwijder ik mijn account?",
    summary: "Stuur ons een bericht via de Support-pagina met het verzoek om je account te verwijderen. We verwerken dit binnen 5 werkdagen.",
    url: "https://www.housalert.com/faq#account-verwijderen",
    keywords: ["account verwijderen", "account wissen", "data verwijderen", "uitschrijven", "account sluiten", "gdpr", "avg"],
    subjects: ["Overig", "Mijn profiel"],
  },
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

function scoreItem(item: FaqItem, normalizedText: string, subject: string): number {
  let score = 0;

  if (subject && item.subjects.includes(subject)) {
    score += 3;
  }

  for (const kw of item.keywords) {
    if (normalizedText.includes(normalize(kw))) {
      score += 2;
    }
    const words = normalize(kw).split(" ");
    for (const word of words) {
      if (word.length > 3 && normalizedText.includes(word)) {
        score += 0.5;
      }
    }
  }

  return score;
}

export async function getFaqSuggestions(
  subject: string,
  message: string,
  customSubject?: string,
  useAi = true
): Promise<FaqSuggestion[]> {
  const combinedText = normalize(`${subject} ${customSubject || ""} ${message}`);
  const effectiveSubject = subject === "Overig" ? "" : subject;

  const scored = FAQ_INDEX.map(item => ({
    ...item,
    score: scoreItem(item, combinedText, effectiveSubject),
  })).filter(item => item.score > 0).sort((a, b) => b.score - a.score);

  const top3 = scored.slice(0, 3);

  if (top3.length === 0) return [];

  const aiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (useAi && aiKey && top3.length > 1) {
    try {
      const { default: OpenAI } = await import("openai");
      const openai = new OpenAI({
        apiKey: aiKey,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const prompt = `A user submitted a support ticket with subject "${subject}" and message: "${message.substring(0, 300)}".
These are the candidate FAQ items (JSON):
${JSON.stringify(top3.map(i => ({ id: i.id, title: i.title })))}
Return ONLY a JSON array of FAQ item IDs ordered by most relevant first (max 3). No explanation.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 100,
        temperature: 0,
      });

      const raw = completion.choices[0]?.message?.content?.trim() || "[]";
      const ordered: string[] = JSON.parse(raw.replace(/```json?|```/g, "").trim());
      const reordered = ordered
        .map(id => top3.find(i => i.id === id))
        .filter(Boolean) as typeof top3;

      const result = reordered.length >= top3.length ? reordered : top3;
      log(`[support-faq] AI ranking applied — top=${result[0]?.id}`);
      return result.slice(0, 3).map(({ id, title, summary, url, score }) => {
        if (!url) log(`[support-faq] WARNING: FAQ item "${id}" has no URL — using fallback`);
        return { id, title, summary, url: url || FAQ_FALLBACK_URL, score };
      });
    } catch (err: any) {
      log(`[support-faq] AI ranking failed — falling back to keyword: ${err.message}`);
    }
  }

  log(`[support-faq] Keyword match — top=${top3[0]?.id} score=${top3[0]?.score}`);
  return top3.map(({ id, title, summary, url, score }) => {
    if (!url) log(`[support-faq] WARNING: FAQ item "${id}" has no URL — using fallback`);
    return { id, title, summary, url: url || FAQ_FALLBACK_URL, score };
  });
}
