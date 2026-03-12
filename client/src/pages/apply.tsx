import { apiFetch } from "@/lib/api-base";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_TEMPLATE, fillTemplate } from "@/lib/application-letter";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { useLocation, useRoute } from "wouter";
import {
  Copy,
  CheckCircle2,
  ArrowLeft,
  FileText,
  Phone,
  FolderOpen,
  AlertCircle,
  ImageIcon,
} from "lucide-react";

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

interface ListingData {
  id: string;
  title: string;
  city: string;
  district?: string;
  price: number;
  url?: string | null;
  image_url?: string | null;
  source?: string | null;
}

export default function ApplyPage() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/apply/:id");
  const listingId = params?.id;
  const { user, session } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [marked, setMarked] = useState(false);
  const [editedLetter, setEditedLetter] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  const accessToken = session?.access_token;

  const { data: listing, isLoading: listingLoading } = useQuery<ListingData | null>({
    queryKey: ["/api/listing", listingId],
    queryFn: async () => {
      const res = await apiFetch(`/api/listings/${listingId}`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!listingId && !!accessToken,
  });

  const { data: profileData } = useQuery<ProfileData>({
    queryKey: ["/api/profile-data"],
    queryFn: async () => {
      const res = await apiFetch("/api/profile-data", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return { application_template: null };
      return res.json();
    },
    enabled: !!accessToken,
  });

  const { data: notifSettings } = useQuery<NotifSettings>({
    queryKey: ["/api/notifications/settings"],
    queryFn: async () => {
      const res = await apiFetch("/api/notifications/settings", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return { phone_e164: null };
      return res.json();
    },
    enabled: !!accessToken,
  });

  if (listingLoading || !listing) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#0D6EFD] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(editedLetter ?? filledLetter);
      toast({ title: t("applySheet.copied"), description: t("applySheet.copiedDesc") });
      return true;
    } catch {
      toast({ title: t("applySheet.copyFailed"), description: t("applySheet.copyFailedDesc"), variant: "destructive" });
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
    const MATCH_APPLIED_KEY = "housalert_match_applied";
    try {
      const stored = localStorage.getItem(MATCH_APPLIED_KEY);
      const appliedSet = new Set<string>(stored ? JSON.parse(stored) : []);
      appliedSet.add(listing.id);
      localStorage.setItem(MATCH_APPLIED_KEY, JSON.stringify(Array.from(appliedSet)));
    } catch {}
    if (accessToken) {
      apiFetch(`/api/matches/${listing.id}/applied`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ applied: true }),
      }).catch(() => {});
    }
    toast({ title: t("applySheet.markedApplied"), description: t("applySheet.markedAppliedDesc") });
  };

  const hasImage = !!listing.image_url;
  const gradient = getCityGradient(listing.city);

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col relative">
      <button
        onClick={() => window.history.length > 1 ? window.history.back() : navigate("/dashboard")}
        className="fixed top-[calc(12px+env(safe-area-inset-top))] left-4 z-20 w-12 h-12 rounded-full bg-[#F3F4F6] shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center justify-center"
        data-testid="button-back-apply"
      >
        <ArrowLeft className="w-5 h-5 text-[#1F2937]" />
      </button>

      <div className="relative">
        {hasImage && !imgError ? (
          <img
            src={listing.image_url!}
            alt={listing.title}
            className="w-full h-[220px] object-cover"
            onError={() => setImgError(true)}
            referrerPolicy="no-referrer"
            data-testid="img-apply-hero"
          />
        ) : (
          <div className={`w-full h-[220px] bg-gradient-to-br ${gradient} flex items-center justify-center relative`}>
            <div className="absolute inset-0 bg-black/5" />
            <div className="flex flex-col items-center gap-2 text-white/60">
              <ImageIcon className="w-8 h-8" />
              <span className="text-[12px] font-medium">{listing.source}</span>
            </div>
          </div>
        )}
      </div>

      <main className="flex-1 max-w-xl mx-auto w-full px-5 -mt-4 relative z-10 pb-8">
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 mb-4">
          <h1 className="text-[24px] font-[800] text-[#111C3D] leading-[1.2] tracking-[-0.02em] mb-1" data-testid="text-apply-title">
            {t("applySheet.title")}
          </h1>
          <p className="text-[14px] text-[#6B7280] line-clamp-1" data-testid="text-apply-listing-summary">
            {listing.title} · {listing.city} · €{listing.price}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 mb-4">
          <div className="flex items-center gap-3 mb-4">
            {readinessItems.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.id} className="flex items-center gap-1.5" data-testid={`readiness-${item.id}`}>
                  {item.done ? (
                    <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-[#9CA3AF]" />
                  )}
                  <span className={`text-[13px] ${item.done ? "text-[#1F2937] font-medium" : "text-[#9CA3AF]"}`}>
                    {t(item.labelKey)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="bg-[#F5F7FA] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[13px] font-semibold text-[#111C3D]">{t("applySheet.applicationLetter")}</p>
              {readyCount === readinessItems.length && (
                <span className="text-[11px] font-medium text-[#16A34A] bg-[#16A34A]/10 px-2 py-0.5 rounded-full" data-testid="badge-ready">
                  {t("applySheet.readyToSend")}
                </span>
              )}
            </div>
            <textarea
              className="w-full text-[14px] text-[#1F2937] leading-relaxed font-[inherit] bg-transparent border-none outline-none resize-none min-h-[220px]"
              value={editedLetter ?? filledLetter}
              onChange={(e) => setEditedLetter(e.target.value)}
              data-testid="apply-letter-preview"
              autoComplete="off"
              autoCorrect="on"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {listing.url ? (
            <Button
              onClick={handleCopyAndOpen}
              className="w-full h-[56px] rounded-full bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white text-[15px] font-semibold"
              data-testid="button-copy-and-open"
            >
              <Copy className="w-4 h-4 mr-2" />
              {t("applySheet.copyAndApply")}
            </Button>
          ) : (
            <Button
              onClick={handleCopy}
              className="w-full h-[56px] rounded-full bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white text-[15px] font-semibold"
              data-testid="button-copy-letter"
            >
              <Copy className="w-4 h-4 mr-2" />
              {t("applySheet.copyLetter")}
            </Button>
          )}

          <div className="flex gap-2.5">
            {listing.url && (
              <Button
                variant="outline"
                onClick={handleCopy}
                className="flex-1 h-[48px] rounded-full border-[#E5E7EB] text-[#1F2937] text-[14px] font-semibold"
                data-testid="button-copy-only"
              >
                <Copy className="w-3.5 h-3.5 mr-1.5" />
                {t("applySheet.copyOnly")}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleMarkApplied}
              disabled={marked}
              className={`flex-1 h-[48px] rounded-full text-[14px] font-semibold ${
                marked
                  ? "bg-[#16A34A]/10 text-[#1F2937] border-[#16A34A]/20"
                  : "border-[#E5E7EB] text-[#1F2937]"
              }`}
              data-testid="button-mark-applied"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
              {marked ? t("applySheet.applied") : t("applySheet.markApplied")}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
