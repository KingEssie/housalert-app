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
  Radio, Layers, Settings, Bell, Send, Power,
  LayoutDashboard, Signal, Image, Trash2, Pencil,
  Save, X, RotateCw, Menu, ChevronDown, MoreVertical, Star, EyeOff, Lock, ToggleLeft, ToggleRight, Sliders,
} from "lucide-react";
import { HousAlertLogo } from "@/components/housalert-logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";

type TabId = "dashboard" | "listings" | "images" | "sources" | "users" | "subscriptions" | "alerts" | "settings" | "system";

async function adminFetch(path: string, options?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Not authenticated");
  const res = await apiFetch(path, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options?.headers || {}) },
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
    past_due: { cls: "bg-amber-50 text-amber-700 border-amber-200", label: "Past Due" },
    canceled: { cls: "bg-ha-danger/5 text-ha-danger border-ha-danger/20", label: "Canceled" },
    expired: { cls: "bg-[#F7F7F7] text-[#334855] border-[#E5E7EB]", label: "Expired" },
    error: { cls: "bg-ha-danger/5 text-ha-danger border-ha-danger/20", label: "Error" },
    warning: { cls: "bg-amber-50 text-amber-700 border-amber-200", label: "Warning" },
    disabled: { cls: "bg-[#F7F7F7] text-[#334855] border-[#E5E7EB]", label: "Disabled" },
    success: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Success" },
    partial: { cls: "bg-amber-50 text-amber-700 border-amber-200", label: "Partial" },
    failed: { cls: "bg-ha-danger/5 text-ha-danger border-ha-danger/20", label: "Failed" },
    broken: { cls: "bg-ha-danger/5 text-ha-danger border-ha-danger/20", label: "Broken" },
    degraded: { cls: "bg-amber-50 text-amber-700 border-amber-200", label: "Degraded" },
  };
  const m = map[status] || { cls: "bg-[#F7F7F7] text-[#334855] border-[#E5E7EB]", label: status };
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${m.cls}`}>{m.label}</span>;
}

const CARD = "bg-white rounded-2xl border border-[#F0F0F0] shadow-sm";

function SectionHeader({ title, action }: { title: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-[15px] font-semibold text-[#111]">{title}</h3>
      {action && <button onClick={action.onClick} className="text-[13px] font-medium text-ha-primary" data-testid={`action-${title.toLowerCase().replace(/\s/g, "-")}`}>{action.label}</button>}
    </div>
  );
}

function MetricCard({ label, value, sub, icon: Icon }: { label: string; value: string | number; sub?: string; icon: any }) {
  return (
    <div className={`${CARD} p-4`} data-testid={`metric-${label.toLowerCase().replace(/\s/g, "-")}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-[#334855]" />
        <span className="text-[11px] text-[#334855] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-[22px] font-bold text-[#111]">{value}</p>
      {sub && <p className="text-[11px] text-[#334855] mt-0.5">{sub}</p>}
    </div>
  );
}

