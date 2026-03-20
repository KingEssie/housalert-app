import { Gift, ChevronRight } from "lucide-react";
import { useTranslation } from "@/i18n";

interface ReferralPromoCardProps {
  onOpen: () => void;
}

export function ReferralPromoCard({ onOpen }: ReferralPromoCardProps) {
  const { t } = useTranslation();

  return (
    <button
      onClick={onOpen}
      className="w-full bg-white rounded-[20px] border border-[#F0F0F0] shadow-[0_2px_8px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)] p-5 flex items-center gap-4 text-left hover:shadow-[0_4px_16px_rgba(15,23,42,0.08)] transition-all duration-200 active:scale-[0.985]"
      data-testid="card-referral-promo"
    >
      <div className="w-11 h-11 rounded-xl bg-[#FFF7ED] flex items-center justify-center flex-shrink-0">
        <Gift className="w-[22px] h-[22px] text-[#F97316]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-[#F97316] tracking-wider uppercase">
          {t("referral.promoLabel")}
        </p>
        <p className="text-[15px] font-medium text-[#222222] mt-0.5">
          {t("referral.promoBody")}
        </p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <span className="text-[13px] font-medium text-[#F97316]">{t("referral.promoCta")}</span>
        <ChevronRight className="w-4 h-4 text-[#F97316]" />
      </div>
    </button>
  );
}
