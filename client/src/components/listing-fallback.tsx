const PLACEHOLDER_SRC = "/listing-placeholder.png";

interface ListingFallbackProps {
  title?: string;
  source?: string;
  city?: string;
  size?: "full" | "compact" | "mini" | "hero";
}

export function ListingFallback({ city, source, size = "full" }: ListingFallbackProps) {
  const showMeta = size !== "mini" && (city || source);

  return (
    <div
      className="w-full h-full relative overflow-hidden select-none"
      style={{ backgroundColor: "rgb(var(--ha-surface))" }}
      data-testid="listing-fallback"
    >
      <img
        src={PLACEHOLDER_SRC}
        alt=""
        className="w-full h-full object-contain"
        draggable={false}
      />
      {showMeta && (
        <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-ha-primary-hover/40 to-transparent">
          {city && (
            <span className="text-[11px] font-medium text-white/80 truncate block">{city}</span>
          )}
          {source && (
            <span className="text-[10px] text-white/55 truncate block">{formatSourceLabel(source)}</span>
          )}
        </div>
      )}
    </div>
  );
}

function formatSourceLabel(source: string): string {
  const s = source.trim().toLowerCase();
  const map: Record<string, string> = {
    immowelt: "immowelt.de",
    kleinanzeigen: "kleinanzeigen.de",
    "wg-gesucht": "wg-gesucht.de",
    wohnungsboerse: "wohnungsboerse.net",
    immoscout: "immobilienscout24.de",
    immonet: "immonet.de",
    rentola: "rentola.de",
    nestpick: "nestpick.com",
    pararius: "pararius.nl",
    funda: "funda.nl",
    kamernet: "kamernet.nl",
  };
  return map[s] || s;
}

export function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  const placeholders = [
    "placeholder",
    "no-image",
    "noimage",
    "default-listing",
    "missing",
    "dummy",
    "blank",
    "fallback",
  ];
  const lower = trimmed.toLowerCase();
  if (placeholders.some((p) => lower.includes(p))) return false;

  if (!/^https?:\/\//i.test(trimmed)) return false;

  return true;
}
