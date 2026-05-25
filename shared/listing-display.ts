/**
 * Irish listing display normalizer.
 *
 * Priority chain for display title:
 *   1. street field  — already normalised at ingest time; strip leading house number
 *   2. title field   — strip unit prefix, leading house number, trailing city/postcode,
 *                      then remove known district-only suffixes
 *   3. district      — fallback when title gives nothing useful
 *   4. city          — last resort
 *
 * Examples (title → result):
 *   "138 Southmede, Ballinteer Road, Dundrum"  →  "Southmede, Ballinteer Road"
 *   "18 Newmarket Square, Dublin 8"            →  "Newmarket Square"
 *   "Apartment 68 The Plaza Shangan Road, Dublin"  →  "The Plaza Shangan Road"
 *   "Stanford Green, Crumlin, Dublin 12"       →  "Stanford Green"
 *   "Mary Street"                              →  "Mary Street"
 *   "The Rise, Mount Merrion"                  →  "The Rise"
 *   "Dublin 24, Dublin"                        →  "Dublin 24"  (graceful fallback)
 */

export interface IrishDisplayFields {
  title?: string | null;
  street?: string | null;
  district?: string | null;
  city: string;
}

/** Trailing ", Dublin 8" / ", Cork" / ", D08 A1B2" / ", Co. Dublin" etc. */
const TRAILING_CITY_RE =
  /,\s*(?:D\d{2}[A-Z\d]*|Dublin\s*\d*|Cork(?:\s+City)?|Galway(?:\s+City)?|Limerick(?:\s+City)?|Waterford(?:\s+City)?|Drogheda|Dundalk|Swords|Bray|Kilkenny|Co\.?\s*\w+)\s*[.,]?\s*$/i;

/**
 * Known suburb/district names that add no value as standalone title segments.
 * Listed as full-word matches — "Crumlin Road" will NOT match (contains more).
 */
const DISTRICT_ONLY_RE =
  /^(crumlin|ballymun|clondalkin|tallaght|finglas|blanchardstown|drumcondra|rathmines|terenure|rathfarnham|dundrum|stillorgan|blackrock|monkstown|dún laoghaire|dun laoghaire|sandymount|ringsend|docklands|ballsbridge|donnybrook|ranelagh|harold'?s cross|dolphin'?s barn|inchicore|kilmainham|smithfield|stoneybatter|phibsborough|cabra|glasnevin|whitehall|santry|coolock|artane|clontarf|raheny|kilbarrack|portmarnock|malahide|lucan|clonee|ongar|mulhuddart|mount merrion|foxrock|cabinteely|shankill|cherrywood|sandyford|leopardstown|rathcoole|saggart|citywest|bray|greystones|baldoyle|howth|sutton|castleknock|palmerstown|walkinstown|kimmage|drimnagh|chapelizod|islandbridge)$/i;

function stripLeadingUnit(s: string): string {
  // "Apartment 68 …" / "Apt. 4B …" / "Unit 2 …" / "Flat 3 …" / "No. 5 …" / "Studio 1 …"
  s = s.replace(/^(apartment|apt\.?|unit|flat|no\.?|studio)\s+[\w-]+\s+/i, "");
  // Leading house number: "138 " / "18A " / "12-14 " / "18a-20b "
  s = s.replace(/^\d+[a-zA-Z]?(?:\s*[-–]\s*\d+[a-zA-Z]?)?\s+/, "");
  return s.trim();
}

/**
 * Returns the best display title for an Irish rental listing.
 * Safe to call from both the frontend and the backend (pure function, no side-effects).
 */
export function getIrishDisplayTitle(listing: IrishDisplayFields): string {
  const city = (listing.city || "Dublin").trim();

  /* ── 1. Street field (preferred — already normalised by ingest pipeline) ── */
  if (listing.street) {
    const s = listing.street.trim();
    if (s && s.toLowerCase() !== city.toLowerCase()) {
      const stripped = stripLeadingUnit(s);
      return stripped || s;
    }
  }

  /* ── 2. Raw title ──────────────────────────────────────────────────────── */
  if (listing.title) {
    let t = listing.title.trim();

    // Strip unit/flat/apt prefix + leading house number
    t = stripLeadingUnit(t);

    // Strip trailing ", Dublin 8" / ", Cork" / ", D08 XXXX" etc.
    t = t.replace(TRAILING_CITY_RE, "").trim();

    // Strip trailing dot
    t = t.replace(/\.$/, "").trim();

    if (t && t.toLowerCase() !== city.toLowerCase()) {
      const parts = t.split(",").map((p) => p.trim()).filter(Boolean);

      if (parts.length >= 2) {
        // Remove trailing segments that are bare district names
        while (parts.length > 1 && DISTRICT_ONLY_RE.test(parts[parts.length - 1])) {
          parts.pop();
        }
        // Keep at most 2 parts to avoid overly long compound titles
        const joined = parts.slice(0, 2).join(", ");
        if (joined && joined.toLowerCase() !== city.toLowerCase()) return joined;
      }

      return t;
    }
  }

  /* ── 3. District fallback ──────────────────────────────────────────────── */
  if (listing.district) {
    const d = listing.district.trim();
    if (d && d.toLowerCase() !== city.toLowerCase()) return d;
  }

  /* ── 4. City (last resort) ─────────────────────────────────────────────── */
  return city;
}