function EmptyState({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) {
  return (
    <div className={`${CARD} p-8 text-center`}>
      <Database className="w-6 h-6 text-[#334855] mx-auto mb-3" />
      <h4 className="text-[15px] font-semibold text-[#111] mb-1">{title}</h4>
      <p className="text-[13px] text-[#334855] mb-4">{message}</p>
      {onRetry && <Button variant="outline" size="sm" onClick={onRetry} className="rounded-full" data-testid="button-retry">Try again</Button>}
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
        <h3 className="text-[16px] font-bold text-[#111] mb-2">{title}</h3>
        <p className="text-[13px] text-[#334855] mb-5">{message}</p>
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

  const imageCoverage = data.imageCoverage ?? "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold text-[#111]" data-testid="text-greeting">{getGreeting()}, {userName}</h1>
          <p className="text-[13px] text-[#334855] mt-0.5">Here's what's happening today</p>
        </div>
        <button onClick={() => { setRefreshing(true); load(); }} className="w-9 h-9 rounded-full bg-[#F7F7F7] flex items-center justify-center hover:bg-[#EFEFEF] transition-colors" data-testid="button-refresh-dashboard">
          <RefreshCw className={`w-4 h-4 text-[#334855] ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {alerts.length > 0 && (
        <div>
          <SectionHeader title="Needs attention" />
          <div className={`${CARD} divide-y divide-[#F7F7F7]`}>
            {alerts.map((a: any, i: number) => {
              const sColor = a.severity === "critical" ? "bg-ha-danger" : a.severity === "warning" ? "bg-amber-400" : "bg-ha-primary";
              return (
                <div key={i} className="flex items-start gap-3 px-4 py-3.5" data-testid={`alert-row-${i}`}>
                  <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${sColor}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#111] leading-snug">{a.message}</p>
                    <p className="text-[11px] text-[#334855] mt-0.5">{new Date(a.timestamp).toLocaleTimeString()}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <MetricCard label="Total listings" value={data.listingsToday} sub={`${data.listingsWeek} this week`} icon={Layers} />
        <MetricCard label="New today" value={data.listingsToday} sub="listings added" icon={TrendingUp} />
        <MetricCard label="Image coverage" value={typeof imageCoverage === "number" ? `${imageCoverage}%` : imageCoverage} icon={Image} />
        <MetricCard label="Active users" value={data.totalUsers} sub={`${data.signupsToday} new today`} icon={Users} />
        <MetricCard label="Paid subs" value={data.activeSubscriptions} sub={`MRR €${data.mrr}`} icon={CreditCard} />
        <MetricCard label="Trial users" value={data.trialUsers} icon={Zap} />
      </div>

      <div>
        <SectionHeader title="Today at a glance" />
        <div className={`${CARD} p-4 space-y-3`}>
          {[
            { label: "Matches today", value: data.matchesToday },
            { label: "Emails sent", value: data.emailsToday, color: "text-emerald-600" },
            { label: "Emails skipped (no sub)", value: data.emailsSkippedNoSub ?? 0, color: "text-[#334855]" },
            { label: "Real email failures", value: data.emailRealFailures ?? 0, color: (data.emailRealFailures ?? 0) > 0 ? "text-ha-danger" : "text-[#334855]" },
            { label: "Push sent", value: data.pushesToday },
            { label: "Signups this week", value: data.signupsWeek },
            { label: "Listings this week", value: data.listingsWeek },
            { label: "Matches this week", value: data.matchesWeek },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex items-center justify-between text-[13px]">
              <span className="text-[#334855]">{label}</span>
              <span className={`font-semibold ${color || "text-[#111]"}`}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {data.sourceHealth && data.sourceHealth.length > 0 && (
        <div>
          <SectionHeader title="Source health" action={{ label: "View all", onClick: () => onNavigate("sources") }} />
          <div className={`${CARD} divide-y divide-[#F7F7F7]`}>
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
                  <span className="text-[13px] font-medium text-[#111] flex-1">{city}</span>
                  <span className="text-[12px] text-[#334855]">{info.total} listings</span>
                  <StatusBadge status={info.issues > 0 ? "degraded" : "active"} />
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      <div>
        <SectionHeader title="Quick actions" />
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { icon: Layers, label: "Listings", tab: "listings" as TabId },
            { icon: Image, label: "Images", tab: "images" as TabId },
            { icon: Users, label: "Users", tab: "users" as TabId },
            { icon: Bell, label: "Alerts", tab: "alerts" as TabId },
            { icon: Sliders, label: "Settings", tab: "settings" as TabId },
            { icon: Settings, label: "System", tab: "system" as TabId },
          ].map(({ icon: Icon, label, tab }) => (
            <button key={tab} onClick={() => onNavigate(tab)} className={`${CARD} p-3 flex flex-col items-center gap-1.5 hover:bg-[#edf2f7] transition-colors`} data-testid={`quick-${tab}`}>
              <Icon className="w-5 h-5 text-[#111]" />
              <span className="text-[11px] font-medium text-[#334855]">{label}</span>
            </button>
          ))}
        </div>
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
                <h2 className="text-[18px] font-bold text-[#111]">{detail.title || "Untitled"}</h2>
                <div className="flex gap-1.5">
                  {detail.featured && <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">Aanrader</Badge>}
                  {detail.hidden_from_feed && <Badge className="bg-[#F7F7F7] text-[#334855] text-[10px]">Hidden</Badge>}
                </div>
              </div>
              {detail.image_url && (
                <div className="mb-4 rounded-xl overflow-hidden bg-[#F7F7F7]">
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
                    <span className="text-[#334855]">{k}</span>
                    <span className="font-medium text-[#111] max-w-[60%] truncate text-right">{v}</span>
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
              <h3 className="text-[15px] font-semibold text-[#111] mb-3">Quality controls</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-500" />
                    <div>
                      <p className="text-[13px] font-medium text-[#111]">Featured (Aanrader)</p>
                      <p className="text-[11px] text-[#334855]">Prioritize in user feeds</p>
                    </div>
                  </div>
                  <button onClick={toggleFeatured} disabled={saving} className="relative" data-testid="toggle-featured">
                    {detail.featured ? <ToggleRight className="w-8 h-8 text-ha-primary" /> : <ToggleLeft className="w-8 h-8 text-[#D1D5DB]" />}
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <EyeOff className="w-4 h-4 text-[#334855]" />
                    <div>
                      <p className="text-[13px] font-medium text-[#111]">Hide from feed</p>
                      <p className="text-[11px] text-[#334855]">Remove from user matching</p>
                    </div>
                  </div>
                  <button onClick={toggleHidden} disabled={saving} className="relative" data-testid="toggle-hidden">
                    {detail.hidden_from_feed ? <ToggleRight className="w-8 h-8 text-ha-danger" /> : <ToggleLeft className="w-8 h-8 text-[#D1D5DB]" />}
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
        <h1 className="text-[24px] font-bold text-[#111]">Listings</h1>
        <span className="text-[13px] text-[#334855]">{total} total</span>
      </div>

      <div className="flex gap-2">
        <input placeholder="Filter by city..." value={cityInput} onChange={e => { setCityInput(e.target.value); setPage(1); }} className="flex-1 h-10 px-4 rounded-xl bg-[#F7F7F7] text-[13px] text-[#111] placeholder:text-[#334855] focus:outline-none focus:ring-2 focus:ring-ha-primary/20" data-testid="input-listing-city" />
        <input placeholder="Filter by source..." value={sourceInput} onChange={e => { setSourceInput(e.target.value); setPage(1); }} className="flex-1 h-10 px-4 rounded-xl bg-[#F7F7F7] text-[13px] text-[#111] placeholder:text-[#334855] focus:outline-none focus:ring-2 focus:ring-ha-primary/20" data-testid="input-listing-source" />
      </div>

      {loading ? <LoadingState /> : (
        <div className={`${CARD} divide-y divide-[#F7F7F7]`}>
          {listings.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-[#334855]">No listings found</div>
          ) : listings.map(l => (
            <div key={l.id} className="px-4 py-3" data-testid={`listing-row-${l.id}`}>
              {editingId === l.id ? (
                <div className="space-y-2">
                  <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} className="w-full h-9 px-3 rounded-lg bg-[#F7F7F7] text-[13px] focus:outline-none" placeholder="Title" data-testid="input-edit-title" />
                  <div className="flex gap-2">
                    <input value={editForm.price} onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))} className="flex-1 h-9 px-3 rounded-lg bg-[#F7F7F7] text-[13px] focus:outline-none" placeholder="Price" type="number" data-testid="input-edit-price" />
                    <input value={editForm.image_url} onChange={e => setEditForm(f => ({ ...f, image_url: e.target.value }))} className="flex-[2] h-9 px-3 rounded-lg bg-[#F7F7F7] text-[13px] focus:outline-none" placeholder="Image URL" data-testid="input-edit-image" />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setEditingId(null)} className="rounded-full" data-testid="button-cancel-edit"><X className="w-3.5 h-3.5 mr-1" /> Cancel</Button>
                    <Button size="sm" onClick={saveEdit} disabled={saving} className="rounded-full bg-ha-primary hover:bg-ha-primary/90 text-white" data-testid="button-save-edit"><Save className="w-3.5 h-3.5 mr-1" /> {saving ? "Saving..." : "Save"}</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#F7F7F7] flex-shrink-0 overflow-hidden">
                    {l.image_url ? (
                      <img src={l.image_url} alt="" className="w-full h-full object-cover" onError={e => { (e.target as any).style.display = "none"; }} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Image className="w-5 h-5 text-[#D1D5DB]" /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openDetail(l.id)}>
                    <div className="flex items-center gap-1.5">
                      <p className="text-[13px] font-semibold text-[#111] truncate">{l.title || "Untitled"}</p>
                      {l.featured && <Star className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                      {l.hidden_from_feed && <EyeOff className="w-3 h-3 text-[#334855] flex-shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-[#334855] mt-0.5">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{l.source}</Badge>
                      <span>{l.city}</span>
                      <span>€{l.price || "—"}</span>
                      <span className="ml-auto">{l.created_at ? new Date(l.created_at).toLocaleDateString() : ""}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => startEdit(l)} className="w-8 h-8 rounded-lg bg-[#F7F7F7] flex items-center justify-center hover:bg-[#EFEFEF]" data-testid={`button-edit-${l.id}`}>
                      <Pencil className="w-3.5 h-3.5 text-[#334855]" />
                    </button>
                    <button onClick={() => setDeleteConfirm(l.id)} className="w-8 h-8 rounded-lg bg-[#F7F7F7] flex items-center justify-center hover:bg-ha-danger/10" data-testid={`button-delete-${l.id}`}>
                      <Trash2 className="w-3.5 h-3.5 text-ha-danger" />
                    </button>
                    {l.url && (
                      <a href={l.url} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg bg-[#F7F7F7] flex items-center justify-center hover:bg-[#EFEFEF]" data-testid={`link-ext-${l.id}`}>
                        <ExternalLink className="w-3.5 h-3.5 text-[#334855]" />
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
          <span className="text-[12px] text-[#334855]">Page {page} of {Math.ceil(total / 50)}</span>
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
        <h1 className="text-[24px] font-bold text-[#111]">Image Management</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setRefreshing(true); load(); }} className="rounded-full" data-testid="button-refresh-images">
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" onClick={triggerFullBackfill} disabled={triggeringBackfill} className="rounded-full bg-ha-primary hover:bg-ha-primary/90 text-white" data-testid="button-trigger-backfill">
            <RotateCw className={`w-3.5 h-3.5 mr-1 ${triggeringBackfill ? "animate-spin" : ""}`} /> {triggeringBackfill ? "Running..." : "Run backfill"}
          </Button>
        </div>
      </div>

      {backfillStatus && (
        <div>
          <SectionHeader title="Backfill pipeline" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard label="Status" value={backfillStatus.enabled ? "Enabled" : "Disabled"} icon={Activity} />
            <MetricCard label="Running" value={backfillStatus.running ? "Yes" : "No"} icon={Loader2} />
            <MetricCard label="Batch size" value={backfillStatus.batchSize} icon={Layers} />
            <MetricCard label="Total updated" value={backfillStatus.cumulativeUpdates} icon={CheckCircle} />
          </div>
          {backfillStatus.lastRun && (
            <div className={`${CARD} p-4 mt-3`}>
              <p className="text-[12px] text-[#334855] font-medium mb-1">Last run</p>
              <p className="text-[13px] text-[#111] font-medium">{new Date(backfillStatus.lastRun.timestamp).toLocaleString()}</p>
              <p className="text-[11px] text-[#334855]">Duration: {backfillStatus.lastRun.duration_ms}ms · Updated: {backfillStatus.lastRun.updated} · Failed: {backfillStatus.lastRun.failed}</p>
            </div>
          )}
          {backfillStatus.recentRuns && backfillStatus.recentRuns.length > 0 && (
            <div className={`${CARD} mt-3 divide-y divide-[#F7F7F7]`}>
              <div className="px-4 py-2">
                <p className="text-[12px] font-semibold text-[#334855] uppercase tracking-wider">Recent runs</p>
              </div>
              {backfillStatus.recentRuns.slice(0, 8).map((run: any, i: number) => (
                <div key={i} className="px-4 py-2.5 flex items-center justify-between text-[12px]">
                  <span className="text-[#334855]">{new Date(run.started_at).toLocaleString()}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[#111] font-medium">{run.updated}/{run.total}</span>
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
            <div className={`${CARD} divide-y divide-[#F7F7F7]`}>
              {(auditData.per_source || []).map((s: any) => (
                <div key={s.source} className="px-4 py-3" data-testid={`image-source-${s.source}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-[#111]">{s.source}</span>
                      <Badge variant="secondary" className="text-[10px]">{s.priority}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-bold text-[#111]">{s.coverage_pct}%</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => triggerSourceBackfill(s.source)}
                        disabled={sourceBackfilling === s.source}
                        className="rounded-full text-[11px] h-7 px-2"
                        data-testid={`button-backfill-${s.source}`}
                      >
                        <RotateCw className={`w-3 h-3 mr-1 ${sourceBackfilling === s.source ? "animate-spin" : ""}`} />
                        Backfill
                      </Button>
                    </div>
                  </div>
                  <div className="h-2 bg-[#F7F7F7] rounded-full overflow-hidden mb-1.5">
                    <div className="h-full rounded-full bg-ha-primary transition-all" style={{ width: `${s.coverage_pct}%` }} />
                  </div>
                  <div className="flex gap-3 text-[11px] text-[#334855]">
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
                  <p className="text-[12px] font-semibold text-[#334855] mb-2 uppercase">{source}</p>
                  <div className={`${CARD} divide-y divide-[#F7F7F7]`}>
                    {(samples as any[]).map((s: any) => (
                      <div key={s.id} className="px-4 py-3" data-testid={`sample-${s.id}`}>
                        <p className="text-[13px] font-medium text-[#111] truncate mb-1">{s.title || s.id}</p>
                        <div className="flex gap-2 items-center">
                          <input
                            placeholder="Paste image URL..."
                            value={manualUrl[s.id] || ""}
                            onChange={e => setManualUrl(m => ({ ...m, [s.id]: e.target.value }))}
                            className="flex-1 h-8 px-3 rounded-lg bg-[#F7F7F7] text-[12px] focus:outline-none"
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
      <h1 className="text-[24px] font-bold text-[#111]">Sources</h1>

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
            <p className="text-[13px] font-semibold text-[#111]">Last ingestion run</p>
            <p className="text-[11px] text-[#334855]">{new Date(latestRun.started_at).toLocaleString()} · {latestRun.duration_sec}s</p>
          </div>
        </div>
      )}

      <div>
        <SectionHeader title="Source monitor" />
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3" style={{ WebkitOverflowScrolling: "touch" }}>
          {["All", "Healthy", "Warning", "Broken"].map(f => (
            <button key={f} onClick={() => setStatusFilter(f)} className={`px-3 py-1.5 rounded-full text-[12px] font-medium flex-shrink-0 transition-colors ${statusFilter === f ? "bg-[#111] text-white" : "bg-white text-[#334855] border border-[#F0F0F0]"}`} data-testid={`filter-status-${f}`}>
              {f}
            </button>
          ))}
          <select value={cityFilter} onChange={e => setCityFilter(e.target.value)} className="px-3 py-1.5 rounded-full text-[12px] font-medium bg-white text-[#334855] border border-[#F0F0F0] cursor-pointer" data-testid="select-source-city">
            {SOURCE_HEALTH_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className={`${CARD} divide-y divide-[#F7F7F7]`}>
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
                    <span className="text-[13px] font-semibold text-[#111] truncate">{sourceName}</span>
                    {!isAdminEnabled && <Badge className="bg-[#F7F7F7] text-[#334855] text-[9px]">Disabled</Badge>}
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
                        : <ToggleLeft className="w-7 h-7 text-[#D1D5DB]" />
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
                      Backfill
                    </Button>
                  </div>
                </div>
                <div className="flex gap-3 text-[11px] text-[#334855] ml-4">
                  {s.city && <span>{s.city}</span>}
                  <span>{s.found ?? 0} found</span>
                  <span>{s.inserted ?? 0} new</span>
                  {(s.errors ?? 0) > 0 && <span className="text-ha-danger font-medium">{s.errors} errors</span>}
                </div>
              </div>
            );
          }) : (
            <div className="px-4 py-8 text-center text-[13px] text-[#334855]">No sources match this filter</div>
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
        <h3 className="text-[16px] font-bold text-[#111] mb-3">Profile</h3>
        <div className="space-y-2.5 text-[13px]">
          <div className="flex justify-between"><span className="text-[#334855]">Name</span><span className="font-medium text-[#111]">{profile?.first_name || ""} {profile?.last_name || ""}</span></div>
          <div className="flex justify-between"><span className="text-[#334855]">Email</span><span className="font-medium text-[#111] max-w-[200px] truncate">{profile?.email || "—"}</span></div>
          <div className="flex justify-between"><span className="text-[#334855]">Phone</span><span className="font-medium text-[#111]">{profile?.phone || "—"}</span></div>
          <div className="flex justify-between"><span className="text-[#334855]">Created</span><span className="font-medium text-[#111]">{profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "—"}</span></div>
          <div className="flex justify-between items-center">
            <span className="text-[#334855]">Notifications</span>
            <div className="flex gap-1.5">
              {notificationSettings?.email_enabled && <Badge variant="secondary" className="text-[10px]">Email</Badge>}
              {notificationSettings?.push_enabled && <Badge variant="secondary" className="text-[10px]">Push</Badge>}
              {!notificationSettings?.email_enabled && !notificationSettings?.push_enabled && <span className="text-[#334855]">None</span>}
            </div>
          </div>
          <div><span className="text-[#334855] text-[11px] break-all">{profile?.user_id || ""}</span></div>
        </div>
      </div>

      {diagnostics && (
        <div className={`${CARD} p-5`}>
          <h3 className="text-[16px] font-bold text-[#111] mb-3">Diagnostics</h3>
          <div className="space-y-2.5 text-[13px]">
            <div className="flex justify-between items-center">
              <span className="text-[#334855]">Role</span>
              <Badge variant="secondary" className={`text-[10px] ${diagnostics.accountRole === "owner" ? "bg-ha-primary/10 text-ha-primary" : diagnostics.accountRole === "buddy" ? "bg-blue-50 text-blue-700" : diagnostics.accountRole === "both" ? "bg-purple-50 text-purple-700" : "bg-gray-100 text-gray-500"}`}>
                {diagnostics.accountRole === "owner" ? "Owner" : diagnostics.accountRole === "buddy" ? "Buddy" : diagnostics.accountRole === "both" ? "Owner + Buddy" : "No role"}
              </Badge>
            </div>
            <div className="flex justify-between"><span className="text-[#334855]">Search profiles</span><span className="font-medium text-[#111]">{diagnostics.searchProfileCount}</span></div>
            <div className="flex justify-between"><span className="text-[#334855]">Matches (24h)</span><span className="font-medium text-[#111]">{diagnostics.matchesLast24h}</span></div>
            <div className="flex justify-between"><span className="text-[#334855]">Emails sent (24h)</span><span className="font-medium text-[#111]">{diagnostics.emailsSentLast24h}</span></div>
            <div className="flex justify-between"><span className="text-[#334855]">hasAccess</span><span className={`font-medium ${subscription?.hasAccess ? "text-emerald-600" : "text-ha-danger"}`}>{subscription?.hasAccess ? "Yes" : "No"}</span></div>
            {diagnostics.buddyConnections?.asOwner && (
              <div className="p-2.5 bg-[#F7F7F7] rounded-xl">
                <p className="text-[11px] font-semibold text-[#334855] mb-1">Buddy (as owner)</p>
                <p className="text-[12px] text-[#111]">{diagnostics.buddyConnections.asOwner.invite_email} — {diagnostics.buddyConnections.asOwner.invite_status}</p>
              </div>
            )}
            {diagnostics.buddyConnections?.asBuddy?.length > 0 && diagnostics.buddyConnections.asBuddy.map((b: any, i: number) => (
              <div key={i} className="p-2.5 bg-[#F7F7F7] rounded-xl">
                <p className="text-[11px] font-semibold text-[#334855] mb-1">Owner (as buddy)</p>
                <p className="text-[12px] text-[#111]">{b.owner_name || b.owner_user_id?.substring(0, 8)} — {b.invite_status}</p>
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
          <h3 className="text-[16px] font-bold text-[#111] mb-3">Subscription</h3>
          <div className="space-y-2.5 text-[13px]">
            <div className="flex justify-between items-center"><span className="text-[#334855]">Status</span><StatusBadge status={subscription.computedStatus || subscription.status} /></div>
            {subscription.computedStatus && subscription.computedStatus !== subscription.status && (
              <div className="flex justify-between items-center"><span className="text-[10px] text-orange-500">DB raw: {subscription.status}</span></div>
            )}
            <div className="flex justify-between"><span className="text-[#334855]">Plan</span><span className="font-medium">{subscription.plan || "—"}</span></div>
            <div className="flex justify-between"><span className="text-[#334855]">Trial ends</span><span className="font-medium">{subscription.trial_ends_at ? new Date(subscription.trial_ends_at).toLocaleDateString() : "—"}</span></div>
            <div className="flex justify-between"><span className="text-[#334855]">Period ends</span><span className="font-medium">{subscription.current_period_ends_at ? new Date(subscription.current_period_ends_at).toLocaleDateString() : "—"}</span></div>
            {subscription.stripe_subscription_id && (
              <a href={`https://dashboard.stripe.com/subscriptions/${subscription.stripe_subscription_id}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-ha-primary text-[12px] font-medium" data-testid="link-stripe-sub">
                <ExternalLink className="w-3 h-3" /> View in Stripe
              </a>
            )}
          </div>
        </div>
      )}

      <div className={`${CARD} p-5`}>
        <h3 className="text-[16px] font-bold text-[#111] mb-3">Actions</h3>
        <div className="space-y-3">
          <div>
            <p className="text-[12px] text-[#334855] font-medium mb-1.5">Extend trial</p>
            <div className="flex gap-2">
              <select value={trialDays} onChange={e => setTrialDays(e.target.value)} className="h-9 px-3 rounded-lg bg-[#F7F7F7] text-[13px] border-0 focus:outline-none" data-testid="select-trial-days">
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
            <p className="text-[12px] text-[#334855] font-medium mb-1.5">Change plan</p>
            <div className="flex gap-2">
              {["monthly", "two_month", "three_month"].map(plan => (
                <Button key={plan} variant="outline" size="sm" onClick={() => changePlan(plan)} disabled={actionLoading === "plan"} className="rounded-full text-[11px]" data-testid={`button-plan-${plan}`}>
                  {plan.replace("_", " ")}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[12px] text-[#334855] font-medium mb-1.5">Alerts</p>
            <Button variant="outline" size="sm" onClick={resendUserMatches} disabled={actionLoading === "resend"} className="rounded-full" data-testid="button-resend-matches">
              <Send className="w-3.5 h-3.5 mr-1" />
              {actionLoading === "resend" ? "Sending..." : "Resend undelivered matches"}
            </Button>
          </div>
          <div className="pt-2 border-t border-[#F7F7F7]">
            <Button variant="outline" size="sm" onClick={deactivateUser} disabled={actionLoading === "deactivate"} className="rounded-full text-ha-danger border-ha-danger/30 hover:bg-ha-danger/5" data-testid="button-deactivate">
              <XCircle className="w-3.5 h-3.5 mr-1" />
              {actionLoading === "deactivate" ? "Deactivating..." : "Deactivate user"}
            </Button>
          </div>
        </div>
      </div>

      {searchProfiles && searchProfiles.length > 0 && (
        <div className={`${CARD} p-5`}>
          <h3 className="text-[16px] font-bold text-[#111] mb-3">Search profiles ({searchProfiles.length})</h3>
          <div className="space-y-2">
            {searchProfiles.map((sp: any) => (
              <div key={sp.id} className="p-3 bg-[#F7F7F7] rounded-xl text-[12px]">
                <p className="font-semibold text-[#111] mb-0.5">{sp.city_name || sp.city}</p>
                <p className="text-[#334855]">€{sp.price_min || 0}–€{sp.price_max || "∞"} · {sp.bedrooms_min || 0}+ rooms · {sp.size_min || 0}+ m²</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {recentMatches && recentMatches.length > 0 && (
        <div className={`${CARD} p-5`}>
          <h3 className="text-[16px] font-bold text-[#111] mb-3">Recent matches ({recentMatches.length})</h3>
          <div className="space-y-2">
            {recentMatches.slice(0, 10).map((m: any) => (
              <div key={m.id} className="flex items-center gap-2 p-2.5 bg-[#F7F7F7] rounded-xl text-[12px]">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[#111] truncate">{m.listing_title || m.listing_id?.substring(0, 12)}</p>
                  <p className="text-[#334855]">{m.matched_at ? new Date(m.matched_at).toLocaleString() : "—"}</p>
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
          <h3 className="text-[16px] font-bold text-[#111] mb-3">Cancellation feedback</h3>
          <div className="space-y-2 text-[13px]">
            <div className="flex justify-between"><span className="text-[#334855]">Reason</span><span className="font-medium">{cancellationFeedback.reason || "—"}</span></div>
            {cancellationFeedback.feedback && <p className="text-[#334855] text-[12px] bg-[#F7F7F7] rounded-xl p-3">{cancellationFeedback.feedback}</p>}
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
      <h1 className="text-[24px] font-bold text-[#111]">Users</h1>

      <div className={`${CARD} px-4 py-3 flex items-center gap-3`}>
        <Search className="w-5 h-5 text-[#334855] flex-shrink-0" />
        <input
          placeholder="Search name or email..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 text-[13px] text-[#111] bg-transparent focus:outline-none placeholder:text-[#334855]"
          data-testid="input-search-users"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: "touch" }}>
        {["all", "paid", "trial", "canceled", "expired"].map(f => (
          <button key={f} onClick={() => { setFilter(f); setPage(1); }} className={`px-3 py-1.5 rounded-full text-[12px] font-medium flex-shrink-0 transition-colors ${filter === f ? "bg-[#111] text-white" : "bg-white text-[#334855] border border-[#F0F0F0]"}`} data-testid={`filter-user-${f}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <span className="text-[12px] text-[#334855] self-center ml-auto flex-shrink-0">{total} users</span>
      </div>

      {loading ? <LoadingState /> : (
        <div className={`${CARD} divide-y divide-[#F7F7F7]`}>
          {users.map(u => (
            <button key={u.user_id} onClick={() => openUser(u.user_id)} className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-[#edf2f7] transition-colors" data-testid={`user-card-${u.user_id}`}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-[13px] font-bold ${u.has_profile_data === false ? "bg-[#F7F7F7] text-[#334855]" : "bg-[#F7F7F7] text-ha-primary"}`}>
                {(u.first_name || u.email || "?")[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-[#111] truncate">{u.first_name || u.email || "Unknown"} {u.last_name || ""}</p>
                <p className="text-[11px] text-[#334855] truncate">{u.email || u.user_id?.substring(0, 8)} · {u.searchProfileCount || 0} profiles · {u.matchCount || 0} matches</p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <div className="flex gap-1 items-center">
                  {u.role && u.role !== "user" && (
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${u.role === "owner" ? "bg-ha-primary/10 text-ha-primary" : u.role === "buddy" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"}`}>
                      {u.role === "both" ? "O+B" : u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                    </span>
                  )}
                  {u.subscription ? <StatusBadge status={u.subscription.status} /> : <span className="text-[11px] text-[#334855]">No sub</span>}
                </div>
                <span className="text-[10px] text-[#334855]">{u.created_at ? new Date(u.created_at).toLocaleDateString() : ""}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-200 flex-shrink-0" />
            </button>
          ))}
          {users.length === 0 && <div className="px-4 py-8 text-center text-[13px] text-[#334855]">No users found</div>}
        </div>
      )}

      {total > 50 && (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-full" data-testid="button-user-prev">Previous</Button>
          <span className="text-[12px] text-[#334855]">Page {page}</span>
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
      <h1 className="text-[24px] font-bold text-[#111]">Subscriptions</h1>

      <div className="flex gap-2 overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: "touch" }}>
        {["all", "active", "trial", "canceled", "expired"].map(f => (
          <button key={f} onClick={() => { setFilter(f); setPage(1); }} className={`px-3 py-1.5 rounded-full text-[12px] font-medium flex-shrink-0 transition-colors ${filter === f ? "bg-[#111] text-white" : "bg-white text-[#334855] border border-[#F0F0F0]"}`} data-testid={`filter-sub-${f}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <span className="text-[12px] text-[#334855] self-center ml-auto flex-shrink-0">{total}</span>
      </div>

      {loading ? <LoadingState /> : subs.length === 0 ? (
        <EmptyState title="No subscriptions" message={`No subscriptions found for "${filter}".`} />
      ) : (
        <div className={`${CARD} divide-y divide-[#F7F7F7]`}>
          {subs.map(s => (
            <div key={s.id} className="px-4 py-3" data-testid={`sub-card-${s.id}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[#111] truncate">{s.userName || "Unknown"}</p>
                  <p className="text-[10px] text-[#334855]">{s.user_id?.substring(0, 8)}...</p>
                </div>
                <StatusBadge status={s.computedStatus || s.status} />
              </div>
              {s.computedStatus && s.computedStatus !== s.status && (
                <p className="text-[10px] text-orange-500 mb-1">DB: {s.status} → Computed: {s.computedStatus}</p>
              )}
              <div className="flex items-center gap-3 text-[11px] text-[#334855]">
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
          <span className="text-[12px] text-[#334855]">Page {page}</span>
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[24px] font-bold text-[#111]">System</h1>
        <button onClick={() => { setRefreshing(true); load(); }} className="w-9 h-9 rounded-full bg-[#F7F7F7] flex items-center justify-center hover:bg-[#EFEFEF]" data-testid="button-refresh-system">
          <RefreshCw className={`w-4 h-4 text-[#334855] ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {matchStats && (
        <div>
          <SectionHeader title="Delivery today" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard label="Emails" value={matchStats.emailsToday} icon={Mail} />
            <MetricCard label="Push" value={matchStats.pushesToday} icon={Smartphone} />
            <MetricCard label="Real failures 7d" value={matchStats.emailFailuresWeek ?? matchStats.failuresWeek} icon={AlertTriangle} />
            <MetricCard label="Skipped (no sub) 7d" value={matchStats.emailSkippedNoSubWeek ?? 0} icon={XCircle} />
          </div>
        </div>
      )}

      {backfillStatus && (
        <div>
          <SectionHeader title="Image backfill pipeline" />
          <div className={`${CARD} p-4 space-y-3`}>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-[#334855]">Status</span>
              <StatusBadge status={backfillStatus.enabled ? "active" : "disabled"} />
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-[#334855]">Running</span>
              <span className="font-medium text-[#111]">{backfillStatus.running ? "Yes" : "No"}</span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-[#334855]">Batch size</span>
              <span className="font-medium text-[#111]">{backfillStatus.batchSize}</span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-[#334855]">Total updated</span>
              <span className="font-medium text-[#111]">{backfillStatus.cumulativeUpdates}</span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-[#334855]">Enabled sources</span>
              <span className="font-medium text-[#111] text-right max-w-[60%] truncate">{(backfillStatus.enabledSources || []).join(", ") || "—"}</span>
            </div>
            {backfillStatus.lastRun && (
              <>
                <div className="border-t border-[#F7F7F7] pt-2 mt-2">
                  <p className="text-[12px] text-[#334855] font-medium mb-1">Last run</p>
                  <p className="text-[13px] text-[#111]">{new Date(backfillStatus.lastRun.timestamp).toLocaleString()}</p>
                  <p className="text-[11px] text-[#334855]">{backfillStatus.lastRun.duration_ms}ms · {backfillStatus.lastRun.updated} updated · {backfillStatus.lastRun.failed} failed</p>
                </div>
              </>
            )}
          </div>

          {backfillStatus.recentRuns && backfillStatus.recentRuns.length > 0 && (
            <div className={`${CARD} mt-3 divide-y divide-[#F7F7F7]`}>
              <div className="px-4 py-2">
                <p className="text-[12px] font-semibold text-[#334855] uppercase tracking-wider">Recent backfill runs</p>
              </div>
              {backfillStatus.recentRuns.slice(0, 5).map((run: any, i: number) => (
                <div key={i} className="px-4 py-2.5 flex items-center justify-between text-[12px]">
                  <span className="text-[#334855]">{new Date(run.started_at).toLocaleString()}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[#111] font-medium">{run.updated}/{run.total}</span>
                    <StatusBadge status={run.status || (run.updated > 0 ? "success" : "warning")} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {backfillStatus.recoveryStats && (
            <div className={`${CARD} mt-3 p-4`}>
              <p className="text-[12px] font-semibold text-[#334855] uppercase tracking-wider mb-2">Recovery stats</p>
              <div className="space-y-2 text-[13px]">
                {Object.entries(backfillStatus.recoveryStats).map(([key, val]: [string, any]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-[#334855]">{key}</span>
                    <span className="font-medium text-[#111]">{typeof val === "object" ? JSON.stringify(val) : String(val)}</span>
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
          <div className={`${CARD} divide-y divide-[#F7F7F7]`}>
            {Object.entries(checks).map(([key, val]) => {
              const Icon = serviceIcons[key] || Settings;
              const info = labels[key] || { name: key, desc: "" };
              return (
                <div key={key} className="flex items-center gap-3 px-4 py-3.5" data-testid={`status-${key}`}>
                  <Icon className="w-5 h-5 text-[#111] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#111]">{info.name}</p>
                    <p className="text-[11px] text-[#334855] truncate">{val.message}</p>
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [testType, setTestType] = useState<"email" | "push">("email");
  const [testEmail, setTestEmail] = useState("");
  const [testUserId, setTestUserId] = useState("");
  const [sending, setSending] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [resendUserId, setResendUserId] = useState("");
  const [resending, setResending] = useState(false);
  const [resendResult, setResendResult] = useState<string | null>(null);

  function load() {
    setLoading(true);
    adminFetch("/api/admin/portal/alert-activity")
      .then(d => {
        setActivity(d.recentActivity || []);
        setStats(d.stats || null);
      })
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false); });
  }

  useEffect(() => { load(); }, []);

  async function sendTestAlert() {
    setSending(true);
    setTestResult(null);
    try {
      const body: any = { type: testType };
      if (testType === "email" && testEmail) body.email = testEmail;
      if (testType === "push" && testUserId) body.userId = testUserId;
      const res = await adminFetch("/api/admin/portal/test-alert", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setTestResult(res.success ? `Sent successfully${res.sentTo ? ` to ${res.sentTo}` : ""}` : "Failed to send");
    } catch (err: any) {
      setTestResult(`Error: ${err.message}`);
    }
    setSending(false);
  }

  async function resendMatches() {
    if (!resendUserId) return;
    setResending(true);
    setResendResult(null);
    try {
      const res = await adminFetch(`/api/admin/portal/resend-matches/${resendUserId}`, { method: "POST" });
      setResendResult(res.success ? `Resent ${res.resent} matches` : res.message || "Failed");
    } catch (err: any) {
      setResendResult(`Error: ${err.message}`);
    }
    setResending(false);
  }

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[24px] font-bold text-[#111]">Alert Control</h1>
        <button onClick={() => { setRefreshing(true); load(); }} className="w-9 h-9 rounded-full bg-[#F7F7F7] flex items-center justify-center hover:bg-[#EFEFEF]" data-testid="button-refresh-alerts">
          <RefreshCw className={`w-4 h-4 text-[#334855] ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard label="Emails today" value={stats.emailsToday} icon={Mail} />
          <MetricCard label="Push today" value={stats.pushToday} icon={Smartphone} />
          <MetricCard label="Real failures 7d" value={stats.undelivered7d} icon={AlertTriangle} />
          <MetricCard label="Skipped (no sub) 7d" value={stats.skippedNoSub7d ?? 0} icon={XCircle} />
        </div>
      )}

      <div className={`${CARD} p-5`}>
        <h3 className="text-[15px] font-semibold text-[#111] mb-3">Send test alert</h3>
        <div className="space-y-3">
          <div className="flex gap-2">
            {(["email", "push"] as const).map(t => (
              <button key={t} onClick={() => setTestType(t)} className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors ${testType === t ? "bg-[#111] text-white" : "bg-white text-[#334855] border border-[#F0F0F0]"}`} data-testid={`test-type-${t}`}>
                {t === "email" ? "Email" : "Push"}
              </button>
            ))}
          </div>
          {testType === "email" ? (
            <input placeholder="Target email (blank = admin)" value={testEmail} onChange={e => setTestEmail(e.target.value)} className="w-full h-10 px-4 rounded-xl bg-[#F7F7F7] text-[13px] text-[#111] placeholder:text-[#334855] focus:outline-none focus:ring-2 focus:ring-ha-primary/20" data-testid="input-test-email" />
          ) : (
            <input placeholder="Target user ID (blank = admin)" value={testUserId} onChange={e => setTestUserId(e.target.value)} className="w-full h-10 px-4 rounded-xl bg-[#F7F7F7] text-[13px] text-[#111] placeholder:text-[#334855] focus:outline-none focus:ring-2 focus:ring-ha-primary/20" data-testid="input-test-userid" />
          )}
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={sendTestAlert} disabled={sending} className="rounded-full bg-ha-primary hover:bg-ha-primary/90 text-white" data-testid="button-send-test">
              <Send className="w-3.5 h-3.5 mr-1" /> {sending ? "Sending..." : "Send test"}
            </Button>
            {testResult && <span className={`text-[12px] ${testResult.startsWith("Error") || testResult === "Failed to send" ? "text-ha-danger" : "text-emerald-600"}`} data-testid="text-test-result">{testResult}</span>}
          </div>
        </div>
      </div>

      <div className={`${CARD} p-5`}>
        <h3 className="text-[15px] font-semibold text-[#111] mb-3">Resend matches to user</h3>
        <p className="text-[12px] text-[#334855] mb-3">Re-deliver undelivered matches for a specific user via email.</p>
        <div className="flex gap-2">
          <input placeholder="User ID" value={resendUserId} onChange={e => setResendUserId(e.target.value)} className="flex-1 h-10 px-4 rounded-xl bg-[#F7F7F7] text-[13px] text-[#111] placeholder:text-[#334855] focus:outline-none focus:ring-2 focus:ring-ha-primary/20" data-testid="input-resend-userid" />
          <Button size="sm" onClick={resendMatches} disabled={resending || !resendUserId} className="rounded-full bg-ha-primary hover:bg-ha-primary/90 text-white" data-testid="button-resend">
            <RotateCw className={`w-3.5 h-3.5 mr-1 ${resending ? "animate-spin" : ""}`} /> {resending ? "Sending..." : "Resend"}
          </Button>
        </div>
        {resendResult && <p className={`text-[12px] mt-2 ${resendResult.startsWith("Error") ? "text-ha-danger" : "text-emerald-600"}`} data-testid="text-resend-result">{resendResult}</p>}
      </div>

      <div>
        <SectionHeader title="Recent alert activity" />
        <div className={`${CARD} divide-y divide-[#F7F7F7]`}>
          {activity.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-[#334855]">No recent activity</div>
          ) : activity.map((a, i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-3" data-testid={`activity-row-${i}`}>
              {a.channel === "email" ? <Mail className="w-4 h-4 text-[#334855] flex-shrink-0" /> : <Smartphone className="w-4 h-4 text-[#334855] flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-[#111] truncate">{a.title}</p>
                <p className="text-[11px] text-[#334855] truncate">{a.email || a.userId?.substring(0, 8)}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <Badge variant="secondary" className="text-[9px]">{a.channel}</Badge>
                <p className="text-[10px] text-[#334855] mt-0.5">{a.emailSentAt ? new Date(a.emailSentAt).toLocaleString() : a.pushSentAt ? new Date(a.pushSentAt).toLocaleString() : ""}</p>
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
      <h1 className="text-[24px] font-bold text-[#111]">Revenue Settings</h1>

      <div className={`${CARD} p-5`}>
        <h3 className="text-[15px] font-semibold text-[#111] mb-1">Paywall behavior</h3>
        <p className="text-[12px] text-[#334855] mb-4">Control what free/expired users see in the app.</p>

        <div className="space-y-4">
          <div>
            <label className="text-[12px] font-medium text-[#334855] mb-1.5 block">Free matches limit</label>
            <p className="text-[11px] text-[#334855] mb-1.5">Number of matches a free user can see before the paywall appears.</p>
            <div className="flex gap-2">
              {["0", "1", "3", "5", "10"].map(v => (
                <button key={v} onClick={() => setSettings(s => ({ ...s, free_matches_limit: v }))} className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors ${settings.free_matches_limit === v ? "bg-[#111] text-white" : "bg-white text-[#334855] border border-[#F0F0F0]"}`} data-testid={`setting-limit-${v}`}>
                  {v === "0" ? "None" : v}
                </button>
              ))}
              <input
                type="number"
                value={settings.free_matches_limit || "3"}
                onChange={e => setSettings(s => ({ ...s, free_matches_limit: e.target.value }))}
                className="w-16 h-8 px-3 rounded-lg bg-[#F7F7F7] text-[13px] text-center focus:outline-none"
                min="0"
                data-testid="input-free-limit"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-[#F7F7F7]">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-[12px] font-medium text-[#334855] block">Show blurred locked matches</label>
                <p className="text-[11px] text-[#334855]">When enabled, free users see blurred match previews behind the paywall.</p>
              </div>
              <button onClick={() => setSettings(s => ({ ...s, show_blurred_locked: s.show_blurred_locked === "true" ? "false" : "true" }))} data-testid="toggle-blurred">
                {settings.show_blurred_locked === "true"
                  ? <ToggleRight className="w-8 h-8 text-ha-primary" />
                  : <ToggleLeft className="w-8 h-8 text-[#D1D5DB]" />
                }
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={`${CARD} p-5`}>
        <h3 className="text-[15px] font-semibold text-[#111] mb-1">Current values</h3>
        <div className="space-y-2 mt-3">
          {Object.entries(settings).map(([key, value]) => (
            <div key={key} className="flex justify-between text-[13px]">
              <span className="text-[#334855] font-mono text-[12px]">{key}</span>
              <span className="font-medium text-[#111]">{value}</span>
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

const TAB_CONFIG: { id: TabId; label: string; icon: any }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "listings", label: "Listings", icon: Layers },
  { id: "images", label: "Images", icon: Image },
  { id: "sources", label: "Sources", icon: Radio },
  { id: "users", label: "Users", icon: Users },
  { id: "subscriptions", label: "Subscriptions", icon: CreditCard },
  { id: "alerts", label: "Alerts", icon: Bell },
  { id: "settings", label: "Settings", icon: Sliders },
  { id: "system", label: "System", icon: Signal },
];

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

  if (checking) return <div className="min-h-screen bg-[#edf2f7] flex items-center justify-center"><Loader2 className="w-7 h-7 text-ha-primary animate-spin" /></div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-[#edf2f7] flex items-center justify-center px-5">
        <div className="text-center max-w-sm">
          <h1 className="text-[20px] font-bold text-[#111] mb-2">Not authenticated</h1>
          <p className="text-[13px] text-[#334855] mb-4">Please log in to access the admin portal.</p>
          <Button onClick={() => navigate("/")} className="rounded-full" data-testid="button-login">Go to login</Button>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-[#edf2f7] flex">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-[240px] bg-white border-r border-[#F0F0F0] flex flex-col transition-transform lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="px-5 h-[60px] flex items-center gap-3 border-b border-[#F0F0F0]">
          <HousAlertLogo size={26} />
          <span className="text-[15px] font-bold text-[#111]">Admin</span>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F7F7F7]">
            <X className="w-4 h-4 text-[#334855]" />
          </button>
        </div>

        <nav className="flex-1 py-3 px-3 overflow-y-auto">
          {TAB_CONFIG.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => { setActiveTab(id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium mb-0.5 transition-colors ${active ? "bg-[#F7F7F7] text-[#111]" : "text-[#334855] hover:bg-[#edf2f7] hover:text-[#111]"}`}
                data-testid={`nav-${id}`}
              >
                <Icon className={`w-[18px] h-[18px] ${active ? "text-ha-primary" : ""}`} />
                {label}
              </button>
            );
          })}
        </nav>

        <div className="px-3 py-3 border-t border-[#F0F0F0]">
          <button
            onClick={() => navigate("/")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-[#334855] hover:bg-[#edf2f7] hover:text-[#111] transition-colors"
            data-testid="link-back-app"
          >
            <ArrowLeft className="w-[18px] h-[18px]" />
            Terug naar app
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-[60px] bg-white border-b border-[#F0F0F0] flex items-center px-5 sticky top-0 z-30 lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="w-9 h-9 rounded-lg bg-[#F7F7F7] flex items-center justify-center mr-3" data-testid="button-menu">
            <Menu className="w-5 h-5 text-[#111]" />
          </button>
          <HousAlertLogo size={24} />
          <span className="text-[14px] font-bold text-[#111] ml-2">Admin</span>
          <button
            onClick={() => navigate("/")}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold text-[#334855] bg-[#F7F7F7] hover:bg-[#F0F0F0] active:scale-[0.97] transition-all"
            data-testid="link-back-app-mobile"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Terug naar app
          </button>
        </header>

        <main className="flex-1 p-5 lg:p-8 max-w-5xl w-full mx-auto overflow-x-hidden">
          {activeTab === "dashboard" && <DashboardTab onNavigate={setActiveTab} userName={user.user_metadata?.first_name || user.email?.split("@")[0] || "Admin"} />}
          {activeTab === "listings" && <ListingsTab />}
          {activeTab === "images" && <ImagesTab />}
          {activeTab === "sources" && <SourcesTab />}
          {activeTab === "users" && <UsersTab />}
          {activeTab === "subscriptions" && <SubscriptionsTab />}
          {activeTab === "alerts" && <AlertsTab />}
          {activeTab === "settings" && <SettingsTab />}
          {activeTab === "system" && <SystemTab />}
        </main>
      </div>
    </div>
  );
}
