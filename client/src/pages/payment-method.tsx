import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { CreditCard, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";
import { apiFetch } from "@/lib/api-base";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default function PaymentMethodPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);

  async function openStripePortal() {
    setLoading(true);
    try {
      const res = await apiFetch("/api/stripe/portal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.error === "no_stripe_customer") {
          toast({ title: t("paymentMethodPage.noCustomer"), description: t("paymentMethodPage.noCustomerDesc"), variant: "destructive" });
        } else {
          toast({ title: t("paymentMethodPage.error"), variant: "destructive" });
        }
        return;
      }
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      toast({ title: t("paymentMethodPage.error"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

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
            </div>
          </div>
        </div>

        <Button
          onClick={openStripePortal}
          disabled={loading}
          className="w-full h-[56px] rounded-full bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white text-[15px] font-semibold"
          data-testid="button-open-stripe-portal"
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          {loading ? t("paymentMethodPage.opening") : t("paymentMethodPage.manageViaStripe")}
        </Button>

        <p className="text-[13px] text-[#6B7280] text-center px-4 leading-relaxed">
          {t("paymentMethodPage.managedInfo")}
        </p>
      </div>
    </div>
  );
}
