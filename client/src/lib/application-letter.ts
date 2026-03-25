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

export function getDefaultTemplate(locale: Locale = "en"): string {
  return TEMPLATES[locale] || TEMPLATES.en;
}

export const DEFAULT_TEMPLATE = TEMPLATE_EN;

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
  const income = data.grossIncome ? `€${data.grossIncome.toLocaleString("de-DE")}` : "";

  if (locale === "de") return generateLetterDE(data, name, income);
  if (locale === "nl") return generateLetterNL(data, name, income);
  return generateLetterEN(data, name, income);
}

const LIVING_DE: Record<string, string> = {
  alone: "Ich werde allein einziehen",
  partner: "Ich werde mit meinem/r Partner/in einziehen",
  partner_kids: "Ich werde mit meinem/r Partner/in und Kind(ern) einziehen",
  kids: "Ich werde mit meinem/meinen Kind(ern) einziehen",
  roommates: "Ich werde mit Mitbewohner/innen einziehen",
  family: "Ich werde mit meiner Familie einziehen",
};
const WORK_DE: Record<string, string> = {
  employed: "Ich bin in einem festen Arbeitsverhältnis",
  self_employed: "Ich bin selbstständig tätig",
  student: "Ich bin Student/in",
  expat: "Ich bin als Expat in Deutschland",
  benefits: "Ich beziehe derzeit Sozialleistungen",
};
const REASON_DE: Record<string, string> = {
  work_study: "Der Grund für meinen Umzug ist beruflich bzw. studienbedingt",
  first_together: "Mein/e Partner/in und ich möchten zum ersten Mal zusammenziehen",
  family_growth: "Wir erwarten Familienzuwachs und benötigen mehr Platz",
  breakup: "Aufgrund einer Trennung suche ich eine neue Wohnung",
  first_own: "Ich suche meine erste eigene Wohnung",
  bigger: "Ich suche eine größere Wohnung",
  cheaper: "Ich suche eine günstigere Wohnung",
  new_area: "Ich möchte in eine neue Gegend ziehen",
  specific_needs: "Ich suche eine Wohnung mit bestimmten Anforderungen",
  energy_efficient: "Ich suche eine energieeffizientere Wohnung",
};

function generateLetterDE(d: OnboardingLetterData, name: string, income: string): string {
  const sal = d.gender === "male" ? "Sehr geehrter Herr" : d.gender === "female" ? "Sehr geehrte Frau" : "Sehr geehrte/r Vermieter/in";
  const p: string[] = [`${sal},`, "", `mit großem Interesse habe ich Ihre Wohnung an [[ADRESSE]] gesehen und möchte mich gerne als Mietinteressent/in vorstellen.`, "", `Mein Name ist ${name}.`];
  if (d.livingWith && LIVING_DE[d.livingWith]) p.push(LIVING_DE[d.livingWith] + ".");
  if (d.workStatus && WORK_DE[d.workStatus]) {
    p.push(income ? `${WORK_DE[d.workStatus]} mit einem monatlichen Bruttoeinkommen von ${income}.` : `${WORK_DE[d.workStatus]}.`);
  } else if (income) p.push(`Mein monatliches Bruttoeinkommen beträgt ${income}.`);
  if (d.petsCount !== undefined && d.petsCount > 0) p.push(d.petsCount === 1 ? "Ich bringe ein Haustier mit." : `Ich bringe ${d.petsCount} Haustiere mit.`);
  else if (d.petsCount === 0) p.push("Ich habe keine Haustiere.");
  if (d.moveReason && REASON_DE[d.moveReason]) p.push(REASON_DE[d.moveReason] + ".");
  p.push("", "Alle erforderlichen Unterlagen wie SCHUFA-Auskunft, Einkommensnachweise und Referenzen kann ich kurzfristig bereitstellen.", "", "Gerne würde ich einen Besichtigungstermin vereinbaren. Sie erreichen mich unter:");
  if (d.phone) p.push(`- Telefon: ${d.phone}`);
  if (d.email) p.push(`- E-Mail: ${d.email}`);
  p.push("", "Ich freue mich auf Ihre Rückmeldung.", "", "Mit freundlichen Grüßen,", name);
  return p.join("\n");
}

