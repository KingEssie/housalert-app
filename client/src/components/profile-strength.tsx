import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
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
  X,
  ArrowRight,
  Shield,
  Sparkles,
  Target,
  Eye,
  Copy,
  Plus,
  Mail,
  MessageSquare,
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
  sms: boolean;
  whatsapp: boolean;
  phone: boolean;
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
      toast({ title: "Fout", description: "Kon gegevens niet opslaan. Probeer het opnieuw.", variant: "destructive" });
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

const TASK_DESCRIPTIONS: Record<string, string> = {
  alerts: "Activeer minstens één meldingskanaal (e-mail, SMS of WhatsApp) zodat je geen nieuwe woningen mist.",
  search_buddy: "Voeg een zoekbuddy toe die ook meldingen ontvangt van jouw matches.",
  search_optimize: "Maak minstens 2 zoekprofielen of optimaliseer je filters voor betere resultaten.",
  application_template: "Bereid een aanmeldingsbrief voor zodat je direct kunt reageren op nieuwe woningen.",
  documents: "Verzamel alle benodigde documenten zodat je klaar bent om te reageren.",
  phone: "Voeg je telefoonnummer toe voor SMS- en WhatsApp-meldingen.",
};

function getStatusLabel(score: number): { label: string; color: string; bg: string } {
  if (score >= 80) return { label: "Klaar om snel te reageren", color: "text-green-700", bg: "bg-green-50" };
  if (score >= 60) return { label: "Goed voorbereid", color: "text-blue-700", bg: "bg-blue-50" };
  if (score >= 30) return { label: "Op weg", color: "text-amber-700", bg: "bg-amber-50" };
  return { label: "Net begonnen", color: "text-gray-600", bg: "bg-gray-50" };
}

function getRecommendation(score: number, tasks: Task[]): string {
  const incomplete = tasks.filter(t => !t.completed);
  if (incomplete.length === 0) return "Top! Je profiel is compleet. Je bent klaar om snel te reageren.";
  const next = incomplete[0];
  if (score < 30) return `Begin met "${next.label}" om je kansen te vergroten.`;
  if (score < 60) return `Goed bezig! Voltooi "${next.label}" om je score te verhogen.`;
  return `Bijna klaar! Rond "${next.label}" af voor een compleet profiel.`;
}

export function ProfileStrengthCard() {
  const { data, isLoading } = useProfileStrength();

  if (isLoading || !data) {
    return (
      <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6 animate-pulse">
        <div className="h-4 bg-[#F2F5F8] rounded w-32 mb-3" />
        <div className="h-6 bg-[#F2F5F8] rounded w-20 mb-2" />
        <div className="h-2 bg-[#F2F5F8] rounded w-full" />
      </div>
    );
  }

  const { score, maxScore } = data;
  const allTasks = [...data.tasks, ...data.prepTasks];
  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const status = getStatusLabel(pct);
  const recommendation = getRecommendation(pct, allTasks);

  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6" data-testid="card-profile-strength">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#EDF2FF] flex items-center justify-center">
            <Shield className="w-4 h-4 text-[#0066FF]" />
          </div>
          <h3 className="text-[15px] font-semibold text-[#1B2A4A]">Profielsterkte</h3>
        </div>
        <span className={`text-[13px] font-medium px-2.5 py-1 rounded-full ${status.bg} ${status.color}`} data-testid="text-status-label">
          {status.label}
        </span>
      </div>

      <div className="flex items-end gap-2 mb-3">
        <span className="text-[32px] font-bold text-[#1B2A4A] leading-none" data-testid="text-profile-score">{score}</span>
        <span className="text-[14px] text-[#6B7280] mb-1">/ {maxScore}</span>
      </div>

      <div className="w-full h-2 bg-[#F2F5F8] rounded-full overflow-hidden mb-3">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: pct >= 80 ? "#22c55e" : pct >= 60 ? "#0066FF" : pct >= 30 ? "#f59e0b" : "#6B7280",
          }}
          data-testid="progress-profile-strength"
        />
      </div>

      <p className="text-[13px] text-[#6B7280]" data-testid="text-recommendation">{recommendation}</p>
    </div>
  );
}

