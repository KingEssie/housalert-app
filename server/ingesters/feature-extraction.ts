const NO_GARDEN_PATTERNS = /kein(en?)?\s*garten|ohne\s*garten|no\s*garden/i;
const GARDEN_PATTERNS = /\bgarten\b|gartennutzung|gartenmitbenutzung|gartenfläche|garden|mit\s*garten/i;

const NO_BATH_PATTERNS = /keine\s*badewanne|ohne\s*badewanne|no\s*bath(tub)?|nur\s*dusche/i;
const BATH_PATTERNS = /badewanne|bathtub|mit\s*badewanne|wanne/i;

const NO_ROOF_TERRACE_PATTERNS = /keine\s*dachterrasse|ohne\s*dachterrasse|no\s*roof\s*terrace/i;
const ROOF_TERRACE_PATTERNS = /dachterrasse|dachterasse|roof\s*terrace|rooftop\s*terrace/i;

const NO_PARKING_PATTERNS = /kein(?:en?)?\s*(?:pkw[- ]?)?(?:stell|park)platz|ohne\s*(?:pkw[- ]?)?(?:stell|park)platz|keine?\s*(?:tief)?garage(?:nstellplatz)?|ohne\s*(?:tief)?garage(?:nstellplatz)?|kein(?:en?)?\s*carport|ohne\s*carport|kein(?:en?)?\s*duplex[- ]?parker|ohne\s*duplex[- ]?parker|no\s*parking/i;
const PARKING_PATTERNS = /\bstellplatz\b|stellplätze|pkw[- ]?stellplatz|tiefgarage|tiefgaragenstellplatz|\bgarage\b|garagenstellplatz|\bparkplatz\b|parkfläche|\bcarport\b|duplex[- ]?parker|parking/i;

const ENERGY_LABEL_PATTERN = /energi?e[_\-\s]*(?:effizienz[_\-\s]*)?(?:klasse|label|rating|class|kennwert)[:\s]*([A-Ga-g][+]?)|(?:Energieklasse|Effizienzklasse|Energy\s*class|Energy\s*rating)[:\s]*([A-Ga-g][+]?)/i;
const ENERGY_LABEL_STANDALONE = /\b(?:EEK|Energielabel)\s*:?\s*([A-Ga-g][+]?)\b/i;

const PROPERTY_TYPE_MAP: Record<string, string> = {
  "wohnung": "apartment",
  "etagenwohnung": "apartment",
  "erdgeschosswohnung": "apartment",
  "dachgeschosswohnung": "apartment",
  "penthouse": "apartment",
  "loft": "apartment",
  "apartment": "apartment",
  "flat": "apartment",
  "haus": "house",
  "einfamilienhaus": "house",
  "reihenhaus": "house",
  "doppelhaushälfte": "house",
  "mehrfamilienhaus": "house",
  "house": "house",
  "villa": "house",
  "bungalow": "house",
  "studio": "studio",
  "einzimmerwohnung": "studio",
  "1-zimmer": "studio",
  "1 zimmer": "studio",
  "zimmer": "room",
  "room": "room",
  "wg-zimmer": "room",
  "wg zimmer": "room",
  "shared room": "shared",
  "wg": "shared",
  "wohngemeinschaft": "shared",
  "maisonette": "maisonette",
  "maisonettewohnung": "maisonette",
  "souterrain": "apartment",
  "einliegerwohnung": "apartment",
};

function hasExtraPositive(text: string, negPattern: RegExp, posPattern: RegExp): boolean {
  const stripped = text.replace(negPattern, "");
  return posPattern.test(stripped);
}

export function extractGarden(text: string): boolean | null {
  const hasNeg = NO_GARDEN_PATTERNS.test(text);
  const hasPos = GARDEN_PATTERNS.test(text);
  if (!hasPos && !hasNeg) return null;
  if (hasNeg) {
    return hasExtraPositive(text, NO_GARDEN_PATTERNS, GARDEN_PATTERNS) ? true : false;
  }
  return true;
}

export function extractBath(text: string): boolean | null {
  const hasNeg = NO_BATH_PATTERNS.test(text);
  const hasPos = BATH_PATTERNS.test(text);
  if (!hasPos && !hasNeg) return null;
  if (hasNeg) {
    return hasExtraPositive(text, NO_BATH_PATTERNS, BATH_PATTERNS) ? true : false;
  }
  return true;
}

export function extractRoofTerrace(text: string): boolean | null {
  const hasNeg = NO_ROOF_TERRACE_PATTERNS.test(text);
  const hasPos = ROOF_TERRACE_PATTERNS.test(text);
  if (!hasPos && !hasNeg) return null;
  if (hasNeg) {
    return hasExtraPositive(text, NO_ROOF_TERRACE_PATTERNS, ROOF_TERRACE_PATTERNS) ? true : false;
  }
  return true;
}

export function extractParking(text: string): boolean | null {
  const hasNeg = NO_PARKING_PATTERNS.test(text);
  const hasPos = PARKING_PATTERNS.test(text);
  if (!hasPos && !hasNeg) return null;
  if (hasNeg) {
    return hasExtraPositive(text, NO_PARKING_PATTERNS, PARKING_PATTERNS) ? true : false;
  }
  return true;
}

export function extractEnergyLabel(text: string): string | null {
  const m1 = text.match(ENERGY_LABEL_PATTERN);
  if (m1) {
    const raw = (m1[1] || m1[2] || "").toUpperCase();
    if (raw) return raw;
  }
  const m2 = text.match(ENERGY_LABEL_STANDALONE);
  if (m2) return m2[1].toUpperCase();
  return null;
}

export function normalizePropertyType(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  if (PROPERTY_TYPE_MAP[lower]) return PROPERTY_TYPE_MAP[lower];
  for (const [pattern, canonical] of Object.entries(PROPERTY_TYPE_MAP)) {
    if (lower.includes(pattern)) return canonical;
  }
  return null;
}

export function extractPropertyTypeFromText(text: string): string | null {
  const lower = text.toLowerCase();
  if (/\bmaisonette/i.test(lower)) return "maisonette";
  if (/\bwg[- ]?zimmer\b/i.test(lower)) return "room";
  if (/\bwohngemeinschaft\b/i.test(lower)) return "shared";
  if (/\b1[- ]?zimmer[- ]?(?:wohnung|apartment)\b/i.test(lower)) return "studio";
  if (/\bstudio\b/i.test(lower)) return "studio";
  if (/\bpenthouse\b/i.test(lower)) return "apartment";
  if (/\bloft\b/i.test(lower)) return "apartment";
  if (/\betagenwohnung\b/i.test(lower)) return "apartment";
  if (/\berdgeschoss(?:wohnung)?\b/i.test(lower)) return "apartment";
  if (/\bdachgeschoss(?:wohnung)?\b/i.test(lower)) return "apartment";
  if (/\bwohnung\b/i.test(lower)) return "apartment";
  if (/\bapartment\b/i.test(lower)) return "apartment";
  if (/\breihenhaus\b/i.test(lower)) return "house";
  if (/\beinfamilienhaus\b/i.test(lower)) return "house";
  if (/\bdoppelhaushälfte\b/i.test(lower)) return "house";
  if (/\bhaus\b/i.test(lower)) return "house";
  if (/\bzimmer\b/i.test(lower)) return "room";
  return null;
}

export const CANONICAL_PROPERTY_TYPES = ["apartment", "house", "studio", "room", "shared", "maisonette"] as const;
export type CanonicalPropertyType = typeof CANONICAL_PROPERTY_TYPES[number];
