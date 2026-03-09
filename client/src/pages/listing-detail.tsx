import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { MapPin, Euro, BedDouble, Ruler, ExternalLink, Clock, Globe, Zap, CheckCircle2, ImageIcon, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApplySheet } from "@/components/apply-sheet";

function FloatingBackButton({ navigate }: { navigate: (to: string) => void }) {
  return (
    <div className="absolute top-[max(0.75rem,env(safe-area-inset-top))] left-4 z-30">
      <button onClick={() => window.history.length > 1 ? window.history.back() : navigate("/dashboard")} className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm" data-testid="button-back"><ArrowLeft className="w-5 h-5 text-[var(--yo-dark)]" /></button>
    </div>
  );
}

const FRESH_BADGE_STYLES: Record<string, { bg: string; text: string }> = {
  net_binnen: { bg: "bg-[var(--yo-chip-bg)]", text: "text-[var(--yo-dark)]" },
  nieuw: { bg: "bg-[var(--yo-dark)]", text: "text-white" },
  vandaag: { bg: "bg-[var(--yo-dark)]", text: "text-white" },
  ouder: { bg: "bg-[var(--yo-surface)]", text: "text-[var(--yo-dark)]" },
};

const FRESH_LABEL_TEXT: Record<string, string> = {
  net_binnen: "Net binnen",
  nieuw: "Nieuw",
  vandaag: "Vandaag",
  ouder: "Ouder",
};

const CITY_GRADIENTS: Record<string, string> = {
  berlin: "from-[#1A1A1A] to-[#333333]",
  münchen: "from-[#1A1A1A] to-[#333333]",
  hamburg: "from-[#333333] to-[#1A1A1A]",
  frankfurt: "from-[#1A1A1A] to-[#333333]",
  köln: "from-[#333333] to-[#1A1A1A]",
  default: "from-[#1A1A1A] to-[#333333]",
};

function getCityGradient(city: string): string {
  const key = city.toLowerCase().trim();
  for (const [name, gradient] of Object.entries(CITY_GRADIENTS)) {
    if (key.includes(name)) return gradient;
  }
  return CITY_GRADIENTS.default;
}

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

function displayMatchLabel(score: number, serverLabel: string): string {
  if (score >= 90) return "Perfecte match";
  if (score >= 75) return "Goede match";
  if (score >= 65) return "Interessant";
  return serverLabel;
}

const MATCH_REASON_DETAIL: Record<string, { label: string; description: string }> = {
  locatie: { label: "In jouw gekozen stad", description: "Deze woning ligt in de stad die je hebt opgegeven." },
  prijs: { label: "Past binnen jouw budget", description: "De huurprijs valt binnen je opgegeven prijsklasse." },
  kamers: { label: "Past bij jouw woningtype", description: "Het aantal kamers komt overeen met je wensen." },
  grootte: { label: "Goede grootte", description: "De oppervlakte past bij je minimale vereisten." },
};

interface Listing {
  id: string;
  title: string;
  city: string;

