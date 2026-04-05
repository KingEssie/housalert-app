import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api-base";
import {
  Users, CreditCard, Search,
  Loader2, ChevronRight, ExternalLink, RefreshCw,
  Mail, Smartphone, AlertTriangle, CheckCircle, XCircle,
  TrendingUp, Activity, Database, Globe, Zap, ArrowLeft,
  Target, Percent, Eye, MessageCircle,
  Radio, Layers, Settings,
  LayoutDashboard, Signal,
} from "lucide-react";
import { HousAlertLogo } from "@/components/housalert-logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";

type TabId = "dashboard" | "growth" | "sources" | "cities" | "users" | "system";

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

function StatusDot({ status }: { status: string }) {
  const color = status === "active" || status === "operational" || status === "success"
    ? "bg-emerald-400" : status === "warning" || status === "partial" || status === "degraded"
    ? "bg-amber-400" : status === "error" || status === "failed" || status === "broken" || status === "canceled"
    ? "bg-ha-danger" : "bg-[#E5E7EB]";
  return <span className={`w-2 h-2 rounded-full inline-block ${color}`} />;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    active: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Active" },
    operational: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Operational" },
    trial: { cls: "bg-orange-50 text-ha-primary border-orange-200", label: "Trial" },
    canceled: { cls: "bg-ha-danger/5 text-ha-danger border-ha-danger/20", label: "Canceled" },
    expired: { cls: "bg-[#F7F7F7] text-[#6B7280] border-[#E5E7EB]", label: "Expired" },
    error: { cls: "bg-ha-danger/5 text-ha-danger border-ha-danger/20", label: "Error" },
    warning: { cls: "bg-amber-50 text-amber-700 border-amber-200", label: "Warning" },
    disabled: { cls: "bg-[#F7F7F7] text-[#6B7280] border-[#E5E7EB]", label: "Disabled" },
    success: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Success" },
    partial: { cls: "bg-amber-50 text-amber-700 border-amber-200", label: "Partial" },
    failed: { cls: "bg-ha-danger/5 text-ha-danger border-ha-danger/20", label: "Failed" },
    broken: { cls: "bg-ha-danger/5 text-ha-danger border-ha-danger/20", label: "Broken" },
    degraded: { cls: "bg-amber-50 text-amber-700 border-amber-200", label: "Degraded" },
  };
  const m = map[status] || { cls: "bg-[#F7F7F7] text-[#6B7280] border-[#E5E7EB]", label: status };
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${m.cls}`}>{m.label}</span>;
}

const CARD = "bg-white rounded-[20px] border border-[#F7F7F7] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)]";
const CARD_ELEVATED = "bg-white rounded-[20px] border border-[#F7F7F7] shadow-[0_2px_8px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)]";
const PILL_ACTIVE = "bg-[#111111] text-white shadow-[0_2px_8px_rgba(17,24,39,0.12)]";
const PILL_INACTIVE = "bg-white text-[#6B7280] border border-[#F7F7F7]";

function SectionHeader({ title, action }: { title: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-[16px] font-semibold text-[#111111]">{title}</h3>
      {action && <button onClick={action.onClick} className="text-[13px] font-medium text-ha-primary" data-testid={`action-${title.toLowerCase().replace(/\s/g, "-")}`}>{action.label}</button>}
    </div>
  );
}

function MetricPill({ label, value, icon: Icon }: { label: string; value: string | number; icon: any; color?: string }) {
  return (
    <div className={`flex-shrink-0 w-[140px] ${CARD} p-3.5`} data-testid={`metric-${label.toLowerCase().replace(/\s/g, "-")}`}>
      <Icon className="w-5 h-5 text-[#111111] mb-2" />
      <p className="text-[20px] font-bold text-[#111111] leading-tight">{value}</p>
      <p className="text-[11px] text-[#6B7280] font-medium mt-0.5">{label}</p>
    </div>
  );
}

function EmptyState({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) {
  return (
    <div className={`${CARD_ELEVATED} p-8 text-center`}>
      <Database className="w-6 h-6 text-[#9CA3AF] mx-auto mb-3" />
      <h4 className="text-[16px] font-semibold text-[#111111] mb-1">{title}</h4>
      <p className="text-[13px] text-[#6B7280] mb-4">{message}</p>
      {onRetry && <Button variant="outline" size="sm" onClick={onRetry} className="rounded-full border-[#F7F7F7]" data-testid="button-retry">Try again</Button>}
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

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function DashboardTab({ onNavigate, userName }: { onNavigate: (tab: TabId) => void; userName: string }) {
  const [data, setData] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([
      adminFetch("/api/admin/portal/overview").catch(() => null),
      adminFetch("/api/admin/portal/alerts").catch(() => ({ alerts: [] })),
    ]).then(([overview, alertsData]) => {
      setData(overview);
      setAlerts(alertsData?.alerts || []);
    }).finally(() => { setLoading(false); setRefreshing(false); });
  }

  useEffect(() => { load(); }, []);

  if (loading && !data) return <LoadingState />;
  if (!data) return <EmptyState title="Unable to load" message="Dashboard data could not be fetched." onRetry={load} />;

  return (
    <div className="space-y-6 pb-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[#111111]" data-testid="text-greeting">{getGreeting()}, {userName}</h1>
          <p className="text-[13px] text-[#6B7280] mt-0.5">Here's what's happening today</p>
        </div>
        <button onClick={() => { setRefreshing(true); load(); }} className="w-9 h-9 rounded-full bg-[#F7F7F7] flex items-center justify-center" data-testid="button-refresh-dashboard">
          <RefreshCw className={`w-4 h-4 text-[#6B7280] ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {alerts.length > 0 && (
        <div>
          <SectionHeader title="Needs attention" />
          <div className="bg-white rounded-[20px] border border-[#F7F7F7] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] divide-y divide-[#F7F7F7]">
            {alerts.map((a: any, i: number) => {
              const sColor = a.severity === "critical" ? "bg-ha-danger" : a.severity === "warning" ? "bg-amber-400" : "bg-ha-primary";
              return (
                <div key={i} className="flex items-start gap-3 px-4 py-3.5" data-testid={`alert-row-${i}`}>
                  <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${sColor}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#111111] leading-snug">{a.message}</p>
                    <p className="text-[11px] text-[#6B7280] mt-0.5">{new Date(a.timestamp).toLocaleTimeString()}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#9CA3AF] mt-0.5 flex-shrink-0" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <SectionHeader title="Key metrics" />
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4" style={{ WebkitOverflowScrolling: "touch" }}>
          <MetricPill label="MRR" value={`€${data.mrr}`} icon={CreditCard} color="green" />
          <MetricPill label="Active subs" value={data.activeSubscriptions} icon={CreditCard} color="green" />
          <MetricPill label="Trial users" value={data.trialUsers} icon={Zap} color="purple" />
          <MetricPill label="Signups today" value={data.signupsToday} icon={TrendingUp} color="blue" />
          <MetricPill label="Matches today" value={data.matchesToday} icon={Activity} color="green" />
          <MetricPill label="Emails today" value={data.emailsToday} icon={Mail} color="purple" />
        </div>
      </div>

      <div>
        <SectionHeader title="Today at a glance" />
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-[20px] border border-[#F7F7F7] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] p-4">
            <p className="text-[11px] text-[#6B7280] font-medium mb-1">Revenue</p>
            <p className="text-[22px] font-bold text-[#111111]">€{data.mrr}</p>
            <p className="text-[11px] text-[#6B7280] mt-1">{data.activeSubscriptions} active subs</p>
          </div>
          <div className="bg-white rounded-[20px] border border-[#F7F7F7] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] p-4">
            <p className="text-[11px] text-[#6B7280] font-medium mb-1">Users</p>
            <p className="text-[22px] font-bold text-[#111111]">{data.totalUsers}</p>
            <p className="text-[11px] text-[#6B7280] mt-1">{data.signupsToday} new today</p>
          </div>
          <div className="bg-white rounded-[20px] border border-[#F7F7F7] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] p-4">
            <p className="text-[11px] text-[#6B7280] font-medium mb-1">Listings</p>
            <p className="text-[22px] font-bold text-[#111111]">{data.listingsToday}</p>
            <p className="text-[11px] text-[#6B7280] mt-1">{data.listingsWeek} this week</p>
          </div>
          <div className="bg-white rounded-[20px] border border-[#F7F7F7] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] p-4">
            <p className="text-[11px] text-[#6B7280] font-medium mb-1">Delivery</p>
            <p className="text-[22px] font-bold text-[#111111]">{data.emailsToday}</p>
            <p className="text-[11px] text-[#6B7280] mt-1">{data.pushesToday} push sent</p>
          </div>
        </div>
      </div>

      {data.sourceHealth && data.sourceHealth.length > 0 && (
        <div>
          <SectionHeader title="Supply health" action={{ label: "View all", onClick: () => onNavigate("sources") }} />
          <div className="bg-white rounded-[20px] border border-[#F7F7F7] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] divide-y divide-[#F7F7F7]">
            {(() => {
              const byCity = new Map<string, { healthy: number; issues: number; total: number }>();
              for (const s of data.sourceHealth) {
                const city = s.city || "Unknown";
                const entry = byCity.get(city) || { healthy: 0, issues: 0, total: 0 };
                entry.total += s.found || 0;
                if (s.status === "active" || s.found > 0) entry.healthy++; else entry.issues++;
                byCity.set(city, entry);
              }
              return Array.from(byCity.entries()).slice(0, 6).map(([city, info]) => (
                <div key={city} className="flex items-center gap-3 px-4 py-3">
                  <StatusDot status={info.issues > 0 ? "warning" : "active"} />
                  <span className="text-[13px] font-medium text-[#111111] flex-1">{city}</span>
                  <span className="text-[12px] text-[#6B7280]">{info.total} listings</span>
                  <StatusBadge status={info.issues > 0 ? "degraded" : "active"} />
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      <div>
        <SectionHeader title="Last 7 days" />
        <div className="bg-white rounded-[20px] border border-[#F7F7F7] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] p-4 space-y-2.5">
          {[
            { label: "Signups", value: data.signupsWeek },
            { label: "Listings", value: data.listingsWeek },
            { label: "Matches", value: data.matchesWeek },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between text-[13px]">
              <span className="text-[#6B7280]">{label}</span>
              <span className="font-semibold text-[#111111]">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionHeader title="Quick actions" />
        <div className="grid grid-cols-4 gap-2">
          {[
            { icon: Users, label: "Users", tab: "users" as TabId },
            { icon: Radio, label: "Sources", tab: "sources" as TabId },
            { icon: TrendingUp, label: "Growth", tab: "growth" as TabId },
            { icon: Settings, label: "System", tab: "system" as TabId },
          ].map(({ icon: Icon, label, tab }) => (
            <button key={tab} onClick={() => onNavigate(tab)} className="bg-white rounded-[20px] border border-[#F7F7F7] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] p-3 flex flex-col items-center gap-1.5" data-testid={`quick-${tab}`}>
              <Icon className="w-5 h-5 text-[#111111]" />
              <span className="text-[11px] font-medium text-[#6B7280]">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function GrowthTab() {
  const [data, setData] = useState<any>(null);
  const [retentionData, setRetentionData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      adminFetch("/api/admin/portal/growth").catch(() => null),
      adminFetch("/api/admin/portal/retention").catch(() => null),
    ]).then(([g, r]) => {
      setData(g);
      setRetentionData(r);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;
  if (!data) return <EmptyState title="No data available" message="Growth data could not be loaded." />;

  const { funnel, metrics, cityPerformance } = data;

  const stages = [
    { name: "Acquire", steps: funnel?.filter((_: any, i: number) => i < 2) || [] },
    { name: "Activate", steps: funnel?.filter((_: any, i: number) => i >= 2 && i < 5) || [] },
    { name: "Convert", steps: funnel?.filter((_: any, i: number) => i >= 5) || [] },
  ];

  const maxCount = funnel?.[0]?.count || 1;

  return (
    <div className="space-y-6 pb-4">
      <h1 className="text-[22px] font-bold text-[#111111]">Growth</h1>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-[20px] border border-[#F7F7F7] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] p-4">
          <p className="text-[11px] text-[#6B7280] font-medium">Signups</p>
          <p className="text-[22px] font-bold text-[#111111]">{funnel?.[0]?.count || 0}</p>
        </div>
        <div className="bg-white rounded-[20px] border border-[#F7F7F7] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] p-4">
          <p className="text-[11px] text-[#6B7280] font-medium">Profiles created</p>
          <p className="text-[22px] font-bold text-[#111111]">{funnel?.find((f: any) => f.key === "search_created")?.count || 0}</p>
        </div>
        <div className="bg-white rounded-[20px] border border-[#F7F7F7] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] p-4">
          <p className="text-[11px] text-[#6B7280] font-medium">Checkout started</p>
          <p className="text-[22px] font-bold text-[#111111]">{funnel?.find((f: any) => f.key === "checkout_started")?.count || 0}</p>
        </div>
        <div className="bg-white rounded-[20px] border border-[#F7F7F7] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] p-4">
          <p className="text-[11px] text-[#6B7280] font-medium">Subscriptions</p>
          <p className="text-[22px] font-bold text-[#111111]">{funnel?.find((f: any) => f.key === "subscription_started")?.count || 0}</p>
        </div>
      </div>

      <div>
        <SectionHeader title="Funnel" />
        <div className="space-y-4">
          {stages.map((stage) => (
            <div key={stage.name} className="bg-white rounded-[20px] border border-[#F7F7F7] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] overflow-hidden">
              <div className="px-4 pt-3 pb-2">
                <p className="text-[12px] font-bold text-[#6B7280] uppercase tracking-wider">{stage.name}</p>
              </div>
              <div className="divide-y divide-[#F7F7F7]">
                {stage.steps.map((step: any) => {
                  const barWidth = maxCount > 0 ? Math.max(8, (step.count / maxCount) * 100) : 8;
                  const pctColor = step.conversionPct >= 50 ? "text-emerald-600 bg-emerald-50" : step.conversionPct >= 20 ? "text-[#6B7280] bg-amber-50" : "text-ha-danger bg-ha-danger/5";
                  return (
                    <div key={step.key} className="px-4 py-3" data-testid={`funnel-step-${step.key}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[13px] font-semibold text-[#111111]">{step.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[15px] font-bold text-[#111111]">{step.count}</span>
                          {step.conversionPct !== undefined && step.conversionPct !== null && (
                            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${pctColor}`}>{step.conversionPct}%</span>
                          )}
                        </div>
                      </div>
                      <div className="h-2 bg-[#F7F7F7] rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-ha-primary transition-all duration-500" style={{ width: `${barWidth}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionHeader title="Conversion insights" />
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Activation", value: `${metrics.activationRate}%`, sub: `${metrics.usersWithMatch}/${metrics.totalUsers}`, icon: Target, color: "blue" },
            { label: "View rate", value: `${metrics.listingViewRate}%`, sub: `${metrics.listingViewers} viewers`, icon: Eye, color: "green" },
            { label: "Reaction rate", value: `${metrics.reactionRate}%`, sub: `${metrics.reactors} reacted`, icon: MessageCircle, color: "purple" },
            { label: "Trial → Paid", value: `${metrics.trialToPaid}%`, sub: `${metrics.paidUsers} paid`, icon: Percent, color: "amber" },
          ].map(({ label, value, sub, icon: Icon, color }) => {
            return (
              <div key={label} className="bg-white rounded-[20px] border border-[#F7F7F7] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] p-4" data-testid={`insight-${label.toLowerCase().replace(/\s/g, "-")}`}>
                <Icon className="w-5 h-5 text-[#111111] mb-2" />
                <p className="text-[20px] font-bold text-[#111111]">{value}</p>
                <p className="text-[11px] text-[#6B7280] mt-0.5">{label}</p>
                <p className="text-[10px] text-[#9CA3AF] mt-0.5">{sub}</p>
              </div>
            );
          })}
        </div>
      </div>

      {retentionData && (
        <div>
          <SectionHeader title="Retention" />
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="bg-white rounded-[20px] border border-[#F7F7F7] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] p-3 text-center">
              <p className="text-[18px] font-bold text-[#111111]">{retentionData.cancellations7d}</p>
              <p className="text-[10px] text-[#6B7280]">Cancels 7d</p>
            </div>
            <div className="bg-white rounded-[20px] border border-[#F7F7F7] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] p-3 text-center">
              <p className="text-[18px] font-bold text-[#111111]">{retentionData.cancellations30d}</p>
              <p className="text-[10px] text-[#6B7280]">Cancels 30d</p>
            </div>
            <div className="bg-white rounded-[20px] border border-[#F7F7F7] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] p-3 text-center">
              <p className="text-[18px] font-bold text-[#111111]">{retentionData.avgDaysBeforeCancel}d</p>
              <p className="text-[10px] text-[#6B7280]">Avg active</p>
            </div>
          </div>
        </div>
      )}

      {cityPerformance && cityPerformance.length > 0 && (
        <div>
          <SectionHeader title="City performance" />
          <div className="bg-white rounded-[20px] border border-[#F7F7F7] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] divide-y divide-[#F7F7F7]">
            {cityPerformance.map((row: any) => (
              <div key={row.city} className="px-4 py-3" data-testid={`city-row-${row.city}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] font-semibold text-[#111111]">{row.city}</span>
                  <span className="text-[12px] text-[#6B7280]">{row.users} users</span>
                </div>
                <div className="flex gap-3 text-[11px] text-[#6B7280]">
                  <span>{row.search_profiles} profiles</span>
                  <span>{row.matches} matches</span>
                  <span>{row.listing_views} views</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const SOURCE_HEALTH_CITIES = ["All", "Berlin", "Hamburg", "München", "Köln", "Frankfurt", "Stuttgart", "Düsseldorf", "Leipzig"];

function SourcesTab() {
  const [sources, setSources] = useState<any[]>([]);
  const [latestRun, setLatestRun] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [listingTotal, setListingTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listingLoading, setListingLoading] = useState(false);
  const [cityFilter, setCityFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [section, setSection] = useState<"monitor" | "listings">("monitor");
  const [listingPage, setListingPage] = useState(1);
  const [cityInput, setCityInput] = useState("");
  const [sourceInput, setSourceInput] = useState("");

  useEffect(() => {
    adminFetch("/api/admin/portal/sources")
      .then((d) => { setSources(d.sources || []); setLatestRun(d.latestRun); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (section !== "listings") return;
    setListingLoading(true);
    const params = new URLSearchParams({ page: String(listingPage), limit: "50" });
    if (cityInput) params.set("city", cityInput);
    if (sourceInput) params.set("source", sourceInput);
    adminFetch(`/api/admin/portal/listings?${params}`)
      .then((d) => { setListings(d.listings || []); setListingTotal(d.total || 0); })
      .catch(() => {})
      .finally(() => setListingLoading(false));
  }, [section, listingPage, cityInput, sourceInput]);

  const filteredSources = sources.filter((s) => {
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
    <div className="space-y-6 pb-4">
      <h1 className="text-[22px] font-bold text-[#111111]">Sources</h1>

      <div className="flex gap-2">
        {(["monitor", "listings"] as const).map(s => (
          <button key={s} onClick={() => setSection(s)} className={`px-4 py-2 rounded-full text-[13px] font-semibold transition-colors ${section === s ? "bg-[#111111] text-white shadow-[0_2px_8px_rgba(17,24,39,0.12)]" : "bg-white text-[#6B7280] border border-[#F7F7F7]"}`} data-testid={`tab-${s}`}>
            {s === "monitor" ? "Monitor" : "Listings"}
          </button>
        ))}
      </div>

      {section === "monitor" ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-[20px] border border-[#F7F7F7] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] p-4">
              <p className="text-[11px] text-[#6B7280] font-medium">Active sources</p>
              <p className="text-[22px] font-bold text-emerald-600">{healthySources}</p>
            </div>
            <div className="bg-white rounded-[20px] border border-[#F7F7F7] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] p-4">
              <p className="text-[11px] text-[#6B7280] font-medium">Broken</p>
              <p className="text-[22px] font-bold text-ha-danger">{brokenSources}</p>
            </div>
            <div className="bg-white rounded-[20px] border border-[#F7F7F7] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] p-4">
              <p className="text-[11px] text-[#6B7280] font-medium">Listings found</p>
              <p className="text-[22px] font-bold text-[#111111]">{totalFound}</p>
            </div>
            <div className="bg-white rounded-[20px] border border-[#F7F7F7] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] p-4">
              <p className="text-[11px] text-[#6B7280] font-medium">Last run</p>
              <p className="text-[14px] font-bold text-[#111111]">{latestRun ? `${latestRun.duration_sec}s` : "—"}</p>
              {latestRun && <p className="text-[10px] text-[#6B7280]">{new Date(latestRun.started_at).toLocaleTimeString()}</p>}
            </div>
          </div>

          {latestRun && (
            <div className="bg-white rounded-[20px] border border-[#F7F7F7] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] p-4 flex items-center gap-3">
              <StatusBadge status={latestRun.status} />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-[#111111]">Last ingestion run</p>
                <p className="text-[11px] text-[#6B7280]">{new Date(latestRun.started_at).toLocaleString()} · {latestRun.duration_sec}s</p>
              </div>
            </div>
          )}

          <div>
            <SectionHeader title="Source monitor" />
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 mb-3" style={{ WebkitOverflowScrolling: "touch" }}>
              {["All", "Healthy", "Warning", "Broken"].map(f => (
                <button key={f} onClick={() => setStatusFilter(f)} className={`px-3 py-1.5 rounded-full text-[12px] font-medium flex-shrink-0 transition-colors ${statusFilter === f ? "bg-[#111111] text-white shadow-[0_2px_8px_rgba(17,24,39,0.12)]" : "bg-white text-[#6B7280] border border-[#F7F7F7]"}`} data-testid={`filter-status-${f}`}>
                  {f}
                </button>
              ))}
              <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className="px-3 py-1.5 rounded-full text-[13px] font-medium bg-white text-[#6B7280] border border-[#F7F7F7] cursor-pointer" data-testid="select-source-city">
                {SOURCE_HEALTH_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="bg-white rounded-[20px] border border-[#F7F7F7] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] divide-y divide-[#F7F7F7]">
              {filteredSources.length > 0 ? filteredSources.map((s: any) => {
                const st = s.status || (s.errors > 0 ? "broken" : s.found > 0 ? "active" : "broken");
                return (
                  <div key={`${s.name || s.source}-${s.city || ""}`} className="px-4 py-3" data-testid={`source-card-${s.name || s.source}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <StatusDot status={st} />
                        <span className="text-[13px] font-semibold text-[#111111] truncate">{s.name || s.source}</span>
                      </div>
                      <StatusBadge status={st} />
                    </div>
                    <div className="flex gap-3 text-[11px] text-[#6B7280] ml-4">
                      {s.city && <span>{s.city}</span>}
                      <span>{s.found ?? 0} found</span>
                      <span>{s.inserted ?? 0} new</span>
                      {(s.errors ?? 0) > 0 && <span className="text-ha-danger font-medium">{s.errors} errors</span>}
                    </div>
                  </div>
                );
              }) : (
                <div className="px-4 py-8 text-center text-[13px] text-[#6B7280]">No sources match this filter</div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input placeholder="City..." value={cityInput} onChange={(e) => { setCityInput(e.target.value); setListingPage(1); }} className="flex-1 h-10 px-4 rounded-[16px] bg-[#F7F7F7] text-[14px] text-[#111111] placeholder:text-[#9CA3AF] focus:outline-none" data-testid="input-listing-city" />
            <input placeholder="Source..." value={sourceInput} onChange={(e) => { setSourceInput(e.target.value); setListingPage(1); }} className="flex-1 h-10 px-4 rounded-[16px] bg-[#F7F7F7] text-[14px] text-[#111111] placeholder:text-[#9CA3AF] focus:outline-none" data-testid="input-listing-source" />
          </div>
          <p className="text-[12px] text-[#6B7280]">{listingTotal} listings</p>
          {listingLoading ? <LoadingState /> : (
            <div className="bg-white rounded-[20px] border border-[#F7F7F7] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] divide-y divide-[#F7F7F7]">
              {listings.map((l: any) => (
                <div key={l.id} className="px-4 py-3" data-testid={`listing-card-${l.id}`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[13px] font-semibold text-[#111111] truncate flex-1 mr-2">{l.title || "Untitled"}</p>
                    {l.url && <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-ha-primary flex-shrink-0" data-testid={`link-listing-${l.id}`}><ExternalLink className="w-3.5 h-3.5" /></a>}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-[#6B7280]">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{l.source}</Badge>
                    <span>{l.city}</span>
                    <span>€{l.price || "—"}</span>
                    <span className="ml-auto">{l.created_at ? new Date(l.created_at).toLocaleDateString() : ""}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {listingTotal > 50 && (
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" disabled={listingPage <= 1} onClick={() => setListingPage(p => p - 1)} className="rounded-full" data-testid="button-listing-prev">Previous</Button>
              <span className="text-[12px] text-[#6B7280]">Page {listingPage}</span>
              <Button variant="outline" size="sm" disabled={listings.length < 50} onClick={() => setListingPage(p => p + 1)} className="rounded-full" data-testid="button-listing-next">Next</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CitiesTab() {
  const [cities, setCities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [healthFilter, setHealthFilter] = useState("All");
  const [countryFilter, setCountryFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  function load() {
    setLoading(true);
    adminFetch("/api/admin/portal/dynamic-cities")
      .then((d) => setCities(d.cities || []))
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false); });
  }

  useEffect(() => { load(); }, []);

  const countries = [...new Set(cities.map((c: any) => c.country_code))].sort();

  const filtered = cities.filter((c: any) => {
    if (healthFilter !== "All" && c.health_status !== healthFilter.toLowerCase()) return false;
    if (countryFilter !== "All" && c.country_code !== countryFilter) return false;
    if (searchQuery && !c.city_name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const totalProfiles = cities.reduce((a: number, c: any) => a + c.active_profiles, 0);
  const totalListings7d = cities.reduce((a: number, c: any) => a + c.listings_7d, 0);
  const greenCount = cities.filter((c: any) => c.health_status === "green").length;
  const yellowCount = cities.filter((c: any) => c.health_status === "yellow").length;
  const redCount = cities.filter((c: any) => c.health_status === "red").length;
  const tier3Count = cities.filter((c: any) => c.tier === 3).length;

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-5 pb-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-bold text-[#111111]" data-testid="text-cities-title">City Monitor</h1>
        <button onClick={() => { setRefreshing(true); load(); }} className="w-9 h-9 rounded-full bg-[#F7F7F7] flex items-center justify-center" data-testid="button-refresh-cities">
          <RefreshCw className={`w-4 h-4 text-[#6B7280] ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className={`${CARD} p-3.5`}>
          <Globe className="w-5 h-5 text-[#111111] mb-1.5" />
          <p className="text-[20px] font-bold text-[#111111]" data-testid="metric-total-cities">{cities.length}</p>
          <p className="text-[11px] text-[#6B7280] font-medium">Total cities</p>
        </div>
        <div className={`${CARD} p-3.5`}>
          <Zap className="w-5 h-5 text-ha-primary mb-1.5" />
          <p className="text-[20px] font-bold text-[#111111]" data-testid="metric-dynamic-cities">{tier3Count}</p>
          <p className="text-[11px] text-[#6B7280] font-medium">Dynamic (T3)</p>
        </div>
        <div className={`${CARD} p-3.5`}>
          <Search className="w-5 h-5 text-[#111111] mb-1.5" />
          <p className="text-[20px] font-bold text-[#111111]" data-testid="metric-total-profiles">{totalProfiles}</p>
          <p className="text-[11px] text-[#6B7280] font-medium">Search profiles</p>
        </div>
        <div className={`${CARD} p-3.5`}>
          <Layers className="w-5 h-5 text-[#111111] mb-1.5" />
          <p className="text-[20px] font-bold text-[#111111]" data-testid="metric-listings-7d">{totalListings7d}</p>
          <p className="text-[11px] text-[#6B7280] font-medium">Listings (7d)</p>
        </div>
      </div>

      <div className={`${CARD} p-4`}>
        <p className="text-[12px] font-semibold text-[#6B7280] mb-2">Health overview</p>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span className="text-[13px] font-semibold text-[#111111]" data-testid="metric-health-green">{greenCount}</span>
            <span className="text-[11px] text-[#6B7280]">&gt;20/wk</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="text-[13px] font-semibold text-[#111111]" data-testid="metric-health-yellow">{yellowCount}</span>
            <span className="text-[11px] text-[#6B7280]">5–20</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-ha-danger" />
            <span className="text-[13px] font-semibold text-[#111111]" data-testid="metric-health-red">{redCount}</span>
            <span className="text-[11px] text-[#6B7280]">&lt;5</span>
          </div>
        </div>
      </div>

      <input
        placeholder="Search city..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full h-10 px-4 rounded-[16px] bg-[#F7F7F7] text-[14px] text-[#111111] placeholder:text-[#9CA3AF] focus:outline-none"
        data-testid="input-city-search"
      />

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4" style={{ WebkitOverflowScrolling: "touch" }}>
        {["All", "Green", "Yellow", "Red"].map(f => (
          <button key={f} onClick={() => setHealthFilter(f)} className={`px-3 py-1.5 rounded-full text-[12px] font-medium flex-shrink-0 transition-colors ${healthFilter === f ? PILL_ACTIVE : PILL_INACTIVE}`} data-testid={`filter-health-${f.toLowerCase()}`}>
            {f === "All" ? "All" : <span className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${f === "Green" ? "bg-emerald-400" : f === "Yellow" ? "bg-amber-400" : "bg-ha-danger"}`} />{f}</span>}
          </button>
        ))}
        {countries.length > 1 && (
          <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)} className="px-3 py-1.5 rounded-full text-[12px] font-medium bg-white text-[#6B7280] border border-[#F7F7F7] cursor-pointer" data-testid="select-country-filter">
            <option value="All">All countries</option>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      <p className="text-[12px] text-[#6B7280]">{filtered.length} cities</p>

      <div className={`${CARD_ELEVATED} divide-y divide-[#F7F7F7]`}>
        {filtered.length > 0 ? filtered.map((c: any) => {
          const healthColor = c.health_status === "green" ? "bg-emerald-400" : c.health_status === "yellow" ? "bg-amber-400" : "bg-ha-danger";
          const tierLabel = c.tier === 1 ? "T1" : c.tier === 2 ? "T2" : "T3";
          const tierColor = c.tier === 3 ? "bg-orange-50 text-ha-primary border-orange-200" : "bg-[#F7F7F7] text-[#6B7280] border-[#E5E7EB]";
          return (
            <div key={c.city_name} className="px-4 py-3.5" data-testid={`city-row-${c.city_name.toLowerCase().replace(/\s/g, "-")}`}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${healthColor}`} />
                  <span className="text-[14px] font-semibold text-[#111111] truncate">{c.city_name}</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${tierColor}`}>{tierLabel}</span>
                </div>
                <span className="text-[11px] text-[#6B7280] flex-shrink-0">{c.country_code}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-2">
                <div>
                  <p className="text-[10px] text-[#9CA3AF] font-medium">Profiles</p>
                  <p className="text-[14px] font-bold text-[#111111]">{c.active_profiles}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#9CA3AF] font-medium">Last run</p>
                  <p className="text-[14px] font-bold text-[#111111]">{c.listings_last_run}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#9CA3AF] font-medium">7-day</p>
                  <p className="text-[14px] font-bold text-[#111111]">{c.listings_7d}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                {c.active_sources.map((s: string) => (
                  <span key={s} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">{s}</span>
                ))}
                {c.failed_sources.map((f: any, i: number) => (
                  <span key={i} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-ha-danger/5 text-ha-danger border border-ha-danger/20" title={f.reason}>{f.name}</span>
                ))}
              </div>

              {c.last_scraped_at && (
                <p className="text-[10px] text-[#9CA3AF] mt-1.5">Last scraped: {new Date(c.last_scraped_at).toLocaleString()}</p>
              )}
            </div>
          );
        }) : (
          <div className="px-4 py-8 text-center text-[13px] text-[#6B7280]">No cities match this filter</div>
        )}
      </div>
    </div>
  );
}

function UserDetailView({ detail, onBack }: { detail: any; onBack: () => void }) {
  const { profile, subscription, searchProfiles, recentMatches, cancellationFeedback, notificationSettings } = detail;

  return (
    <div className="space-y-4 pb-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[13px] text-ha-primary font-medium" data-testid="button-back-users">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="bg-white rounded-[20px] border border-[#F7F7F7] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] p-4">
        <h3 className="text-[15px] font-bold text-[#111111] mb-3">Profile</h3>
        <div className="space-y-2.5 text-[13px]">
          <div className="flex justify-between"><span className="text-[#6B7280]">Name</span><span className="font-medium text-[#111111]">{profile?.first_name || ""} {profile?.last_name || ""}</span></div>
          <div className="flex justify-between"><span className="text-[#6B7280]">Email</span><span className="font-medium text-[#111111] max-w-[200px] truncate">{profile?.email || "—"}</span></div>
          <div className="flex justify-between"><span className="text-[#6B7280]">Phone</span><span className="font-medium text-[#111111]">{profile?.phone || "—"}</span></div>
          <div className="flex justify-between"><span className="text-[#6B7280]">Occupation</span><span className="font-medium text-[#111111]">{profile?.occupation || "—"}</span></div>
          <div className="flex justify-between"><span className="text-[#6B7280]">Created</span><span className="font-medium text-[#111111]">{profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "—"}</span></div>
          <div className="flex justify-between items-center">
            <span className="text-[#6B7280]">Notifications</span>
            <div className="flex gap-1.5">
              {notificationSettings?.email_enabled && <Badge variant="secondary" className="text-[10px]">Email</Badge>}
              {notificationSettings?.push_enabled && <Badge variant="secondary" className="text-[10px]">Push</Badge>}
              {!notificationSettings?.email_enabled && !notificationSettings?.push_enabled && <span className="text-[#6B7280]">None</span>}
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#6B7280]">Search Buddy</span>
            {profile?.search_buddy_email ? (
              <div className="flex items-center gap-1.5">
                <Badge className="text-[10px] bg-orange-50 text-ha-primary">Active</Badge>
                <span className="font-medium text-[#111111] text-[12px] max-w-[160px] truncate">{profile.search_buddy_email}</span>
              </div>
            ) : (
              <span className="text-[#6B7280]">—</span>
            )}
          </div>
          <div><span className="text-[#6B7280] text-[11px] break-all">{profile?.user_id || ""}</span></div>
        </div>
      </div>

      {subscription && (
        <div className="bg-white rounded-[20px] border border-[#F7F7F7] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] p-4">
          <h3 className="text-[15px] font-bold text-[#111111] mb-3">Subscription</h3>
          <div className="space-y-2.5 text-[13px]">
            <div className="flex justify-between items-center"><span className="text-[#6B7280]">Status</span><StatusBadge status={subscription.status} /></div>
            <div className="flex justify-between"><span className="text-[#6B7280]">Plan</span><span className="font-medium">{subscription.plan || "—"}</span></div>
            <div className="flex justify-between"><span className="text-[#6B7280]">Trial ends</span><span className="font-medium">{subscription.trial_ends_at ? new Date(subscription.trial_ends_at).toLocaleDateString() : "—"}</span></div>
            <div className="flex justify-between"><span className="text-[#6B7280]">Period ends</span><span className="font-medium">{subscription.current_period_ends_at ? new Date(subscription.current_period_ends_at).toLocaleDateString() : "—"}</span></div>
            {subscription.stripe_subscription_id && (
              <a href={`https://dashboard.stripe.com/subscriptions/${subscription.stripe_subscription_id}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-ha-primary text-[12px] font-medium" data-testid="link-stripe-sub">
                <ExternalLink className="w-3 h-3" /> View in Stripe
              </a>
            )}
          </div>
        </div>
      )}

      {searchProfiles && searchProfiles.length > 0 && (
        <div className="bg-white rounded-[20px] border border-[#F7F7F7] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] p-4">
          <h3 className="text-[15px] font-bold text-[#111111] mb-3">Search profiles ({searchProfiles.length})</h3>
          <div className="space-y-2">
            {searchProfiles.map((sp: any) => (
              <div key={sp.id} className="p-3 bg-[#F7F7F7] rounded-[16px] text-[12px]">
                <p className="font-semibold text-[#111111] mb-0.5">{sp.city_name || sp.city}</p>
                <p className="text-[#6B7280]">€{sp.price_min || 0}–€{sp.price_max || "∞"} · {sp.bedrooms_min || 0}+ rooms · {sp.size_min || 0}+ m²</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {recentMatches && recentMatches.length > 0 && (
        <div className="bg-white rounded-[20px] border border-[#F7F7F7] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] p-4">
          <h3 className="text-[15px] font-bold text-[#111111] mb-3">Recent matches ({recentMatches.length})</h3>
          <div className="space-y-2">
            {recentMatches.slice(0, 10).map((m: any) => (
              <div key={m.id} className="flex items-center gap-2 p-2.5 bg-[#F7F7F7] rounded-[16px] text-[12px]">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[#111111] truncate">{m.listing_title || m.listing_id?.substring(0, 12)}</p>
                  <p className="text-[#6B7280]">{m.matched_at ? new Date(m.matched_at).toLocaleString() : "—"}</p>
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
        <div className="bg-white rounded-[20px] border border-[#F7F7F7] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] p-4">
          <h3 className="text-[15px] font-bold text-[#111111] mb-3">Cancellation feedback</h3>
          <div className="space-y-2 text-[13px]">
            <div className="flex justify-between"><span className="text-[#6B7280]">Reason</span><span className="font-medium">{cancellationFeedback.reason || "—"}</span></div>
            {cancellationFeedback.feedback && <p className="text-[#6B7280] text-[12px] bg-[#F7F7F7] rounded-[16px] p-3">{cancellationFeedback.feedback}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function SubscriptionsSection() {
  const [subs, setSubs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    adminFetch(`/api/admin/portal/subscriptions?filter=${filter}&page=${page}&limit=50`)
      .then((d) => { setSubs(d.subscriptions || []); setTotal(d.total ?? 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter, page]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4" style={{ WebkitOverflowScrolling: "touch" }}>
        {["all", "active", "trial", "canceled", "expired"].map(f => (
          <button key={f} onClick={() => { setFilter(f); setPage(1); }} className={`px-3 py-1.5 rounded-full text-[12px] font-medium flex-shrink-0 transition-colors ${filter === f ? "bg-[#111111] text-white shadow-[0_2px_8px_rgba(17,24,39,0.12)]" : "bg-white text-[#6B7280] border border-[#F7F7F7]"}`} data-testid={`filter-sub-${f}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <span className="text-[12px] text-[#6B7280] self-center ml-auto flex-shrink-0">{total}</span>
      </div>
      {loading ? <LoadingState /> : subs.length === 0 ? (
        <EmptyState title="No subscriptions" message={`No subscriptions found for "${filter}".`} />
      ) : (
        <div className="bg-white rounded-[20px] border border-[#F7F7F7] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] divide-y divide-[#F7F7F7]">
          {subs.map((s: any) => (
            <div key={s.id} className="px-4 py-3" data-testid={`sub-card-${s.id}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[#111111] truncate">{s.userName || "Unknown"}</p>
                  <p className="text-[10px] text-[#6B7280]">{s.user_id?.substring(0, 8)}...</p>
                </div>
                <StatusBadge status={s.status} />
              </div>
              <div className="flex items-center gap-3 text-[11px] text-[#6B7280]">
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
          <span className="text-[12px] text-[#6B7280]">Page {page}</span>
          <Button variant="outline" size="sm" disabled={subs.length < 50} onClick={() => setPage(p => p + 1)} className="rounded-full" data-testid="button-sub-next">Next</Button>
        </div>
      )}
    </div>
  );
}

function SearchProfilesSection() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    adminFetch(`/api/admin/portal/search-profiles?page=${page}&limit=50`)
      .then((d) => { setProfiles(d.profiles || []); setTotal(d.total || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-[#6B7280]">{total} search profiles</p>
      {loading ? <LoadingState /> : profiles.length === 0 ? (
        <EmptyState title="No profiles" message="No search profiles found." />
      ) : (
        <div className="bg-white rounded-[20px] border border-[#F7F7F7] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] divide-y divide-[#F7F7F7]">
          {profiles.map((p: any) => (
            <div key={p.id} className="px-4 py-3" data-testid={`profile-card-${p.id}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[13px] font-semibold text-[#111111] truncate">{p.userName || "Unknown"}</p>
                <span className="text-[12px] font-medium text-[#111111]">{p.city_name || p.city}</span>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] text-[#6B7280]">
                <span>€{p.price_min || 0}–€{p.price_max || "∞"}</span>
                <span>{p.bedrooms_min || 0}+ rooms</span>
                <span>{p.size_min || 0}+ m²</span>
                {p.location_mode && <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{p.location_mode}</Badge>}
                {p.districts?.length > 0 && <span>({p.districts.length} districts)</span>}
                <span className="ml-auto">{p.created_at ? new Date(p.created_at).toLocaleDateString() : ""}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {total > 50 && (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-full" data-testid="button-profile-prev">Previous</Button>
          <span className="text-[12px] text-[#6B7280]">Page {page}</span>
          <Button variant="outline" size="sm" disabled={profiles.length < 50} onClick={() => setPage(p => p + 1)} className="rounded-full" data-testid="button-profile-next">Next</Button>
        </div>
      )}
    </div>
  );
}

function MatchesSection() {
  const [matches, setMatches] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    adminFetch(`/api/admin/portal/matches?page=${page}&limit=50`)
      .then((d) => { setMatches(d.matches || []); setTotal(d.total || 0); setStats(d.stats || null); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="space-y-4">
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-[20px] border border-[#F7F7F7] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] p-3 text-center">
            <p className="text-[16px] font-bold text-[#111111]">{stats.emailsToday}</p>
            <p className="text-[10px] text-[#6B7280]">Emails</p>
          </div>
          <div className="bg-white rounded-[20px] border border-[#F7F7F7] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] p-3 text-center">
            <p className="text-[16px] font-bold text-[#111111]">{stats.pushesToday}</p>
            <p className="text-[10px] text-[#6B7280]">Push</p>
          </div>
          <div className="bg-white rounded-[20px] border border-[#F7F7F7] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] p-3 text-center">
            <p className="text-[16px] font-bold text-ha-danger">{stats.failuresWeek}</p>
            <p className="text-[10px] text-[#6B7280]">Failures 7d</p>
          </div>
        </div>
      )}
      <p className="text-[12px] text-[#6B7280]">{total} matches</p>
      {loading ? <LoadingState /> : (
        <div className="bg-white rounded-[20px] border border-[#F7F7F7] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] divide-y divide-[#F7F7F7]">
          {matches.map((m: any) => (
            <div key={m.id} className="px-4 py-3" data-testid={`match-card-${m.id}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[13px] font-semibold text-[#111111] truncate flex-1 mr-2">{m.first_name || ""} {m.last_name || ""}</p>
                <span className="text-[10px] text-[#6B7280]">{m.matched_at ? new Date(m.matched_at).toLocaleString() : ""}</span>
              </div>
              <p className="text-[11px] text-[#6B7280] truncate mb-1">{m.listing_title || m.listing_id?.substring(0, 12)}</p>
              <div className="flex gap-1.5">
                {m.email_sent && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium">Email</span>}
                {m.push_sent && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-50 text-ha-primary font-medium">Push</span>}
                {m.viewed && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">Viewed</span>}
                {!m.email_sent && !m.push_sent && <span className="text-[10px] text-[#9CA3AF]">Not delivered</span>}
              </div>
            </div>
          ))}
          {matches.length === 0 && <div className="px-4 py-8 text-center text-[13px] text-[#6B7280]">No matches found</div>}
        </div>
      )}
      {total > 50 && (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-full" data-testid="button-match-prev">Previous</Button>
          <span className="text-[12px] text-[#6B7280]">Page {page}</span>
          <Button variant="outline" size="sm" disabled={matches.length < 50} onClick={() => setPage(p => p + 1)} className="rounded-full" data-testid="button-match-next">Next</Button>
        </div>
      )}
    </div>
  );
}

function UsersTab() {
  const [section, setSection] = useState<"users" | "subs" | "profiles" | "matches">("users");
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadUsers = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "50", filter });
    if (search) params.set("search", search);
    adminFetch(`/api/admin/portal/users?${params}`)
      .then((d) => { setUsers(d.users || []); setTotal(d.total || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, filter, search]);

  useEffect(() => { if (section === "users") loadUsers(); }, [loadUsers, section]);

  function openUser(userId: string) {
    setSelectedUser(userId);
    setDetailLoading(true);
    adminFetch(`/api/admin/portal/users/${userId}`)
      .then(setUserDetail)
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  }

  if (selectedUser) {
    if (detailLoading) return <LoadingState />;
    if (userDetail) return <UserDetailView detail={userDetail} onBack={() => { setSelectedUser(null); setUserDetail(null); }} />;
    return <EmptyState title="User not found" message="This user could not be loaded." onRetry={() => { setSelectedUser(null); }} />;
  }

  return (
    <div className="space-y-4 pb-4">
      <h1 className="text-[22px] font-bold text-[#111111]">Users</h1>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4" style={{ WebkitOverflowScrolling: "touch" }}>
        {([
          { id: "users" as const, label: "Users" },
          { id: "subs" as const, label: "Subscriptions" },
          { id: "profiles" as const, label: "Profiles" },
          { id: "matches" as const, label: "Matches" },
        ]).map(s => (
          <button key={s.id} onClick={() => setSection(s.id)} className={`px-4 py-2 rounded-full text-[13px] font-semibold flex-shrink-0 transition-colors ${section === s.id ? "bg-[#111111] text-white shadow-[0_2px_8px_rgba(17,24,39,0.12)]" : "bg-white text-[#6B7280] border border-[#F7F7F7]"}`} data-testid={`section-${s.id}`}>
            {s.label}
          </button>
        ))}
      </div>

      {section === "subs" ? <SubscriptionsSection /> :
       section === "profiles" ? <SearchProfilesSection /> :
       section === "matches" ? <MatchesSection /> : (
        <>
          <div className="bg-white rounded-[20px] border border-[#F7F7F7] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] px-4 py-3 flex items-center gap-3">
            <Search className="w-5 h-5 text-[#9CA3AF] flex-shrink-0" />
            <input
              placeholder="Search name or email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="flex-1 text-[14px] text-[#111111] bg-transparent focus:outline-none placeholder:text-[#9CA3AF]"
              data-testid="input-search-users"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4" style={{ WebkitOverflowScrolling: "touch" }}>
            {["all", "paid", "trial", "canceled", "expired"].map(f => (
              <button key={f} onClick={() => { setFilter(f); setPage(1); }} className={`px-3 py-1.5 rounded-full text-[12px] font-medium flex-shrink-0 transition-colors ${filter === f ? "bg-[#111111] text-white shadow-[0_2px_8px_rgba(17,24,39,0.12)]" : "bg-white text-[#6B7280] border border-[#F7F7F7]"}`} data-testid={`filter-user-${f}`}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
            <span className="text-[12px] text-[#6B7280] self-center ml-auto flex-shrink-0">{total} users</span>
          </div>

          {loading ? <LoadingState /> : (
            <div className="bg-white rounded-[20px] border border-[#F7F7F7] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] divide-y divide-[#F7F7F7]">
              {users.map((u: any) => (
                <button key={u.user_id} onClick={() => openUser(u.user_id)} className="w-full px-4 py-3 flex items-center gap-3 text-left" data-testid={`user-card-${u.user_id}`}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-[13px] font-bold ${u.has_profile_data === false ? "bg-[#F7F7F7] text-[#9CA3AF]" : "bg-[#F7F7F7] text-ha-primary"}`}>
                    {(u.first_name || u.email || "?")[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#111111] truncate">{u.first_name || u.email || "Unknown"} {u.last_name || ""}</p>
                    <p className="text-[11px] text-[#6B7280] truncate">{u.email || u.user_id?.substring(0, 8)} · {u.searchProfileCount || 0} profiles · {u.matchCount || 0} matches</p>
                    {u.search_buddy_email && <p className="text-[10px] text-ha-primary truncate">Buddy: {u.search_buddy_email}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {u.subscription ? <StatusBadge status={u.subscription.status} /> : <span className="text-[11px] text-[#9CA3AF]">No sub</span>}
                    {u.search_buddy_email && <Badge variant="secondary" className="text-[9px] px-1.5">Buddy</Badge>}
                    <span className="text-[10px] text-[#9CA3AF]">{u.created_at ? new Date(u.created_at).toLocaleDateString() : ""}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-200 flex-shrink-0" />
                </button>
              ))}
              {users.length === 0 && <div className="px-4 py-8 text-center text-[13px] text-[#6B7280]">No users found</div>}
            </div>
          )}

          {total > 50 && (
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-full" data-testid="button-user-prev">Previous</Button>
              <span className="text-[12px] text-[#6B7280]">Page {page}</span>
              <Button variant="outline" size="sm" disabled={users.length < 50} onClick={() => setPage(p => p + 1)} className="rounded-full" data-testid="button-user-next">Next</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SystemTab() {
  const [checks, setChecks] = useState<Record<string, any> | null>(null);
  const [matchStats, setMatchStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([
      adminFetch("/api/admin/portal/system-status").catch(() => null),
      adminFetch("/api/admin/portal/matches?page=1&limit=1").catch(() => null),
    ]).then(([sys, matches]) => {
      setChecks(sys);
      setMatchStats(matches?.stats || null);
    }).finally(() => { setLoading(false); setRefreshing(false); });
  }

  useEffect(() => { load(); }, []);

  const labels: Record<string, { name: string; desc: string }> = {
    stripe: { name: "Stripe Payments", desc: "Payment processing" },
    placesApi: { name: "Google Places API", desc: "Location services" },
    ingestionScheduler: { name: "Ingestion Scheduler", desc: "Listing scraper" },
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
    <div className="space-y-6 pb-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-bold text-[#111111]">System</h1>
        <button onClick={() => { setRefreshing(true); load(); }} className="w-9 h-9 rounded-full bg-[#F7F7F7] flex items-center justify-center" data-testid="button-refresh-system">
          <RefreshCw className={`w-4 h-4 text-[#6B7280] ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {matchStats && (
        <div>
          <SectionHeader title="Delivery today" />
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-[20px] border border-[#F7F7F7] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] p-3 text-center">
              <Mail className="w-4 h-4 text-[#111111] mx-auto mb-1" />
              <p className="text-[18px] font-bold text-[#111111]">{matchStats.emailsToday}</p>
              <p className="text-[10px] text-[#6B7280]">Emails</p>
            </div>
            <div className="bg-white rounded-[20px] border border-[#F7F7F7] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] p-3 text-center">
              <Smartphone className="w-4 h-4 text-[#111111] mx-auto mb-1" />
              <p className="text-[18px] font-bold text-[#111111]">{matchStats.pushesToday}</p>
              <p className="text-[10px] text-[#6B7280]">Push</p>
            </div>
            <div className="bg-white rounded-[20px] border border-[#F7F7F7] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] p-3 text-center">
              <AlertTriangle className="w-4 h-4 text-ha-danger mx-auto mb-1" />
              <p className="text-[18px] font-bold text-[#111111]">{matchStats.failuresWeek}</p>
              <p className="text-[10px] text-[#6B7280]">Failures 7d</p>
            </div>
          </div>
        </div>
      )}

      {loading ? <LoadingState /> : checks ? (
        <div>
          <SectionHeader title="Service status" />
          <div className="bg-white rounded-[20px] border border-[#F7F7F7] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] divide-y divide-[#F7F7F7]">
            {Object.entries(checks).map(([key, val]) => {
              const Icon = serviceIcons[key] || Settings;
              const info = labels[key] || { name: key, desc: "" };
              return (
                <div key={key} className="flex items-center gap-3 px-4 py-3.5" data-testid={`status-${key}`}>
                  <Icon className="w-5 h-5 text-[#111111] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#111111]">{info.name}</p>
                    <p className="text-[11px] text-[#6B7280] truncate">{val.message}</p>
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

const TAB_CONFIG = [
  { id: "dashboard" as TabId, label: "Home", icon: LayoutDashboard },
  { id: "growth" as TabId, label: "Growth", icon: TrendingUp },
  { id: "sources" as TabId, label: "Sources", icon: Radio },
  { id: "cities" as TabId, label: "Cities", icon: Globe },
  { id: "users" as TabId, label: "Users", icon: Users },
  { id: "system" as TabId, label: "System", icon: Signal },
];

export default function AdminPortalPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [accessDenied, setAccessDenied] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!user) { setChecking(false); return; }
    adminFetch("/api/admin/portal/system-status")
      .then(() => setChecking(false))
      .catch((err) => {
        if (err.message === "ACCESS_DENIED") setAccessDenied(true);
        setChecking(false);
      });
  }, [user]);

  if (checking) return <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center"><Loader2 className="w-7 h-7 text-ha-primary animate-spin" /></div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center px-5">
        <div className="text-center max-w-sm">
          <h1 className="text-[20px] font-bold text-[#111111] mb-2">Not authenticated</h1>
          <p className="text-[13px] text-[#6B7280] mb-4">Please log in to access the admin portal.</p>
          <Button onClick={() => navigate("/")} className="rounded-full" data-testid="button-login">Go to login</Button>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center px-5">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-ha-danger/5 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 text-ha-danger" />
          </div>
          <h1 className="text-[20px] font-bold text-[#111111] mb-2">Access Denied</h1>
          <p className="text-[13px] text-[#6B7280]">Your account does not have admin access.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex flex-col">
      <header className="bg-white border-b border-[#F7F7F7] sticky top-0 z-30">
        <div className="max-w-lg mx-auto px-4 h-[52px] flex items-center gap-3">
          <HousAlertLogo size={28} />
          <div className="flex-1" />
          <button onClick={() => navigate("/dashboard")} className="text-[13px] text-[#6B7280] hover:text-ha-primary font-medium" data-testid="link-back-app">Back to app</button>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-5 pb-24 overflow-x-hidden">
        {activeTab === "dashboard" && <DashboardTab onNavigate={setActiveTab} userName={user.user_metadata?.first_name || user.email?.split("@")[0] || "Admin"} />}
        {activeTab === "growth" && <GrowthTab />}
        {activeTab === "sources" && <SourcesTab />}
        {activeTab === "cities" && <CitiesTab />}
        {activeTab === "users" && <UsersTab />}
        {activeTab === "system" && <SystemTab />}
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#F7F7F7]" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }} data-testid="bottom-tab-bar">
        <nav className="max-w-lg mx-auto flex h-[58px]">
          {TAB_CONFIG.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className="flex-1 flex flex-col items-center justify-center gap-[5px]"
                data-testid={`tab-${id}`}
              >
                <Icon className={`w-[28px] h-[28px] transition-colors ${active ? "text-ha-primary" : "text-[#6B7280]"}`} strokeWidth={active ? 2 : 1.5} />
                <span className={`text-[10px] transition-colors ${active ? "font-medium text-ha-primary" : "font-normal text-[#6B7280]"}`}>{label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
