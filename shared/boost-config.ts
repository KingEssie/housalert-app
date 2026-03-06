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
    label: "Inkomensdocumenten uploaden",
    description: "Voeg loonstroken, arbeidsovereenkomst of belastingaangiften toe.",
  },
  {
    id: "alerts_active",
    weight: 15,
    label: "Woningalerts activeren",
    description: "Activeer meldingen zodat je geen nieuwe woningen mist.",
  },
  {
    id: "id_document_uploaded",
    weight: 15,
    label: "Identiteitsbewijs uploaden",
    description: "Voeg een kopie van je identiteitsbewijs en pasfoto toe.",
  },
  {
    id: "reaction_letter_ready",
    weight: 15,
    label: "Standaard reactie maken",
    description: "Bereid een aanmeldingsbrief voor zodat je direct kunt reageren.",
  },
  {
    id: "phone_number_added",
    weight: 10,
    label: "Telefoonnummer toevoegen",
    description: "Voeg je telefoonnummer toe voor snellere meldingen.",
  },
  {
    id: "housing_preferences_completed",
    weight: 10,
    label: "Woonwensen aanvullen",
    description: "Verfijn je zoekprofielen voor betere matches.",
  },
  {
    id: "search_buddy_added",
    weight: 5,
    label: "Zoekbuddy toevoegen",
    description: "Laat iemand anders ook meldingen ontvangen van jouw matches.",
  },
  {
    id: "profile_info_completed",
    weight: 5,
    label: "Profielgegevens aanvullen",
    description: "Vul je naam en contactgegevens aan voor een compleet profiel.",
  },
  {
    id: "profile_photo_added",
    weight: 5,
    label: "Profielfoto toevoegen",
    description: "Voeg een profielfoto toe om een persoonlijke indruk te maken.",
  },
];

export const BOOST_MAX_SCORE = BOOST_TASKS.reduce((sum, t) => sum + t.weight, 0);
