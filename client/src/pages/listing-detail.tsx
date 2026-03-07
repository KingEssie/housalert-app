import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { ArrowLeft, MapPin, Euro, BedDouble, Ruler, ExternalLink, Clock, Globe, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApplySheet } from "@/components/apply-sheet";

const FRESH_BADGE_STYLES: Record<string, { bg: string; text: string }> = {
  net_binnen: { bg: "bg-[#CBFF02]", text: "text-[#000000]" },
  nieuw: { bg: "bg-[#471EA7]", text: "text-white" },
  vandaag: { bg: "bg-[#110C29]", text: "text-white" },
  ouder: { bg: "bg-gray-100", text: "text-gray-500" },
};

const FRESH_LABEL_TEXT: Record<string, string> = {
  net_binnen: "Net binnen",
  nieuw: "Nieuw",
  vandaag: "Vandaag",
  ouder: "Ouder",
};

function relativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 0) return "zojuist";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "zojuist";
  if (mins < 60) return `${mins} min geleden`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} uur geleden`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "dag" : "dagen"} geleden`;
}

interface Listing {
  id: string;
  title: string;
  city: string;
  district?: string;
  price: number;
  bedrooms: number;
  size_m2: number;
  source: string;
  url: string;
  first_seen_at: string;
  fresh_label: string;
  match_score?: number | null;
  match_label?: string | null;
  match_reasons?: string[];
}

