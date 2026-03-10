export interface BoostTaskConfig {
  id: string;
  weight: number;
  label: string;
  description: string;
}

export const BOOST_TASKS: BoostTaskConfig[] = [
  {
    id: "income_documents_uploaded",
    weight: 20,
    label: "Einkommensdokumente vorbereiten",
    description: "Halte Gehaltsabrechnungen, Arbeitsvertrag oder Steuererklärungen bereit.",
  },
  {
    id: "alerts_active",
    weight: 15,
    label: "Wohnungsalerts aktivieren",
    description: "Aktiviere Benachrichtigungen, damit du keine neuen Wohnungen verpasst.",
  },
  {
    id: "id_document_uploaded",
    weight: 15,
    label: "Ausweis vorbereiten",
    description: "Sorge dafür, dass du eine Kopie deines Personalausweises und ein Passfoto bereit hast.",
  },
  {
    id: "reaction_letter_ready",
    weight: 15,
    label: "Standard-Bewerbung erstellen",
    description: "Bereite ein Bewerbungsschreiben vor, damit du sofort reagieren kannst.",
  },
  {
    id: "phone_number_added",
    weight: 10,
    label: "Telefonnummer hinzufügen",
    description: "Füge deine Telefonnummer für schnellere Benachrichtigungen hinzu.",
  },
  {
    id: "housing_preferences_completed",
    weight: 10,
    label: "Wohnwünsche ergänzen",
    description: "Verfeinere deine Suchprofile für bessere Matches.",
  },
  {
    id: "search_buddy_added",
    weight: 5,
    label: "Suchpartner hinzufügen",
    description: "Lass jemand anderen ebenfalls Benachrichtigungen über deine Matches erhalten.",
  },
  {
    id: "profile_info_completed",
    weight: 5,
    label: "Profildaten ergänzen",
    description: "Ergänze deinen Namen und deine Kontaktdaten für ein vollständiges Profil.",
  },
  {
    id: "profile_photo_added",
    weight: 5,
    label: "Profilfoto hinzufügen",
    description: "Füge ein Profilfoto hinzu, um einen persönlichen Eindruck zu hinterlassen.",
  },
];

export const BOOST_MAX_SCORE = BOOST_TASKS.reduce((sum, t) => sum + t.weight, 0);
