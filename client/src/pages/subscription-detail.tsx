import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Crown, CreditCard, Calendar, RefreshCw, ChevronRight, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getPlanLabel(plan: string | null | undefined): string {
  switch (plan) {
    case "monthly": return "Premium Maandelijks";
    case "two_month": return "Premium 2 Maanden";
    case "three_month": return "Premium 3 Maanden";
    default: return "Premium";
  }
}

function getPriceLabel(plan: string | null | undefined): string {
  switch (plan) {
    case "monthly": return "€6,99 / maand";
    case "two_month": return "€5,99 / maand";
    case "three_month": return "€4,99 / maand";
    default: return "—";
  }
}

function getBillingFrequency(plan: string | null | undefined): string {
  switch (plan) {
    case "monthly": return "Maandelijks";
    case "two_month": return "Elke 2 maanden";
    case "three_month": return "Elke 3 maanden";
    default: return "—";
  }
}

export default function SubscriptionDetailPage() {
  const [, navigate] = useLocation();

  const { data: subscription, isLoading } = useQuery<{
    status: string;
    plan: string | null;
    trial_ends_at: string | null;
    current_period_ends_at: string | null;
    isActive: boolean;
    isTrial: boolean;
    isExpired: boolean;
  }>({
    queryKey: ["/api/subscription/status"],
  });

  const statusLabel = subscription?.isTrial
    ? "Proefperiode"
    : subscription?.isActive
      ? "Actief"
      : "Verlopen";

  const statusVariant = subscription?.isActive || subscription?.isTrial ? "success" : "secondary";

  const startDate = subscription?.trial_ends_at
    ? new Date(new Date(subscription.trial_ends_at).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const renewalDate = subscription?.current_period_ends_at || subscription?.trial_ends_at;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC]">
        <div className="bg-white border-b border-[#E5E7EB] px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard?tab=profiel")}
            className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[#F8FAFC] transition-colors"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5 text-[#111827]" />
          </button>
          <h1 className="text-[18px] font-bold text-[#111827]">Abonnement</h1>
        </div>
        <div className="p-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-[18px] border border-[#E5E7EB] p-5 animate-pulse">
              <div className="h-4 bg-[#E5E7EB] rounded w-1/3 mb-3" />
              <div className="h-5 bg-[#E5E7EB] rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]" data-testid="page-subscription-detail">
      <div className="bg-white border-b border-[#E5E7EB] px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => navigate("/dashboard?tab=profiel")}
          className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[#F8FAFC] transition-colors"
          data-testid="button-back"
        >
          <ArrowLeft className="w-5 h-5 text-[#111827]" />
        </button>
        <h1 className="text-[18px] font-bold text-[#111827]">Abonnement</h1>
      </div>

      <div className="p-4 space-y-4 pb-8">
        <div className="bg-white rounded-[18px] border border-[#E5E7EB] p-5" data-testid="card-subscription-plan">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-[48px] h-[48px] rounded-[12px] bg-[#DCDBFA] flex items-center justify-center">
              <Crown className="w-5 h-5 text-[#673DE5]" />
            </div>
            <div className="flex-1">
              <p className="text-[16px] font-semibold text-[#111827]" data-testid="text-plan-name">
                {subscription?.isTrial ? "Proefperiode" : getPlanLabel(subscription?.plan)}
              </p>
              <Badge variant={statusVariant as any} className="mt-1" data-testid="badge-subscription-status">
                {statusLabel}
              </Badge>
            </div>
          </div>

          {!subscription?.isTrial && subscription?.plan && (
            <div className="bg-[#F8FAFC] rounded-xl p-4">
              <p className="text-[24px] font-bold text-[#111827]" data-testid="text-price">
                {getPriceLabel(subscription?.plan)}
              </p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-[18px] border border-[#E5E7EB] overflow-hidden" data-testid="card-subscription-details">
          <div className="px-5 pt-5 pb-2">
            <p className="text-[13px] font-semibold text-[#6B7280] uppercase tracking-wider">Details</p>
          </div>

          <DetailRow
            icon={<Calendar className="w-[18px] h-[18px] text-[#673DE5]" />}
            label="Startdatum"
            value={formatDate(startDate)}
            testId="text-start-date"
          />
          <div className="mx-5 border-b border-[#E5E7EB]" />

          <DetailRow
            icon={<Calendar className="w-[18px] h-[18px] text-[#673DE5]" />}
            label={subscription?.isTrial ? "Proefperiode eindigt" : "Volgende verlenging"}
            value={formatDate(renewalDate)}
            testId="text-renewal-date"
          />
          <div className="mx-5 border-b border-[#E5E7EB]" />

          <DetailRow
            icon={<RefreshCw className="w-[18px] h-[18px] text-[#673DE5]" />}
            label="Factureringsfrequentie"
            value={subscription?.isTrial ? "Proefperiode" : getBillingFrequency(subscription?.plan)}
            testId="text-billing-frequency"
          />
          <div className="mx-5 border-b border-[#E5E7EB]" />

          <DetailRow
            icon={<RefreshCw className="w-[18px] h-[18px] text-[#673DE5]" />}
            label="Automatisch verlengen"
            value={subscription?.isActive && !subscription?.isTrial ? "Aan" : "Uit"}
            testId="text-auto-renew"
          />
          <div className="mx-5 border-b border-[#E5E7EB]" />

          <DetailRow
            icon={<CreditCard className="w-[18px] h-[18px] text-[#673DE5]" />}
            label="Betaalmethode"
            value="•••• 4242 (Visa)"
            testId="text-payment-method"
          />
        </div>

        <div className="bg-white rounded-[18px] border border-[#E5E7EB] overflow-hidden" data-testid="card-subscription-actions">
          <div className="px-5 pt-5 pb-2">
            <p className="text-[13px] font-semibold text-[#6B7280] uppercase tracking-wider">Beheren</p>
          </div>

          <ActionRow
            label="Abonnement wijzigen"
            onClick={() => navigate("/paywall")}
            testId="button-change-plan"
          />
          <div className="mx-5 border-b border-[#E5E7EB]" />

          <ActionRow
            label="Betaalmethode beheren"
            onClick={() => {}}
            testId="button-manage-payment"
          />
          <div className="mx-5 border-b border-[#E5E7EB]" />

          <ActionRow
            label="Abonnement opzeggen"
            onClick={() => {}}
            danger
            testId="button-cancel-subscription"
          />
        </div>

        {subscription?.isExpired && (
          <div className="bg-white rounded-[18px] border border-[#E5E7EB] p-5" data-testid="card-expired-cta">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#DCDBFA] flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-[#673DE5]" />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-[#111827]">Je abonnement is verlopen</p>
                <p className="text-[14px] text-[#6B7280] mt-0.5">Verleng je abonnement om weer toegang te krijgen tot alle functies.</p>
              </div>
            </div>
            <button
              onClick={() => navigate("/paywall")}
              className="w-full h-[48px] bg-[#673DE5] hover:bg-[#5B30D6] text-white rounded-[14px] font-semibold text-[15px] transition-colors"
              data-testid="button-renew-subscription"
            >
              Abonnement verlengen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ icon, label, value, testId }: { icon: React.ReactNode; label: string; value: string; testId: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <div className="w-8 h-8 rounded-lg bg-[#DCDBFA] flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-[#6B7280]">{label}</p>
        <p className="text-[15px] font-medium text-[#111827] truncate" data-testid={testId}>{value}</p>
      </div>
    </div>
  );
}

function ActionRow({ label, onClick, danger, testId }: { label: string; onClick: () => void; danger?: boolean; testId: string }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#F8FAFC] transition-colors"
      data-testid={testId}
    >
      <span className={`text-[15px] font-medium ${danger ? "text-[#673DE5]" : "text-[#111827]"}`}>{label}</span>
      <ChevronRight className="w-4 h-4 text-[#6B7280]" />
    </button>
  );
}
