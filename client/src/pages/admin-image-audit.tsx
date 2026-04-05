import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api-base";
import { useLocation } from "wouter";
import {
  ArrowLeft, Loader2, Image, ImageOff, AlertTriangle,
  ExternalLink, RefreshCw, Filter, ChevronDown, ChevronRight,
  TrendingUp, BarChart3,
} from "lucide-react";

async function adminFetch(path: string) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Not authenticated");
  const res = await apiFetch(path, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 403) throw new Error("ACCESS_DENIED");
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

async function adminPost(path: string, body?: any) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Not authenticated");
  const res = await apiFetch(path, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 403) throw new Error("ACCESS_DENIED");
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

interface SourceCoverage {
  source: string;
  total: number;
  with_image: number;
  without_image: number;
  coverage_pct: number;
  placeholder_only: number;
  relative_url: number;
  protocol_relative: number;
  priority: string;
}

interface AuditData {
  summary: {
    total_listings: number;
    with_image: number;
    without_image: number;
    overall_coverage_pct: number;
  };
  per_source: SourceCoverage[];
  top_5_worst: { source: string; coverage_pct: number; total: number; without_image: number }[];
  top_5_priority: { source: string; coverage_pct: number; total: number; without_image: number; importance: number; impact_score: number }[];
  failure_reasons: Record<string, number>;
  samples: Record<string, { id: string; title: string; source: string; url: string; image_url: string | null; city: string; created_at: string; likely_reason: string }[]>;
  backfill: {
    total_candidates: number;
    per_source: { source: string; no_image: number; placeholder: number; suspicious_url: number; total_candidates: number }[];
  };
  filters: { source: string | null; city: string | null; days: number | null };
}

function CoverageBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="w-full h-2 bg-[#F0F0F0] rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const cls = priority === "high"
    ? "bg-red-50 text-red-700 border-red-200"
    : priority === "medium"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-[#F7F7F7] text-[#6B7280] border-[#E5E7EB]";
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cls}`}>{priority}</span>;
}

export default function AdminImageAuditPage() {
  const [, navigate] = useLocation();
  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [daysFilter, setDaysFilter] = useState(0);
  const [expandedSource, setExpandedSource] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<{ updated: number; failed: number; total: number; methods?: Record<string, number> } | null>(null);

  const runWgBackfill = async () => {
    setBackfilling(true);
    setBackfillResult(null);
    try {
      const result = await adminPost("/api/admin/portal/backfill-wg-gesucht-images", { limit: 50 });
      setBackfillResult(result);
      fetchAudit();
    } catch (err: any) {
      setBackfillResult({ updated: 0, failed: 0, total: 0 });
    } finally {
      setBackfilling(false);
    }
  };

  const fetchAudit = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (sourceFilter) params.set("source", sourceFilter);
      if (cityFilter) params.set("city", cityFilter);
      if (daysFilter > 0) params.set("days", String(daysFilter));
      const result = await adminFetch(`/api/admin/portal/image-audit?${params}`);
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAudit(); }, []);

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <header className="sticky top-0 z-30 bg-white border-b border-[#E5E7EB]">
        <div className="max-w-4xl mx-auto flex items-center h-[56px] px-4 gap-3">
          <button onClick={() => navigate("/admin/portal")} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#F9FAFB]" data-testid="button-back">
            <ArrowLeft className="w-5 h-5 text-[#111111]" />
          </button>
          <div className="flex-1">
            <h1 className="text-[17px] font-semibold text-[#111111]" data-testid="text-page-title">Image Coverage Audit</h1>
          </div>
          <button onClick={fetchAudit} disabled={loading} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#F9FAFB]" data-testid="button-refresh">
            <RefreshCw className={`w-4 h-4 text-[#6B7280] ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-[14px] font-medium text-[#6B7280] hover:text-[#111111]"
          data-testid="button-toggle-filters"
        >
          <Filter className="w-4 h-4" />
          Filters
          <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? "rotate-180" : ""}`} />
        </button>

        {showFilters && (
          <div className="bg-white rounded-[12px] border border-[#E5E7EB] p-4 flex flex-wrap gap-3 items-end" data-testid="section-filters">
            <div>
              <label className="text-[12px] font-medium text-[#6B7280] block mb-1">Source</label>
              <input
                value={sourceFilter}
                onChange={e => setSourceFilter(e.target.value)}
                placeholder="e.g. immowelt"
                className="h-[36px] px-3 rounded-[8px] border border-[#E5E7EB] text-[13px] w-[140px]"
                data-testid="input-source-filter"
              />
            </div>
            <div>
              <label className="text-[12px] font-medium text-[#6B7280] block mb-1">City</label>
              <input
                value={cityFilter}
                onChange={e => setCityFilter(e.target.value)}
                placeholder="e.g. Berlin"
                className="h-[36px] px-3 rounded-[8px] border border-[#E5E7EB] text-[13px] w-[140px]"
                data-testid="input-city-filter"
              />
            </div>
            <div>
              <label className="text-[12px] font-medium text-[#6B7280] block mb-1">Days back</label>
              <select
                value={daysFilter}
                onChange={e => setDaysFilter(Number(e.target.value))}
                className="h-[36px] px-3 rounded-[8px] border border-[#E5E7EB] text-[13px]"
                data-testid="select-days-filter"
              >
                <option value={0}>All time</option>
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
            </div>
            <button
              onClick={fetchAudit}
              className="h-[36px] px-4 rounded-[8px] bg-[#111111] text-white text-[13px] font-medium"
              data-testid="button-apply-filters"
            >
              Apply
            </button>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-[#9CA3AF]" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-[12px] p-4 text-[14px] text-red-700" data-testid="text-error">
            {error}
          </div>
        )}

        {data && !loading && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="section-summary">
              <StatCard icon={<BarChart3 className="w-5 h-5 text-[#6B7280]" />} label="Total listings" value={data.summary.total_listings.toLocaleString()} />
              <StatCard icon={<Image className="w-5 h-5 text-emerald-600" />} label="With image" value={data.summary.with_image.toLocaleString()} />
              <StatCard icon={<ImageOff className="w-5 h-5 text-red-500" />} label="Without image" value={data.summary.without_image.toLocaleString()} />
              <StatCard icon={<TrendingUp className="w-5 h-5 text-[#111111]" />} label="Coverage" value={`${data.summary.overall_coverage_pct}%`} />
            </div>

            <Section title="Per-source coverage">
              <div className="divide-y divide-[#E5E7EB]">
                {data.per_source.map(s => (
                  <div key={s.source}>
                    <button
                      onClick={() => setExpandedSource(expandedSource === s.source ? null : s.source)}
                      className="w-full px-4 py-3.5 flex items-center gap-3 text-left hover:bg-[#F9FAFB] transition-colors"
                      data-testid={`row-source-${s.source}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[14px] font-semibold text-[#111111]">{s.source}</span>
                          <PriorityBadge priority={s.priority} />
                        </div>
                        <CoverageBar pct={s.coverage_pct} />
                        <div className="flex gap-3 mt-1 text-[12px] text-[#6B7280]">
                          <span>{s.coverage_pct}% covered</span>
                          <span>{s.total} total</span>
                          <span>{s.without_image} missing</span>
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 text-[#9CA3AF] transition-transform ${expandedSource === s.source ? "rotate-90" : ""}`} />
                    </button>

                    {expandedSource === s.source && (
                      <div className="px-4 pb-3 space-y-2">
                        <div className="grid grid-cols-3 gap-2 text-[12px]">
                          <MiniStat label="Placeholder" value={s.placeholder_only} />
                          <MiniStat label="Relative URL" value={s.relative_url} />
                          <MiniStat label="Protocol-relative" value={s.protocol_relative} />
                        </div>
                        {data.samples[s.source] && data.samples[s.source].length > 0 && (
                          <div className="mt-2">
                            <p className="text-[11px] font-semibold text-[#9CA3AF] mb-1.5">Sample missing-image listings</p>
                            <div className="space-y-1.5">
                              {data.samples[s.source].map(sample => (
                                <div key={sample.id} className="bg-[#F9FAFB] rounded-[8px] px-3 py-2 text-[12px]">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium text-[#111111] truncate">{sample.title || "Untitled"}</p>
                                      <p className="text-[#6B7280] mt-0.5">{sample.city} · {sample.likely_reason}</p>
                                    </div>
                                    <a href={sample.url} target="_blank" rel="noopener noreferrer" className="shrink-0 mt-0.5" data-testid={`link-sample-${sample.id}`}>
                                      <ExternalLink className="w-3.5 h-3.5 text-[#9CA3AF] hover:text-[#111111]" />
                                    </a>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Section title="Top 5 worst coverage">
                <div className="divide-y divide-[#E5E7EB]">
                  {data.top_5_worst.map((s, i) => (
                    <div key={s.source} className="px-4 py-3 flex items-center gap-3" data-testid={`row-worst-${i}`}>
                      <span className="w-6 h-6 rounded-full bg-red-50 text-red-600 text-[12px] font-semibold flex items-center justify-center shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-[#111111]">{s.source}</p>
                        <p className="text-[12px] text-[#6B7280]">{s.coverage_pct}% · {s.without_image} missing</p>
                      </div>
                    </div>
                  ))}
                  {data.top_5_worst.length === 0 && <EmptyRow />}
                </div>
              </Section>

              <Section title="Top 5 highest priority to fix">
                <div className="divide-y divide-[#E5E7EB]">
                  {data.top_5_priority.map((s, i) => (
                    <div key={s.source} className="px-4 py-3 flex items-center gap-3" data-testid={`row-priority-${i}`}>
                      <span className="w-6 h-6 rounded-full bg-amber-50 text-amber-700 text-[12px] font-semibold flex items-center justify-center shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-[#111111]">{s.source}</p>
                        <p className="text-[12px] text-[#6B7280]">{s.coverage_pct}% · impact: {s.impact_score}</p>
                      </div>
                    </div>
                  ))}
                  {data.top_5_priority.length === 0 && <EmptyRow />}
                </div>
              </Section>
            </div>

            <Section title="Backfill candidates">
              <div className="px-4 py-3 flex items-center gap-3 border-b border-[#E5E7EB]" data-testid="row-backfill-total">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                <div>
                  <p className="text-[14px] font-semibold text-[#111111]">{data.backfill.total_candidates.toLocaleString()} total candidates</p>
                  <p className="text-[12px] text-[#6B7280]">Listings that may benefit from image backfill</p>
                </div>
              </div>
              <div className="divide-y divide-[#E5E7EB]">
                {data.backfill.per_source.filter(c => c.total_candidates > 0).map(c => (
                  <div key={c.source} className="px-4 py-2.5 flex items-center justify-between text-[13px]" data-testid={`row-backfill-${c.source}`}>
                    <span className="font-medium text-[#111111]">{c.source}</span>
                    <div className="flex gap-3 text-[12px] text-[#6B7280]">
                      <span>{c.no_image} no img</span>
                      {c.placeholder > 0 && <span>{c.placeholder} placeholder</span>}
                      {c.suspicious_url > 0 && <span>{c.suspicious_url} suspicious</span>}
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="wg-gesucht image backfill">
              <div className="px-4 py-4 space-y-3">
                <p className="text-[13px] text-[#6B7280]">
                  Fetch detail pages for wg-gesucht listings missing images and extract images using enhanced selectors.
                  Processes up to 50 listings per run.
                </p>
                <button
                  onClick={runWgBackfill}
                  disabled={backfilling}
                  className="h-[36px] px-4 rounded-[8px] bg-[#111111] text-white text-[13px] font-medium disabled:opacity-50 flex items-center gap-2"
                  data-testid="button-wg-backfill"
                >
                  {backfilling ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {backfilling ? "Running backfill…" : "Run wg-gesucht backfill"}
                </button>
                {backfillResult && (
                  <div className="bg-[#F9FAFB] rounded-[8px] p-3 text-[13px] space-y-1" data-testid="section-backfill-result">
                    <p className="font-semibold text-[#111111]">
                      {backfillResult.updated} updated, {backfillResult.failed} failed (of {backfillResult.total})
                    </p>
                    {backfillResult.methods && Object.keys(backfillResult.methods).length > 0 && (
                      <div className="text-[12px] text-[#6B7280]">
                        {Object.entries(backfillResult.methods).map(([method, count]) => (
                          <span key={method} className="mr-3">{method}: {count}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Section>

            <Section title="Common failure reasons">
              <div className="px-4 py-3 space-y-1.5">
                {Object.entries(data.failure_reasons)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 15)
                  .map(([reason, count]) => (
                    <div key={reason} className="flex items-center justify-between text-[13px]" data-testid={`row-reason-${reason}`}>
                      <span className="text-[#111111] font-medium">{reason.replace(/_/g, " ")}</span>
                      <span className="text-[#6B7280]">{count}</span>
                    </div>
                  ))}
                {Object.keys(data.failure_reasons).length === 0 && (
                  <p className="text-[13px] text-[#9CA3AF]">No failures detected</p>
                )}
              </div>
            </Section>
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white rounded-[12px] border border-[#E5E7EB] p-4" data-testid={`stat-${label.toLowerCase().replace(/\s/g, "-")}`}>
      <div className="mb-2">{icon}</div>
      <p className="text-[20px] font-semibold text-[#111111]">{value}</p>
      <p className="text-[12px] text-[#6B7280]">{label}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-[12px] border border-[#E5E7EB] overflow-hidden" data-testid={`section-${title.toLowerCase().replace(/\s/g, "-")}`}>
      <div className="px-4 py-3 border-b border-[#E5E7EB]">
        <h3 className="text-[14px] font-semibold text-[#111111]">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[#F9FAFB] rounded-[6px] px-2.5 py-1.5 text-center">
      <p className="text-[14px] font-semibold text-[#111111]">{value}</p>
      <p className="text-[10px] text-[#6B7280]">{label}</p>
    </div>
  );
}

function EmptyRow() {
  return <p className="px-4 py-3 text-[13px] text-[#9CA3AF]">No data available</p>;
}
