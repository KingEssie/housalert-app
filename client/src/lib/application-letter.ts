export const DEFAULT_TEMPLATE = `Sehr geehrte/r Vermieter/in,

mit großem Interesse habe ich Ihre Wohnung an [[ADRESSE]] in [[STADT]] gesehen. Gerne stelle ich mich als potenzieller Mieter vor.

Mein Name ist [[NAME]] und ich bin als [[BERUF]] tätig. Mein monatliches Nettoeinkommen beträgt €[[EINKOMMEN]]. Die Miete von €[[PREIS]] pro Monat passt gut in mein Budget.

Ich suche eine angenehme, langfristige Wohnsituation und pflege meine Wohnung sorgfältig. Alle erforderlichen Unterlagen wie SCHUFA-Auskunft, Einkommensnachweise und Referenzen kann ich kurzfristig bereitstellen.

Gerne würde ich einen Besichtigungstermin vereinbaren. Sie erreichen mich unter:
- E-Mail: [[EMAIL]]
- Telefon: [[TELEFON]]

Ich freue mich auf Ihre Rückmeldung.

Mit freundlichen Grüßen,
[[NAME]]`;

export const PLACEHOLDERS = [
  { key: "[[ADRESSE]]", label: "Adresse oder Titel der Wohnung" },
  { key: "[[STADT]]", label: "Stadt" },
  { key: "[[NAME]]", label: "Dein vollständiger Name" },
  { key: "[[EMAIL]]", label: "Deine E-Mail-Adresse" },
  { key: "[[TELEFON]]", label: "Deine Telefonnummer" },
  { key: "[[BERUF]]", label: "Dein Beruf" },
  { key: "[[EINKOMMEN]]", label: "Dein monatliches Einkommen" },
  { key: "[[PREIS]]", label: "Mietpreis der Wohnung" },
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

export function fillTemplate(template: string, listing: ListingData, user: UserData): string {
  let text = template;

  const address = listing.address || listing.title || `diese Wohnung in ${listing.city || "[Stadt]"}`;
  const city = listing.city || "[Stadt]";
  const price = listing.price ? String(listing.price) : "[Preis]";

  text = text.replace(/\[\[ADRESSE\]\]/g, address);
  text = text.replace(/\[\[ADRES\]\]/g, address);
  text = text.replace(/\[\[STADT\]\]/g, city);
  text = text.replace(/\[\[STAD\]\]/g, city);
  text = text.replace(/\[\[PREIS\]\]/g, price);
  text = text.replace(/\[\[PRIJS\]\]/g, price);

  text = text.replace(/\[\[NAME\]\]/g, user.name || "[dein Name]");
  text = text.replace(/\[\[NAAM\]\]/g, user.name || "[dein Name]");
  text = text.replace(/\[\[EMAIL\]\]/g, user.email || "[deine E-Mail]");
  text = text.replace(/\[\[TELEFON\]\]/g, user.phone || "[deine Telefonnummer]");
  text = text.replace(/\[\[TELEFOON\]\]/g, user.phone || "[deine Telefonnummer]");
  text = text.replace(/\[\[BERUF\]\]/g, user.occupation || "[dein Beruf]");
  text = text.replace(/\[\[BEROEP\]\]/g, user.occupation || "[dein Beruf]");
  text = text.replace(/\[\[EINKOMMEN\]\]/g, user.income || "[dein Einkommen]");
  text = text.replace(/\[\[INKOMEN\]\]/g, user.income || "[dein Einkommen]");

  return text;
}
