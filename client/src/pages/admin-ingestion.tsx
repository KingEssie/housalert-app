import { apiFetch } from "@/lib/api-base";
import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  Activity, RefreshCw, CheckCircle2, AlertTriangle, XCircle,
  Clock, Database, Zap, TrendingUp, ChevronLeft, Loader2, Bell, Search,
} from "lucide-react";

interface RunSummary {
  id: number;
  started_at: string;
  finished_at: string;
  duration_sec: number;
  cities_count: number;
  total_found: number;
  total_inserted: number;
  total_duplicates: number;
  total_matches: number;
  total_errors: number;
  status: string;
}

interface SummaryData {
  running: boolean;
  lastRunAt: string | null;
  lastSuccessfulRunAt: string | null;
  lastError: string | null;
  nextRunAt: string | null;
  intervalMinutes: number;
  todayFetched: number;
  todayInserted: number;
  runs: RunSummary[];
}

interface CityRow {
  city: string;
  found: number;
  inserted: number;
  duplicates: number;
  matches: number;
  errors: number;
}

interface SourceRow {
  name: string;
  found: number;
  inserted: number;
  duplicates: number;
  errors: number;
  last_success: string | null;
}

interface SourceStatus {
  name: string;
  status: "active" | "broken" | "gone";
  note?: string;
}

