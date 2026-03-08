import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Crown, CreditCard, Calendar, RefreshCw, ChevronRight, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "\u2014";
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
    case "monthly": return "\u20AC6,99 / maand";
    case "two_month": return "\u20AC5,99 / maand";
    case "three_month": return "\u20AC4,99 / maand";
    default: return "\u2014";
  }
}

function getBillingFrequency(plan: string | null | undefined): string {
  switch (plan) {
    case "monthly": return "Maandelijks";
    case "two_month": return "Elke 2 maanden";
    case "three_month": return "Elke 3 maanden";
    default: return "\u2014";
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
      <div className="min-h-screen bg-background">
        <PageHeader title="Abonnement" onBack={() => navigate("/dashboard?tab=profiel")} />
        <div className="max-w-xl mx-auto p-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card rounded-lg border p-5 animate-pulse" style={{ borderColor: "var(--yo-divider)" }}>
              <div className="h-4 bg-muted rounded w-1/3 mb-3" />
              <div className="h-5 bg-muted rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="page-subscription-detail">
      <PageHeader title="Abonnement" onBack={() => navigate("/dashboard?tab=profiel")} />

      <div className="max-w-xl mx-auto p-4 space-y-4 pb-8">
        <div className="bg-card rounded-lg border p-5" style={{ borderColor: "var(--yo-divider)" }} data-testid="card-subscription-plan">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-[48px] h-[48px] rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--yo-chip-bg)" }}>
              <Crown className="w-5 h-5" style={{ color: "var(--yo-teal)" }} />
            </div>
            <div className="flex-1">
              <p className="text-[16px] font-semibold" style={{ color: "var(--yo-dark)" }} data-testid="text-plan-name">
                {subscription?.isTrial ? "Proefperiode" : getPlanLabel(subscription?.plan)}
              </p>
              <Badge variant={statusVariant as any} className="mt-1" data-testid="badge-subscription-status">
                {statusLabel}
              </Badge>
            </div>
          </div>

          {!subscription?.isTrial && subscription?.plan && (
            <div className="bg-muted rounded-lg p-4">
              <p className="text-[24px] font-bold" style={{ color: "var(--yo-dark)" }} data-testid="text-price">
                {getPriceLabel(subscription?.plan)}
              </p>
            </div>
          )}
        </div>

        <div className="bg-card rounded-lg border overflow-hidden" style={{ borderColor: "var(--yo-divider)" }} data-testid="card-subscription-details">
          <div className="px-5 pt-5 pb-2">
            <p className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: "var(--yo-muted)" }}>Details</p>
          </div>

          <DetailRow
            icon={<Calendar className="w-[18px] h-[18px]" style={{ color: "var(--yo-teal)" }} />}
            label="Startdatum"
            value={formatDate(startDate)}
            testId="text-start-date"
          />
          <div className="mx-5" style={{ borderBottom: "1px solid var(--yo-divider)" }} />

          <DetailRow
            icon={<Calendar className="w-[18px] h-[18px]" style={{ color: "var(--yo-teal)" }} />}
            label={subscription?.isTrial ? "Proefperiode eindigt" : "Volgende verlenging"}
            value={formatDate(renewalDate)}
            testId="text-renewal-date"
          />
          <div className="mx-5" style={{ borderBottom: "1px solid var(--yo-divider)" }} />

          <DetailRow
            icon={<RefreshCw className="w-[18px] h-[18px]" style={{ color: "var(--yo-teal)" }} />}
            label="Factureringsfrequentie"
            value={subscription?.isTrial ? "Proefperiode" : getBillingFrequency(subscription?.plan)}
            testId="text-billing-frequency"
          />
          <div className="mx-5" style={{ borderBottom: "1px solid var(--yo-divider)" }} />

          <DetailRow
            icon={<RefreshCw className="w-[18px] h-[18px]" style={{ color: "var(--yo-teal)" }} />}
            label="Automatisch verlengen"
            value={subscription?.isActive && !subscription?.isTrial ? "Aan" : "Uit"}
            testId="text-auto-renew"
          />
          <div className="mx-5" style={{ borderBottom: "1px solid var(--yo-divider)" }} />

          <DetailRow
            icon={<CreditCard className="w-[18px] h-[18px]" style={{ color: "var(--yo-teal)" }} />}
            label="Betaalmethode"
            value="4242 (Visa)"
            testId="text-payment-method"
          />
        </div>

        <div className="bg-card rounded-lg border overflow-hidden" style={{ borderColor: "var(--yo-divider)" }} data-testid="card-subscription-actions">
          <div className="px-5 pt-5 pb-2">
            <p className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: "var(--yo-muted)" }}>Beheren</p>
          </div>

          <ActionRow
            label="Abonnement wijzigen"
            onClick={() => navigate("/paywall")}
            testId="button-change-plan"
          />
          <div className="mx-5" style={{ borderBottom: "1px solid var(--yo-divider)" }} />

          <ActionRow
            label="Betaalmethode beheren"
            onClick={() => navigate("/account/payment-method")}
            testId="button-manage-payment"
          />
          <div className="mx-5" style={{ borderBottom: "1px solid var(--yo-divider)" }} />

          <ActionRow
            label="Abonnement opzeggen"
            onClick={() => navigate("/account/subscription/cancel")}
            danger
            testId="button-cancel-subscription"
          />
        </div>

        {subscription?.isExpired && (
          <div className="bg-card rounded-lg border p-5" style={{ borderColor: "var(--yo-divider)" }} data-testid="card-expired-cta">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "var(--yo-chip-bg)" }}>
                <AlertCircle className="w-5 h-5" style={{ color: "var(--yo-teal)" }} />
              </div>
              <div>
                <p className="text-[15px] font-semibold" style={{ color: "var(--yo-dark)" }}>Je abonnement is verlopen</p>
                <p className="text-[14px] text-muted-foreground mt-0.5">Verleng je abonnement om weer toegang te krijgen tot alle functies.</p>
              </div>
            </div>
            <button
              onClick={() => navigate("/paywall")}
              className="w-full h-[48px] bg-primary text-primary-foreground rounded-lg font-semibold text-[15px] transition-colors"
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
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "var(--yo-chip-bg)" }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-muted-foreground">{label}</p>
        <p className="text-[15px] font-medium truncate" style={{ color: "var(--yo-dark)" }} data-testid={testId}>{value}</p>
      </div>
    </div>
  );
}

function ActionRow({ label, onClick, danger, testId }: { label: string; onClick: () => void; danger?: boolean; testId: string }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-5 py-4 hover-elevate transition-colors"
      data-testid={testId}
    >
      <span className={`text-[15px] font-medium ${danger ? "text-destructive" : ""}`} style={danger ? {} : { color: "var(--yo-dark)" }}>{label}</span>
      <ChevronRight className="w-4 h-4 text-muted-foreground" />
    </button>
  );
}
