import { BedDouble } from "lucide-react";
import placeholderImg from "@assets/listing-placeholder.png";

type ListingType = "room" | "apartment" | "house";

const SHORT_BOUNDARY_WORDS = new Set(["wg"]);

const TYPE_KEYWORDS: Record<ListingType, string[]> = {
  room: [
    "zimmer", "wg", "room", "kamer", "möbliert", "furnished",
    "einzel", "doppel", "shared", "coliving", "wohngemeinschaft",
  ],
  house: [
    "haus", "house", "huis", "einfamilienhaus", "reihenhaus",
    "doppelhaushälfte", "bungalow", "villa", "townhouse", "cottage",
  ],
  apartment: [
    "wohnung", "apartment", "appartement", "flat", "studio",
    "penthouse", "loft", "etage", "maisonette", "souterrain",
  ],
};

function matchKeyword(text: string, kw: string): boolean {
  if (SHORT_BOUNDARY_WORDS.has(kw)) {
    return new RegExp(`\\b${kw}\\b`, "i").test(text);
  }
  return text.includes(kw);
}

function detectListingType(title?: string, source?: string): ListingType {
  const text = `${title || ""} ${source || ""}`.toLowerCase();

  if (TYPE_KEYWORDS.room.some((kw) => matchKeyword(text, kw))) return "room";
  if (TYPE_KEYWORDS.house.some((kw) => matchKeyword(text, kw))) return "house";
  if (TYPE_KEYWORDS.apartment.some((kw) => matchKeyword(text, kw))) return "apartment";

  const roomSources = ["wg-gesucht", "kamernet"];
  if (roomSources.includes((source || "").toLowerCase().trim())) return "room";

  return "apartment";
}

interface ListingFallbackProps {
  title?: string;
  source?: string;
  city?: string;
  size?: "full" | "compact" | "mini" | "hero";
}

export function ListingFallback({ title, source, city, size = "full" }: ListingFallbackProps) {
  const type = detectListingType(title, source);
  const isRoom = type === "room";

  if (isRoom) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#F9FAFB] to-[#F1F3F5] select-none" data-testid="listing-fallback">
        <div className="flex flex-col items-center gap-1.5">
          <div className="rounded-2xl bg-white/80 p-3 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
            <BedDouble
              className={size === "mini" ? "w-5 h-5" : size === "compact" ? "w-8 h-8" : size === "hero" ? "w-14 h-14" : "w-10 h-10"}
              strokeWidth={1.5}
              style={{ color: "#334855" }}
            />
          </div>
          {(size === "full" || size === "hero") && (
            <span className="text-[10px] font-semibold tracking-[0.04em] text-[#d91a68]/40 uppercase mt-1">HousAlert</span>
          )}
          {size !== "mini" && city && (
            <span className="text-[11px] font-medium text-[#B0B5BE] truncate max-w-[80%]">{city}</span>
          )}
          {size !== "mini" && source && (
            <span className="text-[10px] text-[#C4C8CE] truncate max-w-[80%]">{formatSourceLabel(source)}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative overflow-hidden select-none bg-[#EDF2F7]" data-testid="listing-fallback">
      <img
        src={placeholderImg}
        alt=""
        className="w-full h-full object-cover object-center"
        draggable={false}
      />
      {size !== "mini" && (city || source) && (
        <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-[#1a2d45]/40 to-transparent">
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
