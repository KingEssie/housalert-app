import { useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api-base";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppHeader } from "@/components/ui/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle, CheckCircle2, XCircle, Clock, RefreshCw, Search,
  Activity, Database, Radio, Globe, Zap, ChevronRight, Info,
  Shield, BarChart2, TrendingUp, ArrowLeft, ExternalLink,
} from "lucide-react";
import { useLocation } from "wouter";

async function adminFetch(path: string, options?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Not authenticated");
  const res = await apiFetch(path, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options?.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

type Tab = "overview" | "sources" | "alerts" | "trace" | "sla" | "diagnostic" | "registry";

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "sources", label: "Source Health", icon: Radio },
  { id: "alerts", label: "Alerts", icon: AlertTriangle },
  { id: "trace", label: "Listing Trace", icon: Search },
  { id: "sla", label: "SLA Metrics", icon: BarChart2 },
  { id: "diagnostic", label: "User Diagnostic", icon: Shield },
  { id: "registry", label: "Source Registry", icon: Globe },
];

function statusColor(status: string) {
  if (status === "healthy") return "text-green-600 bg-green-50 border-green-200";
  if (status === "degraded") return "text-yellow-600 bg-yellow-50 border-yellow-200";
  if (status === "down") return "text-red-600 bg-red-50 border-red-200";
  return "text-gray-500 bg-gray-50 border-gray-200";
}

function severityColor(severity: string) {
  if (severity === "critical") return "text-red-700 bg-red-50 border-red-200";
  if (severity === "warning") return "text-yellow-700 bg-yellow-50 border-yellow-200";
  return "text-blue-700 bg-blue-50 border-blue-200";
}

function sourceStatusBadge(status: string) {
  if (status === "active") return "bg-green-100 text-green-700";
  if (status === "broken") return "bg-red-100 text-red-700";
  if (status === "planned") return "bg-blue-100 text-blue-700";
  return "bg-gray-100 text-gray-600";
}

