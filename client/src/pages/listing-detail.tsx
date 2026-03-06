import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_TEMPLATE, fillTemplate } from "@/lib/application-letter";
import { ArrowLeft, MapPin, Euro, BedDouble, Ruler, ExternalLink, Clock, Globe, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

const FRESH_BADGE_STYLES: Record<string, { bg: string; text: string }> = {
  net_binnen: { bg: "bg-green-100", text: "text-green-700" },
  nieuw: { bg: "bg-blue-100", text: "text-blue-700" },
  vandaag: { bg: "bg-yellow-100", text: "text-yellow-700" },
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
}

interface ProfileData {
  application_template: string | null;
  search_buddy_email?: string | null;
}

interface NotifSettings {
  phone_e164: string | null;
}

export default function ListingDetailPage() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/listing/:id");
  const id = params?.id;
  const { user, session } = useAuth();
  const { toast } = useToast();

  const { data: listing, isLoading, isError } = useQuery<Listing>({
    queryKey: ["/api/listings", id],
    queryFn: async () => {
      const res = await fetch(`/api/listings/${id}`);
      if (!res.ok) throw new Error("Listing not found");
      return res.json();
    },
    enabled: !!id,
  });

  const { data: profileData } = useQuery<ProfileData>({
    queryKey: ["/api/profile-data"],
    queryFn: async () => {
      const res = await fetch("/api/profile-data", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) return { application_template: null };
      return res.json();
    },
    enabled: !!session?.access_token,
  });

  const { data: notifSettings } = useQuery<NotifSettings>({
    queryKey: ["/api/notifications/settings"],
    queryFn: async () => {
      const res = await fetch("/api/notifications/settings", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) return { phone_e164: null };
      return res.json();
    },
    enabled: !!session?.access_token,
  });

  const handleCopyLetter = async () => {
    if (!listing) return;
    const tmpl = profileData?.application_template || DEFAULT_TEMPLATE;
    const filled = fillTemplate(
      tmpl,
      {
        title: listing.title,
        city: listing.city,
        price: listing.price,
        address: (listing as any).address || undefined,
      },
      {
        email: user?.email || undefined,
        name: user?.email?.split("@")[0] || undefined,
        phone: notifSettings?.phone_e164 || undefined,
      }
    );
    try {
      await navigator.clipboard.writeText(filled);
      toast({ title: "Gekopieerd!", description: "Je aanmeldingsbrief is naar het klembord gekopieerd." });
    } catch {
      toast({ title: "Fout", description: "Kon niet kopiëren. Probeer het opnieuw.", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] flex flex-col">
        <header className="w-full bg-white sticky top-0 z-20 border-b border-[#EAEFF5]">
          <div className="max-w-xl mx-auto px-6 h-[60px] flex items-center">
            <button onClick={() => navigate("/dashboard")} className="w-10 h-10 rounded-full bg-[#F2F5F8] flex items-center justify-center hover:bg-[#EAEFF5] transition-colors" data-testid="button-back">
              <ArrowLeft className="w-5 h-5 text-[#72839A]" />
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
      <div className="min-h-screen bg-[#F7F8FA] flex flex-col">
        <header className="w-full bg-white sticky top-0 z-20 border-b border-[#EAEFF5]">
          <div className="max-w-xl mx-auto px-6 h-[60px] flex items-center">
            <button onClick={() => navigate("/dashboard")} className="w-10 h-10 rounded-full bg-[#F2F5F8] flex items-center justify-center hover:bg-[#EAEFF5] transition-colors" data-testid="button-back">
              <ArrowLeft className="w-5 h-5 text-[#72839A]" />
            </button>
          </div>
        </header>
        <main className="flex-1 max-w-xl mx-auto w-full px-6 pt-6">
          <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-8 text-center">
            <p className="text-[18px] font-bold text-[#1B2A4A] mb-2">Advertentie niet gevonden</p>
            <p className="text-[13px] text-[#72839A] mb-4">Deze advertentie bestaat niet meer of is verwijderd.</p>
            <Button onClick={() => navigate("/dashboard")} className="h-[56px] rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white text-[16px] font-semibold" data-testid="button-back-dashboard">
              Terug naar dashboard
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const style = FRESH_BADGE_STYLES[listing.fresh_label] ?? FRESH_BADGE_STYLES.ouder;

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex flex-col">
      <header className="w-full bg-white sticky top-0 z-20 border-b border-[#EAEFF5]">
        <div className="max-w-xl mx-auto px-6 h-[60px] flex items-center">
          <button onClick={() => navigate("/dashboard")} className="w-10 h-10 rounded-full bg-[#F2F5F8] flex items-center justify-center hover:bg-[#EAEFF5] transition-colors" data-testid="button-back">
            <ArrowLeft className="w-5 h-5 text-[#72839A]" />
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
              <span className="text-[12px] text-[#9BA5B7] flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {relativeTime(listing.first_seen_at)}
              </span>
            </div>

            <h1 className="text-[28px] font-extrabold text-[#1B2A4A] leading-tight tracking-[-0.02em] mb-2" data-testid="text-listing-title">
              {listing.title}
            </h1>

            <div className="flex items-center gap-1.5 text-[15px] text-[#72839A]">
              <MapPin className="w-4 h-4" />
              <span data-testid="text-listing-location">
                {listing.city}{listing.district ? `, ${listing.district}` : ""}
              </span>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6">
            <h2 className="text-[18px] font-bold text-[#1B2A4A] mb-4">Details</h2>
            <div className="grid grid-cols-2 gap-4">
              {listing.price > 0 && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#EDF2FF] flex items-center justify-center">
                    <Euro className="w-5 h-5 text-[#0066FF]" />
                  </div>
                  <div>
                    <p className="text-[13px] text-[#9BA5B7]">Huur</p>
                    <p className="text-[15px] font-semibold text-[#1B2A4A]" data-testid="text-listing-price">€{listing.price}/mnd</p>
                  </div>
                </div>
              )}

              {listing.bedrooms > 0 && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#EDF2FF] flex items-center justify-center">
                    <BedDouble className="w-5 h-5 text-[#0066FF]" />
                  </div>
                  <div>
                    <p className="text-[13px] text-[#9BA5B7]">Slaapkamers</p>
                    <p className="text-[15px] font-semibold text-[#1B2A4A]" data-testid="text-listing-bedrooms">{listing.bedrooms}</p>
                  </div>
                </div>
              )}

              {listing.size_m2 > 0 && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#EDF2FF] flex items-center justify-center">
                    <Ruler className="w-5 h-5 text-[#0066FF]" />
                  </div>
                  <div>
                    <p className="text-[13px] text-[#9BA5B7]">Oppervlakte</p>
                    <p className="text-[15px] font-semibold text-[#1B2A4A]" data-testid="text-listing-size">{listing.size_m2} m²</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#EDF2FF] flex items-center justify-center">
                  <Globe className="w-5 h-5 text-[#0066FF]" />
                </div>
                <div>
                  <p className="text-[13px] text-[#9BA5B7]">Bron</p>
                  <p className="text-[15px] font-semibold text-[#1B2A4A] capitalize" data-testid="text-listing-source">{listing.source}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#EAEFF5] p-5 z-10">
        <div className="max-w-xl mx-auto flex flex-col gap-2">
          <Button
            onClick={handleCopyLetter}
            variant="outline"
            size="lg"
            className="w-full h-[48px] rounded-xl text-[15px] font-semibold border-[#EAEFF5] text-[#1B2A4A] flex items-center gap-2"
            data-testid="button-copy-letter"
          >
            <Copy className="w-4 h-4" />
            Kopieer aanmeldingsbrief
          </Button>
          {listing.url && (
            <a href={listing.url} target="_blank" rel="noopener noreferrer">
              <Button
                size="lg"
                className="w-full h-[56px] rounded-xl text-[16px] font-semibold shadow-none bg-[#0066FF] hover:bg-[#0052CC] flex items-center gap-2"
                data-testid="button-view-original"
              >
                Bekijk originele advertentie
                <ExternalLink className="w-4.5 h-4.5" />
              </Button>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