export function AccountCompletionCard({ onTaskClick }: { onTaskClick: (taskId: string) => void }) {
  const { data, isLoading } = useProfileStrength();
  const [expanded, setExpanded] = useState(false);

  if (isLoading || !data) {
    return (
      <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6 animate-pulse">
        <div className="h-4 bg-[#F2F5F8] rounded w-40 mb-3" />
        <div className="h-3 bg-[#F2F5F8] rounded w-24" />
      </div>
    );
  }

  const { tasks, completedCount, totalCount } = data;
  const percentage = Math.round((completedCount / totalCount) * 100);

  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden" data-testid="card-account-completion">
      <button
        className="w-full p-6 flex items-center justify-between text-left"
        onClick={() => setExpanded(!expanded)}
        data-testid="button-toggle-tasks"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-[#0066FF]" />
            <h3 className="text-[15px] font-semibold text-[#1B2A4A]">Rond je account af</h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-[#6B7280]">
              {completedCount}/{totalCount} taken voltooid
            </span>
            <span className="text-[13px] font-medium text-[#0066FF]">{percentage}%</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 relative">
            <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="#F2F5F8" strokeWidth="3" />
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                stroke="#0066FF"
                strokeWidth="3"
                strokeDasharray={`${(percentage / 100) * 97.4} 97.4`}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[#1B2A4A]">
              {percentage}%
            </span>
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-[#6B7280]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#6B7280]" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[#EAEFF5] px-6 pb-3">
          {tasks.map((task) => {
            const Icon = TASK_ICONS[task.id] || Circle;
            return (
              <button
                key={task.id}
                onClick={() => !task.completed && onTaskClick(task.id)}
                className={`w-full flex items-center gap-3 py-3.5 border-b border-[#F2F5F8] last:border-0 text-left ${
                  task.completed ? "opacity-60" : "hover:bg-[#F2F5F8]"
                } transition-colors -mx-1 px-1 rounded-lg`}
                data-testid={`task-${task.id}`}
                disabled={task.completed}
              >
                {task.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-[#EAEFF5] flex-shrink-0" />
                )}
                <Icon className={`w-4 h-4 flex-shrink-0 ${task.completed ? "text-[#6B7280]" : "text-[#0066FF]"}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-[14px] font-medium ${task.completed ? "text-[#6B7280] line-through" : "text-[#1B2A4A]"}`}>
                    {task.label}
                  </p>
                  <p className="text-[11px] text-[#6B7280]">+{task.score} punten</p>
                </div>
                {!task.completed && <ArrowRight className="w-4 h-4 text-[#6B7280] flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const DOCUMENT_CHECKLIST = [
  {
    group: "Voor iedereen",
    items: [
      { id: "id_copy", label: "Kopie identiteitsbewijs" },
      { id: "schufa", label: "SCHUFA-rapport" },
      { id: "income_proof", label: "Inkomensbewijs (laatste 3 maanden)" },
      { id: "rental_history", label: "Huurgeschiedenis / Mietschuldenfreiheit" },
      { id: "photo", label: "Pasfoto" },
    ],
  },
  {
    group: "In loondienst",
    items: [
      { id: "employment_contract", label: "Arbeidsovereenkomst" },
      { id: "payslips", label: "Loonstroken (laatste 3 maanden)" },
    ],
  },
  {
    group: "Voor ondernemers",
    items: [
      { id: "business_reg", label: "Gewerbeanmeldung / KvK-uittreksel" },
      { id: "tax_returns", label: "Belastingaangifte (laatste 2 jaar)" },
      { id: "bank_statements", label: "Bankafschriften (laatste 3 maanden)" },
    ],
  },
];

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
    toast({ title: "Opgeslagen!", description: msg });
    onClose();
  };

  const title = ({
    alerts: "Alerts activeren",
    search_buddy: "Zoekbuddy toevoegen",
    search_optimize: "Zoekopdracht optimaliseren",
    application_template: "Aanmeldingsbrief voorbereiden",
    documents: "Documenten verzamelen",
    phone: "Telefoonnummer toevoegen",
  } as Record<string, string>)[taskId] || "";

  const description = TASK_DESCRIPTIONS[taskId] || "";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md rounded-t-[24px] sm:rounded-[24px] max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-[#EAEFF5] p-6 flex items-center justify-between rounded-t-[24px]">
          <h2 className="text-[20px] font-[700] text-[#1B2A4A] tracking-[-0.02em]">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#F2F5F8] flex items-center justify-center" data-testid="button-close-modal">
            <X className="w-4 h-4 text-[#6B7280]" />
          </button>
        </div>

        <div className="p-5">
          <p className="text-[14px] text-[#6B7280] mb-5">{description}</p>

          {taskId === "alerts" && (
            <div className="flex flex-col gap-3">
              <p className="text-[13px] text-[#1B2A4A] font-medium">Ga naar meldingsinstellingen om je kanalen te activeren.</p>
              <Button
                onClick={() => { onClose(); navigate("/settings/notifications"); }}
                className="w-full h-[48px] rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white text-[15px] font-semibold"
                data-testid="button-goto-notifications"
              >
                <Bell className="w-4 h-4 mr-2" />
                Naar meldingsinstellingen
              </Button>
            </div>
          )}

          {taskId === "search_buddy" && (
            <div className="flex flex-col gap-3">
              <label className="text-[13px] font-medium text-[#1B2A4A]">E-mailadres zoekbuddy</label>
              <input
                type="email"
                value={buddyEmail}
                onChange={(e) => setBuddyEmail(e.target.value)}
                placeholder="buddy@voorbeeld.nl"
                className="w-full h-[52px] px-4 rounded-xl border-0 bg-[#F3F4F8] text-[15px] font-medium text-[#1B2A4A] placeholder:text-[#7A8599] placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[#0066FF]/15 focus:bg-[#FAFBFC] transition-all"
                data-testid="input-buddy-email"
              />
              <p className="text-[13px] font-[500] text-[#6B7280]">Je buddy ontvangt dezelfde meldingen als jij.</p>
              <Button
                onClick={() => handleSave({ search_buddy_email: buddyEmail }, "Zoekbuddy opgeslagen!")}
                disabled={!buddyEmail.includes("@") || updateProfileData.isPending}
                className="w-full h-[48px] rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white text-[15px] font-semibold disabled:opacity-50"
                data-testid="button-save-buddy"
              >
                {updateProfileData.isPending ? "Opslaan..." : "Opslaan"}
              </Button>
            </div>
          )}

          {taskId === "search_optimize" && (
            <div className="flex flex-col gap-3">
              <p className="text-[13px] text-[#1B2A4A] font-medium">
                Voeg meer zoekprofielen toe of verfijn je huidige filters voor betere matches.
              </p>
              <Button
                onClick={() => { onClose(); navigate("/dashboard"); }}
                className="w-full h-[48px] rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white text-[15px] font-semibold"
                data-testid="button-goto-filters"
              >
                <Search className="w-4 h-4 mr-2" />
                Naar zoekprofielen
              </Button>
            </div>
          )}

          {taskId === "application_template" && (
            <div className="flex flex-col gap-3">
              <p className="text-[13px] text-[#1B2A4A] font-medium">
                Bereid een standaard aanmeldingsbrief voor met automatische invulling van woninggegevens.
              </p>
              <Button
                onClick={() => { onClose(); navigate("/application-letter"); }}
                className="w-full h-[48px] rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white text-[15px] font-semibold"
                data-testid="button-goto-letter"
              >
                <FileText className="w-4 h-4 mr-2" />
                Naar aanmeldingsbrief
              </Button>
            </div>
          )}

          {taskId === "documents" && (
            <div className="flex flex-col gap-4">
              {DOCUMENT_CHECKLIST.map((group) => (
                <div key={group.group}>
                  <h4 className="text-[13px] font-semibold text-[#1B2A4A] mb-2">{group.group}</h4>
                  <div className="flex flex-col gap-1">
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setChecklist((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                        className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-[#F2F5F8] transition-colors text-left"
                        data-testid={`check-${item.id}`}
                      >
                        {checklist[item.id] ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-[#EAEFF5] flex-shrink-0" />
                        )}
                        <span className={`text-[14px] ${checklist[item.id] ? "text-[#6B7280] line-through" : "text-[#1B2A4A]"}`}>
                          {item.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <Button
                onClick={() => handleSave({ document_checklist: checklist }, "Documentenlijst opgeslagen!")}
                disabled={updateProfileData.isPending}
                className="w-full h-[48px] rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white text-[15px] font-semibold disabled:opacity-50"
                data-testid="button-save-documents"
              >
                {updateProfileData.isPending ? "Opslaan..." : "Opslaan"}
              </Button>
            </div>
          )}

          {taskId === "phone" && (
            <div className="flex flex-col gap-3">
              <label className="text-[13px] font-medium text-[#1B2A4A]">Telefoonnummer (internationaal)</label>
              <input
                type="tel"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="+49 170 1234567"
                className="w-full h-[52px] px-4 rounded-xl border-0 bg-[#F3F4F8] text-[15px] font-medium text-[#1B2A4A] placeholder:text-[#7A8599] placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[#0066FF]/15 focus:bg-[#FAFBFC] transition-all"
                data-testid="input-phone"
              />
              <p className="text-[13px] font-[500] text-[#6B7280]">Gebruik internationaal formaat, bijv. +49 170 1234567</p>
              <Button
                onClick={() => { onClose(); navigate("/settings/notifications"); }}
                className="w-full h-[48px] rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white text-[15px] font-semibold"
                data-testid="button-goto-phone-settings"
              >
                <Phone className="w-4 h-4 mr-2" />
                Naar meldingsinstellingen
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const PREP_TASK_ICONS: Record<string, typeof Bell> = {
  prep_letter: FileText,
  prep_extra_profile: Search,
  prep_network: Users,
  prep_viewing_tips: Eye,
};

const SHARE_TEXT = `Hey! Ik ben op zoek naar een huurwoning in Duitsland en gebruik Stekkies — een slimme zoektool die automatisch nieuwe woningen vindt. Als jij ook iets ziet, stuur het door! Samen vinden we sneller iets. Kijk op stekkies.replit.app`;

function SearchPreparationCard({ onTaskClick }: { onTaskClick: (taskId: string) => void }) {
  const { data, isLoading } = useProfileStrength();
  const [expanded, setExpanded] = useState(false);

  if (isLoading || !data) {
    return (
      <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6 animate-pulse">
        <div className="h-4 bg-[#F2F5F8] rounded w-40 mb-3" />
        <div className="h-3 bg-[#F2F5F8] rounded w-24" />
      </div>
    );
  }

  const { prepTasks, prepCompletedCount, prepTotalCount } = data;
  const percentage = prepTotalCount > 0 ? Math.round((prepCompletedCount / prepTotalCount) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden" data-testid="card-search-preparation">
      <button
        className="w-full p-6 flex items-center justify-between text-left"
        onClick={() => setExpanded(!expanded)}
        data-testid="button-toggle-prep-tasks"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-[#0066FF]" />
            <h3 className="text-[15px] font-semibold text-[#1B2A4A]">Bereid je zoekopdracht voor</h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-[#6B7280]">
              {prepCompletedCount}/{prepTotalCount} taken voltooid
            </span>
            <span className="text-[13px] font-medium text-[#0066FF]">{percentage}%</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 relative">
            <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="#F2F5F8" strokeWidth="3" />
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                stroke="#0066FF"
                strokeWidth="3"
                strokeDasharray={`${(percentage / 100) * 97.4} 97.4`}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[#1B2A4A]">
              {percentage}%
            </span>
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-[#6B7280]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#6B7280]" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[#EAEFF5] px-6 pb-3">
          {prepTasks.map((task) => {
            const Icon = PREP_TASK_ICONS[task.id] || Circle;
            return (
              <button
                key={task.id}
                onClick={() => !task.completed && onTaskClick(task.id)}
                className={`w-full flex items-center gap-3 py-3.5 border-b border-[#F2F5F8] last:border-0 text-left ${
                  task.completed ? "opacity-60" : "hover:bg-[#F2F5F8]"
                } transition-colors -mx-1 px-1 rounded-lg`}
                data-testid={`task-${task.id}`}
                disabled={task.completed}
              >
                {task.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-[#EAEFF5] flex-shrink-0" />
                )}
                <Icon className={`w-4 h-4 flex-shrink-0 ${task.completed ? "text-[#6B7280]" : "text-[#0066FF]"}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-[14px] font-medium ${task.completed ? "text-[#6B7280] line-through" : "text-[#1B2A4A]"}`}>
                    {task.label}
                  </p>
                  <p className="text-[11px] text-[#6B7280]">+{task.score} punten</p>
                </div>
                {!task.completed && <ArrowRight className="w-4 h-4 text-[#6B7280] flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PrepTaskModal({
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

  const titles: Record<string, string> = {
    prep_letter: "Schrijf een introductiebrief",
    prep_extra_profile: "Voeg extra zoekopdracht toe",
    prep_network: "Gebruik je netwerk",
    prep_viewing_tips: "Lees bezichtigingtips",
  };

  const handleMarkDone = async (field: string) => {
    await updateProfileData.mutateAsync({ [field]: true } as any);
    queryClient.invalidateQueries({ queryKey: ["/api/profile-strength"] });
    toast({ title: "Afgerond!", description: "Taak als voltooid gemarkeerd." });
    onClose();
  };

  const handleCopyShare = async () => {
    try {
      await navigator.clipboard.writeText(SHARE_TEXT);
      toast({ title: "Gekopieerd!", description: "Deeltekst naar klembord gekopieerd." });
    } catch {
      toast({ title: "Fout", description: "Kon niet kopiëren.", variant: "destructive" });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md rounded-t-[24px] sm:rounded-[24px] max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-[#EAEFF5] p-6 flex items-center justify-between rounded-t-[24px]">
          <h2 className="text-[20px] font-[700] text-[#1B2A4A] tracking-[-0.02em]">{titles[taskId] || ""}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#F2F5F8] flex items-center justify-center" data-testid="button-close-prep-modal">
            <X className="w-4 h-4 text-[#6B7280]" />
          </button>
        </div>

        <div className="p-5">
          {taskId === "prep_letter" && (
            <div className="flex flex-col gap-3">
              <p className="text-[14px] text-[#6B7280]">
                Een goede introductiebrief laat verhuurders zien dat je serieus bent. Bereid er nu een voor zodat je direct kunt reageren.
              </p>
              <Button
                onClick={() => { onClose(); navigate("/application-letter"); }}
                className="w-full h-[48px] rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white text-[15px] font-semibold"
                data-testid="button-prep-goto-letter"
              >
                <FileText className="w-4 h-4 mr-2" />
                Naar aanmeldingsbrief
              </Button>
            </div>
          )}

          {taskId === "prep_extra_profile" && (
            <div className="flex flex-col gap-4">
              <p className="text-[14px] text-[#6B7280]">
                Met meerdere zoekprofielen vergroot je je kansen aanzienlijk. Zoek je in meerdere steden of met verschillende budgetten? Voeg een extra profiel toe.
              </p>
              <div className="bg-[#F3F4F8] rounded-xl p-4">
                <p className="text-[13px] font-semibold text-[#1B2A4A] mb-2">Waarom meerdere profielen?</p>
                <ul className="text-[13px] text-[#6B7280] space-y-1.5">
                  <li className="flex items-start gap-2"><span className="text-[#0066FF] mt-0.5">+</span>Meer woningen die matchen</li>
                  <li className="flex items-start gap-2"><span className="text-[#0066FF] mt-0.5">+</span>Verschillende prijsklassen dekken</li>
                  <li className="flex items-start gap-2"><span className="text-[#0066FF] mt-0.5">+</span>Meerdere steden of wijken volgen</li>
                </ul>
              </div>
              <Button
                onClick={() => { onClose(); navigate("/dashboard/searches/new"); }}
                className="w-full h-[48px] rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white text-[15px] font-semibold"
                data-testid="button-prep-add-profile"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nieuw zoekprofiel toevoegen
              </Button>
            </div>
          )}

          {taskId === "prep_network" && (
            <div className="flex flex-col gap-4">
              <p className="text-[14px] text-[#6B7280]">
                Deel je zoektocht met vrienden, familie en collega's. Hoe meer ogen, hoe sneller je iets vindt.
              </p>
              <div className="bg-[#F3F4F8] rounded-xl p-4">
                <p className="text-[13px] font-semibold text-[#1B2A4A] mb-2">Deeltekst</p>
                <p className="text-[13px] text-[#6B7280] leading-relaxed">{SHARE_TEXT}</p>
              </div>
              <Button
                variant="outline"
                onClick={handleCopyShare}
                className="w-full h-[44px] rounded-xl text-[14px] font-medium border-[#EAEFF5] text-[#1B2A4A]"
                data-testid="button-copy-share"
              >
                <Copy className="w-4 h-4 mr-2" />
                Kopieer deeltekst
              </Button>
              <Button
                onClick={() => handleMarkDone("network_task_done")}
                disabled={updateProfileData.isPending}
                className="w-full h-[48px] rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white text-[15px] font-semibold disabled:opacity-50"
                data-testid="button-mark-network-done"
              >
                {updateProfileData.isPending ? "Opslaan..." : "Markeer als voltooid"}
              </Button>
            </div>
          )}

          {taskId === "prep_viewing_tips" && (
            <div className="flex flex-col gap-3">
              <p className="text-[14px] text-[#6B7280]">
                Goed voorbereid naar een bezichtiging gaan vergroot je kans op de woning. Lees onze uitgebreide tips.
              </p>
              <Button
                onClick={() => { onClose(); navigate("/tips/bezichtiging"); }}
                className="w-full h-[48px] rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white text-[15px] font-semibold"
                data-testid="button-goto-viewing-tips"
              >
                <Eye className="w-4 h-4 mr-2" />
                Naar bezichtigingtips
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function NotificationSummaryCard({ navigate }: { navigate: (path: string) => void }) {
  const { data, isLoading } = useProfileStrength();

  if (isLoading || !data) {
    return (
      <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5 animate-pulse">
        <div className="h-4 bg-[#F2F5F8] rounded w-40 mb-3" />
        <div className="h-3 bg-[#F2F5F8] rounded w-32" />
      </div>
    );
  }

  const { channels, recommendedChannel } = data;

  const channelList = [
    { key: "email", label: "E-mail", enabled: channels.email, Icon: Mail },
    { key: "sms", label: "SMS", enabled: channels.sms, Icon: MessageSquare },
    { key: "whatsapp", label: "WhatsApp", enabled: channels.whatsapp, Icon: Phone },
  ];

  const activeCount = channelList.filter(c => c.enabled).length;

  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5" data-testid="card-notification-summary">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#EDF2FF] flex items-center justify-center">
            <Bell className="w-4 h-4 text-[#0066FF]" />
          </div>
          <h3 className="text-[15px] font-semibold text-[#1B2A4A]">Meldingskanalen</h3>
        </div>
        <span className={`text-[12px] font-medium px-2.5 py-1 rounded-full ${activeCount > 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-500"}`}>
          {activeCount > 0 ? `${activeCount} actief` : "Geen actief"}
        </span>
      </div>

      <div className="flex flex-col gap-2.5 mb-4">
        {channelList.map(({ key, label, enabled, Icon }) => (
          <div key={key} className="flex items-center gap-3" data-testid={`channel-status-${key}`}>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${enabled ? "bg-green-50" : "bg-[#F3F4F8]"}`}>
              <Icon className={`w-3.5 h-3.5 ${enabled ? "text-green-600" : "text-[#6B7280]"}`} />
            </div>
            <span className={`text-[14px] flex-1 ${enabled ? "text-[#1B2A4A] font-medium" : "text-[#6B7280]"}`}>
              {label}
            </span>
            {enabled ? (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            ) : (
              <div className="w-4 h-4 rounded-full border-2 border-[#E2E6ED]" />
            )}
          </div>
        ))}
      </div>

      {recommendedChannel && (
        <div className="bg-[#EDF2FF] rounded-xl px-3.5 py-2.5 mb-3">
          <p className="text-[12px] text-[#0066FF] font-medium flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" />
            Snelste kanaal: {recommendedChannel}
          </p>
        </div>
      )}

      <button
        onClick={() => navigate("/settings/notifications")}
        className="w-full h-[40px] rounded-xl border border-[#EAEFF5] bg-white text-[13px] font-semibold text-[#1B2A4A] hover:bg-[#F3F4F8] transition-colors flex items-center justify-center gap-1.5"
        data-testid="button-manage-channels"
      >
        <Bell className="w-3.5 h-3.5" />
        Kanalen beheren
      </button>
    </div>
  );
}

export function SpeedReadinessCard({ navigate }: { navigate: (path: string) => void }) {
  const { data, isLoading } = useProfileStrength();

  if (isLoading || !data) {
    return (
      <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5 animate-pulse">
        <div className="h-4 bg-[#F2F5F8] rounded w-40 mb-3" />
        <div className="h-3 bg-[#F2F5F8] rounded w-24" />
      </div>
    );
  }

  const { speedSteps, speedDone, speedTotal } = data;
  const allDone = speedDone === speedTotal;
  const remaining = speedTotal - speedDone;

  const stepActions: Record<string, string> = {
    alerts_active: "/settings/notifications",
    letter_ready: "/application-letter",
    documents_ready: "",
    phone_added: "/settings/notifications",
  };

  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5" data-testid="card-speed-readiness">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-full bg-[#EDF2FF] flex items-center justify-center">
          <Zap className="w-4 h-4 text-[#0066FF]" />
        </div>
        <div className="flex-1">
          <h3 className="text-[15px] font-semibold text-[#1B2A4A]">Reactiesnelheid</h3>
        </div>
        <span className={`text-[12px] font-medium px-2.5 py-1 rounded-full ${allDone ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
          {speedDone}/{speedTotal}
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        {speedSteps.map((step) => {
          const route = stepActions[step.id];
          return (
            <div
              key={step.id}
              className={`flex items-center gap-3 ${!step.done && route ? "cursor-pointer hover:bg-[#F3F4F8] -mx-2 px-2 py-1 rounded-lg transition-colors" : "py-0.5"}`}
              onClick={() => {
                if (!step.done && route) navigate(route);
              }}
              data-testid={`speed-step-${step.id}`}
            >
              {step.done ? (
                <CheckCircle2 className="w-4.5 h-4.5 text-green-500 flex-shrink-0" />
              ) : (
                <div className="w-4.5 h-4.5 rounded-full border-2 border-[#E2E6ED] flex-shrink-0" />
              )}
              <span className={`text-[14px] flex-1 ${step.done ? "text-[#6B7280]" : "text-[#1B2A4A] font-medium"}`}>
                {step.label}
              </span>
              {!step.done && route && (
                <ArrowRight className="w-3.5 h-3.5 text-[#6B7280]" />
              )}
            </div>
          );
        })}
      </div>

      {allDone && (
        <div className="mt-4 bg-green-50 rounded-xl px-3.5 py-2.5">
          <p className="text-[12px] text-green-700 font-medium flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" />
            Je bent klaar om snel te reageren
          </p>
        </div>
      )}
    </div>
  );
}

export function SpeedBanner({ navigate }: { navigate: (path: string) => void }) {
  const { data, isLoading } = useProfileStrength();

  if (isLoading || !data) return null;

  const { speedDone, speedTotal, score, maxScore } = data;
  const allDone = speedDone === speedTotal;
  const remaining = speedTotal - speedDone;
  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  if (allDone) {
    return (
      <div
        className="bg-green-50 rounded-2xl p-4 flex items-center gap-3 cursor-pointer hover:bg-green-100/60 transition-colors"
        onClick={() => navigate("/dashboard")}
        data-testid="banner-speed-ready"
      >
        <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
          <Zap className="w-4 h-4 text-green-600" />
        </div>
        <div className="flex-1">
          <p className="text-[14px] font-semibold text-green-800">Je bent klaar om snel te reageren</p>
          <p className="text-[12px] text-green-600">Alle stappen voltooid</p>
        </div>
        <span className="text-[13px] font-bold text-green-700">{pct}%</span>
      </div>
    );
  }

  return (
    <div
      className="bg-amber-50 rounded-2xl p-4 flex items-center gap-3 cursor-pointer hover:bg-amber-100/60 transition-colors"
      onClick={() => navigate("/dashboard")}
      data-testid="banner-speed-incomplete"
    >
      <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
        <Zap className="w-4 h-4 text-amber-600" />
      </div>
      <div className="flex-1">
        <p className="text-[14px] font-semibold text-amber-800">
          Nog {remaining} {remaining === 1 ? "stap" : "stappen"} om sneller te reageren
        </p>
        <p className="text-[12px] text-amber-600">Maak je profiel compleet</p>
      </div>
      <ArrowRight className="w-4 h-4 text-amber-500 flex-shrink-0" />
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
