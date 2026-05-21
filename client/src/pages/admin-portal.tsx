import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api-base";
import {
  Users, CreditCard, Search,
  Loader2, ChevronRight, ExternalLink, RefreshCw, BookOpen,
  Mail, Smartphone, AlertTriangle, CheckCircle, XCircle,
  TrendingUp, Activity, Database, Globe, Zap, ArrowLeft,
  Target, Percent, Eye, MessageCircle,
  Radio, Layers, Settings, Bell, Send, Power,
  LayoutDashboard, Signal, Image, Trash2, Pencil,
  Save, X, RotateCw, Menu, ChevronDown, MoreVertical, Star, EyeOff, Lock, ToggleLeft, ToggleRight, Sliders,
  Monitor, Wifi, WifiOff, Clock, AlertCircle, CheckCircle2, Info,
} from "lucide-react";
import { HousAlertLogo } from "@/components/housalert-logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { resetPushBrowserSide } from "@/lib/push";

type TabId = "dashboard" | "listings" | "images" | "sources" | "users" | "subscriptions" | "alerts" | "settings" | "system" | "support" | "realtime-sla" | "notifications";

async function adminFetch(path: string, options?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Not authenticated");
  const res = await apiFetch(path, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options?.headers || {}) },
  });
  if (res.status === 403) throw new Error("ACCESS_DENIED");
  if (!res.ok) {
    let rawText = "";
    let body: any = {};
    try { rawText = await res.text(); } catch {}
    try { body = JSON.parse(rawText); } catch {}
    const errorMsg = body?.error || body?.message || rawText.trim().substring(0, 300) || `Request failed: ${res.status}`;
    const extras = [body?.step && `step=${body.step}`, body?.errorType && body.errorType !== "Error" && `(${body.errorType})`].filter(Boolean).join(" ");
    throw new Error(`[${res.status}] ${errorMsg}${extras ? " — " + extras : ""}`);
  }
  return res.json();
}

function StatusDot({ status }: { status: string }) {
  const color = status === "active" || status === "operational" || status === "success"
    ? "bg-emerald-400" : status === "warning" || status === "partial" || status === "degraded"
    ? "bg-amber-400" : status === "error" || status === "failed" || status === "broken" || status === "canceled"
    ? "bg-ha-danger" : "bg-ha-card-border";
  return <span className={`w-2 h-2 rounded-full inline-block ${color}`} />;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; border: string; label: string }> = {
    active:      { bg: "#85fb8c", color: "#223546", border: "#223546", label: "Active" },
    operational: { bg: "#85fb8c", color: "#223546", border: "#223546", label: "Operational" },
    success:     { bg: "#85fb8c", color: "#223546", border: "#223546", label: "Success" },
    trial:       { bg: "rgba(187,173,251,0.12)", color: "#7c5fc5", border: "rgba(187,173,251,0.4)", label: "Trial" },
    past_due:    { bg: "#fffbeb", color: "#b45309", border: "#fde68a", label: "Past Due" },
    warning:     { bg: "#fffbeb", color: "#b45309", border: "#fde68a", label: "Warning" },
    partial:     { bg: "#fffbeb", color: "#b45309", border: "#fde68a", label: "Partial" },
    degraded:    { bg: "#fffbeb", color: "#b45309", border: "#fde68a", label: "Degraded" },
    canceled:    { bg: "#fff1f2", color: "#e11d48", border: "#fecdd3", label: "Canceled" },
    error:       { bg: "#fff1f2", color: "#e11d48", border: "#fecdd3", label: "Error" },
    failed:      { bg: "#fff1f2", color: "#e11d48", border: "#fecdd3", label: "Failed" },
    broken:      { bg: "#fff1f2", color: "#e11d48", border: "#fecdd3", label: "Broken" },
    expired:     { bg: "#f5f5f5", color: "#888888", border: "#e0e0e0", label: "Expired" },
    disabled:    { bg: "#f5f5f5", color: "#888888", border: "#e0e0e0", label: "Disabled" },
  };
  const m = map[status] || { bg: "#f5f5f5", color: "#888888", border: "#e0e0e0", label: status };
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[11px] font-semibold border inline-block"
      style={{ backgroundColor: m.bg, color: m.color, borderColor: m.border }}
    >
      {m.label}
    </span>
  );
}

const CARD = "bg-white rounded-[20px] border border-[#eeebf3]";

