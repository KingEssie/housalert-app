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
    <div className="min-h-screen bg-[#F8FAFC]" data-testid="page-cancel-confirm">
      <PageHeader title="Opzeggen" onBack={() => navigate("/account/subscription")} />

      <div className="max-w-xl mx-auto p-4 pb-8">
        <div className="bg-white rounded-[18px] border border-[#E5E7EB] p-6">
          <div className="flex items-center justify-center mb-5">
            <div className="w-14 h-14 rounded-2xl bg-[#DCDBFA] flex items-center justify-center">
              <AlertCircle className="w-7 h-7 text-[#673DE5]" />
            </div>
          </div>

          <h2 className="text-[20px] font-bold text-[#111827] text-center mb-3" data-testid="text-cancel-title">
            Weet je zeker dat je wilt opzeggen?
          </h2>

          <div className="bg-[#F8FAFC] rounded-xl p-4 mb-6">
            <p className="text-[15px] text-[#6B7280] leading-relaxed" data-testid="text-cancel-info">
              Je abonnement blijft actief tot <span className="font-semibold text-[#111827]">{renewalDate}</span>.
              {" "}Tot die datum kun je alle functies blijven gebruiken.
              {" "}Daarna stopt de automatische verlenging.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => navigate("/account/subscription")}
              className="w-full h-[48px] bg-[#673DE5] hover:bg-[#5B30D6] text-white rounded-[14px] font-semibold text-[15px] transition-colors"
              data-testid="button-keep-subscription"
            >
              Abonnement behouden
            </button>
            <button
              onClick={() => navigate("/account/subscription/cancelled")}
              className="w-full h-[48px] bg-white border border-[#E5E7EB] text-[#6B7280] rounded-[14px] font-semibold text-[15px] hover:bg-[#F8FAFC] transition-colors"
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
    <div className="min-h-screen bg-[#F8FAFC]" data-testid="page-cancelled">
      <PageHeader title="Opgezegd" onBack={() => navigate("/account/subscription")} />

      <div className="max-w-xl mx-auto p-4 pb-8">
        <div className="bg-white rounded-[18px] border border-[#E5E7EB] p-6">
          <div className="flex items-center justify-center mb-5">
            <div className="w-14 h-14 rounded-2xl bg-[#EAF9DF] flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-[#78D953]" />
            </div>
          </div>

          <h2 className="text-[20px] font-bold text-[#111827] text-center mb-3" data-testid="text-cancelled-title">
            Je abonnement is opgezegd
          </h2>

          <div className="bg-[#F8FAFC] rounded-xl p-4 mb-6">
            <p className="text-[15px] text-[#6B7280] leading-relaxed" data-testid="text-cancelled-info">
              Je abonnement blijft actief tot <span className="font-semibold text-[#111827]">{renewalDate}</span>.
              {" "}Daarna wordt het abonnement beëindigd.
            </p>
          </div>

          <button
            onClick={() => navigate("/dashboard?tab=profiel")}
            className="w-full h-[48px] bg-[#673DE5] hover:bg-[#5B30D6] text-white rounded-[14px] font-semibold text-[15px] transition-colors"
            data-testid="button-back-to-account"
          >
            Terug naar account
          </button>
        </div>
      </div>
    </div>
  );
}
