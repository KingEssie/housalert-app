import type { Locale } from "@/i18n";

const TEMPLATE_DE = `Sehr geehrte/r Vermieter/in,

mit großem Interesse habe ich Ihre Wohnung an [ADRES] gesehen. Gerne stelle ich mich als potenzieller Mieter vor.

Mein Name ist [[NAME]] und ich bin als [[JOB]] tätig. Mein monatliches Nettoeinkommen beträgt €[[INCOME]]. Die Miete von €[[PRICE]] pro Monat passt gut in mein Budget.

Ich suche eine angenehme, langfristige Wohnsituation und pflege meine Wohnung sorgfältig. Alle erforderlichen Unterlagen wie SCHUFA-Auskunft, Einkommensnachweise und Referenzen kann ich kurzfristig bereitstellen.

Gerne würde ich einen Besichtigungstermin vereinbaren. Sie erreichen mich unter:
- E-Mail: [[EMAIL]]
- Telefon: [[PHONE]]

Ich freue mich auf Ihre Rückmeldung.

Mit freundlichen Grüßen,
[[NAME]]`;

const TEMPLATE_EN = `Dear Sir/Madam,

I am writing to express my interest in the apartment at [ADRES]. I would like to introduce myself as a potential tenant.

My name is [[NAME]] and I work as a [[JOB]]. My monthly net income is €[[INCOME]]. The rent of €[[PRICE]] per month fits well within my budget.

I am looking for a pleasant, long-term living situation and take good care of my home. I can provide all required documents such as proof of income, employment contract and references at short notice.

I would love to schedule a viewing. You can reach me at:
- Email: [[EMAIL]]
- Phone: [[PHONE]]

I look forward to hearing from you.

Kind regards,
[[NAME]]`;

