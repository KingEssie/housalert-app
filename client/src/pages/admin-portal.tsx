import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api-base";
import {
  Users, CreditCard, Search, Home, BarChart3, Bell, Settings,
  Loader2, ChevronRight, ExternalLink, RefreshCw, Filter,
  Mail, Smartphone, AlertTriangle, CheckCircle, XCircle,
  TrendingUp, Activity, Database, Globe, Zap, ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";

const TABS = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "users", label: "Users", icon: Users },
  { id: "subscriptions", label: "Subscriptions", icon: CreditCard },
  { id: "profiles", label: "Search Profiles", icon: Search },
  { id: "listings", label: "Listings & Sources", icon: Home },
  { id: "matches", label: "Matches & Notifications", icon: Bell },
  { id: "system", label: "System Status", icon: Settings },
] as const;

type TabId = typeof TABS[number]["id"];

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

function KpiCard({ label, value, icon: Icon, color = "blue" }: { label: string; value: string | number; icon: any; color?: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
  };
  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-4" data-testid={`kpi-${label.toLowerCase().replace(/\s/g, "-")}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${colors[color]} flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-[13px] text-[#6B7280] font-medium">{label}</p>
          <p className="text-[20px] font-bold text-[#111C3D]">{value}</p>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    active: { cls: "bg-green-100 text-green-700", label: "Active" },
    operational: { cls: "bg-green-100 text-green-700", label: "Operational" },
    trial: { cls: "bg-blue-100 text-blue-700", label: "Trial" },
    canceled: { cls: "bg-red-100 text-red-700", label: "Canceled" },
    expired: { cls: "bg-gray-100 text-gray-600", label: "Expired" },
    error: { cls: "bg-red-100 text-red-700", label: "Error" },
    warning: { cls: "bg-amber-100 text-amber-700", label: "Warning" },
    disabled: { cls: "bg-gray-100 text-gray-600", label: "Disabled" },
    success: { cls: "bg-green-100 text-green-700", label: "Success" },
    partial: { cls: "bg-amber-100 text-amber-700", label: "Partial" },
    failed: { cls: "bg-red-100 text-red-700", label: "Failed" },
    broken: { cls: "bg-red-100 text-red-700", label: "Broken" },
    degraded: { cls: "bg-amber-100 text-amber-700", label: "Degraded" },
  };
  const m = map[status] || { cls: "bg-gray-100 text-gray-600", label: status };
  return <span className={`px-2.5 py-0.5 rounded-full text-[12px] font-medium ${m.cls}`}>{m.label}</span>;
}

function OverviewTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch("/api/admin/portal/overview").then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;
  if (!data) return <p className="text-[#6B7280] p-6">Failed to load overview data.</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-[18px] font-bold text-[#111C3D]">Dashboard Overview</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard label="Total Users" value={data.totalUsers} icon={Users} color="blue" />
        <KpiCard label="Active Subs" value={data.activeSubscriptions} icon={CreditCard} color="green" />
        <KpiCard label="Trial Users" value={data.trialUsers} icon={Zap} color="purple" />
        <KpiCard label="Signups Today" value={data.signupsToday} icon={TrendingUp} color="amber" />
        <KpiCard label="MRR" value={`€${data.mrr}`} icon={CreditCard} color="green" />
        <KpiCard label="Search Profiles" value={data.activeProfiles} icon={Search} color="blue" />
        <KpiCard label="Listings Today" value={data.listingsToday} icon={Home} color="blue" />
        <KpiCard label="Matches Today" value={data.matchesToday} icon={Activity} color="green" />
        <KpiCard label="Emails Today" value={data.emailsToday} icon={Mail} color="purple" />
        <KpiCard label="Push Today" value={data.pushesToday} icon={Smartphone} color="amber" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
          <h3 className="text-[14px] font-semibold text-[#111C3D] mb-3">Last 7 Days</h3>
          <div className="space-y-2 text-[14px]">
            <div className="flex justify-between"><span className="text-[#6B7280]">Signups</span><span className="font-medium text-[#111C3D]">{data.signupsWeek}</span></div>
            <div className="flex justify-between"><span className="text-[#6B7280]">Listings</span><span className="font-medium text-[#111C3D]">{data.listingsWeek}</span></div>
            <div className="flex justify-between"><span className="text-[#6B7280]">Matches</span><span className="font-medium text-[#111C3D]">{data.matchesWeek}</span></div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 md:col-span-2">
          <h3 className="text-[14px] font-semibold text-[#111C3D] mb-3">Source Health</h3>
          {Array.isArray(data.sourceHealth) && data.sourceHealth.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {data.sourceHealth.map((s: any) => (
                <div key={s.name || s.source} className="flex items-center gap-2 text-[13px]">
                  <div className={`w-2 h-2 rounded-full ${(s.status === "active" || s.found > 0) ? "bg-green-400" : s.status === "broken" ? "bg-red-400" : "bg-amber-400"}`} />
                  <span className="text-[#374151] font-medium">{s.name || s.source}</span>
                  {s.found !== undefined && <span className="text-[#9CA3AF]">({s.found})</span>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-[#9CA3AF]">No recent ingestion data</p>
          )}
        </div>
      </div>
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
      .then((d) => { setUsers(d.users); setTotal(d.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, filter, search]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  function openUser(userId: string) {
    setSelectedUser(userId);
    setDetailLoading(true);
    adminFetch(`/api/admin/portal/users/${userId}`)
      .then(setUserDetail)
      .catch(console.error)
      .finally(() => setDetailLoading(false));
  }

  if (selectedUser) {
    return (
      <div className="space-y-4">
        <button onClick={() => { setSelectedUser(null); setUserDetail(null); }} className="flex items-center gap-2 text-[14px] text-[#0D6EFD] hover:underline" data-testid="button-back-users">
          <ArrowLeft className="w-4 h-4" /> Back to users
        </button>
        {detailLoading ? <LoadingState /> : userDetail ? <UserDetailView detail={userDetail} /> : <p className="text-[#6B7280]">User not found.</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <input
          placeholder="Search name or email..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="h-10 px-4 rounded-lg border border-[#E5E7EB] bg-white text-[14px] w-64 focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]"
          data-testid="input-search-users"
        />
        <select value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }} className="h-10 px-3 rounded-lg border border-[#E5E7EB] bg-white text-[14px] cursor-pointer" data-testid="select-filter-users">
          <option value="all">All</option>
          <option value="paid">Paid</option>
          <option value="trial">Trial</option>
          <option value="canceled">Canceled</option>
          <option value="expired">Expired</option>
        </select>
        <span className="text-[13px] text-[#6B7280]">{total} users</span>
      </div>

      {loading ? <LoadingState /> : (
        <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-[#374151]">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#374151]">Created</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#374151]">Subscription</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#374151]">Profiles</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#374151]">Matches</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#374151]"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u: any) => (
                  <tr key={u.user_id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] cursor-pointer" onClick={() => openUser(u.user_id)} data-testid={`row-user-${u.user_id}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#111C3D]">{u.first_name || ""} {u.last_name || ""}</p>
                      <p className="text-[#9CA3AF] text-[12px]">{u.user_id?.substring(0, 8)}...</p>
                    </td>
                    <td className="px-4 py-3 text-[#6B7280]">{u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-3">{u.subscription ? <StatusBadge status={u.subscription.status} /> : <span className="text-[#9CA3AF]">None</span>}</td>
                    <td className="px-4 py-3 text-[#374151]">{u.searchProfileCount}</td>
                    <td className="px-4 py-3 text-[#374151]">{u.matchCount}</td>
                    <td className="px-4 py-3"><ChevronRight className="w-4 h-4 text-[#9CA3AF]" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > 50 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#E5E7EB]">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} data-testid="button-prev-page">Previous</Button>
              <span className="text-[13px] text-[#6B7280]">Page {page}</span>
              <Button variant="outline" size="sm" disabled={users.length < 50} onClick={() => setPage(p => p + 1)} data-testid="button-next-page">Next</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function UserDetailView({ detail }: { detail: any }) {
  const { profile, subscription, searchProfiles, recentMatches, cancellationFeedback, notificationSettings } = detail;

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
        <h3 className="text-[16px] font-bold text-[#111C3D] mb-4">Profile</h3>
        <div className="grid grid-cols-2 gap-3 text-[14px]">
          <div><span className="text-[#6B7280]">Name</span><p className="font-medium">{profile?.first_name || ""} {profile?.last_name || ""}</p></div>
          <div><span className="text-[#6B7280]">Phone</span><p className="font-medium">{profile?.phone || "—"}</p></div>
          <div><span className="text-[#6B7280]">Occupation</span><p className="font-medium">{profile?.occupation || "—"}</p></div>
          <div><span className="text-[#6B7280]">Created</span><p className="font-medium">{profile?.created_at ? new Date(profile.created_at).toLocaleString() : "—"}</p></div>
          <div><span className="text-[#6B7280]">User ID</span><p className="font-medium text-[12px] text-[#9CA3AF] break-all">{profile?.user_id || "—"}</p></div>
          <div>
            <span className="text-[#6B7280]">Notifications</span>
            <div className="flex gap-2 mt-1">
              {notificationSettings?.email_enabled && <Badge variant="secondary" className="text-[11px]">Email</Badge>}
              {notificationSettings?.push_enabled && <Badge variant="secondary" className="text-[11px]">Push</Badge>}
              {!notificationSettings?.email_enabled && !notificationSettings?.push_enabled && <span className="text-[13px] text-[#9CA3AF]">None</span>}
            </div>
          </div>
        </div>
      </div>

      {subscription && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
          <h3 className="text-[16px] font-bold text-[#111C3D] mb-4">Subscription</h3>
          <div className="grid grid-cols-2 gap-3 text-[14px]">
            <div><span className="text-[#6B7280]">Status</span><div className="mt-1"><StatusBadge status={subscription.status} /></div></div>
            <div><span className="text-[#6B7280]">Plan</span><p className="font-medium">{subscription.plan || "—"}</p></div>
            <div><span className="text-[#6B7280]">Trial ends</span><p className="font-medium">{subscription.trial_ends_at ? new Date(subscription.trial_ends_at).toLocaleDateString() : "—"}</p></div>
            <div><span className="text-[#6B7280]">Period ends</span><p className="font-medium">{subscription.current_period_ends_at ? new Date(subscription.current_period_ends_at).toLocaleDateString() : "—"}</p></div>
            {subscription.stripe_customer_id && <div><span className="text-[#6B7280]">Stripe Customer</span><p className="font-medium text-[12px] break-all">{subscription.stripe_customer_id}</p></div>}
            {subscription.stripe_subscription_id && <div><span className="text-[#6B7280]">Stripe Sub</span><p className="font-medium text-[12px] break-all">{subscription.stripe_subscription_id}</p></div>}
          </div>
        </div>
      )}

      {searchProfiles && searchProfiles.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
          <h3 className="text-[16px] font-bold text-[#111C3D] mb-4">Search Profiles ({searchProfiles.length})</h3>
          <div className="space-y-3">
            {searchProfiles.map((sp: any) => (
              <div key={sp.id} className="p-3 bg-[#F9FAFB] rounded-lg text-[13px]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-[#111C3D]">{sp.city_name || sp.city}</span>
                  {sp.location_mode && <Badge variant="secondary" className="text-[10px]">{sp.location_mode}</Badge>}
                </div>
                <p className="text-[#6B7280]">
                  €{sp.price_min || 0}–€{sp.price_max || "∞"} · {sp.bedrooms_min || 0}+ rooms · {sp.size_min || 0}+ m²
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {recentMatches && recentMatches.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
          <h3 className="text-[16px] font-bold text-[#111C3D] mb-4">Recent Matches ({recentMatches.length})</h3>
          <div className="space-y-2">
            {recentMatches.slice(0, 10).map((m: any) => (
              <div key={m.id} className="flex items-center gap-3 p-2 bg-[#F9FAFB] rounded-lg text-[13px]">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[#111C3D] truncate">{m.listing_title || m.listing_id?.substring(0, 12)}</p>
                  <p className="text-[#9CA3AF]">{m.matched_at ? new Date(m.matched_at).toLocaleString() : "—"}</p>
                </div>
                <div className="flex gap-1.5">
                  {m.email_sent && <Badge variant="secondary" className="text-[10px]">Email</Badge>}
                  {m.push_sent && <Badge variant="secondary" className="text-[10px]">Push</Badge>}
                  {m.viewed && <Badge className="text-[10px] bg-green-100 text-green-700">Viewed</Badge>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {cancellationFeedback && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
          <h3 className="text-[16px] font-bold text-[#111C3D] mb-4">Cancellation Feedback</h3>
          <div className="text-[14px] space-y-2">
            <div><span className="text-[#6B7280]">Reason:</span> <span className="font-medium">{cancellationFeedback.reason || "—"}</span></div>
            <div><span className="text-[#6B7280]">Found home via HousAlert:</span> <span className="font-medium">{cancellationFeedback.found_via_housalert ? "Yes" : "No"}</span></div>
            {cancellationFeedback.feedback && <div><span className="text-[#6B7280]">Details:</span> <span className="font-medium">{cancellationFeedback.feedback}</span></div>}
          </div>
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
      .then((d) => { setSubs(d.subscriptions); setTotal(d.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filter, page]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        {["all", "active", "trial", "canceled", "expired"].map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors ${filter === f ? "bg-[#0D6EFD] text-white" : "bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB]"}`}
            data-testid={`filter-sub-${f}`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <span className="text-[13px] text-[#6B7280] ml-auto">{total} subscriptions</span>
      </div>

      {loading ? <LoadingState /> : (
        <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-[#374151]">User</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#374151]">Plan</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#374151]">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#374151]">Created</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#374151]">Ends</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#374151]">Stripe</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s: any) => (
                  <tr key={s.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB]" data-testid={`row-sub-${s.id}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#111C3D]">{s.userName || "Unknown"}</p>
                      <p className="text-[#9CA3AF] text-[11px]">{s.user_id?.substring(0, 8)}...</p>
                    </td>
                    <td className="px-4 py-3 text-[#374151] font-medium">{s.plan || "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                    <td className="px-4 py-3 text-[#6B7280]">{s.created_at ? new Date(s.created_at).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-3 text-[#6B7280]">{(s.current_period_ends_at || s.trial_ends_at) ? new Date(s.current_period_ends_at || s.trial_ends_at).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-3">
                      {s.stripe_subscription_id ? (
                        <a
                          href={`https://dashboard.stripe.com/subscriptions/${s.stripe_subscription_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#0D6EFD] hover:underline flex items-center gap-1"
                          data-testid={`link-stripe-${s.id}`}
                        >
                          <ExternalLink className="w-3 h-3" /> View
                        </a>
                      ) : <span className="text-[#9CA3AF]">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > 50 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#E5E7EB]">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <span className="text-[13px] text-[#6B7280]">Page {page}</span>
              <Button variant="outline" size="sm" disabled={subs.length < 50} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SearchProfilesTab() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    adminFetch(`/api/admin/portal/search-profiles?page=${page}&limit=50`)
      .then((d) => { setProfiles(d.profiles); setTotal(d.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-[#6B7280]">{total} search profiles</span>
      </div>

      {loading ? <LoadingState /> : (
        <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-[#374151]">User</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#374151]">City</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#374151]">Mode</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#374151]">Price</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#374151]">Rooms</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#374151]">Size</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#374151]">Created</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p: any) => (
                  <tr key={p.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB]" data-testid={`row-profile-${p.id}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#111C3D]">{p.userName || "Unknown"}</p>
                    </td>
                    <td className="px-4 py-3 text-[#374151] font-medium">{p.city_name || p.city}</td>
                    <td className="px-4 py-3">
                      {p.location_mode ? <Badge variant="secondary" className="text-[10px]">{p.location_mode}</Badge> : <span className="text-[#9CA3AF]">city</span>}
                      {p.districts?.length > 0 && <span className="text-[11px] text-[#6B7280] ml-1">({p.districts.length} districts)</span>}
                      {p.radius_km && <span className="text-[11px] text-[#6B7280] ml-1">{p.radius_km}km</span>}
                      {p.commute_destination && <span className="text-[11px] text-[#6B7280] ml-1">{p.commute_mode} {p.commute_minutes}min</span>}
                    </td>
                    <td className="px-4 py-3 text-[#374151]">€{p.price_min || 0}–€{p.price_max || "∞"}</td>
                    <td className="px-4 py-3 text-[#374151]">{p.bedrooms_min || 0}+</td>
                    <td className="px-4 py-3 text-[#374151]">{p.size_min || 0}+ m²</td>
                    <td className="px-4 py-3 text-[#6B7280]">{p.created_at ? new Date(p.created_at).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > 50 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#E5E7EB]">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <span className="text-[13px] text-[#6B7280]">Page {page}</span>
              <Button variant="outline" size="sm" disabled={profiles.length < 50} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ListingsTab() {
  const [listings, setListings] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [latestRun, setLatestRun] = useState<any>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [page, setPage] = useState(1);
  const [section, setSection] = useState<"sources" | "listings">("sources");

  useEffect(() => {
    adminFetch("/api/admin/portal/sources")
      .then((d) => { setSources(d.sources); setLatestRun(d.latestRun); })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (section !== "listings") return;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (sourceFilter) params.set("source", sourceFilter);
    if (cityFilter) params.set("city", cityFilter);
    adminFetch(`/api/admin/portal/listings?${params}`)
      .then((d) => { setListings(d.listings); setTotal(d.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [section, page, sourceFilter, cityFilter]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {["sources", "listings"].map((s) => (
          <button
            key={s}
            onClick={() => { setSection(s as any); setPage(1); }}
            className={`px-4 py-2 rounded-full text-[13px] font-medium transition-colors ${section === s ? "bg-[#0D6EFD] text-white" : "bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB]"}`}
            data-testid={`tab-${s}`}
          >
            {s === "sources" ? "Source Monitor" : "Listings"}
          </button>
        ))}
      </div>

      {section === "sources" ? (
        <div className="space-y-4">
          {latestRun && (
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 text-[13px]">
              <div className="flex items-center gap-3 mb-2">
                <StatusBadge status={latestRun.status} />
                <span className="text-[#6B7280]">Last run: {new Date(latestRun.started_at).toLocaleString()}</span>
                <span className="text-[#6B7280]">Duration: {latestRun.duration_sec}s</span>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-[#374151]">Source</th>
                    <th className="text-left px-4 py-3 font-semibold text-[#374151]">Status</th>
                    <th className="text-left px-4 py-3 font-semibold text-[#374151]">Found</th>
                    <th className="text-left px-4 py-3 font-semibold text-[#374151]">Inserted</th>
                    <th className="text-left px-4 py-3 font-semibold text-[#374151]">Duplicates</th>
                    <th className="text-left px-4 py-3 font-semibold text-[#374151]">Matches</th>
                    <th className="text-left px-4 py-3 font-semibold text-[#374151]">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((s: any) => (
                    <tr key={s.name || s.source} className="border-b border-[#F3F4F6]" data-testid={`row-source-${s.name || s.source}`}>
                      <td className="px-4 py-3 font-medium text-[#111C3D]">{s.name || s.source}</td>
                      <td className="px-4 py-3"><StatusBadge status={s.status || (s.errors > 0 ? "degraded" : s.found > 0 ? "active" : "broken")} /></td>
                      <td className="px-4 py-3 text-[#374151]">{s.found ?? 0}</td>
                      <td className="px-4 py-3 text-[#374151]">{s.inserted ?? 0}</td>
                      <td className="px-4 py-3 text-[#374151]">{s.duplicates ?? s.skipped ?? 0}</td>
                      <td className="px-4 py-3 text-[#374151]">{s.matches ?? s.matched ?? 0}</td>
                      <td className="px-4 py-3">{(s.errors ?? 0) > 0 ? <span className="text-red-600 font-medium">{s.errors}</span> : <span className="text-[#374151]">0</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <input
              placeholder="Filter by city..."
              value={cityFilter}
              onChange={(e) => { setCityFilter(e.target.value); setPage(1); }}
              className="h-10 px-4 rounded-lg border border-[#E5E7EB] bg-white text-[14px] w-48 focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]"
              data-testid="input-city-filter"
            />
            <input
              placeholder="Filter by source..."
              value={sourceFilter}
              onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
              className="h-10 px-4 rounded-lg border border-[#E5E7EB] bg-white text-[14px] w-48 focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]"
              data-testid="input-source-filter"
            />
            <span className="text-[13px] text-[#6B7280]">{total} listings</span>
          </div>

          {loading ? <LoadingState /> : (
            <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-[#374151]">Title</th>
                      <th className="text-left px-4 py-3 font-semibold text-[#374151]">Source</th>
                      <th className="text-left px-4 py-3 font-semibold text-[#374151]">City</th>
                      <th className="text-left px-4 py-3 font-semibold text-[#374151]">Price</th>
                      <th className="text-left px-4 py-3 font-semibold text-[#374151]">Created</th>
                      <th className="text-left px-4 py-3 font-semibold text-[#374151]"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {listings.map((l: any) => (
                      <tr key={l.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB]" data-testid={`row-listing-${l.id}`}>
                        <td className="px-4 py-3 font-medium text-[#111C3D] max-w-[200px] truncate">{l.title || "Untitled"}</td>
                        <td className="px-4 py-3"><Badge variant="secondary" className="text-[10px]">{l.source}</Badge></td>
                        <td className="px-4 py-3 text-[#374151]">{l.city}</td>
                        <td className="px-4 py-3 text-[#374151]">€{l.price || "—"}</td>
                        <td className="px-4 py-3 text-[#6B7280]">{l.created_at ? new Date(l.created_at).toLocaleDateString() : "—"}</td>
                        <td className="px-4 py-3">
                          {l.url && <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-[#0D6EFD]"><ExternalLink className="w-3.5 h-3.5" /></a>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {total > 50 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-[#E5E7EB]">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                  <span className="text-[13px] text-[#6B7280]">Page {page}</span>
                  <Button variant="outline" size="sm" disabled={listings.length < 50} onClick={() => setPage(p => p + 1)}>Next</Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MatchesTab() {
  const [matches, setMatches] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    adminFetch(`/api/admin/portal/matches?page=${page}&limit=50`)
      .then((d) => { setMatches(d.matches); setTotal(d.total); setStats(d.stats); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="space-y-4">
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <KpiCard label="Emails Today" value={stats.emailsToday} icon={Mail} color="purple" />
          <KpiCard label="Push Today" value={stats.pushesToday} icon={Smartphone} color="blue" />
          <KpiCard label="Failures (7d)" value={stats.failuresWeek} icon={AlertTriangle} color="red" />
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-[13px] text-[#6B7280]">{total} total matches</span>
      </div>

      {loading ? <LoadingState /> : (
        <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-[#374151]">User</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#374151]">Listing</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#374151]">Matched</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#374151]">Viewed</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#374151]">Email</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#374151]">Push</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m: any) => (
                  <tr key={m.id} className="border-b border-[#F3F4F6]" data-testid={`row-match-${m.id}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#111C3D]">{m.first_name || ""} {m.last_name || ""}</p>
                      <p className="text-[#9CA3AF] text-[11px]">{m.user_id?.substring(0, 8)}...</p>
                    </td>
                    <td className="px-4 py-3 text-[#374151] max-w-[180px] truncate">{m.listing_title || m.listing_id?.substring(0, 12)}</td>
                    <td className="px-4 py-3 text-[#6B7280]">{m.matched_at ? new Date(m.matched_at).toLocaleString() : "—"}</td>
                    <td className="px-4 py-3">{m.viewed ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-[#D1D5DB]" />}</td>
                    <td className="px-4 py-3">{m.email_sent ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-[#D1D5DB]" />}</td>
                    <td className="px-4 py-3">{m.push_sent ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-[#D1D5DB]" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > 50 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#E5E7EB]">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <span className="text-[13px] text-[#6B7280]">Page {page}</span>
              <Button variant="outline" size="sm" disabled={matches.length < 50} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SystemStatusTab() {
  const [checks, setChecks] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    adminFetch("/api/admin/portal/system-status")
      .then(setChecks)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const statusIcon = (s: string) => {
    if (s === "operational") return <CheckCircle className="w-5 h-5 text-green-500" />;
    if (s === "warning" || s === "disabled") return <AlertTriangle className="w-5 h-5 text-amber-500" />;
    return <XCircle className="w-5 h-5 text-red-500" />;
  };

  const labels: Record<string, string> = {
    stripe: "Stripe Payments",
    placesApi: "Google Places API",
    ingestionScheduler: "Ingestion Scheduler",
    email: "Email (Resend)",
    pushNotifications: "Push Notifications",
    replitDb: "Replit PostgreSQL",
    supabaseDb: "Supabase Database",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[18px] font-bold text-[#111C3D]">System Status</h2>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} data-testid="button-refresh-status">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {loading ? <LoadingState /> : checks ? (
        <div className="bg-white rounded-xl border border-[#E5E7EB] divide-y divide-[#E5E7EB]">
          {Object.entries(checks).map(([key, val]) => (
            <div key={key} className="flex items-center gap-4 px-5 py-4" data-testid={`status-${key}`}>
              {statusIcon(val.status)}
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-[#111C3D]">{labels[key] || key}</p>
                <p className="text-[13px] text-[#6B7280]">{val.message}</p>
              </div>
              <StatusBadge status={val.status} />
            </div>
          ))}
        </div>
      ) : <p className="text-[#6B7280]">Failed to load system status.</p>}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-8 h-8 text-[#0D6EFD] animate-spin" />
    </div>
  );
}

export default function AdminPortalPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [accessDenied, setAccessDenied] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!user) return;
    adminFetch("/api/admin/portal/system-status")
      .then(() => setChecking(false))
      .catch((err) => {
        if (err.message === "ACCESS_DENIED") {
          setAccessDenied(true);
        }
        setChecking(false);
      });
  }, [user]);

  if (checking) return <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center"><Loader2 className="w-8 h-8 text-[#0D6EFD] animate-spin" /></div>;

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center px-5">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-[20px] font-bold text-[#111C3D] mb-2">Access Denied</h1>
          <p className="text-[14px] text-[#6B7280]">Your account does not have admin access.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <header className="bg-white border-b border-[#E5E7EB] sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-[56px] flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#0F172A] flex items-center justify-center">
              <Home className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-[#111C3D] text-[16px]">HousAlert Admin</span>
          </div>
          <div className="flex-1" />
          <button onClick={() => navigate("/dashboard")} className="text-[13px] text-[#6B7280] hover:text-[#0D6EFD]" data-testid="link-back-app">Back to app</button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex gap-6">
          <aside className="hidden md:block w-[200px] flex-shrink-0">
            <nav className="space-y-1 sticky top-[72px]">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[14px] font-medium transition-colors text-left ${
                    activeTab === id
                      ? "bg-[#0D6EFD] text-white"
                      : "text-[#374151] hover:bg-white hover:text-[#0D6EFD]"
                  }`}
                  data-testid={`nav-tab-${id}`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </nav>
          </aside>

          <div className="md:hidden w-full overflow-x-auto pb-2 mb-2">
            <div className="flex gap-2 min-w-max">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors ${
                    activeTab === id ? "bg-[#0D6EFD] text-white" : "bg-white text-[#374151] border border-[#E5E7EB]"
                  }`}
                  data-testid={`nav-tab-mobile-${id}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <main className="flex-1 min-w-0">
            {activeTab === "overview" && <OverviewTab />}
            {activeTab === "users" && <UsersTab />}
            {activeTab === "subscriptions" && <SubscriptionsTab />}
            {activeTab === "profiles" && <SearchProfilesTab />}
            {activeTab === "listings" && <ListingsTab />}
            {activeTab === "matches" && <MatchesTab />}
            {activeTab === "system" && <SystemStatusTab />}
          </main>
        </div>
      </div>
    </div>
  );
}
