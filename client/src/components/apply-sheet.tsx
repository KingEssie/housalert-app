import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_TEMPLATE, fillTemplate } from "@/lib/application-letter";
import { Copy, ExternalLink, CheckCircle2, X, Send } from "lucide-react";

interface ListingInfo {
  id: string;
  title: string;
  city: string;
  district?: string;
  price: number;
  url?: string | null;
}

interface ApplySheetProps {
  listing: ListingInfo;
  open: boolean;
  onClose: () => void;
  onMarkedApplied: () => void;
}

interface ProfileData {
  application_template: string | null;
}

interface NotifSettings {
  phone_e164: string | null;
}

export function ApplySheet({ listing, open, onClose, onMarkedApplied }: ApplySheetProps) {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const [marked, setMarked] = useState(false);

  const { data: profileData } = useQuery<ProfileData>({
    queryKey: ["/api/profile-data"],
    queryFn: async () => {
      const res = await fetch("/api/profile-data", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) return { application_template: null };
      return res.json();
    },
    enabled: open && !!session?.access_token,
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
    enabled: open && !!session?.access_token,
  });

  useEffect(() => {
    if (open) setMarked(false);
  }, [open]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  const tmpl = profileData?.application_template || DEFAULT_TEMPLATE;
  const address = listing.district
    ? `${listing.title}, ${listing.district}`
    : listing.title;
  const filledLetter = fillTemplate(
    tmpl,
    {
      title: listing.title,
      city: listing.city,
      price: listing.price,
      address,
    },
    {
      email: user?.email || undefined,
      name: user?.email?.split("@")[0] || undefined,
      phone: notifSettings?.phone_e164 || undefined,
    }
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(filledLetter);
      toast({ title: "Gekopieerd!", description: "Je aanmeldingsbrief staat op het klembord." });
    } catch {
      toast({ title: "Fout", description: "Kon niet kopiëren.", variant: "destructive" });
    }
  };

  const handleViewListing = () => {
    if (listing.url) {
      window.open(listing.url, "_blank", "noopener");
    }
  };

  const handleMarkApplied = () => {
    setMarked(true);
    onMarkedApplied();
    toast({ title: "Gemarkeerd als gereageerd", description: "Je kunt deze match terugvinden onder 'Gereageerd'." });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        data-testid="apply-sheet-backdrop"
      />

      <div className="relative w-full max-w-xl bg-white rounded-t-3xl shadow-[0_-8px_40px_rgba(0,0,0,0.12)] max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-[#0066FF]" />
            <h2 className="text-[18px] font-[700] text-[#1B2A4A]">Reageer op woning</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#F3F4F8] flex items-center justify-center hover:bg-[#EAEFF5] transition-colors"
            data-testid="button-close-apply-sheet"
          >
            <X className="w-4 h-4 text-[#72839A]" />
          </button>
        </div>

        <div className="px-6 pb-2">
          <p className="text-[13px] text-[#72839A] line-clamp-1">{listing.title}</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-4">
          <div className="bg-[#F3F4F8] rounded-xl p-4 mt-2">
            <p className="text-[12px] font-semibold text-[#72839A] mb-2 uppercase tracking-wide">Aanmeldingsbrief</p>
            <pre className="text-[14px] text-[#1B2A4A] leading-relaxed whitespace-pre-wrap font-[inherit]" data-testid="apply-letter-preview">
              {filledLetter}
            </pre>
          </div>
        </div>

        <div className="px-6 pb-6 pt-3 border-t border-[#F2F5F8] flex flex-col gap-2.5">
          <button
            onClick={handleCopy}
            className="w-full h-[48px] rounded-xl border border-[#EAEFF5] bg-white text-[#1B2A4A] text-[14px] font-semibold hover:bg-[#F3F4F8] transition-colors flex items-center justify-center gap-2"
            data-testid="button-copy-letter-sheet"
          >
            <Copy className="w-4 h-4" />
            Kopieer brief
          </button>

          {listing.url && (
            <button
              onClick={handleViewListing}
              className="w-full h-[48px] rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white text-[14px] font-semibold transition-colors flex items-center justify-center gap-2"
              data-testid="button-view-listing-sheet"
            >
              <ExternalLink className="w-4 h-4" />
              Bekijk woning
            </button>
          )}

          <button
            onClick={handleMarkApplied}
            disabled={marked}
            className={`w-full h-[48px] rounded-xl text-[14px] font-semibold transition-colors flex items-center justify-center gap-2 ${
              marked
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-white border border-[#EAEFF5] text-[#1B2A4A] hover:bg-green-50 hover:text-green-700 hover:border-green-200"
            }`}
            data-testid="button-mark-applied"
          >
            <CheckCircle2 className="w-4 h-4" />
            {marked ? "Gemarkeerd als gereageerd" : "Markeer als gereageerd"}
          </button>
        </div>
      </div>
    </div>
  );
}
