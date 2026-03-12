import { useQuery } from "@tanstack/react-query";
import { MapPin, BedDouble, Ruler, ImageIcon, TrendingUp } from "lucide-react";
import { useState } from "react";

interface PopularListing {
  listing_id: string;
  title: string;
  price: number;
  size_m2: number;
  bedrooms: number;
  city: string;
  source: string;
  url: string | null;
  image_url: string | null;
  first_seen_at: string;
  fresh_label: string;
  match_count: number;
}

const CITY_GRADIENTS: Record<string, string> = {
  berlin: "from-[#1F2937] to-[#333333]",
  münchen: "from-[#1F2937] to-[#333333]",
  hamburg: "from-[#333333] to-[#1F2937]",
  frankfurt: "from-[#1F2937] to-[#333333]",
  köln: "from-[#333333] to-[#1F2937]",
  düsseldorf: "from-[#1F2937] to-[#333333]",
  stuttgart: "from-[#333333] to-[#1F2937]",
  default: "from-[#1F2937] to-[#333333]",
};

function getCityGradient(city: string): string {
  const key = city.toLowerCase().trim();
  for (const [name, gradient] of Object.entries(CITY_GRADIENTS)) {
    if (key.includes(name)) return gradient;
  }
  return CITY_GRADIENTS.default;
}

function PopularCard({ listing }: { listing: PopularListing }) {
  const [imgError, setImgError] = useState(false);
  const gradient = getCityGradient(listing.city);
  const hasImage = !!listing.image_url && !imgError;

  function handleClick() {
    if (listing.url) {
      window.open(listing.url, "_blank", "noopener");
    }
  }

  return (
    <div
      className="flex-shrink-0 w-[220px] bg-white rounded-lg shadow-[0_1px_8px_rgba(0,0,0,0.06)] overflow-hidden cursor-pointer hover:shadow-[0_4px_16px_rgba(0,0,0,0.10)] transition-all duration-200 active:scale-[0.985]"
      onClick={handleClick}
      data-testid={`card-popular-${listing.listing_id}`}
    >
      <div className="relative">
        {hasImage ? (
          <img
            src={listing.image_url!}
            alt={listing.title}
            className="w-full h-[120px] object-cover"
            loading="lazy"
            onError={() => setImgError(true)}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className={`w-full h-[120px] bg-gradient-to-br ${gradient} flex items-center justify-center relative`}>
            <div className="absolute inset-0 bg-black/5" />
            <div className="flex flex-col items-center gap-1 text-white/60">
              <ImageIcon className="w-6 h-6" />
              <span className="text-[10px] font-medium">{listing.source}</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-3 flex flex-col gap-1.5">
        <h3
          className="font-[700] text-[#111C3D] text-[14px] leading-[1.3] line-clamp-2"
          data-testid={`text-popular-title-${listing.listing_id}`}
        >
          {listing.title}
        </h3>

        {listing.price > 0 && (
          <span className="text-[15px] font-bold text-[#111C3D]">
            {"\u20AC"}{listing.price}
            <span className="text-[11px] font-normal text-[#1F2937]">/Monat</span>
          </span>
        )}

        <div className="flex items-center gap-1 text-[12px] text-[#1F2937]">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{listing.city}</span>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-[#1F2937]">
          {listing.bedrooms > 0 && (
            <span className="flex items-center gap-0.5">
              <BedDouble className="w-3 h-3" />
              {listing.bedrooms}
            </span>
          )}
          {listing.size_m2 > 0 && (
            <span className="flex items-center gap-0.5">
              <Ruler className="w-3 h-3" />
              {listing.size_m2} m²
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function PopulairVandaagSection() {
  const { data: listings, isLoading } = useQuery<PopularListing[]>({
    queryKey: ["/api/listings/popular"],
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-section-title">Beliebt heute</h2>
          <p className="text-[13px] font-[500] text-[#1F2937] mt-0.5">Wohnungen, die viel Aufmerksamkeit bekommen</p>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-shrink-0 w-[220px] h-[220px] bg-[#F5F7FA] rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!listings || listings.length === 0) return null;

  return (
    <div className="flex flex-col gap-3" data-testid="section-populair-vandaag">
      <div>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#1F2937]" />
          <h2 className="text-section-title">Beliebt heute</h2>
        </div>
        <p className="text-[13px] text-[#1F2937] mt-0.5 ml-6">Wohnungen, die viel Aufmerksamkeit bekommen</p>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory scrollbar-none">
        {listings.map((listing) => (
          <div key={listing.listing_id} className="snap-start">
            <PopularCard listing={listing} />
          </div>
        ))}
      </div>
    </div>
  );
}