export default function ListingDetailPage() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/listing/:id");
  const id = params?.id;
  const { session } = useAuth();
  const [applyOpen, setApplyOpen] = useState(false);

  const { data: listing, isLoading, isError } = useQuery<Listing>({
    queryKey: ["/api/listings", id],
    queryFn: async () => {
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
      const res = await fetch(`/api/listings/${id}`, { headers });
      if (!res.ok) throw new Error("Listing not found");
      return res.json();
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <header className="w-full bg-white sticky top-0 z-20 border-b border-[#E5E7EB]">
          <div className="max-w-xl mx-auto px-6 h-[60px] flex items-center">
            <button onClick={() => navigate("/dashboard")} className="w-10 h-10 rounded-full bg-[#F3F4F6] flex items-center justify-center hover:bg-[#E5E7EB] transition-colors" data-testid="button-back">
              <ArrowLeft className="w-5 h-5 text-[#6B7280]" />
            </button>
          </div>
        </header>
        <main className="flex-1 max-w-xl mx-auto w-full px-6 pt-6">
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-24 mb-3" />
              <div className="h-7 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </div>
            <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-32 mb-4" />
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded w-1/3" />
                <div className="h-4 bg-gray-200 rounded w-1/4" />
                <div className="h-4 bg-gray-200 rounded w-1/3" />
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (isError || !listing) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <header className="w-full bg-white sticky top-0 z-20 border-b border-[#E5E7EB]">
          <div className="max-w-xl mx-auto px-6 h-[60px] flex items-center">
            <button onClick={() => navigate("/dashboard")} className="w-10 h-10 rounded-full bg-[#F3F4F6] flex items-center justify-center hover:bg-[#E5E7EB] transition-colors" data-testid="button-back">
              <ArrowLeft className="w-5 h-5 text-[#6B7280]" />
            </button>
          </div>
        </header>
        <main className="flex-1 max-w-xl mx-auto w-full px-6 pt-6">
          <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-8 text-center">
            <p className="text-[18px] font-bold text-[#111827] mb-2">Advertentie niet gevonden</p>
            <p className="text-[13px] text-[#6B7280] mb-4">Deze advertentie bestaat niet meer of is verwijderd.</p>
            <Button onClick={() => navigate("/dashboard")} className="h-[56px] rounded-xl bg-[#673DE5] hover:bg-[#5B30D6] text-white text-[16px] font-semibold" data-testid="button-back-dashboard">
              Terug naar dashboard
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const style = FRESH_BADGE_STYLES[listing.fresh_label] ?? FRESH_BADGE_STYLES.ouder;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="w-full bg-white sticky top-0 z-20 border-b border-[#E5E7EB]">
        <div className="max-w-xl mx-auto px-6 h-[60px] flex items-center">
          <button onClick={() => navigate("/dashboard")} className="w-10 h-10 rounded-full bg-[#F3F4F6] flex items-center justify-center hover:bg-[#E5E7EB] transition-colors" data-testid="button-back">
            <ArrowLeft className="w-5 h-5 text-[#6B7280]" />
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-xl mx-auto w-full px-6 pt-6 pb-32">
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${style.bg} ${style.text}`} data-testid="badge-freshness">
                {FRESH_LABEL_TEXT[listing.fresh_label] ?? listing.fresh_label}
              </span>
              <span className="text-[13px] font-[500] text-[#6B7280] flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {relativeTime(listing.first_seen_at)}
              </span>
            </div>

            {listing.match_score != null && listing.match_label && (
              <div className="flex flex-col gap-1 mb-3" data-testid="listing-score-badge">
                <div className="flex items-center gap-2">
                  <span className={`text-[14px] font-bold px-3.5 py-1.5 rounded-full ${
                    listing.match_score >= 90 ? "bg-[#CBFF02] text-[#000000]" :
                    listing.match_score >= 75 ? "bg-[#471EA7] text-white" :
                    listing.match_score >= 60 ? "bg-[#110C29] text-white" :
                    "bg-gray-100 text-gray-600"
                  }`}>
                    {listing.match_label} · {listing.match_score}%
                  </span>
                </div>
                {listing.match_reasons && listing.match_reasons.length > 0 && (
                  <p className="text-[13px] font-[500] text-[#6B7280]" data-testid="text-listing-match-reasons">
                    Match op: {listing.match_reasons.join(", ")}
                  </p>
                )}
              </div>
            )}

            <h1 className="text-[32px] font-[800] text-[#111827] leading-[1.1] tracking-[-0.03em] mb-3" data-testid="text-listing-title">
              {listing.title}
            </h1>

            <div className="flex items-center gap-1.5 text-[15px] text-[#6B7280]">
              <MapPin className="w-4 h-4" />
              <span data-testid="text-listing-location">
                {listing.city}{listing.district ? `, ${listing.district}` : ""}
              </span>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6">
            <h2 className="text-[18px] font-bold text-[#111827] mb-4">Details</h2>
            <div className="grid grid-cols-2 gap-4">
              {listing.price > 0 && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#DCDBFA] flex items-center justify-center">
                    <Euro className="w-5 h-5 text-[#673DE5]" />
                  </div>
                  <div>
                    <p className="text-[13px] text-[#6B7280]">Huur</p>
                    <p className="text-[15px] font-semibold text-[#111827]" data-testid="text-listing-price">€{listing.price}/mnd</p>
                  </div>
                </div>
              )}

              {listing.bedrooms > 0 && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#DCDBFA] flex items-center justify-center">
                    <BedDouble className="w-5 h-5 text-[#673DE5]" />
                  </div>
                  <div>
                    <p className="text-[13px] text-[#6B7280]">Slaapkamers</p>
                    <p className="text-[15px] font-semibold text-[#111827]" data-testid="text-listing-bedrooms">{listing.bedrooms}</p>
                  </div>
                </div>
              )}

              {listing.size_m2 > 0 && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#DCDBFA] flex items-center justify-center">
                    <Ruler className="w-5 h-5 text-[#673DE5]" />
                  </div>
                  <div>
                    <p className="text-[13px] text-[#6B7280]">Oppervlakte</p>
                    <p className="text-[15px] font-semibold text-[#111827]" data-testid="text-listing-size">{listing.size_m2} m²</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#DCDBFA] flex items-center justify-center">
                  <Globe className="w-5 h-5 text-[#673DE5]" />
                </div>
                <div>
                  <p className="text-[13px] text-[#6B7280]">Bron</p>
                  <p className="text-[15px] font-semibold text-[#111827] capitalize" data-testid="text-listing-source">{listing.source}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] p-4 pb-5 z-10">
        <div className="max-w-xl mx-auto flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              onClick={() => setApplyOpen(true)}
              className="flex-1 h-[52px] rounded-md bg-[#673DE5] hover:bg-[#5B30D6] text-white text-[15px] font-semibold transition-colors flex items-center justify-center gap-2"
              data-testid="button-reageer-detail"
            >
              <Zap className="w-4 h-4" />
              Reageer direct
            </button>
            {listing.url && (
              <a href={listing.url} target="_blank" rel="noopener noreferrer">
                <button
                  className="h-[52px] px-5 rounded-xl border border-[#E5E7EB] bg-white text-[#111827] text-[15px] font-semibold hover:bg-[#F8FAFC] transition-colors flex items-center gap-2"
                  data-testid="button-view-original"
                >
                  <ExternalLink className="w-4 h-4" />
                  Bekijk
                </button>
              </a>
            )}
          </div>
          <p className="text-[12px] font-[500] text-[#9CA3AF] text-center">
            Reageer sneller met je standaardbrief
          </p>
        </div>
      </div>

      <ApplySheet
        listing={{
          id: listing.id,
          title: listing.title,
          city: listing.city,
          district: listing.district,
          price: listing.price,
          url: listing.url,
        }}
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        onMarkedApplied={() => {
          const MATCH_APPLIED_KEY = "stekkies_match_applied";
          const MATCH_VIEWED_KEY = "stekkies_match_viewed";
          try {
            const appliedStored = localStorage.getItem(MATCH_APPLIED_KEY);
            const appliedSet = new Set<string>(appliedStored ? JSON.parse(appliedStored) : []);
            appliedSet.add(listing.id);
            localStorage.setItem(MATCH_APPLIED_KEY, JSON.stringify([...appliedSet]));
            const viewedStored = localStorage.getItem(MATCH_VIEWED_KEY);
            const viewedSet = new Set<string>(viewedStored ? JSON.parse(viewedStored) : []);
            viewedSet.add(listing.id);
            localStorage.setItem(MATCH_VIEWED_KEY, JSON.stringify([...viewedSet]));
          } catch {}
          setApplyOpen(false);
        }}
      />
    </div>
  );
}
