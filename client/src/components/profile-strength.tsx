import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Circle,
  Bell,
  Users,
  Search,
  FileText,
  FolderOpen,
  Phone,
  ArrowLeft,
  ArrowRight,
  Shield,
  Sparkles,
  Target,
  Eye,
  Copy,
  Plus,
  Mail,
  Smartphone,
  Zap,
} from "lucide-react";

interface Task {
  id: string;
  label: string;
  completed: boolean;
  score: number;
}

interface SpeedStep {
  id: string;
  label: string;
  done: boolean;
}

interface Channels {
  email: boolean;
  push: boolean;
}

interface ProfileStrengthData {
  score: number;
  tasks: Task[];
  completedCount: number;
  totalCount: number;
  prepTasks: Task[];
  prepCompletedCount: number;
  prepTotalCount: number;
  maxScore: number;
  channels: Channels;
  speedSteps: SpeedStep[];
  speedDone: number;
  speedTotal: number;
  recommendedChannel: string | null;
}

interface ProfileData {
  search_buddy_email: string | null;
  application_template: string | null;
  document_checklist: Record<string, boolean>;
  network_task_done: boolean;
  viewing_tips_done: boolean;
}

function useProfileStrength() {
  const { session } = useAuth();
  return useQuery<ProfileStrengthData>({
    queryKey: ["/api/profile-strength"],
    queryFn: async () => {
      const res = await fetch("/api/profile-strength", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch profile strength");
      return res.json();
    },
    enabled: !!session?.access_token,
  });
}

function useProfileData() {
  const { session } = useAuth();
  return useQuery<ProfileData>({
    queryKey: ["/api/profile-data"],
    queryFn: async () => {
      const res = await fetch("/api/profile-data", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch profile data");
      return res.json();
    },
    enabled: !!session?.access_token,
  });
}

function useUpdateProfileData() {
  const { session } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (data: Partial<ProfileData>) => {
      const res = await fetch("/api/profile-data", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile-data"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile-strength"] });
    },
    onError: () => {
      toast({ title: t("profileStrength.saveFailed"), description: t("profileStrength.saveFailedDesc"), variant: "destructive" });
    },
  });
}

const TASK_ICONS: Record<string, typeof Bell> = {
  alerts: Bell,
  search_buddy: Users,
  search_optimize: Search,
  application_template: FileText,
  documents: FolderOpen,
  phone: Phone,
};

function getTaskDescriptionKey(taskId: string): string {
  const map: Record<string, string> = {
    alerts: "profileStrength.alertsDesc",
    search_buddy: "profileStrength.buddyDesc",
    search_optimize: "profileStrength.optimizeDesc",
    application_template: "profileStrength.letterDesc",
    documents: "profileStrength.docForEveryone",
    phone: "profileStrength.phoneDesc",
  };
  return map[taskId] || "";
}

export function ProfileStrengthCard() {
  const { data, isLoading } = useProfileStrength();
  const { t } = useTranslation();

  if (isLoading || !data) {
    return (
      <div className="bg-white rounded-lg shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6 animate-pulse">
        <div className="h-4 bg-[var(--yo-surface)] rounded w-32 mb-3" />
        <div className="h-6 bg-[var(--yo-surface)] rounded w-20 mb-2" />
        <div className="h-2 bg-[var(--yo-surface)] rounded w-full" />
      </div>
    );
  }

  const { score, maxScore } = data;
  const allTasks = [...data.tasks, ...data.prepTasks];
  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  const getStatusLabel = (s: number): { label: string; color: string; bg: string } => {
    if (s >= 80) return { label: t("profileStrength.readyToReact"), color: "text-[var(--yo-dark)]", bg: "bg-[var(--yo-success)]/10" };
    if (s >= 60) return { label: t("profileStrength.wellPrepared"), color: "text-[var(--yo-dark)]", bg: "bg-[var(--yo-success)]/10" };
    if (s >= 30) return { label: t("profileStrength.onTheWay"), color: "text-[var(--yo-dark)]", bg: "bg-[var(--yo-success)]/10" };
    return { label: t("profileStrength.justStarted"), color: "text-[var(--yo-dark)]", bg: "bg-[var(--yo-surface)]" };
  };

  const getRecommendation = (s: number, tasks: Task[]): string => {
    const incomplete = tasks.filter(tk => !tk.completed);
    if (incomplete.length === 0) return t("profileStrength.completeRec");
    const next = incomplete[0];
    if (s < 30) return t("profileStrength.startRec", { task: next.label });
    if (s < 60) return t("profileStrength.goodRec", { task: next.label });
    return t("profileStrength.almostRec", { task: next.label });
  };

  const status = getStatusLabel(pct);
  const recommendation = getRecommendation(pct, allTasks);

  return (
    <div className="bg-white rounded-lg shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6" data-testid="card-profile-strength">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[var(--yo-chip-bg)] flex items-center justify-center">
            <Shield className="w-4 h-4 text-[var(--yo-dark)]" />
          </div>
          <h3 className="text-[15px] font-semibold text-[var(--yo-dark)]">{t("profileStrength.title")}</h3>
        </div>
        <span className={`text-[13px] font-medium px-2.5 py-1 rounded-full ${status.bg} ${status.color}`} data-testid="text-status-label">
          {status.label}
        </span>
      </div>

      <div className="flex items-end gap-2 mb-3">
        <span className="text-[32px] font-bold text-[var(--yo-dark)] leading-none" data-testid="text-profile-score">{score}</span>
        <span className="text-[14px] text-[var(--yo-dark)] mb-1">/ {maxScore}</span>
      </div>

      <div className="w-full h-2 bg-[var(--yo-surface)] rounded-full overflow-hidden mb-3">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: pct >= 30 ? "var(--yo-pink)" : "var(--yo-muted)",
          }}
          data-testid="progress-profile-strength"
        />
      </div>

      <p className="text-[13px] text-[var(--yo-dark)]" data-testid="text-recommendation">{recommendation}</p>
    </div>
  );
}