const TEMPLATE_NL = `Geachte verhuurder,

Met grote interesse heb ik uw woning aan [ADRES] gezien. Graag stel ik mij voor als potentiële huurder.

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

export function getDefaultTemplate(locale: Locale = "en"): string {
  return TEMPLATES[locale] || TEMPLATES.en;
}

export const DEFAULT_TEMPLATE = TEMPLATE_EN;

export interface PlaceholderDef {
  key: string;
  labelKey: string;
}

export const PLACEHOLDERS: PlaceholderDef[] = [
  { key: "[ADRES]", labelKey: "applicationLetter.ph.address" },
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

  text = replaceAll(text, ["[ADRES]", "[[ADDRESS]]", "[[ADRESSE]]", "[[ADRES]]", "[ADDRESS]", "[ADRESSE]"], address);
  text = replaceAll(text, ["[[CITY]]", "[[STADT]]", "[[STAD]]", "[CITY]", "[STADT]", "[STAD]"], city);
  text = replaceAll(text, ["[[PRICE]]", "[[PREIS]]", "[[PRIJS]]"], price);

  text = replaceAll(text, ["[[NAME]]", "[[NAAM]]"], user.name || "—");
  text = replaceAll(text, ["[[EMAIL]]"], user.email || "—");
  text = replaceAll(text, ["[[PHONE]]", "[[TELEFON]]", "[[TELEFOON]]"], user.phone || "—");
  text = replaceAll(text, ["[[JOB]]", "[[BERUF]]", "[[BEROEP]]"], user.occupation || "—");
  text = replaceAll(text, ["[[INCOME]]", "[[EINKOMMEN]]", "[[INKOMEN]]"], user.income || "—");

  return text;
}

export interface OnboardingLetterData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  gender?: string;
  livingWith?: string;
  workStatus?: string;
  moveReason?: string;
  grossIncome?: number;
  petsCount?: number;
}

export function generateOnboardingLetter(data: OnboardingLetterData, locale: Locale = "de"): string {
  const name = [data.firstName, data.lastName].filter(Boolean).join(" ") || "—";
  const localeTag = locale === "de" ? "de-DE" : locale === "nl" ? "nl-NL" : "en-US";
  const income = data.grossIncome ? `€${data.grossIncome.toLocaleString(localeTag)}` : "";

  if (locale === "de") return generateLetterDE(data, name, income);
  if (locale === "nl") return generateLetterNL(data, name, income);
  return generateLetterEN(data, name, income);
}

const LIVING_DE: Record<string, string> = {
  alone: "allein einziehen",
  partner: "gemeinsam mit meinem/r Partner/in einziehen",
  partner_kids: "zusammen mit meinem/r Partner/in und Kind(ern) einziehen",
  kids: "mit meinem/meinen Kind(ern) einziehen",
  roommates: "mit Mitbewohner/innen einziehen",
  family: "mit meiner Familie einziehen",
};
const WORK_DE: Record<string, string> = {
  employed: "in einem festen Arbeitsverhältnis",
  self_employed: "selbstständig tätig",
  student: "Student/in",
  expat: "als Expat in Deutschland",
  benefits: "derzeit Empfänger/in von Sozialleistungen",
};
const REASON_DE: Record<string, string> = {
  work_study: "beruflichen bzw. studienbedingten Gründen",
  first_together: "dem Wunsch, zum ersten Mal mit meinem/r Partner/in zusammenzuziehen",
  family_growth: "Familienzuwachs und dem Bedarf an mehr Platz",
  breakup: "einer Trennung",
  first_own: "dem Wunsch, meine erste eigene Wohnung zu finden",
  bigger: "dem Bedarf an einer größeren Wohnung",
  cheaper: "der Suche nach einer günstigeren Wohnung",
  new_area: "dem Wunsch, in eine neue Gegend zu ziehen",
  specific_needs: "bestimmten Wohnanforderungen",
  energy_efficient: "der Suche nach einer energieeffizienteren Wohnung",
};

function generateLetterDE(d: OnboardingLetterData, name: string, income: string): string {
  const sal = d.gender === "male" ? "Sehr geehrter Herr" : d.gender === "female" ? "Sehr geehrte Frau" : "Sehr geehrte/r Vermieter/in";

  let intro = `${sal},\n\nmit großem Interesse habe ich Ihre Wohnung an [ADRES] gesehen und möchte mich gerne als Mietinteressent/in vorstellen.\n\nMein Name ist ${name}`;

  if (d.livingWith && LIVING_DE[d.livingWith]) {
    intro += ` und ich möchte ${LIVING_DE[d.livingWith]}`;
  }
  intro += ".";

  let middle = "";
  if (d.workStatus && WORK_DE[d.workStatus]) {
    middle = `Beruflich bin ich ${WORK_DE[d.workStatus]}`;
    if (income) middle += ` mit einem monatlichen Bruttoeinkommen von ${income}`;
    middle += ".";
  } else if (income) {
    middle = `Mein monatliches Bruttoeinkommen beträgt ${income}.`;
  }

  if (d.petsCount !== undefined && d.petsCount > 0) {
    middle += ` Ich bringe ${d.petsCount === 1 ? "ein Haustier" : `${d.petsCount} Haustiere`} mit.`;
  } else if (d.petsCount === 0) {
    middle += " Haustiere habe ich keine.";
  }

  if (d.moveReason && REASON_DE[d.moveReason]) {
    middle += ` Ich suche eine neue Wohnung aufgrund von ${REASON_DE[d.moveReason]}.`;
  }

  let closing = "Alle erforderlichen Unterlagen wie SCHUFA-Auskunft, Einkommensnachweise und Referenzen kann ich kurzfristig bereitstellen.";
  closing += "\n\nGerne würde ich einen Besichtigungstermin vereinbaren. Sie erreichen mich unter:";
  if (d.phone) closing += `\n- Telefon: ${d.phone}`;
  if (d.email) closing += `\n- E-Mail: ${d.email}`;
  closing += "\n\nIch freue mich auf Ihre Rückmeldung.\n\nMit freundlichen Grüßen,\n" + name;

  return [intro, middle, closing].filter(Boolean).join("\n\n");
}

function generateLetterNL(d: OnboardingLetterData, name: string, income: string): string {
  const livNL: Record<string, string> = {
    alone: "op mezelf",
    partner: "samen met mijn partner",
    partner_children: "samen met mijn partner en kind(eren)",
    children: "samen met mijn kind(eren)",
    friend: "samen met een huisgenoot",
    family: "samen met mijn familie",
    other: "met anderen",
  };
  const workNL: Record<string, string> = {
    employed: "in loondienst werkzaam",
    self_employed: "zelfstandig ondernemer",
    student: "student",
    retired: "gepensioneerd",
    unemployed: "momenteel op zoek naar werk",
    other: "werkzaam",
  };
  const reasonNL: Record<string, string> = {
    job_change: "een nieuwe baan of functiewijziging",
    study: "mijn studie",
    relationship: "een verandering in mijn persoonlijke situatie",
    larger_home: "de behoefte aan meer ruimte",
    smaller_home: "de zoektocht naar een praktischere woning",
    cheaper: "de wens om mijn woonlasten te verlagen",
    neighborhood: "de wens om in een andere buurt te wonen",
    other: "persoonlijke redenen",
  };

  const paragraphs: string[] = [];

  paragraphs.push(`Geachte verhuurder,\n\nMet veel interesse heb ik uw woning aan [ADRES] bekeken en wil ik mij graag voorstellen als huurkandidaat.`);

  const who: string[] = [];
  who.push(`Mijn naam is ${name}`);

  const livingStr = d.livingWith && livNL[d.livingWith] ? livNL[d.livingWith] : null;
  const workStr = d.workStatus && workNL[d.workStatus] ? workNL[d.workStatus] : null;

  if (livingStr) who.push(`en ik zoek een woning voor ${livingStr}`);
  const introLine = who.join(" ") + ".";

  const workLines: string[] = [];
  if (workStr) {
    let line = `Beroepsmatig ben ik ${workStr}`;
    if (income) line += `, met een bruto maandinkomen van ${income}`;
    workLines.push(line + ".");
  } else if (income) {
    workLines.push(`Mijn bruto maandinkomen bedraagt ${income}.`);
  }

  const midParts = [introLine, ...workLines].filter(Boolean);
  if (midParts.length > 0) paragraphs.push(midParts.join(" "));

  const contextLines: string[] = [];
  if (d.moveReason && reasonNL[d.moveReason]) {
    contextLines.push(`De aanleiding voor mijn verhuizing is ${reasonNL[d.moveReason]}.`);
  }
  if (d.petsCount !== undefined && d.petsCount > 0) {
    contextLines.push(`Ik breng ${d.petsCount === 1 ? "één huisdier" : `${d.petsCount} huisdieren`} mee.`);
  } else if (d.petsCount === 0) {
    contextLines.push("Ik heb geen huisdieren.");
  }
  if (contextLines.length > 0) paragraphs.push(contextLines.join(" "));

  const contactParts: string[] = [];
  if (d.phone) contactParts.push(`telefonisch op ${d.phone}`);
  if (d.email) contactParts.push(`per e-mail via ${d.email}`);
  const contactStr = contactParts.length > 0 ? ` U kunt mij bereiken ${contactParts.join(" of ")}.` : "";

  paragraphs.push(`Alle benodigde documenten, zoals inkomensbewijzen en een werkgeversverklaring, kan ik op korte termijn aanleveren. Graag zou ik een bezichtiging willen inplannen.${contactStr}`);

  paragraphs.push(`Ik kijk uit naar uw reactie.\n\nMet vriendelijke groet,\n${name}`);

  return paragraphs.join("\n\n");
}

function generateLetterEN(d: OnboardingLetterData, name: string, income: string): string {
  const livEN: Record<string, string> = { alone: "living on my own", partner: "moving in with my partner", partner_kids: "moving in with my partner and child(ren)", kids: "moving in with my child(ren)", roommates: "moving in with roommates", family: "moving in with my family" };
  const workEN: Record<string, string> = { employed: "employed full-time", self_employed: "self-employed", student: "a student", expat: "an expat", benefits: "currently receiving social benefits" };
  const reasonEN: Record<string, string> = { work_study: "work or study", first_together: "moving in with my partner for the first time", family_growth: "a growing family", breakup: "a change in my personal situation", first_own: "looking for my first apartment", bigger: "the need for a larger space", cheaper: "looking for a more affordable home", new_area: "wanting to move to a new area", specific_needs: "specific housing requirements", energy_efficient: "looking for a more energy-efficient home" };

  let intro = `Dear Sir/Madam,\n\nI am writing to express my interest in the apartment at [ADRES] and would like to introduce myself.\n\nMy name is ${name}`;
  if (d.livingWith && livEN[d.livingWith]) {
    intro += ` and I will be ${livEN[d.livingWith]}`;
  }
  intro += ".";

  let middle = "";
  if (d.workStatus && workEN[d.workStatus]) {
    middle = `I am ${workEN[d.workStatus]}`;
    if (income) middle += ` with a gross monthly income of ${income}`;
    middle += ".";
  } else if (income) {
    middle = `My gross monthly income is ${income}.`;
  }

  if (d.petsCount !== undefined && d.petsCount > 0) {
    middle += ` I have ${d.petsCount === 1 ? "one pet" : `${d.petsCount} pets`}.`;
  } else if (d.petsCount === 0) {
    middle += " I have no pets.";
  }

  if (d.moveReason && reasonEN[d.moveReason]) {
    middle += ` I am relocating due to ${reasonEN[d.moveReason]}.`;
  }

  let closing = "I can provide all required documents at short notice.";
  closing += "\n\nI would love to schedule a viewing. You can reach me at:";
  if (d.phone) closing += `\n- Phone: ${d.phone}`;
  if (d.email) closing += `\n- Email: ${d.email}`;
  closing += "\n\nI look forward to hearing from you.\n\nKind regards,\n" + name;

  return [intro, middle, closing].filter(Boolean).join("\n\n");
}
