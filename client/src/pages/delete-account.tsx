import { apiFetch } from "@/lib/api-base";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/lib/subscription";
import { useTranslation } from "@/i18n";
import { supabase } from "@/lib/supabase";
import { AlertTriangle, Crown } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

export default function DeleteAccountPage() {
  const { user, signOut } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [deleting, setDeleting] = useState(false);
  const sub = useSubscription();

  const hasActivePaidSub = sub.isActive && !sub.isTrial;

  async function handleDelete() {
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({ title: t("deleteAccount.notLoggedIn"), variant: "destructive" });
        setDeleting(false);
        return;
      }

      const res = await apiFetch("/api/account", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.error === "active_subscription") {
          toast({
            title: t("deleteAccount.activeSubscription"),
            description: data.message,
            variant: "destructive",
          });
          setDeleting(false);
          return;
        }
        throw new Error(data.error || t("deleteAccount.failed"));
      }

      await signOut();
      navigate("/login");
    } catch (err: any) {
      setDeleting(false);
      toast({ title: t("common.error"), description: err.message || t("deleteAccount.errorGeneric"), variant: "destructive" });
    }
  }

  if (!user) {
    navigate("/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <PageHeader title={t("deleteAccount.title")} onBack={() => navigate("/dashboard?tab=profiel&sub=account")} />

      <main className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-[var(--yo-pink-light)] flex items-center justify-center mb-6">
          <AlertTriangle className="w-8 h-8 text-[var(--yo-pink)]" />
        </div>
        <h2 className="text-[22px] font-bold text-[var(--yo-dark)] mb-3 text-center" data-testid="text-delete-account-title">
          {t("deleteAccount.confirmTitle")}
        </h2>
        <p className="text-[15px] text-[var(--yo-dark)] text-center max-w-[320px] mb-6 leading-relaxed" data-testid="text-delete-account-body">
          {t("deleteAccount.confirmBody")}
        </p>

        {hasActivePaidSub && (
          <div className="w-full max-w-[320px] bg-[var(--yo-chip-bg)] rounded-lg px-4 py-3 flex items-start gap-3 mb-6" data-testid="warning-active-sub">
            <Crown className="w-5 h-5 text-[var(--yo-pink)] flex-shrink-0 mt-0.5" />
            <p className="text-[13px] text-[var(--yo-dark)] leading-relaxed">
              {t("deleteAccount.activeSubWarning")}{" "}
              <button
                onClick={() => navigate("/account/subscription")}
                className="font-semibold text-[var(--yo-pink)] underline"
                data-testid="link-manage-subscription"
              >
                {t("deleteAccount.subSettings")}
              </button>
              {" "}{t("deleteAccount.activeSubWarningAfter")}
            </p>
          </div>
        )}

        <div className="w-full max-w-[320px] flex flex-col gap-3">
          <button
            onClick={handleDelete}
            disabled={deleting || hasActivePaidSub}
            className="w-full h-[56px] rounded-lg bg-[var(--yo-pink)] text-white text-[16px] font-bold transition-colors hover:opacity-90 disabled:opacity-50"
            data-testid="button-delete-account-confirm"
          >
            {deleting ? t("deleteAccount.deleting") : t("deleteAccount.confirmDelete")}
          </button>
          <button
            onClick={() => navigate("/dashboard?tab=profiel&sub=account")}
            className="w-full h-[56px] rounded-lg border border-[var(--yo-divider)] text-[var(--yo-dark)] text-[16px] font-bold hover:bg-[var(--yo-surface)] transition-colors"
            data-testid="button-delete-account-cancel"
          >
            {t("common.cancel")}
          </button>
        </div>
      </main>
    </div>
  );
}
