import { useState } from "react";
import { Heart, ImageIcon, Lock, MapPin, CheckCircle2 } from "lucide-react";
import { useTranslation } from "@/i18n";
import type { ApiMatch } from "@/lib/listings";

function getCityGradient(): string {
  return "bg-[#EAEAEA]";
}

function formatPrice(price: number, locale: string): string {
  const intlLocale = locale === "de" ? "de-DE" : locale === "en" ? "en-IE" : "nl-NL";
  if (price >= 1000) {
    const formatted = new Intl.NumberFormat(intlLocale).format(price);
    return `€${formatted}`;
  }
  return `€${price}`;
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
  const hasImage = !!match.image_url && !imgError;
  const seenAt = match.first_seen_at || match.matched_at;
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
      <div className="relative overflow-hidden rounded-[12px]">
        {hasImage ? (
          <img
            src={match.image_url!}
            alt={match.title}
            className="w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            style={{ aspectRatio: "3/2" }}
            loading="lazy"
            onError={() => setImgError(true)}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className={`w-full ${getCityGradient()} flex items-center justify-center`} style={{ aspectRatio: "3/2" }}>
            <ImageIcon className="w-10 h-10 text-black/10" />
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />

        {isNew && (
          <span className="absolute top-3 left-3 text-[11px] font-bold bg-ha-primary text-white px-3 py-1 rounded-full" data-testid={`badge-new-${match.listing_id}`}>
            {t("freshness.new") || "Nieuw"}
          </span>
        )}

        <button
          onClick={handleHeartClick}
          className="absolute top-3 right-3 p-0 border-0 bg-transparent active:scale-90 transition-transform"
          data-testid={`button-favorite-${match.listing_id}`}
        >
          <Heart
            className={`w-7 h-7 transition-colors duration-200 drop-shadow-[0_1px_3px_rgba(0,0,0,0.25)] ${
              isFavorited
                ? "fill-ha-primary stroke-white"
                : "fill-black/20 stroke-white"
            }`}
            strokeWidth={2}
          />
        </button>

        {match.price > 0 && (
          <div className="absolute bottom-3 left-3">
            <span className="text-[16px] font-bold text-white" data-testid={`badge-price-${match.listing_id}`}>
              {formatPrice(match.price, locale)}
              <span className="text-[12px] font-normal opacity-70 ml-0.5">{t("common.perMonthShort")}</span>
            </span>
          </div>
        )}
      </div>

      <div className="pt-2.5 pb-1">
        <h3
          className="text-[15px] font-semibold text-[#111111] leading-[1.35] line-clamp-2"
          data-testid={`text-match-title-${match.listing_id}`}
        >
          {match.title}
        </h3>

        <div className="flex items-center gap-1 mt-0.5 text-[13px] text-[#9CA3AF]">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.8} />
          <span className="line-clamp-1" data-testid={`detail-city-${match.listing_id}`}>{match.city}</span>
        </div>

        {locked && (
          <div className="flex items-center gap-1.5 mt-1.5 text-[12px] text-[#9CA3AF]" data-testid={`lock-indicator-${match.listing_id}`}>
            <Lock className="w-3 h-3" />
            <span>{t("listing.lockLabel")}</span>
          </div>
        )}

        {respondedLabel && (
          <div className="flex items-center justify-between mt-2.5">
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
  const hasImage = !!match.image_url && !imgError;

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
      <div className="relative overflow-hidden rounded-[12px]">
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
          <div className={`w-full ${getCityGradient()} flex items-center justify-center`} style={{ aspectRatio: "16/9" }}>
            <ImageIcon className="w-7 h-7 text-black/10" />
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />

        {match.price > 0 && (
          <div className="absolute bottom-2 left-2.5">
            <span className="text-[13px] font-bold text-white">
              {formatPrice(match.price, locale)}
            </span>
          </div>
        )}
      </div>

      <div className="pt-2 pb-0.5">
        <h3 className="text-[14px] font-semibold text-[#111111] leading-snug line-clamp-1" data-testid={`text-recent-title-${match.listing_id}`}>
          {match.title}
        </h3>
        <p className="text-[12px] text-[#9CA3AF] mt-0.5 line-clamp-1" data-testid={`text-recent-city-${match.listing_id}`}>
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
  const hasImage = !!match.image_url && !imgError;

  return (
    <div
      role="button"
      tabIndex={0}
      className="flex-shrink-0 w-[28vw] max-w-[130px] cursor-pointer snap-start transition-all duration-200 active:scale-[0.985] outline-none focus-visible:ring-2 focus-visible:ring-ha-primary/40 rounded-[10px]"
      onClick={onCardClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onCardClick();
        }
      }}
      data-testid={`card-recently-viewed-${match.listing_id}`}
    >
      <div className="relative overflow-hidden rounded-[10px]">
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
          <div className={`w-full ${getCityGradient()} flex items-center justify-center`} style={{ aspectRatio: "1/1" }}>
            <ImageIcon className="w-5 h-5 text-black/10" />
          </div>
        )}
      </div>
      <div className="pt-1.5 pb-0.5">
        <p className="text-[12px] font-semibold text-[#111111] line-clamp-1" data-testid={`text-mini-title-${match.listing_id}`}>{match.title}</p>
        <p className="text-[11px] text-[#9CA3AF] mt-0.5" data-testid={`text-mini-meta-${match.listing_id}`}>
          {match.price > 0 && <span className="font-semibold text-[#111111]">€{match.price}</span>}
          {match.price > 0 && match.size_m2 > 0 && <span> · </span>}
          {match.size_m2 > 0 && <span>{match.size_m2} m²</span>}
        </p>
      </div>
    </div>
  );
}
