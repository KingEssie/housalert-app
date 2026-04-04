import { useState } from "react";
import { Heart, ImageIcon, Lock, MapPin, BedDouble, Maximize2, CheckCircle2 } from "lucide-react";
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
      <div className="rounded-[--ha-card-radius] bg-white overflow-hidden">
        <div className="p-3 pb-0">
          <div className="relative rounded-[12px] overflow-hidden">
            {hasImage ? (
              <img
                src={match.image_url!}
                alt={match.title}
                className="w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                style={{ aspectRatio: "16/9" }}
                loading="lazy"
                onError={() => setImgError(true)}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className={`w-full bg-gradient-to-br ${gradient} flex items-center justify-center relative`} style={{ aspectRatio: "16/9" }}>
                <div className="absolute inset-0 bg-black/5" />
                <div className="flex flex-col items-center gap-2.5 text-[#111111]/20">
                  <ImageIcon className="w-10 h-10" />
                </div>
              </div>
            )}

            <div className="absolute top-3 left-3 flex gap-1.5">
              {isNew && (
                <span className="text-[11px] font-bold bg-ha-primary text-white px-3 py-1 rounded-full tracking-wide" data-testid={`badge-new-${match.listing_id}`}>
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
                className={`w-7 h-7 transition-colors duration-200 drop-shadow-[0_1px_3px_rgba(0,0,0,0.3)] ${
                  isFavorited
                    ? "fill-ha-primary stroke-white"
                    : "fill-black/20 stroke-white"
                }`}
                strokeWidth={2}
              />
            </button>
          </div>
        </div>

        <div className="px-4 pt-3.5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <h3
              className="text-[17px] font-bold text-[#111111] leading-snug line-clamp-2 flex-1 min-w-0"
              data-testid={`text-match-title-${match.listing_id}`}
            >
              {match.title}
            </h3>
          </div>

          <div className="flex items-baseline gap-2 mt-1.5">
            {match.price > 0 && (
              <span className="text-[17px] font-bold text-[#111111]" data-testid={`badge-price-${match.listing_id}`}>
                {formatPrice(match.price, locale)}
                <span className="text-[13px] font-normal text-[#6B7280] ml-0.5">{t("common.perMonthShort")}</span>
              </span>
            )}
          </div>

          {match.district && (
            <p className="text-[14px] text-[#4B5563] mt-1 leading-snug line-clamp-1" data-testid={`text-match-address-${match.listing_id}`}>
              {match.district}
            </p>
          )}

          <div className="flex items-center gap-4 mt-3 text-[14px] text-[#4B5563]">
            {match.city && (
              <span className="flex items-center gap-1.5" data-testid={`detail-city-${match.listing_id}`}>
                <MapPin className="w-[15px] h-[15px] text-[#9CA3AF] flex-shrink-0" strokeWidth={2} />
                <span className="line-clamp-1">{match.city}</span>
              </span>
            )}
            {match.bedrooms > 0 && (
              <span className="flex items-center gap-1.5" data-testid={`detail-bedrooms-${match.listing_id}`}>
                <BedDouble className="w-[15px] h-[15px] text-[#9CA3AF] flex-shrink-0" strokeWidth={2} />
                {match.bedrooms}
              </span>
            )}
            {match.size_m2 > 0 && (
              <span className="flex items-center gap-1.5" data-testid={`detail-size-${match.listing_id}`}>
                <Maximize2 className="w-[15px] h-[15px] text-[#9CA3AF] flex-shrink-0" strokeWidth={2} />
                {match.size_m2} m²
              </span>
            )}
            {timeAgo && (
              <span className="text-[13px] text-[#9CA3AF] ml-auto flex-shrink-0">
                {timeAgo}
              </span>
            )}
          </div>

          {locked && (
            <div className="flex items-center gap-1.5 mt-2.5 text-[13px] text-[#9CA3AF]" data-testid={`lock-indicator-${match.listing_id}`}>
              <Lock className="w-3.5 h-3.5" />
              <span>{t("listing.lockLabel")}</span>
            </div>
          )}

          {respondedLabel && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#E5E7EB]/40">
              <span className="flex items-center gap-1.5 text-[13px] text-ha-success font-medium" data-testid={`text-responded-${match.listing_id}`}>
                <CheckCircle2 className="w-4 h-4" />
                {respondedLabel}
              </span>
              {onRemoveResponse && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRemoveResponse(); }}
                  className="text-[13px] text-[#9CA3AF] hover:text-ha-danger transition-colors"
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
  const { t, locale } = useTranslation();
  const hasImage = !!match.image_url && !imgError;
  const gradient = getCityGradient(match.city);

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
      <div className="rounded-[--ha-card-radius] bg-white overflow-hidden">
        <div className="p-2 pb-0">
          <div className="relative rounded-[10px] overflow-hidden">
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
                <div className="flex flex-col items-center gap-1.5 text-[#111111]/20">
                  <ImageIcon className="w-7 h-7" />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-3 pt-2.5 pb-3">
          <h3 className="text-[15px] font-bold text-[#111111] leading-snug line-clamp-1" data-testid={`text-recent-title-${match.listing_id}`}>
            {match.title}
          </h3>
          {match.price > 0 && (
            <p className="text-[14px] font-bold text-[#111111] mt-0.5">
              {formatPrice(match.price, locale)}
              <span className="text-[11px] font-normal text-[#9CA3AF] ml-0.5">{t("common.perMonthShort")}</span>
            </p>
          )}
          <p className="text-[13px] text-[#4B5563] mt-0.5 line-clamp-1" data-testid={`text-recent-city-${match.listing_id}`}>
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
      <div className="rounded-[--ha-card-radius] bg-white overflow-hidden">
        <div className="p-1.5 pb-0">
          <div className="relative rounded-[10px] overflow-hidden">
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
                <ImageIcon className="w-5 h-5 text-[#111111]/20" />
              </div>
            )}
          </div>
        </div>
        <div className="px-2.5 pt-2 pb-2.5">
          <p className="text-[12px] font-bold text-[#111111] line-clamp-1" data-testid={`text-mini-title-${match.listing_id}`}>{match.title}</p>
          <div className="flex items-center gap-1 text-[11px] text-[#6B7280] mt-0.5" data-testid={`text-mini-meta-${match.listing_id}`}>
            {match.price > 0 && <span className="font-semibold">€{match.price}</span>}
            {match.price > 0 && match.size_m2 > 0 && <span>·</span>}
            {match.size_m2 > 0 && <span>{match.size_m2} m²</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
