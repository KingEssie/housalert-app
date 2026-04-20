import { useState } from "react";
import { Heart, Lock, CheckCircle2, BedDouble, Maximize2, MapPin, Tag } from "lucide-react";
import { useTranslation } from "@/i18n";
import type { ApiMatch } from "@/lib/listings";
import { ListingFallback, isValidImageUrl } from "@/components/listing-fallback";

function formatPrice(price: number, locale: string): string {
  const intlLocale = locale === "de" ? "de-DE" : locale === "en" ? "en-IE" : "nl-NL";
  if (price >= 1000) {
    return `€${new Intl.NumberFormat(intlLocale).format(price)}`;
  }
  return `€${price}`;
}

function formatSource(source: string): string {
  const s = (source || "").trim().toLowerCase();
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

function formatAddress(match: ApiMatch): string {
  if (match.city) return match.city;
  return "";
}

function formatTimeAgo(dateStr: string | undefined | null, locale: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (locale === "de") {
    if (minutes < 2) return "gerade eben";
    if (minutes < 60) return `vor ${minutes} Min.`;
    if (hours < 24) return `vor ${hours} Std.`;
    return `vor ${days} Tag${days !== 1 ? "en" : ""}`;
  }
  if (locale === "en") {
    if (minutes < 2) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }
  if (minutes < 2) return "zojuist";
  if (minutes < 60) return `${minutes} min geleden`;
  if (hours < 24) return hours === 1 ? "1 uur geleden" : `${hours} uur geleden`;
  return days === 1 ? "1 dag geleden" : `${days} dagen geleden`;
}

interface ListingCardFullProps {
  match: ApiMatch;
  isFavorited: boolean;
  onToggleFavorite: (listingId: string) => void;
  onCardClick: () => void;
  locked?: boolean;
  respondedLabel?: string;
  onRemoveResponse?: () => void;
  removeResponseLabel?: string;
}

export function ListingCardFull({
  match,
  isFavorited,
  onToggleFavorite,
  onCardClick,
  locked,
  respondedLabel,
  onRemoveResponse,
  removeResponseLabel,
}: ListingCardFullProps) {
  const [imgError, setImgError] = useState(false);
  const { t, locale } = useTranslation();
  const hasImage = isValidImageUrl(match.image_url) && !imgError;
  const seenAt = match.first_seen_at || match.matched_at;
  const isNew = seenAt ? (Date.now() - new Date(seenAt).getTime()) / 3600000 < 24 : false;

  const address = formatAddress(match);
  const sourceName = formatSource(match.source);
  const hasBedrooms = match.bedrooms > 0;
  const hasSize = match.size_m2 > 0;
  const timeAgo = formatTimeAgo(seenAt, locale);

  function handleHeartClick(e: React.MouseEvent) {
    e.stopPropagation();
    onToggleFavorite(match.listing_id);
  }

  return (
    <div
      className="cursor-pointer active:scale-[0.985] transition-transform duration-200 rounded-[12px] overflow-hidden"
      style={{ backgroundColor: "rgb(var(--ha-success) / 0.12)", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
      onClick={onCardClick}
      data-testid={`card-match-${match.listing_id}`}
    >
      <div className="relative overflow-hidden">
        {hasImage ? (
          <img
            src={match.image_url!}
            alt={match.title}
            className="w-full object-cover"
            style={{ aspectRatio: "16/9" }}
            loading="lazy"
            onError={() => setImgError(true)}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full" style={{ aspectRatio: "16/9" }}>
            <ListingFallback title={match.title} source={match.source} city={match.city} size="full" />
          </div>
        )}


        <button
          onClick={handleHeartClick}
          className="absolute top-3 right-3 w-[38px] h-[38px] flex items-center justify-center transition-all duration-150 active:scale-110"
          data-testid={`button-favorite-${match.listing_id}`}
        >
          <Heart
            className="w-[22px] h-[22px] transition-all duration-150"
            fill={isFavorited ? "#FF385C" : "none"}
            stroke={isFavorited ? "#FF385C" : "#ffffff"}
            strokeWidth={2.5}
            style={{ filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.55))" }}
          />
        </button>
      </div>

      <div className="p-4 flex flex-col gap-1.5">
        <h3
          className="text-[16px] font-bold text-ha-text leading-snug line-clamp-2"
          data-testid={`text-match-title-${match.listing_id}`}
        >
          {match.title}
        </h3>

        {(timeAgo || sourceName) && (
          <p className="text-[13px] text-ha-text-muted" data-testid={`detail-source-${match.listing_id}`}>
            {timeAgo && sourceName ? `${timeAgo} · ${sourceName}` : timeAgo || sourceName}
          </p>
        )}

        <div className="flex flex-nowrap gap-1.5 mt-0.5 overflow-hidden" data-testid={`detail-meta-${match.listing_id}`}>
          {address && (
            <span
              className="inline-flex items-center gap-[4px] bg-white text-[13px] font-medium text-ha-text px-2 py-[5px] rounded-[6px] min-w-0 shrink"
              style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}
              data-testid={`detail-city-${match.listing_id}`}
            >
              <MapPin className="w-[19px] h-[19px] flex-shrink-0 text-ha-text" strokeWidth={1.7} />
              <span className="truncate">{address}</span>
            </span>
          )}
          {hasBedrooms && (
            <span
              className="inline-flex items-center gap-[4px] bg-white text-[13px] font-medium text-ha-text px-2 py-[5px] rounded-[6px] shrink-0"
              style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}
            >
              <BedDouble className="w-[19px] h-[19px] flex-shrink-0 text-ha-text" strokeWidth={1.7} />
              {match.bedrooms}
            </span>
          )}
          {hasSize && (
            <span
              className="inline-flex items-center gap-[4px] bg-white text-[13px] font-medium text-ha-text px-2 py-[5px] rounded-[6px] shrink-0"
              style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}
            >
              <Maximize2 className="w-[19px] h-[19px] flex-shrink-0 text-ha-text" strokeWidth={1.7} />
              {match.size_m2} m²
            </span>
          )}
          {match.price > 0 && (
            <span
              className="inline-flex items-center gap-[4px] bg-white text-[13px] font-semibold text-ha-text px-2 py-[5px] rounded-[6px] shrink-0"
              style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}
              data-testid={`badge-price-${match.listing_id}`}
            >
              <Tag className="w-[19px] h-[19px] flex-shrink-0 text-ha-text" strokeWidth={1.7} />
              {formatPrice(match.price, locale)}
            </span>
          )}
        </div>

        {locked && (
          <div className="flex items-center gap-1.5 mt-1 text-[12px] text-ha-text-secondary" data-testid={`lock-indicator-${match.listing_id}`}>
            <Lock className="w-3 h-3" />
            <span>{t("listing.lockLabel")}</span>
          </div>
        )}

        {respondedLabel && (
          <div className="flex items-center justify-between mt-1">
            <span className="flex items-center gap-1.5 text-[13px] text-ha-success font-medium" data-testid={`text-responded-${match.listing_id}`}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              {respondedLabel}
            </span>
            {onRemoveResponse && (
              <button
                onClick={(e) => { e.stopPropagation(); onRemoveResponse(); }}
                className="text-[12px] text-ha-text-placeholder hover:text-ha-danger transition-colors"
                data-testid={`button-remove-response-${match.listing_id}`}
              >
                {removeResponseLabel}
              </button>
            )}
          </div>
        )}
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
  const { locale } = useTranslation();
  const hasImage = isValidImageUrl(match.image_url) && !imgError;

  return (
    <div
      role="button"
      tabIndex={0}
      className="flex-shrink-0 w-[72vw] max-w-[280px] cursor-pointer transition-all duration-200 active:scale-[0.985] outline-none focus-visible:ring-2 focus-visible:ring-ha-primary/40 rounded-[12px]"
      onClick={onCardClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onCardClick();
        }
      }}
      data-testid={`card-recent-match-${match.listing_id}`}
    >
      <div className="relative overflow-hidden rounded-[12px]" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        {hasImage ? (
          <img
            src={match.image_url!}
            alt={match.title}
            className="w-full object-cover"
            style={{ aspectRatio: "16/9" }}
            loading="lazy"
            onError={() => setImgError(true)}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full" style={{ aspectRatio: "16/9" }}>
            <ListingFallback title={match.title} source={match.source} city={match.city} size="compact" />
          </div>
        )}

        {hasImage && (
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
        )}

        {match.price > 0 && (
          <div className="absolute bottom-2 left-2.5">
            <span className={`text-[13px] font-semibold ${hasImage ? "text-white" : "text-ha-text-secondary"}`} style={hasImage ? { textShadow: "0 1px 2px rgba(0,0,0,0.4)" } : undefined}>
              {formatPrice(match.price, locale)}
            </span>
          </div>
        )}
      </div>

      <div className="pt-2 pb-0.5">
        <h3 className="text-[14px] font-semibold text-ha-text leading-snug truncate" data-testid={`text-recent-title-${match.listing_id}`}>
          {match.title}
        </h3>
        <p className="text-[12px] text-ha-text-secondary mt-[2px] truncate" data-testid={`text-recent-city-${match.listing_id}`}>
          {match.city}
        </p>
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
  const hasImage = isValidImageUrl(match.image_url) && !imgError;

  return (
    <div
      role="button"
      tabIndex={0}
      className="flex-shrink-0 w-[28vw] max-w-[130px] cursor-pointer snap-start transition-all duration-200 active:scale-[0.985] outline-none focus-visible:ring-2 focus-visible:ring-ha-primary/40 rounded-[12px]"
      onClick={onCardClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onCardClick();
        }
      }}
      data-testid={`card-recently-viewed-${match.listing_id}`}
    >
      <div className="relative overflow-hidden rounded-[12px]" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
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
          <div className="w-full" style={{ aspectRatio: "1/1" }}>
            <ListingFallback title={match.title} source={match.source} city={match.city} size="mini" />
          </div>
        )}
      </div>
      <div className="pt-2 pb-0.5">
        <p className="text-[13px] font-semibold text-ha-text truncate" data-testid={`text-mini-title-${match.listing_id}`}>{match.title}</p>
        <p className="text-[12px] text-ha-text-secondary mt-[2px]" data-testid={`text-mini-meta-${match.listing_id}`}>
          {match.price > 0 && <span className="font-semibold text-ha-text">€{match.price}</span>}
          {match.price > 0 && match.size_m2 > 0 && <span> · </span>}
          {match.size_m2 > 0 && <span>{match.size_m2} m²</span>}
        </p>
      </div>
    </div>
  );
}
