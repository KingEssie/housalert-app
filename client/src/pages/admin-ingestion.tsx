import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  Activity, RefreshCw, CheckCircle2, AlertTriangle, XCircle,
  Clock, Database, Zap, TrendingUp, ChevronLeft, Loader2,
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

  const res = await fetch(path, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 403) throw new Error("FORBIDDEN");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: typeof CheckCircle2; color: string; bg: string }> = {
    success: { icon: CheckCircle2, color: "text-green-700", bg: "bg-green-50" },
    partial: { icon: AlertTriangle, color: "text-amber-700", bg: "bg-amber-50" },
    failed: { icon: XCircle, color: "text-red-700", bg: "bg-red-50" },
    active: { icon: CheckCircle2, color: "text-green-700", bg: "bg-green-50" },
    broken: { icon: AlertTriangle, color: "text-amber-700", bg: "bg-amber-50" },
    gone: { icon: XCircle, color: "text-red-700", bg: "bg-red-50" },
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
        <Icon className="w-4 h-4 text-gray-400" />
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
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
      if (err.message === "FORBIDDEN") {
        setError("forbidden");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/login"); return; }
    loadData();
    const interval = setInterval(() => loadData(), 30000);
    return () => clearInterval(interval);
  }, [user, authLoading, loadData, navigate]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error === "forbidden") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6">
        <XCircle className="w-12 h-12 text-red-400 mb-4" />
        <h1 className="text-xl font-bold text-gray-900 mb-2" data-testid="text-forbidden">Access denied</h1>
        <p className="text-gray-500 mb-6">You do not have admin access.</p>
        <button onClick={() => navigate("/dashboard")} className="px-6 py-2 rounded-lg bg-gray-900 text-white font-medium" data-testid="button-go-dashboard">
          Go to Dashboard
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6">
        <AlertTriangle className="w-12 h-12 text-amber-400 mb-4" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Error loading data</h1>
        <p className="text-gray-500 mb-6">{error}</p>
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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/dashboard")} className="p-1.5 rounded-lg hover:bg-gray-100" data-testid="button-back">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-gray-700" />
              <h1 className="text-lg font-bold text-gray-900" data-testid="text-admin-title">Ingestion Monitor</h1>
            </div>
            {summary?.running && (
              <span className="ml-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold animate-pulse" data-testid="badge-running">
                <Loader2 className="w-3 h-3 animate-spin" />
                Running
              </span>
            )}
          </div>
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50"
            data-testid="button-refresh"
          >
            <RefreshCw className={`w-4 h-4 text-gray-600 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {summary?.lastError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3" data-testid="alert-last-error">
            <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-800">Last run error</p>
              <p className="text-sm text-red-700 mt-0.5">{summary.lastError}</p>
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
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Latest Run</h2>
              <StatusBadge status={latestRun.status} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
              <div>
                <p className="text-xl font-bold text-gray-900">{latestRun.total_found}</p>
                <p className="text-xs text-gray-500">Found</p>
              </div>
              <div>
                <p className="text-xl font-bold text-green-600">{latestRun.total_inserted}</p>
                <p className="text-xs text-gray-500">Inserted</p>
              </div>
              <div>
                <p className="text-xl font-bold text-gray-400">{latestRun.total_duplicates}</p>
                <p className="text-xs text-gray-500">Duplicates</p>
              </div>
              <div>
                <p className="text-xl font-bold text-blue-600">{latestRun.total_matches}</p>
                <p className="text-xs text-gray-500">Matches</p>
              </div>
              <div>
                <p className={`text-xl font-bold ${latestRun.total_errors > 0 ? "text-red-600" : "text-gray-400"}`}>{latestRun.total_errors}</p>
                <p className="text-xs text-gray-500">Errors</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden" data-testid="section-cities">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Per City ({cities.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-2 font-semibold text-gray-600">City</th>
                  <th className="px-3 py-2 font-semibold text-gray-600 text-right">Found</th>
                  <th className="px-3 py-2 font-semibold text-gray-600 text-right">Inserted</th>
                  <th className="px-3 py-2 font-semibold text-gray-600 text-right">Dupes</th>
                  <th className="px-3 py-2 font-semibold text-gray-600 text-right">Matches</th>
                  <th className="px-3 py-2 font-semibold text-gray-600 text-right">Errors</th>
                  <th className="px-3 py-2 font-semibold text-gray-600 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {cities.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">No data yet — waiting for first completed run</td></tr>
                ) : cities.map((row) => (
                  <tr key={row.city} className="border-t border-gray-50 hover:bg-gray-50" data-testid={`row-city-${row.city}`}>
                    <td className="px-4 py-2 font-medium text-gray-900">{row.city}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{row.found}</td>
                    <td className="px-3 py-2 text-right text-green-700 font-medium">{row.inserted}</td>
                    <td className="px-3 py-2 text-right text-gray-400">{row.duplicates}</td>
                    <td className="px-3 py-2 text-right text-blue-700">{row.matches}</td>
                    <td className={`px-3 py-2 text-right font-medium ${row.errors > 0 ? "text-red-600" : "text-gray-400"}`}>{row.errors}</td>
                    <td className="px-3 py-2 text-center"><StatusBadge status={cityStatus(row)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden" data-testid="section-sources">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Per Source</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-2 font-semibold text-gray-600">Source</th>
                  <th className="px-3 py-2 font-semibold text-gray-600 text-right">Found</th>
                  <th className="px-3 py-2 font-semibold text-gray-600 text-right">Inserted</th>
                  <th className="px-3 py-2 font-semibold text-gray-600 text-right">Dupes</th>
                  <th className="px-3 py-2 font-semibold text-gray-600 text-right">Errors</th>
                  <th className="px-3 py-2 font-semibold text-gray-600 text-center">Platform</th>
                  <th className="px-3 py-2 font-semibold text-gray-600">Last Success</th>
                </tr>
              </thead>
              <tbody>
                {sources.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">No data yet</td></tr>
                ) : sources.map((src) => {
                  const platformStatus = statuses.find(s => s.name === src.name);
                  return (
                    <tr key={src.name} className="border-t border-gray-50 hover:bg-gray-50" data-testid={`row-source-${src.name}`}>
                      <td className="px-4 py-2 font-medium text-gray-900">{src.name}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{src.found}</td>
                      <td className="px-3 py-2 text-right text-green-700 font-medium">{src.inserted}</td>
                      <td className="px-3 py-2 text-right text-gray-400">{src.duplicates}</td>
                      <td className={`px-3 py-2 text-right font-medium ${src.errors > 0 ? "text-red-600" : "text-gray-400"}`}>{src.errors}</td>
                      <td className="px-3 py-2 text-center">
                        {platformStatus && <StatusBadge status={platformStatus.status} />}
                      </td>
                      <td className="px-3 py-2 text-gray-500 text-xs">{formatTime(src.last_success)}</td>
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
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Run History ({summary.runs.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-4 py-2 font-semibold text-gray-600">Time</th>
                    <th className="px-3 py-2 font-semibold text-gray-600 text-right">Duration</th>
                    <th className="px-3 py-2 font-semibold text-gray-600 text-right">Cities</th>
                    <th className="px-3 py-2 font-semibold text-gray-600 text-right">Found</th>
                    <th className="px-3 py-2 font-semibold text-gray-600 text-right">Inserted</th>
                    <th className="px-3 py-2 font-semibold text-gray-600 text-right">Matches</th>
                    <th className="px-3 py-2 font-semibold text-gray-600 text-right">Errors</th>
                    <th className="px-3 py-2 font-semibold text-gray-600 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.runs.map((run) => (
                    <tr key={run.id} className="border-t border-gray-50 hover:bg-gray-50" data-testid={`row-run-${run.id}`}>
                      <td className="px-4 py-2 text-gray-700">{formatTime(run.finished_at)}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{run.duration_sec}s</td>
                      <td className="px-3 py-2 text-right text-gray-700">{run.cities_count}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{run.total_found}</td>
                      <td className="px-3 py-2 text-right text-green-700 font-medium">{run.total_inserted}</td>
                      <td className="px-3 py-2 text-right text-blue-700">{run.total_matches}</td>
                      <td className={`px-3 py-2 text-right font-medium ${run.total_errors > 0 ? "text-red-600" : "text-gray-400"}`}>{run.total_errors}</td>
                      <td className="px-3 py-2 text-center"><StatusBadge status={run.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="text-center text-xs text-gray-400 pb-6">
          Auto-refreshes every 30s &middot; Next ingestion: {formatTime(summary?.nextRunAt || null)}
        </div>
      </main>
    </div>
  );
}
