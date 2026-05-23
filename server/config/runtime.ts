import { log } from "../log";

export const runtimeConfig = {
  germanyEnabled: process.env.ENABLE_GERMANY === "true",
  irelandEnabled: process.env.ENABLE_IRELAND !== "false",
  defaultCountry: process.env.DEFAULT_COUNTRY || "IE",
  defaultCity: process.env.DEFAULT_CITY || "Dublin",
  defaultLanguage: process.env.DEFAULT_LANGUAGE || "en",
  defaultCurrency: process.env.DEFAULT_CURRENCY || "EUR",
};

export function logRuntimeConfig(): void {
  log(`[config] Market: germany=${runtimeConfig.germanyEnabled} ireland=${runtimeConfig.irelandEnabled} defaultCity=${runtimeConfig.defaultCity} country=${runtimeConfig.defaultCountry} lang=${runtimeConfig.defaultLanguage} currency=${runtimeConfig.defaultCurrency}`);
  if (!runtimeConfig.germanyEnabled) {
    log("[config] Germany/Berlin ingestion disabled (ENABLE_GERMANY != true) — fast-lane timers will not start");
  }
}
