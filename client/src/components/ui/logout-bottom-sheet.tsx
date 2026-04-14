import { Loader2 } from "lucide-react";
import { useTranslation } from "@/i18n";

interface LogoutBottomSheetProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

export function LogoutBottomSheet({ open, onClose, onConfirm, loading }: LogoutBottomSheetProps) {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
      onClick={onClose}
      data-testid="overlay-logout"
    >
      <div
        className="bg-white w-full max-w-[480px] rounded-t-[16px] px-5 pt-6 pb-[max(24px,env(safe-area-inset-bottom))] shadow-[0_-4px_24px_rgba(0,0,0,0.10)] animate-in slide-in-from-bottom-4 duration-200"
        onClick={e => e.stopPropagation()}
        data-testid="sheet-logout"
      >
        <p className="text-[18px] font-semibold text-[#000000] mb-5" data-testid="text-logout-title">
          {t("profile.logoutSheetTitle")}
        </p>

        <button
          onClick={onConfirm}
          disabled={loading}
          className="w-full h-[58px] rounded-[10px] bg-ha-primary hover:bg-ha-primary-hover text-white text-[16px] font-semibold transition-colors active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 mb-3"
          data-testid="button-logout-confirm"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {t("profile.logoutSheetConfirm")}
        </button>

        <button
          onClick={onClose}
          disabled={loading}
          className="w-full h-[58px] rounded-[10px] border border-ha-primary text-ha-primary text-[16px] font-semibold hover:bg-ha-primary/5 transition-colors active:scale-[0.98] disabled:opacity-50"
          data-testid="button-logout-cancel"
        >
          {t("profile.logoutSheetCancel")}
        </button>
      </div>
    </div>
  );
}
