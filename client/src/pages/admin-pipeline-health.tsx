import { useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api-base";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle, CheckCircle2, XCircle, Clock, RefreshCw, Search,
  Activity, Database, Radio, Globe, Zap, ChevronRight, Info,
  Shield, BarChart2, TrendingUp, ArrowLeft, ExternalLink, Bell,
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

type Tab = "overview" | "sources" | "alerts" | "trace" | "notiftrace" | "dedup" | "sla" | "diagnostic" | "registry";

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "sources", label: "Source Health", icon: Radio },
  { id: "alerts", label: "Alerts", icon: AlertTriangle },
  { id: "trace", label: "Listing Trace", icon: Search },
  { id: "notiftrace", label: "Notif Trace", icon: Bell },
  { id: "dedup", label: "Dedup Audit", icon: Database },
  { id: "sla", label: "SLA Metrics", icon: BarChart2 },
  { id: "diagnostic", label: "User Diagnostic", icon: Shield },
  { id: "registry", label: "Source Registry", icon: Globe },
];

function statusColor(status: string) {
  if (status === "healthy")  return "text-green-600 bg-green-50 border-green-200";
  if (status === "degraded") return "text-yellow-600 bg-yellow-50 border-yellow-200";
  if (status === "down")     return "text-red-600 bg-red-50 border-red-200";
  if (status === "disabled") return "text-gray-400 bg-gray-50 border-gray-200";
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

  const healthySources  = (srcDat?.sources || []).filter((s: any) => s.status === "healthy").length;
  const degradedSources = (srcDat?.sources || []).filter((s: any) => s.status === "degraded" || s.status === "down").length;
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
              ["⚡ Fast-lane avg", lastIngest.avg_fast_lane_sec != null ? `${lastIngest.avg_fast_lane_sec}s` : "—"],
              ["🔍 Deep-scan avg", lastIngest.avg_deep_scan_sec != null ? `${lastIngest.avg_deep_scan_sec}s` : "—"],
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
  const qc = useQueryClient();
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["/api/admin/portal/source-health"],
    queryFn: () => adminFetch("/api/admin/portal/source-health"),
    staleTime: 30000,
  });
  const backfillMut = useMutation({
    mutationFn: () => adminFetch("/api/admin/portal/source-health/backfill", { method: "POST" }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/portal/source-health"] });
      alert(`Backfill complete: ${result.runs_processed} ingestion runs processed → ${result.rows_now} source rows now in table.`);
    },
    onError: (err: Error) => alert(`Backfill failed: ${err.message}`),
  });
  const sources = data?.sources ?? [];
  const isSynthetic = !!data?._synthetic;
  const activeSources   = sources.filter((s: any) => s.status !== "disabled");
  const disabledSources = sources.filter((s: any) => s.status === "disabled");

  function groupByName(list: any[]) {
    return list.reduce((acc: any, s: any) => {
      if (!acc[s.source_name]) acc[s.source_name] = [];
      acc[s.source_name].push(s);
      return acc;
    }, {} as Record<string, any[]>);
  }

  const activeGrouped   = groupByName(activeSources);
  const disabledGrouped = groupByName(disabledSources);

  function SourceTable({ srcName, rows, dimmed }: { srcName: string; rows: any[]; dimmed?: boolean }) {
    return (
      <div className={`border rounded-xl overflow-hidden ${dimmed ? "bg-gray-50 opacity-60" : "bg-white"}`}>
        <div className="px-4 py-2 bg-gray-50 border-b flex items-center gap-2">
          <Radio className={`w-4 h-4 ${dimmed ? "text-gray-300" : "text-gray-400"}`} />
          <span className={`font-semibold ${dimmed ? "text-gray-400" : "text-gray-700"}`}>{srcName}</span>
          <span className="text-xs text-gray-400 ml-1">{rows.length} {rows.length === 1 ? "city" : "cities"}</span>
          {dimmed && <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-500 rounded-full ml-1">disabled — skipped by ingester</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 border-b">
                {["City", "Status", "Found", "Inserted", "Errors", "Duration", "Last Data", "Zero Runs", "Consec Fail"].map(h => (
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
                  <td className="px-3 py-2" title="Last run that actually returned listings">
                    {r.last_success_at ? (
                      <span className="text-gray-500">{relativeTime(r.last_success_at)}</span>
                    ) : (
                      <span className="text-gray-400">never</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-500">
                    {r.consecutive_zeros > 0
                      ? <span className="text-amber-600 font-medium">{r.consecutive_zeros}</span>
                      : <span className="text-gray-300">0</span>}
                  </td>
                  <td className="px-3 py-2 text-gray-500">
                    {r.consecutive_failures > 0
                      ? <span className="text-red-500 font-medium">{r.consecutive_failures}</span>
                      : <span className="text-gray-300">0</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {activeSources.length} active source×city pairs
          {disabledSources.length > 0 && <span className="text-gray-400"> · {disabledSources.length} disabled</span>}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => backfillMut.mutate()} disabled={backfillMut.isPending || isFetching}
            title="Re-process all ingestion_runs to rebuild source_health rows (idempotent)">
            <Database className={`w-3 h-3 mr-1 ${backfillMut.isPending ? "animate-pulse" : ""}`} />
            {backfillMut.isPending ? "Backfilling…" : "Force Backfill"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-3 h-3 mr-1 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading source health data…</div>
      ) : sources.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Radio className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No source health data yet. It will populate after the next ingest cycle completes.</p>
        </div>
      ) : (
        <>
          {isSynthetic && (
            <div className="border border-amber-200 rounded-xl px-4 py-3 bg-amber-50 text-xs text-amber-800 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
              <span>
                <strong>Synthesized from latest ingestion run</strong> — the{" "}
                <code className="bg-amber-100 px-1 rounded">source_health</code> table is empty or being rebuilt.
                Stats show last-run snapshot only; consecutive_failures and total_runs are not yet tracked.
                Click <strong>Force Backfill</strong> to rebuild from history.
              </span>
            </div>
          )}
          {Object.entries(activeGrouped).map(([srcName, rows]) => (
            <SourceTable key={srcName} srcName={srcName} rows={rows} />
          ))}
          {Object.keys(disabledGrouped).length > 0 && (
            <>
              <div className="pt-2 pb-1 text-xs text-gray-400 font-medium uppercase tracking-wide">Disabled sources (skipped by ingester)</div>
              {Object.entries(disabledGrouped).map(([srcName, rows]) => (
                <SourceTable key={srcName} srcName={srcName} rows={rows} dimmed />
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ─── Alerts Tab ───────────────────────────────────────────────────────────────

type SimPhase = "idle" | "running_failure" | "failure_done" | "running_recovery" | "recovery_done" | "error";

function AlertsTab() {
  const [mode, setMode] = useState<"open" | "all">("open");
  const [simPhase, setSimPhase] = useState<SimPhase>("idle");
  const [simResult, setSimResult] = useState<any>(null);
  const [simError, setSimError] = useState<string | null>(null);
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

  async function runSimFailure() {
    setSimPhase("running_failure");
    setSimError(null);
    setSimResult(null);
    try {
      const result = await adminFetch("/api/admin/portal/simulate-failure", { method: "POST" });
      setSimResult(result);
      setSimPhase("failure_done");
      qc.invalidateQueries({ queryKey: ["/api/admin/portal/pipeline-alerts"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/portal/source-health"] });
    } catch (e: any) {
      setSimError(e.message);
      setSimPhase("error");
    }
  }

  async function runSimRecovery() {
    setSimPhase("running_recovery");
    setSimError(null);
    try {
      const result = await adminFetch("/api/admin/portal/simulate-recovery", { method: "POST" });
      setSimResult(result);
      setSimPhase("recovery_done");
      qc.invalidateQueries({ queryKey: ["/api/admin/portal/pipeline-alerts"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/portal/source-health"] });
    } catch (e: any) {
      setSimError(e.message);
      setSimPhase("error");
    }
  }

  async function resetSim() {
    await adminFetch("/api/admin/portal/simulate-cleanup", { method: "DELETE" }).catch(() => null);
    setSimPhase("idle");
    setSimResult(null);
    setSimError(null);
    qc.invalidateQueries({ queryKey: ["/api/admin/portal/pipeline-alerts"] });
    qc.invalidateQueries({ queryKey: ["/api/admin/portal/source-health"] });
  }

  const isSimBusy = simPhase === "running_failure" || simPhase === "running_recovery";

  return (
    <div className="space-y-4">
      {/* ── Alert Engine Test Panel ── */}
      <div className="border-2 border-dashed border-amber-200 rounded-xl p-4 bg-amber-50">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-amber-600" />
          <span className="font-semibold text-amber-800 text-sm">Alert Engine Simulator</span>
          <span className="text-xs text-amber-500 font-medium px-2 py-0.5 bg-amber-100 rounded-full">non-destructive · sim-source only</span>
        </div>

        <p className="text-xs text-amber-700 mb-4">
          Injects a fake <code className="bg-amber-100 px-1 rounded">sim-source (SimCity)</code> failure (35 min stale, 5 consecutive errors)
          and runs the full alert engine cycle: source_down alert → admin email → auto-resolution.
          No real source is touched. Cleanup is automatic.
        </p>

        <div className="flex flex-wrap gap-2 items-center">
          {(simPhase === "idle" || simPhase === "error") && (
            <button onClick={runSimFailure} disabled={isSimBusy}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-50"
              data-testid="button-sim-failure">
              ① Simulate Failure
            </button>
          )}
          {simPhase === "failure_done" && (
            <button onClick={runSimRecovery} disabled={isSimBusy}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
              data-testid="button-sim-recovery">
              ② Simulate Recovery
            </button>
          )}
          {(simPhase === "failure_done" || simPhase === "recovery_done" || simPhase === "error") && (
            <button onClick={resetSim}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              data-testid="button-sim-reset">
              Reset
            </button>
          )}
          {isSimBusy && (
            <span className="flex items-center gap-1.5 text-sm text-amber-700">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              {simPhase === "running_failure" ? "Triggering failure…" : "Simulating recovery…"}
            </span>
          )}
        </div>

        {simError && (
          <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{simError}</div>
        )}

        {simResult && simPhase === "failure_done" && (
          <div className="mt-3 space-y-2">
            <div className={`rounded-lg border px-3 py-2 text-xs ${simResult.summary?.alert_created ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
              {simResult.summary?.alert_created
                ? `✓ Alert created — ID #${simResult.summary.alert_id} · type: ${simResult.summary.alert_type} · severity: ${simResult.summary.alert_severity}`
                : "✗ Alert was NOT created — check alert engine logic"}
            </div>
            <div className={`rounded-lg border px-3 py-2 text-xs ${simResult.summary?.last_notified_at ? "bg-green-50 border-green-200 text-green-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
              {simResult.summary?.last_notified_at
                ? `✓ Email sent to: ${simResult.summary.email_recipients?.join(", ") || "—"} (notified ${simResult.summary.notification_count}×)`
                : simResult.summary?.resend_configured
                  ? `⚠ Email not sent — alert may be new with cooldown not yet cleared, or ADMIN_EMAILS unset (recipients: ${simResult.summary.email_recipients?.join(", ") || "none"})`
                  : "⚠ Resend API key not configured — email skipped"}
            </div>
            <div className="text-xs text-amber-700">Now click ② Simulate Recovery to verify auto-resolution →</div>
          </div>
        )}

        {simResult && simPhase === "recovery_done" && (
          <div className="mt-3 space-y-2">
            <div className={`rounded-lg border px-3 py-2 text-xs ${simResult.summary?.alert_auto_resolved ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
              {simResult.summary?.alert_auto_resolved
                ? `✓ Alert auto-resolved at ${simResult.summary.alert_resolved_at ? new Date(simResult.summary.alert_resolved_at).toLocaleTimeString() : "unknown"}`
                : "✗ Alert was NOT auto-resolved — check evaluateAlertRules resolve logic"}
            </div>
            <div className={`rounded-lg border px-3 py-2 text-xs ${simResult.summary?.sim_health_row_cleaned_up ? "bg-green-50 border-green-200 text-green-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
              {simResult.summary?.sim_health_row_cleaned_up ? "✓ sim-source health row cleaned up" : "⚠ Cleanup may be incomplete"}
            </div>
            <div className="rounded-lg border border-green-300 px-3 py-2 text-xs bg-green-50 text-green-800 font-medium">
              {simResult.message || "Full cycle complete"}
            </div>
          </div>
        )}
      </div>

      {/* ── Alert Feed ── */}
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
            <div key={a.id} className={`rounded-xl border p-4 ${a.source_name === "sim-source" ? "ring-2 ring-amber-300" : ""} ${severityColor(a.severity)}`}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${severityColor(a.severity)}`}>{a.severity}</span>
                    <span className="text-xs text-gray-400">{a.alert_type}</span>
                    <span className="text-xs text-gray-400">{relativeTime(a.created_at)}</span>
                    {a.source_name === "sim-source" && <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">TEST</span>}
                    {a.status === "resolved" && <span className="text-xs text-green-600 font-medium">✓ Resolved {relativeTime(a.resolved_at)}</span>}
                  </div>
                  <p className="font-semibold text-gray-800 mb-1">{a.title}</p>
                  <p className="text-sm text-gray-600">{a.message}</p>
                  {(a.source_name || a.city) && (
                    <div className="flex gap-3 mt-2 text-xs text-gray-500">
                      {a.source_name && <span>Source: <strong>{a.source_name}</strong></span>}
                      {a.city && <span>City: <strong>{a.city}</strong></span>}
                      {a.notification_count > 0 && <span>Notified {a.notification_count}×</span>}
                      {a.last_notified_at && <span>Last email: {relativeTime(a.last_notified_at)}</span>}
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
                <div><span className="text-gray-400">District</span><p className="font-medium">{data.listing.district || "—"}</p></div>
                <div><span className="text-gray-400">Coord Precision</span><p className="font-medium">{data.listing.coordinate_precision || "—"}</p></div>
                {data.listing.postcode && <div><span className="text-gray-400">Postcode</span><p className="font-medium">{data.listing.postcode}</p></div>}
                {data.listing.street && <div><span className="text-gray-400">Street</span><p className="font-medium">{data.listing.street}</p></div>}
                <div><span className="text-gray-400">Inserted</span><p className="font-medium">{data.listing.created_at ? new Date(data.listing.created_at).toLocaleString() : "—"}</p></div>
                {data.listing.url && (
                  <div><a href={data.listing.url} target="_blank" rel="noreferrer" className="text-blue-600 underline text-sm flex items-center gap-1">View listing <ExternalLink className="w-3 h-3" /></a></div>
                )}
              </div>
            </div>
          )}

          {data.cluster ? (
            <div className="border rounded-xl p-4 bg-white">
              <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Zap className="w-4 h-4 text-orange-500" />
                Cross-source Cluster
                <span className={`ml-1 text-xs font-medium px-2 py-0.5 rounded-full ${data.cluster.size > 1 ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-500"}`}>
                  {data.cluster.size === 1 ? "solo (no duplicates found)" : `${data.cluster.size} listings in cluster`}
                </span>
              </h3>
              <p className="text-xs text-gray-400 font-mono mb-3 break-all">Cluster ID: {data.cluster.id}</p>
              {data.cluster.siblings.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="text-gray-400 border-b">
                      {["Source", "Price", "Inserted", "Coord Precision", "Link"].map(h => <th key={h} className="px-2 py-1.5 text-left">{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {data.cluster.siblings.map((s: any, i: number) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="px-2 py-1.5 font-medium">{s.source}</td>
                          <td className="px-2 py-1.5">€{s.price ?? "—"}</td>
                          <td className="px-2 py-1.5">{s.created_at ? new Date(s.created_at).toLocaleString() : "—"}</td>
                          <td className="px-2 py-1.5">{s.coordinate_precision || "—"}</td>
                          <td className="px-2 py-1.5">
                            {s.url
                              ? <a href={s.url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline flex items-center gap-0.5">View <ExternalLink className="w-3 h-3" /></a>
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-400">This listing has its own cluster UUID but no siblings from other sources yet.</p>
              )}
            </div>
          ) : (
            <div className="border rounded-xl p-4 bg-white">
              <h3 className="font-semibold text-gray-700 mb-1 flex items-center gap-2"><Zap className="w-4 h-4 text-gray-300" /> Cross-source Cluster</h3>
              <p className="text-sm text-gray-400">No cluster assigned — migration 031 not yet applied or listing predates clustering.</p>
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
                    {["Day", "Runs", "✓", "✗", "⚡ Fast-lane", "🔍 Deep-scan", "Fast avg", "Deep avg", "Found", "Inserted", "Matches", "Errors"].map(h => (
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
                        <td className="px-3 py-2 text-blue-600">{d.fast_lane_runs || "—"}</td>
                        <td className="px-3 py-2 text-gray-600">{d.deep_scan_runs || "—"}</td>
                        <td className="px-3 py-2 text-blue-500">{d.avg_fast_lane_sec != null ? `${d.avg_fast_lane_sec}s` : "—"}</td>
                        <td className="px-3 py-2 text-gray-500">{d.avg_deep_scan_sec != null ? `${d.avg_deep_scan_sec}s` : "—"}</td>
                        <td className="px-3 py-2">{d.total_found}</td>
                        <td className="px-3 py-2">{d.total_inserted}</td>
                        <td className="px-3 py-2">{d.total_matches}</td>
                        <td className="px-3 py-2 text-red-500">{d.total_errors || "—"}</td>
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

// ─── Dedup Audit Tab ─────────────────────────────────────────────────────────

function DedupAuditTab() {
  const [city, setCity] = useState("Berlin");
  const [days, setDays] = useState("7");
  const [params, setParams] = useState({ city: "Berlin", days: "7" });

  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/admin/portal/dedup-audit", params.city, params.days],
    queryFn: () => adminFetch(`/api/admin/portal/dedup-audit?city=${encodeURIComponent(params.city)}&days=${params.days}`),
    staleTime: 120000,
  });

  const run = () => setParams({ city: city.trim() || "Berlin", days: days || "7" });

  return (
    <div className="space-y-5">
      <div className="flex gap-2 items-end">
        <div>
          <label className="text-xs text-gray-400 block mb-1">City</label>
          <input className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-36"
            value={city} onChange={e => setCity(e.target.value)} onKeyDown={e => e.key === "Enter" && run()}
            data-testid="input-dedup-city" />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Days</label>
          <input className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-20"
            type="number" min={1} max={30} value={days} onChange={e => setDays(e.target.value)} onKeyDown={e => e.key === "Enter" && run()}
            data-testid="input-dedup-days" />
        </div>
        <Button onClick={run} disabled={isLoading} data-testid="button-dedup-run">
          <Search className="w-4 h-4 mr-1" /> Analyse
        </Button>
      </div>

      {isLoading && <div className="text-center py-10 text-gray-400">Running dedup analysis…</div>}
      {error && <div className="text-red-500 text-sm">{(error as Error).message}</div>}

      {data && (
        <div className="space-y-4">
          {!data.cluster_column_active && (
            <div className="border border-amber-200 rounded-xl p-4 bg-amber-50 text-sm text-amber-800">
              <strong>Migration 031 not applied.</strong> Run it in the Supabase SQL Editor to activate clustering.
              Cluster-based stats below are inactive until then.
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Listings", value: data.total_listings },
              { label: "Sources", value: (data.sources || []).join(", ") || "—" },
              { label: "Coord Coverage", value: data.coord_coverage_pct != null ? `${data.coord_coverage_pct}%` : "—" },
              { label: "Multi-source Clusters", value: data.cluster_column_active ? data.multi_source_clusters : "N/A" },
            ].map(k => (
              <div key={k.label} className="border rounded-xl p-4 bg-white text-center">
                <div className="text-2xl font-bold text-gray-800">{k.value}</div>
                <div className="text-xs text-gray-400 mt-1">{k.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Algo Candidate Pairs", value: data.algorithm_candidate_pairs, sub: "price ±8% + same beds" },
              { label: "Coord-confirmed", value: data.coord_confirmed_pairs, sub: "< 200 m apart ✓", color: "text-green-600" },
              { label: "Coord-refuted", value: data.coord_refuted_pairs, sub: "> 200 m — false positives", color: "text-red-500" },
              { label: "False Positive Rate", value: data.false_positive_rate_pct != null ? `${data.false_positive_rate_pct}%` : "—", sub: "old algo without coords", color: data.false_positive_rate_pct > 90 ? "text-red-600" : "text-gray-800" },
            ].map(k => (
              <div key={k.label} className="border rounded-xl p-4 bg-white text-center">
                <div className={`text-2xl font-bold ${(k as any).color || "text-gray-800"}`}>{k.value}</div>
                <div className="text-xs text-gray-400 mt-1">{k.label}</div>
                <div className="text-xs text-gray-300">{k.sub}</div>
              </div>
            ))}
          </div>

          {(data.pairs_by_source || []).length > 0 && (
            <div className="border rounded-xl p-4 bg-white">
              <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Candidate Pairs by Source</h3>
              <div className="space-y-2">
                {data.pairs_by_source.map((p: any) => (
                  <div key={p.pair} className="flex items-center gap-3 text-sm">
                    <span className="font-mono text-gray-600 w-52 shrink-0">{p.pair}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className="bg-blue-400 h-2 rounded-full" style={{ width: `${Math.min(100, p.count / (data.algorithm_candidate_pairs || 1) * 100)}%` }} />
                    </div>
                    <span className="text-gray-500 w-8 text-right">{p.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(data.example_confirmed_duplicates || []).length > 0 && (
            <div className="border rounded-xl p-4 bg-white">
              <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Coord-confirmed Duplicates (examples)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-gray-400 border-b">
                    {["Sources", "Price A / B", "Size A / B", "Bedrooms", "Distance", "Clustered"].map(h => <th key={h} className="px-2 py-1.5 text-left">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {data.example_confirmed_duplicates.map((d: any, i: number) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-2 py-1.5 font-medium">{(d.sources || []).join(" ↔ ")}</td>
                        <td className="px-2 py-1.5">€{d.price?.[0]} / €{d.price?.[1]}</td>
                        <td className="px-2 py-1.5">{d.size_m2?.[0] ?? "—"}m² / {d.size_m2?.[1] ?? "—"}m²</td>
                        <td className="px-2 py-1.5">{d.bedrooms}</td>
                        <td className="px-2 py-1.5">{d.dist_m}m</td>
                        <td className="px-2 py-1.5">
                          {d.clustered
                            ? <CheckCircle2 className="w-3 h-3 text-green-500" />
                            : <XCircle className="w-3 h-3 text-red-400" />}
                        </td>
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

// ─── Notification Trace Tab ───────────────────────────────────────────────────

const SUPPRESSION_LABELS: Record<string, { label: string; color: string; note?: string }> = {
  no_subscription:        { label: "No subscription",   color: "text-red-600 bg-red-50" },
  all_channels_disabled:  { label: "All channels off",  color: "text-gray-500 bg-gray-100" },
  email_disabled:         { label: "Email off",         color: "text-gray-500 bg-gray-100" },
  push_disabled:          { label: "Push off",          color: "text-gray-500 bg-gray-100" },
  stale_listing_gt_2h:    { label: "Stale >2h",         color: "text-amber-600 bg-amber-50" },
  email_cap_exceeded:     { label: "Email cap",         color: "text-amber-600 bg-amber-50" },
  no_token:               { label: "No push token",     color: "text-orange-600 bg-orange-50" },
  bad_source_data:        { label: "Bad source data",   color: "text-red-600 bg-red-50",
                            note: "Listing was ingested but had missing/invalid fields (no price, no title, etc). Marked sent to prevent retry." },
  profile_inactive:       { label: "Profile inactive",  color: "text-gray-500 bg-gray-100" },
  duplicate:              { label: "Duplicate",         color: "text-gray-400 bg-gray-50" },
};

function SuppressionBadge({ reason }: { reason: string | null }) {
  if (!reason) return null;
  const meta = SUPPRESSION_LABELS[reason] ?? { label: reason, color: "text-purple-600 bg-purple-50" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>
      {meta.label}
    </span>
  );
}

function NotifTraceSummary({ data }: { data: any }) {
  const s = data.summary ?? {};
  const settings = data.notification_settings;
  const sub = data.subscription;
  const matches: any[] = data.matches ?? [];

  // Build suppression breakdown
  const suppressionCounts: Record<string, number> = {};
  for (const m of matches) {
    if (m.suppression_reason) {
      suppressionCounts[m.suppression_reason] = (suppressionCounts[m.suppression_reason] ?? 0) + 1;
    }
  }
  const suppressionEntries = Object.entries(suppressionCounts).sort((a, b) => b[1] - a[1]);

  const pushMarkedSent  = s.push_marked_sent  ?? 0;
  const emailMarkedSent = s.email_marked_sent ?? 0;
  const hasMasPattern   = pushMarkedSent > 0 || emailMarkedSent > 0;

  const kpis = [
    { label: "Total matches", value: s.total ?? 0, color: "text-gray-800" },
    { label: "Email sent (real)", value: s.email_sent ?? 0, color: "text-green-700" },
    { label: "Push sent (real)", value: s.push_sent ?? 0, color: "text-blue-700" },
    { label: "Suppressed", value: s.suppressed ?? 0, color: s.suppressed > 0 ? "text-amber-700" : "text-gray-400" },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        {kpis.map(({ label, value, color }) => (
          <div key={label} className="border rounded-lg p-3 bg-white">
            <div className="text-xs text-gray-400">{label}</div>
            <div className={`font-semibold text-lg ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {hasMasPattern && (
        <div className="border rounded-xl p-3 bg-blue-50 border-blue-200 text-xs text-blue-700 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-500" />
          <div>
            <span className="font-semibold">Mark-as-sent (no real notification):</span>{" "}
            {emailMarkedSent > 0 && <span>{emailMarkedSent} email </span>}
            {pushMarkedSent > 0 && <span>{pushMarkedSent} push </span>}
            — when a match is <em>suppressed</em>, the system sets both flags to{" "}
            <code className="bg-blue-100 px-1 rounded">true</code> to prevent re-processing on the next ingest cycle.
            No actual notification was delivered.
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-xs">
        {settings && (
          <>
            <span className={`px-2 py-1 rounded-full border font-medium ${settings.email_enabled ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
              Email: {settings.email_enabled ? "on" : "off"}
            </span>
            <span className={`px-2 py-1 rounded-full border font-medium ${settings.push_enabled ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
              Push: {settings.push_enabled ? "on" : "off"}
            </span>
          </>
        )}
        {sub && (
          <span className={`px-2 py-1 rounded-full border font-medium ${sub.status === "active" || sub.status === "trialing" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-600 border-red-200"}`}>
            Sub: {sub.status} {sub.plan ? `(${sub.plan})` : ""}
          </span>
        )}
      </div>

      {suppressionEntries.length > 0 && (
        <div className="border rounded-xl p-4 bg-amber-50 border-amber-200 space-y-2">
          <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Suppression Breakdown</div>
          <div className="flex flex-wrap gap-2">
            {suppressionEntries.map(([reason, cnt]) => {
              const meta = SUPPRESSION_LABELS[reason] ?? { label: reason, color: "text-purple-600 bg-purple-50" };
              return (
                <span key={reason} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${meta.color}`}
                  title={(meta as any).note ?? reason}>
                  {meta.label} <span className="font-bold">×{cnt}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationTraceTab() {
  const [email, setEmail] = useState("");
  const [query, setQuery] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/admin/portal/notification-trace", query],
    queryFn: () => adminFetch(`/api/admin/portal/notification-trace?email=${encodeURIComponent(query)}&limit=100`),
    enabled: !!query,
  });

  const matches: any[] = data?.matches ?? [];

  return (
    <div className="space-y-5">
      <div className="border rounded-xl p-4 bg-white space-y-3">
        <h3 className="font-semibold text-gray-700 flex items-center gap-2">
          <Bell className="w-4 h-4" /> Notification Trace
          <span className="text-xs text-gray-400 font-normal ml-1">— full match + delivery audit for a user</span>
        </h3>
        <div className="flex gap-2">
          <input
            className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="User email…"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && setQuery(email.trim())}
            data-testid="input-notif-trace-email"
          />
          <Button onClick={() => setQuery(email.trim())} disabled={!email.trim() || isLoading} data-testid="button-notif-trace-search">
            <Search className="w-4 h-4 mr-1" /> Trace
          </Button>
        </div>
        {isLoading && <div className="text-center py-4 text-gray-400">Loading notification trace…</div>}
        {error && <div className="text-red-500 text-sm">{(error as Error).message}</div>}
      </div>

      {data && (
        <>
          <NotifTraceSummary data={data} />

          {matches.length === 0 ? (
            <div className="text-center py-10 text-gray-400">No matches found for this user.</div>
          ) : (
            <div className="border rounded-xl overflow-hidden bg-white">
              <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                <span className="font-semibold text-gray-700 text-sm">Match Delivery Log ({matches.length})</span>
                <span className="text-xs text-gray-400">newest first</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400 border-b bg-gray-50">
                      {["Matched", "Listing", "Source", "Price", "Email", "Push", "Buffered", "Flush attempted", "Suppression", "Provider error"].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map((m: any) => (
                      <tr key={`${m.listing_id}`} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{relativeTime(m.matched_at)}</td>
                        <td className="px-3 py-2 max-w-[180px]">
                          <div className="truncate font-medium text-gray-700" title={m.listing_title}>{m.listing_title || "—"}</div>
                          <div className="text-gray-400 truncate">{m.listing_city}</div>
                        </td>
                        <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{m.listing_source || "—"}</td>
                        <td className="px-3 py-2 text-gray-500">
                          {m.listing_price ? `€${Number(m.listing_price).toLocaleString()}` : "—"}
                        </td>
                        <td className="px-3 py-2">
                          {m.email_sent ? (
                            <span className="text-green-600 font-medium">
                              ✓{m.email_sent_at ? ` ${relativeTime(m.email_sent_at)}` : ""}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {m.push_sent ? (
                            <span className="text-blue-600 font-medium">
                              ✓{m.push_sent_at ? ` ${relativeTime(m.push_sent_at)}` : ""}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-400 whitespace-nowrap">
                          {m.buffered_at ? relativeTime(m.buffered_at) : "—"}
                        </td>
                        <td className="px-3 py-2 text-gray-400 whitespace-nowrap">
                          {m.flush_attempted_at ? relativeTime(m.flush_attempted_at) : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <SuppressionBadge reason={m.suppression_reason} />
                        </td>
                        <td className="px-3 py-2 max-w-[160px]">
                          {m.provider_error ? (
                            <span className="text-red-500 truncate block" title={m.provider_error}>{m.provider_error.slice(0, 40)}</span>
                          ) : "—"}
                        </td>
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminPipelineHealthPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
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
        {activeTab === "notiftrace" && <NotificationTraceTab />}
        {activeTab === "dedup" && <DedupAuditTab />}
        {activeTab === "sla" && <SlaMetricsTab />}
        {activeTab === "diagnostic" && <UserDiagnosticTab />}
        {activeTab === "registry" && <SourceRegistryTab />}
      </div>
    </div>
  );
}
