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
  const map: Record<string, { bg: string; color: string; border: string }> = {
    success: { bg: "#edfbf0", color: "#16a34a", border: "#bbf7d0" },
    active:  { bg: "#edfbf0", color: "#16a34a", border: "#bbf7d0" },
    partial: { bg: "#fffbeb", color: "#b45309", border: "#fde68a" },
    broken:  { bg: "#fffbeb", color: "#b45309", border: "#fde68a" },
    failed:  { bg: "#fff1f2", color: "#e11d48", border: "#fecdd3" },
    gone:    { bg: "#fff1f2", color: "#e11d48", border: "#fecdd3" },
  };
  const m = map[status] || { bg: "#f5f5f5", color: "#888888", border: "#e0e0e0" };
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border"
      style={{ backgroundColor: m.bg, color: m.color, borderColor: m.border }}
      data-testid={`badge-status-${status}`}
    >
      {status}
    </span>
  );
}

function StatCard({ label, value, icon: Icon, sub }: { label: string; value: string | number; icon: typeof Activity; sub?: string }) {
  return (
    <div
      className="bg-white rounded-[20px] p-5"
      style={{ border: "1px solid #eeebf3", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
      data-testid={`stat-${label.toLowerCase().replace(/\s/g, "-")}`}
    >
      <div className="flex items-center gap-1.5 mb-3">
        <Icon className="w-3.5 h-3.5" style={{ color: "#bbadfb" }} />
        <span className="text-[10px] font-bold uppercase tracking-[0.07em]" style={{ color: "#aaaaaa" }}>{label}</span>
      </div>
      <p className="text-[28px] font-extrabold tracking-[-0.02em]" style={{ color: "#111111", lineHeight: 1 }}>{value}</p>
      {sub && <p className="text-[11px] mt-1.5" style={{ color: "#aaaaaa" }}>{sub}</p>}
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
        navigate("/");
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
      if (!token) { navigate("/"); return; }

      const res = await apiFetch("/api/admin/test-push", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) { navigate("/"); return; }
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
      if (err.message === "UNAUTHORIZED") { navigate("/"); return; }
      if (err.message === "FORBIDDEN") { setDebugError("Zugriff verweigert — nur für Admins"); return; }
      setDebugError(err.message || "Fehler beim Laden");
    } finally {
      setDebugLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/"); return; }
    loadData();
    const interval = setInterval(() => loadData(), 30000);
    return () => clearInterval(interval);
  }, [user, authLoading, loadData, navigate]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ha-bg">
        <Loader2 className="w-8 h-8 animate-spin text-ha-text-secondary" />
      </div>
    );
  }

  if (error === "forbidden") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-ha-bg px-6">
        <XCircle className="w-12 h-12 text-ha-danger mb-4" />
        <h1 className="text-xl font-bold text-ha-text mb-2" data-testid="text-forbidden">Access denied</h1>
        <p className="text-ha-text-secondary mb-6">You do not have admin access.</p>
        <button onClick={() => navigate("/dashboard")} className="px-6 py-2 rounded-lg bg-gray-900 text-white font-medium" data-testid="button-go-dashboard">
          Go to Dashboard
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-ha-bg px-6">
        <AlertTriangle className="w-12 h-12 text-ha-text-secondary mb-4" />
        <h1 className="text-xl font-bold text-ha-text mb-2">Error loading data</h1>
        <p className="text-ha-text-secondary mb-6">{error}</p>
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
    <div className="min-h-screen" style={{ backgroundColor: "#f5f5f7" }}>
      <header
        className="bg-white sticky top-0 z-10"
        style={{ borderBottom: "1px solid #eeebf3", boxShadow: "0 1px 0 rgba(0,0,0,0.04)" }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-[60px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/admin-portal")}
              className="w-8 h-8 rounded-[10px] flex items-center justify-center transition-colors"
              style={{ backgroundColor: "#f5f5f5" }}
              data-testid="button-back"
            >
              <ChevronLeft className="w-4 h-4" style={{ color: "#666666" }} />
            </button>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4" style={{ color: "#bbadfb" }} />
              <h1 className="text-[16px] font-bold" style={{ color: "#111111" }} data-testid="text-admin-title">Import Monitor</h1>
            </div>
            {summary?.running && (
              <span
                className="ml-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold animate-pulse"
                style={{ backgroundColor: "rgba(187,173,251,0.12)", color: "#7c5fc5" }}
                data-testid="badge-running"
              >
                <Loader2 className="w-3 h-3 animate-spin" />
                Running
              </span>
            )}
          </div>
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="w-8 h-8 rounded-[10px] flex items-center justify-center transition-colors disabled:opacity-40"
            style={{ backgroundColor: "#f5f5f5" }}
            data-testid="button-refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} style={{ color: "#666666" }} />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {summary?.lastError && (
          <div className="bg-ha-danger/5 border border-ha-danger/20 rounded-xl p-4 flex items-start gap-3" data-testid="alert-last-error">
            <XCircle className="w-5 h-5 text-ha-danger mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-ha-danger">Last import error</p>
              <p className="text-sm text-ha-danger mt-0.5">{summary.lastError}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Last Import" value={timeAgo(summary?.lastRunAt || null)} icon={Clock} sub={formatTime(summary?.lastRunAt || null)} />
          <StatCard label="Duration" value={latestRun ? `${latestRun.duration_sec}s` : "—"} icon={Zap} sub={`${latestRun?.cities_count || 0} cities`} />
          <StatCard label="Listings scanned today" value={summary?.todayFetched ?? 0} icon={Database} />
          <StatCard label="New listings today" value={summary?.todayInserted ?? 0} icon={TrendingUp} />
        </div>

        {latestRun && (
          <div className="bg-white rounded-[20px] p-5" style={{ border: "1px solid #eeebf3", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }} data-testid="section-latest-run">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.07em]" style={{ color: "#aaaaaa" }}>Latest Import Run</h2>
              <StatusBadge status={latestRun.status} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
              <div>
                <p className="text-[22px] font-extrabold tracking-tight" style={{ color: "#111111" }}>{latestRun.total_found}</p>
                <p className="text-[11px]" style={{ color: "#aaaaaa" }}>Found</p>
              </div>
              <div>
                <p className="text-[22px] font-extrabold tracking-tight" style={{ color: "#16a34a" }}>{latestRun.total_inserted}</p>
                <p className="text-[11px]" style={{ color: "#aaaaaa" }}>Inserted</p>
              </div>
              <div>
                <p className="text-[22px] font-extrabold tracking-tight" style={{ color: "#888888" }}>{latestRun.total_duplicates}</p>
                <p className="text-[11px]" style={{ color: "#aaaaaa" }}>Dupes</p>
              </div>
              <div>
                <p className="text-[22px] font-extrabold tracking-tight" style={{ color: "#7c5fc5" }}>{latestRun.total_matches}</p>
                <p className="text-[11px]" style={{ color: "#aaaaaa" }}>Matches</p>
              </div>
              <div>
                <p className="text-[22px] font-extrabold tracking-tight" style={{ color: latestRun.total_errors > 0 ? "#e11d48" : "#888888" }}>{latestRun.total_errors}</p>
                <p className="text-[11px]" style={{ color: "#aaaaaa" }}>Errors</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-[20px] overflow-hidden" style={{ border: "1px solid #eeebf3", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }} data-testid="section-cities">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-bold text-ha-text uppercase tracking-wide">Results by city ({cities.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-ha-bg text-left">
                  <th className="px-4 py-2 font-semibold text-ha-text-secondary">City</th>
                  <th className="px-3 py-2 font-semibold text-ha-text-secondary text-right">Found</th>
                  <th className="px-3 py-2 font-semibold text-ha-text-secondary text-right">Inserted</th>
                  <th className="px-3 py-2 font-semibold text-ha-text-secondary text-right">Dupes</th>
                  <th className="px-3 py-2 font-semibold text-ha-text-secondary text-right">Matches</th>
                  <th className="px-3 py-2 font-semibold text-ha-text-secondary text-right">Errors</th>
                  <th className="px-3 py-2 font-semibold text-ha-text-secondary text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {cities.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-ha-text-secondary">No data yet — waiting for first completed run</td></tr>
                ) : cities.map((row) => (
                  <tr key={row.city} className="border-t border-gray-50 hover:bg-ha-bg" data-testid={`row-city-${row.city}`}>
                    <td className="px-4 py-2 font-medium text-ha-text">{row.city}</td>
                    <td className="px-3 py-2 text-right text-ha-text">{row.found}</td>
                    <td className="px-3 py-2 text-right text-green-700 font-medium">{row.inserted}</td>
                    <td className="px-3 py-2 text-right text-ha-text-secondary">{row.duplicates}</td>
                    <td className="px-3 py-2 text-right text-ha-primary">{row.matches}</td>
                    <td className={`px-3 py-2 text-right font-medium ${row.errors > 0 ? "text-ha-danger" : "text-ha-text-secondary"}`}>{row.errors}</td>
                    <td className="px-3 py-2 text-center"><StatusBadge status={cityStatus(row)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-[20px] overflow-hidden" style={{ border: "1px solid #eeebf3", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }} data-testid="section-sources">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-bold text-ha-text uppercase tracking-wide">Results by source</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-ha-bg text-left">
                  <th className="px-4 py-2 font-semibold text-ha-text-secondary">Source</th>
                  <th className="px-3 py-2 font-semibold text-ha-text-secondary text-right">Found</th>
                  <th className="px-3 py-2 font-semibold text-ha-text-secondary text-right">Inserted</th>
                  <th className="px-3 py-2 font-semibold text-ha-text-secondary text-right">Dupes</th>
                  <th className="px-3 py-2 font-semibold text-ha-text-secondary text-right">Errors</th>
                  <th className="px-3 py-2 font-semibold text-ha-text-secondary text-center">Platform</th>
                  <th className="px-3 py-2 font-semibold text-ha-text-secondary">Last Success</th>
                </tr>
              </thead>
              <tbody>
                {sources.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-ha-text-secondary">No data yet</td></tr>
                ) : sources.map((src) => {
                  const platformStatus = statuses.find(s => s.name === src.name);
                  return (
                    <tr key={src.name} className="border-t border-gray-50 hover:bg-ha-bg" data-testid={`row-source-${src.name}`}>
                      <td className="px-4 py-2 font-medium text-ha-text">{src.name}</td>
                      <td className="px-3 py-2 text-right text-ha-text">{src.found}</td>
                      <td className="px-3 py-2 text-right text-green-700 font-medium">{src.inserted}</td>
                      <td className="px-3 py-2 text-right text-ha-text-secondary">{src.duplicates}</td>
                      <td className={`px-3 py-2 text-right font-medium ${src.errors > 0 ? "text-ha-danger" : "text-ha-text-secondary"}`}>{src.errors}</td>
                      <td className="px-3 py-2 text-center">
                        {platformStatus && <StatusBadge status={platformStatus.status} />}
                      </td>
                      <td className="px-3 py-2 text-ha-text-secondary text-xs">{formatTime(src.last_success)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {summary && summary.runs.length > 1 && (
          <div className="bg-white rounded-[20px] overflow-hidden" style={{ border: "1px solid #eeebf3", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }} data-testid="section-history">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-bold text-ha-text uppercase tracking-wide">Import history ({summary.runs.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-ha-bg text-left">
                    <th className="px-4 py-2 font-semibold text-ha-text-secondary">Time</th>
                    <th className="px-3 py-2 font-semibold text-ha-text-secondary text-right">Duration</th>
                    <th className="px-3 py-2 font-semibold text-ha-text-secondary text-right">Cities</th>
                    <th className="px-3 py-2 font-semibold text-ha-text-secondary text-right">Found</th>
                    <th className="px-3 py-2 font-semibold text-ha-text-secondary text-right">Inserted</th>
                    <th className="px-3 py-2 font-semibold text-ha-text-secondary text-right">Matches</th>
                    <th className="px-3 py-2 font-semibold text-ha-text-secondary text-right">Errors</th>
                    <th className="px-3 py-2 font-semibold text-ha-text-secondary text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.runs.map((run) => (
                    <tr key={run.id} className="border-t border-gray-50 hover:bg-ha-bg" data-testid={`row-run-${run.id}`}>
                      <td className="px-4 py-2 text-ha-text">{formatTime(run.finished_at)}</td>
                      <td className="px-3 py-2 text-right text-ha-text">{run.duration_sec}s</td>
                      <td className="px-3 py-2 text-right text-ha-text">{run.cities_count}</td>
                      <td className="px-3 py-2 text-right text-ha-text">{run.total_found}</td>
                      <td className="px-3 py-2 text-right text-green-700 font-medium">{run.total_inserted}</td>
                      <td className="px-3 py-2 text-right text-ha-primary">{run.total_matches}</td>
                      <td className={`px-3 py-2 text-right font-medium ${run.total_errors > 0 ? "text-ha-danger" : "text-ha-text-secondary"}`}>{run.total_errors}</td>
                      <td className="px-3 py-2 text-center"><StatusBadge status={run.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="bg-white rounded-[20px] overflow-hidden" style={{ border: "1px solid #eeebf3", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }} data-testid="section-test-push">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-bold text-ha-text uppercase tracking-wide">Test push notifications</h2>
          </div>
          <div className="p-4 flex flex-col gap-3">
            <p className="text-sm text-ha-text-secondary">
              Sends a test push notification to all active push subscriptions on your admin account. Make sure push is enabled in your notification settings.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleTestPush}
                disabled={pushTesting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                data-testid="button-test-push"
              >
                {pushTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                {pushTesting ? "Sending…" : "Send test push"}
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

        <div className="bg-white rounded-[20px] overflow-hidden" style={{ border: "1px solid #eeebf3", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }} data-testid="section-match-alignment">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-ha-text uppercase tracking-wide">Match diagnostics</h2>
            <button
              onClick={loadDebugData}
              disabled={debugLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ha-bg hover:bg-ha-card-border text-ha-text text-xs font-semibold disabled:opacity-50 transition-colors"
              data-testid="button-refresh-debug"
            >
              {debugLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              {debugLoading ? "Loading…" : "Run analysis"}
            </button>
          </div>
          <div className="p-4">
            {!debugData && !debugLoading && !debugError && (
              <p className="text-sm text-ha-text-secondary">Click "Run analysis" to compare which matches were emailed versus what is visible in the app for your admin account.</p>
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
                  <div className="bg-ha-bg rounded-lg p-3">
                    <div className="text-lg font-bold text-ha-text">{debugData.total_match_rows ?? 0}</div>
                    <div className="text-[10px] uppercase text-ha-text-secondary font-medium">Match records</div>
                  </div>
                  <div className="bg-ha-bg rounded-lg p-3">
                    <div className="text-lg font-bold text-ha-text">{debugData.app_visible_count ?? 0}</div>
                    <div className="text-[10px] uppercase text-ha-text-secondary font-medium">Visible in app</div>
                  </div>
                  <div className="bg-ha-bg rounded-lg p-3">
                    <div className="text-lg font-bold text-ha-text">{debugData.recent_emailed_count ?? 0}</div>
                    <div className="text-[10px] uppercase text-ha-text-secondary font-medium">Recently emailed</div>
                  </div>
                  <div className={`rounded-lg p-3 ${(debugData.mismatch_count ?? 0) > 0 ? "bg-ha-danger/5" : "bg-green-50"}`}>
                    <div className={`text-lg font-bold ${(debugData.mismatch_count ?? 0) > 0 ? "text-ha-danger" : "text-green-700"}`}>{debugData.mismatch_count ?? 0}</div>
                    <div className={`text-[10px] uppercase font-medium ${(debugData.mismatch_count ?? 0) > 0 ? "text-ha-danger" : "text-green-500"}`}>Mismatches</div>
                  </div>
                </div>

                {debugData.subscription && (
                  <div className="text-xs text-ha-text-secondary">
                    Subscription: <span className="font-medium text-ha-text">{debugData.subscription.status || "none"}</span>
                    {debugData.subscription.created_at && <> &middot; since {formatTime(debugData.subscription.created_at)}</>}
                    {debugData.emailed_at && <> &middot; last emailed: {formatTime(debugData.emailed_at)}</>}
                  </div>
                )}

                {debugData.emailed_but_not_visible.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-ha-danger uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Emailed but NOT visible in app ({debugData.emailed_but_not_visible.length})
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-ha-danger/5 text-left">
                            <th className="px-2 py-1.5 font-semibold text-ha-danger">Title</th>
                            <th className="px-2 py-1.5 font-semibold text-ha-danger">City</th>
                            <th className="px-2 py-1.5 font-semibold text-ha-danger">Source</th>
                            <th className="px-2 py-1.5 font-semibold text-ha-danger">Matched</th>
                            <th className="px-2 py-1.5 font-semibold text-ha-danger">Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {debugData.emailed_but_not_visible.map((item: any, i: number) => (
                            <tr key={i} className="border-t border-ha-danger/10">
                              <td className="px-2 py-1.5 text-ha-text max-w-[200px] truncate">{item.title || <span className="text-ha-danger italic">deleted</span>}</td>
                              <td className="px-2 py-1.5 text-ha-text-secondary">{item.city || "—"}</td>
                              <td className="px-2 py-1.5 text-ha-text-secondary">{item.source || "—"}</td>
                              <td className="px-2 py-1.5 text-ha-text-secondary whitespace-nowrap">{item.matched_at ? formatTime(item.matched_at) : "—"}</td>
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
                    <h3 className="text-xs font-bold text-ha-text uppercase tracking-wide mb-2">Recently emailed ({debugData.recent_emailed.length})</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-ha-bg text-left">
                            <th className="px-2 py-1.5 font-semibold text-ha-text-secondary">Title</th>
                            <th className="px-2 py-1.5 font-semibold text-ha-text-secondary">City</th>
                            <th className="px-2 py-1.5 font-semibold text-ha-text-secondary">Source</th>
                            <th className="px-2 py-1.5 font-semibold text-ha-text-secondary">Matched</th>
                            <th className="px-2 py-1.5 font-semibold text-ha-text-secondary">Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {debugData.recent_emailed.map((item: any, i: number) => (
                            <tr key={i} className="border-t border-gray-100">
                              <td className="px-2 py-1.5 text-ha-text max-w-[200px] truncate">{item.title || <span className="text-ha-text-secondary italic">—</span>}</td>
                              <td className="px-2 py-1.5 text-ha-text-secondary">{item.city || "—"}</td>
                              <td className="px-2 py-1.5 text-ha-text-secondary">{item.source || "—"}</td>
                              <td className="px-2 py-1.5 text-ha-text-secondary whitespace-nowrap">{item.matched_at ? formatTime(item.matched_at) : "—"}</td>
                              <td className="px-2 py-1.5 text-ha-text-secondary">{item.price ? `${item.price}€` : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-xs font-bold text-ha-text uppercase tracking-wide mb-2">
                    Matches visible in app ({debugData.app_visible?.length || 0} of {debugData.app_visible_count})
                  </h3>
                  {debugData.app_visible?.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-ha-bg text-left">
                            <th className="px-2 py-1.5 font-semibold text-ha-text-secondary">Title</th>
                            <th className="px-2 py-1.5 font-semibold text-ha-text-secondary">City</th>
                            <th className="px-2 py-1.5 font-semibold text-ha-text-secondary">Source</th>
                            <th className="px-2 py-1.5 font-semibold text-ha-text-secondary">Matched</th>
                            <th className="px-2 py-1.5 font-semibold text-ha-text-secondary">Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {debugData.app_visible.map((item: any, i: number) => (
                            <tr key={i} className="border-t border-gray-100">
                              <td className="px-2 py-1.5 text-ha-text max-w-[200px] truncate">{item.title || "—"}</td>
                              <td className="px-2 py-1.5 text-ha-text-secondary">{item.city || "—"}</td>
                              <td className="px-2 py-1.5 text-ha-text-secondary">{item.source || "—"}</td>
                              <td className="px-2 py-1.5 text-ha-text-secondary whitespace-nowrap">{item.matched_at ? formatTime(item.matched_at) : "—"}</td>
                              <td className="px-2 py-1.5 text-ha-text-secondary">{item.price ? `${item.price}€` : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-ha-text-secondary">No matches visible in app yet.</p>
                  )}
                </div>

                {debugData.recent_emailed.length === 0 && debugData.emailed_but_not_visible.length === 0 && (
                  <div className="flex items-center gap-2 text-sm text-ha-text-secondary bg-ha-bg rounded-lg p-3">
                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                    No emails sent in this cycle — no comparison data yet. Wait for the next import cycle with active matches.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="text-center text-xs text-ha-text-secondary pb-6">
          Auto-refreshes every 30s &middot; Next import: {formatTime(summary?.nextRunAt || null)}
        </div>
      </main>
    </div>
  );
}
