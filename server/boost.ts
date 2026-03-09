import { BOOST_TASKS, BOOST_MAX_SCORE, type BoostTaskConfig } from "../shared/boost-config";

export interface BoostTaskResult extends BoostTaskConfig {
  completed: boolean;
}

export interface BoostResult {
  boostScore: number;
  tasks: BoostTaskResult[];
  completedCount: number;
  totalCount: number;
  recommendations: BoostTaskResult[];
  speedSteps: { id: string; label: string; done: boolean }[];
  speedDone: number;
  speedTotal: number;
}

interface CompletionStates {
  alertsActive: boolean;
  searchBuddyAdded: boolean;
  incomeDocumentsUploaded: boolean;
  idDocumentUploaded: boolean;
  reactionLetterReady: boolean;
  phoneNumberAdded: boolean;
  housingPreferencesCompleted: boolean;
  profileInfoCompleted: boolean;
  profilePhotoAdded: boolean;
}

const COMPLETION_MAP: Record<string, keyof CompletionStates> = {
  alerts_active: "alertsActive",
  search_buddy_added: "searchBuddyAdded",
  income_documents_uploaded: "incomeDocumentsUploaded",
  id_document_uploaded: "idDocumentUploaded",
  reaction_letter_ready: "reactionLetterReady",
  phone_number_added: "phoneNumberAdded",
  housing_preferences_completed: "housingPreferencesCompleted",
  profile_info_completed: "profileInfoCompleted",
  profile_photo_added: "profilePhotoAdded",
};

export function calculateBoostScore(states: CompletionStates): BoostResult {
  const tasks: BoostTaskResult[] = BOOST_TASKS.map((task) => ({
    ...task,
    completed: states[COMPLETION_MAP[task.id]] ?? false,
  }));

  const earned = tasks.filter((t) => t.completed).reduce((sum, t) => sum + t.weight, 0);
  const boostScore = BOOST_MAX_SCORE > 0 ? Math.round((earned / BOOST_MAX_SCORE) * 100) : 0;
  const completedCount = tasks.filter((t) => t.completed).length;

  const recommendations = tasks
    .filter((t) => !t.completed)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3);

  const speedSteps = [
    { id: "alerts_active", label: "Alerts actief", done: states.alertsActive },
    { id: "search_buddy_added", label: "Zoekbuddy toegevoegd", done: states.searchBuddyAdded },
    { id: "documents_ready", label: "Documenten klaar", done: states.incomeDocumentsUploaded && states.idDocumentUploaded },
    { id: "phone_added", label: "Telefoonnummer toegevoegd", done: states.phoneNumberAdded },
    { id: "letter_ready", label: "Reactiebrief klaar", done: states.reactionLetterReady },
  ];

  return {
    boostScore,
    tasks,
    completedCount,
    totalCount: tasks.length,
    recommendations,
    speedSteps,
    speedDone: speedSteps.filter((s) => s.done).length,
    speedTotal: speedSteps.length,
  };
}

export function resolveCompletionStates(
  notif: { email_enabled?: boolean; phone_e164?: string | null },
  profileData: { search_buddy_email?: string | null; application_template?: string | null; document_checklist?: Record<string, boolean> | null; profile_photo_url?: string | null } | null,
  searchProfiles: { price_min: number; price_max: number; bedrooms_min: number; size_min: number }[],
  userEmail: string | null,
): CompletionStates {
  const checklist = (profileData?.document_checklist ?? {}) as Record<string, boolean>;

  const incomeIds = ["income_proof", "employment_contract", "payslips", "tax_returns", "bank_statements"];
  const incomeChecked = incomeIds.filter((id) => checklist[id]).length;

  const idIds = ["id_copy", "photo"];
  const idChecked = idIds.filter((id) => checklist[id]).length;

  const hasStrongProfile = searchProfiles.some((p) => {
    let filters = 0;
    if (p.price_min > 0 || p.price_max > 0) filters++;
    if (p.bedrooms_min > 0) filters++;
    if (p.size_min > 0) filters++;
    return filters >= 2;
  });

  return {
    alertsActive: !!(notif.email_enabled),
    searchBuddyAdded: !!(profileData?.search_buddy_email && profileData.search_buddy_email.trim().length > 0),
    incomeDocumentsUploaded: incomeChecked >= 2,
    idDocumentUploaded: idChecked >= 1,
    reactionLetterReady: !!(profileData?.application_template && profileData.application_template.trim().length > 20),
    phoneNumberAdded: !!(notif.phone_e164 && notif.phone_e164.length > 5),
    housingPreferencesCompleted: searchProfiles.length >= 2 || hasStrongProfile,
    profileInfoCompleted: !!(userEmail && notif.phone_e164 && notif.phone_e164.length > 5),
    // TODO: implement profile photo upload; for now always false
    profilePhotoAdded: !!(profileData?.profile_photo_url && profileData.profile_photo_url.length > 0),
  };
}
