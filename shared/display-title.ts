/**
 * Shared display-title utility — used by both backend (email/push/API) and frontend.
 *
 * Rules (per spec):
 *   1. If the listing has a street, strip the house number → street name only.
 *   2. If no street but district exists → "{district}, {city}".
 *   3. Otherwise → "Woning in {city}".
 *
 * Examples:
 *   "Mainzer Landstraße 12"      → "Mainzer Landstraße"
 *   "Berliner Straße 45A"        → "Berliner Straße"
 *   "Kantstr. 8, 10623 Berlin"   → "Kantstr."
 *   "Am Park 3-5"                → "Am Park"
 *   "Schillerstraße 12a-14b"     → "Schillerstraße"
 */

export function stripHouseNumber(street: string): string {
  return (
    street
      // Remove ", postcode remainder" — "Kantstr. 8, 10623 Berlin" → "Kantstr. 8"
      .replace(/,\s*\d{4,5}.*$/, "")
      // Remove trailing house number (with optional letter suffix and/or range):
      //   " 12"  " 45A"  " 3-5"  " 12a-14b"  " 12 b"
      .replace(/\s+\d+[a-zA-Z]?(?:\s*[-–]\s*\d+[a-zA-Z]?)?[,\s]*$/, "")
      .trim()
  );
}

export interface DisplayTitleFields {
  street?: string | null;
  district?: string | null;
  city: string;
}

export function getDisplayTitle(listing: DisplayTitleFields): string {
  if (listing.street) {
    const stripped = stripHouseNumber(listing.street);
    if (stripped) return stripped;
  }
  if (listing.district) {
    return `${listing.district}, ${listing.city}`;
  }
  return `Woning in ${listing.city}`;
}