export function AccountCompletionCard({ onTaskClick }: { onTaskClick: (taskId: string) => void }) {
  const { data, isLoading } = useProfileStrength();
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  if (isLoading || !data) {
    return (
      <div className="bg-white rounded-lg shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6 animate-pulse">
        <div className="h-4 bg-[var(--yo-surface)] rounded w-40 mb-3" />
        <div className="h-3 bg-[var(--yo-surface)] rounded w-24" />
      </div>
    );
  }

  const { tasks, completedCount, totalCount } = data;
  const percentage = Math.round((completedCount / totalCount) * 100);

  return (
    <div className="bg-white rounded-lg shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden" data-testid="card-account-completion">
      <button
        className="w-full p-6 flex items-center justify-between text-left"
        onClick={() => setExpanded(!expanded)}
        data-testid="button-toggle-tasks"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-[var(--yo-dark)]" />
            <h3 className="text-[15px] font-semibold text-[var(--yo-dark)]">{t("profileStrength.completeAccount")}</h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-[var(--yo-dark)]">
              {t("profileStrength.tasksCompleted", { done: String(completedCount), total: String(totalCount) })}
            </span>
            <span className="text-[13px] font-medium text-[var(--yo-pink)]">{percentage}%</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 relative">
            <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--yo-surface)" strokeWidth="3" />
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                stroke="var(--yo-pink)"
                strokeWidth="3"
                strokeDasharray={`${(percentage / 100) * 97.4} 97.4`}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[var(--yo-dark)]">
              {percentage}%
            </span>
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-[var(--yo-dark)]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[var(--yo-dark)]" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[var(--yo-divider)] px-6 pb-3">
          {tasks.map((task) => {
            const Icon = TASK_ICONS[task.id] || Circle;
            return (
              <button
                key={task.id}
                onClick={() => !task.completed && onTaskClick(task.id)}
                className={`w-full flex items-center gap-3 py-3.5 border-b border-[var(--yo-surface)] last:border-0 text-left ${
                  task.completed ? "opacity-60" : "hover:bg-[var(--yo-surface)]"
                } transition-colors -mx-1 px-1 rounded-lg`}
                data-testid={`task-${task.id}`}
                disabled={task.completed}
              >
                {task.completed ? (
                  <div className="w-5 h-5 rounded-full bg-[var(--yo-pink)]/10 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-[var(--yo-pink)]" />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-[var(--yo-divider)] flex-shrink-0" />
                )}
                <Icon className={`w-4 h-4 flex-shrink-0 ${task.completed ? "text-[var(--yo-dark)]" : "text-[var(--yo-dark)]"}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-[14px] font-medium ${task.completed ? "text-[var(--yo-dark)] line-through" : "text-[var(--yo-dark)]"}`}>
                    {task.label}
                  </p>
                  <p className="text-[11px] text-[var(--yo-dark)]">{t("profileStrength.points", { score: String(task.score) })}</p>
                </div>
                {!task.completed && <ArrowRight className="w-4 h-4 text-[var(--yo-dark)] flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function TaskModal({
  taskId,
  onClose,
  navigate,
}: {
  taskId: string;
  onClose: () => void;
  navigate: (path: string) => void;
}) {
  const { data: profileData } = useProfileData();
  const updateProfileData = useUpdateProfileData();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [buddyEmail, setBuddyEmail] = useState("");
  const [template, setTemplate] = useState("");
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [phoneInput, setPhoneInput] = useState("");
  const [initialized, setInitialized] = useState(false);

  if (profileData && !initialized) {
    setBuddyEmail(profileData.search_buddy_email || "");
    setTemplate(profileData.application_template || "");
    setChecklist(profileData.document_checklist || {});
    setInitialized(true);
  }

  const handleSave = async (data: Partial<ProfileData>, msg: string) => {
    await updateProfileData.mutateAsync(data);
    toast({ title: t("profileStrength.saved"), description: msg });
    onClose();
  };

  const titleMap: Record<string, string> = {
    alerts: t("profileStrength.alertsTitle"),
    search_buddy: t("profileStrength.buddyTitle"),
    search_optimize: t("profileStrength.optimizeTitle"),
    application_template: t("profileStrength.letterTitle"),
    documents: t("profileStrength.docForEveryone"),
    phone: t("profileStrength.phoneTitle"),
  };
  const title = titleMap[taskId] || "";

  const DOCUMENT_CHECKLIST = [
    {
      group: t("profileStrength.docForEveryone"),
      items: [
        { id: "id_copy", label: t("profileStrength.docIdCopy") },
        { id: "schufa", label: t("profileStrength.docSchufa") },
        { id: "income_proof", label: t("profileStrength.docIncomeProof") },
        { id: "rental_history", label: t("profileStrength.docRentalHistory") },
        { id: "photo", label: t("profileStrength.docPhoto") },
      ],
    },
    {
      group: t("profileStrength.docEmployed"),
      items: [
        { id: "employment_contract", label: t("profileStrength.docEmploymentContract") },
        { id: "payslips", label: t("profileStrength.docPayslips") },
      ],
    },
    {
      group: t("profileStrength.docSelfEmployed"),
      items: [
        { id: "business_reg", label: t("profileStrength.docBusinessReg") },
        { id: "tax_returns", label: t("profileStrength.docTaxReturns") },
        { id: "bank_statements", label: t("profileStrength.docBankStatements") },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      <header className="sticky top-0 z-10 bg-white border-b border-[var(--yo-divider)]">
        <div className="max-w-lg mx-auto flex items-center h-[56px] px-5">
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[var(--yo-surface)] flex items-center justify-center mr-3 active:scale-95 transition-transform"
            data-testid="button-close-modal"
          >
            <ArrowLeft className="w-4 h-4 text-[var(--yo-dark)]" />
          </button>
          <h1 className="text-[17px] font-bold text-[var(--yo-dark)] flex-1 uppercase tracking-wide">{title}</h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-5 py-6">
          {taskId === "alerts" && (
            <div className="flex flex-col gap-4">
              <p className="text-[14px] text-[var(--yo-dark)]">{t("profileStrength.alertsDesc")}</p>
              <Button
                onClick={() => { onClose(); navigate("/settings/notifications"); }}
                className="w-full h-[56px] rounded-lg bg-[var(--yo-teal)] hover:bg-[var(--yo-teal-hover)] text-black text-[16px] font-bold"
                data-testid="button-goto-notifications"
              >
                <Bell className="w-4 h-4 mr-2" />
                {t("profileStrength.goToAlerts")}
              </Button>
            </div>
          )}

          {taskId === "search_buddy" && (
            <div className="flex flex-col gap-4">
              <label className="text-[14px] font-medium text-[var(--yo-dark)]">{t("profileStrength.buddyEmail")}</label>
              <input
                type="email"
                value={buddyEmail}
                onChange={(e) => setBuddyEmail(e.target.value)}
                placeholder={t("profileStrength.buddyPlaceholder")}
                className="w-full h-[56px] px-4 rounded-lg border-0 bg-[var(--yo-surface)] text-[16px] font-medium text-[var(--yo-dark)] placeholder:text-[var(--yo-dark)] placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[var(--yo-teal)]/15 transition-all"
                data-testid="input-buddy-email"
              />
              <p className="text-[14px] text-[var(--yo-dark)]">{t("profileStrength.buddyDesc")}</p>
              <Button
                onClick={() => handleSave({ search_buddy_email: buddyEmail }, t("profileStrength.buddySaved"))}
                disabled={!buddyEmail.includes("@") || updateProfileData.isPending}
                className="w-full h-[56px] rounded-lg bg-[var(--yo-teal)] hover:bg-[var(--yo-teal-hover)] text-black text-[16px] font-bold disabled:opacity-50"
                data-testid="button-save-buddy"
              >
                {updateProfileData.isPending ? t("profileStrength.saving") : t("profileStrength.save")}
              </Button>
            </div>
          )}

          {taskId === "search_optimize" && (
            <div className="flex flex-col gap-4">
              <p className="text-[14px] text-[var(--yo-dark)]">
                {t("profileStrength.optimizeDesc")}
              </p>
              <Button
                onClick={() => { onClose(); navigate("/dashboard?tab=filters"); }}
                className="w-full h-[56px] rounded-lg bg-[var(--yo-teal)] hover:bg-[var(--yo-teal-hover)] text-black text-[16px] font-bold"
                data-testid="button-goto-filters"
              >
                <Search className="w-4 h-4 mr-2" />
                {t("profileStrength.goToFilters")}
              </Button>
            </div>
          )}

          {taskId === "application_template" && (
            <div className="flex flex-col gap-4">
              <p className="text-[14px] text-[var(--yo-dark)]">
                {t("profileStrength.letterDesc")}
              </p>
              <Button
                onClick={() => { onClose(); navigate("/application-letter"); }}
                className="w-full h-[56px] rounded-lg bg-[var(--yo-teal)] hover:bg-[var(--yo-teal-hover)] text-black text-[16px] font-bold"
                data-testid="button-goto-letter"
              >
                <FileText className="w-4 h-4 mr-2" />
                {t("profileStrength.goToLetter")}
              </Button>
            </div>
          )}

          {taskId === "documents" && (
            <div className="flex flex-col gap-5">
              {DOCUMENT_CHECKLIST.map((group) => (
                <div key={group.group}>
                  <h4 className="text-[14px] font-semibold text-[var(--yo-dark)] mb-3">{group.group}</h4>
                  <div className="flex flex-col gap-1">
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setChecklist((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                        className="flex items-center gap-3 py-3 px-3 rounded-lg hover:bg-[var(--yo-surface)] transition-colors text-left"
                        data-testid={`check-${item.id}`}
                      >
                        {checklist[item.id] ? (
                          <div className="w-6 h-6 rounded-full bg-[var(--yo-success)]/10 flex items-center justify-center flex-shrink-0">
                            <CheckCircle2 className="w-5 h-5 text-[var(--yo-success)]" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full border-2 border-[var(--yo-divider)] flex-shrink-0" />
                        )}
                        <span className={`text-[15px] ${checklist[item.id] ? "text-[var(--yo-dark)] line-through" : "text-[var(--yo-dark)]"}`}>
                          {item.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <Button
                onClick={() => handleSave({ document_checklist: checklist }, t("profileStrength.docListSaved"))}
                disabled={updateProfileData.isPending}
                className="w-full h-[56px] rounded-lg bg-[var(--yo-teal)] hover:bg-[var(--yo-teal-hover)] text-black text-[16px] font-bold disabled:opacity-50"
                data-testid="button-save-documents"
              >
                {updateProfileData.isPending ? t("profileStrength.saving") : t("profileStrength.save")}
              </Button>
            </div>
          )}

          {taskId === "phone" && (
            <div className="flex flex-col gap-4">
              <label className="text-[14px] font-medium text-[var(--yo-dark)]">{t("profileStrength.phoneLabel")}</label>
              <input
                type="tel"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="+49 170 1234567"
                className="w-full h-[56px] px-4 rounded-lg border-0 bg-[var(--yo-surface)] text-[16px] font-medium text-[var(--yo-dark)] placeholder:text-[var(--yo-dark)] placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[var(--yo-teal)]/15 transition-all"
                data-testid="input-phone"
              />
              <p className="text-[14px] text-[var(--yo-dark)]">{t("profileStrength.phoneDesc")}</p>
              <Button
                onClick={() => { onClose(); navigate("/settings/notifications"); }}
                className="w-full h-[56px] rounded-lg bg-[var(--yo-teal)] hover:bg-[var(--yo-teal-hover)] text-black text-[16px] font-bold"
                data-testid="button-goto-phone-settings"
              >
                <Phone className="w-4 h-4 mr-2" />
                {t("profileStrength.goToPhoneSettings")}
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

const PREP_TASK_ICONS: Record<string, typeof Bell> = {
  prep_search_profile: Search,
  prep_letter: FileText,
  prep_extra_profile: Plus,
  prep_network: Users,
  prep_viewing_tips: Eye,
};

export function SearchPreparationCard({ onTaskClick }: { onTaskClick: (taskId: string) => void }) {
  const { data, isLoading } = useProfileStrength();
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  if (isLoading || !data) {
    return (
      <div className="bg-white rounded-lg shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6 animate-pulse">
        <div className="h-4 bg-[var(--yo-surface)] rounded w-40 mb-3" />
        <div className="h-3 bg-[var(--yo-surface)] rounded w-24" />
      </div>
    );
  }

  const { prepTasks, prepCompletedCount, prepTotalCount } = data;
  const percentage = prepTotalCount > 0 ? Math.round((prepCompletedCount / prepTotalCount) * 100) : 0;

  return (
    <div className="bg-white rounded-lg shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden" data-testid="card-search-preparation">
      <button
        className="w-full p-6 flex items-center justify-between text-left"
        onClick={() => setExpanded(!expanded)}
        data-testid="button-toggle-prep-tasks"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-[var(--yo-dark)]" />
            <h3 className="text-[15px] font-semibold text-[var(--yo-dark)]">{t("profileStrength.prepareSearch")}</h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-[var(--yo-dark)]">
              {t("profileStrength.tasksCompleted", { done: String(prepCompletedCount), total: String(prepTotalCount) })}
            </span>
            <span className="text-[13px] font-medium text-[var(--yo-pink)]">{percentage}%</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 relative">
            <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--yo-surface)" strokeWidth="3" />
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                stroke="var(--yo-pink)"
                strokeWidth="3"
                strokeDasharray={`${(percentage / 100) * 97.4} 97.4`}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[var(--yo-dark)]">
              {percentage}%
            </span>
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-[var(--yo-dark)]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[var(--yo-dark)]" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[var(--yo-divider)] px-6 pb-3">
          {prepTasks.map((task) => {
            const Icon = PREP_TASK_ICONS[task.id] || Circle;
            return (
              <button
                key={task.id}
                onClick={() => !task.completed && onTaskClick(task.id)}
                className={`w-full flex items-center gap-3 py-3.5 border-b border-[var(--yo-surface)] last:border-0 text-left ${
                  task.completed ? "opacity-60" : "hover:bg-[var(--yo-surface)]"
                } transition-colors -mx-1 px-1 rounded-lg`}
                data-testid={`task-${task.id}`}
                disabled={task.completed}
              >
                {task.completed ? (
                  <div className="w-5 h-5 rounded-full bg-[var(--yo-pink)]/10 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-[var(--yo-pink)]" />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-[var(--yo-divider)] flex-shrink-0" />
                )}
                <Icon className={`w-4 h-4 flex-shrink-0 ${task.completed ? "text-[var(--yo-dark)]" : "text-[var(--yo-dark)]"}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-[14px] font-medium ${task.completed ? "text-[var(--yo-dark)] line-through" : "text-[var(--yo-dark)]"}`}>
                    {task.label}
                  </p>
                  <p className="text-[11px] text-[var(--yo-dark)]">{t("profileStrength.points", { score: String(task.score) })}</p>
                </div>
                {!task.completed && <ArrowRight className="w-4 h-4 text-[var(--yo-dark)] flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function PrepTaskModal({
  taskId,
  onClose,
  navigate,
}: {
  taskId: string;
  onClose: () => void;
  navigate: (path: string) => void;
}) {
  const updateProfileData = useUpdateProfileData();
  const { toast } = useToast();
  const { t } = useTranslation();

  const titles: Record<string, string> = {
    prep_search_profile: t("profileStrength.prepCreateTitle"),
    prep_letter: t("profileStrength.prepLetterTitle"),
    prep_extra_profile: t("profileStrength.prepExtraTitle"),
    prep_network: t("profileStrength.prepNetworkTitle"),
    prep_viewing_tips: t("profileStrength.prepViewingTitle"),
  };

  const handleMarkDone = async (field: string) => {
    await updateProfileData.mutateAsync({ [field]: true } as any);
    queryClient.invalidateQueries({ queryKey: ["/api/profile-strength"] });
    toast({ title: t("profileStrength.completed"), description: t("profileStrength.completedDesc") });
    onClose();
  };

  const handleCopyShare = async () => {
    try {
      await navigator.clipboard.writeText(t("profileStrength.shareText"));
      toast({ title: t("profileStrength.copySuccess"), description: t("profileStrength.copySuccessDesc") });
    } catch {
      toast({ title: t("profileStrength.copyError"), description: t("profileStrength.copyErrorDesc"), variant: "destructive" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      <header className="sticky top-0 z-10 bg-white border-b border-[var(--yo-divider)]">
        <div className="max-w-lg mx-auto flex items-center h-[56px] px-5">
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[var(--yo-surface)] flex items-center justify-center mr-3 active:scale-95 transition-transform"
            data-testid="button-close-prep-modal"
          >
            <ArrowLeft className="w-4 h-4 text-[var(--yo-dark)]" />
          </button>
          <h1 className="text-[17px] font-bold text-[var(--yo-dark)] flex-1 uppercase tracking-wide">{titles[taskId] || ""}</h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-5 py-6">
          {taskId === "prep_search_profile" && (
            <div className="flex flex-col gap-4">
              <p className="text-[15px] text-[var(--yo-dark)] leading-relaxed">
                {t("profileStrength.prepCreateDesc")}
              </p>
              <Button
                onClick={() => { onClose(); navigate("/dashboard/searches/new"); }}
                className="w-full h-[56px] rounded-lg bg-[var(--yo-teal)] hover:bg-[var(--yo-teal-hover)] text-black text-[16px] font-bold"
                data-testid="button-prep-create-profile"
              >
                <Search className="w-4 h-4 mr-2" />
                {t("profileStrength.prepCreateBtn")}
              </Button>
            </div>
          )}

          {taskId === "prep_letter" && (
            <div className="flex flex-col gap-4">
              <p className="text-[15px] text-[var(--yo-dark)] leading-relaxed">
                {t("profileStrength.prepLetterDesc")}
              </p>
              <Button
                onClick={() => { onClose(); navigate("/application-letter"); }}
                className="w-full h-[56px] rounded-lg bg-[var(--yo-teal)] hover:bg-[var(--yo-teal-hover)] text-black text-[16px] font-bold"
                data-testid="button-prep-goto-letter"
              >
                <FileText className="w-4 h-4 mr-2" />
                {t("profileStrength.prepLetterBtn")}
              </Button>
            </div>
          )}

          {taskId === "prep_extra_profile" && (
            <div className="flex flex-col gap-5">
              <p className="text-[15px] text-[var(--yo-dark)] leading-relaxed">
                {t("profileStrength.prepExtraDesc")}
              </p>
              <div className="bg-[var(--yo-surface)] rounded-lg p-5">
                <p className="text-[14px] font-semibold text-[var(--yo-dark)] mb-3">{t("profileStrength.prepWhyTitle")}</p>
                <ul className="text-[14px] text-[var(--yo-dark)] space-y-2">
                  <li className="flex items-start gap-2"><span className="text-[var(--yo-dark)] mt-0.5">+</span>{t("profileStrength.prepWhy1")}</li>
                  <li className="flex items-start gap-2"><span className="text-[var(--yo-dark)] mt-0.5">+</span>{t("profileStrength.prepWhy2")}</li>
                  <li className="flex items-start gap-2"><span className="text-[var(--yo-dark)] mt-0.5">+</span>{t("profileStrength.prepWhy3")}</li>
                </ul>
              </div>
              <Button
                onClick={() => { onClose(); navigate("/dashboard/searches/new"); }}
                className="w-full h-[56px] rounded-lg bg-[var(--yo-teal)] hover:bg-[var(--yo-teal-hover)] text-black text-[16px] font-bold"
                data-testid="button-prep-add-profile"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t("profileStrength.prepExtraBtn")}
              </Button>
            </div>
          )}

          {taskId === "prep_network" && (
            <div className="flex flex-col gap-5">
              <p className="text-[15px] text-[var(--yo-dark)] leading-relaxed">
                {t("profileStrength.prepNetworkDesc")}
              </p>
              <div className="bg-[var(--yo-surface)] rounded-lg p-5">
                <p className="text-[14px] font-semibold text-[var(--yo-dark)] mb-3">{t("profileStrength.shareTextLabel")}</p>
                <p className="text-[14px] text-[var(--yo-dark)] leading-relaxed">{t("profileStrength.shareText")}</p>
              </div>
              <Button
                variant="outline"
                onClick={handleCopyShare}
                className="w-full h-[48px] rounded-lg text-[15px] font-medium border-[var(--yo-divider)] text-[var(--yo-dark)]"
                data-testid="button-copy-share"
              >
                <Copy className="w-4 h-4 mr-2" />
                {t("profileStrength.copyShareText")}
              </Button>
              <Button
                onClick={() => handleMarkDone("network_task_done")}
                disabled={updateProfileData.isPending}
                className="w-full h-[56px] rounded-lg bg-[var(--yo-teal)] hover:bg-[var(--yo-teal-hover)] text-black text-[16px] font-bold disabled:opacity-50"
                data-testid="button-mark-network-done"
              >
                {updateProfileData.isPending ? t("profileStrength.saving") : t("profileStrength.markComplete")}
              </Button>
            </div>
          )}

          {taskId === "prep_viewing_tips" && (
            <div className="flex flex-col gap-4">
              <p className="text-[15px] text-[var(--yo-dark)] leading-relaxed">
                {t("profileStrength.prepViewingDesc")}
              </p>
              <Button
                onClick={() => { onClose(); navigate("/tips/bezichtiging"); }}
                className="w-full h-[56px] rounded-lg bg-[var(--yo-teal)] hover:bg-[var(--yo-teal-hover)] text-black text-[16px] font-bold"
                data-testid="button-goto-viewing-tips"
              >
                <Eye className="w-4 h-4 mr-2" />
                {t("profileStrength.prepViewingBtn")}
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export function NotificationSummaryCard({ navigate }: { navigate: (path: string) => void }) {
  const { data, isLoading } = useProfileStrength();
  const { t } = useTranslation();

  if (isLoading || !data) {
    return (
      <div className="bg-white rounded-lg shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5 animate-pulse">
        <div className="h-4 bg-[var(--yo-surface)] rounded w-40 mb-3" />
        <div className="h-3 bg-[var(--yo-surface)] rounded w-32" />
      </div>
    );
  }

  const { channels, recommendedChannel } = data;

  const channelList = [
    { key: "email", label: t("profileStrength.notifEmail"), enabled: channels.email, Icon: Mail },
    { key: "push", label: t("profileStrength.notifPush"), enabled: channels.push, Icon: Bell },
  ];

  const activeCount = channelList.filter(c => c.enabled).length;

  return (
    <div className="bg-white rounded-lg shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5" data-testid="card-notification-summary">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[var(--yo-chip-bg)] flex items-center justify-center">
            <Bell className="w-4 h-4 text-[var(--yo-dark)]" />
          </div>
          <h3 className="text-[15px] font-semibold text-[var(--yo-dark)]">{t("profileStrength.notifChannels")}</h3>
        </div>
        <span className={`text-[12px] font-medium px-2.5 py-1 rounded-full ${activeCount > 0 ? "bg-[var(--yo-chip-bg)] text-[var(--yo-dark)]" : "bg-[var(--yo-surface)] text-[var(--yo-dark)]"}`}>
          {activeCount > 0 ? t("profileStrength.notifActive", { count: String(activeCount) }) : t("profileStrength.notifNoneActive")}
        </span>
      </div>

      <div className="flex flex-col gap-2.5 mb-4">
        {channelList.map(({ key, label, enabled, Icon }) => (
          <div key={key} className="flex items-center gap-3" data-testid={`channel-status-${key}`}>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${enabled ? "bg-[var(--yo-chip-bg)]" : "bg-[var(--yo-surface)]"}`}>
              <Icon className={`w-3.5 h-3.5 ${enabled ? "text-[var(--yo-dark)]" : "text-[var(--yo-dark)]"}`} />
            </div>
            <span className={`text-[14px] flex-1 ${enabled ? "text-[var(--yo-dark)] font-medium" : "text-[var(--yo-dark)]"}`}>
              {label}
            </span>
            {enabled ? (
              <div className="w-4 h-4 rounded-full bg-[var(--yo-success)]/10 flex items-center justify-center">
                <CheckCircle2 className="w-3 h-3 text-[var(--yo-success)]" />
              </div>
            ) : (
              <div className="w-4 h-4 rounded-full border-2 border-[var(--yo-divider)]" />
            )}
          </div>
        ))}
      </div>

      {recommendedChannel && (
        <div className="bg-[var(--yo-chip-bg)] rounded-lg px-3.5 py-2.5 mb-3">
          <p className="text-[12px] text-[var(--yo-dark)] font-medium flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" />
            {t("profileStrength.fastestChannel", { channel: recommendedChannel })}
          </p>
        </div>
      )}

      <button
        onClick={() => navigate("/settings/notifications")}
        className="w-full h-[40px] rounded-lg border border-[var(--yo-divider)] bg-white text-[13px] font-semibold text-[var(--yo-dark)] hover:bg-[var(--yo-surface)] transition-colors flex items-center justify-center gap-1.5"
        data-testid="button-manage-channels"
      >
        <Bell className="w-3.5 h-3.5" />
        {t("profileStrength.manageChannels")}
      </button>
    </div>
  );
}

export function SpeedReadinessCard({ navigate }: { navigate: (path: string) => void }) {
  const { data, isLoading } = useProfileStrength();
  const { t } = useTranslation();

  if (isLoading || !data) {
    return (
      <div className="bg-white rounded-lg shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5 animate-pulse">
        <div className="h-4 bg-[var(--yo-surface)] rounded w-40 mb-3" />
        <div className="h-3 bg-[var(--yo-surface)] rounded w-24" />
      </div>
    );
  }

  const { speedSteps, speedDone, speedTotal } = data;
  const allDone = speedDone === speedTotal;

  const stepActions: Record<string, string> = {
    alerts_active: "/settings/notifications",
    letter_ready: "/application-letter",
    documents_ready: "",
    phone_added: "/settings/notifications",
  };

  return (
    <div className="bg-white rounded-lg shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5" data-testid="card-speed-readiness">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-full bg-[var(--yo-chip-bg)] flex items-center justify-center">
          <Zap className="w-4 h-4 text-[var(--yo-dark)]" />
        </div>
        <div className="flex-1">
          <h3 className="text-[15px] font-semibold text-[var(--yo-dark)]">{t("profileStrength.reactionSpeed")}</h3>
        </div>
        <span className={`text-[12px] font-medium px-2.5 py-1 rounded-full ${allDone ? "bg-[var(--yo-success)]/10 text-[var(--yo-dark)]" : "bg-[var(--yo-chip-bg)] text-[var(--yo-dark)]"}`}>
          {speedDone}/{speedTotal}
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        {speedSteps.map((step) => {
          const route = stepActions[step.id];
          return (
            <div
              key={step.id}
              className={`flex items-center gap-3 ${!step.done && route ? "cursor-pointer hover:bg-[var(--yo-surface)] -mx-2 px-2 py-1 rounded-lg transition-colors" : "py-0.5"}`}
              onClick={() => {
                if (!step.done && route) navigate(route);
              }}
              data-testid={`speed-step-${step.id}`}
            >
              {step.done ? (
                <div className="w-5 h-5 rounded-full bg-[var(--yo-success)]/10 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-[var(--yo-success)]" />
                </div>
              ) : (
                <div className="w-4.5 h-4.5 rounded-full border-2 border-[var(--yo-divider)] flex-shrink-0" />
              )}
              <span className={`text-[14px] flex-1 ${step.done ? "text-[var(--yo-dark)]" : "text-[var(--yo-dark)] font-medium"}`}>
                {step.label}
              </span>
              {!step.done && route && (
                <ArrowRight className="w-3.5 h-3.5 text-[var(--yo-dark)]" />
              )}
            </div>
          );
        })}
      </div>

      {allDone && (
        <div className="mt-4 bg-[var(--yo-success)]/10 rounded-lg px-3.5 py-2.5">
          <p className="text-[12px] text-[var(--yo-success)] font-medium flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" />
            {t("profileStrength.readyFast")}
          </p>
        </div>
      )}
    </div>
  );
}

export function SpeedBanner({ navigate }: { navigate: (path: string) => void }) {
  const { data, isLoading } = useProfileStrength();
  const { t } = useTranslation();

  if (isLoading || !data) return null;

  const { speedDone, speedTotal, score, maxScore } = data;
  const allDone = speedDone === speedTotal;
  const remaining = speedTotal - speedDone;
  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  if (allDone) {
    return (
      <div
        className="bg-[var(--yo-chip-bg)] rounded-lg p-4 flex items-center gap-3 cursor-pointer hover:bg-[var(--yo-chip-bg)]/80 transition-colors"
        onClick={() => navigate("/dashboard")}
        data-testid="banner-speed-ready"
      >
        <div className="w-9 h-9 rounded-full bg-[var(--yo-chip-bg)] flex items-center justify-center flex-shrink-0">
          <Zap className="w-4 h-4 text-[var(--yo-dark)]" />
        </div>
        <div className="flex-1">
          <p className="text-[14px] font-semibold text-[var(--yo-dark)]">{t("profileStrength.readyFast")}</p>
          <p className="text-[12px] text-[var(--yo-dark)]">{t("profileStrength.allStepsComplete")}</p>
        </div>
        <span className="text-[13px] font-bold text-[var(--yo-dark)]">{pct}%</span>
      </div>
    );
  }

  return (
    <div
      className="bg-[var(--yo-chip-bg)] rounded-lg p-4 flex items-center gap-3 cursor-pointer hover:bg-[var(--yo-chip-bg)]/80 transition-colors"
      onClick={() => navigate("/dashboard")}
      data-testid="banner-speed-incomplete"
    >
      <div className="w-9 h-9 rounded-full bg-[var(--yo-chip-bg)] flex items-center justify-center flex-shrink-0">
        <Zap className="w-4 h-4 text-[var(--yo-dark)]" />
      </div>
      <div className="flex-1">
        <p className="text-[14px] font-semibold text-[var(--yo-dark)]">
          {t("profileStrength.stepsRemaining", { count: String(remaining), label: remaining === 1 ? t("profileStrength.stepSingular") : t("profileStrength.stepPluralLabel") })}
        </p>
        <p className="text-[12px] text-[var(--yo-dark)]">{t("profileStrength.completeYourProfile")}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-[var(--yo-dark)] flex-shrink-0" />
    </div>
  );
}

export function ProfileStrengthSection({ navigate }: { navigate: (path: string) => void }) {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activePrepTaskId, setActivePrepTaskId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <ProfileStrengthCard />
      <AccountCompletionCard onTaskClick={setActiveTaskId} />
      <SearchPreparationCard onTaskClick={setActivePrepTaskId} />

      {activeTaskId && (
        <TaskModal taskId={activeTaskId} onClose={() => setActiveTaskId(null)} navigate={navigate} />
      )}
      {activePrepTaskId && (
        <PrepTaskModal taskId={activePrepTaskId} onClose={() => setActivePrepTaskId(null)} navigate={navigate} />
      )}
    </div>
  );
}
