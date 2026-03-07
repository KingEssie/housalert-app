import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_TEMPLATE, fillTemplate } from "@/lib/application-letter";
import { Button } from "@/components/ui/button";
import {
  Copy,
  ExternalLink,
  CheckCircle2,
  X,
  Send,
  FileText,
  Phone,
  FolderOpen,
  AlertCircle,
} from "lucide-react";

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
  document_checklist?: Record<string, boolean> | null;
}

interface NotifSettings {
  phone_e164: string | null;
}

interface ReadinessItem {
  id: string;
  label: string;
  done: boolean;
  icon: typeof FileText;
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
  const hasTemplate = !!(profileData?.application_template && profileData.application_template.trim().length > 0) || tmpl === DEFAULT_TEMPLATE;
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

  const checklist = (profileData?.document_checklist ?? {}) as Record<string, boolean>;
  const incomeIds = ["income_proof", "employment_contract", "payslips", "tax_returns", "bank_statements"];
  const hasDocuments = incomeIds.filter((id) => checklist[id]).length >= 2;
  const hasPhone = !!(notifSettings?.phone_e164 && notifSettings.phone_e164.length > 5);

  const readinessItems: ReadinessItem[] = [
    { id: "letter", label: "Reactiebrief", done: hasTemplate, icon: FileText },
    { id: "phone", label: "Telefoonnummer", done: hasPhone, icon: Phone },
    { id: "documents", label: "Documenten", done: hasDocuments, icon: FolderOpen },
  ];
  const readyCount = readinessItems.filter((r) => r.done).length;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(filledLetter);
      toast({ title: "Gekopieerd!", description: "Je aanmeldingsbrief staat op het klembord." });
      return true;
    } catch {
      toast({ title: "Fout", description: "Kon niet kopiëren.", variant: "destructive" });
      return false;
    }
  };

  const handleCopyAndOpen = async () => {
    await handleCopy();
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
            <Send className="w-5 h-5 text-[#673DE6]" />
            <h2 className="text-[18px] font-[700] text-[#1F2937]">Reageer nu</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#F3F4F6] flex items-center justify-center hover:bg-[#E5E7EB] transition-colors"
            data-testid="button-close-apply-sheet"
          >
            <X className="w-4 h-4 text-[#6B7280]" />
          </button>
        </div>

        <div className="px-6 pb-2">
          <p className="text-[13px] text-[#6B7280] line-clamp-1">{listing.title} · {listing.city}</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-4">
          <div className="flex items-center gap-3 mt-2 mb-4 px-1">
            {readinessItems.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.id} className="flex items-center gap-1.5" data-testid={`readiness-${item.id}`}>
                  {item.done ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-[#C5CBD6]" />
                  )}
                  <span className={`text-[12px] ${item.done ? "text-[#6B7280]" : "text-[#C5CBD6]"}`}>
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="bg-[#F3F4F6] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] font-semibold text-[#6B7280] uppercase tracking-wide">Aanmeldingsbrief</p>
              {readyCount === readinessItems.length && (
                <span className="text-[11px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full" data-testid="badge-ready">
                  Klaar om te versturen
                </span>
              )}
            </div>
            <pre className="text-[14px] text-[#1F2937] leading-relaxed whitespace-pre-wrap font-[inherit]" data-testid="apply-letter-preview">
              {filledLetter}
            </pre>
          </div>
        </div>

        <div className="px-6 pb-6 pt-3 border-t border-[#F3F4F6] flex flex-col gap-2.5">
          {listing.url ? (
            <Button
              onClick={handleCopyAndOpen}
              className="w-full h-[48px] rounded-xl bg-[#673DE6] hover:bg-[#5B30D6] text-white text-[14px] font-semibold"
              data-testid="button-copy-and-open"
            >
              <Copy className="w-4 h-4 mr-2" />
              Kopieer en reageer
            </Button>
          ) : (
            <Button
              onClick={handleCopy}
              className="w-full h-[48px] rounded-xl bg-[#673DE6] hover:bg-[#5B30D6] text-white text-[14px] font-semibold"
              data-testid="button-copy-letter-sheet"
            >
              <Copy className="w-4 h-4 mr-2" />
              Kopieer brief
            </Button>
          )}

          <div className="flex gap-2">
            {listing.url && (
              <Button
                variant="outline"
                onClick={handleCopy}
                className="flex-1 h-[44px] rounded-xl border-[#E5E7EB] text-[#1F2937] text-[13px] font-semibold"
                data-testid="button-copy-only"
              >
                <Copy className="w-3.5 h-3.5 mr-1.5" />
                Alleen kopiëren
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleMarkApplied}
              disabled={marked}
              className={`flex-1 h-[44px] rounded-xl text-[13px] font-semibold ${
                marked
                  ? "bg-green-50 text-green-700 border-green-200"
                  : "border-[#E5E7EB] text-[#1F2937]"
              }`}
              data-testid="button-mark-applied"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
              {marked ? "Gereageerd" : "Markeer gereageerd"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
