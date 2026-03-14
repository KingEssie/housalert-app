export interface BoostTaskConfig {
  id: string;
  weight: number;
}

export const BOOST_TASKS: BoostTaskConfig[] = [
  { id: "income_documents_uploaded", weight: 20 },
  { id: "alerts_active", weight: 15 },
  { id: "id_document_uploaded", weight: 15 },
  { id: "reaction_letter_ready", weight: 15 },
  { id: "phone_number_added", weight: 10 },
  { id: "housing_preferences_completed", weight: 10 },
  { id: "search_buddy_added", weight: 5 },
  { id: "profile_info_completed", weight: 5 },
  { id: "profile_photo_added", weight: 5 },
];

export const BOOST_MAX_SCORE = BOOST_TASKS.reduce((sum, t) => sum + t.weight, 0);
