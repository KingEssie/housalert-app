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
import { useTranslation } from "@/i18n";

interface BoostTask {
  id: string;
  weight: number;
  label?: string;
  description?: string;
  completed: boolean;
}

interface BoostData {
  boostScore: number;
  tasks: BoostTask[];
  completedCount: number;
  totalCount: number;
  recommendations: BoostTask[];
  speedSteps: { id: string; label?: string; done: boolean }[];
  speedDone: number;
  speedTotal: number;
}

function getBoostTaskLabel(taskId: string, t: (key: string) => string): string {
  const map: Record<string, string> = {
    income_documents_uploaded: t("boostTask.incomeDocuments"),
    alerts_active: t("boostTask.alerts"),
    id_document_uploaded: t("boostTask.idDocument"),
    reaction_letter_ready: t("boostTask.reactionLetter"),
    phone_number_added: t("boostTask.phone"),
    housing_preferences_completed: t("boostTask.housingPreferences"),
    search_buddy_added: t("boostTask.searchBuddy"),
    profile_info_completed: t("boostTask.profileInfo"),
    profile_photo_added: t("boostTask.profilePhoto"),
  };
  return map[taskId] || taskId;
}

function getBoostTaskDescription(taskId: string, t: (key: string) => string): string {
  const map: Record<string, string> = {
    income_documents_uploaded: t("boostDesc.incomeDocuments"),
    alerts_active: t("boostDesc.alerts"),
    id_document_uploaded: t("boostDesc.idDocument"),
    reaction_letter_ready: t("boostDesc.reactionLetter"),
    phone_number_added: t("boostDesc.phone"),
    housing_preferences_completed: t("boostDesc.housingPreferences"),
    search_buddy_added: t("boostDesc.searchBuddy"),
    profile_info_completed: t("boostDesc.profileInfo"),
    profile_photo_added: t("boostDesc.profilePhoto"),
  };
  return map[taskId] || "";
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

const INCOME_CHECKLIST_IDS = ["income_proof", "employment_contract", "payslips", "tax_returns", "bank_statements"];
const ID_CHECKLIST_IDS = ["id_copy", "photo"];

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
  const { t } = useTranslation();
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
      toast({ title: t("boost.errorTitle"), description: t("boost.errorMessage"), variant: "destructive" });
    },
  });
}

function getScoreColor(score: number): string {
  if (score >= 30) return "#0D6EFD";
  return "#6B7280";
}

