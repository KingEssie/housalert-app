export const defaultCountry = "DE";

export const defaultCities = [
  { name: "Berlin", lat: 52.5200, lng: 13.4050 },
  { name: "Hamburg", lat: 53.5511, lng: 9.9937 },
  { name: "München", lat: 48.1351, lng: 11.5820 },
  { name: "Köln", lat: 50.9375, lng: 6.9603 },
  { name: "Frankfurt", lat: 50.1109, lng: 8.6821 },
  { name: "Düsseldorf", lat: 51.2277, lng: 6.7735 },
  { name: "Stuttgart", lat: 48.7758, lng: 9.1829 },
  { name: "Leipzig", lat: 51.3397, lng: 12.3731 },
  { name: "Dortmund", lat: 51.5136, lng: 7.4653 },
  { name: "Essen", lat: 51.4556, lng: 7.0116 },
  { name: "Bremen", lat: 53.0793, lng: 8.8017 },
  { name: "Dresden", lat: 51.0504, lng: 13.7373 },
  { name: "Hannover", lat: 52.3759, lng: 9.7320 },
  { name: "Nürnberg", lat: 49.4521, lng: 11.0767 },
  { name: "Duisburg", lat: 51.4344, lng: 6.7624 },
  { name: "Bochum", lat: 51.4818, lng: 7.2162 },
  { name: "Wuppertal", lat: 51.2562, lng: 7.1508 },
  { name: "Bielefeld", lat: 52.0302, lng: 8.5325 },
  { name: "Bonn", lat: 50.7374, lng: 7.0982 },
  { name: "Münster", lat: 51.9607, lng: 7.6261 },
  { name: "Mannheim", lat: 49.4875, lng: 8.4660 },
  { name: "Karlsruhe", lat: 49.0069, lng: 8.4037 },
  { name: "Augsburg", lat: 48.3705, lng: 10.8978 },
  { name: "Wiesbaden", lat: 50.0782, lng: 8.2398 },
  { name: "Freiburg", lat: 47.9990, lng: 7.8421 },
  { name: "Aachen", lat: 50.7753, lng: 6.0839 },
  { name: "Mainz", lat: 49.9929, lng: 8.2473 },
  { name: "Potsdam", lat: 52.3906, lng: 13.0645 },
  { name: "Rostock", lat: 54.0924, lng: 12.0991 },
  { name: "Heidelberg", lat: 49.3988, lng: 8.6724 },
];

export const defaultCityNames = defaultCities.map((c) => c.name);

export const cityDistricts: Record<string, string[]> = {
  Berlin: ["Mitte", "Kreuzberg", "Prenzlauer Berg", "Friedrichshain", "Neukölln", "Charlottenburg", "Schöneberg", "Wedding", "Moabit", "Tempelhof"],
  Hamburg: ["Altona", "Eimsbüttel", "Hamburg-Mitte", "Hamburg-Nord", "Wandsbek", "Bergedorf", "Harburg", "St. Pauli"],
  München: ["Schwabing", "Maxvorstadt", "Haidhausen", "Sendling", "Bogenhausen", "Lehel", "Neuhausen", "Giesing"],
  Köln: ["Innenstadt", "Ehrenfeld", "Nippes", "Lindenthal", "Deutz", "Sülz", "Mülheim", "Kalk"],
  Frankfurt: ["Innenstadt", "Sachsenhausen", "Nordend", "Bornheim", "Bockenheim", "Westend", "Ostend", "Gallus"],
  Düsseldorf: ["Altstadt", "Bilk", "Pempelfort", "Flingern", "Oberkassel", "Friedrichstadt", "Derendorf", "Unterbilk"],
  Stuttgart: ["Mitte", "West", "Süd", "Ost", "Nord", "Bad Cannstatt", "Vaihingen", "Degerloch"],
  Leipzig: ["Zentrum", "Plagwitz", "Connewitz", "Schleußig", "Südvorstadt", "Gohlis", "Lindenau", "Reudnitz"],
};

export const defaultSearchProfile = {
  city: "Berlin",
  price_max: 2000,
  bedrooms_min: 1,
  size_min: 30,
};

export const dateLocale = "de-DE";
