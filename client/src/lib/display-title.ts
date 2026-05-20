/**
 * Frontend copy of the shared display-title utility.
 * Keep in sync with shared/display-title.ts.
 *
 * The frontend primarily uses the server-computed display_title field from API
 * responses. This module is available for cases where client-side computation
 * is needed (e.g., optimistic updates or components that bypass the API).
 */

export function stripHouseNumber(street: string): string {
  return (
    street
      .replace(/,\s*\d{4,5}.*$/, "")
      .replace(/\s+\d+[a-zA-Z]?(?:\s*[-–]\s*\d+[a-zA-Z]?)?[,\s]*$/, "")
      .trim()
  );
}

export function stripPostcodeSuffix(street: string): string {
  return street.replace(/,\s*\d{4,5}.*$/, "").trim();
}

export interface DisplayTitleFields {
  street?: string | null;
  district?: string | null;
  city: string;
}

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
