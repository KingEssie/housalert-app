import { apiFetch } from "@/lib/api-base";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getDefaultTemplate, fillTemplate } from "@/lib/application-letter";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
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
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  occupation?: string | null;
  monthly_income?: number | null;
}

interface NotifSettings {
  phone_e164: string | null;
}

interface ReadinessItem {
  id: string;
  labelKey: string;
  done: boolean;
  icon: typeof FileText;
}

export function ApplySheet({ listing, open, onClose, onMarkedApplied }: ApplySheetProps) {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const { t, locale } = useTranslation();
  const [marked, setMarked] = useState(false);
  const [editedLetter, setEditedLetter] = useState<string | null>(null);

  const { data: profileData } = useQuery<ProfileData>({
    queryKey: ["/api/profile-data"],
    queryFn: async () => {
      const res = await apiFetch("/api/profile-data", {
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
      const res = await apiFetch("/api/notifications/settings", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) return { phone_e164: null };
      return res.json();
    },
    enabled: open && !!session?.access_token,
  });

  useEffect(() => {
    if (open) {
      setMarked(false);
      setEditedLetter(null);
    }
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

  const defaultTemplate = getDefaultTemplate(locale);
  const tmpl = profileData?.application_template || defaultTemplate;
  const hasTemplate = !!(profileData?.application_template && profileData.application_template.trim().length > 0) || tmpl === defaultTemplate;
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
      name: [profileData?.first_name, profileData?.last_name].filter(Boolean).join(" ") || undefined,
      phone: profileData?.phone || notifSettings?.phone_e164 || undefined,
      occupation: profileData?.occupation || undefined,
      income: profileData?.monthly_income != null ? String(profileData.monthly_income) : undefined,
    }
  );

  const checklist = (profileData?.document_checklist ?? {}) as Record<string, boolean>;
  const incomeIds = ["income_proof", "employment_contract", "payslips", "tax_returns", "bank_statements"];
  const hasDocuments = incomeIds.filter((id) => checklist[id]).length >= 2;
  const phoneValue = profileData?.phone || notifSettings?.phone_e164;
  const hasPhone = !!(phoneValue && phoneValue.length > 5);

  const readinessItems: ReadinessItem[] = [
    { id: "letter", labelKey: "applySheet.letter", done: hasTemplate, icon: FileText },
    { id: "phone", labelKey: "applySheet.phone", done: hasPhone, icon: Phone },
    { id: "documents", labelKey: "applySheet.documents", done: hasDocuments, icon: FolderOpen },
  ];
  const readyCount = readinessItems.filter((r) => r.done).length;

  const handleCopyAndRespond = async () => {
    let copied = false;
    try {
      await navigator.clipboard.writeText(editedLetter ?? filledLetter);
      copied = true;
    } catch {
      toast({ title: t("applySheet.copyFailed"), description: t("applySheet.copyFailedDesc"), variant: "destructive" });
    }

    if (!copied) return;

    toast({ title: t("applySheet.copiedOpening") });

    setMarked(true);
    onMarkedApplied();

    if (listing.url) {
      setTimeout(() => {
        window.open(listing.url!, "_blank", "noopener");
      }, 750);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        data-testid="apply-sheet-backdrop"
      />

      <div className="relative w-full max-w-xl bg-ha-card rounded-t-3xl shadow-[0_-8px_40px_rgba(0,0,0,0.12)] max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-ha-text-muted" />
            <h2 className="text-[18px] font-medium text-ha-text">{t("applySheet.title")}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-ha-surface flex items-center justify-center hover:bg-ha-card-hover transition-colors"
            data-testid="button-close-apply-sheet"
          >
            <X className="w-4 h-4 text-ha-text-muted" />
          </button>
        </div>

        <div className="px-6 pb-2">
          <p className="text-[13px] text-ha-text line-clamp-1">{listing.title} · {listing.city}</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-4">
          <div className="flex items-center gap-3 mt-2 mb-4 px-1">
            {readinessItems.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.id} className="flex items-center gap-1.5" data-testid={`readiness-${item.id}`}>
                  {item.done ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-ha-success" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-ha-text-secondary" />
                  )}
                  <span className={`text-[12px] ${item.done ? "text-ha-text" : "text-ha-text-secondary"}`}>
                    {t(item.labelKey)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="bg-ha-surface rounded-[6px] p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] font-medium text-ha-text tracking-wide">{t("applySheet.applicationLetter")}</p>
              {readyCount === readinessItems.length && (
                <span className="text-[11px] font-medium text-ha-text bg-ha-surface px-2 py-0.5 rounded-full" data-testid="badge-ready">
                  {t("applySheet.readyToSend")}
                </span>
              )}
            </div>
            <textarea
              className="w-full text-[14px] text-ha-text leading-relaxed font-[inherit] bg-transparent border-none outline-none resize-none min-h-[200px]"
              value={editedLetter ?? filledLetter}
              onChange={(e) => setEditedLetter(e.target.value)}
              data-testid="apply-letter-preview"
              autoComplete="off"
              autoCorrect="on"
            />
          </div>
        </div>

        <div className="px-6 pb-6 pt-3 border-t border-ha-card-border flex flex-col gap-2.5">
          <Button
            onClick={handleCopyAndRespond}
            className="w-full h-[48px] rounded-[6px] bg-ha-primary hover:bg-ha-primary-hover text-white text-[14px] font-medium"
            data-testid="button-copy-and-respond"
          >
            <Copy className="w-4 h-4 mr-2" />
            {t("applySheet.copyAndApply")}
          </Button>
        </div>
      </div>
    </div>
  );
}
