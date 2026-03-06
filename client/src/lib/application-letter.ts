export const DEFAULT_TEMPLATE = `Geachte verhuurder,

Met veel interesse heb ik uw woning aan [[ADRES]] in [[STAD]] gezien. Graag stel ik mij voor als potentiële huurder.

Mijn naam is [[NAAM]] en ik ben werkzaam als [[BEROEP]]. Mijn maandelijks inkomen bedraagt €[[INKOMEN]] netto. De huurprijs van €[[PRIJS]] per maand past goed binnen mijn budget.

Ik ben op zoek naar een prettige, duurzame woonsituatie en zorg goed voor mijn woning. Alle benodigde documenten zoals SCHUFA, inkomensbewijzen en referenties kan ik op korte termijn aanleveren.

Graag zou ik een bezichtiging plannen. U kunt mij bereiken via:
- E-mail: [[EMAIL]]
- Telefoon: [[TELEFOON]]

Ik kijk ernaar uit om van u te horen.

Met vriendelijke groet,
[[NAAM]]`;

export const PLACEHOLDERS = [
  { key: "[[ADRES]]", label: "Adres of titel van de woning" },
  { key: "[[STAD]]", label: "Stad" },
  { key: "[[NAAM]]", label: "Je volledige naam" },
  { key: "[[EMAIL]]", label: "Je e-mailadres" },
  { key: "[[TELEFOON]]", label: "Je telefoonnummer" },
  { key: "[[BEROEP]]", label: "Je beroep" },
  { key: "[[INKOMEN]]", label: "Je maandelijks inkomen" },
  { key: "[[PRIJS]]", label: "Huurprijs van de woning" },
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

  const address = listing.address || listing.title || `deze woning in ${listing.city || "[stad]"}`;
  const city = listing.city || "[stad]";
  const price = listing.price ? String(listing.price) : "[prijs]";

  text = text.replace(/\[\[ADRES\]\]/g, address);
  text = text.replace(/\[\[STAD\]\]/g, city);
  text = text.replace(/\[\[PRIJS\]\]/g, price);

  text = text.replace(/\[\[NAAM\]\]/g, user.name || "[je naam]");
  text = text.replace(/\[\[EMAIL\]\]/g, user.email || "[je e-mail]");
  text = text.replace(/\[\[TELEFOON\]\]/g, user.phone || "[je telefoonnummer]");
  text = text.replace(/\[\[BEROEP\]\]/g, user.occupation || "[je beroep]");
  text = text.replace(/\[\[INKOMEN\]\]/g, user.income || "[je inkomen]");

  return text;
}
