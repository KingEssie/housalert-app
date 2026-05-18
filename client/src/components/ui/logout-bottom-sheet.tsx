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
        className="bg-white w-full max-w-[480px] rounded-t-[20px] px-5 pt-6 animate-in slide-in-from-bottom-4 duration-200"
        style={{ paddingBottom: "max(84px, calc(env(safe-area-inset-bottom, 0px) + 76px))" }}
        onClick={e => e.stopPropagation()}
        data-testid="sheet-logout"
      >
        <p className="text-[18px] font-semibold text-ha-text mb-5" data-testid="text-logout-title">
          {t("profile.logoutSheetTitle")}
        </p>

        <button
          onClick={onConfirm}
          disabled={loading}
          className="w-full h-[56px] rounded-full text-[16px] font-semibold transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 mb-3"
          style={{ backgroundColor: "#85fb8c", color: "#111111" }}
          data-testid="button-logout-confirm"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {t("profile.logoutSheetConfirm")}
        </button>

        <button
          onClick={onClose}
          disabled={loading}
          className="w-full h-[56px] rounded-full text-[16px] font-semibold transition-all active:scale-[0.98] disabled:opacity-50"
          style={{ backgroundColor: "white", border: "1.5px solid #bbadfb", color: "#111111" }}
          data-testid="button-logout-cancel"
        >
          {t("profile.logoutSheetCancel")}
        </button>
      </div>
    </div>
  );
}
