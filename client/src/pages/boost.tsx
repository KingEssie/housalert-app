import { apiFetch } from "@/lib/api-base";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Zap,
  CheckCircle2,
  ArrowRight,
  Bell,
  Users,
  Search,
  FileText,
  FolderOpen,
  Phone,
  Shield,
  X,
  Camera,
  UserCircle,
  Rocket,
} from "lucide-react";
import { ReactieklaarCard } from "@/components/reactieklaar-card";
import { RECOMMENDATION_META } from "@shared/boost-recommendations";

interface BoostTask {
  id: string;
  weight: number;
  label: string;
  description: string;
  completed: boolean;
}

interface BoostData {
  boostScore: number;
  tasks: BoostTask[];
  completedCount: number;
  totalCount: number;
  recommendations: BoostTask[];
  speedSteps: { id: string; label: string; done: boolean }[];
  speedDone: number;
  speedTotal: number;
}

interface ProfileData {
  search_buddy_email: string | null;
  application_template: string | null;
  document_checklist: Record<string, boolean>;
  network_task_done: boolean;
  viewing_tips_done: boolean;
}

const TASK_ICONS: Record<string, typeof Bell> = {
  alerts_active: Bell,
  search_buddy_added: Users,
  income_documents_uploaded: FolderOpen,
  id_document_uploaded: Shield,
  reaction_letter_ready: FileText,
  phone_number_added: Phone,
  housing_preferences_completed: Search,
  profile_info_completed: UserCircle,
  profile_photo_added: Camera,
};

const INCOME_CHECKLIST = [
  { id: "income_proof", label: "Einkommensnachweis (letzte 3 Monate)" },
  { id: "employment_contract", label: "Arbeitsvertrag" },
  { id: "payslips", label: "Gehaltsabrechnungen (letzte 3 Monate)" },
  { id: "tax_returns", label: "Steuererklärung (letzte 2 Jahre)" },
  { id: "bank_statements", label: "Kontoauszüge (letzte 3 Monate)" },
];

const ID_CHECKLIST = [
  { id: "id_copy", label: "Kopie des Personalausweises" },
  { id: "photo", label: "Passfoto" },
];

