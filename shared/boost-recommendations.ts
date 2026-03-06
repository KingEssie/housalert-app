export interface RecommendationMeta {
  id: string;
  subtitle: string;
  ctaLabel: string;
  route: string;
  modal: boolean;
}

export const RECOMMENDATION_META: Record<string, RecommendationMeta> = {
  income_documents_uploaded: {
    id: "income_documents_uploaded",
    subtitle: "Verhuurders vragen bijna altijd om inkomensbewijs.",
    ctaLabel: "Documenten klaarzetten",
    route: "",
    modal: true,
  },
  alerts_active: {
    id: "alerts_active",
    subtitle: "Snelle reacties beginnen bij goede meldingen.",
    ctaLabel: "Alerts instellen",
    route: "/settings/notifications",
    modal: false,
  },
  id_document_uploaded: {
    id: "id_document_uploaded",
    subtitle: "Een geldig ID is vaak een vereiste bij aanmelding.",
    ctaLabel: "ID klaarzetten",
    route: "",
    modal: true,
  },
  reaction_letter_ready: {
    id: "reaction_letter_ready",
    subtitle: "Met een kant-en-klare brief reageer je in seconden.",
    ctaLabel: "Brief schrijven",
    route: "/application-letter",
    modal: false,
  },
  phone_number_added: {
    id: "phone_number_added",
    subtitle: "Verhuurders bellen graag even kort vooraf.",
    ctaLabel: "Nummer toevoegen",
    route: "/settings/notifications",
    modal: false,
  },
  housing_preferences_completed: {
    id: "housing_preferences_completed",
    subtitle: "Hoe specifieker je zoekt, hoe beter je matches.",
    ctaLabel: "Woonwensen invullen",
    route: "/dashboard/searches/new",
    modal: false,
  },
  search_buddy_added: {
    id: "search_buddy_added",
    subtitle: "Vier ogen zien meer dan twee.",
    ctaLabel: "Buddy toevoegen",
    route: "",
    modal: true,
  },
  profile_info_completed: {
    id: "profile_info_completed",
    subtitle: "Complete gegevens maken je profiel betrouwbaarder.",
    ctaLabel: "Profiel aanvullen",
    route: "/settings/notifications",
    modal: false,
  },
  profile_photo_added: {
    id: "profile_photo_added",
    subtitle: "Een foto maakt je aanmelding persoonlijker.",
    ctaLabel: "Foto toevoegen",
    route: "",
    modal: true,
  },
};

export function getRecommendationMeta(taskId: string): RecommendationMeta | null {
  return RECOMMENDATION_META[taskId] ?? null;
}
