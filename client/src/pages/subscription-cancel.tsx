import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { AlertCircle, CheckCircle2 } from "lucide-react";

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "een toekomstige datum";
  return new Date(dateStr).toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function SubscriptionCancelConfirmPage() {
  const [, navigate] = useLocation();

  const { data: subscription } = useQuery<{
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

  const renewalDate = formatDate(subscription?.current_period_ends_at || subscription?.trial_ends_at);

  return (
    <div className="min-h-screen bg-background" data-testid="page-cancel-confirm">
      <PageHeader title="Opzeggen" onBack={() => navigate("/account/subscription")} />

      <div className="max-w-xl mx-auto p-4 pb-8">
        <div className="bg-card rounded-[18px] border p-6" style={{ borderColor: "var(--yo-divider)" }}>
          <div className="flex items-center justify-center mb-5">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "var(--yo-teal-light)" }}>
              <AlertCircle className="w-7 h-7" style={{ color: "var(--yo-teal)" }} />
            </div>
          </div>

          <h2 className="text-[20px] font-bold text-center mb-3" style={{ color: "var(--yo-dark)" }} data-testid="text-cancel-title">
            Weet je zeker dat je wilt opzeggen?
          </h2>

          <div className="bg-muted rounded-xl p-4 mb-6">
            <p className="text-[15px] text-muted-foreground leading-relaxed" data-testid="text-cancel-info">
              Je abonnement blijft actief tot <span className="font-semibold" style={{ color: "var(--yo-dark)" }}>{renewalDate}</span>.
              {" "}Tot die datum kun je alle functies blijven gebruiken.
              {" "}Daarna stopt de automatische verlenging.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => navigate("/account/subscription")}
              className="w-full h-[48px] bg-primary text-primary-foreground rounded-[14px] font-semibold text-[15px] transition-colors"
              data-testid="button-keep-subscription"
            >
              Abonnement behouden
            </button>
            <button
              onClick={() => navigate("/account/subscription/cancelled")}
              className="w-full h-[48px] bg-card border text-muted-foreground rounded-[14px] font-semibold text-[15px] hover-elevate transition-colors"
              style={{ borderColor: "var(--yo-divider)" }}
              data-testid="button-confirm-cancel"
            >
              Toch opzeggen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SubscriptionCancelledPage() {
  const [, navigate] = useLocation();

  const { data: subscription } = useQuery<{
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

  const renewalDate = formatDate(subscription?.current_period_ends_at || subscription?.trial_ends_at);

  return (
    <div className="min-h-screen bg-background" data-testid="page-cancelled">
      <PageHeader title="Opgezegd" onBack={() => navigate("/account/subscription")} />

      <div className="max-w-xl mx-auto p-4 pb-8">
        <div className="bg-card rounded-[18px] border p-6" style={{ borderColor: "var(--yo-divider)" }}>
          <div className="flex items-center justify-center mb-5">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "var(--yo-teal-light)" }}>
              <CheckCircle2 className="w-7 h-7" style={{ color: "var(--yo-success)" }} />
            </div>
          </div>

          <h2 className="text-[20px] font-bold text-center mb-3" style={{ color: "var(--yo-dark)" }} data-testid="text-cancelled-title">
            Je abonnement is opgezegd
          </h2>

          <div className="bg-muted rounded-xl p-4 mb-6">
            <p className="text-[15px] text-muted-foreground leading-relaxed" data-testid="text-cancelled-info">
              Je abonnement blijft actief tot <span className="font-semibold" style={{ color: "var(--yo-dark)" }}>{renewalDate}</span>.
              {" "}Daarna wordt het abonnement beëindigd.
            </p>
          </div>

          <button
            onClick={() => navigate("/dashboard?tab=profiel")}
            className="w-full h-[48px] bg-primary text-primary-foreground rounded-[14px] font-semibold text-[15px] transition-colors"
            data-testid="button-back-to-account"
          >
            Terug naar account
          </button>
        </div>
      </div>
    </div>
  );
}