function SectionHeader({ title, action }: { title: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-[13px] font-bold text-[#aaaaaa] uppercase tracking-[0.06em]">{title}</h3>
      {action && (
        <button
          onClick={action.onClick}
          className="text-[12px] font-semibold px-3 py-1 rounded-full transition-colors"
          style={{ color: "#7c5fc5", backgroundColor: "rgba(187,173,251,0.10)" }}
          data-testid={`action-${title.toLowerCase().replace(/\s/g, "-")}`}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

function MetricCard({ label, value, sub, icon: Icon }: { label: string; value: string | number; sub?: string; icon: any }) {
  return (
    <div className={`${CARD} p-5`} data-testid={`metric-${label.toLowerCase().replace(/\s/g, "-")}`}>
      <div className="flex items-center gap-1.5 mb-3">
        <Icon className="w-3.5 h-3.5" style={{ color: "#bbadfb" }} />
        <span className="text-[10px] font-bold uppercase tracking-[0.07em]" style={{ color: "#aaaaaa" }}>{label}</span>
      </div>
      <p className="text-[28px] font-extrabold tracking-[-0.02em]" style={{ color: "#111111", lineHeight: 1 }}>{value}</p>
      {sub && <p className="text-[11px] mt-1.5" style={{ color: "#aaaaaa" }}>{sub}</p>}
    </div>
  );
}

function EmptyState({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) {
  return (
    <div className={`${CARD} p-10 flex flex-col items-center text-center`}>
      <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: "rgba(187,173,251,0.12)" }}>
        <Database className="w-5 h-5" style={{ color: "#bbadfb" }} />
      </div>
      <h4 className="text-[16px] font-bold mb-1.5" style={{ color: "#111111" }}>{title}</h4>
      <p className="text-[13px] mb-5 max-w-[260px]" style={{ color: "#888888" }}>{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-5 py-2 rounded-full text-[13px] font-semibold transition-all active:scale-[0.97]"
          style={{ backgroundColor: "#f5f5f5", color: "#111111", border: "1px solid #e0e0e0" }}
          data-testid="button-retry"
        >
          Try again
        </button>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-7 h-7 text-ha-primary animate-spin" />
    </div>
  );
}

function ConfirmDialog({ title, message, onConfirm, onCancel }: { title: string; message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onCancel}>
      <div className={`${CARD} p-6 max-w-sm w-full`} onClick={e => e.stopPropagation()}>
        <h3 className="text-[16px] font-bold text-ha-text mb-2">{title}</h3>
        <p className="text-[13px] text-ha-text-secondary mb-5">{message}</p>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" size="sm" onClick={onCancel} className="rounded-full" data-testid="button-cancel">Cancel</Button>
          <Button size="sm" onClick={onConfirm} className="rounded-full bg-ha-danger hover:bg-ha-danger/90 text-white" data-testid="button-confirm">Confirm</Button>
        </div>
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function DashboardTab({ onNavigate, userName }: { onNavigate: (tab: TabId) => void; userName: string }) {
  const [data, setData] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [systemChecks, setSystemChecks] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [systemExpanded, setSystemExpanded] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([
      adminFetch("/api/admin/portal/overview").catch(() => null),
      adminFetch("/api/admin/portal/alerts").catch(() => ({ alerts: [] })),
      adminFetch("/api/admin/portal/system-status").catch(() => null),
    ]).then(([overview, alertsData, sys]) => {
      setData(overview);
      setAlerts(alertsData?.alerts || []);
      setSystemChecks(sys);
    }).finally(() => { setLoading(false); setRefreshing(false); });
  }

  useEffect(() => { load(); }, []);

  if (loading && !data) return <LoadingState />;
  if (!data) return <EmptyState title="Unable to load" message="Dashboard data could not be fetched." onRetry={load} />;

  const actionableAlerts = alerts.filter(a => a.severity === "critical" || a.severity === "warning");
  const infoAlerts = alerts.filter(a => a.severity === "info");

  function alertMeta(a: any): { title: string; impact: string; actionLabel: string; actionTab: TabId } {
    const map: Record<string, { title: string; impact: string; actionLabel: string; actionTab: TabId }> = {
      scraper_stale: {
        title: "Imports not running",
        impact: "No new listings are being imported. Users may miss matches.",
        actionLabel: "View imports →",
        actionTab: "alerts",
      },
      match_drop: {
        title: "Match volume dropped sharply",
        impact: "Significantly fewer matches than yesterday — listing imports or matching may be broken.",
        actionLabel: "View sources →",
        actionTab: "sources",
      },
      email_failure: {
        title: "Email delivery failures",
        impact: "Some subscribed users are not receiving match alert emails.",
        actionLabel: "View alerts →",
        actionTab: "alerts",
      },
      ingestion_failure: {
        title: "Import run failed",
        impact: "One or more import runs completed with errors in the last 24 hours.",
        actionLabel: "View imports →",
        actionTab: "alerts",
      },
    };
    return map[a.type] || { title: a.type, impact: a.message, actionLabel: "View →", actionTab: "system" };
  }

  const sourcesByCity = (() => {
    const map = new Map<string, { healthy: number; issues: number; total: number }>();
    for (const s of (data.sourceHealth || [])) {
      const city = s.city || "Unknown";
      const entry = map.get(city) || { healthy: 0, issues: 0, total: 0 };
      entry.total += s.found || 0;
      if (s.status === "active" || s.found > 0) entry.healthy++; else entry.issues++;
      map.set(city, entry);
    }
    return Array.from(map.entries());
  })();
  const citiesWithIssues = sourcesByCity.filter(([, v]) => v.issues > 0);
  const citiesHealthy = sourcesByCity.filter(([, v]) => v.issues === 0);
  const visibleHealthy = sourcesExpanded ? citiesHealthy : citiesHealthy.slice(0, 4);

  const activityEvents: { icon: any; color: string; text: string; sub: string }[] = [];
  if (data.listingsToday > 0) activityEvents.push({ icon: TrendingUp, color: "#223546", text: `${data.listingsToday} new listings imported today`, sub: `${data.listingsWeek} this week` });
  if (data.matchesToday > 0) activityEvents.push({ icon: Target, color: "#7c5fc5", text: `${data.matchesToday} matches found today`, sub: `${data.matchesWeek} this week` });
  if ((data.emailRealFailures ?? 0) > 0) {
    activityEvents.push({ icon: AlertTriangle, color: "#e11d48", text: `${data.emailRealFailures} email${data.emailRealFailures !== 1 ? "s" : ""} failed to deliver`, sub: "Check provider configuration" });
  } else if (data.emailsToday > 0) {
    activityEvents.push({ icon: Mail, color: "#223546", text: `${data.emailsToday} alert email${data.emailsToday !== 1 ? "s" : ""} delivered`, sub: "Email system healthy" });
  }
  if (data.pushesToday > 0) activityEvents.push({ icon: Smartphone, color: "#7c5fc5", text: `${data.pushesToday} push notification${data.pushesToday !== 1 ? "s" : ""} sent`, sub: "Push system healthy" });
  if (citiesWithIssues.length > 0) {
    activityEvents.push({ icon: AlertTriangle, color: "#b45309", text: `${citiesWithIssues.length} source${citiesWithIssues.length !== 1 ? "s" : ""} with issues`, sub: citiesWithIssues.slice(0, 3).map(([c]) => c).join(", ") });
  } else if ((data.sourceHealth || []).length > 0) {
    activityEvents.push({ icon: CheckCircle, color: "#223546", text: "All sources healthy", sub: `${sourcesByCity.length} cities monitored` });
  }
  if (data.signupsToday > 0) activityEvents.push({ icon: Users, color: "#7c5fc5", text: `${data.signupsToday} new signup${data.signupsToday !== 1 ? "s" : ""} today`, sub: `${data.signupsWeek} this week` });
  for (const a of infoAlerts) activityEvents.push({ icon: Activity, color: "#888888", text: a.message, sub: new Date(a.timestamp).toLocaleTimeString() });

  const svcLabels: Record<string, { name: string; Icon: any }> = {
    stripe: { name: "Stripe Payments", Icon: CreditCard },
    email: { name: "Email (Resend)", Icon: Mail },
    pushNotifications: { name: "Push Notifications", Icon: Smartphone },
    ingestionScheduler: { name: "Import Automation", Icon: Radio },
    replitDb: { name: "Replit DB", Icon: Database },
    supabaseDb: { name: "Supabase DB", Icon: Layers },
    placesApi: { name: "Places API", Icon: Globe },
  };

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold" style={{ color: "#111111" }} data-testid="text-greeting">{getGreeting()}, {userName}</h1>
          <p className="text-[13px] mt-0.5" style={{ color: "#888888" }}>Here's what's happening right now</p>
        </div>
        <button
          onClick={() => { setRefreshing(true); load(); }}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
          style={{ backgroundColor: "#f0f0f0" }}
          data-testid="button-refresh-dashboard"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} style={{ color: "#888888" }} />
        </button>
      </div>

      {/* Section 1 — Platform health */}
      <div>
        <SectionHeader title="Platform health" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <MetricCard label="Active users" value={data.totalUsers} sub={data.signupsToday > 0 ? `+${data.signupsToday} new today` : "No signups today"} icon={Users} />
          <MetricCard label="Listings today" value={data.listingsToday} sub={`${data.listingsWeek} this week`} icon={TrendingUp} />
          <MetricCard label="Matches today" value={data.matchesToday} sub={`${data.matchesWeek} this week`} icon={Target} />
          <MetricCard
            label="Emails sent"
            value={data.emailsToday}
            sub={(data.emailRealFailures ?? 0) > 0 ? `⚠ ${data.emailRealFailures} failed` : "All delivered"}
            icon={Mail}
          />
          <MetricCard label="Push sent" value={data.pushesToday} sub="Notifications" icon={Smartphone} />
          <MetricCard
            label="Revenue / paid"
            value={`€${data.mrr}`}
            sub={`${data.activeSubscriptions} paid · ${data.trialUsers} trial`}
            icon={CreditCard}
          />
        </div>
      </div>

      {/* Section 2 — Problems requiring attention */}
      {actionableAlerts.length > 0 && (
        <div>
          <SectionHeader title="Needs attention" />
          <div className="space-y-3">
            {actionableAlerts.map((a, i) => {
              const meta = alertMeta(a);
              const isCritical = a.severity === "critical";
              const borderColor = isCritical ? "#e11d48" : "#f59e0b";
              const bgColor = isCritical ? "#fff1f2" : "#fffbeb";
              const subtleBorder = isCritical ? "#fecdd3" : "#fde68a";
              return (
                <div
                  key={i}
                  className="bg-white rounded-[20px] p-4 flex gap-4"
                  style={{ border: `1px solid ${subtleBorder}`, borderLeft: `4px solid ${borderColor}`, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
                  data-testid={`alert-card-${i}`}
                >
                  <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5" style={{ backgroundColor: bgColor }}>
                    <AlertTriangle className="w-4 h-4" style={{ color: borderColor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold" style={{ color: "#111111" }}>{meta.title}</p>
                    <p className="text-[12px] mt-0.5 leading-snug" style={{ color: "#666666" }}>{meta.impact}</p>
                    <p className="text-[11px] mt-1 leading-snug" style={{ color: "#aaaaaa" }}>{a.message}</p>
                    <button
                      onClick={() => onNavigate(meta.actionTab)}
                      className="mt-2.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all active:scale-[0.97]"
                      style={{ backgroundColor: bgColor, color: borderColor, border: `1px solid ${subtleBorder}` }}
                      data-testid={`alert-action-${i}`}
                    >
                      {meta.actionLabel}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Section 3 — Source health */}
      {sourcesByCity.length > 0 && (
        <div>
          <SectionHeader title="Source health" action={{ label: "View all", onClick: () => onNavigate("sources") }} />
          <div className="bg-white rounded-[20px] overflow-hidden" style={{ border: "1px solid #eeebf3" }}>
            {citiesWithIssues.length > 0 && (
              <div className="px-4 pt-3 pb-0.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.07em]" style={{ color: "#e11d48" }}>
                  ⚠ Issues ({citiesWithIssues.length})
                </span>
              </div>
            )}
            {citiesWithIssues.map(([city, info], i) => (
              <div key={city} className="flex items-center gap-3 px-4 py-3.5 border-b" style={{ borderColor: "#f5f5f7" }} data-testid={`source-issue-${city}`}>
                <span className="w-2 h-2 rounded-full flex-shrink-0 bg-amber-400" />
                <span className="text-[14px] font-semibold flex-1" style={{ color: "#111111" }}>{city}</span>
                <span className="text-[12px]" style={{ color: "#888888" }}>{info.total} listings</span>
                <StatusBadge status="degraded" />
              </div>
            ))}
            {citiesHealthy.length > 0 && citiesWithIssues.length > 0 && (
              <div className="px-4 pt-3 pb-0.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.07em]" style={{ color: "#223546" }}>
                  Healthy ({citiesHealthy.length})
                </span>
              </div>
            )}
            {visibleHealthy.map(([city, info], i) => (
              <div
                key={city}
                className="flex items-center gap-3 px-4 py-3.5"
                style={{ borderBottom: i < visibleHealthy.length - 1 || citiesHealthy.length > 4 ? "1px solid #f5f5f7" : undefined }}
                data-testid={`source-ok-${city}`}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0 bg-emerald-400" />
                <span className="text-[14px] font-medium flex-1" style={{ color: "#111111" }}>{city}</span>
                <span className="text-[12px]" style={{ color: "#888888" }}>{info.total} listings</span>
                <StatusBadge status="active" />
              </div>
            ))}
            {citiesHealthy.length > 4 && (
              <button
                onClick={() => setSourcesExpanded(!sourcesExpanded)}
                className="w-full flex items-center justify-center gap-1.5 py-3 text-[12px] font-semibold"
                style={{ color: "#7c5fc5", borderTop: "1px solid #f5f5f7" }}
                data-testid="button-toggle-sources"
              >
                <ChevronDown className="w-3.5 h-3.5" style={{ transform: sourcesExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
                {sourcesExpanded ? "Show less" : `Show ${citiesHealthy.length - 4} more cities`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Section 4 — Quick actions */}
      <div>
        <SectionHeader title="Quick actions" />
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
          {([
            { icon: Bell, label: "Alerts", tab: "alerts" as TabId },
            { icon: Radio, label: "Imports", tab: "alerts" as TabId },
            { icon: Mail, label: "Email test", tab: "alerts" as TabId },
            { icon: Users, label: "Users", tab: "users" as TabId },
            { icon: Layers, label: "Listings", tab: "listings" as TabId },
            { icon: Settings, label: "System", tab: "system" as TabId },
          ]).map(({ icon: Icon, label, tab }) => (
            <button
              key={label}
              onClick={() => onNavigate(tab)}
              className="bg-white rounded-[16px] p-4 flex flex-col items-center gap-2 transition-all active:scale-[0.97]"
              style={{ border: "1px solid #eeebf3" }}
              data-testid={`quick-${label.toLowerCase().replace(/\s/g, "-")}`}
            >
              <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(187,173,251,0.12)" }}>
                <Icon className="w-4 h-4" style={{ color: "#7c5fc5" }} />
              </div>
              <span className="text-[11px] font-semibold" style={{ color: "#111111" }}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Section 5 — Recent activity */}
      {activityEvents.length > 0 && (
        <div>
          <SectionHeader title="Recent activity" />
          <div className="bg-white rounded-[20px] overflow-hidden" style={{ border: "1px solid #eeebf3" }}>
            {activityEvents.map(({ icon: Icon, color, text, sub }, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-3.5"
                style={{ borderBottom: i < activityEvents.length - 1 ? "1px solid #f5f5f7" : undefined }}
                data-testid={`activity-${i}`}
              >
                <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
                  <Icon className="w-3.5 h-3.5" style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold" style={{ color: "#111111" }}>{text}</p>
                  <p className="text-[11px]" style={{ color: "#888888" }}>{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 6 — System services (collapsible) */}
      <div>
        <button
          onClick={() => setSystemExpanded(!systemExpanded)}
          className="w-full flex items-center justify-between mb-4"
          data-testid="button-toggle-system"
        >
          <h3 className="text-[13px] font-bold uppercase tracking-[0.06em]" style={{ color: "#aaaaaa" }}>System services</h3>
          <ChevronDown
            className="w-4 h-4 transition-transform duration-200"
            style={{ color: "#aaaaaa", transform: systemExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </button>
        {systemExpanded && (
          systemChecks ? (
            <div className="bg-white rounded-[20px] overflow-hidden" style={{ border: "1px solid #eeebf3" }}>
              {Object.entries(svcLabels).map(([key, { name, Icon }], i, arr) => {
                const check = systemChecks[key];
                if (!check) return null;
                return (
                  <div
                    key={key}
                    className="flex items-center gap-3 px-4 py-3.5"
                    style={{ borderBottom: i < arr.length - 1 ? "1px solid #f5f5f7" : undefined }}
                    data-testid={`svc-${key}`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" style={{ color: "#bbadfb" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold" style={{ color: "#111111" }}>{name}</p>
                      <p className="text-[11px] truncate" style={{ color: "#888888" }}>{check.message}</p>
                    </div>
                    <StatusBadge status={check.status} />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-[13px] text-center py-6 rounded-[20px] bg-white" style={{ border: "1px solid #eeebf3", color: "#888888" }}>
              Loading system status…
            </div>
          )
        )}
      </div>

    </div>
  );
}

function ListingsTab() {
  const [listings, setListings] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [cityInput, setCityInput] = useState("");
  const [sourceInput, setSourceInput] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: "", price: "", image_url: "" });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadListings = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (cityInput) params.set("city", cityInput);
    if (sourceInput) params.set("source", sourceInput);
    adminFetch(`/api/admin/portal/listings?${params}`)
      .then(d => { setListings(d.listings || []); setTotal(d.total || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, cityInput, sourceInput]);

  useEffect(() => { loadListings(); }, [loadListings]);

  function startEdit(l: any) {
    setEditingId(l.id);
    setEditForm({ title: l.title || "", price: String(l.price || ""), image_url: l.image_url || "" });
  }

  async function saveEdit() {
    if (!editingId) return;
    setSaving(true);
    try {
      await adminFetch(`/api/admin/portal/listings/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editForm.title,
          price: editForm.price ? Number(editForm.price) : null,
          image_url: editForm.image_url || null,
        }),
      });
      setEditingId(null);
      loadListings();
    } catch {}
    setSaving(false);
  }

  async function deleteListing(id: string) {
    try {
      await adminFetch(`/api/admin/portal/listings/${id}`, { method: "DELETE" });
      setDeleteConfirm(null);
      loadListings();
    } catch {}
  }

  function openDetail(id: string) {
    setDetailId(id);
    setDetailLoading(true);
    adminFetch(`/api/admin/portal/listings/${id}`)
      .then(setDetail)
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  }

  async function toggleFeatured() {
    if (!detail) return;
    setSaving(true);
    try {
      await adminFetch(`/api/admin/portal/listings/${detail.id}`, {
        method: "PATCH",
        body: JSON.stringify({ featured: !detail.featured }),
      });
      setDetail({ ...detail, featured: !detail.featured });
    } catch {}
    setSaving(false);
  }

  async function toggleHidden() {
    if (!detail) return;
    setSaving(true);
    try {
      await adminFetch(`/api/admin/portal/listings/${detail.id}`, {
        method: "PATCH",
        body: JSON.stringify({ hidden_from_feed: !detail.hidden_from_feed }),
      });
      setDetail({ ...detail, hidden_from_feed: !detail.hidden_from_feed });
    } catch {}
    setSaving(false);
  }

  if (detailId) {
    if (detailLoading) return <LoadingState />;
    return (
      <div className="space-y-4">
        <button onClick={() => { setDetailId(null); setDetail(null); }} className="flex items-center gap-1.5 text-[13px] text-ha-primary font-medium" data-testid="button-back-listings">
          <ArrowLeft className="w-4 h-4" /> Back to listings
        </button>
        {detail ? (
          <>
            <div className={`${CARD} p-5`}>
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-[18px] font-bold text-ha-text">{detail.title || "Untitled"}</h2>
                <div className="flex gap-1.5">
                  {detail.featured && <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">Aanrader</Badge>}
                  {detail.hidden_from_feed && <Badge className="bg-ha-hover-bg text-ha-text-secondary text-[10px]">Hidden</Badge>}
                </div>
              </div>
              {detail.image_url && (
                <div className="mb-4 rounded-xl overflow-hidden bg-ha-hover-bg">
                  <img src={detail.image_url} alt="" className="w-full h-48 object-cover" onError={e => (e.target as any).style.display = "none"} />
                </div>
              )}
              <div className="space-y-2.5 text-[13px]">
                {[
                  ["ID", detail.id],
                  ["Price", detail.price ? `€${detail.price}` : "—"],
                  ["City", detail.city || "—"],
                  ["Source", detail.source || "—"],
                  ["Bedrooms", detail.bedrooms || "—"],
                  ["Size", detail.size_m2 ? `${detail.size_m2} m²` : "—"],
                  ["Created", detail.created_at ? new Date(detail.created_at).toLocaleString() : "—"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-ha-text-secondary">{k}</span>
                    <span className="font-medium text-ha-text max-w-[60%] truncate text-right">{v}</span>
                  </div>
                ))}
                {detail.url && (
                  <a href={detail.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-ha-primary font-medium mt-2" data-testid="link-listing-url">
                    <ExternalLink className="w-3.5 h-3.5" /> Open original
                  </a>
                )}
              </div>
            </div>

            <div className={`${CARD} p-5`}>
              <h3 className="text-[15px] font-semibold text-ha-text mb-3">Quality controls</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-500" />
                    <div>
                      <p className="text-[13px] font-medium text-ha-text">Featured (Aanrader)</p>
                      <p className="text-[11px] text-ha-text-secondary">Prioritize in user feeds</p>
                    </div>
                  </div>
                  <button onClick={toggleFeatured} disabled={saving} className="relative" data-testid="toggle-featured">
                    {detail.featured ? <ToggleRight className="w-8 h-8 text-ha-primary" /> : <ToggleLeft className="w-8 h-8 text-ha-border-input" />}
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <EyeOff className="w-4 h-4 text-ha-text-secondary" />
                    <div>
                      <p className="text-[13px] font-medium text-ha-text">Hide from feed</p>
                      <p className="text-[11px] text-ha-text-secondary">Remove from user matching</p>
                    </div>
                  </div>
                  <button onClick={toggleHidden} disabled={saving} className="relative" data-testid="toggle-hidden">
                    {detail.hidden_from_feed ? <ToggleRight className="w-8 h-8 text-ha-danger" /> : <ToggleLeft className="w-8 h-8 text-ha-border-input" />}
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <EmptyState title="Not found" message="Listing could not be loaded." />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[24px] font-bold text-ha-text">Listings</h1>
        <span className="text-[13px] text-ha-text-secondary">{total} total</span>
      </div>

      <div className="flex gap-2">
        <input placeholder="Filter by city..." value={cityInput} onChange={e => { setCityInput(e.target.value); setPage(1); }} className="flex-1 h-10 px-4 rounded-xl bg-ha-hover-bg text-[13px] text-ha-text placeholder:text-ha-text-secondary focus:outline-none focus:ring-2 focus:ring-ha-primary/20" data-testid="input-listing-city" />
        <input placeholder="Filter by source..." value={sourceInput} onChange={e => { setSourceInput(e.target.value); setPage(1); }} className="flex-1 h-10 px-4 rounded-xl bg-ha-hover-bg text-[13px] text-ha-text placeholder:text-ha-text-secondary focus:outline-none focus:ring-2 focus:ring-ha-primary/20" data-testid="input-listing-source" />
      </div>

      {loading ? <LoadingState /> : (
        <div className={`${CARD} divide-y divide-ha-hover-bg`}>
          {listings.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-ha-text-secondary">No listings found</div>
          ) : listings.map(l => (
            <div key={l.id} className="px-4 py-3" data-testid={`listing-row-${l.id}`}>
              {editingId === l.id ? (
                <div className="space-y-2">
                  <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} className="w-full h-9 px-3 rounded-lg bg-ha-hover-bg text-[13px] focus:outline-none" placeholder="Title" data-testid="input-edit-title" />
                  <div className="flex gap-2">
                    <input value={editForm.price} onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))} className="flex-1 h-9 px-3 rounded-lg bg-ha-hover-bg text-[13px] focus:outline-none" placeholder="Price" type="number" data-testid="input-edit-price" />
                    <input value={editForm.image_url} onChange={e => setEditForm(f => ({ ...f, image_url: e.target.value }))} className="flex-[2] h-9 px-3 rounded-lg bg-ha-hover-bg text-[13px] focus:outline-none" placeholder="Image URL" data-testid="input-edit-image" />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setEditingId(null)} className="rounded-full" data-testid="button-cancel-edit"><X className="w-3.5 h-3.5 mr-1" /> Cancel</Button>
                    <Button size="sm" onClick={saveEdit} disabled={saving} className="rounded-full bg-ha-primary hover:bg-ha-primary/90 text-white" data-testid="button-save-edit"><Save className="w-3.5 h-3.5 mr-1" /> {saving ? "Saving..." : "Save"}</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-lg bg-ha-hover-bg flex-shrink-0 overflow-hidden">
                    {l.image_url ? (
                      <img src={l.image_url} alt="" className="w-full h-full object-cover" onError={e => { (e.target as any).style.display = "none"; }} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Image className="w-5 h-5 text-ha-border-input" /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openDetail(l.id)}>
                    <div className="flex items-center gap-1.5">
                      <p className="text-[13px] font-semibold text-ha-text truncate">{l.title || "Untitled"}</p>
                      {l.featured && <Star className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                      {l.hidden_from_feed && <EyeOff className="w-3 h-3 text-ha-text-secondary flex-shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-ha-text-secondary mt-0.5">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{l.source}</Badge>
                      <span>{l.city}</span>
                      <span>€{l.price || "—"}</span>
                      <span className="ml-auto">{l.created_at ? new Date(l.created_at).toLocaleDateString() : ""}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => startEdit(l)} className="w-8 h-8 rounded-lg bg-ha-hover-bg flex items-center justify-center hover:bg-ha-divider" data-testid={`button-edit-${l.id}`}>
                      <Pencil className="w-3.5 h-3.5 text-ha-text-secondary" />
                    </button>
                    <button onClick={() => setDeleteConfirm(l.id)} className="w-8 h-8 rounded-lg bg-ha-hover-bg flex items-center justify-center hover:bg-ha-danger/10" data-testid={`button-delete-${l.id}`}>
                      <Trash2 className="w-3.5 h-3.5 text-ha-danger" />
                    </button>
                    {l.url && (
                      <a href={l.url} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg bg-ha-hover-bg flex items-center justify-center hover:bg-ha-divider" data-testid={`link-ext-${l.id}`}>
                        <ExternalLink className="w-3.5 h-3.5 text-ha-text-secondary" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {total > 50 && (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-full" data-testid="button-listing-prev">Previous</Button>
          <span className="text-[12px] text-ha-text-secondary">Page {page} of {Math.ceil(total / 50)}</span>
          <Button variant="outline" size="sm" disabled={listings.length < 50} onClick={() => setPage(p => p + 1)} className="rounded-full" data-testid="button-listing-next">Next</Button>
        </div>
      )}

      {deleteConfirm && (
        <ConfirmDialog
          title="Delete listing"
          message="This will permanently delete the listing and all associated matches. This cannot be undone."
          onConfirm={() => deleteListing(deleteConfirm)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}

function ImagesTab() {
  const [auditData, setAuditData] = useState<any>(null);
  const [backfillStatus, setBackfillStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState<Record<string, string>>({});
  const [savingUrl, setSavingUrl] = useState<string | null>(null);
  const [triggeringBackfill, setTriggeringBackfill] = useState(false);
  const [sourceBackfilling, setSourceBackfilling] = useState<string | null>(null);

  function load() {
    setLoading(true);
    Promise.all([
      adminFetch("/api/admin/portal/image-audit").catch(() => null),
      adminFetch("/api/admin/portal/image-backfill-status").catch(() => null),
    ]).then(([audit, backfill]) => {
      setAuditData(audit);
      setBackfillStatus(backfill);
    }).finally(() => { setLoading(false); setRefreshing(false); });
  }

  useEffect(() => { load(); }, []);

  async function retryImage(listingId: string) {
    setRetryingId(listingId);
    try {
      await adminFetch(`/api/admin/portal/listings/${listingId}/retry-image`, { method: "POST" });
      load();
    } catch {}
    setRetryingId(null);
  }

  async function setImageUrl(listingId: string) {
    const url = manualUrl[listingId];
    if (!url) return;
    setSavingUrl(listingId);
    try {
      await adminFetch(`/api/admin/portal/listings/${listingId}`, {
        method: "PATCH",
        body: JSON.stringify({ image_url: url }),
      });
      setManualUrl(m => ({ ...m, [listingId]: "" }));
      load();
    } catch {}
    setSavingUrl(null);
  }

  async function triggerFullBackfill() {
    setTriggeringBackfill(true);
    try {
      await adminFetch("/api/admin/portal/image-backfill-trigger", { method: "POST" });
      load();
    } catch {}
    setTriggeringBackfill(false);
  }

  async function triggerSourceBackfill(source: string) {
    setSourceBackfilling(source);
    try {
      await adminFetch("/api/admin/portal/backfill-source", {
        method: "POST",
        body: JSON.stringify({ source, limit: 50 }),
      });
      load();
    } catch {}
    setSourceBackfilling(null);
  }

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[24px] font-bold text-ha-text">Image Management</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setRefreshing(true); load(); }} className="rounded-full" data-testid="button-refresh-images">
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" onClick={triggerFullBackfill} disabled={triggeringBackfill} className="rounded-full bg-ha-primary hover:bg-ha-primary/90 text-white" data-testid="button-trigger-backfill">
            <RotateCw className={`w-3.5 h-3.5 mr-1 ${triggeringBackfill ? "animate-spin" : ""}`} /> {triggeringBackfill ? "Running..." : "Sync photos"}
          </Button>
        </div>
      </div>

      {backfillStatus && (
        <div>
          <SectionHeader title="Photo sync status" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard label="Status" value={backfillStatus.enabled ? "Active" : "Paused"} icon={Activity} />
            <MetricCard label="Currently running" value={backfillStatus.running ? "Yes" : "No"} icon={Loader2} />
            <MetricCard label="Batch size" value={backfillStatus.batchSize} icon={Layers} />
            <MetricCard label="Photos synced" value={backfillStatus.cumulativeUpdates} icon={CheckCircle} />
          </div>
          {backfillStatus.lastRun && (
            <div className={`${CARD} p-4 mt-3`}>
              <p className="text-[12px] text-ha-text-secondary font-medium mb-1">Last sync</p>
              <p className="text-[13px] text-ha-text font-medium">{new Date(backfillStatus.lastRun.timestamp).toLocaleString()}</p>
              <p className="text-[11px] text-ha-text-secondary">Took {backfillStatus.lastRun.duration_ms}ms · Updated: {backfillStatus.lastRun.updated} · Failed: {backfillStatus.lastRun.failed}</p>
            </div>
          )}
          {backfillStatus.recentRuns && backfillStatus.recentRuns.length > 0 && (
            <div className={`${CARD} mt-3 divide-y divide-ha-hover-bg`}>
              <div className="px-4 py-2">
                <p className="text-[12px] font-semibold text-ha-text-secondary uppercase tracking-wider">Recent syncs</p>
              </div>
              {backfillStatus.recentRuns.slice(0, 8).map((run: any, i: number) => (
                <div key={i} className="px-4 py-2.5 flex items-center justify-between text-[12px]">
                  <span className="text-ha-text-secondary">{new Date(run.started_at).toLocaleString()}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-ha-text font-medium">{run.updated}/{run.total}</span>
                    <StatusBadge status={run.updated > 0 ? "success" : "warning"} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {auditData && (
        <>
          <div>
            <SectionHeader title="Coverage overview" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MetricCard label="Total listings" value={auditData.summary?.total_listings || 0} icon={Layers} />
              <MetricCard label="With image" value={auditData.summary?.with_image || 0} icon={CheckCircle} />
              <MetricCard label="Without image" value={auditData.summary?.without_image || 0} icon={XCircle} />
              <MetricCard label="Coverage" value={`${auditData.summary?.overall_coverage_pct || 0}%`} icon={Target} />
            </div>
          </div>

          <div>
            <SectionHeader title="Per source coverage" />
            <div className={`${CARD} divide-y divide-ha-hover-bg`}>
              {(auditData.per_source || []).map((s: any) => (
                <div key={s.source} className="px-4 py-3" data-testid={`image-source-${s.source}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-ha-text">{s.source}</span>
                      <Badge variant="secondary" className="text-[10px]">{s.priority}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-bold text-ha-text">{s.coverage_pct}%</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => triggerSourceBackfill(s.source)}
                        disabled={sourceBackfilling === s.source}
                        className="rounded-full text-[11px] h-7 px-2"
                        data-testid={`button-backfill-${s.source}`}
                      >
                        <RotateCw className={`w-3 h-3 mr-1 ${sourceBackfilling === s.source ? "animate-spin" : ""}`} />
                        Sync
                      </Button>
                    </div>
                  </div>
                  <div className="h-2 bg-ha-hover-bg rounded-full overflow-hidden mb-1.5">
                    <div className="h-full rounded-full bg-ha-primary transition-all" style={{ width: `${s.coverage_pct}%` }} />
                  </div>
                  <div className="flex gap-3 text-[11px] text-ha-text-secondary">
                    <span>{s.total} total</span>
                    <span className="text-emerald-600">{s.with_image} with</span>
                    <span className="text-ha-danger">{s.without_image} without</span>
                    {s.placeholder_only > 0 && <span className="text-amber-600">{s.placeholder_only} placeholder</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {auditData.samples && Object.keys(auditData.samples).length > 0 && (
            <div>
              <SectionHeader title="Missing image samples" />
              {Object.entries(auditData.samples).map(([source, samples]: [string, any]) => (
                <div key={source} className="mb-3">
                  <p className="text-[12px] font-semibold text-ha-text-secondary mb-2 uppercase">{source}</p>
                  <div className={`${CARD} divide-y divide-ha-hover-bg`}>
                    {(samples as any[]).map((s: any) => (
                      <div key={s.id} className="px-4 py-3" data-testid={`sample-${s.id}`}>
                        <p className="text-[13px] font-medium text-ha-text truncate mb-1">{s.title || s.id}</p>
                        <div className="flex gap-2 items-center">
                          <input
                            placeholder="Paste image URL..."
                            value={manualUrl[s.id] || ""}
                            onChange={e => setManualUrl(m => ({ ...m, [s.id]: e.target.value }))}
                            className="flex-1 h-8 px-3 rounded-lg bg-ha-hover-bg text-[12px] focus:outline-none"
                            data-testid={`input-manual-url-${s.id}`}
                          />
                          <Button
                            variant="outline" size="sm"
                            onClick={() => setImageUrl(s.id)}
                            disabled={savingUrl === s.id || !manualUrl[s.id]}
                            className="rounded-full text-[11px] h-8"
                            data-testid={`button-set-url-${s.id}`}
                          >
                            <Save className="w-3 h-3 mr-1" /> Set
                          </Button>
                          <Button
                            variant="outline" size="sm"
                            onClick={() => retryImage(s.id)}
                            disabled={retryingId === s.id}
                            className="rounded-full text-[11px] h-8"
                            data-testid={`button-retry-${s.id}`}
                          >
                            <RotateCw className={`w-3 h-3 mr-1 ${retryingId === s.id ? "animate-spin" : ""}`} /> Retry
                          </Button>
                        </div>
                        {s.url && (
                          <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-ha-primary mt-1 inline-flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" /> View listing
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const SOURCE_HEALTH_CITIES = ["All", "Berlin", "Hamburg", "München", "Köln", "Frankfurt", "Stuttgart", "Düsseldorf", "Leipzig"];

function SourcesTab() {
  const [sources, setSources] = useState<any[]>([]);
  const [latestRun, setLatestRun] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cityFilter, setCityFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sourceBackfilling, setSourceBackfilling] = useState<string | null>(null);
  const [sourceOverrides, setSourceOverrides] = useState<Record<string, boolean>>({});
  const [togglingSource, setTogglingSource] = useState<string | null>(null);

  function loadSources() {
    setLoading(true);
    Promise.all([
      adminFetch("/api/admin/portal/sources").catch(() => ({ sources: [], latestRun: null })),
      adminFetch("/api/admin/portal/source-overrides").catch(() => ({ overrides: {} })),
    ]).then(([srcData, overData]) => {
      setSources(srcData.sources || []);
      setLatestRun(srcData.latestRun);
      setSourceOverrides(overData.overrides || {});
    }).finally(() => setLoading(false));
  }

  useEffect(() => { loadSources(); }, []);

  async function toggleSource(sourceName: string, currentEnabled: boolean) {
    setTogglingSource(sourceName);
    try {
      await adminFetch("/api/admin/portal/source-toggle", {
        method: "POST",
        body: JSON.stringify({ source: sourceName, enabled: !currentEnabled }),
      });
      setSourceOverrides(prev => ({ ...prev, [sourceName]: !currentEnabled }));
    } catch {}
    setTogglingSource(null);
  }

  async function triggerSourceBackfill(source: string) {
    setSourceBackfilling(source);
    try {
      await adminFetch("/api/admin/portal/backfill-source", {
        method: "POST",
        body: JSON.stringify({ source, limit: 50 }),
      });
    } catch {}
    setSourceBackfilling(null);
  }

  const filteredSources = sources.filter(s => {
    const cityMatch = cityFilter === "All" || (s.city || "").toLowerCase() === cityFilter.toLowerCase();
    const st = s.status || (s.errors > 0 ? "broken" : s.found > 0 ? "active" : "broken");
    const statusMatch = statusFilter === "All" ||
      (statusFilter === "Healthy" && (st === "active" || st === "success")) ||
      (statusFilter === "Warning" && (st === "degraded" || st === "partial")) ||
      (statusFilter === "Broken" && (st === "broken" || st === "failed" || st === "error"));
    return cityMatch && statusMatch;
  });

  const healthySources = sources.filter(s => s.found > 0 || s.status === "active").length;
  const brokenSources = sources.filter(s => (s.errors || 0) > 0 || s.status === "broken" || s.status === "failed").length;
  const totalFound = sources.reduce((a: number, s: any) => a + (s.found || 0), 0);

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-5">
      <h1 className="text-[24px] font-bold text-ha-text">Sources</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Active sources" value={healthySources} icon={CheckCircle} />
        <MetricCard label="Broken" value={brokenSources} icon={XCircle} />
        <MetricCard label="Listings found" value={totalFound} icon={Layers} />
        <MetricCard label="Last run" value={latestRun ? `${latestRun.duration_sec}s` : "—"} sub={latestRun ? new Date(latestRun.started_at).toLocaleTimeString() : ""} icon={Activity} />
      </div>

      {latestRun && (
        <div className={`${CARD} p-4 flex items-center gap-3`}>
          <StatusBadge status={latestRun.status} />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-ha-text">Last import run</p>
            <p className="text-[11px] text-ha-text-secondary">{new Date(latestRun.started_at).toLocaleString()} · {latestRun.duration_sec}s</p>
          </div>
        </div>
      )}

      <div>
        <SectionHeader title="Source monitor" />
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3" style={{ WebkitOverflowScrolling: "touch" }}>
          {["All", "Healthy", "Warning", "Broken"].map(f => (
            <button key={f} onClick={() => setStatusFilter(f)} className={`px-3 py-1.5 rounded-full text-[12px] font-medium flex-shrink-0 transition-colors ${statusFilter === f ? "bg-ha-text text-white" : "bg-white text-ha-text-secondary border border-ha-divider"}`} data-testid={`filter-status-${f}`}>
              {f}
            </button>
          ))}
          <select value={cityFilter} onChange={e => setCityFilter(e.target.value)} className="px-3 py-1.5 rounded-full text-[12px] font-medium bg-white text-ha-text-secondary border border-ha-divider cursor-pointer" data-testid="select-source-city">
            {SOURCE_HEALTH_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className={`${CARD} divide-y divide-ha-hover-bg`}>
          {filteredSources.length > 0 ? filteredSources.map((s: any) => {
            const st = s.status || (s.errors > 0 ? "broken" : s.found > 0 ? "active" : "broken");
            const sourceName = s.name || s.source;
            const baseSource = sourceName.replace(/\s*\(.*\)$/, "");
            const isAdminEnabled = sourceOverrides[baseSource] !== undefined ? sourceOverrides[baseSource] : true;
            return (
              <div key={`${sourceName}-${s.city || ""}`} className={`px-4 py-3 ${!isAdminEnabled ? "opacity-50" : ""}`} data-testid={`source-card-${sourceName}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <StatusDot status={isAdminEnabled ? st : "disabled"} />
                    <span className="text-[13px] font-semibold text-ha-text truncate">{sourceName}</span>
                    {!isAdminEnabled && <Badge className="bg-ha-hover-bg text-ha-text-secondary text-[9px]">Disabled</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleSource(baseSource, isAdminEnabled)}
                      disabled={togglingSource === baseSource}
                      className="flex-shrink-0"
                      data-testid={`toggle-source-${sourceName}`}
                    >
                      {isAdminEnabled
                        ? <ToggleRight className="w-7 h-7 text-emerald-500" />
                        : <ToggleLeft className="w-7 h-7 text-ha-border-input" />
                      }
                    </button>
                    <StatusBadge status={st} />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => triggerSourceBackfill(sourceName)}
                      disabled={sourceBackfilling === sourceName}
                      className="rounded-full text-[11px] h-7 px-2"
                      data-testid={`button-scrape-${sourceName}`}
                    >
                      <RotateCw className={`w-3 h-3 mr-1 ${sourceBackfilling === sourceName ? "animate-spin" : ""}`} />
                      Sync
                    </Button>
                  </div>
                </div>
                <div className="flex gap-3 text-[11px] text-ha-text-secondary ml-4">
                  {s.city && <span>{s.city}</span>}
                  <span>{s.found ?? 0} found</span>
                  <span>{s.inserted ?? 0} new</span>
                  {(s.errors ?? 0) > 0 && <span className="text-ha-danger font-medium">{s.errors} errors</span>}
                </div>
              </div>
            );
          }) : (
            <div className="px-4 py-8 text-center text-[13px] text-ha-text-secondary">No sources match this filter</div>
          )}
        </div>
      </div>
    </div>
  );
}

function UserDetailView({ detail, onBack, onRefresh }: { detail: any; onBack: () => void; onRefresh: () => void }) {
  const { profile, subscription, searchProfiles, recentMatches, cancellationFeedback, notificationSettings, diagnostics } = detail;
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [trialDays, setTrialDays] = useState("7");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteResult, setDeleteResult] = useState<{ steps: string[]; authWasPresent: boolean; deleted: string } | null>(null);

  function parseDeleteSummary(steps: string[]) {
    function stepStatus(keys: string[]): "deleted" | "already_clean" | "error" | "missing" {
      const found = steps.find(s => keys.some(k => s.includes(k)));
      if (!found) return "missing";
      if (found.startsWith("✓")) {
        const lower = found.toLowerCase();
        if (lower.includes("already missing") || lower.includes("already cleaned") || lower.includes("skipped") || lower.includes("no search profiles") || lower.includes("(0 rows)") || (lower.includes(" 0 ") && lower.includes("rows"))) return "already_clean";
        return "deleted";
      }
      return "error";
    }
    return [
      { label: "App user record", status: stepStatus(["user_profile_data"]) },
      { label: "Auth account", status: stepStatus(["auth.deleteUser"]) },
      { label: "Search profiles", status: stepStatus(["search_profiles"]) },
      { label: "Matches & alerts", status: stepStatus(["matches(user)", "matches(via_search_profiles)", "user_matches"]) },
      { label: "Subscription", status: stepStatus(["subscriptions"]) },
      { label: "Notification settings", status: stepStatus(["user_notification_settings"]) },
      { label: "Push tokens", status: stepStatus(["push_subscriptions"]) },
      { label: "Buddy relationships", status: stepStatus(["search_profile_buddies"]) },
      { label: "Referrals", status: stepStatus(["referrals"]) },
    ];
  }

  async function permanentDeleteUser() {
    if (!profile?.user_id) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const result = await adminFetch(`/api/admin/portal/users/${profile.user_id}/permanent-delete`, { method: "DELETE" });
      if (result?.success) {
        setDeleteResult({ steps: result.steps || [], authWasPresent: result.authWasPresent ?? true, deleted: result.deleted || profile?.email || profile?.user_id });
      } else {
        setDeleteError(result?.error || "Delete failed");
      }
    } catch (err: any) {
      setDeleteError(err.message || "Delete failed");
    }
    setDeleteLoading(false);
  }

  async function extendTrial() {
    if (!profile?.user_id) return;
    setActionLoading("trial");
    try {
      await adminFetch(`/api/admin/portal/users/${profile.user_id}/update-plan`, {
        method: "POST",
        body: JSON.stringify({ trialDaysExtend: parseInt(trialDays) }),
      });
      onRefresh();
    } catch {}
    setActionLoading(null);
  }

  async function changePlan(plan: string) {
    if (!profile?.user_id) return;
    setActionLoading("plan");
    try {
      await adminFetch(`/api/admin/portal/users/${profile.user_id}/update-plan`, {
        method: "POST",
        body: JSON.stringify({ plan }),
      });
      onRefresh();
    } catch {}
    setActionLoading(null);
  }

  async function deactivateUser() {
    if (!profile?.user_id) return;
    setActionLoading("deactivate");
    try {
      await adminFetch(`/api/admin/portal/users/${profile.user_id}/deactivate`, { method: "POST" });
      onRefresh();
    } catch {}
    setActionLoading(null);
  }

  async function resendUserMatches() {
    if (!profile?.user_id) return;
    setActionLoading("resend");
    try {
      await adminFetch(`/api/admin/portal/resend-matches/${profile.user_id}`, { method: "POST" });
    } catch {}
    setActionLoading(null);
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[13px] text-ha-primary font-medium" data-testid="button-back-users">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className={`${CARD} p-5`}>
        <h3 className="text-[16px] font-bold text-ha-text mb-3">Profile</h3>
        <div className="space-y-2.5 text-[13px]">
          <div className="flex justify-between"><span className="text-ha-text-secondary">Name</span><span className="font-medium text-ha-text">{profile?.first_name || ""} {profile?.last_name || ""}</span></div>
          <div className="flex justify-between"><span className="text-ha-text-secondary">Email</span><span className="font-medium text-ha-text max-w-[200px] truncate">{profile?.email || "—"}</span></div>
          <div className="flex justify-between"><span className="text-ha-text-secondary">Phone</span><span className="font-medium text-ha-text">{profile?.phone || "—"}</span></div>
          <div className="flex justify-between"><span className="text-ha-text-secondary">Created</span><span className="font-medium text-ha-text">{profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "—"}</span></div>
          <div className="flex justify-between items-center">
            <span className="text-ha-text-secondary">Notifications</span>
            <div className="flex gap-1.5">
              {notificationSettings?.email_enabled && <Badge variant="secondary" className="text-[10px]">Email</Badge>}
              {notificationSettings?.push_enabled && <Badge variant="secondary" className="text-[10px]">Push</Badge>}
              {!notificationSettings?.email_enabled && !notificationSettings?.push_enabled && <span className="text-ha-text-secondary">None</span>}
            </div>
          </div>
          <div><span className="text-ha-text-secondary text-[11px] break-all">{profile?.user_id || ""}</span></div>
        </div>
      </div>

      {diagnostics && (
        <div className={`${CARD} p-5`}>
          <h3 className="text-[16px] font-bold text-ha-text mb-3">Diagnostics</h3>
          <div className="space-y-2.5 text-[13px]">
            <div className="flex justify-between items-center">
              <span className="text-ha-text-secondary">Role</span>
              <Badge variant="secondary" className={`text-[10px] ${diagnostics.accountRole === "owner" ? "bg-ha-primary/10 text-ha-primary" : diagnostics.accountRole === "buddy" ? "text-[#223546]" : diagnostics.accountRole === "both" ? "text-[#171429]" : "bg-gray-100 text-gray-500"}`} style={diagnostics.accountRole === "buddy" ? { backgroundColor: "rgba(133,251,140,0.25)" } : diagnostics.accountRole === "both" ? { backgroundColor: "rgba(187,173,251,0.2)" } : {}}>
                {diagnostics.accountRole === "owner" ? "Owner" : diagnostics.accountRole === "buddy" ? "Buddy" : diagnostics.accountRole === "both" ? "Owner + Buddy" : "No role"}
              </Badge>
            </div>
            <div className="flex justify-between"><span className="text-ha-text-secondary">Search profiles</span><span className="font-medium text-ha-text">{diagnostics.searchProfileCount}</span></div>
            <div className="flex justify-between"><span className="text-ha-text-secondary">Matches (24h)</span><span className="font-medium text-ha-text">{diagnostics.matchesLast24h}</span></div>
            <div className="flex justify-between"><span className="text-ha-text-secondary">Emails sent (24h)</span><span className="font-medium text-ha-text">{diagnostics.emailsSentLast24h}</span></div>
            <div className="flex justify-between"><span className="text-ha-text-secondary">hasAccess</span><span className={`font-medium ${subscription?.hasAccess ? "text-emerald-600" : "text-ha-danger"}`}>{subscription?.hasAccess ? "Yes" : "No"}</span></div>
            {diagnostics.buddyConnections?.asOwner && (
              <div className="p-2.5 bg-ha-hover-bg rounded-xl">
                <p className="text-[11px] font-semibold text-ha-text-secondary mb-1">Buddy (as owner)</p>
                <p className="text-[12px] text-ha-text">{diagnostics.buddyConnections.asOwner.invite_email} — {diagnostics.buddyConnections.asOwner.invite_status}</p>
              </div>
            )}
            {diagnostics.buddyConnections?.asBuddy?.length > 0 && diagnostics.buddyConnections.asBuddy.map((b: any, i: number) => (
              <div key={i} className="p-2.5 bg-ha-hover-bg rounded-xl">
                <p className="text-[11px] font-semibold text-ha-text-secondary mb-1">Owner (as buddy)</p>
                <p className="text-[12px] text-ha-text">{b.owner_name || b.owner_user_id?.substring(0, 8)} — {b.invite_status}</p>
              </div>
            ))}
            {diagnostics.legacyBuddyEmail && (
              <div className="p-2.5 bg-amber-50 rounded-xl">
                <p className="text-[11px] font-semibold text-amber-700 mb-0.5">Legacy buddy email (deprecated)</p>
                <p className="text-[12px] text-amber-900">{diagnostics.legacyBuddyEmail}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {subscription && (
        <div className={`${CARD} p-5`}>
          <h3 className="text-[16px] font-bold text-ha-text mb-3">Subscription</h3>
          <div className="space-y-2.5 text-[13px]">
            <div className="flex justify-between items-center"><span className="text-ha-text-secondary">Status</span><StatusBadge status={subscription.computedStatus || subscription.status} /></div>
            {subscription.computedStatus && subscription.computedStatus !== subscription.status && (
              <div className="flex justify-between items-center"><span className="text-[10px] text-orange-500">DB raw: {subscription.status}</span></div>
            )}
            <div className="flex justify-between"><span className="text-ha-text-secondary">Plan</span><span className="font-medium">{subscription.plan || "—"}</span></div>
            <div className="flex justify-between"><span className="text-ha-text-secondary">Trial ends</span><span className="font-medium">{subscription.trial_ends_at ? new Date(subscription.trial_ends_at).toLocaleDateString() : "—"}</span></div>
            <div className="flex justify-between"><span className="text-ha-text-secondary">Period ends</span><span className="font-medium">{subscription.current_period_ends_at ? new Date(subscription.current_period_ends_at).toLocaleDateString() : "—"}</span></div>
            {subscription.stripe_subscription_id && (
              <a href={`https://dashboard.stripe.com/subscriptions/${subscription.stripe_subscription_id}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-ha-primary text-[12px] font-medium" data-testid="link-stripe-sub">
                <ExternalLink className="w-3 h-3" /> View in Stripe
              </a>
            )}
          </div>
        </div>
      )}

      <div className={`${CARD} p-5`}>
        <h3 className="text-[16px] font-bold text-ha-text mb-3">Actions</h3>
        <div className="space-y-3">
          <div>
            <p className="text-[12px] text-ha-text-secondary font-medium mb-1.5">Extend trial</p>
            <div className="flex gap-2">
              <select value={trialDays} onChange={e => setTrialDays(e.target.value)} className="h-9 px-3 rounded-lg bg-ha-hover-bg text-[13px] border-0 focus:outline-none" data-testid="select-trial-days">
                <option value="3">3 days</option>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
              </select>
              <Button size="sm" onClick={extendTrial} disabled={actionLoading === "trial"} className="rounded-full bg-ha-primary hover:bg-ha-primary/90 text-white" data-testid="button-extend-trial">
                {actionLoading === "trial" ? "Extending..." : "Extend"}
              </Button>
            </div>
          </div>
          <div>
            <p className="text-[12px] text-ha-text-secondary font-medium mb-1.5">Change plan</p>
            <div className="flex gap-2">
              {["monthly", "two_month", "three_month"].map(plan => (
                <Button key={plan} variant="outline" size="sm" onClick={() => changePlan(plan)} disabled={actionLoading === "plan"} className="rounded-full text-[11px]" data-testid={`button-plan-${plan}`}>
                  {plan.replace("_", " ")}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[12px] text-ha-text-secondary font-medium mb-1.5">Alerts</p>
            <Button variant="outline" size="sm" onClick={resendUserMatches} disabled={actionLoading === "resend"} className="rounded-full" data-testid="button-resend-matches">
              <Send className="w-3.5 h-3.5 mr-1" />
              {actionLoading === "resend" ? "Sending..." : "Resend undelivered matches"}
            </Button>
          </div>
          <div className="pt-2 border-t border-ha-hover-bg flex flex-col gap-2">
            <Button variant="outline" size="sm" onClick={deactivateUser} disabled={actionLoading === "deactivate"} className="rounded-full text-ha-danger border-ha-danger/30 hover:bg-ha-danger/5" data-testid="button-deactivate">
              <XCircle className="w-3.5 h-3.5 mr-1" />
              {actionLoading === "deactivate" ? "Deactivating..." : "Deactivate user"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setDeleteResult(null); setDeleteError(null); setShowDeleteModal(true); }} className="rounded-full text-red-600 border-red-300 hover:bg-red-50 font-semibold" data-testid="button-permanent-delete">
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Delete permanently
            </Button>
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="modal-permanent-delete">
          <div className="absolute inset-0 bg-black/50" onClick={() => { if (!deleteLoading && !deleteResult) { setShowDeleteModal(false); setDeleteError(null); } }} />
          <div className="relative bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">

            {/* Success summary view */}
            {deleteResult ? (() => {
              const summary = parseDeleteSummary(deleteResult.steps);
              return (
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "rgba(133,251,140,0.25)" }}>
                      <CheckCircle className="w-5 h-5" style={{ color: "#223546" }} />
                    </div>
                    <div>
                      <h2 className="text-[15px] font-bold text-ha-text">User deleted</h2>
                      <p className="text-[11px] text-ha-text-secondary truncate max-w-[200px]">{deleteResult.deleted}</p>
                    </div>
                  </div>
                  <div className="space-y-1.5 mb-5" data-testid="delete-summary">
                    {summary.map(({ label, status }) => (
                      <div key={label} className="flex items-center justify-between text-[12px]">
                        <span className="text-ha-text-secondary">{label}</span>
                        <span className={`font-medium flex items-center gap-1 ${status === "deleted" ? "" : status === "already_clean" ? "text-ha-text-secondary" : status === "error" ? "text-red-500" : "text-ha-text-secondary"}`} style={status === "deleted" ? { color: "#223546" } : {}}
                          data-testid={`delete-summary-${label.toLowerCase().replace(/\s+/g, "-")}`}>
                          {status === "deleted" && <CheckCircle className="w-3 h-3" />}
                          {status === "already_clean" && <span className="w-3 h-3 inline-flex items-center justify-center text-[10px]">–</span>}
                          {status === "error" && <AlertTriangle className="w-3 h-3" />}
                          {status === "deleted" ? "Deleted" : status === "already_clean" ? "Already clean" : status === "error" ? "Failed" : "—"}
                        </span>
                      </div>
                    ))}
                    {!deleteResult.authWasPresent && (
                      <p className="text-[11px] text-ha-text-secondary mt-2 pt-2 border-t border-ha-divider">Auth account was already missing — app data cleaned up</p>
                    )}
                  </div>
                  <button onClick={onBack}
                    className="w-full h-10 rounded-lg bg-ha-text text-white text-[13px] font-semibold hover:opacity-90 transition-opacity"
                    data-testid="button-delete-done">
                    Done
                  </button>
                </div>
              );
            })() : (
              /* Confirmation view */
              <div className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                  <h2 className="text-[16px] font-bold text-ha-text">Delete user permanently?</h2>
                </div>
                <p className="text-[13px] text-ha-text-secondary leading-relaxed mb-1">
                  This will permanently delete <span className="font-semibold text-ha-text">{profile?.email}</span> and all related data:
                </p>
                <ul className="text-[12px] text-ha-text-secondary mb-4 space-y-0.5 ml-3 list-disc">
                  <li>Search profiles & matches</li>
                  <li>Subscription records</li>
                  <li>Notification settings & push tokens</li>
                  <li>Profile data & cancellation feedback</li>
                  <li>Supabase Auth account</li>
                </ul>
                {deleteError && <p className="text-[12px] text-red-600 mb-3 font-medium" data-testid="delete-error-msg">{deleteError}</p>}
                <div className="flex gap-2">
                  <button onClick={() => { setShowDeleteModal(false); setDeleteError(null); }}
                    className="flex-1 h-10 rounded-lg border border-ha-card-border text-[13px] font-medium text-ha-text-secondary hover:bg-ha-surface transition-colors"
                    data-testid="button-cancel-permanent-delete">
                    Cancel
                  </button>
                  <button onClick={permanentDeleteUser} disabled={deleteLoading}
                    className="flex-1 h-10 rounded-lg bg-red-600 text-white text-[13px] font-semibold flex items-center justify-center gap-1.5 hover:bg-red-700 transition-colors disabled:opacity-50"
                    data-testid="button-confirm-permanent-delete">
                    {deleteLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    {deleteLoading ? "Deleting..." : "Delete permanently"}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {searchProfiles && searchProfiles.length > 0 && (
        <div className={`${CARD} p-5`}>
          <h3 className="text-[16px] font-bold text-ha-text mb-3">Search profiles ({searchProfiles.length})</h3>
          <div className="space-y-2">
            {searchProfiles.map((sp: any) => (
              <div key={sp.id} className="p-3 bg-ha-hover-bg rounded-xl text-[12px]">
                <p className="font-semibold text-ha-text mb-0.5">{sp.city_name || sp.city}</p>
                <p className="text-ha-text-secondary">€{sp.price_min || 0}–€{sp.price_max || "∞"} · {sp.bedrooms_min || 0}+ rooms · {sp.size_min || 0}+ m²</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {recentMatches && recentMatches.length > 0 && (
        <div className={`${CARD} p-5`}>
          <h3 className="text-[16px] font-bold text-ha-text mb-3">Recent matches ({recentMatches.length})</h3>
          <div className="space-y-2">
            {recentMatches.slice(0, 10).map((m: any) => (
              <div key={m.id} className="flex items-center gap-2 p-2.5 bg-ha-hover-bg rounded-xl text-[12px]">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-ha-text truncate">{m.listing_title || m.listing_id?.substring(0, 12)}</p>
                  <p className="text-ha-text-secondary">{m.matched_at ? new Date(m.matched_at).toLocaleString() : "—"}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {m.email_sent && <Badge variant="secondary" className="text-[9px] px-1.5">Email</Badge>}
                  {m.push_sent && <Badge variant="secondary" className="text-[9px] px-1.5">Push</Badge>}
                  {m.viewed && <Badge className="text-[9px] px-1.5 bg-emerald-50 text-emerald-700">Viewed</Badge>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {cancellationFeedback && (
        <div className={`${CARD} p-5`}>
          <h3 className="text-[16px] font-bold text-ha-text mb-3">Cancellation feedback</h3>
          <div className="space-y-2 text-[13px]">
            <div className="flex justify-between"><span className="text-ha-text-secondary">Reason</span><span className="font-medium">{cancellationFeedback.reason || "—"}</span></div>
            {cancellationFeedback.feedback && <p className="text-ha-text-secondary text-[12px] bg-ha-hover-bg rounded-xl p-3">{cancellationFeedback.feedback}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState("");
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [bulkDeleteResult, setBulkDeleteResult] = useState<any>(null);

  async function handleBulkDelete() {
    if (bulkDeleteConfirm !== "DELETE") return;
    setBulkDeleteLoading(true);
    try {
      const result = await adminFetch("/api/admin/portal/users/bulk-delete-except-protected", { method: "POST" });
      setBulkDeleteResult(result);
      setBulkDeleteConfirm("");
      loadUsers();
    } catch (err: any) {
      setBulkDeleteResult({ error: err.message });
    }
    setBulkDeleteLoading(false);
  }

  const loadUsers = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "50", filter });
    if (search) params.set("search", search);
    adminFetch(`/api/admin/portal/users?${params}`)
      .then(d => { setUsers(d.users || []); setTotal(d.total || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, filter, search]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  function openUser(userId: string) {
    setSelectedUser(userId);
    setDetailLoading(true);
    adminFetch(`/api/admin/portal/users/${userId}`)
      .then(setUserDetail)
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  }

  function refreshUserDetail() {
    if (!selectedUser) return;
    setDetailLoading(true);
    adminFetch(`/api/admin/portal/users/${selectedUser}`)
      .then(setUserDetail)
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  }

  if (selectedUser) {
    if (detailLoading) return <LoadingState />;
    if (userDetail) return <UserDetailView detail={userDetail} onBack={() => { setSelectedUser(null); setUserDetail(null); }} onRefresh={refreshUserDetail} />;
    return <EmptyState title="User not found" message="This user could not be loaded." onRetry={() => { setSelectedUser(null); }} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[24px] font-bold text-ha-text">Users</h1>
        <button onClick={() => { setShowBulkDeleteModal(true); setBulkDeleteConfirm(""); setBulkDeleteResult(null); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold text-red-600 border border-red-200 bg-white hover:bg-red-50 transition-colors"
          data-testid="button-bulk-delete-users">
          <Trash2 className="w-3.5 h-3.5" />
          Bulk delete
        </button>
      </div>

      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="modal-bulk-delete">
          <div className="absolute inset-0 bg-black/50" onClick={() => !bulkDeleteLoading && setShowBulkDeleteModal(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            {bulkDeleteResult ? (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${bulkDeleteResult.error ? "bg-red-100" : ""}`} style={!bulkDeleteResult.error ? { backgroundColor: "rgba(133,251,140,0.25)" } : {}}>
                    {bulkDeleteResult.error ? <AlertTriangle className="w-5 h-5 text-red-600" /> : <CheckCircle className="w-5 h-5" style={{ color: "#223546" }} />}
                  </div>
                  <h2 className="text-[16px] font-bold text-ha-text">{bulkDeleteResult.error ? "Delete failed" : "Bulk delete complete"}</h2>
                </div>
                {bulkDeleteResult.error ? (
                  <p className="text-[13px] text-red-600 mb-4">{bulkDeleteResult.error}</p>
                ) : (
                  <div className="text-[13px] text-ha-text-secondary space-y-1 mb-4">
                    <p><span className="font-semibold text-ha-text">{bulkDeleteResult.deleted}</span> users deleted</p>
                    {bulkDeleteResult.skipped > 0 && <p><span className="font-semibold text-ha-text">{bulkDeleteResult.skipped}</span> failed (see logs)</p>}
                    {bulkDeleteResult.protectedPreserved && <p className="font-medium" style={{ color: "#223546" }}>Protected account preserved: {bulkDeleteResult.protectedEmail}</p>}
                  </div>
                )}
                <button onClick={() => setShowBulkDeleteModal(false)}
                  className="w-full h-10 rounded-lg border border-ha-card-border text-[13px] font-medium text-ha-text hover:bg-ha-surface transition-colors"
                  data-testid="button-close-bulk-delete-result">
                  Close
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                  <h2 className="text-[16px] font-bold text-ha-text">Bulk delete all users?</h2>
                </div>
                <p className="text-[13px] text-ha-text-secondary leading-relaxed mb-2">
                  This will permanently delete <span className="font-semibold text-ha-text">all users</span> and their data, except the protected admin account.
                </p>
                <p className="text-[12px] text-ha-text-secondary mb-3">
                  Protected: <span className="font-semibold text-ha-text">martin.essie87@gmail.com</span>
                </p>
                <p className="text-[12px] font-semibold text-ha-text mb-1.5">Type DELETE to confirm:</p>
                <input
                  value={bulkDeleteConfirm}
                  onChange={e => setBulkDeleteConfirm(e.target.value)}
                  placeholder="DELETE"
                  className="w-full h-10 px-3 rounded-lg border border-ha-card-border text-[13px] text-ha-text focus:outline-none focus:border-red-400 mb-4 font-mono"
                  data-testid="input-bulk-delete-confirm"
                />
                <div className="flex gap-2">
                  <button onClick={() => setShowBulkDeleteModal(false)}
                    className="flex-1 h-10 rounded-lg border border-ha-card-border text-[13px] font-medium text-ha-text-secondary hover:bg-ha-surface transition-colors"
                    data-testid="button-cancel-bulk-delete">
                    Cancel
                  </button>
                  <button onClick={handleBulkDelete} disabled={bulkDeleteConfirm !== "DELETE" || bulkDeleteLoading}
                    className="flex-1 h-10 rounded-lg bg-red-600 text-white text-[13px] font-semibold flex items-center justify-center gap-1.5 hover:bg-red-700 transition-colors disabled:opacity-40"
                    data-testid="button-confirm-bulk-delete">
                    {bulkDeleteLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    {bulkDeleteLoading ? "Deleting..." : "Delete all"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className={`${CARD} px-4 py-3 flex items-center gap-3`}>
        <Search className="w-5 h-5 text-ha-text-secondary flex-shrink-0" />
        <input
          placeholder="Search name or email..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 text-[13px] text-ha-text bg-transparent focus:outline-none placeholder:text-ha-text-secondary"
          data-testid="input-search-users"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: "touch" }}>
        {["all", "paid", "trial", "canceled", "expired"].map(f => (
          <button key={f} onClick={() => { setFilter(f); setPage(1); }} className={`px-3 py-1.5 rounded-full text-[12px] font-medium flex-shrink-0 transition-colors ${filter === f ? "bg-ha-text text-white" : "bg-white text-ha-text-secondary border border-ha-divider"}`} data-testid={`filter-user-${f}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <span className="text-[12px] text-ha-text-secondary self-center ml-auto flex-shrink-0">{total} users</span>
      </div>

      {loading ? <LoadingState /> : (
        <div className={`${CARD} divide-y divide-ha-hover-bg`}>
          {users.map(u => (
            <button key={u.user_id} onClick={() => openUser(u.user_id)} className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-ha-bg transition-colors" data-testid={`user-card-${u.user_id}`}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-[13px] font-bold ${u.has_profile_data === false ? "bg-ha-hover-bg text-ha-text-secondary" : "bg-ha-hover-bg text-ha-primary"}`}>
                {(u.first_name || u.email || "?")[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-ha-text truncate">{u.first_name || u.email || "Unknown"} {u.last_name || ""}</p>
                <p className="text-[11px] text-ha-text-secondary truncate">{u.email || u.user_id?.substring(0, 8)} · {u.searchProfileCount || 0} profiles · {u.matchCount || 0} matches</p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <div className="flex gap-1 items-center">
                  {u.role && u.role !== "user" && (
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${u.role === "owner" ? "bg-ha-primary/10 text-ha-primary" : u.role === "buddy" ? "text-[#223546]" : "text-[#171429]"}`} style={u.role === "buddy" ? { backgroundColor: "rgba(133,251,140,0.25)" } : u.role !== "owner" ? { backgroundColor: "rgba(187,173,251,0.2)" } : {}}>
                      {u.role === "both" ? "O+B" : u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                    </span>
                  )}
                  {u.subscription ? <StatusBadge status={u.subscription.status} /> : <span className="text-[11px] text-ha-text-secondary">No sub</span>}
                </div>
                <span className="text-[10px] text-ha-text-secondary">{u.created_at ? new Date(u.created_at).toLocaleDateString() : ""}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-200 flex-shrink-0" />
            </button>
          ))}
          {users.length === 0 && <div className="px-4 py-8 text-center text-[13px] text-ha-text-secondary">No users found</div>}
        </div>
      )}

      {total > 50 && (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-full" data-testid="button-user-prev">Previous</Button>
          <span className="text-[12px] text-ha-text-secondary">Page {page}</span>
          <Button variant="outline" size="sm" disabled={users.length < 50} onClick={() => setPage(p => p + 1)} className="rounded-full" data-testid="button-user-next">Next</Button>
        </div>
      )}
    </div>
  );
}

function SubscriptionsTab() {
  const [subs, setSubs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    adminFetch(`/api/admin/portal/subscriptions?filter=${filter}&page=${page}&limit=50`)
      .then(d => { setSubs(d.subscriptions || []); setTotal(d.total ?? 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter, page]);

  return (
    <div className="space-y-4">
      <h1 className="text-[24px] font-bold text-ha-text">Subscriptions</h1>

      <div className="flex gap-2 overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: "touch" }}>
        {["all", "active", "trial", "canceled", "expired"].map(f => (
          <button key={f} onClick={() => { setFilter(f); setPage(1); }} className={`px-3 py-1.5 rounded-full text-[12px] font-medium flex-shrink-0 transition-colors ${filter === f ? "bg-ha-text text-white" : "bg-white text-ha-text-secondary border border-ha-divider"}`} data-testid={`filter-sub-${f}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <span className="text-[12px] text-ha-text-secondary self-center ml-auto flex-shrink-0">{total}</span>
      </div>

      {loading ? <LoadingState /> : subs.length === 0 ? (
        <EmptyState title="No subscriptions" message={`No subscriptions found for "${filter}".`} />
      ) : (
        <div className={`${CARD} divide-y divide-ha-hover-bg`}>
          {subs.map(s => (
            <div key={s.id} className="px-4 py-3" data-testid={`sub-card-${s.id}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-ha-text truncate">{s.userName || "Unknown"}</p>
                  <p className="text-[10px] text-ha-text-secondary">{s.user_id?.substring(0, 8)}...</p>
                </div>
                <StatusBadge status={s.computedStatus || s.status} />
              </div>
              {s.computedStatus && s.computedStatus !== s.status && (
                <p className="text-[10px] text-orange-500 mb-1">DB: {s.status} → Computed: {s.computedStatus}</p>
              )}
              <div className="flex items-center gap-3 text-[11px] text-ha-text-secondary">
                <span>{s.plan || "—"}</span>
                <span>{s.created_at ? new Date(s.created_at).toLocaleDateString() : ""}</span>
                {s.stripe_subscription_id && (
                  <a href={`https://dashboard.stripe.com/subscriptions/${s.stripe_subscription_id}`} target="_blank" rel="noopener noreferrer" className="text-ha-primary flex items-center gap-0.5 ml-auto" data-testid={`link-stripe-${s.id}`}>
                    <ExternalLink className="w-3 h-3" /> Stripe
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {total > 50 && (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-full" data-testid="button-sub-prev">Previous</Button>
          <span className="text-[12px] text-ha-text-secondary">Page {page}</span>
          <Button variant="outline" size="sm" disabled={subs.length < 50} onClick={() => setPage(p => p + 1)} className="rounded-full" data-testid="button-sub-next">Next</Button>
        </div>
      )}
    </div>
  );
}

function SystemTab() {
  const [checks, setChecks] = useState<Record<string, any> | null>(null);
  const [matchStats, setMatchStats] = useState<any>(null);
  const [backfillStatus, setBackfillStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([
      adminFetch("/api/admin/portal/system-status").catch(() => null),
      adminFetch("/api/admin/portal/matches?page=1&limit=1").catch(() => null),
      adminFetch("/api/admin/portal/image-backfill-status").catch(() => null),
    ]).then(([sys, matches, backfill]) => {
      setChecks(sys);
      setMatchStats(matches?.stats || null);
      setBackfillStatus(backfill);
    }).finally(() => { setLoading(false); setRefreshing(false); });
  }

  useEffect(() => { load(); }, []);

  const labels: Record<string, { name: string; desc: string }> = {
    stripe: { name: "Stripe Payments", desc: "Payment processing" },
    placesApi: { name: "Google Places API", desc: "Location services" },
    ingestionScheduler: { name: "Import Automation", desc: "Automatic listing imports" },
    email: { name: "Email (Resend)", desc: "Email delivery" },
    pushNotifications: { name: "Push Notifications", desc: "Mobile alerts" },
    replitDb: { name: "Replit PostgreSQL", desc: "Primary database" },
    supabaseDb: { name: "Supabase Database", desc: "Auth & listings" },
  };

  const serviceIcons: Record<string, any> = {
    stripe: CreditCard,
    placesApi: Globe,
    ingestionScheduler: Radio,
    email: Mail,
    pushNotifications: Smartphone,
    replitDb: Database,
    supabaseDb: Layers,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[24px] font-bold text-ha-text">System</h1>
        <div className="flex items-center gap-2">
          <a href="/admin/pipeline-health"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors hover:opacity-80"
            style={{ background: "rgba(187,173,251,0.12)", color: "#7c5fc5" }}
            data-testid="link-pipeline-health">
            <Activity className="w-3.5 h-3.5" /> Pipeline Health
          </a>
          <button onClick={() => { setRefreshing(true); load(); }} className="w-9 h-9 rounded-full bg-ha-hover-bg flex items-center justify-center hover:bg-ha-divider" data-testid="button-refresh-system">
            <RefreshCw className={`w-4 h-4 text-ha-text-secondary ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {matchStats && (
        <div>
          <SectionHeader title="Delivery today" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard label="Emails" value={matchStats.emailsToday} icon={Mail} />
            <MetricCard label="Push" value={matchStats.pushesToday} icon={Smartphone} />
            <MetricCard label="Delivery failures (7d)" value={matchStats.emailFailuresWeek ?? matchStats.failuresWeek} icon={AlertTriangle} />
            <MetricCard label="Locked by paywall (7d)" value={matchStats.emailSkippedNoSubWeek ?? 0} icon={XCircle} />
          </div>
        </div>
      )}

      {backfillStatus && (
        <div>
          <SectionHeader title="Photo sync" />
          <div className={`${CARD} p-4 space-y-3`}>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-ha-text-secondary">Status</span>
              <StatusBadge status={backfillStatus.enabled ? "active" : "disabled"} />
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-ha-text-secondary">Currently running</span>
              <span className="font-medium text-ha-text">{backfillStatus.running ? "Yes" : "No"}</span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-ha-text-secondary">Batch size</span>
              <span className="font-medium text-ha-text">{backfillStatus.batchSize}</span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-ha-text-secondary">Photos synced total</span>
              <span className="font-medium text-ha-text">{backfillStatus.cumulativeUpdates}</span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-ha-text-secondary">Active sources</span>
              <span className="font-medium text-ha-text text-right max-w-[60%] truncate">{(backfillStatus.enabledSources || []).join(", ") || "—"}</span>
            </div>
            {backfillStatus.lastRun && (
              <>
                <div className="border-t border-ha-hover-bg pt-2 mt-2">
                  <p className="text-[12px] text-ha-text-secondary font-medium mb-1">Last sync</p>
                  <p className="text-[13px] text-ha-text">{new Date(backfillStatus.lastRun.timestamp).toLocaleString()}</p>
                  <p className="text-[11px] text-ha-text-secondary">Took {backfillStatus.lastRun.duration_ms}ms · {backfillStatus.lastRun.updated} updated · {backfillStatus.lastRun.failed} failed</p>
                </div>
              </>
            )}
          </div>

          {backfillStatus.recentRuns && backfillStatus.recentRuns.length > 0 && (
            <div className={`${CARD} mt-3 divide-y divide-ha-hover-bg`}>
              <div className="px-4 py-2">
                <p className="text-[12px] font-semibold text-ha-text-secondary uppercase tracking-wider">Recent sync history</p>
              </div>
              {backfillStatus.recentRuns.slice(0, 5).map((run: any, i: number) => (
                <div key={i} className="px-4 py-2.5 flex items-center justify-between text-[12px]">
                  <span className="text-ha-text-secondary">{new Date(run.started_at).toLocaleString()}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-ha-text font-medium">{run.updated}/{run.total}</span>
                    <StatusBadge status={run.status || (run.updated > 0 ? "success" : "warning")} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {backfillStatus.recoveryStats && (
            <div className={`${CARD} mt-3 p-4`}>
              <p className="text-[12px] font-semibold text-ha-text-secondary uppercase tracking-wider mb-2">Recovery stats</p>
              <div className="space-y-2 text-[13px]">
                {Object.entries(backfillStatus.recoveryStats).map(([key, val]: [string, any]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-ha-text-secondary">{key}</span>
                    <span className="font-medium text-ha-text">{typeof val === "object" ? JSON.stringify(val) : String(val)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {loading ? <LoadingState /> : checks ? (
        <div>
          <SectionHeader title="Service status" />
          <div className={`${CARD} divide-y divide-ha-hover-bg`}>
            {Object.entries(checks).map(([key, val]) => {
              const Icon = serviceIcons[key] || Settings;
              const info = labels[key] || { name: key, desc: "" };
              return (
                <div key={key} className="flex items-center gap-3 px-4 py-3.5" data-testid={`status-${key}`}>
                  <Icon className="w-5 h-5 text-ha-text flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-ha-text">{info.name}</p>
                    <p className="text-[11px] text-ha-text-secondary truncate">{val.message}</p>
                  </div>
                  <StatusBadge status={val.status} />
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <EmptyState title="Cannot load status" message="System status data is unavailable." onRetry={load} />
      )}
    </div>
  );
}

function AlertsTab() {
  const [activity, setActivity] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [testEmail, setTestEmail] = useState("");
  const [testUserId, setTestUserId] = useState("");
  const [testType, setTestType] = useState<"email" | "push">("email");
  const [sending, setSending] = useState(false);
  const [testSuccess, setTestSuccess] = useState<any>(null);
  const [testError, setTestError] = useState<any>(null);
  const [errorExpanded, setErrorExpanded] = useState(false);
  const [vapidDebug, setVapidDebug] = useState<any>(null);
  const [clearingPushSubs, setClearingPushSubs] = useState(false);
  const [clearResult, setClearResult] = useState<any>(null);
  const [resettingPush, setResettingPush] = useState(false);
  const [resetPushResult, setResetPushResult] = useState<any>(null);

  const [resendUserId, setResendUserId] = useState("");
  const [resending, setResending] = useState(false);
  const [resendResult, setResendResult] = useState<{ success: boolean; message: string } | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [previewUrl, setPreviewUrl] = useState("");

  function load() {
    setLoading(true);
    Promise.all([
      adminFetch("/api/admin/portal/alert-activity").catch(() => null),
      adminFetch("/api/admin/portal/email-diagnostics").catch(() => null),
    ]).then(([activityData, diag]) => {
      setActivity(activityData?.recentActivity || []);
      setStats(activityData?.stats || null);
      setDiagnostics(diag);
    }).finally(() => { setLoading(false); setRefreshing(false); });
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (testType === "push") {
      adminFetch("/api/admin/portal/vapid-debug").then(setVapidDebug).catch(() => {});
    }
  }, [testType]);

  useEffect(() => {
    if (previewOpen && !previewUrl) {
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (!session?.access_token) return;
        try {
          const { apiFetch } = await import("@/lib/api-base");
          const res = await apiFetch("/api/admin/portal/email-preview", {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (res.ok) {
            const html = await res.text();
            const blob = new Blob([html], { type: "text/html" });
            setPreviewUrl(URL.createObjectURL(blob));
          }
        } catch {}
      });
    }
  }, [previewOpen]);

  async function clearPushSubs() {
    setClearingPushSubs(true);
    setClearResult(null);
    try {
      const res = await adminFetch("/api/admin/portal/clear-push-subs", {
        method: "POST",
        body: JSON.stringify({ userId: testUserId || "" }),
      });
      setClearResult({ success: true, message: res.message, deleted: res.deleted });
      setTestError(null);
      setTestSuccess(null);
    } catch (err: any) {
      setClearResult({ success: false, message: err.message || "Failed to clear subscriptions" });
    }
    setClearingPushSubs(false);
  }

  async function resetPushSetup() {
    setResettingPush(true);
    setResetPushResult(null);
    setTestError(null);
    setTestSuccess(null);
    const steps: string[] = [];
    let browserOk = false;
    let serverOk = false;
    try {
      // 1. Browser side: unregister SW + unsubscribe push
      const browserResult = await resetPushBrowserSide();
      steps.push(`SW unregistered: ${browserResult.swsUnregistered}`);
      steps.push(`Push unsubscribed: ${browserResult.subUnsubscribed}`);
      if (browserResult.errors.length) steps.push(`Browser errors: ${browserResult.errors.join(", ")}`);
      browserOk = true;
    } catch (e: any) {
      steps.push(`Browser reset failed: ${e?.message}`);
    }
    try {
      // 2. Server side: clear DB push subscriptions for target user
      const res = await adminFetch("/api/admin/portal/clear-push-subs", {
        method: "POST",
        body: JSON.stringify({ userId: testUserId || "" }),
      });
      steps.push(`DB cleared: ${res.deleted} sub(s)`);
      serverOk = true;
    } catch (e: any) {
      steps.push(`Server clear failed: ${e?.message}`);
    }
    setResetPushResult({
      success: browserOk && serverOk,
      steps,
      message: browserOk && serverOk
        ? "Push fully reset. Re-enable push notifications in your account preferences to create a fresh subscription with the current VAPID key."
        : "Partial reset — check steps for errors.",
    });
    setResettingPush(false);
  }

  async function sendTest() {
    setSending(true);
    setTestSuccess(null);
    setTestError(null);
    setErrorExpanded(false);
    try {
      const body: any = { type: testType };
      if (testType === "email" && testEmail) body.email = testEmail;
      if (testType === "push") body.userId = testUserId || "";
      let res: any;
      try {
        res = await adminFetch("/api/admin/portal/test-alert", { method: "POST", body: JSON.stringify(body) });
      } catch (fetchErr: any) {
        const msg = fetchErr.message || "Unknown error";
        const is5xx = msg.startsWith("[5");
        const isDomain = !is5xx && msg.toLowerCase().includes("domain");
        const isKey = !is5xx && (msg.toLowerCase().includes("key") || msg.toLowerCase().includes("api"));
        setTestError({
          readable: isDomain
            ? "Domain not verified in Resend. Add and verify your sending domain in the Resend dashboard."
            : isKey
            ? "API key rejected. Check that RESEND_API_KEY is valid and has send permissions."
            : msg,
          technical: msg,
        });
        setSending(false);
        return;
      }
      if (res.success) {
        setTestSuccess(res);
      } else {
        const readable = res.message || res.error || "Send failed — provider rejected the request.";
        setTestError({ readable, technical: JSON.stringify(res, null, 2) });
      }
    } catch (err: any) {
      setTestError({ readable: err.message || "Unexpected error", technical: err.message || "Unknown error" });
    }
    setSending(false);
  }

  async function resendMatches() {
    if (!resendUserId) return;
    setResending(true);
    setResendResult(null);
    try {
      const res = await adminFetch(`/api/admin/portal/resend-matches/${resendUserId}`, { method: "POST" });
      setResendResult({ success: res.success, message: res.success ? `Resent ${res.resent} matches to user` : res.message || "Failed" });
    } catch (err: any) {
      setResendResult({ success: false, message: err.message });
    }
    setResending(false);
  }

  if (loading) return <LoadingState />;

  const isDomainsLimited = diagnostics?.domainsLimited === true;
  const diagStatusColor = diagnostics?.apiStatus === "operational" ? "#223546" : diagnostics?.apiStatus === "misconfigured" ? "#b45309" : "#e11d48";
  const diagStatusBg = diagnostics?.apiStatus === "operational" ? "#edfbf0" : diagnostics?.apiStatus === "misconfigured" ? "#fffbeb" : "#fff1f2";
  const diagStatusBorder = diagnostics?.apiStatus === "operational" ? "#bbf7d0" : diagnostics?.apiStatus === "misconfigured" ? "#fde68a" : "#fecdd3";

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold" style={{ color: "#111111" }}>Email Operations</h1>
          <p className="text-[13px] mt-0.5" style={{ color: "#888888" }}>Monitor, test and diagnose email delivery</p>
        </div>
        <button onClick={() => { setRefreshing(true); load(); }} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: "#f0f0f0" }} data-testid="button-refresh-alerts">
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} style={{ color: "#888" }} />
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard label="Emails today" value={stats.emailsToday} icon={Mail} />
          <MetricCard label="Push today" value={stats.pushToday} icon={Smartphone} />
          <MetricCard label="Delivery failures (7d)" value={stats.undelivered7d} icon={AlertTriangle} />
          <MetricCard label="Locked by paywall (7d)" value={stats.skippedNoSub7d ?? 0} icon={XCircle} />
        </div>
      )}

      {/* Email health diagnostics */}
      {diagnostics && (
        <div>
          <SectionHeader title="Email health" />
          <div className="bg-white rounded-[20px] overflow-hidden" style={{ border: "1px solid #eeebf3" }}>
            {/* API status banner */}
            <div className="px-5 py-4 flex items-center gap-3" style={{ backgroundColor: diagStatusBg, borderBottom: `1px solid ${diagStatusBorder}` }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${diagStatusColor}20` }}>
                {diagnostics.apiStatus === "operational" ? <Wifi className="w-4 h-4" style={{ color: diagStatusColor }} /> : <WifiOff className="w-4 h-4" style={{ color: diagStatusColor }} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold" style={{ color: diagStatusColor }}>
                  {diagnostics.apiStatus === "operational" ? "Email sending operational" : diagnostics.apiStatus === "misconfigured" ? "Resend API misconfigured" : "Resend API not configured"}
                </p>
                {diagnostics.apiError && <p className="text-[11px] mt-0.5 leading-snug" style={{ color: diagStatusColor }}>{diagnostics.apiError}</p>}
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold border" style={{ backgroundColor: diagStatusBg, color: diagStatusColor, borderColor: diagStatusBorder }}>
                {diagnostics.apiStatus}
              </span>
            </div>

            {/* Domain diagnostics limited notice */}
            {isDomainsLimited && (
              <div className="px-5 py-3 flex items-start gap-3" style={{ backgroundColor: "#fffbeb", borderBottom: "1px solid #fde68a" }}>
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#b45309" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold" style={{ color: "#b45309" }}>Domain diagnostics unavailable</p>
                  <p className="text-[11px] mt-0.5 leading-snug" style={{ color: "#92400e" }}>
                    The Resend API key is restricted to sending emails only. Email delivery is unaffected.
                    To enable domain diagnostics, use a Resend key with domain read permissions.
                  </p>
                </div>
              </div>
            )}

            {/* Config rows */}
            {[
              { label: "From address", value: diagnostics.fromEmail || "Not configured", mono: true },
              { label: "Reply-to", value: diagnostics.replyTo || "Not set" },
              { label: "Emails sent today", value: String(diagnostics.totalSentToday ?? "—") },
              { label: "Emails sent (7d)", value: String(diagnostics.totalSent7d ?? "—") },
              {
                label: "Delivery rate (7d)",
                value: diagnostics.deliveryRate7d !== null && diagnostics.deliveryRate7d !== undefined
                  ? `${diagnostics.deliveryRate7d}%`
                  : "—",
                valueColor: diagnostics.deliveryRate7d !== null && diagnostics.deliveryRate7d < 80 ? "#e11d48" : "#223546",
              },
              { label: "Queue depth", value: String(diagnostics.queueDepth ?? 0), valueColor: (diagnostics.queueDepth ?? 0) > 0 ? "#b45309" : undefined, note: diagnostics.queueDepth > 0 ? "undelivered to active subscribers" : undefined },
              { label: "Last successful send", value: diagnostics.lastSuccessfulSend ? new Date(diagnostics.lastSuccessfulSend).toLocaleString() : "No data" },
            ].map(({ label, value, mono, valueColor, note }, i, arr) => (
              <div key={label} className="flex items-start gap-3 px-5 py-3.5" style={{ borderBottom: i < arr.length - 1 ? "1px solid #f5f5f7" : undefined }} data-testid={`diag-${label.toLowerCase().replace(/\s/g, "-")}`}>
                <span className="text-[13px] flex-1" style={{ color: "#888888" }}>{label}</span>
                <div className="text-right">
                  <span className={`text-[13px] font-semibold${mono ? " font-mono" : ""}`} style={{ color: valueColor || "#111111" }}>{value}</span>
                  {note && <p className="text-[11px]" style={{ color: "#aaaaaa" }}>{note}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Test email / push */}
      <div>
        <SectionHeader title="Send test" />
        <div className="bg-white rounded-[20px] p-5" style={{ border: "1px solid #eeebf3" }}>
          {/* Type selector */}
          <div className="flex gap-2 mb-4">
            {(["email", "push"] as const).map(t => (
              <button
                key={t}
                onClick={() => { setTestType(t); setTestSuccess(null); setTestError(null); }}
                className="px-4 py-1.5 rounded-full text-[12px] font-semibold transition-all"
                style={testType === t
                  ? { backgroundColor: "#111111", color: "#ffffff" }
                  : { backgroundColor: "#f5f5f5", color: "#888888", border: "1px solid #e8e8e8" }
                }
                data-testid={`test-type-${t}`}
              >
                {t === "email" ? "✉ Email" : "🔔 Push"}
              </button>
            ))}
          </div>

          {/* VAPID fingerprint (push only) */}
          {testType === "push" && vapidDebug && (
            <div className="mb-4 px-4 py-3 rounded-[12px]" style={{ backgroundColor: "#f7f7f7", border: "1px solid #eeebf3" }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: "#aaaaaa" }}>VAPID Key Status</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={vapidDebug.initialized ? { backgroundColor: "#dcfce7", color: "#15803d" } : { backgroundColor: "#fee2e2", color: "#dc2626" }}>
                  {vapidDebug.initialized ? "Initialized" : "NOT INITIALIZED"}
                </span>
              </div>
              <div className="space-y-1">
                {[
                  { label: "Backend key prefix", value: vapidDebug.backendPublicKeyPrefix || "NOT SET" },
                  { label: "Backend private key", value: vapidDebug.backendPrivateKeyConfigured ? "set" : "MISSING" },
                  { label: "VAPID subject", value: vapidDebug.subject || "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex gap-2 text-[12px]">
                    <span className="w-36 flex-shrink-0" style={{ color: "#888888" }}>{label}</span>
                    <span className="font-mono text-[11px]" style={{ color: "#111111" }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Target input */}
          <div className="mb-4">
            <label className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-1.5 block" style={{ color: "#aaaaaa" }}>
              {testType === "email" ? "Recipient email" : "Target user (UUID or email)"}
            </label>
            {testType === "email" ? (
              <input
                placeholder="Leave blank to send to your admin email"
                value={testEmail}
                onChange={e => setTestEmail(e.target.value)}
                className="w-full h-11 px-4 rounded-[12px] text-[13px] focus:outline-none focus:ring-2"
                style={{ backgroundColor: "#f7f7f7", color: "#111111", border: "1px solid #eeebf3", focusRingColor: "#bbadfb" }}
                data-testid="input-test-email"
                disabled={sending}
              />
            ) : (
              <input
                placeholder="Leave blank for your own account · or paste a UUID / email"
                value={testUserId}
                onChange={e => setTestUserId(e.target.value)}
                className="w-full h-11 px-4 rounded-[12px] text-[13px] focus:outline-none focus:ring-2"
                style={{ backgroundColor: "#f7f7f7", color: "#111111", border: "1px solid #eeebf3" }}
                data-testid="input-test-userid"
                disabled={sending}
              />
            )}
          </div>

          {/* Push sub management (push only) */}
          {testType === "push" && (
            <div className="mb-4 space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={clearPushSubs}
                  disabled={clearingPushSubs || resettingPush}
                  className="px-4 py-2 rounded-full text-[12px] font-semibold transition-all disabled:opacity-50 flex items-center gap-1.5"
                  style={{ backgroundColor: "#fff1f2", color: "#e11d48", border: "1px solid #fecdd3" }}
                  data-testid="button-clear-push-subs"
                >
                  {clearingPushSubs ? <><Loader2 className="w-3 h-3 animate-spin" /> Clearing…</> : "Clear DB subscriptions"}
                </button>
                <button
                  onClick={resetPushSetup}
                  disabled={resettingPush || clearingPushSubs}
                  className="px-4 py-2 rounded-full text-[12px] font-semibold transition-all disabled:opacity-50 flex items-center gap-1.5"
                  style={{ backgroundColor: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}
                  data-testid="button-reset-push-setup"
                >
                  {resettingPush ? <><Loader2 className="w-3 h-3 animate-spin" /> Resetting…</> : "↺ Full push reset (this browser)"}
                </button>
              </div>
              {clearResult && !resetPushResult && (
                <p className="text-[12px]" style={{ color: clearResult.success ? "#15803d" : "#e11d48" }}>
                  {clearResult.success
                    ? `✓ ${clearResult.deleted > 0 ? `Removed ${clearResult.deleted} sub(s) from DB. Re-enable push to re-subscribe.` : "No DB subs found."}`
                    : `✗ ${clearResult.message}`}
                </p>
              )}
              {resetPushResult && (
                <div className="rounded-[12px] p-3 text-[12px] space-y-1" style={{ backgroundColor: resetPushResult.success ? "#f0fdf4" : "#fff7ed", border: `1px solid ${resetPushResult.success ? "#bbf7d0" : "#fed7aa"}` }}>
                  <p className="font-semibold" style={{ color: resetPushResult.success ? "#15803d" : "#c2410c" }}>
                    {resetPushResult.success ? "✓ Push fully reset" : "⚠ Partial reset"}
                  </p>
                  <p style={{ color: "#555" }}>{resetPushResult.message}</p>
                  <ul className="mt-1 space-y-0.5" style={{ color: "#777" }}>
                    {resetPushResult.steps.map((s: string, i: number) => <li key={i}>· {s}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Send button */}
          <button
            onClick={sendTest}
            disabled={sending}
            className="w-full h-11 rounded-full font-bold text-[14px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
            style={{ backgroundColor: sending ? "#888888" : "#85fb8c", color: "#111111" }}
            data-testid="button-send-test"
          >
            {sending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
            ) : (
              <><Send className="w-4 h-4" /> Send test {testType === "email" ? "email" : "push"}</>
            )}
          </button>

          {/* Success state */}
          {testSuccess && (
            <div className="mt-4 rounded-[16px] p-4" style={{ backgroundColor: "#edfbf0", border: "1px solid #bbf7d0" }} data-testid="panel-test-success">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: "#223546" }} />
                <p className="text-[14px] font-bold" style={{ color: "#223546" }}>
                  {testSuccess.type === "push" ? `Push delivered (${testSuccess.totalSent ?? (testSuccess.web?.sent ?? 0) + (testSuccess.expo?.sent ?? 0)} sent)` : "Delivery accepted"}
                </p>
              </div>
              <div className="space-y-1.5">
                {testSuccess.type === "push" ? (
                  <>
                    {[
                      { label: "Target user", value: testSuccess.targetUserId ? testSuccess.targetUserId.substring(0, 8) + "..." : "—", mono: true },
                      { label: "Web push", value: `${testSuccess.web?.sent ?? 0} sent, ${testSuccess.web?.failed ?? 0} failed, ${testSuccess.web?.removed ?? 0} removed` },
                      { label: "Expo push", value: `${testSuccess.expo?.sent ?? 0} sent, ${testSuccess.expo?.failed ?? 0} failed` },
                      { label: "Web subs", value: String(testSuccess.webSubs ?? "—") },
                      { label: "Expo tokens", value: String(testSuccess.expoTokens ?? "—") },
                    ].map(({ label, value, mono }) => (
                      <div key={label} className="flex gap-2 text-[12px]">
                        <span className="w-24 flex-shrink-0 font-semibold" style={{ color: "#223546" }}>{label}</span>
                        <span className={mono ? "font-mono text-[11px]" : ""} style={{ color: "#111111" }}>{value}</span>
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    {[
                      { label: "Sent to", value: testSuccess.sentTo },
                      { label: "From", value: testSuccess.from },
                      { label: "Timestamp", value: testSuccess.timestamp ? new Date(testSuccess.timestamp).toLocaleString() : "—" },
                      { label: "Resend ID", value: testSuccess.resendId || "—", mono: true },
                    ].map(({ label, value, mono }: { label: string; value?: string; mono?: boolean }) => (
                      <div key={label} className="flex gap-2 text-[12px]">
                        <span className="w-24 flex-shrink-0 font-semibold" style={{ color: "#223546" }}>{label}</span>
                        <span className={mono ? "font-mono text-[11px]" : ""} style={{ color: "#111111" }}>{value}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
              <button
                onClick={() => { setTestSuccess(null); setTestError(null); }}
                className="mt-3 text-[12px] font-semibold"
                style={{ color: "#223546" }}
                data-testid="button-test-dismiss"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Error state */}
          {testError && (() => {
            let parsed: any = null;
            try { parsed = JSON.parse(testError.technical); } catch {}
            const diagnosis = parsed?.diagnosis;
            const repairNeeded = diagnosis?.repairNeeded;
            const repairInstructions = diagnosis?.repairInstructions;
            return (
              <div className="mt-4 rounded-[16px] p-4" style={{ backgroundColor: "#fff1f2", border: "1px solid #fecdd3" }} data-testid="panel-test-error">
                <div className="flex items-start gap-2 mb-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#e11d48" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold" style={{ color: "#e11d48" }}>Send failed</p>
                    <p className="text-[13px] mt-0.5 leading-snug" style={{ color: "#be123c" }}>{testError.readable}</p>
                  </div>
                </div>
                {repairNeeded && repairInstructions && (
                  <div className="mt-3 px-3 py-2.5 rounded-[10px]" style={{ backgroundColor: "#fef3c7", border: "1px solid #fde68a" }}>
                    <p className="text-[11px] font-bold uppercase tracking-[0.05em] mb-1" style={{ color: "#92400e" }}>Action required</p>
                    <p className="text-[12px] leading-snug" style={{ color: "#78350f" }}>{repairInstructions}</p>
                    {testType === "push" && (
                      <button
                        onClick={clearPushSubs}
                        disabled={clearingPushSubs}
                        className="mt-2 px-3 py-1 rounded-full text-[11px] font-bold transition-all disabled:opacity-50"
                        style={{ backgroundColor: "#92400e", color: "#ffffff" }}
                        data-testid="button-repair-clear-subs"
                      >
                        {clearingPushSubs ? "Clearing…" : "Clear stale subscription now"}
                      </button>
                    )}
                  </div>
                )}
                {diagnosis && !repairNeeded && (
                  <div className="mt-2 text-[12px]" style={{ color: "#9f1239" }}>
                    {diagnosis.statusCode && <span className="font-mono mr-2">{diagnosis.statusCode}</span>}
                    {diagnosis.endpoint && <span>{diagnosis.endpoint}</span>}
                    {diagnosis.body && <span className="ml-2 font-mono text-[11px]">{diagnosis.body}</span>}
                  </div>
                )}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={sendTest}
                    disabled={sending}
                    className="px-4 py-1.5 rounded-full text-[12px] font-bold transition-all disabled:opacity-50"
                    style={{ backgroundColor: "#e11d48", color: "#ffffff" }}
                    data-testid="button-test-retry"
                  >
                    {sending ? "Retrying…" : "Retry"}
                  </button>
                  <button
                    onClick={() => setErrorExpanded(x => !x)}
                    className="px-4 py-1.5 rounded-full text-[12px] font-semibold"
                    style={{ backgroundColor: "#ffe4e6", color: "#e11d48", border: "1px solid #fecdd3" }}
                    data-testid="button-test-expand-error"
                  >
                    {errorExpanded ? "Hide details" : "Technical details"}
                  </button>
                  <button onClick={() => { setTestSuccess(null); setTestError(null); setClearResult(null); }} className="ml-auto" style={{ color: "#e11d48" }} data-testid="button-test-clear">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {errorExpanded && (
                  <pre className="mt-3 text-[11px] p-3 rounded-[10px] overflow-x-auto leading-relaxed" style={{ backgroundColor: "#ffe4e6", color: "#9f1239" }}>
                    {testError.technical}
                  </pre>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Email preview */}
      <div>
        <SectionHeader
          title="Email preview"
          action={{ label: previewOpen ? "Close preview" : "Open preview", onClick: () => setPreviewOpen(x => !x) }}
        />
        {previewOpen && (
          <div className="bg-white rounded-[20px] overflow-hidden" style={{ border: "1px solid #eeebf3" }}>
            <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid #f5f5f7" }}>
              {(["desktop", "mobile"] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setPreviewMode(m)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all"
                  style={previewMode === m
                    ? { backgroundColor: "#111111", color: "#ffffff" }
                    : { backgroundColor: "#f5f5f5", color: "#888888" }
                  }
                  data-testid={`preview-${m}`}
                >
                  {m === "desktop" ? <Monitor className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5" />}
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
              <span className="ml-auto text-[11px]" style={{ color: "#aaaaaa" }}>Live render of the actual email template</span>
            </div>
            <div className="flex items-center justify-center p-4" style={{ backgroundColor: "rgb(var(--ha-bg))" }}>
              {previewUrl ? (
                <iframe
                  src={previewUrl}
                  title="Email preview"
                  style={{
                    width: previewMode === "mobile" ? "375px" : "100%",
                    maxWidth: previewMode === "desktop" ? "600px" : "375px",
                    height: "600px",
                    border: "none",
                    borderRadius: "12px",
                    boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
                    backgroundColor: "#ffffff",
                    transition: "width 0.3s",
                  }}
                  data-testid="iframe-email-preview"
                />
              ) : (
                <div className="flex items-center gap-2 py-12" style={{ color: "#888888" }}>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-[13px]">Loading preview…</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Resend to user */}
      <div>
        <SectionHeader title="Resend matches to user" />
        <div className="bg-white rounded-[20px] p-5" style={{ border: "1px solid #eeebf3" }}>
          <p className="text-[13px] mb-4" style={{ color: "#888888" }}>Re-deliver undelivered match alerts for a specific user ID (requires active subscription).</p>
          <div className="flex gap-2">
            <input
              placeholder="User UUID"
              value={resendUserId}
              onChange={e => setResendUserId(e.target.value)}
              className="flex-1 h-11 px-4 rounded-[12px] text-[13px] focus:outline-none"
              style={{ backgroundColor: "#f7f7f7", color: "#111111", border: "1px solid #eeebf3" }}
              data-testid="input-resend-userid"
              disabled={resending}
            />
            <button
              onClick={resendMatches}
              disabled={resending || !resendUserId}
              className="h-11 px-5 rounded-full font-bold text-[13px] flex items-center gap-1.5 transition-all disabled:opacity-50"
              style={{ backgroundColor: "#111111", color: "#ffffff" }}
              data-testid="button-resend"
            >
              <RotateCw className={`w-3.5 h-3.5 ${resending ? "animate-spin" : ""}`} />
              {resending ? "Sending…" : "Resend"}
            </button>
          </div>
          {resendResult && (
            <div className="mt-3 flex items-center gap-2 text-[13px]" data-testid="text-resend-result">
              {resendResult.success
                ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: "#223546" }} />
                : <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: "#e11d48" }} />}
              <span style={{ color: resendResult.success ? "#223546" : "#e11d48" }}>{resendResult.message}</span>
            </div>
          )}
        </div>
      </div>

      {/* Recent activity */}
      <div>
        <SectionHeader title="Recent delivery activity" />
        <div className="bg-white rounded-[20px] overflow-hidden" style={{ border: "1px solid #eeebf3" }}>
          {activity.length === 0 ? (
            <div className="px-4 py-10 text-center text-[13px]" style={{ color: "#888888" }}>No delivery activity recorded yet</div>
          ) : activity.slice(0, 30).map((a, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: i < Math.min(activity.length, 30) - 1 ? "1px solid #f5f5f7" : undefined }} data-testid={`activity-row-${i}`}>
              <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: a.channel === "email" ? "rgba(187,173,251,0.12)" : "rgba(133,251,140,0.15)" }}>
                {a.channel === "email"
                  ? <Mail className="w-3.5 h-3.5" style={{ color: "#7c5fc5" }} />
                  : <Smartphone className="w-3.5 h-3.5" style={{ color: "#223546" }} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold truncate" style={{ color: "#111111" }}>{a.title}</p>
                <p className="text-[11px] truncate" style={{ color: "#888888" }}>{a.email || (a.userId ? a.userId.substring(0, 12) + "…" : "—")}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[11px]" style={{ color: "#aaaaaa" }}>
                  {a.emailSentAt ? new Date(a.emailSentAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                    : a.pushSentAt ? new Date(a.pushSentAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                    : "—"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

function SettingsTab() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    adminFetch("/api/admin/portal/settings")
      .then(d => setSettings(d.settings || {}))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function saveSettings() {
    setSaving(true);
    setSaved(false);
    try {
      await adminFetch("/api/admin/portal/settings", {
        method: "PUT",
        body: JSON.stringify({ settings }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {}
    setSaving(false);
  }

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <h1 className="text-[24px] font-bold text-ha-text">Revenue Settings</h1>

      <div className={`${CARD} p-5`}>
        <h3 className="text-[15px] font-semibold text-ha-text mb-1">Paywall behavior</h3>
        <p className="text-[12px] text-ha-text-secondary mb-4">Control what free/expired users see in the app.</p>

        <div className="space-y-4">
          <div>
            <label className="text-[12px] font-medium text-ha-text-secondary mb-1.5 block">Free matches limit</label>
            <p className="text-[11px] text-ha-text-secondary mb-1.5">Number of matches a free user can see before the paywall appears.</p>
            <div className="flex gap-2">
              {["0", "1", "3", "5", "10"].map(v => (
                <button key={v} onClick={() => setSettings(s => ({ ...s, free_matches_limit: v }))} className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors ${settings.free_matches_limit === v ? "bg-ha-text text-white" : "bg-white text-ha-text-secondary border border-ha-divider"}`} data-testid={`setting-limit-${v}`}>
                  {v === "0" ? "None" : v}
                </button>
              ))}
              <input
                type="number"
                value={settings.free_matches_limit || "3"}
                onChange={e => setSettings(s => ({ ...s, free_matches_limit: e.target.value }))}
                className="w-16 h-8 px-3 rounded-lg bg-ha-hover-bg text-[13px] text-center focus:outline-none"
                min="0"
                data-testid="input-free-limit"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-ha-hover-bg">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-[12px] font-medium text-ha-text-secondary block">Show blurred locked matches</label>
                <p className="text-[11px] text-ha-text-secondary">When enabled, free users see blurred match previews behind the paywall.</p>
              </div>
              <button onClick={() => setSettings(s => ({ ...s, show_blurred_locked: s.show_blurred_locked === "true" ? "false" : "true" }))} data-testid="toggle-blurred">
                {settings.show_blurred_locked === "true"
                  ? <ToggleRight className="w-8 h-8 text-ha-primary" />
                  : <ToggleLeft className="w-8 h-8 text-ha-border-input" />
                }
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={`${CARD} p-5`}>
        <h3 className="text-[15px] font-semibold text-ha-text mb-1">Current values</h3>
        <div className="space-y-2 mt-3">
          {Object.entries(settings).map(([key, value]) => (
            <div key={key} className="flex justify-between text-[13px]">
              <span className="text-ha-text-secondary font-mono text-[12px]">{key}</span>
              <span className="font-medium text-ha-text">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button size="sm" onClick={saveSettings} disabled={saving} className="rounded-full bg-ha-primary hover:bg-ha-primary/90 text-white" data-testid="button-save-settings">
          <Save className="w-3.5 h-3.5 mr-1" /> {saving ? "Saving..." : "Save settings"}
        </Button>
        {saved && <span className="text-[12px] text-emerald-600" data-testid="text-settings-saved">Settings saved</span>}
      </div>
    </div>
  );
}

interface NotifStatus { push: boolean; email: boolean; inApp: boolean; emailError?: string | null; alreadyNotified?: boolean; }

interface SupportMessage {
  id: number;
  ticket_id: number;
  sender_type: "user" | "admin" | "system";
  message: string;
  display_body?: string;
  original_body?: string;
  translated?: boolean;
  translation_status?: string;
  original_language?: string;
  faq_title?: string;
  faq_url?: string;
  created_at: string;
}

function AdminMessageBubble({ msg, isUser }: { msg: SupportMessage; isUser: boolean }) {
  const [showOriginal, setShowOriginal] = useState(false);
  const bodyToShow = showOriginal
    ? (msg.original_body || msg.message)
    : (msg.display_body || msg.message);
  const canToggle = msg.translated && msg.original_body && msg.original_body !== bodyToShow;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mr-1.5 self-end mb-4" style={{ backgroundColor: "#ede7ff" }}>
          <span className="text-[8px] font-bold" style={{ color: "#7c5cbf" }}>HA</span>
        </div>
      )}
      <div className="max-w-[80%]">
        <div
          className="px-3 py-2 rounded-[14px] text-[12px] leading-relaxed"
          style={isUser
            ? { backgroundColor: "#f0fdf4", color: "#111", borderBottomRightRadius: "4px" }
            : { backgroundColor: "#ffffff", color: "#111", border: "1px solid #eeeeee", borderBottomLeftRadius: "4px" }
          }
        >
          {bodyToShow}
        </div>
        {msg.faq_title && msg.faq_url && (
          <a href={msg.faq_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 mt-1 px-3 py-1.5 rounded-[10px] text-[11px]" style={{ backgroundColor: "#f9f8ff", border: "1px solid #ede7ff", color: "#7c5cbf", fontWeight: 600 }}>
            <BookOpen className="w-3 h-3 flex-shrink-0" />
            {msg.faq_title}
            <ExternalLink className="w-3 h-3 ml-auto flex-shrink-0" />
          </a>
        )}
        {msg.translated && (
          <div className={`flex items-center gap-2 mt-0.5 ${isUser ? "justify-end" : "justify-start"}`}>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#f0ecff", color: "#8b68e0" }}>
              Automatisch vertaald
            </span>
            {canToggle && (
              <button
                onClick={() => setShowOriginal(v => !v)}
                className="text-[10px] font-medium"
                style={{ color: "#bbb" }}
              >
                {showOriginal ? "Vertaling bekijken" : "Origineel bekijken"}
              </button>
            )}
          </div>
        )}
        {msg.translation_status === "failed" && (
          <p className={`text-[10px] mt-0.5 ${isUser ? "text-right" : "text-left"}`} style={{ color: "#f59e0b" }}>
            Vertaling niet beschikbaar
          </p>
        )}
        <p className={`text-[10px] mt-0.5 ${isUser ? "text-right" : "text-left"}`} style={{ color: "#ccc" }}>
          {new Date(msg.created_at).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}

const ADMIN_FAQ_ITEMS = [
  { id: "how-it-works",        title: "Hoe werkt HousAlert?",                url: "https://www.housalert.com/faq#hoe-werkt-housalert" },
  { id: "no-notifications",    title: "Ik ontvang geen meldingen",           url: "https://www.housalert.com/faq#meldingen-ontvangen" },
  { id: "edit-profile",        title: "Hoe pas ik mijn zoekprofiel aan?",    url: "https://www.housalert.com/faq#zoekprofiel-aanpassen" },
  { id: "subscription-cancel", title: "Hoe zeg ik mijn abonnement op?",      url: "https://www.housalert.com/faq#abonnement-opzeggen" },
  { id: "subscription-cost",   title: "Wat kost HousAlert?",                 url: "https://www.housalert.com/faq#abonnement-kosten" },
  { id: "payment-failed",      title: "Mijn betaling is mislukt",            url: "https://www.housalert.com/faq#betaling-mislukt" },
  { id: "tech-app-crash",      title: "De app werkt niet of crasht",         url: "https://www.housalert.com/faq#app-werkt-niet" },
  { id: "matches-not-showing", title: "Ik zie geen matches",                 url: "https://www.housalert.com/faq#geen-matches" },
  { id: "email-push-settings", title: "E-mail en push-meldingen instellen",  url: "https://www.housalert.com/faq#meldingen-instellen" },
  { id: "account-delete",      title: "Hoe verwijder ik mijn account?",      url: "https://www.housalert.com/faq#account-verwijderen" },
];

function SupportTab() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [notifResults, setNotifResults] = useState<Record<number, NotifStatus>>({});
  const [threads, setThreads] = useState<Record<number, SupportMessage[]>>({});
  const [loadingThread, setLoadingThread] = useState<Record<number, boolean>>({});
  const [replyText, setReplyText] = useState<Record<number, string>>({});
  const [selectedFaqId, setSelectedFaqId] = useState<Record<number, string>>({});
  const [sendingReply, setSendingReply] = useState<Record<number, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      const d = await adminFetch(`/api/admin/support/tickets${params}`);
      setTickets(d.tickets || []);
      setTotal(d.total ?? 0);
    } catch (err: any) {
      console.error("[support] Admin fetch error:", err.message);
      setFetchError(err.message === "ACCESS_DENIED" ? "Geen toegang tot support tickets." : "Kon tickets niet laden. Probeer opnieuw.");
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (expanded !== null && !threads[expanded] && !loadingThread[expanded]) {
      loadThread(expanded);
    }
  }, [expanded]);

  async function loadThread(id: number) {
    setLoadingThread(prev => ({ ...prev, [id]: true }));
    try {
      const data = await adminFetch(`/api/admin/support/tickets/${id}/messages`);
      setThreads(prev => ({ ...prev, [id]: data.messages || [] }));
    } catch {}
    setLoadingThread(prev => ({ ...prev, [id]: false }));
  }

  async function sendAdminReply(ticketId: number) {
    const text = (replyText[ticketId] || "").trim();
    const faqId = selectedFaqId[ticketId] || "";
    const faq = ADMIN_FAQ_ITEMS.find(f => f.id === faqId);
    if (!text && !faq) return;
    setSendingReply(prev => ({ ...prev, [ticketId]: true }));
    try {
      const data = await adminFetch(`/api/admin/support/tickets/${ticketId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, faq_title: faq?.title, faq_url: faq?.url }),
      });
      if (data.message) {
        setThreads(prev => ({ ...prev, [ticketId]: [...(prev[ticketId] || []), data.message] }));
      }
      if (data.new_status) {
        setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: data.new_status } : t));
      }
      setReplyText(prev => ({ ...prev, [ticketId]: "" }));
      setSelectedFaqId(prev => ({ ...prev, [ticketId]: "" }));
    } catch {}
    setSendingReply(prev => ({ ...prev, [ticketId]: false }));
  }

  async function updateStatus(id: number, status: string) {
    setUpdatingId(id);
    try {
      const result = await adminFetch(`/api/admin/support/tickets/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setTickets(t => t.map(ticket =>
        ticket.id === id
          ? { ...ticket, status, resolved_notified_at: (result?.notif?.inApp || result?.notif?.push || result?.notif?.email) ? new Date().toISOString() : ticket.resolved_notified_at }
          : ticket
      ));
      if (result?.notif && status === "resolved") {
        setNotifResults(prev => ({ ...prev, [id]: result.notif }));
      }
    } catch {}
    setUpdatingId(null);
  }

  const statusColors: Record<string, { bg: string; text: string; border: string }> = {
    open:        { bg: "#fff7ed", text: "#c2410c", border: "#fed7aa" },
    in_progress: { bg: "#f3f0ff", text: "#7c5cbf", border: "#ddd6fe" },
    resolved:    { bg: "#85fb8c", text: "#223546", border: "#223546" },
    closed:      { bg: "#f5f5f7", text: "#888888", border: "#e0e0e0" },
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-7 h-7 animate-spin" style={{ color: "#bbadfb" }} /></div>;

  if (fetchError) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <p className="text-[14px] font-medium text-center" style={{ color: "#e11d48" }}>{fetchError}</p>
      <button onClick={load} className="px-4 py-2 rounded-full text-[13px] font-semibold" style={{ backgroundColor: "#bbadfb", color: "#ffffff" }} data-testid="button-retry-support">
        Opnieuw proberen
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[22px] font-bold" style={{ color: "#111111" }}>Support tickets</h2>
          <p className="text-[13px] mt-0.5" style={{ color: "#888888" }}>{total} ticket{total !== 1 ? "s" : ""} in total</p>
        </div>
        <button onClick={load} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: "#f0f0f0" }} data-testid="button-refresh-support">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} style={{ color: "#888" }} />
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[
          { value: "all",         label: "All" },
          { value: "open",        label: "Open" },
          { value: "in_progress", label: "In behandeling" },
          { value: "resolved",    label: "Resolved" },
          { value: "closed",      label: "Closed" },
        ].map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setStatusFilter(value)}
            className="px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-all"
            style={statusFilter === value
              ? { backgroundColor: "#bbadfb", color: "#ffffff", borderColor: "#bbadfb" }
              : { backgroundColor: "#ffffff", color: "#666666", borderColor: "#eeebf3" }
            }
            data-testid={`filter-${value}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tickets.length === 0 ? (
        <div className={`${CARD} p-10 flex flex-col items-center gap-2`}>
          <MessageCircle className="w-8 h-8" style={{ color: "#cccccc" }} />
          <p className="text-[14px] font-medium" style={{ color: "#888888" }}>No tickets yet</p>
        </div>
      ) : (
        <div className={`${CARD} divide-y divide-ha-hover-bg`}>
          {tickets.map((ticket) => {
            const sc = statusColors[ticket.status] || statusColors.open;
            const isExpanded = expanded === ticket.id;
            return (
              <div key={ticket.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold border"
                        style={{ backgroundColor: sc.bg, color: sc.text, borderColor: sc.border }}
                      >
                        {ticket.status}
                      </span>
                      {ticket.has_unread_admin_reply && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border" style={{ backgroundColor: "#f3f0ff", color: "#7c5cbf", borderColor: "#ddd6fe" }}>
                          Unread reply
                        </span>
                      )}
                      {ticket.resolved_notified_at && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border" style={{ backgroundColor: "#85fb8c", color: "#223546", borderColor: "#223546" }}>
                          ✓ Notified
                        </span>
                      )}
                      <span className="text-[11px]" style={{ color: "#aaaaaa" }}>
                        #{ticket.id} · {new Date(ticket.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-[14px] font-bold truncate" style={{ color: "#111111" }}>{ticket.subject}</p>
                    <p className="text-[12px] mt-0.5" style={{ color: "#888888" }}>
                      {ticket.email || "Anonymous"}
                    </p>
                    {isExpanded && (
                      <div className="mt-3 space-y-3">

                        {/* ── Thread messages ── */}
                        <div className="rounded-[14px] overflow-hidden" style={{ border: "1px solid #ece7ef" }}>
                          {loadingThread[ticket.id] ? (
                            <div className="flex items-center justify-center py-6">
                              <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#bbadfb" }} />
                            </div>
                          ) : (threads[ticket.id] || []).length === 0 ? (
                            <p className="text-[12px] text-center py-4" style={{ color: "#aaa" }}>Geen berichten geladen.</p>
                          ) : (
                            <div className="flex flex-col gap-0 max-h-72 overflow-y-auto p-3 space-y-2" style={{ backgroundColor: "#faf9fc" }}>
                              {(threads[ticket.id] || []).map(msg => {
                                if (msg.sender_type === "system") {
                                  return (
                                    <div key={msg.id} className="flex justify-center">
                                      <span className="text-[10px] italic px-2 py-0.5 rounded-full" style={{ color: "#aaa", backgroundColor: "#f0f0f0" }}>{msg.message}</span>
                                    </div>
                                  );
                                }
                                const isUser = msg.sender_type === "user";
                                return (
                                  <AdminMessageBubble key={msg.id} msg={msg} isUser={isUser} />
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* ── Reply composer ── */}
                        {ticket.status !== "closed" && (
                          <div className="rounded-[14px] p-3 space-y-2" style={{ backgroundColor: "#f9f8ff", border: "1px solid #ede7ff" }}>
                            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "#7c5cbf" }}>Stuur antwoord</p>
                            <textarea
                              placeholder="Schrijf een antwoord..."
                              value={replyText[ticket.id] || ""}
                              onChange={e => setReplyText(prev => ({ ...prev, [ticket.id]: e.target.value.slice(0, 2000) }))}
                              rows={3}
                              className="w-full px-3 py-2 rounded-[10px] text-[12px] resize-none"
                              style={{ backgroundColor: "#ffffff", border: "1px solid #ddd6fe", color: "#111111", outline: "none" }}
                              data-testid={`input-admin-reply-${ticket.id}`}
                            />
                            <div className="flex items-center gap-2">
                              <select
                                value={selectedFaqId[ticket.id] || ""}
                                onChange={e => setSelectedFaqId(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                                className="flex-1 px-2 py-1.5 rounded-[8px] text-[11px]"
                                style={{ backgroundColor: "#ffffff", border: "1px solid #ddd6fe", color: "#7c5cbf" }}
                                data-testid={`select-faq-${ticket.id}`}
                              >
                                <option value="">+ Voeg FAQ-link toe (optioneel)</option>
                                {ADMIN_FAQ_ITEMS.map(f => (
                                  <option key={f.id} value={f.id}>{f.title}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => sendAdminReply(ticket.id)}
                                disabled={(!replyText[ticket.id]?.trim() && !selectedFaqId[ticket.id]) || sendingReply[ticket.id]}
                                className="px-3 py-1.5 rounded-full text-[12px] font-bold transition-all disabled:opacity-40 flex items-center gap-1.5"
                                style={{ backgroundColor: "#bbadfb", color: "#ffffff" }}
                                data-testid={`button-admin-reply-${ticket.id}`}
                              >
                                {sendingReply[ticket.id]
                                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  : <ChevronRight className="w-3.5 h-3.5" />
                                }
                                Verstuur
                              </button>
                            </div>
                          </div>
                        )}

                        {/* ── Status actions ── */}
                        <div className="flex gap-2 flex-wrap">
                          {ticket.status !== "resolved" && (
                            <button
                              onClick={() => updateStatus(ticket.id, "resolved")}
                              disabled={updatingId === ticket.id}
                              className="px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-all disabled:opacity-50"
                              style={{ backgroundColor: "#85fb8c", color: "#223546", borderColor: "#223546" }}
                              data-testid={`button-resolve-${ticket.id}`}
                            >
                              {updatingId === ticket.id ? "..." : "Mark resolved"}
                            </button>
                          )}
                          {ticket.status !== "closed" && (
                            <button
                              onClick={() => updateStatus(ticket.id, "closed")}
                              disabled={updatingId === ticket.id}
                              className="px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-all disabled:opacity-50"
                              style={{ backgroundColor: "rgb(var(--ha-bg))", color: "#666666", borderColor: "#e0e0e0" }}
                              data-testid={`button-close-${ticket.id}`}
                            >
                              Close
                            </button>
                          )}
                          {ticket.status !== "open" && (
                            <button
                              onClick={() => updateStatus(ticket.id, "open")}
                              disabled={updatingId === ticket.id}
                              className="px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-all disabled:opacity-50"
                              style={{ backgroundColor: "#fff7ed", color: "#c2410c", borderColor: "#fed7aa" }}
                              data-testid={`button-reopen-${ticket.id}`}
                            >
                              Reopen
                            </button>
                          )}
                          <button
                            onClick={() => loadThread(ticket.id)}
                            className="px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-all"
                            style={{ backgroundColor: "rgb(var(--ha-bg))", color: "#666", borderColor: "#e0e0e0" }}
                            data-testid={`button-reload-thread-${ticket.id}`}
                          >
                            ↻ Vernieuwen
                          </button>
                        </div>

                        {/* ── Notification delivery status ── */}
                        {notifResults[ticket.id] && (
                          <div className="p-3 rounded-[12px] text-[12px]" style={{ backgroundColor: "#f9f8ff", border: "1px solid #ede7ff" }}>
                            <p className="font-bold mb-1.5" style={{ color: "#7c5cbf" }}>Notification delivery</p>
                            <div className="flex flex-col gap-1">
                              <span style={{ color: notifResults[ticket.id].inApp ? "#223546" : "#888" }}>
                                {notifResults[ticket.id].inApp ? "✓" : "✗"} In-app notification
                              </span>
                              <span style={{ color: notifResults[ticket.id].push ? "#223546" : "#888" }}>
                                {notifResults[ticket.id].push ? "✓" : "✗"} Push notification
                              </span>
                              <span style={{ color: notifResults[ticket.id].email ? "#223546" : "#888" }}>
                                {notifResults[ticket.id].email ? "✓" : "✗"} Email
                                {notifResults[ticket.id].emailError && (
                                  <span style={{ color: "#e11d48" }}> — {notifResults[ticket.id].emailError}</span>
                                )}
                              </span>
                              {notifResults[ticket.id].alreadyNotified && (
                                <span style={{ color: "#888" }}>ℹ Already notified previously</span>
                              )}
                            </div>
                          </div>
                        )}
                        {ticket.resolved_notified_at && !notifResults[ticket.id] && (
                          <p className="text-[11px]" style={{ color: "#888" }}>
                            Notified at {new Date(ticket.resolved_notified_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setExpanded(isExpanded ? null : ticket.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0 transition-all"
                    style={{ backgroundColor: "rgb(var(--ha-bg))" }}
                    data-testid={`button-expand-${ticket.id}`}
                  >
                    <ChevronDown
                      className="w-4 h-4 transition-transform"
                      style={{ color: "#888888", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NotificationsTab() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function search() {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setData(null);
    adminFetch(`/api/admin/portal/notification-trace?email=${encodeURIComponent(query.trim())}`)
      .then(d => setData(d))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }

  function suppressionLabel(reason: string | null) {
    if (!reason) return null;
    const labels: Record<string, string> = {
      "no_subscription":       "No sub",
      "all_channels_disabled": "All off",
      "email_disabled":        "Email off",
      "push_disabled":         "Push off",
      "stale_listing_gt_2h":   "Stale >2h",
      "email_cap_exceeded":    "Cap exceed",
    };
    return labels[reason] || reason;
  }

  function suppressionColor(reason: string | null) {
    if (!reason) return "#22c55e";
    if (reason === "push_disabled" || reason === "email_disabled") return "#f59e0b";
    return "#ef4444";
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Notification Trace" />
      <div className="flex gap-2">
        <input
          type="text"
          className="flex-1 px-3 py-2 text-[13px] rounded-[10px] border"
          style={{ borderColor: "#eeebf3", outline: "none" }}
          placeholder="User email address…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && search()}
          data-testid="input-notif-email"
        />
        <Button size="sm" onClick={search} disabled={loading} data-testid="button-notif-search">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </Button>
      </div>

      {error && (
        <div className="rounded-[12px] p-4 text-[13px]" style={{ backgroundColor: "#fef2f2", color: "#dc2626" }}>
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-5">
          {/* User + settings summary */}
          <div className="rounded-[14px] p-4 space-y-3" style={{ border: "1px solid #eeebf3", backgroundColor: "#fafafa" }}>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[13px] font-semibold" style={{ color: "#111" }}>{data.user.email}</span>
              <Badge style={{ backgroundColor: data.subscription?.status === "active" ? "#dcfce7" : "#fee2e2", color: data.subscription?.status === "active" ? "#16a34a" : "#dc2626" }}>
                {data.subscription?.status || "no sub"} · {data.subscription?.plan || "–"}
              </Badge>
            </div>
            <div className="flex gap-4 flex-wrap text-[12px]" style={{ color: "#666" }}>
              <span>Email: <b style={{ color: data.notification_settings?.email_enabled ? "#16a34a" : "#dc2626" }}>{data.notification_settings?.email_enabled ? "on" : "off"}</b></span>
              <span>Push: <b style={{ color: data.notification_settings?.push_enabled ? "#16a34a" : "#dc2626" }}>{data.notification_settings?.push_enabled ? "on" : "off"}</b></span>
            </div>
            <div className="flex gap-6 flex-wrap">
              {[
                { label: "Matches", value: data.summary.total },
                { label: "Emails sent", value: data.summary.email_sent },
                { label: "Pushes sent", value: data.summary.push_sent },
                { label: "Suppressed", value: data.summary.suppressed },
              ].map(m => (
                <div key={m.label} className="text-center">
                  <div className="text-[22px] font-bold" style={{ color: "#111" }}>{m.value}</div>
                  <div className="text-[11px]" style={{ color: "#888" }}>{m.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Match table */}
          <div className="rounded-[14px] overflow-hidden" style={{ border: "1px solid #eeebf3" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr style={{ backgroundColor: "#f9f8fc", borderBottom: "1px solid #eeebf3" }}>
                    {["Listing", "Source", "Matched at", "Email", "Push", "Suppression"].map(h => (
                      <th key={h} className="text-left px-3 py-2.5 font-semibold" style={{ color: "#666" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.matches.map((m: any, i: number) => (
                    <tr key={m.listing_id} style={{ borderBottom: i < data.matches.length - 1 ? "1px solid #f0eef6" : "none" }}>
                      <td className="px-3 py-2.5 max-w-[220px]">
                        <div className="font-medium truncate" style={{ color: "#111" }} title={m.listing_title}>{m.listing_title || "–"}</div>
                        <div style={{ color: "#999" }}>{m.listing_city || ""}{m.listing_price ? ` · €${m.listing_price}` : ""}</div>
                      </td>
                      <td className="px-3 py-2.5" style={{ color: "#666" }}>{m.listing_source || "–"}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: "#666" }}>
                        {m.matched_at ? new Date(m.matched_at).toLocaleString("de-DE", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "–"}
                      </td>
                      <td className="px-3 py-2.5">
                        <span style={{ color: m.email_sent ? "#16a34a" : "#dc2626" }}>{m.email_sent ? "✓" : "✗"}</span>
                        {m.email_sent_at && <span className="ml-1" style={{ color: "#999", fontSize: "11px" }}>{new Date(m.email_sent_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <span style={{ color: m.push_sent ? "#16a34a" : "#dc2626" }}>{m.push_sent ? "✓" : "✗"}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        {m.suppression_reason ? (
                          <span className="px-1.5 py-0.5 rounded text-[11px] font-medium" style={{ backgroundColor: suppressionColor(m.suppression_reason) + "22", color: suppressionColor(m.suppression_reason) }}>
                            {suppressionLabel(m.suppression_reason)}
                          </span>
                        ) : (
                          <span style={{ color: "#22c55e" }}>sent</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {data.matches.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-8 text-center" style={{ color: "#999" }}>No matches found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RealtimeSlaTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    adminFetch("/api/admin/portal/sla-status")
      .then(d => { setData(d); setError(null); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 10_000);
    return () => clearInterval(interval);
  }, []);

  function formatAge(iso: string | null): string {
    if (!iso) return "—";
    const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (secs < 60) return `${secs}s ago`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s ago`;
    return `${Math.floor(secs / 3600)}h ago`;
  }

  function fmtMs(ms: number | null | undefined): string {
    if (ms == null) return "—";
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  }

  function fmtSec(s: number | null | undefined): string {
    if (s == null) return "—";
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  }

  function slaColor(s: number | null): string {
    if (s == null) return "#888";
    if (s <= 30) return "#22c55e";
    if (s <= 60) return "#84cc16";
    if (s <= 120) return "#f59e0b";
    return "#ef4444";
  }

  function pctColor(pct: number | null): string {
    if (pct == null) return "#888";
    if (pct >= 90) return "#22c55e";
    if (pct >= 70) return "#f59e0b";
    return "#ef4444";
  }

  const antiBotBadge: Record<string, string> = {
    low: "bg-green-100 text-green-700",
    medium: "bg-yellow-100 text-yellow-700",
    high: "bg-red-100 text-red-700",
  };

  const alertTypeLabel: Record<string, string> = {
    sla_p95_exceeded: "Source→Notif p95 > 60s",
    match_to_notif_p95_exceeded: "Match→Notif p95 > 30s",
    fast_lane_stale: "Fast-lane stale > 2min",
    flush_stuck: "Flush stuck > 2min",
  };

  if (loading) return (
    <div className="flex items-center gap-2 text-sm text-gray-500 py-8">
      <Loader2 className="w-4 h-4 animate-spin" /> Loading SLA status…
    </div>
  );
  if (error) return <div className="text-red-500 text-sm py-4">Error: {error}</div>;
  if (!data) return null;

  const {
    pairs = [],
    lastFastLaneAt,
    isRunning,
    fastLaneStalenessMs,
    slaMetrics = [],
    sourceCapabilities = [],
    slaTargetSeconds,
    totalEventCount,
    slaAlerts = [],
    flushStatus,
    bottleneckReport,
  } = data;

  const fastLaneStale = fastLaneStalenessMs !== null && fastLaneStalenessMs > 120_000;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-[17px] font-semibold text-gray-900">Realtime SLA</h2>
          <p className="text-[13px] text-gray-500 mt-0.5">
            Per-source fast-lane timers · target ≤ <strong>{slaTargetSeconds}s</strong> source→notification · {totalEventCount} events (24h)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isRunning && (
            <span className="flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded-full">
              <Loader2 className="w-3 h-3 animate-spin" /> Running
            </span>
          )}
          {fastLaneStale && (
            <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full">
              <AlertTriangle className="w-3 h-3" /> Stale {Math.round(fastLaneStalenessMs / 1000)}s
            </span>
          )}
          <button onClick={load} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" data-testid="button-sla-refresh">
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* SLA Alerts */}
      {slaAlerts.length > 0 && (
        <div className="rounded-[14px] border border-red-100 bg-red-50 p-4 space-y-2">
          <p className="text-[12px] font-semibold text-red-700 uppercase tracking-wide flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> SLA Alerts
          </p>
          {slaAlerts.map((a: any, i: number) => (
            <div key={i} className="flex items-start gap-2 text-[13px]">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
              <div>
                <span className="font-medium text-red-800">{alertTypeLabel[a.type] ?? a.type}</span>
                {a.source && <span className="text-red-600 ml-1.5">({a.source}/{a.city})</span>}
                <span className="text-red-600 ml-1.5">— {a.message}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fast-lane pair status */}
      <div>
        <SectionHeader title="Fast-lane sources" />
        <div className="rounded-[14px] border border-gray-100 overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-500 text-[11px] uppercase tracking-wide">
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Interval</th>
                <th className="px-4 py-3 font-medium">Last run</th>
                <th className="px-4 py-3 font-medium">Found</th>
                <th className="px-4 py-3 font-medium">New</th>
                <th className="px-4 py-3 font-medium">Known skip</th>
                <th className="px-4 py-3 font-medium">Last run time</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pairs.map((p: any, i: number) => {
                const lr = p.lastRun;
                const hasError = lr?.error && lr.error !== "bot-blocked";
                const isBot = lr?.error === "bot-blocked";
                const isCircuit = p.circuitOpen;
                const runAgeSec = lr?.runAt ? Math.floor((Date.now() - new Date(lr.runAt).getTime()) / 1000) : null;
                const isStale = runAgeSec !== null && runAgeSec > (p.intervalSeconds ?? 60) * 3;
                return (
                  <tr key={i} className="bg-white hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.source}</td>
                    <td className="px-4 py-3 text-purple-600 font-mono text-[12px]">{p.intervalSeconds ?? "—"}s</td>
                    <td className="px-4 py-3 text-gray-500" style={{ color: isStale ? "#ef4444" : undefined }}>
                      {formatAge(lr?.runAt ?? null)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{lr ? lr.found : "—"}</td>
                    <td className="px-4 py-3">
                      {lr ? (
                        <span className={lr.inserted > 0 ? "text-green-600 font-medium" : "text-gray-400"}>
                          {lr.inserted}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-[12px]">
                      {lr?.knownSkipped != null ? (
                        <span className={lr.earlyExit ? "text-blue-500" : ""}>
                          {lr.knownSkipped}{lr.earlyExit ? " ⚡" : ""}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{fmtMs(lr?.durationMs)}</td>
                    <td className="px-4 py-3">
                      {isCircuit ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">
                          <WifiOff className="w-3 h-3" /> Circuit open
                        </span>
                      ) : isBot ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">
                          <AlertTriangle className="w-3 h-3" /> Bot-blocked
                        </span>
                      ) : hasError ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">
                          <AlertTriangle className="w-3 h-3" /> Error
                        </span>
                      ) : lr ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full">
                          <CheckCircle className="w-3 h-3" /> OK
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Pending</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-gray-400 mt-1.5 px-1">
          Last global fast-lane activity: {formatAge(lastFastLaneAt)} · ⚡ = early-exit (all remaining were known IDs)
          {flushStatus?.stuckSinceMs != null && (
            <span className="text-red-500 ml-2">⚠ Flush running {Math.round(flushStatus.stuckSinceMs / 1000)}s</span>
          )}
        </p>
      </div>

      {/* SLA metrics — end-to-end */}
      <div>
        <SectionHeader title="End-to-end latency (source_published_at → notification sent, last 24h)" />
        {slaMetrics.length === 0 ? (
          <div className="rounded-[14px] border border-gray-100 bg-gray-50 px-6 py-8 text-center text-[13px] text-gray-400">
            No SLA events recorded yet — data will appear after the fast-lane inserts new listings and sends notifications.
          </div>
        ) : (
          <div className="rounded-[14px] border border-gray-100 overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-500 text-[11px] uppercase tracking-wide">
                  <th className="px-4 py-3 font-medium">Source / City</th>
                  <th className="px-4 py-3 font-medium">n</th>
                  <th className="px-4 py-3 font-medium">⚡ FL</th>
                  <th className="px-4 py-3 font-medium">P50</th>
                  <th className="px-4 py-3 font-medium">P90</th>
                  <th className="px-4 py-3 font-medium">P95</th>
                  <th className="px-4 py-3 font-medium">Worst</th>
                  <th className="px-4 py-3 font-medium">≤60s</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {slaMetrics.map((m: any, i: number) => {
                  const e = m.endToEnd;
                  const flPct = m.eventCount > 0 ? Math.round((m.fastLaneCount / m.eventCount) * 100) : 0;
                  return (
                    <tr key={i} className="bg-white hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">{m.source}</span>
                        <span className="text-gray-400 ml-1">/ {m.city}</span>
                        {m.withPublishedAt === 0 && (
                          <span className="text-[10px] text-gray-400 ml-1">(no pub timestamp)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{e?.count ?? 0}</td>
                      <td className="px-4 py-3 text-[12px]">
                        {m.fastLaneCount > 0 ? (
                          <span title={`${m.fastLaneCount} of ${m.eventCount} events were fast-lane`} style={{ color: flPct >= 50 ? "#7c5fc5" : "#aaa" }}>
                            {m.fastLaneCount}/{m.eventCount}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3" style={{ color: slaColor(e?.p50) }}>{fmtSec(e?.p50)}</td>
                      <td className="px-4 py-3" style={{ color: slaColor(e?.p90) }}>{fmtSec(e?.p90)}</td>
                      <td className="px-4 py-3" style={{ color: slaColor(e?.p95) }}>{fmtSec(e?.p95)}</td>
                      <td className="px-4 py-3" style={{ color: slaColor(e?.worst) }}>{fmtSec(e?.worst)}</td>
                      <td className="px-4 py-3">
                        {e?.pctUnder60 != null ? (
                          <span style={{ color: pctColor(e.pctUnder60) }}>{e.pctUnder60}%</span>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stage breakdown */}
      {slaMetrics.length > 0 && (
        <div>
          <SectionHeader title="Stage breakdown (p95 per stage, last 24h)" />
          <div className="rounded-[14px] border border-gray-100 overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-500 text-[11px] uppercase tracking-wide">
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium">Detection p95</th>
                  <th className="px-4 py-3 font-medium">Insertion p95</th>
                  <th className="px-4 py-3 font-medium">Match p95</th>
                  <th className="px-4 py-3 font-medium">Push p95</th>
                  <th className="px-4 py-3 font-medium">Email p95</th>
                  <th className="px-4 py-3 font-medium">Match→Notif p95</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {slaMetrics.map((m: any, i: number) => (
                  <tr key={i} className="bg-white hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-900">{m.source}<span className="text-gray-400 font-normal ml-1">/{m.city}</span></td>
                    <td className="px-4 py-3" style={{ color: slaColor(m.detection?.p95) }}>{fmtSec(m.detection?.p95)}</td>
                    <td className="px-4 py-3" style={{ color: slaColor(m.insertion?.p95) }}>{fmtSec(m.insertion?.p95)}</td>
                    <td className="px-4 py-3" style={{ color: slaColor(m.matching?.p95) }}>{fmtSec(m.matching?.p95)}</td>
                    <td className="px-4 py-3" style={{ color: slaColor(m.pushLatency?.p95) }}>{fmtSec(m.pushLatency?.p95)}</td>
                    <td className="px-4 py-3" style={{ color: slaColor(m.emailLatency?.p95) }}>{fmtSec(m.emailLatency?.p95)}</td>
                    <td className="px-4 py-3" style={{ color: slaColor(m.matchToNotif?.p95) }}>{fmtSec(m.matchToNotif?.p95)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5 px-1">
            Detection requires source_published_at. Only Kleinanzeigen currently provides it — other sources show "—".
          </p>
        </div>
      )}

      {/* Bottleneck Report */}
      {bottleneckReport && (
        <div>
          <SectionHeader title="Bottleneck analysis" />
          <div className="space-y-4">
            {bottleneckReport.bottlenecks.length > 0 && (
              <div className="rounded-[14px] border border-orange-100 bg-orange-50 p-4 space-y-2">
                <p className="text-[12px] font-semibold text-orange-700 uppercase tracking-wide">Active bottlenecks</p>
                {bottleneckReport.bottlenecks.map((b: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-[13px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 flex-shrink-0" />
                    <span className="text-orange-800">
                      <strong>{b.source}/{b.city}</strong> — {b.stage} (p95={b.p95S}s)
                      <span className={`ml-2 text-[11px] px-1.5 py-0.5 rounded-full ${b.impact === "SLA breach" ? "bg-red-100 text-red-700" : b.impact === "Near limit" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>
                        {b.impact}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-[14px] border border-gray-100 bg-gray-50 p-4 space-y-3">
              <p className="text-[12px] font-semibold text-gray-600 uppercase tracking-wide">Why 12m / 17m / 283m delays happened</p>
              {bottleneckReport.delayExplanation.historicDelays.map((d: string, i: number) => (
                <p key={i} className="text-[13px] text-gray-700 leading-relaxed">{d}</p>
              ))}
              <p className="text-[12px] font-semibold text-gray-600 uppercase tracking-wide mt-3">Root causes</p>
              {bottleneckReport.delayExplanation.rootCauses.map((c: string, i: number) => (
                <p key={i} className="text-[13px] text-gray-600">• {c}</p>
              ))}
            </div>

            <div className="rounded-[14px] border border-blue-100 bg-blue-50 p-4 space-y-2">
              <p className="text-[12px] font-semibold text-blue-700 uppercase tracking-wide">New intervals (active)</p>
              {Object.entries(bottleneckReport.newIntervals).map(([source, desc]: [string, any]) => (
                <div key={source} className="flex items-start gap-2 text-[13px]">
                  <span className="text-blue-400 mt-0.5">→</span>
                  <span className="text-blue-800"><strong>{source}:</strong> {desc}</span>
                </div>
              ))}
            </div>

            <div className="rounded-[14px] border border-green-100 bg-green-50 p-4">
              <p className="text-[12px] font-semibold text-green-700 uppercase tracking-wide mb-1">Expected SLA after changes</p>
              <p className="text-[13px] text-green-800 leading-relaxed">{bottleneckReport.expectedSlaAfterChanges}</p>
            </div>

            <div className="rounded-[14px] border border-gray-100 p-4">
              <p className="text-[12px] font-semibold text-gray-600 uppercase tracking-wide mb-2">Sources that cannot meet 60s</p>
              {bottleneckReport.sourcesCannotMeet60s.map((s: string, i: number) => (
                <p key={i} className="text-[13px] text-gray-600">• {s}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Source capabilities */}
      <div>
        <SectionHeader title="Source capabilities" />
        <div className="rounded-[14px] border border-gray-100 overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-500 text-[11px] uppercase tracking-wide">
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Fast-lane</th>
                <th className="px-4 py-3 font-medium">Pub. timestamp</th>
                <th className="px-4 py-3 font-medium">Interval</th>
                <th className="px-4 py-3 font-medium">Anti-bot</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Cities</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sourceCapabilities.map((cap: any, i: number) => (
                <tr key={i} className="bg-white hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-gray-900">{cap.source}</td>
                  <td className="px-4 py-3">
                    {cap.supportsFastLane ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                        <Zap className="w-3 h-3" /> Yes
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {cap.supportsSourcePublishedAt ? (
                      <span className="text-xs text-green-600">✓ Available</span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px] text-purple-600">
                    {cap.fastLaneIntervalSeconds ?? cap.recommendedIntervalSeconds}s
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${antiBotBadge[cap.antiBotRisk] ?? ""}`}>
                      {cap.antiBotRisk}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">P{cap.priorityLevel}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {cap.fastLaneCities?.length > 0 ? cap.fastLaneCities.join(", ") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const NAV_GROUPS: { label: string; items: { id: TabId; label: string; icon: any }[] }[] = [
  {
    label: "Overview",
    items: [
      { id: "dashboard",    label: "Dashboard",   icon: LayoutDashboard },
      { id: "alerts",       label: "Alerts",      icon: Bell },
      { id: "realtime-sla", label: "Realtime SLA", icon: Zap },
      { id: "system",       label: "System",      icon: Signal },
    ],
  },
  {
    label: "Content",
    items: [
      { id: "listings", label: "Listings", icon: Layers },
      { id: "images",   label: "Images",   icon: Image },
      { id: "sources",  label: "Sources",  icon: Radio },
    ],
  },
  {
    label: "Users",
    items: [
      { id: "users",         label: "Users",         icon: Users },
      { id: "subscriptions", label: "Subscriptions", icon: CreditCard },
      { id: "notifications", label: "Notifications", icon: Mail },
      { id: "support",       label: "Support",       icon: MessageCircle },
    ],
  },
  {
    label: "Config",
    items: [
      { id: "settings", label: "Settings", icon: Sliders },
    ],
  },
];

function NavItem({ id, label, icon: Icon, active, onClick }: { id: TabId; label: string; icon: any; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[12px] text-[13px] font-medium mb-0.5 transition-all active:scale-[0.98]"
      style={active
        ? { backgroundColor: "rgba(187,173,251,0.13)", color: "#7c5fc5" }
        : { color: "#666666", backgroundColor: "transparent" }
      }
      data-testid={`nav-${id}`}
    >
      <Icon
        className="w-[17px] h-[17px] flex-shrink-0"
        style={{ color: active ? "#bbadfb" : "#aaaaaa" }}
      />
      {label}
      {active && <span className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: "#bbadfb" }} />}
    </button>
  );
}

export default function AdminPortalPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [accessDenied, setAccessDenied] = useState(false);
  const [checking, setChecking] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!user) { setChecking(false); return; }
    adminFetch("/api/admin/portal/system-status")
      .then(() => setChecking(false))
      .catch(err => {
        if (err.message === "ACCESS_DENIED") setAccessDenied(true);
        setChecking(false);
      });
  }, [user]);

  function navigate2(tab: TabId) {
    setActiveTab(tab);
    setSidebarOpen(false);
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "rgb(var(--ha-bg))" }}>
        <Loader2 className="w-7 h-7 animate-spin" style={{ color: "#bbadfb" }} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5" style={{ backgroundColor: "rgb(var(--ha-bg))" }}>
        <div className="text-center max-w-sm">
          <h1 className="text-[20px] font-bold mb-2" style={{ color: "#111111" }}>Not authenticated</h1>
          <p className="text-[13px] mb-5" style={{ color: "#888888" }}>Please log in to access the admin portal.</p>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-2.5 rounded-full text-[14px] font-semibold transition-all active:scale-[0.97]"
            style={{ backgroundColor: "#85fb8c", color: "#111111" }}
            data-testid="button-login"
          >
            Go to login
          </button>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "rgb(var(--ha-bg))" }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden transition-opacity"
          style={{ backgroundColor: "rgba(0,0,0,0.35)", backdropFilter: "blur(2px)" }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-[240px] flex flex-col transition-transform duration-300 ease-out lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        style={{ backgroundColor: "#ffffff", borderRight: "1px solid #eeebf3" }}
      >
        {/* Sidebar header */}
        <div className="px-5 h-[64px] flex items-center gap-3" style={{ borderBottom: "1px solid #eeebf3" }}>
          <HousAlertLogo size={26} />
          <span className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: "#bbadfb" }}>Admin</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto lg:hidden w-8 h-8 flex items-center justify-center rounded-[10px] transition-colors"
            style={{ backgroundColor: "#f5f5f5" }}
          >
            <X className="w-4 h-4" style={{ color: "#666666" }} />
          </button>
        </div>

        {/* Grouped nav */}
        <nav className="flex-1 py-4 px-3 overflow-y-auto space-y-5">
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: "#cccccc" }}>
                {group.label}
              </p>
              {group.items.map(({ id, label, icon }) => (
                <NavItem
                  key={id}
                  id={id}
                  label={label}
                  icon={icon}
                  active={activeTab === id}
                  onClick={() => navigate2(id)}
                />
              ))}
            </div>
          ))}
        </nav>

        {/* Back to app */}
        <div className="px-3 py-4" style={{ borderTop: "1px solid #eeebf3" }}>
          <button
            onClick={() => navigate("/")}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[12px] text-[13px] font-semibold transition-all active:scale-[0.98]"
            style={{ color: "#111111", backgroundColor: "#f5f5f5", border: "1px solid #eeebf3" }}
            data-testid="link-back-app"
          >
            <ArrowLeft className="w-[16px] h-[16px]" style={{ color: "#666666" }} />
            Terug naar app
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile topbar */}
        <header
          className="h-[60px] flex items-center px-4 sticky top-0 z-30 lg:hidden"
          style={{ backgroundColor: "#ffffff", borderBottom: "1px solid #eeebf3", boxShadow: "0 1px 0 rgba(0,0,0,0.04)" }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-9 h-9 rounded-[10px] flex items-center justify-center mr-3 transition-colors"
            style={{ backgroundColor: "#f5f5f5" }}
            data-testid="button-menu"
          >
            <Menu className="w-[18px] h-[18px]" style={{ color: "#444444" }} />
          </button>
          <HousAlertLogo size={22} />
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] ml-2" style={{ color: "#bbadfb" }}>Admin</span>
          <button
            onClick={() => navigate("/")}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all active:scale-[0.97]"
            style={{ color: "#444444", backgroundColor: "#f5f5f5", border: "1px solid #eeebf3" }}
            data-testid="link-back-app-mobile"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Terug
          </button>
        </header>

        <main className="flex-1 p-5 lg:p-8 max-w-5xl w-full mx-auto overflow-x-hidden">
          {activeTab === "dashboard"     && <DashboardTab onNavigate={setActiveTab} userName={user.user_metadata?.first_name || user.user_metadata?.name?.split(" ")[0] || user.user_metadata?.full_name?.split(" ")[0] || "Admin"} />}
          {activeTab === "listings"      && <ListingsTab />}
          {activeTab === "images"        && <ImagesTab />}
          {activeTab === "sources"       && <SourcesTab />}
          {activeTab === "users"         && <UsersTab />}
          {activeTab === "subscriptions" && <SubscriptionsTab />}
          {activeTab === "alerts"        && <AlertsTab />}
          {activeTab === "settings"      && <SettingsTab />}
          {activeTab === "system"        && <SystemTab />}
          {activeTab === "support"       && <SupportTab />}
          {activeTab === "realtime-sla"  && <RealtimeSlaTab />}
          {activeTab === "notifications" && <NotificationsTab />}
        </main>
      </div>
    </div>
  );
}
