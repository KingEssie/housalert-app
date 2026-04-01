import { useState } from "react";
import { Heart, ImageIcon, Lock, MapPin, BedDouble, Maximize2 } from "lucide-react";
import { useTranslation } from "@/i18n";
import type { ApiMatch } from "@/lib/listings";

const CITY_GRADIENTS: Record<string, string> = {
  berlin: "from-ha-card to-ha-surface",
  münchen: "from-ha-card to-ha-surface",
  hamburg: "from-ha-surface to-ha-card",
  frankfurt: "from-ha-card to-ha-surface",
  köln: "from-ha-surface to-ha-card",
  düsseldorf: "from-ha-card to-ha-surface",
  stuttgart: "from-ha-surface to-ha-card",
  default: "from-ha-card to-ha-surface",
};

function getCityGradient(city: string): string {
  const key = city.toLowerCase().trim();
  for (const [name, gradient] of Object.entries(CITY_GRADIENTS)) {
    if (key.includes(name)) return gradient;
  }
  return CITY_GRADIENTS.default;
}

function extractDomain(url: string | null): string {
  if (!url) return "";
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function relativeTimeShort(dateStr: string | null | undefined, t: (key: string, params?: Record<string, string | number>) => string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 0) return t("freshness.justNow");
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("freshness.justNow");
  if (mins < 60) return t("freshness.minutesAgo", { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("freshness.hoursAgo", { n: hours });
  const days = Math.floor(hours / 24);
  return days === 1 ? t("freshness.dayAgo", { n: days }) : t("freshness.daysAgo", { n: days });
}

interface ListingCardFullProps {
  match: ApiMatch;
  isFavorited: boolean;
  onToggleFavorite: (listingId: string) => void;
  onCardClick: () => void;
  locked?: boolean;
}

export function ListingCardFull({
  match,
  isFavorited,
  onToggleFavorite,
  onCardClick,
  locked,
}: ListingCardFullProps) {
  const [imgError, setImgError] = useState(false);
  const { t } = useTranslation();
  const gradient = getCityGradient(match.city);
  const hasImage = !!match.image_url && !imgError;
  const seenAt = match.first_seen_at || match.matched_at;
  const domain = extractDomain(match.url);
  const timeAgo = relativeTimeShort(seenAt, t);
  const isNew = seenAt ? (Date.now() - new Date(seenAt).getTime()) / 3600000 < 24 : false;

  function handleHeartClick(e: React.MouseEvent) {
    e.stopPropagation();
    onToggleFavorite(match.listing_id);
  }

  return (
    <div
      className="cursor-pointer group"
      onClick={onCardClick}
      data-testid={`card-match-${match.listing_id}`}
    >
      <div className="rounded-[--ha-card-radius] overflow-hidden bg-white shadow-ha-card">
        <div className="relative">
          {hasImage ? (
            <img
              src={match.image_url!}
              alt={match.title}
              className="w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              style={{ aspectRatio: "16/10" }}
              loading="lazy"
              onError={() => setImgError(true)}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className={`w-full bg-gradient-to-br ${gradient} flex items-center justify-center relative`} style={{ aspectRatio: "16/10" }}>
              <div className="absolute inset-0 bg-black/5" />
              <div className="flex flex-col items-center gap-2.5 text-[#000]/50">
                <ImageIcon className="w-8 h-8" />
                <span className="text-[12px] font-medium capitalize">{match.source}</span>
              </div>
            </div>
          )}

          <div className="absolute top-3 left-3 flex gap-1.5">
            {isNew && (
              <span className="text-[11px] font-semibold bg-ha-primary text-white px-3 py-1 rounded-full shadow-[0_1px_4px_rgba(0,0,0,0.1)]" data-testid={`badge-new-${match.listing_id}`}>
                {t("freshness.new") || "Nieuw"}
              </span>
            )}
          </div>

          <button
            onClick={handleHeartClick}
            className="absolute top-3 right-3 p-0 border-0 bg-transparent active:scale-90 transition-transform"
            data-testid={`button-favorite-${match.listing_id}`}
          >
            <Heart
              className={`w-7 h-7 transition-colors duration-200 drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)] ${
                isFavorited
                  ? "fill-[#FF5A5F] text-[#000] stroke-white"
                  : "fill-[rgba(0,0,0,0.15)] text-[#000] stroke-white"
              }`}
              strokeWidth={2}
            />
          </button>

          {match.price > 0 && (
            <div className="absolute bottom-3 left-3">
              <span className="text-[15px] font-bold text-white bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full" data-testid={`badge-price-${match.listing_id}`}>
                €{match.price}<span className="text-[12px] font-normal opacity-80 ml-0.5">{t("common.perMonthShort")}</span>
              </span>
            </div>
          )}
        </div>

        <div className="px-4 pt-3 pb-3.5">
          <h3
            className="text-[16px] font-bold text-[#000] leading-snug line-clamp-1"
            data-testid={`text-match-title-${match.listing_id}`}
          >
            {match.title}
          </h3>
          <p className="text-[14px] text-ha-text-secondary mt-0.5 line-clamp-1" data-testid={`text-match-address-${match.listing_id}`}>
            {match.city}{match.district ? `, ${match.district}` : ""}
          </p>
          {(timeAgo || domain) && (
            <p className="text-[13px] text-ha-text-muted mt-0.5 line-clamp-1">
              {[timeAgo, domain].filter(Boolean).join(" — ")}
            </p>
          )}

          <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-ha-divider/50">
            {match.city && (
              <span className="flex items-center gap-1 text-[13px] text-ha-text-secondary">
                <MapPin className="w-3.5 h-3.5 text-ha-icon-secondary" />
                {match.city}
              </span>
            )}
            {match.bedrooms > 0 && (
              <span className="flex items-center gap-1 text-[13px] text-ha-text-secondary">
                <BedDouble className="w-3.5 h-3.5 text-ha-icon-secondary" />
                {match.bedrooms}
              </span>
            )}
            {match.size_m2 > 0 && (
              <span className="flex items-center gap-1 text-[13px] text-ha-text-secondary">
                <Maximize2 className="w-3.5 h-3.5 text-ha-icon-secondary" />
                {match.size_m2} m²
              </span>
            )}
          </div>

          {locked && (
            <div className="flex items-center gap-1 mt-2 text-[12px] text-ha-icon-secondary" data-testid={`lock-indicator-${match.listing_id}`}>
              <Lock className="w-3 h-3" />
              <span>{t("listing.lockLabel")}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ListingCardCompactProps {
  match: ApiMatch;
  onCardClick: () => void;
}

export function ListingCardCompact({ match, onCardClick }: ListingCardCompactProps) {
  const [imgError, setImgError] = useState(false);
  const { t } = useTranslation();
  const hasImage = !!match.image_url && !imgError;
  const gradient = getCityGradient(match.city);
  const domain = extractDomain(match.url);
  const seenAt = match.first_seen_at || match.matched_at;
  const timeAgo = relativeTimeShort(seenAt, t);

  return (
    <div
      role="button"
      tabIndex={0}
      className="flex-shrink-0 w-[72vw] max-w-[280px] cursor-pointer transition-all duration-200 active:scale-[0.985] outline-none focus-visible:ring-2 focus-visible:ring-ha-primary/40 rounded-[--ha-card-radius]"
      onClick={onCardClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onCardClick();
        }
      }}
      data-testid={`card-recent-match-${match.listing_id}`}
    >
      <div className="rounded-[--ha-card-radius] overflow-hidden bg-white shadow-ha-card">
        <div className="relative">
          {hasImage ? (
            <img
              src={match.image_url!}
              alt={match.title}
              className="w-full object-cover"
              style={{ aspectRatio: "16/10" }}
              loading="lazy"
              onError={() => setImgError(true)}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className={`w-full bg-gradient-to-br ${gradient} flex items-center justify-center relative`} style={{ aspectRatio: "16/10" }}>
              <div className="absolute inset-0 bg-black/5" />
              <div className="flex flex-col items-center gap-1.5 text-[#000]/50">
                <ImageIcon className="w-7 h-7" />
                <span className="text-[11px] font-medium capitalize">{match.source}</span>
              </div>
            </div>
          )}
          {match.price > 0 && (
            <div className="absolute bottom-2.5 left-2.5">
              <span className="text-[13px] font-bold text-white bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-full">
                €{match.price}<span className="text-[11px] font-normal opacity-80 ml-0.5">{t("common.perMonthShort")}</span>
              </span>
            </div>
          )}
        </div>

        <div className="px-3 pt-2.5 pb-3">
          <h3 className="text-[15px] font-bold text-[#000] leading-snug line-clamp-1" data-testid={`text-recent-title-${match.listing_id}`}>
            {match.title}
          </h3>
          <p className="text-[13px] text-ha-text-secondary mt-0.5 line-clamp-1" data-testid={`text-recent-city-${match.listing_id}`}>
            {match.city}
          </p>
          {(timeAgo || domain) && (
            <p className="text-[12px] text-ha-text-muted mt-0.5 line-clamp-1">
              {[timeAgo, domain].filter(Boolean).join(" — ")}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1.5 text-[12px] text-ha-text-muted">
            {match.bedrooms > 0 && (
              <span>{match.bedrooms} {match.bedrooms === 1 ? t("common.bedroom") : t("common.bedrooms")}</span>
            )}
            {match.bedrooms > 0 && match.size_m2 > 0 && <span className="text-ha-icon-secondary">·</span>}
            {match.size_m2 > 0 && <span>{match.size_m2} m²</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ListingCardMiniProps {
  match: ApiMatch;
  onCardClick: () => void;
}

export function ListingCardMini({ match, onCardClick }: ListingCardMiniProps) {
  const [imgError, setImgError] = useState(false);
  const hasImage = !!match.image_url && !imgError;
  const gradient = getCityGradient(match.city);

  return (
    <div
      role="button"
      tabIndex={0}
      className="flex-shrink-0 w-[28vw] max-w-[130px] cursor-pointer snap-start transition-all duration-200 active:scale-[0.985] outline-none focus-visible:ring-2 focus-visible:ring-ha-primary/40 rounded-[--ha-card-radius]"
      onClick={onCardClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onCardClick();
        }
      }}
      data-testid={`card-recently-viewed-${match.listing_id}`}
    >
      <div className="rounded-[--ha-card-radius] overflow-hidden bg-white shadow-ha-card">
        <div className="relative">
          {hasImage ? (
            <img
              src={match.image_url!}
              alt={match.title}
              className="w-full object-cover"
              style={{ aspectRatio: "1/1" }}
              loading="lazy"
              onError={() => setImgError(true)}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className={`w-full bg-gradient-to-br ${gradient} flex items-center justify-center relative`} style={{ aspectRatio: "1/1" }}>
              <div className="absolute inset-0 bg-black/5" />
              <ImageIcon className="w-5 h-5 text-[#000]/40" />
            </div>
          )}
        </div>
        <div className="px-2.5 py-2 flex flex-col gap-0">
          <p className="text-[12px] font-semibold text-[#000] line-clamp-1">{match.title}</p>
          <div className="flex items-center gap-1 text-[11px] text-ha-text-muted">
            {match.price > 0 && <span>€{match.price}</span>}
            {match.price > 0 && match.size_m2 > 0 && <span>·</span>}
            {match.size_m2 > 0 && <span>{match.size_m2} m²</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