function generateLetterNL(d: OnboardingLetterData, name: string, income: string): string {
  const livNL: Record<string, string> = { alone: "Ik ga alleen wonen", partner: "Ik ga samenwonen met mijn partner", partner_kids: "Ik ga samenwonen met mijn partner en kind(eren)", kids: "Ik ga wonen met mijn kind(eren)", roommates: "Ik ga wonen met huisgenoten", family: "Ik ga wonen met mijn familie" };
  const workNL: Record<string, string> = { employed: "Ik ben in loondienst", self_employed: "Ik ben zelfstandig ondernemer", student: "Ik ben student", expat: "Ik ben expat", benefits: "Ik ben uitkeringsgerechtigde" };
  const reasonNL: Record<string, string> = { work_study: "De reden voor mijn verhuizing is werk of studie", first_together: "Mijn partner en ik gaan voor het eerst samenwonen", family_growth: "Vanwege gezinsuitbreiding zoek ik meer ruimte", breakup: "Door een relatiebreuk zoek ik een nieuwe woning", first_own: "Ik zoek mijn eerste eigen woning", bigger: "Ik wil graag groter wonen", cheaper: "Ik zoek een goedkopere woning", new_area: "Ik wil verhuizen naar een andere plaats", specific_needs: "Ik zoek een woning met specifieke woonwensen", energy_efficient: "Ik zoek een energiezuinigere woning" };
  const p: string[] = ["Geachte verhuurder,", "", `Met grote interesse heb ik uw woning aan [[ADRES]] gezien en stel ik mij graag voor als huurkandidaat.`, "", `Mijn naam is ${name}.`];
  if (d.livingWith && livNL[d.livingWith]) p.push(livNL[d.livingWith] + ".");
  if (d.workStatus && workNL[d.workStatus]) p.push(income ? `${workNL[d.workStatus]} met een bruto maandinkomen van ${income}.` : `${workNL[d.workStatus]}.`);
  else if (income) p.push(`Mijn bruto maandinkomen bedraagt ${income}.`);
  if (d.petsCount !== undefined && d.petsCount > 0) p.push(d.petsCount === 1 ? "Ik neem één huisdier mee." : `Ik neem ${d.petsCount} huisdieren mee.`);
  else if (d.petsCount === 0) p.push("Ik heb geen huisdieren.");
  if (d.moveReason && reasonNL[d.moveReason]) p.push(reasonNL[d.moveReason] + ".");
  p.push("", "Alle benodigde documenten kan ik op korte termijn aanleveren.", "", "Graag zou ik een bezichtiging willen inplannen. U kunt mij bereiken via:");
  if (d.phone) p.push(`- Telefoon: ${d.phone}`);
  if (d.email) p.push(`- E-mail: ${d.email}`);
  p.push("", "Ik kijk uit naar uw reactie.", "", "Met vriendelijke groet,", name);
  return p.join("\n");
}

function generateLetterEN(d: OnboardingLetterData, name: string, income: string): string {
  const livEN: Record<string, string> = { alone: "I will be living alone", partner: "I will be moving in with my partner", partner_kids: "I will be moving in with my partner and child(ren)", kids: "I will be moving in with my child(ren)", roommates: "I will be moving in with roommates", family: "I will be moving in with my family" };
  const workEN: Record<string, string> = { employed: "I am employed full-time", self_employed: "I am self-employed", student: "I am a student", expat: "I am an expat", benefits: "I currently receive social benefits" };
  const reasonEN: Record<string, string> = { work_study: "I am moving for work or study", first_together: "My partner and I are moving in together for the first time", family_growth: "We need more space for our growing family", breakup: "Due to a separation, I am looking for a new home", first_own: "I am looking for my first own apartment", bigger: "I am looking for a larger apartment", cheaper: "I am looking for a more affordable apartment", new_area: "I would like to move to a new area", specific_needs: "I have specific housing requirements", energy_efficient: "I am looking for a more energy-efficient home" };
  const p: string[] = ["Dear Sir/Madam,", "", `I am writing to express my interest in the apartment at [[ADDRESS]] and would like to introduce myself.`, "", `My name is ${name}.`];
  if (d.livingWith && livEN[d.livingWith]) p.push(livEN[d.livingWith] + ".");
  if (d.workStatus && workEN[d.workStatus]) p.push(income ? `${workEN[d.workStatus]} with a gross monthly income of ${income}.` : `${workEN[d.workStatus]}.`);
  else if (income) p.push(`My gross monthly income is ${income}.`);
  if (d.petsCount !== undefined && d.petsCount > 0) p.push(d.petsCount === 1 ? "I have one pet." : `I have ${d.petsCount} pets.`);
  else if (d.petsCount === 0) p.push("I have no pets.");
  if (d.moveReason && reasonEN[d.moveReason]) p.push(reasonEN[d.moveReason] + ".");
  p.push("", "I can provide all required documents at short notice.", "", "I would love to schedule a viewing. You can reach me at:");
  if (d.phone) p.push(`- Phone: ${d.phone}`);
  if (d.email) p.push(`- Email: ${d.email}`);
  p.push("", "I look forward to hearing from you.", "", "Kind regards,", name);
  return p.join("\n");
}
