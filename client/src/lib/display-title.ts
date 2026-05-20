export function stripHouseNumber(street: string): string {
  return (
    street
      .replace(/,\s*\d{4,5}.*$/, "")
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
