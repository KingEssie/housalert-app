/**
 * Shared display-title utility — used by both backend (email/push/API) and frontend.
 *
 * Subscription-based visibility rules:
 *   hasActiveSubscription = true  → show full street with house number
 *   hasActiveSubscription = false → show street name only (strip house number)
 *
 * Fallback chain (both tiers):
 *   1. street (with or without number, depending on subscription)
 *   2. district + ", " + city
 *   3. "Woning in " + city
 *
 * Examples (non-subscriber):
 *   "Mainzer Landstraße 12"      → "Mainzer Landstraße"
 *   "Berliner Straße 45A"        → "Berliner Straße"
 *   "Kantstr. 8, 10623 Berlin"   → "Kantstr."
 *   "Am Park 3-5"                → "Am Park"
 *
 * Examples (active subscriber):
 *   "Mainzer Landstraße 12"      → "Mainzer Landstraße 12"
 *   "Kantstr. 8, 10623 Berlin"   → "Kantstr. 8"
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

/** Strip only the postcode/city remainder, keeping the house number intact. */
export function stripPostcodeSuffix(street: string): string {
  return street.replace(/,\s*\d{4,5}.*$/, "").trim();
}

export interface DisplayTitleFields {
  street?: string | null;
  district?: string | null;
  city: string;
}

/**
 * Returns the display title for a listing.
 * @param listing  Fields needed to compute the title.
 * @param hasActiveSubscription  When true, the full street (with house number) is shown.
 *                               When false (default), the house number is stripped.
 */
export function getDisplayTitle(
  listing: DisplayTitleFields,
  hasActiveSubscription = false
): string {
  if (listing.street) {
    if (hasActiveSubscription) {
      const full = stripPostcodeSuffix(listing.street);
      if (full) return full;
    } else {
      const stripped = stripHouseNumber(listing.street);
      if (stripped) return stripped;
    }
  }
  if (listing.district) {
    return `${listing.district}, ${listing.city}`;
  }
  return `Woning in ${listing.city}`;
}
