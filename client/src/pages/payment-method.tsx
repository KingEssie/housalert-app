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
        <div className="bg-card rounded-[6px] border overflow-hidden" style={{ borderColor: "rgb(var(--ha-card-border))" }}>
          <div className="px-5 pt-5 pb-2">
            <p className="text-[13px] font-medium tracking-wider" style={{ color: "rgb(var(--ha-text-secondary))" }} data-testid="text-section-title-payment">
              {t("paymentMethodPage.currentMethod")}
            </p>
          </div>

          <div className="px-5 py-4" data-testid="card-payment-active">
            <div className="flex items-center gap-3">
              <div className="w-[48px] h-[48px] rounded-[6px] flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "rgb(var(--ha-surface))" }}>
                <CreditCard className="w-5 h-5" style={{ color: "rgb(var(--ha-primary))" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[16px] font-medium" style={{ color: "rgb(var(--ha-text))" }} data-testid="text-card-brand">
                  {t("paymentMethodPage.managedByStripe")}
                </p>
                <p className="text-[14px]" style={{ color: "rgb(var(--ha-text-secondary))" }} data-testid="text-card-desc">
                  {t("paymentMethodPage.managedByStripeDesc")}
                </p>
              </div>
            </div>
          </div>
        </div>

        <Button
          onClick={openStripePortal}
          disabled={loading}
          className="w-full h-[56px] rounded-[6px] bg-ha-primary hover:bg-ha-primary-hover text-white text-[15px] font-medium"
          data-testid="button-open-stripe-portal"
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          {loading ? t("paymentMethodPage.opening") : t("paymentMethodPage.manageViaStripe")}
        </Button>

        <p className="text-[13px] text-ha-text-secondary text-center px-4 leading-relaxed">
          {t("paymentMethodPage.managedInfo")}
        </p>
      </div>
    </div>
  );
}
