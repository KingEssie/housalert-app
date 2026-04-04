import { useState } from "react";
import { Heart, Home as HomeIcon, Lock, CheckCircle2 } from "lucide-react";
import { useTranslation } from "@/i18n";
import type { ApiMatch } from "@/lib/listings";

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

function formatMeta(match: ApiMatch, t: (key: string, opts?: any) => string): string {
  const parts: string[] = [];
  if (match.size_m2 > 0) parts.push(`${match.size_m2} m²`);
  if (match.bedrooms > 0) {
    parts.push(
      match.bedrooms === 1
        ? `${match.bedrooms} ${t("common.bedroom")}`
        : `${match.bedrooms} ${t("common.bedrooms")}`
    );
  }
  return parts.join(" · ");
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

  const meta = formatMeta(match, t);
  const sourceName = formatSource(match.source);

  return (
    <div
      className="cursor-pointer group"
      onClick={onCardClick}
      data-testid={`card-match-${match.listing_id}`}
    >
      <div className="relative overflow-hidden rounded-[16px]">
        {hasImage ? (
          <img
            src={match.image_url!}
            alt={match.title}
            className="w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            style={{ aspectRatio: "4/5" }}
            loading="lazy"
            onError={() => setImgError(true)}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full bg-[#F3F4F6] flex items-center justify-center" style={{ aspectRatio: "4/5" }}>
            <HomeIcon className="w-12 h-12 text-[#9CA3AF]" />
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />

        {isNew && (
          <span
            className="absolute top-3 left-3 text-[11px] font-bold bg-white text-[#111111] px-2.5 py-[5px] rounded-full"
            style={{ boxShadow: "0 2px 6px rgba(0,0,0,0.08)" }}
            data-testid={`badge-new-${match.listing_id}`}
          >
            {t("freshness.new") || "Nieuw"}
          </span>
        )}

        <button
          onClick={handleHeartClick}
          className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-all duration-200 border ${
            isFavorited
              ? "bg-ha-primary border-white/80"
              : "bg-black/40 backdrop-blur-sm border-white/60"
          }`}
          data-testid={`button-favorite-${match.listing_id}`}
        >
          <Heart
            className="w-[18px] h-[18px] text-white"
            fill={isFavorited ? "white" : "none"}
            strokeWidth={2}
          />
        </button>

        {match.price > 0 && (
          <div className="absolute bottom-3 left-3">
            <span
              className="text-[17px] font-bold text-white"
              style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}
              data-testid={`badge-price-${match.listing_id}`}
            >
              {formatPrice(match.price, locale)}
              <span className="text-[12px] font-normal opacity-80 ml-0.5">{t("common.perMonthShort")}</span>
            </span>
          </div>
        )}
      </div>

      <div className="pt-2.5 pb-1">
        <h3
          className="text-[16px] font-bold text-[#111111] leading-snug truncate"
          data-testid={`text-match-title-${match.listing_id}`}
        >
          {match.title}
        </h3>

        <p
          className="text-[14px] text-[#6B7280] mt-0.5 truncate"
          data-testid={`detail-city-${match.listing_id}`}
        >
          {match.city}{match.district ? `, ${match.district}` : ""}
        </p>

        {meta && (
          <p className="text-[13px] text-[#9CA3AF] mt-0.5 truncate" data-testid={`detail-meta-${match.listing_id}`}>
            {meta}
          </p>
        )}

        <p className="text-[12px] text-[#C4C4C4] mt-0.5" data-testid={`detail-source-${match.listing_id}`}>
          {sourceName}
        </p>

        {locked && (
          <div className="flex items-center gap-1.5 mt-1.5 text-[12px] text-[#9CA3AF]" data-testid={`lock-indicator-${match.listing_id}`}>
            <Lock className="w-3 h-3" />
            <span>{t("listing.lockLabel")}</span>
          </div>
        )}

        {respondedLabel && (
          <div className="flex items-center justify-between mt-2">
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
          <div className="w-full bg-[#F3F4F6] flex items-center justify-center" style={{ aspectRatio: "16/9" }}>
            <HomeIcon className="w-7 h-7 text-[#9CA3AF]" />
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />

        {match.price > 0 && (
          <div className="absolute bottom-2 left-2.5">
            <span className="text-[13px] font-bold text-white" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}>
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
  const hasImage = !!match.image_url && !imgError;

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
          <div className="w-full bg-[#F3F4F6] flex items-center justify-center" style={{ aspectRatio: "1/1" }}>
            <HomeIcon className="w-5 h-5 text-[#9CA3AF]" />
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
