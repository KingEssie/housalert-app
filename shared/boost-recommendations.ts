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
    subtitle: "Vermieter verlangen fast immer einen Einkommensnachweis.",
    ctaLabel: "Dokumente vorbereiten",
    route: "",
    modal: true,
  },
  alerts_active: {
    id: "alerts_active",
    subtitle: "Schnelle Reaktionen beginnen mit guten Benachrichtigungen.",
    ctaLabel: "Alerts einrichten",
    route: "/settings/notifications",
    modal: false,
  },
  id_document_uploaded: {
    id: "id_document_uploaded",
    subtitle: "Ein gültiger Ausweis ist oft Voraussetzung bei der Bewerbung.",
    ctaLabel: "Ausweis vorbereiten",
    route: "",
    modal: true,
  },
  reaction_letter_ready: {
    id: "reaction_letter_ready",
    subtitle: "Mit einem fertigen Anschreiben reagierst du in Sekunden.",
    ctaLabel: "Anschreiben erstellen",
    route: "/application-letter",
    modal: false,
  },
  phone_number_added: {
    id: "phone_number_added",
    subtitle: "Vermieter rufen gerne kurz vorher an.",
    ctaLabel: "Nummer hinzufügen",
    route: "/settings/notifications",
    modal: false,
  },
  housing_preferences_completed: {
    id: "housing_preferences_completed",
    subtitle: "Je genauer du suchst, desto besser deine Matches.",
    ctaLabel: "Wohnwünsche ausfüllen",
    route: "/dashboard/searches/new",
    modal: false,
  },
  search_buddy_added: {
    id: "search_buddy_added",
    subtitle: "Vier Augen sehen mehr als zwei.",
    ctaLabel: "Suchpartner hinzufügen",
    route: "",
    modal: true,
  },
  profile_info_completed: {
    id: "profile_info_completed",
    subtitle: "Vollständige Angaben machen dein Profil vertrauenswürdiger.",
    ctaLabel: "Profil ergänzen",
    route: "/settings/notifications",
    modal: false,
  },
  profile_photo_added: {
    id: "profile_photo_added",
    subtitle: "Ein Foto macht deine Bewerbung persönlicher.",
    ctaLabel: "Foto hinzufügen",
    route: "",
    modal: true,
  },
};

export function getRecommendationMeta(taskId: string): RecommendationMeta | null {
  return RECOMMENDATION_META[taskId] ?? null;
}