  price: number;
  bedrooms: number;
  size_m2: number;
  source: string;
  url: string;
  image_url?: string | null;
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
  const [imgError, setImgError] = useState(false);

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
      <div className="min-h-screen bg-[var(--yo-surface)] flex flex-col relative">
        <FloatingBackButton navigate={navigate} />
        <div className="animate-pulse">
          <div className="h-[260px] bg-[var(--yo-divider)]" />
          <div className="max-w-xl mx-auto w-full px-5 pt-5 space-y-4">
            <div className="bg-white rounded-lg border border-[var(--yo-divider)] p-5 space-y-3">
              <div className="h-5 bg-[var(--yo-surface)] rounded w-28" />
              <div className="h-7 bg-[var(--yo-surface)] rounded w-3/4" />
              <div className="h-4 bg-[var(--yo-surface)] rounded w-1/2" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !listing) {
    return (
      <div className="min-h-screen bg-[var(--yo-surface)] flex flex-col relative">
        <FloatingBackButton navigate={navigate} />
        <main className="flex-1 max-w-xl mx-auto w-full px-5 pt-16">
          <div className="bg-white rounded-lg border border-[var(--yo-divider)] p-8 text-center">
            <p className="text-[18px] font-bold text-[var(--yo-dark)] mb-2">Advertentie niet gevonden</p>
            <p className="text-[13px] text-[var(--yo-dark)] mb-4">Deze advertentie bestaat niet meer of is verwijderd.</p>
            <Button onClick={() => navigate("/dashboard")} className="h-[56px] rounded-lg bg-[var(--yo-teal)] text-black text-[15px] font-bold" data-testid="button-back-dashboard">
              Terug naar dashboard
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const style = FRESH_BADGE_STYLES[listing.fresh_label] ?? FRESH_BADGE_STYLES.ouder;
  const hasImage = !!listing.image_url;
  const gradient = getCityGradient(listing.city);

  const scoreColor = listing.match_score != null
    ? listing.match_score >= 90 ? "bg-[var(--yo-pink)] text-[var(--yo-dark)]"
    : listing.match_score >= 75 ? "bg-[var(--yo-chip-bg)] text-[var(--yo-dark)]"
    : "bg-[var(--yo-surface)] text-[var(--yo-dark)]"
    : "";

  return (
    <div className="min-h-screen bg-[var(--yo-surface)] flex flex-col relative">
      <FloatingBackButton navigate={navigate} />

      <div className="relative">
        {hasImage && !imgError ? (
          <img
            src={listing.image_url!}
            alt={listing.title}
            className="w-full h-[260px] object-cover"
            onError={() => setImgError(true)}
            referrerPolicy="no-referrer"
            data-testid="img-listing-hero"
          />
        ) : (
          <div className={`w-full h-[260px] bg-gradient-to-br ${gradient} flex items-center justify-center relative`}>
            <div className="absolute inset-0 bg-black/5" />
            <div className="flex flex-col items-center gap-2 text-white/60">
              <ImageIcon className="w-10 h-10" />
              <span className="text-[13px] font-medium capitalize">{listing.source}</span>
            </div>
          </div>
        )}

        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm ${style.bg} ${style.text}`} data-testid="badge-freshness">
            {FRESH_LABEL_TEXT[listing.fresh_label] ?? listing.fresh_label}
          </span>
          <span className="text-[11px] font-medium text-white/90 bg-black/30 backdrop-blur-sm px-2.5 py-1 rounded-full flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {relativeTime(listing.first_seen_at)}
          </span>
        </div>
      </div>

      <main className="flex-1 max-w-xl mx-auto w-full px-5 -mt-6 relative z-10 pb-36">
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-[var(--yo-divider)] p-5">
            {listing.match_score != null && listing.match_label && (
              <div className="mb-3" data-testid="listing-score-badge">
                <span className={`inline-flex text-[13px] font-bold px-3.5 py-1.5 rounded-full ${scoreColor}`}>
                  {displayMatchLabel(listing.match_score, listing.match_label)} · {listing.match_score}%
                </span>
              </div>
            )}

            <h1 className="text-[24px] font-[800] text-[var(--yo-dark)] leading-[1.2] tracking-[-0.02em] uppercase mb-2" data-testid="text-listing-title">
              {listing.title}
            </h1>

            <div className="flex items-center gap-1.5 text-[14px] text-[var(--yo-dark)] mb-4">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span data-testid="text-listing-location">
                {listing.city}
              </span>
            </div>

            {listing.price > 0 && (
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-[28px] font-[800] text-[var(--yo-dark)]" data-testid="text-listing-price">€{listing.price}</span>
                <span className="text-[15px] font-medium text-[var(--yo-dark)]">/ mnd</span>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border border-[var(--yo-divider)] p-5">
            <h2 className="text-section-title mb-4">Details</h2>
            <div className="grid grid-cols-2 gap-4">
              {listing.bedrooms > 0 && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--yo-chip-bg)] flex items-center justify-center">
                    <BedDouble className="w-5 h-5 text-[var(--yo-dark)]" />
                  </div>
                  <div>
                    <p className="text-[12px] text-[var(--yo-dark)]">Slaapkamers</p>
                    <p className="text-[15px] font-semibold text-[var(--yo-dark)]" data-testid="text-listing-bedrooms">{listing.bedrooms}</p>
                  </div>
                </div>
              )}

              {listing.size_m2 > 0 && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--yo-chip-bg)] flex items-center justify-center">
                    <Ruler className="w-5 h-5 text-[var(--yo-dark)]" />
                  </div>
                  <div>
                    <p className="text-[12px] text-[var(--yo-dark)]">Oppervlakte</p>
                    <p className="text-[15px] font-semibold text-[var(--yo-dark)]" data-testid="text-listing-size">{listing.size_m2} m²</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--yo-chip-bg)] flex items-center justify-center">
                  <Globe className="w-5 h-5 text-[var(--yo-dark)]" />
                </div>
                <div>
                  <p className="text-[12px] text-[var(--yo-dark)]">Bron</p>
                  <p className="text-[15px] font-bold capitalize" style={{ color: "var(--yo-pink)" }} data-testid="text-listing-source">{listing.source}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--yo-chip-bg)] flex items-center justify-center">
                  <Clock className="w-5 h-5 text-[var(--yo-dark)]" />
                </div>
                <div>
                  <p className="text-[12px] text-[var(--yo-dark)]">Geplaatst</p>
                  <p className="text-[15px] font-semibold text-[var(--yo-dark)]" data-testid="text-listing-time">{relativeTime(listing.first_seen_at)}</p>
                </div>
              </div>
            </div>
          </div>

          {listing.match_reasons && listing.match_reasons.length > 0 && (
            <div className="bg-white rounded-lg border border-[var(--yo-divider)] p-5" data-testid="section-why-match">
              <h2 className="text-section-title mb-4">Waarom deze match?</h2>
              <div className="flex flex-col gap-3">
                {listing.match_reasons.map((reason) => {
                  const detail = MATCH_REASON_DETAIL[reason];
                  return (
                    <div key={reason} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#EAF9DF] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <CheckCircle2 className="w-4 h-4 text-[#78D953]" />
                      </div>
                      <div>
                        <p className="text-[14px] font-semibold text-[var(--yo-dark)]">{detail?.label ?? reason}</p>
                        {detail?.description && (
                          <p className="text-[13px] text-[var(--yo-dark)] mt-0.5">{detail.description}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[var(--yo-divider)] p-4 pb-5 z-10">
        <div className="max-w-xl mx-auto flex flex-col gap-2">
          <div className="flex gap-2">
            <Button
              onClick={() => setApplyOpen(true)}
              className="flex-1 h-[56px] rounded-lg bg-[var(--yo-teal)] text-black text-[15px] font-bold flex items-center justify-center gap-2"
              data-testid="button-reageer-detail"
            >
              <Zap className="w-4 h-4" />
              Reageer direct
            </Button>
            {listing.url && (
              <a href={listing.url} target="_blank" rel="noopener noreferrer">
                <Button
                  variant="outline"
                  className="h-[56px] px-5 rounded-lg border border-[var(--yo-divider)] bg-white text-[var(--yo-dark)] text-[15px] font-bold flex items-center gap-2"
                  data-testid="button-view-original"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open originele advertentie
                </Button>
              </a>
            )}
          </div>
        </div>
      </div>

      <ApplySheet
        listing={{
          id: listing.id,
          title: listing.title,
          city: listing.city,

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
          if (session?.access_token) {
            fetch(`/api/matches/${listing.id}/applied`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ applied: true }),
            }).catch(() => {});
          }
          setApplyOpen(false);
        }}
      />
    </div>
  );
}
