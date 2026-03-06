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
} from "lucide-react";

interface Task {
  id: string;
  label: string;
  completed: boolean;
  score: number;
}

interface ProfileStrengthData {
  score: number;
  tasks: Task[];
  completedCount: number;
  totalCount: number;
}

interface ProfileData {
  search_buddy_email: string | null;
  application_template: string | null;
  document_checklist: Record<string, boolean>;
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
      <div className="bg-white rounded-[16px] shadow-[0_4px_16px_rgba(0,0,0,0.06)] p-5 animate-pulse">
        <div className="h-4 bg-[#F2F4F7] rounded w-32 mb-3" />
        <div className="h-6 bg-[#F2F4F7] rounded w-20 mb-2" />
        <div className="h-2 bg-[#F2F4F7] rounded w-full" />
      </div>
    );
  }

  const { score, tasks } = data;
  const status = getStatusLabel(score);
  const recommendation = getRecommendation(score, tasks);

  return (
    <div className="bg-white rounded-[16px] shadow-[0_4px_16px_rgba(0,0,0,0.06)] p-5" data-testid="card-profile-strength">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#EBF2FD] flex items-center justify-center">
            <Shield className="w-4 h-4 text-[#2D6CDF]" />
          </div>
          <h3 className="text-[15px] font-semibold text-[#0B1F44]">Profielsterkte</h3>
        </div>
        <span className={`text-[13px] font-medium px-2.5 py-1 rounded-full ${status.bg} ${status.color}`} data-testid="text-status-label">
          {status.label}
        </span>
      </div>

      <div className="flex items-end gap-2 mb-3">
        <span className="text-[32px] font-bold text-[#0B1F44] leading-none" data-testid="text-profile-score">{score}</span>
        <span className="text-[14px] text-[#9CA3AF] mb-1">/ 100</span>
      </div>

      <div className="w-full h-2 bg-[#F2F4F7] rounded-full overflow-hidden mb-3">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${score}%`,
            background: score >= 80 ? "#22c55e" : score >= 60 ? "#2D6CDF" : score >= 30 ? "#f59e0b" : "#9CA3AF",
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
      <div className="bg-white rounded-[16px] shadow-[0_4px_16px_rgba(0,0,0,0.06)] p-5 animate-pulse">
        <div className="h-4 bg-[#F2F4F7] rounded w-40 mb-3" />
        <div className="h-3 bg-[#F2F4F7] rounded w-24" />
      </div>
    );
  }

  const { tasks, completedCount, totalCount } = data;
  const percentage = Math.round((completedCount / totalCount) * 100);

  return (
    <div className="bg-white rounded-[16px] shadow-[0_4px_16px_rgba(0,0,0,0.06)] overflow-hidden" data-testid="card-account-completion">
      <button
        className="w-full p-5 flex items-center justify-between text-left"
        onClick={() => setExpanded(!expanded)}
        data-testid="button-toggle-tasks"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-[#2D6CDF]" />
            <h3 className="text-[15px] font-semibold text-[#0B1F44]">Rond je account af</h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-[#6B7280]">
              {completedCount}/{totalCount} taken voltooid
            </span>
            <span className="text-[13px] font-medium text-[#2D6CDF]">{percentage}%</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 relative">
            <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="#F2F4F7" strokeWidth="3" />
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                stroke="#2D6CDF"
                strokeWidth="3"
                strokeDasharray={`${(percentage / 100) * 97.4} 97.4`}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[#0B1F44]">
              {percentage}%
            </span>
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-[#9CA3AF]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[#F2F4F7] px-5 pb-3">
          {tasks.map((task) => {
            const Icon = TASK_ICONS[task.id] || Circle;
            return (
              <button
                key={task.id}
                onClick={() => !task.completed && onTaskClick(task.id)}
                className={`w-full flex items-center gap-3 py-3.5 border-b border-[#F2F4F7] last:border-0 text-left ${
                  task.completed ? "opacity-60" : "hover:bg-[#F8F9FB]"
                } transition-colors -mx-1 px-1 rounded-lg`}
                data-testid={`task-${task.id}`}
                disabled={task.completed}
              >
                {task.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-[#D1D5DB] flex-shrink-0" />
                )}
                <Icon className={`w-4 h-4 flex-shrink-0 ${task.completed ? "text-[#9CA3AF]" : "text-[#2D6CDF]"}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-[14px] font-medium ${task.completed ? "text-[#9CA3AF] line-through" : "text-[#0B1F44]"}`}>
                    {task.label}
                  </p>
                  <p className="text-[11px] text-[#9CA3AF]">+{task.score} punten</p>
                </div>
                {!task.completed && <ArrowRight className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />}
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
        className="bg-white w-full max-w-md rounded-t-[20px] sm:rounded-[20px] max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-[#F2F4F7] p-5 flex items-center justify-between rounded-t-[20px]">
          <h2 className="text-[17px] font-bold text-[#0B1F44]">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#F2F4F7] flex items-center justify-center" data-testid="button-close-modal">
            <X className="w-4 h-4 text-[#6B7280]" />
          </button>
        </div>

        <div className="p-5">
          <p className="text-[14px] text-[#6B7280] mb-5">{description}</p>

          {taskId === "alerts" && (
            <div className="flex flex-col gap-3">
              <p className="text-[13px] text-[#0B1F44] font-medium">Ga naar meldingsinstellingen om je kanalen te activeren.</p>
              <Button
                onClick={() => { onClose(); navigate("/notifications"); }}
                className="w-full h-[48px] rounded-xl bg-[#2D6CDF] hover:bg-[#2560C8] text-white text-[15px] font-semibold"
                data-testid="button-goto-notifications"
              >
                <Bell className="w-4 h-4 mr-2" />
                Naar meldingsinstellingen
              </Button>
            </div>
          )}

          {taskId === "search_buddy" && (
            <div className="flex flex-col gap-3">
              <label className="text-[13px] font-medium text-[#0B1F44]">E-mailadres zoekbuddy</label>
              <input
                type="email"
                value={buddyEmail}
                onChange={(e) => setBuddyEmail(e.target.value)}
                placeholder="buddy@voorbeeld.nl"
                className="w-full h-[48px] px-4 rounded-xl border border-[#E8EDF2] bg-white text-[14px] text-[#0B1F44] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#2D6CDF]/30 focus:border-[#2D6CDF]"
                data-testid="input-buddy-email"
              />
              <p className="text-[12px] text-[#9CA3AF]">Je buddy ontvangt dezelfde meldingen als jij.</p>
              <Button
                onClick={() => handleSave({ search_buddy_email: buddyEmail }, "Zoekbuddy opgeslagen!")}
                disabled={!buddyEmail.includes("@") || updateProfileData.isPending}
                className="w-full h-[48px] rounded-xl bg-[#2D6CDF] hover:bg-[#2560C8] text-white text-[15px] font-semibold disabled:opacity-50"
                data-testid="button-save-buddy"
              >
                {updateProfileData.isPending ? "Opslaan..." : "Opslaan"}
              </Button>
            </div>
          )}

          {taskId === "search_optimize" && (
            <div className="flex flex-col gap-3">
              <p className="text-[13px] text-[#0B1F44] font-medium">
                Voeg meer zoekprofielen toe of verfijn je huidige filters voor betere matches.
              </p>
              <Button
                onClick={() => { onClose(); navigate("/dashboard"); }}
                className="w-full h-[48px] rounded-xl bg-[#2D6CDF] hover:bg-[#2560C8] text-white text-[15px] font-semibold"
                data-testid="button-goto-filters"
              >
                <Search className="w-4 h-4 mr-2" />
                Naar zoekprofielen
              </Button>
            </div>
          )}

          {taskId === "application_template" && (
            <div className="flex flex-col gap-3">
              <label className="text-[13px] font-medium text-[#0B1F44]">Je aanmeldingsbrief</label>
              <textarea
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                placeholder={"Geachte verhuurder,\n\nIk ben op zoek naar een woning in...\n\nMet vriendelijke groet,\n[Je naam]"}
                className="w-full min-h-[200px] px-4 py-3 rounded-xl border border-[#E8EDF2] bg-white text-[14px] text-[#0B1F44] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#2D6CDF]/30 focus:border-[#2D6CDF] resize-none"
                data-testid="input-application-template"
              />
              <p className="text-[12px] text-[#9CA3AF]">Minimaal 20 tekens voor een goede brief.</p>
              <Button
                onClick={() => handleSave({ application_template: template }, "Aanmeldingsbrief opgeslagen!")}
                disabled={template.trim().length < 20 || updateProfileData.isPending}
                className="w-full h-[48px] rounded-xl bg-[#2D6CDF] hover:bg-[#2560C8] text-white text-[15px] font-semibold disabled:opacity-50"
                data-testid="button-save-template"
              >
                {updateProfileData.isPending ? "Opslaan..." : "Opslaan"}
              </Button>
            </div>
          )}

          {taskId === "documents" && (
            <div className="flex flex-col gap-4">
              {DOCUMENT_CHECKLIST.map((group) => (
                <div key={group.group}>
                  <h4 className="text-[13px] font-semibold text-[#0B1F44] mb-2">{group.group}</h4>
                  <div className="flex flex-col gap-1">
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setChecklist((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                        className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-[#F8F9FB] transition-colors text-left"
                        data-testid={`check-${item.id}`}
                      >
                        {checklist[item.id] ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-[#D1D5DB] flex-shrink-0" />
                        )}
                        <span className={`text-[14px] ${checklist[item.id] ? "text-[#9CA3AF] line-through" : "text-[#0B1F44]"}`}>
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
                className="w-full h-[48px] rounded-xl bg-[#2D6CDF] hover:bg-[#2560C8] text-white text-[15px] font-semibold disabled:opacity-50"
                data-testid="button-save-documents"
              >
                {updateProfileData.isPending ? "Opslaan..." : "Opslaan"}
              </Button>
            </div>
          )}

          {taskId === "phone" && (
            <div className="flex flex-col gap-3">
              <label className="text-[13px] font-medium text-[#0B1F44]">Telefoonnummer (internationaal)</label>
              <input
                type="tel"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="+49 170 1234567"
                className="w-full h-[48px] px-4 rounded-xl border border-[#E8EDF2] bg-white text-[14px] text-[#0B1F44] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#2D6CDF]/30 focus:border-[#2D6CDF]"
                data-testid="input-phone"
              />
              <p className="text-[12px] text-[#9CA3AF]">Gebruik internationaal formaat, bijv. +49 170 1234567</p>
              <Button
                onClick={() => { onClose(); navigate("/notifications"); }}
                className="w-full h-[48px] rounded-xl bg-[#2D6CDF] hover:bg-[#2560C8] text-white text-[15px] font-semibold"
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

export function ProfileStrengthSection({ navigate }: { navigate: (path: string) => void }) {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <ProfileStrengthCard />
      <AccountCompletionCard onTaskClick={setActiveTaskId} />
      {activeTaskId && (
        <TaskModal taskId={activeTaskId} onClose={() => setActiveTaskId(null)} navigate={navigate} />
      )}
    </div>
  );
}