function relativeTime(ts: string | null) {
  if (!ts) return "never";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab() {
  const { data: slaDat } = useQuery({ queryKey: ["/api/admin/portal/sla-metrics"], queryFn: () => adminFetch("/api/admin/portal/sla-metrics"), staleTime: 60000 });
  const { data: alertDat } = useQuery({ queryKey: ["/api/admin/portal/pipeline-alerts"], queryFn: () => adminFetch("/api/admin/portal/pipeline-alerts"), staleTime: 30000 });
  const { data: srcDat } = useQuery({ queryKey: ["/api/admin/portal/source-health"], queryFn: () => adminFetch("/api/admin/portal/source-health"), staleTime: 60000 });

  const healthySources = (srcDat?.sources || []).filter((s: any) => s.status === "healthy").length;
  const degradedSources = (srcDat?.sources || []).filter((s: any) => s.status === "degraded").length;
  const openAlerts = alertDat?.count ?? 0;
  const critAlerts = (alertDat?.alerts || []).filter((a: any) => a.severity === "critical").length;
  const sla = slaDat?.summary ?? {};
  const lastIngest = slaDat?.ingest_daily?.[0];

  const kpis = [
    { label: "Healthy Sources", value: healthySources, icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
    { label: "Degraded Sources", value: degradedSources, icon: AlertTriangle, color: "text-yellow-600", bg: "bg-yellow-50" },
    { label: "Open Alerts", value: openAlerts, icon: XCircle, color: critAlerts > 0 ? "text-red-600" : "text-gray-500", bg: critAlerts > 0 ? "bg-red-50" : "bg-gray-50" },
    { label: "Avg Email Delay", value: sla.avg_match_to_email_min != null ? `${sla.avg_match_to_email_min}m` : "—", icon: Clock, color: "text-blue-600", bg: "bg-blue-50" },
  ];

  const recentAlerts = (alertDat?.alerts || []).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className={`rounded-xl border p-4 flex items-center gap-3 ${k.bg}`}>
            <k.icon className={`w-6 h-6 ${k.color}`} />
            <div>
              <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
              <div className="text-xs text-gray-500">{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {lastIngest && (
        <div className="border rounded-xl p-4 bg-white">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><Database className="w-4 h-4" /> Last Ingestion Run</h3>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-sm">
            {[
              ["Found", lastIngest.total_found],
              ["Inserted", lastIngest.total_inserted],
              ["Matches", lastIngest.total_matches],
              ["Errors", lastIngest.total_errors],
              ["Runs Today", lastIngest.runs],
              ["Avg Duration", `${lastIngest.avg_duration_sec}s`],
            ].map(([lbl, val]) => (
              <div key={lbl as string} className="text-center">
                <div className="text-lg font-bold text-gray-800">{val}</div>
                <div className="text-xs text-gray-400">{lbl}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {recentAlerts.length > 0 && (
        <div className="border rounded-xl p-4 bg-white">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-yellow-500" /> Open Alerts</h3>
          <div className="space-y-2">
            {recentAlerts.map((a: any) => (
              <div key={a.id} className={`flex items-start gap-3 rounded-lg border px-3 py-2 text-sm ${severityColor(a.severity)}`}>
                <span className="font-semibold capitalize">{a.severity}</span>
                <span className="flex-1">{a.title}</span>
                <span className="text-xs opacity-60">{relativeTime(a.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Source Health Tab ─────────────────────────────────────────────────────────

function SourceHealthTab() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["/api/admin/portal/source-health"],
    queryFn: () => adminFetch("/api/admin/portal/source-health"),
    staleTime: 30000,
  });
  const sources = data?.sources ?? [];
  const grouped = sources.reduce((acc: any, s: any) => {
    if (!acc[s.source_name]) acc[s.source_name] = [];
    acc[s.source_name].push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{sources.length} source×city pairs tracked</p>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-3 h-3 mr-1 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading source health data…</div>
      ) : sources.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Radio className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No source health data yet. It will populate after the next ingest cycle completes.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([srcName, rows]: [string, any]) => (
          <div key={srcName} className="border rounded-xl overflow-hidden bg-white">
            <div className="px-4 py-2 bg-gray-50 border-b flex items-center gap-2">
              <Radio className="w-4 h-4 text-gray-400" />
              <span className="font-semibold text-gray-700">{srcName}</span>
              <span className="text-xs text-gray-400 ml-1">{rows.length} cities</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 border-b">
                    {["City", "Status", "Found", "Inserted", "Errors", "Duration", "Last Success", "Consec Failures"].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any) => (
                    <tr key={`${r.source_name}:${r.city}`} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-700">{r.city || "—"}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium capitalize ${statusColor(r.status)}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-600">{r.found_count}</td>
                      <td className="px-3 py-2 text-gray-600">{r.inserted_count}</td>
                      <td className="px-3 py-2 text-red-500">{r.error_count || "—"}</td>
                      <td className="px-3 py-2 text-gray-500">{r.duration_ms ? formatDuration(r.duration_ms) : "—"}</td>
                      <td className="px-3 py-2 text-gray-500">{relativeTime(r.last_success_at)}</td>
                      <td className="px-3 py-2">
                        {r.consecutive_failures > 0 ? (
                          <span className="text-red-500 font-semibold">{r.consecutive_failures}</span>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─── Alerts Tab ───────────────────────────────────────────────────────────────

function AlertsTab() {
  const [mode, setMode] = useState<"open" | "all">("open");
  const qc = useQueryClient();
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["/api/admin/portal/pipeline-alerts", mode],
    queryFn: () => adminFetch(`/api/admin/portal/pipeline-alerts?mode=${mode}`),
    staleTime: 20000,
  });
  const resolveMut = useMutation({
    mutationFn: (id: number) => adminFetch(`/api/admin/portal/pipeline-alerts/${id}/resolve`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/portal/pipeline-alerts"] }); },
  });
  const alerts = data?.alerts ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(["open", "all"] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${mode === m ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {m === "open" ? "Open" : "All (last 100)"}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-3 h-3 mr-1 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading alerts…</div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-400" />
          <p className="font-medium text-green-600">All clear — no {mode === "open" ? "open " : ""}alerts</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((a: any) => (
            <div key={a.id} className={`rounded-xl border p-4 ${severityColor(a.severity)}`}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${severityColor(a.severity)}`}>{a.severity}</span>
                    <span className="text-xs text-gray-400">{a.alert_type}</span>
                    <span className="text-xs text-gray-400">{relativeTime(a.created_at)}</span>
                    {a.status === "resolved" && <span className="text-xs text-green-600 font-medium">Resolved {relativeTime(a.resolved_at)}</span>}
                  </div>
                  <p className="font-semibold text-gray-800 mb-1">{a.title}</p>
                  <p className="text-sm text-gray-600">{a.message}</p>
                  {(a.source_name || a.city) && (
                    <div className="flex gap-3 mt-2 text-xs text-gray-500">
                      {a.source_name && <span>Source: <strong>{a.source_name}</strong></span>}
                      {a.city && <span>City: <strong>{a.city}</strong></span>}
                      {a.notification_count > 0 && <span>Notified {a.notification_count}×</span>}
                    </div>
                  )}
                </div>
                {a.status === "open" && (
                  <Button variant="outline" size="sm" onClick={() => resolveMut.mutate(a.id)}
                    disabled={resolveMut.isPending} className="shrink-0 text-xs h-7">
                    Resolve
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Listing Trace Tab ────────────────────────────────────────────────────────

function ListingTraceTab() {
  const [input, setInput] = useState("");
  const [listingId, setListingId] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/admin/portal/listing-trace", listingId],
    queryFn: () => adminFetch(`/api/admin/portal/listing-trace?listing_id=${listingId}`),
    enabled: !!listingId,
  });

  const doSearch = () => { if (input.trim()) setListingId(input.trim()); };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Paste listing UUID…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && doSearch()}
          data-testid="input-listing-trace"
        />
        <Button onClick={doSearch} disabled={!input.trim() || isLoading} data-testid="button-listing-trace-search">
          <Search className="w-4 h-4 mr-1" /> Trace
        </Button>
      </div>

      {isLoading && <div className="text-center py-8 text-gray-400">Tracing listing…</div>}
      {error && <div className="text-red-500 text-sm py-4">{(error as Error).message}</div>}

      {data && (
        <div className="space-y-4">
          {data.listing && (
            <div className="border rounded-xl p-4 bg-white">
              <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2"><Database className="w-4 h-4" /> Listing Details</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div><span className="text-gray-400">Title</span><p className="font-medium truncate">{data.listing.title || "—"}</p></div>
                <div><span className="text-gray-400">City</span><p className="font-medium">{data.listing.city || "—"}</p></div>
                <div><span className="text-gray-400">Price</span><p className="font-medium">€{data.listing.price ?? "—"}</p></div>
                <div><span className="text-gray-400">Source</span><p className="font-medium">{data.listing.source || "—"}</p></div>
                <div><span className="text-gray-400">Inserted</span><p className="font-medium">{data.listing.created_at ? new Date(data.listing.created_at).toLocaleString() : "—"}</p></div>
                {data.listing.url && (
                  <div><a href={data.listing.url} target="_blank" rel="noreferrer" className="text-blue-600 underline text-sm flex items-center gap-1">View listing <ExternalLink className="w-3 h-3" /></a></div>
                )}
              </div>
            </div>
          )}

          {data.freshness && (
            <div className="border rounded-xl p-4 bg-white">
              <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2"><Clock className="w-4 h-4" /> Freshness</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div><span className="text-gray-400">First Seen</span><p>{data.freshness.first_seen_at ? new Date(data.freshness.first_seen_at).toLocaleString() : "—"}</p></div>
                <div><span className="text-gray-400">Last Seen</span><p>{data.freshness.last_seen_at ? new Date(data.freshness.last_seen_at).toLocaleString() : "—"}</p></div>
                <div><span className="text-gray-400">Source</span><p>{data.freshness.source || "—"}</p></div>
                <div><span className="text-gray-400">Source ID</span><p className="font-mono text-xs break-all">{data.freshness.source_id || "—"}</p></div>
              </div>
            </div>
          )}

          {data.ingestion_run && (
            <div className="border rounded-xl p-4 bg-white">
              <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2"><Activity className="w-4 h-4" /> Ingestion Run #{data.ingestion_run.id}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div><span className="text-gray-400">Status</span><p className="capitalize font-medium">{data.ingestion_run.status}</p></div>
                <div><span className="text-gray-400">Started</span><p>{new Date(data.ingestion_run.started_at).toLocaleString()}</p></div>
                <div><span className="text-gray-400">Found</span><p>{data.ingestion_run.total_found}</p></div>
                <div><span className="text-gray-400">Inserted</span><p>{data.ingestion_run.total_inserted}</p></div>
              </div>
            </div>
          )}

          <div className="border rounded-xl p-4 bg-white">
            <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Timeline</h3>
            {(data.timeline || []).length === 0 ? (
              <p className="text-sm text-gray-400">No timeline events</p>
            ) : (
              <div className="space-y-2">
                {(data.timeline || []).map((ev: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                    <span className="font-medium text-gray-600 capitalize w-36 shrink-0">{ev.event.replace(/_/g, " ")}</span>
                    <span className="text-gray-500">{new Date(ev.at).toLocaleString()}</span>
                    {ev.user_id && <span className="text-gray-400 text-xs font-mono">u:{ev.user_id.slice(0, 8)}…</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {(data.matches || []).length > 0 && (
            <div className="border rounded-xl p-4 bg-white">
              <h3 className="font-semibold text-gray-700 mb-3">Matched Users ({data.matches.length})</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-gray-400 border-b">
                    {["User ID", "Matched At", "Email", "Push", "Viewed", "Applied"].map(h => <th key={h} className="px-2 py-1.5 text-left">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {data.matches.map((m: any, i: number) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-2 py-1.5 font-mono">{m.user_id?.slice(0, 8)}…</td>
                        <td className="px-2 py-1.5">{m.matched_at ? new Date(m.matched_at).toLocaleString() : "—"}</td>
                        <td className="px-2 py-1.5">{m.email_sent ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <XCircle className="w-3 h-3 text-gray-300" />}</td>
                        <td className="px-2 py-1.5">{m.push_sent ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <XCircle className="w-3 h-3 text-gray-300" />}</td>
                        <td className="px-2 py-1.5">{m.viewed_at ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : "—"}</td>
                        <td className="px-2 py-1.5">{m.applied_at ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── SLA Metrics Tab ─────────────────────────────────────────────────────────

function SlaMetricsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/portal/sla-metrics"],
    queryFn: () => adminFetch("/api/admin/portal/sla-metrics"),
    staleTime: 60000,
  });

  const sla = data?.summary ?? {};
  const daily = data?.daily ?? [];
  const ingestDaily = data?.ingest_daily ?? [];
  const alertCounts = data?.open_alert_counts ?? [];

  return (
    <div className="space-y-5">
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading SLA metrics…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Emails Sent (30d)", value: sla.email_count ?? "—" },
              { label: "Avg Match→Email", value: sla.avg_match_to_email_min != null ? `${sla.avg_match_to_email_min}m` : "—" },
              { label: "Median Match→Email", value: sla.median_match_to_email_min != null ? `${sla.median_match_to_email_min}m` : "—" },
              { label: "Avg Match→Push", value: sla.avg_match_to_push_min != null ? `${sla.avg_match_to_push_min}m` : "—" },
            ].map(k => (
              <div key={k.label} className="border rounded-xl p-4 bg-white text-center">
                <div className="text-2xl font-bold text-gray-800">{k.value}</div>
                <div className="text-xs text-gray-400 mt-1">{k.label}</div>
              </div>
            ))}
          </div>

          {alertCounts.length > 0 && (
            <div className="border rounded-xl p-4 bg-white">
              <h3 className="font-semibold text-gray-700 mb-3">Open Alert Breakdown</h3>
              <div className="flex gap-4">
                {alertCounts.map((a: any) => (
                  <div key={a.severity} className={`rounded-lg border px-4 py-2 text-sm font-medium ${severityColor(a.severity)}`}>
                    {a.count} {a.severity}
                  </div>
                ))}
              </div>
            </div>
          )}

          {daily.length > 0 && (
            <div className="border rounded-xl overflow-hidden bg-white">
              <div className="px-4 py-3 border-b bg-gray-50 font-semibold text-gray-700 text-sm">Notification SLA — Last 14 Days</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-gray-400 border-b">
                    {["Day", "Matches", "Emails Sent", "Push Sent", "Avg Email Delay", "Avg Push Delay"].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {daily.map((d: any) => (
                      <tr key={d.day} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{d.day}</td>
                        <td className="px-3 py-2">{d.matches}</td>
                        <td className="px-3 py-2">{d.emails_sent}</td>
                        <td className="px-3 py-2">{d.push_sent}</td>
                        <td className="px-3 py-2">{d.avg_email_min != null ? `${d.avg_email_min}m` : "—"}</td>
                        <td className="px-3 py-2">{d.avg_push_min != null ? `${d.avg_push_min}m` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {ingestDaily.length > 0 && (
            <div className="border rounded-xl overflow-hidden bg-white">
              <div className="px-4 py-3 border-b bg-gray-50 font-semibold text-gray-700 text-sm">Ingestion Stats — Last 14 Days</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-gray-400 border-b">
                    {["Day", "Runs", "Success", "Failed", "Found", "Inserted", "Matches", "Errors", "Avg Duration"].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {ingestDaily.map((d: any) => (
                      <tr key={d.day} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{d.day}</td>
                        <td className="px-3 py-2">{d.runs}</td>
                        <td className="px-3 py-2 text-green-600">{d.success_runs}</td>
                        <td className="px-3 py-2 text-red-500">{d.failed_runs || "—"}</td>
                        <td className="px-3 py-2">{d.total_found}</td>
                        <td className="px-3 py-2">{d.total_inserted}</td>
                        <td className="px-3 py-2">{d.total_matches}</td>
                        <td className="px-3 py-2 text-red-500">{d.total_errors || "—"}</td>
                        <td className="px-3 py-2">{d.avg_duration_sec != null ? `${d.avg_duration_sec}s` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── User Diagnostic Tab ───────────────────────────────────────────────────────

function UserDiagnosticTab() {
  const [email, setEmail] = useState("");
  const [query, setQuery] = useState("");
  const [traceEmail, setTraceEmail] = useState("");
  const [traceQuery, setTraceQuery] = useState("");

  const { data: diagData, isLoading: diagLoading, error: diagError } = useQuery({
    queryKey: ["/api/admin/portal/user-pipeline-diagnostic", query],
    queryFn: () => adminFetch(`/api/admin/portal/user-pipeline-diagnostic?email=${encodeURIComponent(query)}`),
    enabled: !!query,
  });

  const { data: traceData, isLoading: traceLoading, error: traceError } = useQuery({
    queryKey: ["/api/admin/portal/rejection-trace", traceQuery],
    queryFn: () => adminFetch(`/api/admin/portal/rejection-trace?email=${encodeURIComponent(traceQuery)}`),
    enabled: !!traceQuery,
  });

  return (
    <div className="space-y-5">
      <div className="border rounded-xl p-4 bg-white space-y-3">
        <h3 className="font-semibold text-gray-700">Pipeline Diagnostic</h3>
        <div className="flex gap-2">
          <input className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="User email…" value={email} onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && setQuery(email.trim())}
            data-testid="input-user-diagnostic-email" />
          <Button onClick={() => setQuery(email.trim())} disabled={!email.trim() || diagLoading} data-testid="button-user-diagnostic-search">
            <Search className="w-4 h-4 mr-1" /> Diagnose
          </Button>
        </div>
        {diagLoading && <div className="text-center py-4 text-gray-400">Loading diagnostic…</div>}
        {diagError && <div className="text-red-500 text-sm">{(diagError as Error).message}</div>}
        {diagData && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                ["User ID", diagData.user?.id?.slice(0, 12) + "…"],
                ["Email", diagData.user?.email || "—"],
                ["Profiles", diagData.profiles?.length ?? 0],
                ["Total Matches", diagData.match_stats?.total ?? 0],
              ].map(([l, v]) => (
                <div key={l as string} className="border rounded-lg p-2">
                  <div className="text-xs text-gray-400">{l}</div>
                  <div className="font-medium text-gray-700 truncate">{v}</div>
                </div>
              ))}
            </div>
            {(diagData.profiles || []).map((p: any) => (
              <div key={p.id} className="border rounded-lg p-3 bg-gray-50">
                <div className="font-semibold text-gray-700 mb-1">{p.city_name || p.city} — €{p.max_rent ?? "?"} / {p.min_rooms ?? "?"}+ rooms</div>
                <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                  {p.is_active ? <span className="text-green-600 font-medium">Active</span> : <span className="text-red-500">Inactive</span>}
                  <span>Radius: {p.max_radius_km ?? "?"}km</span>
                  {p.min_size_sqm && <span>Min size: {p.min_size_sqm}m²</span>}
                </div>
              </div>
            ))}
            {(diagData.recent_matches || []).slice(0, 5).map((m: any) => (
              <div key={m.id} className="text-xs border rounded-lg px-3 py-2 bg-white flex items-center gap-3">
                <span className="text-gray-500">{m.listing_city}</span>
                <span className="font-medium">{m.listing_title?.slice(0, 40)}</span>
                <span className="text-gray-400">€{m.listing_price}</span>
                <span className="text-gray-300">{relativeTime(m.matched_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border rounded-xl p-4 bg-white space-y-3">
        <h3 className="font-semibold text-gray-700">Rejection Trace <span className="text-xs text-gray-400 font-normal ml-1">— why do recent listings match or not?</span></h3>
        <div className="flex gap-2">
          <input className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="User email for rejection trace…" value={traceEmail} onChange={e => setTraceEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && setTraceQuery(traceEmail.trim())}
            data-testid="input-rejection-trace-email" />
          <Button onClick={() => setTraceQuery(traceEmail.trim())} disabled={!traceEmail.trim() || traceLoading} data-testid="button-rejection-trace-search">
            <Zap className="w-4 h-4 mr-1" /> Run Trace
          </Button>
        </div>
        {traceLoading && <div className="text-center py-4 text-gray-400">Running rejection trace…</div>}
        {traceError && <div className="text-red-500 text-sm">{(traceError as Error).message}</div>}
        {traceData && traceData.traces?.length === 0 && (
          <div className="text-sm text-gray-500 text-center py-4">No recent listings found for this user's cities ({traceData.cities?.join(", ") || "none"})</div>
        )}
        {traceData && traceData.traces?.map((t: any) => (
          <div key={t.listing_id} className="border rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 border-b flex items-center gap-3 text-sm">
              <span className="font-medium text-gray-700 flex-1 truncate">{t.title || t.listing_id}</span>
              <span className="text-gray-400">{t.city}</span>
              <span className="text-gray-400">€{t.price}</span>
              <span className="text-gray-300 text-xs">{relativeTime(t.created_at)}</span>
            </div>
            <div className="divide-y">
              {(t.profiles || []).map((p: any) => (
                <div key={p.profile_id} className={`px-3 py-2 text-xs flex items-start gap-3 ${p.matched ? "bg-green-50" : "bg-red-50"}`}>
                  <span className={`font-semibold shrink-0 ${p.matched ? "text-green-600" : "text-red-500"}`}>
                    {p.matched ? "✓ Match" : "✗ Rejected"}
                  </span>
                  <span className="text-gray-500 shrink-0">{p.profile_summary}</span>
                  <div className="flex-1">
                    {p.rejections?.length > 0 && (
                      <span className="text-red-600">{p.rejections.join(" · ")}</span>
                    )}
                    {p.reasons?.length > 0 && p.matched && (
                      <span className="text-green-600">{p.reasons.slice(0, 2).join(" · ")}</span>
                    )}
                  </div>
                  {p.score > 0 && <span className="text-gray-400 shrink-0">score {p.score}</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Source Registry Tab ─────────────────────────────────────────────────────

function SourceRegistryTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/portal/source-registry"],
    queryFn: () => adminFetch("/api/admin/portal/source-registry"),
    staleTime: 120000,
  });
  const registry = data?.registry ?? [];

  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const statusOrder: Record<string, number> = { active: 0, planned: 1, broken: 2, gone: 3 };
  const sorted = [...registry].sort((a: any, b: any) =>
    (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9) ||
    (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9)
  );

  return (
    <div className="space-y-3">
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading registry…</div>
      ) : (
        sorted.map((s: any) => (
          <div key={s.name} className="border rounded-xl p-4 bg-white">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-semibold text-gray-800">{s.displayName}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sourceStatusBadge(s.status)}`}>{s.status}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 capitalize">{s.priority} priority</span>
                  {s.any_healthy && <span className="text-xs text-green-600 font-medium">● Live</span>}
                  {s.last_success_global && <span className="text-xs text-gray-400">Last success: {relativeTime(s.last_success_global)}</span>}
                </div>
                <p className="text-sm text-gray-500 mb-2">{s.marketShare}</p>
                {s.note && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-2 py-1 mb-2 inline-block">{s.note}</div>
                )}
                {s.implementationNotes && (
                  <p className="text-xs text-gray-400">{s.implementationNotes}</p>
                )}
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-400">
                  {s.estimatedListingsPerCity && <span>~{s.estimatedListingsPerCity} listings/city</span>}
                  {s.supportedCountries?.length > 0 && <span>Markets: {s.supportedCountries.join(", ")}</span>}
                  {s.blockerType && s.blockerType !== "none" && <span className="text-orange-500">Blocker: {s.blockerType}</span>}
                  {s.url && <a href={s.url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline flex items-center gap-1">Visit <ExternalLink className="w-2.5 h-2.5" /></a>}
                </div>
              </div>
              {s.health_entries?.length > 0 && (
                <div className="text-right shrink-0">
                  <div className="text-xs text-gray-400">{s.health_entries.length} cities tracked</div>
                  <div className="text-xs">
                    <span className="text-green-600">{s.health_entries.filter((h: any) => h.status === "healthy").length} healthy</span>
                    {" / "}
                    <span className="text-yellow-500">{s.health_entries.filter((h: any) => h.status === "degraded").length} degraded</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminPipelineHealthPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AppHeader />
      <div className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate("/admin/portal")} className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Pipeline Health Monitor</h1>
            <p className="text-sm text-gray-500">Scraping · matching · notification pipeline observability</p>
          </div>
        </div>

        <div className="flex gap-1 flex-wrap mb-6 bg-white border rounded-xl p-1.5">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === t.id ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
              data-testid={`tab-pipeline-${t.id}`}>
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "sources" && <SourceHealthTab />}
        {activeTab === "alerts" && <AlertsTab />}
        {activeTab === "trace" && <ListingTraceTab />}
        {activeTab === "sla" && <SlaMetricsTab />}
        {activeTab === "diagnostic" && <UserDiagnosticTab />}
        {activeTab === "registry" && <SourceRegistryTab />}
      </div>
    </div>
  );
}
