import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api-base";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/components/ui/page-header";
import { Loader2, RefreshCw, Database, Mail, Bell, Eye, Send, CheckCircle2, Clock, AlertTriangle } from "lucide-react";

interface AuditData {
  account: { user_id: string; email: string; created_at: string };
  subscription: any;
  notification_settings: { email_enabled: boolean; push_enabled: boolean };
  search_profiles: { count: number; profiles: any[] };
  stats: {
    total: number;
    new_count: number;
    viewed: number;
    saved: number;
    applied: number;
    email_sent: number;
    push_sent: number;
  };
  timing: {
    last_fetch_run_at: string | null;
    last_email_sent_at: string | null;
    last_push_sent_at: string | null;
  };
  recent_matches: any[];
  fetch_runs: any[];
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number | string; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 flex items-center gap-3" data-testid={`stat-${label.toLowerCase().replace(/\s/g, "-")}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-[22px] font-bold text-[#222222] leading-none">{value}</p>
        <p className="text-[13px] text-[#717171] mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export default function AdminMatchAudit() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<string | null>(null);

  async function getAuthHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return {};
    return { Authorization: `Bearer ${session.access_token}` };
  }

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      if (!headers.Authorization) {
        throw new Error("Not authenticated — please log in again");
      }
      const res = await apiFetch("/api/admin/match-audit", { headers });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Failed to load" }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function runBackfill() {
    setBackfilling(true);
    setBackfillResult(null);
    try {
      const headers = await getAuthHeaders();
      if (!headers.Authorization) {
        setBackfillResult("Error: Not authenticated");
        return;
      }
      const res = await apiFetch("/api/admin/match-audit/backfill", { method: "POST", headers });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        setBackfillResult(`Error: ${errData.error || `HTTP ${res.status}`}`);
        return;
      }
      const result = await res.json();
      setBackfillResult(`Backfilled ${result.backfilled ?? 0} matches from ${result.total_supabase_matches ?? 0} Supabase records`);
      loadData();
    } catch (err: any) {
      setBackfillResult(`Error: ${err.message}`);
    } finally {
      setBackfilling(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => loadData(), 200);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#0D6EFD]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F5F7FA]" data-testid="page-admin-audit">
        <PageHeader title="Match Audit" onBack={() => navigate("/dashboard?tab=profiel&sub=account")} />
        <div className="p-4 pt-6 text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-[15px] text-[#717171]">{error}</p>
          <button onClick={loadData} className="mt-4 px-6 py-2 bg-[#0D6EFD] text-white rounded-full text-[14px] font-semibold" data-testid="button-retry">Retry</button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { stats, timing, recent_matches, fetch_runs } = data;

  return (
    <div className="min-h-screen bg-[#F5F7FA]" data-testid="page-admin-audit">
      <PageHeader title="Match Audit" onBack={() => navigate("/dashboard?tab=profiel&sub=account")} />

      <div className="max-w-xl mx-auto px-4 pb-32 space-y-5">
        <div className="bg-[#0F172A] rounded-2xl p-5 text-white" data-testid="card-account-info">
          <p className="text-[13px] text-gray-400 mb-1">Account</p>
          <p className="text-[16px] font-bold">{data.account.email}</p>
          <p className="text-[12px] text-gray-400 mt-1">ID: {data.account.user_id.substring(0, 8)}...</p>
          <div className="flex gap-4 mt-3 text-[13px]">
            <span className="text-gray-300">Profiles: <strong className="text-white">{data.search_profiles.count}</strong></span>
            <span className="text-gray-300">Sub: <strong className="text-white">{data.subscription?.status || "none"}</strong></span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={Database} label="Total Matches" value={stats.total} color="bg-[#0D6EFD]" />
          <StatCard icon={Eye} label="New (Unviewed)" value={stats.new_count} color="bg-[#F59E0B]" />
          <StatCard icon={CheckCircle2} label="Viewed" value={stats.viewed} color="bg-[#10B981]" />
          <StatCard icon={Send} label="Applied" value={stats.applied} color="bg-[#8B5CF6]" />
          <StatCard icon={Mail} label="Emails Sent" value={stats.email_sent} color="bg-[#EF4444]" />
          <StatCard icon={Bell} label="Push Sent" value={stats.push_sent} color="bg-[#EC4899]" />
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 space-y-3" data-testid="card-timing">
          <p className="text-[15px] font-bold text-[#222222]">Timing</p>
          <div className="space-y-2 text-[13px]">
            <div className="flex justify-between">
              <span className="text-[#717171]">Last fetch run</span>
              <span className="text-[#222222] font-medium">{formatDate(timing.last_fetch_run_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#717171]">Last email sent</span>
              <span className="text-[#222222] font-medium">{formatDate(timing.last_email_sent_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#717171]">Last push sent</span>
              <span className="text-[#222222] font-medium">{formatDate(timing.last_push_sent_at)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 space-y-3" data-testid="card-actions">
          <p className="text-[15px] font-bold text-[#222222]">Actions</p>
          <div className="flex gap-3">
            <button
              onClick={runBackfill}
              disabled={backfilling}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#0D6EFD] text-white rounded-xl text-[13px] font-semibold disabled:opacity-50"
              data-testid="button-backfill"
            >
              {backfilling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
              Backfill Matches
            </button>
            <button
              onClick={loadData}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#F5F6F8] text-[#222222] rounded-xl text-[13px] font-semibold"
              data-testid="button-refresh"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
          {backfillResult && (
            <p className="text-[12px] text-[#717171] mt-2">{backfillResult}</p>
          )}
        </div>

        {fetch_runs.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 space-y-3" data-testid="card-fetch-runs">
            <p className="text-[15px] font-bold text-[#222222]">Recent Fetch Runs</p>
            <div className="space-y-2">
              {fetch_runs.map((run: any, i: number) => (
                <div key={run.id || i} className="flex items-center gap-3 py-2 border-b border-[#F3F4F6] last:border-0 text-[12px]">
                  <div className={`w-2 h-2 rounded-full ${run.status === "completed" ? "bg-green-500" : run.status === "failed" ? "bg-red-500" : "bg-yellow-500"}`} />
                  <div className="flex-1">
                    <span className="text-[#222222] font-medium">{formatDate(run.started_at)}</span>
                    <span className="text-[#717171] ml-2">
                      fetched={run.fetched_count} matched={run.newly_matched_count} emails={run.emails_sent_count} errors={run.error_count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 space-y-3" data-testid="card-recent-matches">
          <p className="text-[15px] font-bold text-[#222222]">Recent Match Deliveries ({recent_matches.length})</p>
          {recent_matches.length === 0 ? (
            <p className="text-[13px] text-[#717171] text-center py-4">No canonical matches yet. Run backfill to populate.</p>
          ) : (
            <div className="space-y-0">
              {recent_matches.map((m: any, i: number) => (
                <div key={m.id || i} className="py-3 border-b border-[#F3F4F6] last:border-0" data-testid={`match-row-${i}`}>
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-[13px] font-semibold text-[#222222] leading-tight flex-1 pr-2">
                      {m.listing_title || "Untitled"}
                    </p>
                    <span className="text-[11px] text-[#717171] whitespace-nowrap">{formatDate(m.matched_at)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-[#717171] mt-1">
                    <span>{m.listing_city || "—"}</span>
                    {m.listing_price && <span>€{m.listing_price}</span>}
                    <span>{m.listing_source || "—"}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px]">
                    <span className={m.visible_in_app ? "text-green-600 font-medium" : "text-gray-400"}>
                      {m.visible_in_app ? "✓ visible" : "✗ hidden"}
                    </span>
                    <span className={m.email_sent ? "text-blue-600 font-medium" : "text-gray-400"}>
                      {m.email_sent ? "✓ emailed" : "✗ no email"}
                    </span>
                    <span className={m.push_sent ? "text-purple-600 font-medium" : "text-gray-400"}>
                      {m.push_sent ? "✓ pushed" : "✗ no push"}
                    </span>
                    <span className={m.viewed ? "text-green-600" : "text-gray-400"}>
                      {m.viewed ? "viewed" : "unviewed"}
                    </span>
                  </div>
                  {m.dedup_key && (
                    <p className="text-[10px] text-[#717171] mt-1 font-mono truncate">dedup: {m.dedup_key}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {data.search_profiles.profiles.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 space-y-3" data-testid="card-search-profiles">
            <p className="text-[15px] font-bold text-[#222222]">Search Profiles ({data.search_profiles.count})</p>
            {data.search_profiles.profiles.map((p: any, i: number) => (
              <div key={p.id || i} className="py-2 border-b border-[#F3F4F6] last:border-0 text-[12px]">
                <span className="font-medium text-[#222222]">{p.city_name || p.city}</span>
                <span className="text-[#717171] ml-2">
                  €{p.price_min || 0}–€{p.price_max || "∞"} · {p.bedrooms_min || 0}+ rooms · {p.size_min || 0}+ m²
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
