export interface RecommendationMeta {
  id: string;
  route: string;
  modal: boolean;
}

export const RECOMMENDATION_META: Record<string, RecommendationMeta> = {
  income_documents_uploaded: {
    id: "income_documents_uploaded",
    route: "",
    modal: true,
  },
  alerts_active: {
    id: "alerts_active",
    route: "/dashboard",
    modal: false,
  },
  id_document_uploaded: {
    id: "id_document_uploaded",
    route: "",
    modal: true,
  },
  reaction_letter_ready: {
    id: "reaction_letter_ready",
    route: "/application-letter",
    modal: false,
  },
  phone_number_added: {
    id: "phone_number_added",
    route: "/dashboard",
    modal: false,
  },
  housing_preferences_completed: {
    id: "housing_preferences_completed",
    route: "/dashboard/searches/new",
    modal: false,
  },
  search_buddy_added: {
    id: "search_buddy_added",
    route: "",
    modal: true,
  },
  profile_info_completed: {
    id: "profile_info_completed",
    route: "/dashboard",
    modal: false,
  },
  profile_photo_added: {
    id: "profile_photo_added",
    route: "",
    modal: true,
  },
};

export function getRecommendationMeta(taskId: string): RecommendationMeta | null {
  return RECOMMENDATION_META[taskId] ?? null;
}
