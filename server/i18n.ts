export type ServerLocale = "de" | "en" | "nl";

const translations: Record<ServerLocale, Record<string, string>> = {
  nl: {
    "email.settings": "Instellingen",
    "email.tagline": "Huurkansen, direct in je inbox",
    "email.footer": "Je ontvangt deze e-mail omdat je een zoekprofiel hebt ingesteld bij HousAlert.",
    "email.manageNotifs": "Meldingen aanpassen",
    "email.newMatch": "Nieuwe match",
    "email.matchFound": "Er is een woning gevonden die bij jouw zoekprofiel past.",
    "email.matchesFound": "Er {verb} {count} {noun} gevonden die {verbPast} bij jouw zoekprofiel.",
    "email.newMatches": "{count} nieuwe matches",
    "email.subject.single": "\u{1F3E0} Nieuwe match: {title}",
    "email.subject.batch": "\u{1F3E0} {count} nieuwe woningen gevonden",
    "email.preheader.batch": "{count} nieuwe matches voor jouw zoekprofiel \u2014 bekijk ze nu.",
    "email.greeting": "Hallo",
    "email.singleIntro": "We hebben een nieuwe woning gevonden die bij jouw zoekprofiel past:",
    "email.batchIntro": "We hebben {count} nieuwe woningen gevonden die bij jouw zoekprofiel passen:",
    "email.closing": "Met vriendelijke groet,\nHet HousAlert-team",
    "email.city": "Stad",
    "email.rent": "Huur",
    "email.rooms": "Kamers",
    "email.area": "Oppervlakte",
    "email.viewListing": "Bekijk",
    "email.applyDirect": "Reageer direct",
    "email.viewProperty": "Bekijk woning",
    "email.listingLabel": "Woning",
    "email.room": "kamer",
    "email.rooms_plural": "kamers",
    "email.perMonth": "/mnd",
    "push.newMatch": "Nieuwe match in {city}",
    "push.newMatches": "{count} nieuwe matches in {city}",
    "push.matchBody.single": "Er is een nieuwe woning gevonden die bij je zoekopdracht past.",
    "push.matchBody.batch": "Er zijn {count} nieuwe woningen gevonden die bij je zoekopdracht passen.",
    "push.yourCity": "je stad",
    "push.webTitle": "Nieuwe woning gevonden",
    "push.webBody.single": "Een nieuwe woning past bij jouw zoekprofiel in {city}.",
    "push.webBody.batch": "{count} nieuwe woningen passen bij jouw zoekprofiel in {city}.",
    "email.resetPassword.subject": "Wachtwoord opnieuw instellen",
    "email.resetPassword.title": "Wachtwoord opnieuw instellen",
    "email.resetPassword.intro": "Je hebt een verzoek gedaan om je wachtwoord opnieuw in te stellen. Klik op de knop hieronder om een nieuw wachtwoord te kiezen.",
    "email.resetPassword.cta": "Wachtwoord instellen",
    "email.resetPassword.fallback": "Werkt de knop niet? Gebruik deze link:",
    "email.resetPassword.ignore": "Als je dit niet hebt aangevraagd, kun je deze e-mail veilig negeren.",
    "email.resetPassword.footer": "Je ontvangt deze e-mail omdat er een wachtwoordherstel is aangevraagd voor je HousAlert-account.",
  },
  de: {
    "email.settings": "Einstellungen",
    "email.tagline": "Mietangebote, direkt in deinem Postfach",
    "email.footer": "Du erhältst diese E-Mail, weil du ein Suchprofil bei HousAlert eingerichtet hast.",
    "email.manageNotifs": "Benachrichtigungen anpassen",
    "email.newMatch": "Neuer Treffer",
    "email.matchFound": "Wir haben eine Wohnung gefunden, die zu deinem Suchprofil passt.",
    "email.matchesFound": "Es {verb} {count} {noun} gefunden, die zu deinem Suchprofil {verbPast}.",
    "email.newMatches": "{count} neue Treffer",
    "email.subject.single": "\u{1F3E0} Neuer Treffer: {title}",
    "email.subject.batch": "\u{1F3E0} {count} neue Wohnungen gefunden",
    "email.preheader.batch": "{count} neue Treffer für dein Suchprofil \u2014 jetzt ansehen.",
    "email.greeting": "Hallo",
    "email.singleIntro": "Wir haben eine neue Wohnung gefunden, die zu deinem Suchprofil passt:",
    "email.batchIntro": "Wir haben {count} neue Wohnungen gefunden, die zu deinem Suchprofil passen:",
    "email.closing": "Mit freundlichen Grüßen,\nDein HousAlert-Team",
    "email.city": "Stadt",
    "email.rent": "Miete",
    "email.rooms": "Zimmer",
    "email.area": "Fläche",
    "email.viewListing": "Ansehen",
    "email.applyDirect": "Direkt bewerben",
    "email.viewProperty": "Wohnung ansehen",
    "email.listingLabel": "Wohnung",
    "email.room": "Zimmer",
    "email.rooms_plural": "Zimmer",
    "email.perMonth": "/Monat",
    "push.newMatch": "Neuer Treffer in {city}",
    "push.newMatches": "{count} neue Treffer in {city}",
    "push.matchBody.single": "Es wurde eine neue Wohnung gefunden, die zu deinem Suchprofil passt.",
    "push.matchBody.batch": "Es wurden {count} neue Wohnungen gefunden, die zu deinem Suchprofil passen.",
    "push.yourCity": "deiner Stadt",
    "push.webTitle": "Neue Wohnung gefunden",
    "push.webBody.single": "Eine neue Wohnung passt zu deinem Suchprofil in {city}.",
    "push.webBody.batch": "{count} neue Wohnungen passen zu deinem Suchprofil in {city}.",
    "email.resetPassword.subject": "Passwort zurücksetzen",
    "email.resetPassword.title": "Passwort zurücksetzen",
    "email.resetPassword.intro": "Du hast angefordert, dein Passwort zurückzusetzen. Klicke auf die Schaltfläche unten, um ein neues Passwort zu wählen.",
    "email.resetPassword.cta": "Passwort festlegen",
    "email.resetPassword.fallback": "Funktioniert die Schaltfläche nicht? Verwende diesen Link:",
    "email.resetPassword.ignore": "Wenn du dies nicht angefordert hast, kannst du diese E-Mail ignorieren.",
    "email.resetPassword.footer": "Du erhältst diese E-Mail, weil ein Passwort-Reset für dein HousAlert-Konto angefordert wurde.",
  },
  en: {
    "email.settings": "Settings",
    "email.tagline": "Rental listings, straight to your inbox",
    "email.footer": "You're receiving this email because you have a search profile set up at HousAlert.",
    "email.manageNotifs": "Manage notifications",
    "email.newMatch": "New match",
    "email.matchFound": "We found a listing that matches your search profile.",
    "email.matchesFound": "{count} {noun} found that match your search profile.",
    "email.newMatches": "{count} new matches",
    "email.subject.single": "\u{1F3E0} New match: {title}",
    "email.subject.batch": "\u{1F3E0} {count} new listings found",
    "email.preheader.batch": "{count} new matches for your search profile \u2014 view them now.",
    "email.greeting": "Hello",
    "email.singleIntro": "We found a new listing that matches your search profile:",
    "email.batchIntro": "We found {count} new listings that match your search profile:",
    "email.closing": "Best regards,\nThe HousAlert Team",
    "email.city": "City",
    "email.rent": "Rent",
    "email.rooms": "Rooms",
    "email.area": "Area",
    "email.viewListing": "View",
    "email.applyDirect": "Apply now",
    "email.viewProperty": "View listing",
    "email.listingLabel": "Listing",
    "email.room": "room",
    "email.rooms_plural": "rooms",
    "email.perMonth": "/mo",
    "push.newMatch": "New match in {city}",
    "push.newMatches": "{count} new matches in {city}",
    "push.matchBody.single": "A new listing was found that matches your search profile.",
    "push.matchBody.batch": "{count} new listings were found that match your search profile.",
    "push.yourCity": "your city",
    "push.webTitle": "New listing found",
    "push.webBody.single": "A new listing matches your search profile in {city}.",
    "push.webBody.batch": "{count} new listings match your search profile in {city}.",
    "email.resetPassword.subject": "Reset your password",
    "email.resetPassword.title": "Reset your password",
    "email.resetPassword.intro": "You have requested to reset your password. Click the button below to choose a new password.",
    "email.resetPassword.cta": "Set password",
    "email.resetPassword.fallback": "Button not working? Use this link:",
    "email.resetPassword.ignore": "If you didn't request this, you can safely ignore this email.",
    "email.resetPassword.footer": "You're receiving this email because a password reset was requested for your HousAlert account.",
  },
};

export function t(lang: ServerLocale, key: string, params?: Record<string, string | number>): string {
  let value = translations[lang]?.[key] ?? translations.en[key] ?? translations.de[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return value;
}

export function isValidLocale(val: unknown): val is ServerLocale {
  return val === "de" || val === "en" || val === "nl";
}

export function detectLanguage(req: { headers?: Record<string, string | string[] | undefined> }, userLang?: string | null): ServerLocale {
  if (userLang && isValidLocale(userLang)) return userLang;
  const accept = req?.headers?.["accept-language"];
  if (typeof accept === "string") {
    const lower = accept.toLowerCase();
    if (lower.startsWith("nl")) return "nl";
    if (lower.startsWith("en")) return "en";
    if (lower.startsWith("de")) return "de";
    const parts = lower.split(",");
    for (const part of parts) {
      const lang = part.trim().split(";")[0].split("-")[0];
      if (lang === "nl" || lang === "en" || lang === "de") return lang as ServerLocale;
    }
  }
  return "en";
}

export function getUserLanguage(userLang?: string | null): ServerLocale {
  if (userLang && isValidLocale(userLang)) return userLang;
  return "en";
}