async function fetchAdmin<T>(path: string): Promise<T> {
  const { data: session } = await supabase.auth.getSession();
  const token = session?.session?.access_token;
  if (!token) throw new Error("Not authenticated");

  const res = await apiFetch(path, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new Error("UNAUTHORIZED");
  if (res.status === 403) throw new Error("FORBIDDEN");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: typeof CheckCircle2; color: string; bg: string }> = {
    success: { icon: CheckCircle2, color: "text-green-700", bg: "bg-green-50" },
    partial: { icon: AlertTriangle, color: "text-amber-700", bg: "bg-amber-50" },
    failed: { icon: XCircle, color: "text-ha-danger", bg: "bg-ha-danger/5" },
    active: { icon: CheckCircle2, color: "text-green-700", bg: "bg-green-50" },
    broken: { icon: AlertTriangle, color: "text-amber-700", bg: "bg-amber-50" },
    gone: { icon: XCircle, color: "text-ha-danger", bg: "bg-ha-danger/5" },
  };
  const c = config[status] || config.failed;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${c.color} ${c.bg}`} data-testid={`badge-status-${status}`}>
      <Icon className="w-3 h-3" />
      {status}
    </span>
  );
}

function StatCard({ label, value, icon: Icon, sub }: { label: string; value: string | number; icon: typeof Activity; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm" data-testid={`stat-${label.toLowerCase().replace(/\s/g, "-")}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-[#334855]" />
        <span className="text-xs font-medium text-[#334855] uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-[#111111]">{value}</p>
      {sub && <p className="text-xs text-[#334855] mt-0.5">{sub}</p>}
    </div>
  );
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AdminIngestionPage() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [cities, setCities] = useState<CityRow[]>([]);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [statuses, setStatuses] = useState<SourceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pushTesting, setPushTesting] = useState(false);
  const [pushResult, setPushResult] = useState<{ success: boolean; message: string } | null>(null);
  const [debugData, setDebugData] = useState<any>(null);
  const [debugLoading, setDebugLoading] = useState(false);
  const [debugError, setDebugError] = useState<string | null>(null);

  const loadData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const [summaryData, citiesData, sourcesData] = await Promise.all([
        fetchAdmin<SummaryData>("/api/admin/ingestion/summary"),
        fetchAdmin<{ cities: CityRow[] }>("/api/admin/ingestion/cities"),
        fetchAdmin<{ sources: SourceRow[]; statuses: SourceStatus[] }>("/api/admin/ingestion/sources"),
      ]);
      setSummary(summaryData);
      setCities(citiesData.cities);
      setSources(sourcesData.sources);
      setStatuses(sourcesData.statuses);
      setError(null);
    } catch (err: any) {
      if (err.message === "UNAUTHORIZED") {
        navigate("/login");
        return;
      } else if (err.message === "FORBIDDEN") {
        setError("forbidden");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleTestPush = useCallback(async () => {
    setPushTesting(true);
    setPushResult(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) { navigate("/login"); return; }

      const res = await apiFetch("/api/admin/test-push", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) { navigate("/login"); return; }
      if (res.status === 403) { setPushResult({ success: false, message: "Zugriff verweigert" }); return; }
      if (!res.ok) { setPushResult({ success: false, message: `Server-Fehler (${res.status})` }); return; }

      const data = await res.json();
      if (data.success) {
        setPushResult({ success: true, message: `Push gesendet (${data.sent} Abo${data.sent !== 1 ? "s" : ""})` });
      } else {
        setPushResult({ success: false, message: data.message || "Keine aktiven Push-Abos gefunden" });
      }
    } catch (err: any) {
      setPushResult({ success: false, message: err.message || "Fehler beim Senden" });
    } finally {
      setPushTesting(false);
    }
  }, [navigate]);

  const loadDebugData = useCallback(async () => {
    setDebugLoading(true);
    setDebugError(null);
    try {
      const data = await fetchAdmin<any>("/api/admin/debug/match-alignment");
      setDebugData(data);
    } catch (err: any) {
      if (err.message === "UNAUTHORIZED") { navigate("/login"); return; }
      if (err.message === "FORBIDDEN") { setDebugError("Zugriff verweigert — nur für Admins"); return; }
      setDebugError(err.message || "Fehler beim Laden");
    } finally {
      setDebugLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/login"); return; }
    loadData();
    const interval = setInterval(() => loadData(), 30000);
    return () => clearInterval(interval);
  }, [user, authLoading, loadData, navigate]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F7F7]">
        <Loader2 className="w-8 h-8 animate-spin text-[#334855]" />
      </div>
    );
  }

  if (error === "forbidden") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F7F7] px-6">
        <XCircle className="w-12 h-12 text-ha-danger mb-4" />
        <h1 className="text-xl font-bold text-[#111111] mb-2" data-testid="text-forbidden">Access denied</h1>
        <p className="text-[#334855] mb-6">You do not have admin access.</p>
        <button onClick={() => navigate("/dashboard")} className="px-6 py-2 rounded-lg bg-gray-900 text-white font-medium" data-testid="button-go-dashboard">
          Go to Dashboard
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F7F7] px-6">
        <AlertTriangle className="w-12 h-12 text-[#334855] mb-4" />
        <h1 className="text-xl font-bold text-[#111111] mb-2">Error loading data</h1>
        <p className="text-[#334855] mb-6">{error}</p>
        <button onClick={() => loadData()} className="px-6 py-2 rounded-lg bg-gray-900 text-white font-medium" data-testid="button-retry">
          Retry
        </button>
      </div>
    );
  }

  const latestRun = summary?.runs?.[0] || null;
  const cityStatus = (row: CityRow) => {
    if (row.errors > 0 && row.inserted === 0 && row.found === 0) return "failed";
    if (row.errors > 0) return "partial";
    return "success";
  };

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      <header className="bg-white border-b border-[#E5E7EB] sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/dashboard")} className="p-1.5 rounded-lg hover:bg-[#F7F7F7]" data-testid="button-back">
              <ChevronLeft className="w-5 h-5 text-[#334855]" />
            </button>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#111111]" />
              <h1 className="text-lg font-bold text-[#111111]" data-testid="text-admin-title">Ingestion Monitor</h1>
            </div>
            {summary?.running && (
              <span className="ml-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-ha-primary/5 text-ha-primary text-xs font-semibold animate-pulse" data-testid="badge-running">
                <Loader2 className="w-3 h-3 animate-spin" />
                Running
              </span>
            )}
          </div>
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="p-2 rounded-lg hover:bg-[#F7F7F7] disabled:opacity-50"
            data-testid="button-refresh"
          >
            <RefreshCw className={`w-4 h-4 text-[#334855] ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {summary?.lastError && (
          <div className="bg-ha-danger/5 border border-ha-danger/20 rounded-xl p-4 flex items-start gap-3" data-testid="alert-last-error">
            <XCircle className="w-5 h-5 text-ha-danger mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-ha-danger">Last run error</p>
              <p className="text-sm text-ha-danger mt-0.5">{summary.lastError}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Last Run" value={timeAgo(summary?.lastRunAt || null)} icon={Clock} sub={formatTime(summary?.lastRunAt || null)} />
          <StatCard label="Duration" value={latestRun ? `${latestRun.duration_sec}s` : "—"} icon={Zap} sub={`${latestRun?.cities_count || 0} cities`} />
          <StatCard label="Today Found" value={summary?.todayFetched ?? 0} icon={Database} />
          <StatCard label="Today Inserted" value={summary?.todayInserted ?? 0} icon={TrendingUp} />
        </div>

        {latestRun && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4" data-testid="section-latest-run">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-[#111111] uppercase tracking-wide">Latest Run</h2>
              <StatusBadge status={latestRun.status} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
              <div>
                <p className="text-xl font-bold text-[#111111]">{latestRun.total_found}</p>
                <p className="text-xs text-[#334855]">Found</p>
              </div>
              <div>
                <p className="text-xl font-bold text-green-600">{latestRun.total_inserted}</p>
                <p className="text-xs text-[#334855]">Inserted</p>
              </div>
              <div>
                <p className="text-xl font-bold text-[#334855]">{latestRun.total_duplicates}</p>
                <p className="text-xs text-[#334855]">Duplicates</p>
              </div>
              <div>
                <p className="text-xl font-bold text-ha-primary">{latestRun.total_matches}</p>
                <p className="text-xs text-[#334855]">Matches</p>
              </div>
              <div>
                <p className={`text-xl font-bold ${latestRun.total_errors > 0 ? "text-ha-danger" : "text-[#334855]"}`}>{latestRun.total_errors}</p>
                <p className="text-xs text-[#334855]">Errors</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden" data-testid="section-cities">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-bold text-[#111111] uppercase tracking-wide">Per City ({cities.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F7F7F7] text-left">
                  <th className="px-4 py-2 font-semibold text-[#334855]">City</th>
                  <th className="px-3 py-2 font-semibold text-[#334855] text-right">Found</th>
                  <th className="px-3 py-2 font-semibold text-[#334855] text-right">Inserted</th>
                  <th className="px-3 py-2 font-semibold text-[#334855] text-right">Dupes</th>
                  <th className="px-3 py-2 font-semibold text-[#334855] text-right">Matches</th>
                  <th className="px-3 py-2 font-semibold text-[#334855] text-right">Errors</th>
                  <th className="px-3 py-2 font-semibold text-[#334855] text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {cities.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-[#334855]">No data yet — waiting for first completed run</td></tr>
                ) : cities.map((row) => (
                  <tr key={row.city} className="border-t border-gray-50 hover:bg-[#F7F7F7]" data-testid={`row-city-${row.city}`}>
                    <td className="px-4 py-2 font-medium text-[#111111]">{row.city}</td>
                    <td className="px-3 py-2 text-right text-[#111111]">{row.found}</td>
                    <td className="px-3 py-2 text-right text-green-700 font-medium">{row.inserted}</td>
                    <td className="px-3 py-2 text-right text-[#334855]">{row.duplicates}</td>
                    <td className="px-3 py-2 text-right text-ha-primary">{row.matches}</td>
                    <td className={`px-3 py-2 text-right font-medium ${row.errors > 0 ? "text-ha-danger" : "text-[#334855]"}`}>{row.errors}</td>
                    <td className="px-3 py-2 text-center"><StatusBadge status={cityStatus(row)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden" data-testid="section-sources">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-bold text-[#111111] uppercase tracking-wide">Per Source</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F7F7F7] text-left">
                  <th className="px-4 py-2 font-semibold text-[#334855]">Source</th>
                  <th className="px-3 py-2 font-semibold text-[#334855] text-right">Found</th>
                  <th className="px-3 py-2 font-semibold text-[#334855] text-right">Inserted</th>
                  <th className="px-3 py-2 font-semibold text-[#334855] text-right">Dupes</th>
                  <th className="px-3 py-2 font-semibold text-[#334855] text-right">Errors</th>
                  <th className="px-3 py-2 font-semibold text-[#334855] text-center">Platform</th>
                  <th className="px-3 py-2 font-semibold text-[#334855]">Last Success</th>
                </tr>
              </thead>
              <tbody>
                {sources.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-[#334855]">No data yet</td></tr>
                ) : sources.map((src) => {
                  const platformStatus = statuses.find(s => s.name === src.name);
                  return (
                    <tr key={src.name} className="border-t border-gray-50 hover:bg-[#F7F7F7]" data-testid={`row-source-${src.name}`}>
                      <td className="px-4 py-2 font-medium text-[#111111]">{src.name}</td>
                      <td className="px-3 py-2 text-right text-[#111111]">{src.found}</td>
                      <td className="px-3 py-2 text-right text-green-700 font-medium">{src.inserted}</td>
                      <td className="px-3 py-2 text-right text-[#334855]">{src.duplicates}</td>
                      <td className={`px-3 py-2 text-right font-medium ${src.errors > 0 ? "text-ha-danger" : "text-[#334855]"}`}>{src.errors}</td>
                      <td className="px-3 py-2 text-center">
                        {platformStatus && <StatusBadge status={platformStatus.status} />}
                      </td>
                      <td className="px-3 py-2 text-[#334855] text-xs">{formatTime(src.last_success)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {summary && summary.runs.length > 1 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden" data-testid="section-history">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-bold text-[#111111] uppercase tracking-wide">Run History ({summary.runs.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F7F7F7] text-left">
                    <th className="px-4 py-2 font-semibold text-[#334855]">Time</th>
                    <th className="px-3 py-2 font-semibold text-[#334855] text-right">Duration</th>
                    <th className="px-3 py-2 font-semibold text-[#334855] text-right">Cities</th>
                    <th className="px-3 py-2 font-semibold text-[#334855] text-right">Found</th>
                    <th className="px-3 py-2 font-semibold text-[#334855] text-right">Inserted</th>
                    <th className="px-3 py-2 font-semibold text-[#334855] text-right">Matches</th>
                    <th className="px-3 py-2 font-semibold text-[#334855] text-right">Errors</th>
                    <th className="px-3 py-2 font-semibold text-[#334855] text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.runs.map((run) => (
                    <tr key={run.id} className="border-t border-gray-50 hover:bg-[#F7F7F7]" data-testid={`row-run-${run.id}`}>
                      <td className="px-4 py-2 text-[#111111]">{formatTime(run.finished_at)}</td>
                      <td className="px-3 py-2 text-right text-[#111111]">{run.duration_sec}s</td>
                      <td className="px-3 py-2 text-right text-[#111111]">{run.cities_count}</td>
                      <td className="px-3 py-2 text-right text-[#111111]">{run.total_found}</td>
                      <td className="px-3 py-2 text-right text-green-700 font-medium">{run.total_inserted}</td>
                      <td className="px-3 py-2 text-right text-ha-primary">{run.total_matches}</td>
                      <td className={`px-3 py-2 text-right font-medium ${run.total_errors > 0 ? "text-ha-danger" : "text-[#334855]"}`}>{run.total_errors}</td>
                      <td className="px-3 py-2 text-center"><StatusBadge status={run.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden" data-testid="section-test-push">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-bold text-[#111111] uppercase tracking-wide">Push-Benachrichtigungen testen</h2>
          </div>
          <div className="p-4 flex flex-col gap-3">
            <p className="text-sm text-[#334855]">
              Sendet eine Test-Push-Benachrichtigung an alle aktiven Push-Abos deines Admin-Kontos. Stelle sicher, dass Push in den Benachrichtigungseinstellungen aktiviert ist.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleTestPush}
                disabled={pushTesting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                data-testid="button-test-push"
              >
                {pushTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                {pushTesting ? "Wird gesendet…" : "Test Push senden"}
              </button>
              {pushResult && (
                <span
                  className={`inline-flex items-center gap-1 text-sm font-medium ${pushResult.success ? "text-green-700" : "text-ha-danger"}`}
                  data-testid="text-push-result"
                >
                  {pushResult.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {pushResult.message}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden" data-testid="section-match-alignment">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#111111] uppercase tracking-wide">Match Alignment Debug</h2>
            <button
              onClick={loadDebugData}
              disabled={debugLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F7F7F7] hover:bg-[#E5E7EB] text-[#111111] text-xs font-semibold disabled:opacity-50 transition-colors"
              data-testid="button-refresh-debug"
            >
              {debugLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              {debugLoading ? "Laden…" : "Analyse starten"}
            </button>
          </div>
          <div className="p-4">
            {!debugData && !debugLoading && !debugError && (
              <p className="text-sm text-[#334855]">Klicke "Analyse starten" um die E-Mail/App-Sichtbarkeit deines Admin-Kontos zu vergleichen.</p>
            )}
            {debugError && (
              <div className="flex items-center gap-2 text-sm text-ha-danger" data-testid="text-debug-error">
                <XCircle className="w-4 h-4 shrink-0" />
                {debugError}
              </div>
            )}
            {debugData && (
              <div className="flex flex-col gap-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="bg-[#F7F7F7] rounded-lg p-3">
                    <div className="text-lg font-bold text-[#111111]">{debugData.total_match_rows ?? 0}</div>
                    <div className="text-[10px] uppercase text-[#334855] font-medium">Match-Zeilen</div>
                  </div>
                  <div className="bg-[#F7F7F7] rounded-lg p-3">
                    <div className="text-lg font-bold text-[#111111]">{debugData.app_visible_count ?? 0}</div>
                    <div className="text-[10px] uppercase text-[#334855] font-medium">App-sichtbar</div>
                  </div>
                  <div className="bg-[#F7F7F7] rounded-lg p-3">
                    <div className="text-lg font-bold text-[#111111]">{debugData.recent_emailed_count ?? 0}</div>
                    <div className="text-[10px] uppercase text-[#334855] font-medium">Zuletzt gemailt</div>
                  </div>
                  <div className={`rounded-lg p-3 ${(debugData.mismatch_count ?? 0) > 0 ? "bg-ha-danger/5" : "bg-green-50"}`}>
                    <div className={`text-lg font-bold ${(debugData.mismatch_count ?? 0) > 0 ? "text-ha-danger" : "text-green-700"}`}>{debugData.mismatch_count ?? 0}</div>
                    <div className={`text-[10px] uppercase font-medium ${(debugData.mismatch_count ?? 0) > 0 ? "text-ha-danger" : "text-green-500"}`}>Abweichungen</div>
                  </div>
                </div>

                {debugData.subscription && (
                  <div className="text-xs text-[#334855]">
                    Abo: <span className="font-medium text-[#111111]">{debugData.subscription.status || "keins"}</span>
                    {debugData.subscription.created_at && <> &middot; seit {formatTime(debugData.subscription.created_at)}</>}
                    {debugData.emailed_at && <> &middot; letzter E-Mail-Versand: {formatTime(debugData.emailed_at)}</>}
                  </div>
                )}

                {debugData.emailed_but_not_visible.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-ha-danger uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Gemailt, aber NICHT in App sichtbar ({debugData.emailed_but_not_visible.length})
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-ha-danger/5 text-left">
                            <th className="px-2 py-1.5 font-semibold text-ha-danger">Titel</th>
                            <th className="px-2 py-1.5 font-semibold text-ha-danger">Stadt</th>
                            <th className="px-2 py-1.5 font-semibold text-ha-danger">Quelle</th>
                            <th className="px-2 py-1.5 font-semibold text-ha-danger">Matched</th>
                            <th className="px-2 py-1.5 font-semibold text-ha-danger">Grund</th>
                          </tr>
                        </thead>
                        <tbody>
                          {debugData.emailed_but_not_visible.map((item: any, i: number) => (
                            <tr key={i} className="border-t border-ha-danger/10">
                              <td className="px-2 py-1.5 text-[#111111] max-w-[200px] truncate">{item.title || <span className="text-ha-danger italic">gelöscht</span>}</td>
                              <td className="px-2 py-1.5 text-[#334855]">{item.city || "—"}</td>
                              <td className="px-2 py-1.5 text-[#334855]">{item.source || "—"}</td>
                              <td className="px-2 py-1.5 text-[#334855] whitespace-nowrap">{item.matched_at ? formatTime(item.matched_at) : "—"}</td>
                              <td className="px-2 py-1.5">
                                <span className="inline-block px-1.5 py-0.5 rounded bg-ha-danger/10 text-ha-danger text-[10px] font-medium">{item.exclusion_reason}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {debugData.recent_emailed.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-[#111111] uppercase tracking-wide mb-2">Zuletzt per E-Mail versendet ({debugData.recent_emailed.length})</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-[#F7F7F7] text-left">
                            <th className="px-2 py-1.5 font-semibold text-[#334855]">Titel</th>
                            <th className="px-2 py-1.5 font-semibold text-[#334855]">Stadt</th>
                            <th className="px-2 py-1.5 font-semibold text-[#334855]">Quelle</th>
                            <th className="px-2 py-1.5 font-semibold text-[#334855]">Matched</th>
                            <th className="px-2 py-1.5 font-semibold text-[#334855]">Preis</th>
                          </tr>
                        </thead>
                        <tbody>
                          {debugData.recent_emailed.map((item: any, i: number) => (
                            <tr key={i} className="border-t border-gray-100">
                              <td className="px-2 py-1.5 text-[#111111] max-w-[200px] truncate">{item.title || <span className="text-[#334855] italic">—</span>}</td>
                              <td className="px-2 py-1.5 text-[#334855]">{item.city || "—"}</td>
                              <td className="px-2 py-1.5 text-[#334855]">{item.source || "—"}</td>
                              <td className="px-2 py-1.5 text-[#334855] whitespace-nowrap">{item.matched_at ? formatTime(item.matched_at) : "—"}</td>
                              <td className="px-2 py-1.5 text-[#334855]">{item.price ? `${item.price}€` : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-xs font-bold text-[#111111] uppercase tracking-wide mb-2">
                    App-sichtbare Matches ({debugData.app_visible?.length || 0} von {debugData.app_visible_count})
                  </h3>
                  {debugData.app_visible?.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-[#F7F7F7] text-left">
                            <th className="px-2 py-1.5 font-semibold text-[#334855]">Titel</th>
                            <th className="px-2 py-1.5 font-semibold text-[#334855]">Stadt</th>
                            <th className="px-2 py-1.5 font-semibold text-[#334855]">Quelle</th>
                            <th className="px-2 py-1.5 font-semibold text-[#334855]">Matched</th>
                            <th className="px-2 py-1.5 font-semibold text-[#334855]">Preis</th>
                          </tr>
                        </thead>
                        <tbody>
                          {debugData.app_visible.map((item: any, i: number) => (
                            <tr key={i} className="border-t border-gray-100">
                              <td className="px-2 py-1.5 text-[#111111] max-w-[200px] truncate">{item.title || "—"}</td>
                              <td className="px-2 py-1.5 text-[#334855]">{item.city || "—"}</td>
                              <td className="px-2 py-1.5 text-[#334855]">{item.source || "—"}</td>
                              <td className="px-2 py-1.5 text-[#334855] whitespace-nowrap">{item.matched_at ? formatTime(item.matched_at) : "—"}</td>
                              <td className="px-2 py-1.5 text-[#334855]">{item.price ? `${item.price}€` : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-[#334855]">Keine app-sichtbaren Matches gefunden.</p>
                  )}
                </div>

                {debugData.recent_emailed.length === 0 && debugData.emailed_but_not_visible.length === 0 && (
                  <div className="flex items-center gap-2 text-sm text-[#334855] bg-[#F7F7F7] rounded-lg p-3">
                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                    Keine E-Mails in diesem Zyklus versendet — es gibt noch keine Vergleichsdaten. Warte bis zum nächsten Ingestion-Zyklus mit aktiven Matches.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="text-center text-xs text-[#334855] pb-6">
          Auto-refreshes every 30s &middot; Next ingestion: {formatTime(summary?.nextRunAt || null)}
        </div>
      </main>
    </div>
  );
}
