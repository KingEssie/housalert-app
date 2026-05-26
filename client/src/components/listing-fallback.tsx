export const LISTING_IMAGE_FALLBACK = "/assets/listing-fallback-house.png";

interface ListingFallbackProps {
  title?: string;
  source?: string;
  city?: string;
  size?: "full" | "compact" | "mini" | "hero";
}

export function ListingFallback({ size = "full" }: ListingFallbackProps) {
  return (
    <div
      className="w-full h-full relative overflow-hidden select-none"
      data-testid="listing-fallback"
    >
      <img
        src={LISTING_IMAGE_FALLBACK}
        alt=""
        className="w-full h-full object-cover"
        draggable={false}
      />
    </div>
  );
}

// Mirrors server/match-estimate.ts PLACEHOLDER_PATTERNS and server/image-backfill.ts.
// "default" catches portal CDN no-photo URLs like mms.immowelt.de/default.jpg.
const PLACEHOLDER_PATTERNS =
  /placeholder|no[-_]image|no[-_]img|no[-_]photo|noimage|nophoto|nopicture|no[-_]picture|default|missing|dummy|blank|fallback|spacer|1x1|pixel\.gif|static\/img\/no_pic/i;

export function hasRealListingPhoto(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return false;
  return !PLACEHOLDER_PATTERNS.test(trimmed);
}

export function isValidImageUrl(url: string | null | undefined): boolean {
  return hasRealListingPhoto(url);
}
