import { Loader2 } from "lucide-react";
import { useTranslation } from "@/i18n";

interface OwnerDisconnectSheetProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

export function OwnerDisconnectSheet({ open, onClose, onConfirm, loading }: OwnerDisconnectSheetProps) {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
      onClick={onClose}
      data-testid="overlay-owner-disconnect"
    >
      <div
        className="bg-white w-full max-w-[480px] rounded-t-[16px] px-5 pt-6 pb-[max(24px,env(safe-area-inset-bottom))] shadow-[0_-4px_24px_rgba(0,0,0,0.10)] animate-in slide-in-from-bottom-4 duration-200"
        onClick={e => e.stopPropagation()}
        data-testid="sheet-owner-disconnect"
      >
        <p className="text-[18px] font-semibold text-ha-text mb-2" data-testid="text-owner-disconnect-title">
          {t("zoekbuddyPage.ownerDisconnectTitle")}
        </p>
        <p className="text-[15px] text-ha-text-muted leading-snug mb-5" data-testid="text-owner-disconnect-desc">
          {t("zoekbuddyPage.ownerDisconnectDesc")}
        </p>

        <button
          onClick={onConfirm}
          disabled={loading}
          className="w-full h-[58px] rounded-[10px] bg-ha-btn-destructive hover:bg-ha-danger text-white text-[16px] font-semibold transition-colors active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 mb-3"
          data-testid="button-owner-disconnect-confirm"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {t("zoekbuddyPage.ownerDisconnectConfirm")}
        </button>

        <button
          onClick={onClose}
          disabled={loading}
          className="w-full h-[58px] rounded-[10px] border border-ha-card-border text-ha-text-secondary text-[16px] font-semibold hover:bg-ha-surface transition-colors active:scale-[0.98] disabled:opacity-50"
          data-testid="button-owner-disconnect-cancel"
        >
          {t("zoekbuddyPage.ownerDisconnectCancel")}
        </button>
      </div>
    </div>
  );
}
