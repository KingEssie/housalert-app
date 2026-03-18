import type { Locale } from "@/i18n";

const TEMPLATE_DE = `Sehr geehrte/r Vermieter/in,

mit großem Interesse habe ich Ihre Wohnung an [[ADDRESS]] in [[CITY]] gesehen. Gerne stelle ich mich als potenzieller Mieter vor.

Mein Name ist [[NAME]] und ich bin als [[JOB]] tätig. Mein monatliches Nettoeinkommen beträgt €[[INCOME]]. Die Miete von €[[PRICE]] pro Monat passt gut in mein Budget.

Ich suche eine angenehme, langfristige Wohnsituation und pflege meine Wohnung sorgfältig. Alle erforderlichen Unterlagen wie SCHUFA-Auskunft, Einkommensnachweise und Referenzen kann ich kurzfristig bereitstellen.

Gerne würde ich einen Besichtigungstermin vereinbaren. Sie erreichen mich unter:
- E-Mail: [[EMAIL]]
- Telefon: [[PHONE]]

Ich freue mich auf Ihre Rückmeldung.

Mit freundlichen Grüßen,
[[NAME]]`;

const TEMPLATE_EN = `Dear Sir/Madam,

I am writing to express my interest in the apartment at [[ADDRESS]] in [[CITY]]. I would like to introduce myself as a potential tenant.

My name is [[NAME]] and I work as a [[JOB]]. My monthly net income is €[[INCOME]]. The rent of €[[PRICE]] per month fits well within my budget.

I am looking for a pleasant, long-term living situation and take good care of my home. I can provide all required documents such as proof of income, employment contract and references at short notice.

I would love to schedule a viewing. You can reach me at:
- Email: [[EMAIL]]
- Phone: [[PHONE]]

I look forward to hearing from you.

Kind regards,
[[NAME]]`;

const TEMPLATE_NL = `Geachte verhuurder,

Met grote interesse heb ik uw woning aan [[ADDRESS]] in [[CITY]] gezien. Graag stel ik mij voor als potentiële huurder.

Mijn naam is [[NAME]] en ik werk als [[JOB]]. Mijn maandelijks netto-inkomen bedraagt €[[INCOME]]. De huur van €[[PRICE]] per maand past goed binnen mijn budget.

Ik zoek een prettige, langdurige woonsituatie en onderhoud mijn woning zorgvuldig. Alle benodigde documenten zoals inkomensbewijzen, werkgeversverklaring en referenties kan ik op korte termijn aanleveren.

Graag zou ik een bezichtiging willen inplannen. U kunt mij bereiken via:
- E-mail: [[EMAIL]]
- Telefoon: [[PHONE]]

Ik kijk uit naar uw reactie.

Met vriendelijke groet,
[[NAME]]`;

const TEMPLATES: Record<Locale, string> = {
  de: TEMPLATE_DE,
  en: TEMPLATE_EN,
  nl: TEMPLATE_NL,
};

export function getDefaultTemplate(locale: Locale = "de"): string {
  return TEMPLATES[locale] || TEMPLATES.de;
}

export const DEFAULT_TEMPLATE = TEMPLATE_DE;

export interface PlaceholderDef {
  key: string;
  labelKey: string;
}

export const PLACEHOLDERS: PlaceholderDef[] = [
  { key: "[[ADDRESS]]", labelKey: "applicationLetter.ph.address" },
  { key: "[[CITY]]", labelKey: "applicationLetter.ph.city" },
  { key: "[[NAME]]", labelKey: "applicationLetter.ph.name" },
  { key: "[[EMAIL]]", labelKey: "applicationLetter.ph.email" },
  { key: "[[PHONE]]", labelKey: "applicationLetter.ph.phone" },
  { key: "[[JOB]]", labelKey: "applicationLetter.ph.job" },
  { key: "[[INCOME]]", labelKey: "applicationLetter.ph.income" },
  { key: "[[PRICE]]", labelKey: "applicationLetter.ph.price" },
];

export interface ListingData {
  title?: string;
  city?: string;
  address?: string;
  price?: number;
}

export interface UserData {
  name?: string;
  email?: string;
  phone?: string;
  occupation?: string;
  income?: string;
}

function replaceAll(text: string, tokens: string[], value: string): string {
  for (const token of tokens) {
    text = text.replace(new RegExp(token.replace(/[[\]]/g, "\\$&"), "g"), value);
  }
  return text;
}

export function fillTemplate(template: string, listing: ListingData, user: UserData): string {
  let text = template;

  const address = listing.address || listing.title || listing.city || "—";
  const city = listing.city || "—";
  const price = listing.price ? String(listing.price) : "—";

  text = replaceAll(text, ["[[ADDRESS]]", "[[ADRESSE]]", "[[ADRES]]"], address);
  text = replaceAll(text, ["[[CITY]]", "[[STADT]]", "[[STAD]]"], city);
  text = replaceAll(text, ["[[PRICE]]", "[[PREIS]]", "[[PRIJS]]"], price);

  text = replaceAll(text, ["[[NAME]]", "[[NAAM]]"], user.name || "—");
  text = replaceAll(text, ["[[EMAIL]]"], user.email || "—");
  text = replaceAll(text, ["[[PHONE]]", "[[TELEFON]]", "[[TELEFOON]]"], user.phone || "—");
  text = replaceAll(text, ["[[JOB]]", "[[BERUF]]", "[[BEROEP]]"], user.occupation || "—");
  text = replaceAll(text, ["[[INCOME]]", "[[EINKOMMEN]]", "[[INKOMEN]]"], user.income || "—");

  return text;
}
