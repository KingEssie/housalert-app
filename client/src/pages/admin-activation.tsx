import { apiFetch } from "@/lib/api-base";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  Activity, ChevronLeft, Users, Search, Bell, Eye, Send, Crown, CreditCard, Loader2,
  XCircle, Home, HelpCircle, UserPlus, Inbox, ExternalLink,
} from "lucide-react";

interface SourceOfTruth {
  totalAuthUsers: number | null;
  withSearchProfile: number;
  withNotifications: number;
  withMatchViewed: number;
  withReaction: number;
  withTrial: number;
  withActiveSubscription: number;
}

interface FunnelData {
  totalTrackedUsers: number;
  funnel: Record<string, number>;
  recentEvents: Array<{ event_name: string; user_id: string; created_at: string }>;
  sourceOfTruth?: SourceOfTruth;
}

interface CancellationStats {
  total: number;
  foundViaHousalert: number;
  foundNotViaHousalert: number;
  notFound: number;
  other: number;
}

const FUNNEL_STEPS = [
  { key: "account_created", label: "Account Created", Icon: UserPlus, color: "#334855" },
  { key: "profile_created", label: "Profile Created", Icon: Search, color: "rgb(var(--ha-primary))" },
  { key: "notifications_enabled", label: "Notifications Enabled", Icon: Bell, color: "#16A34A" },
  { key: "match_received", label: "Match Received", Icon: Inbox, color: "rgb(var(--ha-primary))" },
  { key: "first_match_viewed", label: "First Match Viewed", Icon: Eye, color: "rgb(var(--ha-primary))" },
  { key: "listing_opened", label: "Listing Opened", Icon: ExternalLink, color: "rgb(var(--ha-primary))" },
  { key: "first_reaction", label: "First Reaction", Icon: Send, color: "rgb(var(--ha-primary))" },
  { key: "trial_started", label: "Trial Started", Icon: Crown, color: "#334855" },
  { key: "subscription_started", label: "Subscription Started", Icon: CreditCard, color: "#334855" },
];

