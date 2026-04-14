import { useState } from "react";
import { AppHeader } from "@/components/ui/app-header";
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
    <div className="min-h-screen" style={{ backgroundColor: "#edf2f7" }} data-testid="page-payment-method">
      <AppHeader title={t("paymentMethodPage.title")} />

      <div className="max-w-xl mx-auto p-4 space-y-4 pb-8">
        <div className="app-card">
          <div className="flex items-center gap-3">
            <div className="w-[48px] h-[48px] rounded-[8px] bg-[#F9FAFB] flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-5 h-5 text-ha-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[16px] font-semibold text-[#111111]" data-testid="text-card-brand">
                {t("paymentMethodPage.managedByStripe")}
              </p>
              <p className="text-[14px] text-ha-text-muted" data-testid="text-card-desc">
                {t("paymentMethodPage.managedByStripeDesc")}
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={openStripePortal}
          disabled={loading}
          className="w-full h-[48px] rounded-[6px] bg-ha-primary hover:bg-ha-primary-hover text-white text-[15px] font-semibold"
          data-testid="button-open-stripe-portal"
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          {loading ? t("paymentMethodPage.opening") : t("paymentMethodPage.manageViaStripe")}
        </Button>

        <p className="text-[13px] text-ha-text-muted text-center px-4 leading-relaxed">
          {t("paymentMethodPage.managedInfo")}
        </p>
      </div>
    </div>
  );
}
