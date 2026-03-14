import { PageHeader } from "@/components/ui/page-header";
import { CreditCard, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/i18n";

export default function PaymentMethodPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background" data-testid="page-payment-method">
      <PageHeader title={t("paymentMethodPage.title")} />

      <div className="max-w-xl mx-auto p-4 space-y-4 pb-8">
        <div className="bg-card rounded-2xl border overflow-hidden" style={{ borderColor: "#E5E7EB" }}>
          <div className="px-5 pt-5 pb-2">
            <p className="text-[13px] font-semibold tracking-wider" style={{ color: "#6B7280" }} data-testid="text-section-title-payment">
              {t("paymentMethodPage.currentMethod")}
            </p>
          </div>

          <div className="px-5 py-4" data-testid="card-payment-active">
            <div className="flex items-center gap-3">
              <div className="w-[48px] h-[48px] rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#F5F7FA" }}>
                <CreditCard className="w-5 h-5" style={{ color: "#0D6EFD" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[16px] font-semibold" style={{ color: "#1F2937" }} data-testid="text-card-brand">
                  {t("paymentMethodPage.managedByStripe")}
                </p>
                <p className="text-[14px]" style={{ color: "#6B7280" }} data-testid="text-card-desc">
                  {t("paymentMethodPage.managedByStripeDesc")}
                </p>
              </div>
              <Badge variant="secondary" className="flex-shrink-0" data-testid="badge-active">
                {t("paymentMethodPage.active")}
              </Badge>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-5 flex items-start gap-3" data-testid="info-payment-managed">
          <Info className="w-5 h-5 text-[#6B7280] flex-shrink-0 mt-0.5" />
          <p className="text-[14px] text-[#6B7280] leading-relaxed">
            {t("paymentMethodPage.managedInfo")}
          </p>
        </div>
      </div>
    </div>
  );
}
