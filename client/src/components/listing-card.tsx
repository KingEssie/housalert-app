import { useState } from "react";
import { Heart, ImageIcon, Lock, MapPin, CheckCircle2 } from "lucide-react";
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
  const gradient = getCityGradient(match.city);
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
      <div className="rounded-[16px] bg-white overflow-hidden">
        <div className="relative overflow-hidden">
          {hasImage ? (
            <img
              src={match.image_url!}
              alt={match.title}
              className="w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              style={{ aspectRatio: "3/2" }}
              loading="lazy"
              onError={() => setImgError(true)}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className={`w-full bg-gradient-to-br ${gradient} flex items-center justify-center relative`} style={{ aspectRatio: "3/2" }}>
              <div className="absolute inset-0 bg-black/5" />
              <ImageIcon className="w-10 h-10 text-[#111111]/10" />
            </div>
          )}

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
              className={`w-7 h-7 transition-colors duration-200 drop-shadow-[0_1px_3px_rgba(0,0,0,0.3)] ${
                isFavorited
                  ? "fill-ha-primary stroke-white"
                  : "fill-black/20 stroke-white"
              }`}
              strokeWidth={2}
            />
          </button>

          {match.price > 0 && (
            <div className="absolute bottom-3 left-3">
              <span className="text-[15px] font-bold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]" data-testid={`badge-price-${match.listing_id}`}>
                {formatPrice(match.price, locale)}
                <span className="text-[12px] font-normal opacity-80 ml-0.5">{t("common.perMonthShort")}</span>
              </span>
            </div>
          )}
        </div>

        <div className="px-4 pt-3 pb-3.5">
          <h3
            className="text-[16px] font-bold text-[#111111] leading-[1.3] line-clamp-2"
            data-testid={`text-match-title-${match.listing_id}`}
          >
            {match.title}
          </h3>

          <div className="flex items-center gap-1 mt-1.5 text-[13px] text-[#9CA3AF]">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.8} />
            <span className="line-clamp-1" data-testid={`detail-city-${match.listing_id}`}>{match.city}</span>
          </div>

          {locked && (
            <div className="flex items-center gap-1.5 mt-2 text-[12px] text-[#9CA3AF]" data-testid={`lock-indicator-${match.listing_id}`}>
              <Lock className="w-3 h-3" />
              <span>{t("listing.lockLabel")}</span>
            </div>
          )}

          {respondedLabel && (
            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[#F0F0F0]">
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
  const gradient = getCityGradient(match.city);

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
      <div className="rounded-[16px] bg-white overflow-hidden">
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
            <div className={`w-full bg-gradient-to-br ${gradient} flex items-center justify-center relative`} style={{ aspectRatio: "16/9" }}>
              <div className="absolute inset-0 bg-black/5" />
              <ImageIcon className="w-7 h-7 text-[#111111]/10" />
            </div>
          )}

          {match.price > 0 && (
            <div className="absolute bottom-2 left-2.5">
              <span className="text-[13px] font-bold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]">
                {formatPrice(match.price, locale)}
              </span>
            </div>
          )}
        </div>

        <div className="px-3.5 pt-2 pb-2.5">
          <h3 className="text-[14px] font-bold text-[#111111] leading-snug line-clamp-1" data-testid={`text-recent-title-${match.listing_id}`}>
            {match.title}
          </h3>
          <p className="text-[12px] text-[#9CA3AF] mt-0.5 line-clamp-1" data-testid={`text-recent-city-${match.listing_id}`}>
            {match.city}
          </p>
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
      className="flex-shrink-0 w-[28vw] max-w-[130px] cursor-pointer snap-start transition-all duration-200 active:scale-[0.985] outline-none focus-visible:ring-2 focus-visible:ring-ha-primary/40 rounded-[14px]"
      onClick={onCardClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onCardClick();
        }
      }}
      data-testid={`card-recently-viewed-${match.listing_id}`}
    >
      <div className="rounded-[14px] bg-white overflow-hidden">
        <div className="relative overflow-hidden">
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
              <ImageIcon className="w-5 h-5 text-[#111111]/10" />
            </div>
          )}
        </div>
        <div className="px-2.5 pt-2 pb-2.5">
          <p className="text-[12px] font-bold text-[#111111] line-clamp-1" data-testid={`text-mini-title-${match.listing_id}`}>{match.title}</p>
          <p className="text-[11px] text-[#9CA3AF] mt-0.5" data-testid={`text-mini-meta-${match.listing_id}`}>
            {match.price > 0 && <span className="font-semibold text-[#111111]">€{match.price}</span>}
            {match.price > 0 && match.size_m2 > 0 && <span> · </span>}
            {match.size_m2 > 0 && <span>{match.size_m2} m²</span>}
          </p>
        </div>
      </div>
    </div>
  );
}