function BoostScoreCard({ score, remaining, completed, total }: { score: number; remaining: number; completed: number; total: number }) {
  const { t } = useTranslation();
  const color = getScoreColor(score);

  const stepsWord = remaining === 1 ? t("boost.step") : t("boost.steps");
  let microcopy: string;
  if (remaining <= 0 || score >= 90) microcopy = t("boostScore.readyMicrocopy");
  else if (score >= 70) microcopy = t("boostScore.almostMicrocopy", { count: String(remaining), steps: stepsWord });
  else if (score >= 40) microcopy = t("boostScore.goodMicrocopy", { count: String(remaining), steps: stepsWord });
  else if (score >= 10) microcopy = t("boostScore.startMicrocopy");
  else microcopy = t("boostScore.beginMicrocopy");

  let headline: string;
  if (score >= 90) headline = t("boostScore.readyHeadline");
  else if (score >= 70) headline = t("boostScore.almostHeadline");
  else if (score >= 40) headline = t("boostScore.goodHeadline");
  else if (score >= 10) headline = t("boostScore.startedHeadline");
  else headline = t("boostScore.readyToStart");

  return (
    <div className="bg-white rounded-[24px] border border-[#F0F0F0] shadow-[0_2px_8px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)] p-6" data-testid="card-boost-score">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Zap className="w-5 h-5 text-[#71717A]" />
          <div>
            <h3 className="text-[15px] font-medium text-[#18181B]">{headline}</h3>
            <p className="text-[13px] text-[#1F2937]">{t("boostScore.progress", { completed: String(completed), total: String(total) })}</p>
          </div>
        </div>
        <span className="text-[36px] font-medium leading-none tracking-[-0.03em]" style={{ color }} data-testid="text-boost-score">
          {score}
        </span>
      </div>

      <div className="w-full h-2 bg-[#F5F7FA] rounded-full overflow-hidden mb-4">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${score}%`, background: color }}
          data-testid="progress-boost-score"
        />
      </div>

      <p className="text-[14px] text-[#1F2937] leading-relaxed" data-testid="text-boost-microcopy">
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
  const { t } = useTranslation();
  if (recommendations.length === 0) return null;

  return (
    <div data-testid="section-recommended">
      <h3 className="text-section-title mb-3">
        {t("boost.nextSteps")}
      </h3>
      <div className="flex flex-col gap-3">
        {recommendations.map((task) => {
          const Icon = TASK_ICONS[task.id] || Shield;
          const meta = RECOMMENDATION_META[task.id];
          const subtitle = getBoostTaskDescription(task.id, t);
          const ctaLabel = t("boost.view");

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
              className="bg-white rounded-[24px] border border-[#F0F0F0] shadow-[0_2px_8px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)] p-5"
              data-testid={`card-recommend-${task.id}`}
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: "rgba(13,110,253,0.1)" }}>
                  <Icon className="w-5 h-5 text-[#0D6EFD]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[15px] font-medium text-[#18181B] leading-snug">{getBoostTaskLabel(task.id, t)}</p>
                    <span className="text-[12px] font-medium text-[#0D6EFD] px-2 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap" style={{ backgroundColor: "rgba(13,110,253,0.1)" }} data-testid={`badge-points-${task.id}`}>
                      +{task.weight}
                    </span>
                  </div>
                  <p className="text-[13px] text-[#1F2937] leading-relaxed mt-1">{subtitle}</p>
                </div>
              </div>
              <Button
                onClick={handleAction}
                variant="default"
                className="w-full mt-4 rounded-full text-[14px] font-medium h-[48px]"
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
  const { t } = useTranslation();
  const completedTasks = tasks.filter((t) => t.completed);
  const incompleteTasks = tasks.filter((t) => !t.completed);

  return (
    <div data-testid="section-all-tasks">
      <h3 className="text-section-title mb-3">
        {t("boost.allSteps")}
      </h3>
      <div className="bg-white rounded-[24px] border border-[#F0F0F0] shadow-[0_2px_8px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)] overflow-hidden">
        {incompleteTasks.map((task, i) => {
          const Icon = TASK_ICONS[task.id] || Shield;
          return (
            <button
              key={task.id}
              onClick={() => onTaskClick(task.id)}
              className={`w-full flex items-center gap-3 p-4 text-left hover:bg-[#F5F7FA] transition-colors ${
                i < incompleteTasks.length - 1 || completedTasks.length > 0 ? "border-b border-[#E5E7EB]" : ""
              }`}
              data-testid={`task-${task.id}`}
            >
              <div className="w-5 h-5 rounded-full border-2 border-[#E5E7EB] flex-shrink-0" />
              <Icon className="w-4 h-4 text-[#71717A] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-[#1F2937]">{getBoostTaskLabel(task.id, t)}</p>
                <p className="text-[13px] font-normal text-[#1F2937]">+{task.weight} {t("boost.points")}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-[#71717A] flex-shrink-0" />
            </button>
          );
        })}
        {completedTasks.map((task, i) => {
          const Icon = TASK_ICONS[task.id] || Shield;
          return (
            <div
              key={task.id}
              className={`flex items-center gap-3 p-4 opacity-60 ${
                i < completedTasks.length - 1 ? "border-b border-[#E5E7EB]" : ""
              }`}
              data-testid={`task-done-${task.id}`}
            >
              <div className="w-5 h-5 rounded-full bg-[#EAF9DF] flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-4 h-4 text-[#78D953]" />
              </div>
              <Icon className="w-4 h-4 text-[#71717A] flex-shrink-0" />
              <p className="text-[14px] text-[#1F2937] line-through">{getBoostTaskLabel(task.id, t)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState({ onStart }: { onStart: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="bg-[#F5F7FA] rounded-2xl p-6 text-center" data-testid="boost-empty-state">
      <div className="flex items-center justify-center mx-auto mb-4">
        <Zap className="w-6 h-6 text-[#71717A]" />
      </div>
      <h3 className="text-[18px] font-medium text-[#18181B] mb-1.5">
        {t("boost.startTitle")}
      </h3>
      <p className="text-[14px] font-normal text-[#1F2937] leading-relaxed mb-5 max-w-[260px] mx-auto">
        {t("boost.startDesc")}
      </p>
      <Button
        onClick={onStart}
        className="h-[56px] px-8 rounded-full bg-[#0D6EFD] text-white text-[15px] font-medium"
        data-testid="button-start-boost"
      >
        <Zap className="w-4 h-4 mr-1.5" />
        {t("boost.startButton")}
      </Button>
    </div>
  );
}

function HighProgressState({ remaining }: { remaining: number }) {
  const { t } = useTranslation();
  const stepsWord = remaining === 1 ? t("boost.step") : t("boost.steps");
  return (
    <div className="bg-gradient-to-br from-[#0D6EFD] to-[#0B5ED7] rounded-2xl p-6 text-white" data-testid="boost-high-progress">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
          <Rocket className="w-5 h-5 text-white" />
        </div>
        <h3 className="text-[16px] font-medium">{t("boost.almostDone")}</h3>
      </div>
      <p className="text-[14px] text-white/80 leading-relaxed">
        {t("boost.remaining", { count: String(remaining), steps: stepsWord })}
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

  const { t } = useTranslation();

  const handleSave = async (data: Partial<ProfileData>, msg: string) => {
    await updateProfileData.mutateAsync(data);
    toast({ title: t("boost.saved"), description: msg });
    onClose();
  };

  const MODAL_KEY_MAP: Record<string, { titleKey: string; descKey: string }> = {
    alerts_active: { titleKey: "boost.modalAlerts", descKey: "boost.modalAlertsDesc" },
    search_buddy_added: { titleKey: "boost.modalBuddy", descKey: "boost.modalBuddyDesc" },
    income_documents_uploaded: { titleKey: "boost.modalIncome", descKey: "boost.modalIncomeDesc" },
    id_document_uploaded: { titleKey: "boost.modalId", descKey: "boost.modalIdDesc" },
    reaction_letter_ready: { titleKey: "boost.modalLetter", descKey: "boost.modalLetterDesc" },
    phone_number_added: { titleKey: "boost.modalPhone", descKey: "boost.modalPhoneDesc" },
    housing_preferences_completed: { titleKey: "boost.modalHousing", descKey: "boost.modalHousingDesc" },
    profile_info_completed: { titleKey: "boost.modalProfile", descKey: "boost.modalProfileDesc" },
    profile_photo_added: { titleKey: "boost.modalPhoto", descKey: "boost.modalPhotoDesc" },
  };

  const modalKeys = MODAL_KEY_MAP[taskId];
  if (!modalKeys) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-[#E5E7EB] p-6 flex items-center justify-between rounded-t-lg">
          <h2 className="text-[20px] font-medium text-[#18181B] tracking-[-0.02em]">{t(modalKeys.titleKey)}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#F5F7FA] flex items-center justify-center" data-testid="button-close-modal">
            <X className="w-4 h-4 text-[#71717A]" />
          </button>
        </div>

        <div className="p-5">
          <p className="text-[14px] text-[#1F2937] mb-5">{t(modalKeys.descKey)}</p>

          {taskId === "alerts_active" && (
            <Button
              onClick={() => { onClose(); navigate("/dashboard"); }}
              className="w-full h-[56px] rounded-full bg-[#0D6EFD] text-white text-[15px] font-medium"
              data-testid="button-goto-notifications"
            >
              <Bell className="w-4 h-4 mr-2" />
              {t("boost.goToNotifications")}
            </Button>
          )}

          {taskId === "phone_number_added" && (
            <Button
              onClick={() => { onClose(); navigate("/profile/edit/phone"); }}
              className="w-full h-[56px] rounded-full bg-[#0D6EFD] text-white text-[15px] font-medium"
              data-testid="button-goto-phone"
            >
              <Phone className="w-4 h-4 mr-2" />
              {t("boost.goToPhone")}
            </Button>
          )}

          {taskId === "search_buddy_added" && (
            <div className="flex flex-col gap-3">
              <label className="text-[13px] font-medium text-[#1F2937]">{t("boost.buddyEmailLabel")}</label>
              <input
                type="email"
                value={buddyEmail}
                onChange={(e) => setBuddyEmail(e.target.value)}
                placeholder={t("boost.buddyEmailPlaceholder")}
                className="w-full h-[60px] px-4 rounded-[20px] border border-transparent bg-[#F3F4F6] text-[15px] font-medium text-[#1F2937] placeholder:text-[#9CA3AF] placeholder:font-normal focus:bg-white"
                data-testid="input-buddy-email"
              />
              <p className="text-[13px] font-normal text-[#1F2937]">{t("boost.buddyHelp")}</p>
              <Button
                onClick={() => handleSave({ search_buddy_email: buddyEmail }, t("boost.buddySaved"))}
                disabled={!buddyEmail.includes("@") || updateProfileData.isPending}
                className="w-full h-[56px] rounded-full bg-[#0D6EFD] text-white text-[15px] font-medium disabled:opacity-50"
                data-testid="button-save-buddy"
              >
                {updateProfileData.isPending ? t("boost.saving") : t("boost.save")}
              </Button>
            </div>
          )}

          {taskId === "housing_preferences_completed" && (
            <Button
              onClick={() => { onClose(); navigate("/dashboard/searches/new"); }}
              className="w-full h-[56px] rounded-full bg-[#0D6EFD] text-white text-[15px] font-medium"
              data-testid="button-goto-filters"
            >
              <Search className="w-4 h-4 mr-2" />
              {t("boost.newSearch")}
            </Button>
          )}

          {taskId === "reaction_letter_ready" && (
            <Button
              onClick={() => { onClose(); navigate("/application-letter"); }}
              className="w-full h-[56px] rounded-full bg-[#0D6EFD] text-white text-[15px] font-medium"
              data-testid="button-goto-letter"
            >
              <FileText className="w-4 h-4 mr-2" />
              {t("boost.goToLetter")}
            </Button>
          )}

          {taskId === "income_documents_uploaded" && (
            <div className="flex flex-col gap-4">
              <h4 className="text-[13px] font-medium text-[#18181B]">{t("boost.checkOffDocs")}</h4>
              <div className="flex flex-col gap-1">
                {INCOME_CHECKLIST_IDS.map((id) => (
                  <button
                    key={id}
                    onClick={() => setChecklist((prev) => ({ ...prev, [id]: !prev[id] }))}
                    className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-[#F5F7FA] transition-colors text-left"
                    data-testid={`check-${id}`}
                  >
                    {checklist[id] ? (
                      <div className="w-5 h-5 rounded-full bg-[#EAF9DF] flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-[#78D953]" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-[#E5E7EB] flex-shrink-0" />
                    )}
                    <span className={`text-[14px] ${checklist[id] ? "text-[#1F2937] line-through" : "text-[#1F2937]"}`}>
                      {t(`checklist.${id}`)}
                    </span>
                  </button>
                ))}
              </div>
              <Button
                onClick={() => handleSave({ document_checklist: checklist }, t("boost.docsSaved"))}
                disabled={updateProfileData.isPending}
                className="w-full h-[56px] rounded-full bg-[#0D6EFD] text-white text-[15px] font-medium disabled:opacity-50"
                data-testid="button-save-income-docs"
              >
                {updateProfileData.isPending ? t("boost.saving") : t("boost.save")}
              </Button>
            </div>
          )}

          {taskId === "id_document_uploaded" && (
            <div className="flex flex-col gap-4">
              <h4 className="text-[13px] font-medium text-[#18181B]">{t("boost.checkOffDocs")}</h4>
              <div className="flex flex-col gap-1">
                {ID_CHECKLIST_IDS.map((id) => (
                  <button
                    key={id}
                    onClick={() => setChecklist((prev) => ({ ...prev, [id]: !prev[id] }))}
                    className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-[#F5F7FA] transition-colors text-left"
                    data-testid={`check-${id}`}
                  >
                    {checklist[id] ? (
                      <div className="w-5 h-5 rounded-full bg-[#EAF9DF] flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-[#78D953]" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-[#E5E7EB] flex-shrink-0" />
                    )}
                    <span className={`text-[14px] ${checklist[id] ? "text-[#1F2937] line-through" : "text-[#1F2937]"}`}>
                      {t(`checklist.${id}`)}
                    </span>
                  </button>
                ))}
              </div>
              <Button
                onClick={() => handleSave({ document_checklist: checklist }, t("boost.docsSaved"))}
                disabled={updateProfileData.isPending}
                className="w-full h-[56px] rounded-full bg-[#0D6EFD] text-white text-[15px] font-medium disabled:opacity-50"
                data-testid="button-save-id-docs"
              >
                {updateProfileData.isPending ? t("boost.saving") : t("boost.save")}
              </Button>
            </div>
          )}

          {taskId === "profile_info_completed" && (
            <Button
              onClick={() => { onClose(); navigate("/dashboard"); }}
              className="w-full h-[56px] rounded-full bg-[#0D6EFD] text-white text-[15px] font-medium"
              data-testid="button-goto-profile-info"
            >
              <UserCircle className="w-4 h-4 mr-2" />
              {t("boost.goToContactInfo")}
            </Button>
          )}

          {taskId === "profile_photo_added" && (
            <div className="flex flex-col gap-3">
              <p className="text-[13px] font-normal text-[#1F2937]">
                {t("boost.profilePhotoDesc")}
              </p>
              <Button
                onClick={() => navigate("/dashboard?tab=profiel")}
                className="w-full h-[56px] rounded-full bg-[#0D6EFD] text-white text-[14px] font-medium"
                data-testid="button-goto-profile-photo"
              >
                {t("boost.goToProfilePhoto")}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


export default function BoostPage({ navigate }: { navigate: (path: string) => void }) {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useBoostData();
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  if (isError) {
    return (
      <div className="flex flex-col gap-4 px-6 pt-6">
        <div className="mb-1">
          <h1 className="text-page-title">{t("boost.title")}</h1>
        </div>
        <div className="bg-white rounded-[24px] border border-[#F0F0F0] shadow-[0_2px_8px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)] p-8 text-center" data-testid="boost-error">
          <p className="text-[15px] text-[#1F2937] mb-4">{t("boost.errorMessage")}</p>
          <Button
            onClick={() => refetch()}
            className="h-[56px] rounded-full bg-[#0D6EFD] text-white text-[15px] font-medium px-6"
            data-testid="button-retry-boost"
          >
            {t("boost.retry")}
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4 px-6 pt-6">
        <div className="mb-2">
          <div className="h-8 bg-[#F5F7FA] rounded w-24 mb-2 animate-pulse" />
          <div className="h-4 bg-[#F5F7FA] rounded w-56 animate-pulse" />
        </div>
        <div className="bg-white rounded-[24px] border border-[#F0F0F0] shadow-[0_2px_8px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)] p-6 animate-pulse">
          <div className="h-4 bg-[#F5F7FA] rounded w-32 mb-3" />
          <div className="h-10 bg-[#F5F7FA] rounded w-20 mb-2" />
          <div className="h-2.5 bg-[#F5F7FA] rounded w-full" />
        </div>
        <div className="bg-white rounded-[24px] border border-[#F0F0F0] shadow-[0_2px_8px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)] p-6 animate-pulse">
          <div className="h-4 bg-[#F5F7FA] rounded w-48 mb-3" />
          <div className="h-12 bg-[#F5F7FA] rounded w-full mb-2" />
          <div className="h-12 bg-[#F5F7FA] rounded w-full" />
        </div>
      </div>
    );
  }

  const { boostScore, tasks, completedCount, totalCount, recommendations, speedSteps, speedDone, speedTotal } = data;
  const remaining = totalCount - completedCount;
  const isLowProgress = boostScore < 10;
  const isHighProgress = boostScore >= 80 && completedCount < totalCount;

  const stepsWord = remaining === 1 ? t("boost.step") : t("boost.steps");
  const pageSubtitle = completedCount === totalCount
    ? t("boost.profileComplete")
    : remaining <= 3
    ? t("boost.fewRemaining", { count: String(remaining), steps: stepsWord })
    : t("boost.improveChances");

  return (
    <div className="flex flex-col gap-6 px-6 pt-6">
      <div className="mb-1">
        <h1 className="text-page-title" data-testid="heading-boost">
          {t("boost.title")}
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