export default function AdminActivationPage() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<FunnelData | null>(null);
  const [cancelStats, setCancelStats] = useState<CancellationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    loadData();
  }, [user, authLoading]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error("No session");

      const [funnelRes, cancelRes] = await Promise.all([
        apiFetch("/api/admin/activation-funnel", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        apiFetch("/api/admin/cancellation-stats", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (!funnelRes.ok) {
        const errData = await funnelRes.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${funnelRes.status}`);
      }
      setData(await funnelRes.json());
      if (cancelRes.ok) {
        setCancelStats(await cancelRes.json());
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#edf2f7] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#334855]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#edf2f7] p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-ha-danger/5 text-ha-danger rounded-xl p-4">{error}</div>
        </div>
      </div>
    );
  }

  const maxCount = data ? Math.max(data.totalTrackedUsers, 1) : 1;

  return (
    <div className="min-h-screen bg-[#edf2f7]">
      <div className="max-w-2xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => window.history.back()}
            className="w-9 h-9 rounded-full bg-white border border-[#E5E7EB] flex items-center justify-center"
            data-testid="button-back"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-[22px] font-bold text-[#111111]" data-testid="text-admin-title">Activation Funnel</h1>
            <p className="text-[13px] text-[#334855]">User activation tracking & metrics</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 mb-6" data-testid="card-total-users">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-[#edf2f7] flex items-center justify-center">
              <Users className="w-5 h-5 text-ha-primary" />
            </div>
            <div>
              <p className="text-[13px] text-[#334855]">Total Tracked Users</p>
              <p className="text-[28px] font-bold text-[#111111]" data-testid="text-total-users">{data?.totalTrackedUsers ?? 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 mb-6" data-testid="card-funnel">
          <h2 className="text-[16px] font-bold text-[#111111] mb-4">Activation Funnel</h2>
          <div className="flex flex-col gap-3">
            {FUNNEL_STEPS.map(({ key, label, Icon, color }) => {
              const count = data?.funnel[key] ?? 0;
              const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
              return (
                <div key={key} data-testid={`funnel-step-${key}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4" style={{ color }} />
                      <span className="text-[13px] font-medium text-[#111111]">{label}</span>
                    </div>
                    <span className="text-[13px] font-bold text-[#111111]">{count}</span>
                  </div>
                  <div className="h-2 bg-[#edf2f7] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {data?.sourceOfTruth && (
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 mb-6" data-testid="card-source-of-truth">
            <h2 className="text-[16px] font-bold text-[#111111] mb-4">Source of Truth (DB)</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Auth Users", value: data.sourceOfTruth.totalAuthUsers, color: "#334855" },
                { label: "With Profile", value: data.sourceOfTruth.withSearchProfile, color: "rgb(var(--ha-primary))" },
                { label: "Notifs Enabled", value: data.sourceOfTruth.withNotifications, color: "#16A34A" },
                { label: "Viewed Match", value: data.sourceOfTruth.withMatchViewed, color: "rgb(var(--ha-primary))" },
                { label: "Reacted", value: data.sourceOfTruth.withReaction, color: "rgb(var(--ha-primary))" },
                { label: "With Trial", value: data.sourceOfTruth.withTrial, color: "#334855" },
                { label: "Active Sub", value: data.sourceOfTruth.withActiveSubscription, color: "#334855" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-[#edf2f7] rounded-xl p-3" data-testid={`sot-${label.toLowerCase().replace(/\s/g, "-")}`}>
                  <p className="text-[11px] font-medium text-[#334855]">{label}</p>
                  <p className="text-[22px] font-bold" style={{ color }}>{value ?? "—"}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 mb-6" data-testid="card-cancellation-stats">
          <h2 className="text-[16px] font-bold text-[#111111] mb-4">Cancellation & Outcome KPIs</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Total Cancellations", value: cancelStats?.total ?? 0, Icon: XCircle, color: "rgb(var(--ha-danger))" },
              { label: "Homes Found via HousAlert", value: cancelStats?.foundViaHousalert ?? 0, Icon: Home, color: "#16A34A" },
              { label: "Found elsewhere", value: cancelStats?.foundNotViaHousalert ?? 0, Icon: Home, color: "#334855" },
              { label: "Not found", value: cancelStats?.notFound ?? 0, Icon: Search, color: "#334855" },
              { label: "Other reason", value: cancelStats?.other ?? 0, Icon: HelpCircle, color: "#334855" },
            ].map(({ label, value, Icon, color }) => (
              <div key={label} className="bg-[#edf2f7] rounded-xl p-3" data-testid={`cancel-${label.toLowerCase().replace(/\s/g, "-")}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className="w-3.5 h-3.5" style={{ color }} />
                  <p className="text-[11px] font-medium text-[#334855]">{label}</p>
                </div>
                <p className="text-[22px] font-bold" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>
          {cancelStats && cancelStats.total > 0 && cancelStats.foundViaHousalert > 0 && (
            <div className="mt-3 bg-[#edf2f7] rounded-xl px-4 py-2.5">
              <p className="text-[13px] text-[#16A34A] font-medium">
                {Math.round((cancelStats.foundViaHousalert / cancelStats.total) * 100)}% found their home via HousAlert
              </p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5" data-testid="card-recent-events">
          <h2 className="text-[16px] font-bold text-[#111111] mb-4">Recent Events</h2>
          {(!data?.recentEvents || data.recentEvents.length === 0) ? (
            <p className="text-[13px] text-[#334855]">No events recorded yet.</p>
          ) : (
            <div className="flex flex-col divide-y divide-[#F7F7F7]">
              {data.recentEvents.map((evt, i) => (
                <div key={i} className="py-2.5 flex items-center gap-3" data-testid={`event-row-${i}`}>
                  <Activity className="w-3.5 h-3.5 text-[#334855] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-medium text-[#111111]">{evt.event_name}</span>
                    <span className="text-[11px] text-[#334855] ml-2">{evt.user_id.slice(0, 8)}...</span>
                  </div>
                  <span className="text-[11px] text-[#334855] flex-shrink-0">
                    {new Date(evt.created_at).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
