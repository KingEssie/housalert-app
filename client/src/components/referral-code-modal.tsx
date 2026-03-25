import { useState } from "react";
import { X, Copy, Check, Share2, Loader2 } from "lucide-react";
import { useTranslation } from "@/i18n";
import { useToast } from "@/hooks/use-toast";

interface ReferralCodeModalProps {
  open: boolean;
  onClose: () => void;
  code: string | null;
  loading?: boolean;
}

export function ReferralCodeModal({ open, onClose, code, loading }: ReferralCodeModalProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  async function handleCopy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast({ title: t("referral.copied"), description: t("referral.copiedDesc") });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: t("referral.copyFailed"), description: t("referral.copyFailedDesc"), variant: "destructive" });
    }
  }

  async function handleShare() {
    if (!code) return;
    const shareText = `${t("referral.modalBody")}\n\n${t("referral.codeLabel")}: ${code}`;
    if (navigator.share) {
      try {
        await navigator.share({ text: shareText });
      } catch {}
    } else {
      handleCopy();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" data-testid="modal-referral">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-ha-card rounded-[6px] w-[calc(100%-40px)] max-w-[380px] mx-auto p-6 shadow-[0_8px_40px_rgba(0,0,0,0.12)]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-ha-surface flex items-center justify-center"
          data-testid="button-close-referral-modal"
        >
          <X className="w-4 h-4 text-ha-text-muted" />
        </button>

        <h2 className="text-[20px] font-semibold text-ha-text pr-8" data-testid="text-referral-modal-title">
          {t("referral.modalTitle")}
        </h2>
        <p className="text-[14px] text-ha-text-secondary mt-2 leading-relaxed">
          {t("referral.modalBody")}
        </p>

        <div className="mt-6">
          <p className="text-[12px] font-medium text-ha-text-secondary uppercase tracking-wider mb-2">
            {t("referral.codeLabel")}
          </p>
          <div className="bg-ha-surface rounded-[6px] px-5 py-4 flex items-center justify-center" data-testid="text-referral-code">
            {loading ? (
              <Loader2 className="w-5 h-5 text-ha-text-secondary animate-spin" />
            ) : (
              <span className="text-[22px] font-bold tracking-[0.12em] text-ha-text select-all">
                {code || "—"}
              </span>
            )}
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={handleCopy}
            disabled={!code}
            className="flex-1 h-[48px] rounded-[6px] bg-ha-primary text-white text-[15px] font-medium flex items-center justify-center gap-2 active:scale-[0.97] transition-transform disabled:opacity-50"
            data-testid="button-copy-referral"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                {t("referral.copied")}
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                {t("referral.copy")}
              </>
            )}
          </button>

          {typeof navigator !== "undefined" && navigator.share && (
            <button
              onClick={handleShare}
              disabled={!code}
              className="h-[48px] w-[48px] rounded-full border border-ha-card-border bg-ha-card flex items-center justify-center active:scale-[0.97] transition-transform disabled:opacity-50"
              data-testid="button-share-referral"
            >
              <Share2 className="w-5 h-5 text-ha-text" />
            </button>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full mt-3 h-[44px] rounded-[6px] text-[15px] font-medium text-ha-text-secondary active:bg-ha-surface transition-colors"
          data-testid="button-close-referral"
        >
          {t("referral.close")}
        </button>
      </div>
    </div>
  );
}