function useBoostData() {
  const { session } = useAuth();
  return useQuery<BoostData>({
    queryKey: ["/api/boost"],
    queryFn: async () => {
      const res = await apiFetch("/api/boost", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch boost data");
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
      const res = await apiFetch("/api/profile-data", {
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
  return useMutation({
    mutationFn: async (data: Partial<ProfileData>) => {
      const res = await apiFetch("/api/profile-data", {
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
      queryClient.invalidateQueries({ queryKey: ["/api/boost"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile-strength"] });
    },
    onError: () => {
      toast({ title: "Fehler", description: "Daten konnten nicht gespeichert werden.", variant: "destructive" });
    },
  });
}

function getScoreMicrocopy(score: number, remaining: number): string {
  if (remaining <= 0) return "Du bist komplett bereit, blitzschnell zu reagieren.";
  if (score >= 90) return "Du bist komplett bereit, blitzschnell zu reagieren.";
  if (score >= 70) return `Noch ${remaining} ${remaining === 1 ? "Schritt" : "Schritte"} und dein Profil ist vollständig.`;
  if (score >= 40) return `Schließe noch ${remaining} ${remaining === 1 ? "Schritt" : "Schritte"} ab, um schneller auf Wohnungen zu reagieren.`;
  if (score >= 10) return `Starte mit dem ersten Schritt und erhöhe direkt deine Chancen.`;
  return "Vervollständige dein Profil und reagiere schneller auf neue Wohnungen.";
}

function getScoreColor(score: number): string {
  if (score >= 30) return "var(--yo-pink)";
  return "var(--yo-muted)";
}

function getScoreHeadline(score: number): string {
  if (score >= 90) return "Bereit zum Reagieren";
  if (score >= 70) return "Fast fertig";
  if (score >= 40) return "Gut unterwegs";
  if (score >= 10) return "Gerade gestartet";
  return "Bereit loszulegen";
}

function BoostScoreCard({ score, remaining, completed, total }: { score: number; remaining: number; completed: number; total: number }) {
  const color = getScoreColor(score);
  const microcopy = getScoreMicrocopy(score, remaining);
  const headline = getScoreHeadline(score);

  return (
    <div className="bg-white rounded-lg shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6" data-testid="card-boost-score">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[var(--yo-chip-bg)] flex items-center justify-center">
            <Zap className="w-5 h-5 text-[var(--yo-dark)]" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-[var(--yo-dark)]">{headline}</h3>
            <p className="text-[13px] text-[var(--yo-dark)]">{completed} von {total} abgeschlossen</p>
          </div>
        </div>
        <span className="text-[36px] font-[800] leading-none tracking-[-0.03em]" style={{ color }} data-testid="text-boost-score">
          {score}
        </span>
      </div>

      <div className="w-full h-2 bg-[var(--yo-surface)] rounded-full overflow-hidden mb-4">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${score}%`, background: color }}
          data-testid="progress-boost-score"
        />
      </div>

      <p className="text-[14px] text-[var(--yo-dark)] leading-relaxed" data-testid="text-boost-microcopy">
        {microcopy}
      </p>
    </div>
  );
}

function RecommendedSection({
  recommendations,
  onTaskClick,
  navigate,
}: {
  recommendations: BoostTask[];
  onTaskClick: (taskId: string) => void;
  navigate: (path: string) => void;
}) {
  if (recommendations.length === 0) return null;

  return (
    <div data-testid="section-recommended">
      <h3 className="text-section-title mb-3">
        Nächste Schritte
      </h3>
      <div className="flex flex-col gap-3">
        {recommendations.map((task) => {
          const Icon = TASK_ICONS[task.id] || Shield;
          const meta = RECOMMENDATION_META[task.id];
          const subtitle = meta?.subtitle ?? task.description;
          const ctaLabel = meta?.ctaLabel ?? "Ansehen";

          const handleAction = () => {
            if (meta && !meta.modal && meta.route) {
              navigate(meta.route);
            } else {
              onTaskClick(task.id);
            }
          };

          return (
            <div
              key={task.id}
              className="bg-white rounded-lg shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5"
              data-testid={`card-recommend-${task.id}`}
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: "rgba(45,212,191,0.1)" }}>
                  <Icon className="w-5 h-5 text-[var(--yo-teal)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[15px] font-semibold text-[var(--yo-dark)] leading-snug">{task.label}</p>
                    <span className="text-[12px] font-semibold text-[var(--yo-teal)] px-2 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap" style={{ backgroundColor: "rgba(45,212,191,0.1)" }} data-testid={`badge-points-${task.id}`}>
                      +{task.weight}
                    </span>
                  </div>
                  <p className="text-[13px] text-[var(--yo-dark)] leading-relaxed mt-1">{subtitle}</p>
                </div>
              </div>
              <Button
                onClick={handleAction}
                variant="default"
                className="w-full mt-4 rounded-lg text-[14px] font-semibold h-[48px]"
                data-testid={`button-recommend-${task.id}`}
              >
                {ctaLabel}
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}


function AllTasksSection({
  tasks,
  onTaskClick,
}: {
  tasks: BoostTask[];
  onTaskClick: (taskId: string) => void;
}) {
  const completedTasks = tasks.filter((t) => t.completed);
  const incompleteTasks = tasks.filter((t) => !t.completed);

  return (
    <div data-testid="section-all-tasks">
      <h3 className="text-section-title mb-3">
        Alle Schritte
      </h3>
      <div className="bg-white rounded-lg shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
        {incompleteTasks.map((task, i) => {
          const Icon = TASK_ICONS[task.id] || Shield;
          return (
            <button
              key={task.id}
              onClick={() => onTaskClick(task.id)}
              className={`w-full flex items-center gap-3 p-4 text-left hover:bg-[var(--yo-surface)] transition-colors ${
                i < incompleteTasks.length - 1 || completedTasks.length > 0 ? "border-b border-[var(--yo-divider)]" : ""
              }`}
              data-testid={`task-${task.id}`}
            >
              <div className="w-5 h-5 rounded-full border-2 border-[var(--yo-divider)] flex-shrink-0" />
              <Icon className="w-4 h-4 text-[var(--yo-dark)] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-[var(--yo-dark)]">{task.label}</p>
                <p className="text-[13px] font-[500] text-[var(--yo-dark)]">+{task.weight} Punkte</p>
              </div>
              <ArrowRight className="w-4 h-4 text-[var(--yo-dark)] flex-shrink-0" />
            </button>
          );
        })}
        {completedTasks.map((task, i) => {
          const Icon = TASK_ICONS[task.id] || Shield;
          return (
            <div
              key={task.id}
              className={`flex items-center gap-3 p-4 opacity-60 ${
                i < completedTasks.length - 1 ? "border-b border-[var(--yo-divider)]" : ""
              }`}
              data-testid={`task-done-${task.id}`}
            >
              <div className="w-5 h-5 rounded-full bg-[#EAF9DF] flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-4 h-4 text-[#78D953]" />
              </div>
              <Icon className="w-4 h-4 text-[var(--yo-dark)] flex-shrink-0" />
              <p className="text-[14px] text-[var(--yo-dark)] line-through">{task.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <div className="bg-[var(--yo-surface)] rounded-lg p-6 text-center" data-testid="boost-empty-state">
      <div className="w-12 h-12 rounded-full bg-[var(--yo-chip-bg)] flex items-center justify-center mx-auto mb-4">
        <Zap className="w-5 h-5 text-[var(--yo-dark)]" />
      </div>
      <h3 className="text-[18px] font-semibold text-[var(--yo-dark)] mb-1.5">
        Starte mit dem ersten Schritt
      </h3>
      <p className="text-[14px] font-[500] text-[var(--yo-dark)] leading-relaxed mb-5 max-w-[260px] mx-auto">
        Je vollständiger dein Profil, desto schneller kannst du auf neue Wohnungen reagieren.
      </p>
      <Button
        onClick={onStart}
        className="h-[56px] px-8 rounded-lg bg-[var(--yo-teal)] text-black text-[15px] font-bold"
        data-testid="button-start-boost"
      >
        <Zap className="w-4 h-4 mr-1.5" />
        Ersten Schritt ansehen
      </Button>
    </div>
  );
}

function HighProgressState({ remaining }: { remaining: number }) {
  return (
    <div className="bg-gradient-to-br from-[var(--yo-teal)] to-[var(--yo-teal-hover)] rounded-lg p-6 text-white" data-testid="boost-high-progress">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
          <Rocket className="w-5 h-5 text-white" />
        </div>
        <h3 className="text-[16px] font-semibold">Du bist fast fertig</h3>
      </div>
      <p className="text-[14px] text-white/80 leading-relaxed">
        Noch {remaining} {remaining === 1 ? "Schritt" : "Schritte"} und du kannst blitzschnell auf neue Wohnungen reagieren.
      </p>
    </div>
  );
}

function TaskModal({
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

  const [buddyEmail, setBuddyEmail] = useState("");
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (profileData) {
      setBuddyEmail(profileData.search_buddy_email || "");
      setChecklist(profileData.document_checklist || {});
    }
  }, [profileData]);

  const handleSave = async (data: Partial<ProfileData>, msg: string) => {
    await updateProfileData.mutateAsync(data);
    toast({ title: "Gespeichert!", description: msg });
    onClose();
  };

  const task = BOOST_TASK_MODAL_CONFIG[taskId];
  if (!task) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md rounded-t-lg sm:rounded-lg max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-[var(--yo-divider)] p-6 flex items-center justify-between rounded-t-lg">
          <h2 className="text-[20px] font-[700] text-[var(--yo-dark)] tracking-[-0.02em] uppercase">{task.title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[var(--yo-surface)] flex items-center justify-center" data-testid="button-close-modal">
            <X className="w-4 h-4 text-[var(--yo-dark)]" />
          </button>
        </div>

        <div className="p-5">
          <p className="text-[14px] text-[var(--yo-dark)] mb-5">{task.description}</p>

          {(taskId === "alerts_active" || taskId === "phone_number_added") && (
            <Button
              onClick={() => { onClose(); navigate("/settings/notifications"); }}
              className="w-full h-[56px] rounded-lg bg-[var(--yo-teal)] text-black text-[15px] font-bold"
              data-testid="button-goto-notifications"
            >
              <Bell className="w-4 h-4 mr-2" />
              Zu den Benachrichtigungen
            </Button>
          )}

          {taskId === "search_buddy_added" && (
            <div className="flex flex-col gap-3">
              <label className="text-[13px] font-medium text-[var(--yo-dark)]">E-Mail-Adresse des Suchpartners</label>
              <input
                type="email"
                value={buddyEmail}
                onChange={(e) => setBuddyEmail(e.target.value)}
                placeholder="partner@beispiel.de"
                className="w-full h-[52px] px-4 rounded-lg border-0 bg-[var(--yo-surface)] text-[15px] font-medium text-[var(--yo-dark)] placeholder:text-[var(--yo-dark)] placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[var(--yo-teal)]/15 focus:bg-white transition-all"
                data-testid="input-buddy-email"
              />
              <p className="text-[13px] font-[500] text-[var(--yo-dark)]">Dein Suchpartner erhält dieselben Benachrichtigungen wie du.</p>
              <Button
                onClick={() => handleSave({ search_buddy_email: buddyEmail }, "Suchpartner gespeichert!")}
                disabled={!buddyEmail.includes("@") || updateProfileData.isPending}
                className="w-full h-[56px] rounded-lg bg-[var(--yo-teal)] text-black text-[15px] font-bold disabled:opacity-50"
                data-testid="button-save-buddy"
              >
                {updateProfileData.isPending ? "Wird gespeichert..." : "Speichern"}
              </Button>
            </div>
          )}

          {taskId === "housing_preferences_completed" && (
            <Button
              onClick={() => { onClose(); navigate("/dashboard/searches/new"); }}
              className="w-full h-[56px] rounded-lg bg-[var(--yo-teal)] text-black text-[15px] font-bold"
              data-testid="button-goto-filters"
            >
              <Search className="w-4 h-4 mr-2" />
              Neuer Suchauftrag
            </Button>
          )}

          {taskId === "reaction_letter_ready" && (
            <Button
              onClick={() => { onClose(); navigate("/application-letter"); }}
              className="w-full h-[56px] rounded-lg bg-[var(--yo-teal)] text-black text-[15px] font-bold"
              data-testid="button-goto-letter"
            >
              <FileText className="w-4 h-4 mr-2" />
              Zum Bewerbungsschreiben
            </Button>
          )}

          {taskId === "income_documents_uploaded" && (
            <div className="flex flex-col gap-4">
              <h4 className="text-[13px] font-semibold text-[var(--yo-dark)]">Hake ab, was du bereits zusammengestellt hast</h4>
              <div className="flex flex-col gap-1">
                {INCOME_CHECKLIST.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setChecklist((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                    className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-[var(--yo-surface)] transition-colors text-left"
                    data-testid={`check-${item.id}`}
                  >
                    {checklist[item.id] ? (
                      <div className="w-5 h-5 rounded-full bg-[#EAF9DF] flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-[#78D953]" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-[var(--yo-divider)] flex-shrink-0" />
                    )}
                    <span className={`text-[14px] ${checklist[item.id] ? "text-[var(--yo-dark)] line-through" : "text-[var(--yo-dark)]"}`}>
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
              <Button
                onClick={() => handleSave({ document_checklist: checklist }, "Dokumente gespeichert!")}
                disabled={updateProfileData.isPending}
                className="w-full h-[56px] rounded-lg bg-[var(--yo-teal)] text-black text-[15px] font-bold disabled:opacity-50"
                data-testid="button-save-income-docs"
              >
                {updateProfileData.isPending ? "Wird gespeichert..." : "Speichern"}
              </Button>
            </div>
          )}

          {taskId === "id_document_uploaded" && (
            <div className="flex flex-col gap-4">
              <h4 className="text-[13px] font-semibold text-[var(--yo-dark)]">Hake ab, was du bereits zusammengestellt hast</h4>
              <div className="flex flex-col gap-1">
                {ID_CHECKLIST.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setChecklist((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                    className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-[var(--yo-surface)] transition-colors text-left"
                    data-testid={`check-${item.id}`}
                  >
                    {checklist[item.id] ? (
                      <div className="w-5 h-5 rounded-full bg-[#EAF9DF] flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-[#78D953]" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-[var(--yo-divider)] flex-shrink-0" />
                    )}
                    <span className={`text-[14px] ${checklist[item.id] ? "text-[var(--yo-dark)] line-through" : "text-[var(--yo-dark)]"}`}>
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
              <Button
                onClick={() => handleSave({ document_checklist: checklist }, "Dokumente gespeichert!")}
                disabled={updateProfileData.isPending}
                className="w-full h-[56px] rounded-lg bg-[var(--yo-teal)] text-black text-[15px] font-bold disabled:opacity-50"
                data-testid="button-save-id-docs"
              >
                {updateProfileData.isPending ? "Wird gespeichert..." : "Speichern"}
              </Button>
            </div>
          )}

          {taskId === "profile_info_completed" && (
            <Button
              onClick={() => { onClose(); navigate("/settings/notifications"); }}
              className="w-full h-[56px] rounded-lg bg-[var(--yo-teal)] text-black text-[15px] font-bold"
              data-testid="button-goto-profile-info"
            >
              <UserCircle className="w-4 h-4 mr-2" />
              Zu den Kontaktdaten
            </Button>
          )}

          {taskId === "profile_photo_added" && (
            <div className="flex flex-col gap-3">
              <p className="text-[13px] font-[500] text-[var(--yo-dark)]">
                Füge ein Profilfoto hinzu, um bei Vermietern einen persönlichen Eindruck zu hinterlassen.
              </p>
              <Button
                onClick={() => navigate("/dashboard?tab=profiel")}
                className="w-full h-[56px] rounded-lg bg-[var(--yo-teal)] text-black text-[14px] font-bold"
                data-testid="button-goto-profile-photo"
              >
                Zum Profilfoto
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const BOOST_TASK_MODAL_CONFIG: Record<string, { title: string; description: string }> = {
  alerts_active: {
    title: "Wohnungsalerts aktivieren",
    description: "Aktiviere mindestens einen Benachrichtigungskanal (E-Mail oder Push), damit du keine neuen Wohnungen verpasst.",
  },
  search_buddy_added: {
    title: "Suchpartner hinzufügen",
    description: "Füge einen Suchpartner hinzu, der ebenfalls Benachrichtigungen über deine Matches erhält.",
  },
  income_documents_uploaded: {
    title: "Einkommensdokumente vorbereiten",
    description: "Stelle deine Einkommensdokumente zusammen, damit du bereit bist zu reagieren. Hake ab, was du bereits hast.",
  },
  id_document_uploaded: {
    title: "Ausweis vorbereiten",
    description: "Sorge dafür, dass du eine Kopie deines Personalausweises und ein Passfoto bereit hast.",
  },
  reaction_letter_ready: {
    title: "Standard-Bewerbung erstellen",
    description: "Bereite ein Bewerbungsschreiben vor, damit du sofort auf neue Wohnungen reagieren kannst.",
  },
  phone_number_added: {
    title: "Telefonnummer hinzufügen",
    description: "Füge deine Telefonnummer zu deinem Profil hinzu.",
  },
  housing_preferences_completed: {
    title: "Wohnwünsche ergänzen",
    description: "Verfeinere deine Suchprofile oder füge einen weiteren Suchauftrag für bessere Matches hinzu.",
  },
  profile_info_completed: {
    title: "Profildaten ergänzen",
    description: "Stelle sicher, dass deine Kontaktdaten vollständig sind, damit Vermieter dich erreichen können.",
  },
  profile_photo_added: {
    title: "Profilfoto hinzufügen",
    description: "Ein Profilfoto macht dein Profil persönlicher und erhöht deine Chancen bei Vermietern.",
  },
};

export default function BoostPage({ navigate }: { navigate: (path: string) => void }) {
  const { data, isLoading, isError, refetch } = useBoostData();
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  if (isError) {
    return (
      <div className="flex flex-col gap-4 px-6 pt-6">
        <div className="mb-1">
          <h1 className="text-page-title">Boost</h1>
        </div>
        <div className="bg-white rounded-lg shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-8 text-center" data-testid="boost-error">
          <p className="text-[15px] text-[var(--yo-dark)] mb-4">Deine Daten konnten nicht geladen werden.</p>
          <Button
            onClick={() => refetch()}
            className="h-[56px] rounded-lg bg-[var(--yo-teal)] text-black text-[15px] font-bold px-6"
            data-testid="button-retry-boost"
          >
            Erneut versuchen
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4 px-6 pt-6">
        <div className="mb-2">
          <div className="h-8 bg-[var(--yo-surface)] rounded w-24 mb-2 animate-pulse" />
          <div className="h-4 bg-[var(--yo-surface)] rounded w-56 animate-pulse" />
        </div>
        <div className="bg-white rounded-lg shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6 animate-pulse">
          <div className="h-4 bg-[var(--yo-surface)] rounded w-32 mb-3" />
          <div className="h-10 bg-[var(--yo-surface)] rounded w-20 mb-2" />
          <div className="h-2.5 bg-[var(--yo-surface)] rounded w-full" />
        </div>
        <div className="bg-white rounded-lg shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6 animate-pulse">
          <div className="h-4 bg-[var(--yo-surface)] rounded w-48 mb-3" />
          <div className="h-12 bg-[var(--yo-surface)] rounded w-full mb-2" />
          <div className="h-12 bg-[var(--yo-surface)] rounded w-full" />
        </div>
      </div>
    );
  }

  const { boostScore, tasks, completedCount, totalCount, recommendations, speedSteps, speedDone, speedTotal } = data;
  const remaining = totalCount - completedCount;
  const isLowProgress = boostScore < 10;
  const isHighProgress = boostScore >= 80 && completedCount < totalCount;

  const pageSubtitle = completedCount === totalCount
    ? "Dein Profil ist vollständig"
    : remaining <= 3
    ? `Noch ${remaining} ${remaining === 1 ? "Schritt" : "Schritte"}, um schneller zu reagieren`
    : "Vervollständige dein Profil und erhöhe deine Chancen";

  return (
    <div className="flex flex-col gap-6 px-6 pt-6">
      <div className="mb-1">
        <h1 className="text-page-title" data-testid="heading-boost">
          Boost
        </h1>
        <p className="text-subtitle mt-1">
          {pageSubtitle}
        </p>
      </div>

      <BoostScoreCard score={boostScore} remaining={remaining} completed={completedCount} total={totalCount} />

      {isLowProgress && (
        <EmptyState onStart={() => {
          const first = recommendations[0] || tasks.find(t => !t.completed);
          if (first) setActiveTaskId(first.id);
        }} />
      )}

      {isHighProgress && <HighProgressState remaining={remaining} />}

      {recommendations.length > 0 && !isLowProgress && (
        <RecommendedSection recommendations={recommendations} onTaskClick={setActiveTaskId} navigate={navigate} />
      )}

      <ReactieklaarCard
        navigate={navigate}
        steps={speedSteps}
        done={speedDone}
        total={speedTotal}
        onStepClick={(stepId) => {
          const stepToTask: Record<string, string> = {
            search_buddy_added: "search_buddy_added",
            documents_ready: "income_documents_uploaded",
          };
          const taskId = stepToTask[stepId];
          if (taskId) setActiveTaskId(taskId);
        }}
      />

      <AllTasksSection tasks={tasks} onTaskClick={setActiveTaskId} />

      {activeTaskId && (
        <TaskModal
          taskId={activeTaskId}
          onClose={() => setActiveTaskId(null)}
          navigate={navigate}
        />
      )}
    </div>
  );
}
