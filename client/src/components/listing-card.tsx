import { useState } from "react";
import { Heart, Lock, CheckCircle2, BedDouble, Maximize2 } from "lucide-react";
import { useTranslation } from "@/i18n";
import type { ApiMatch } from "@/lib/listings";
import { ListingFallback, isValidImageUrl } from "@/components/listing-fallback";

function formatPrice(price: number, locale: string): string {
  const intlLocale = locale === "de" ? "de-DE" : locale === "en" ? "en-IE" : "nl-NL";
  if (price >= 1000) {
    const formatted = new Intl.NumberFormat(intlLocale).format(price);
    return `€${formatted}`;
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
  if (match.district && match.city) return `${match.district}, ${match.city}`;
  if (match.city) return match.city;
  return "";
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

  function handleHeartClick(e: React.MouseEvent) {
    e.stopPropagation();
    onToggleFavorite(match.listing_id);
  }

  const address = formatAddress(match);
  const sourceName = formatSource(match.source);
  const hasBedrooms = match.bedrooms > 0;
  const hasSize = match.size_m2 > 0;

  return (
    <div
      className="cursor-pointer group active:scale-[0.985] transition-transform duration-200"
      onClick={onCardClick}
      data-testid={`card-match-${match.listing_id}`}
    >
      <div className="relative overflow-hidden rounded-[16px]">
        {hasImage ? (
          <img
            src={match.image_url!}
            alt={match.title}
            className="w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            style={{ aspectRatio: "4/3" }}
            loading="lazy"
            onError={() => setImgError(true)}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full" style={{ aspectRatio: "4/3" }}>
            <ListingFallback title={match.title} source={match.source} city={match.city} size="full" />
          </div>
        )}

        {isNew && (
          <span
            className="absolute top-3 left-3 text-[11px] font-semibold bg-white text-[#111111] px-2.5 py-[5px] rounded-full"
            style={{ boxShadow: "0 2px 6px rgba(0,0,0,0.08)" }}
            data-testid={`badge-new-${match.listing_id}`}
          >
            {t("freshness.new") || "Nieuw"}
          </span>
        )}

        <button
          onClick={handleHeartClick}
          className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-all duration-200"
          style={{
            backgroundColor: isFavorited ? "#d91a68" : "rgba(0,0,0,0.35)",
            backdropFilter: isFavorited ? "none" : "blur(4px)",
          }}
          data-testid={`button-favorite-${match.listing_id}`}
        >
          <Heart
            className={`w-[18px] h-[18px] transition-all duration-200 text-white ${isFavorited ? "scale-110" : ""}`}
            fill={isFavorited ? "currentColor" : "none"}
            strokeWidth={2}
          />
        </button>

        {match.price > 0 && (
          <div className="absolute bottom-3 left-3">
            <span
              className={`text-[17px] font-semibold ${hasImage ? "text-white" : "text-[#374151]"}`}
              style={hasImage ? { textShadow: "0 1px 3px rgba(0,0,0,0.5)" } : undefined}
              data-testid={`badge-price-${match.listing_id}`}
            >
              {formatPrice(match.price, locale)}
              <span className={`text-[12px] font-normal ml-0.5 ${hasImage ? "opacity-80" : "text-[#9CA3AF]"}`}>{t("common.perMonthShort")}</span>
            </span>
          </div>
        )}
      </div>

      <div className="pt-2.5 pb-1 flex flex-col gap-[3px]">
        <h3
          className="text-[16px] font-semibold text-[#111111] leading-snug truncate"
          data-testid={`text-match-title-${match.listing_id}`}
        >
          {match.title}
        </h3>

        {address && (
          <p
            className="text-[14px] text-[#6B7280] truncate"
            data-testid={`detail-city-${match.listing_id}`}
          >
            {address}
          </p>
        )}

        {(hasBedrooms || hasSize) && (
          <p className="text-[14px] text-[#6B7280] flex items-center gap-1 truncate" data-testid={`detail-meta-${match.listing_id}`}>
            {hasBedrooms && (
              <span className="inline-flex items-center gap-1">
                <BedDouble className="w-[14px] h-[14px] text-[#374151]" strokeWidth={1.8} />
                <span>
                  {match.bedrooms === 1
                    ? `${match.bedrooms} ${t("common.bedroom")}`
                    : `${match.bedrooms} ${t("common.bedrooms")}`}
                </span>
              </span>
            )}
            {hasBedrooms && hasSize && <span className="text-[#9CA3AF] mx-0.5">·</span>}
            {hasSize && (
              <span className="inline-flex items-center gap-1">
                <Maximize2 className="w-[14px] h-[14px] text-[#374151]" strokeWidth={1.8} />
                <span>{match.size_m2} m²</span>
              </span>
            )}
          </p>
        )}

        <p className="text-[13px] text-[#9CA3AF]" data-testid={`detail-source-${match.listing_id}`}>
          {sourceName}
        </p>

        {locked && (
          <div className="flex items-center gap-1.5 mt-0.5 text-[12px] text-[#9CA3AF]" data-testid={`lock-indicator-${match.listing_id}`}>
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
                className="text-[12px] text-[#C4C4C4] hover:text-ha-danger transition-colors"
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
      className="flex-shrink-0 w-[72vw] max-w-[280px] cursor-pointer transition-all duration-200 active:scale-[0.985] outline-none focus-visible:ring-2 focus-visible:ring-ha-primary/40 rounded-[16px]"
      onClick={onCardClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onCardClick();
        }
      }}
      data-testid={`card-recent-match-${match.listing_id}`}
    >
      <div className="relative overflow-hidden rounded-[16px]" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
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
            <span className={`text-[13px] font-semibold ${hasImage ? "text-white" : "text-[#374151]"}`} style={hasImage ? { textShadow: "0 1px 2px rgba(0,0,0,0.4)" } : undefined}>
              {formatPrice(match.price, locale)}
            </span>
          </div>
        )}
      </div>

      <div className="pt-2 pb-0.5">
        <h3 className="text-[14px] font-semibold text-[#111111] leading-snug truncate" data-testid={`text-recent-title-${match.listing_id}`}>
          {match.title}
        </h3>
        <p className="text-[12px] text-[#6B7280] mt-[2px] truncate" data-testid={`text-recent-city-${match.listing_id}`}>
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
      className="flex-shrink-0 w-[28vw] max-w-[130px] cursor-pointer snap-start transition-all duration-200 active:scale-[0.985] outline-none focus-visible:ring-2 focus-visible:ring-ha-primary/40 rounded-[16px]"
      onClick={onCardClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onCardClick();
        }
      }}
      data-testid={`card-recently-viewed-${match.listing_id}`}
    >
      <div className="relative overflow-hidden rounded-[16px]" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
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
      <div className="pt-1.5 pb-0.5">
        <p className="text-[12px] font-semibold text-[#111111] truncate" data-testid={`text-mini-title-${match.listing_id}`}>{match.title}</p>
        <p className="text-[11px] text-[#6B7280] mt-[2px]" data-testid={`text-mini-meta-${match.listing_id}`}>
          {match.price > 0 && <span className="font-semibold text-[#111111]">€{match.price}</span>}
          {match.price > 0 && match.size_m2 > 0 && <span> · </span>}
          {match.size_m2 > 0 && <span>{match.size_m2} m²</span>}
        </p>
      </div>
    </div>
  );
}
