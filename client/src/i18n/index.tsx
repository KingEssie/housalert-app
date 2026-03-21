import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { de } from "./locales/de";
import { en } from "./locales/en";
import { nl } from "./locales/nl";

export type Locale = "de" | "en" | "nl";

type TranslationMap = Record<string, string | Record<string, any>>;

const locales: Record<Locale, TranslationMap> = { de, en, nl };

const STORAGE_KEY = "housalert_locale";

export function detectBrowserLocale(): Locale {
  const nav = navigator.language?.toLowerCase() ?? "";
  if (nav.startsWith("de")) return "de";
  if (nav.startsWith("nl")) return "nl";
  return "en";
}

export function hasExplicitLocale(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "de" || stored === "en" || stored === "nl";
  } catch {}
  return false;
}

function getStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "de" || stored === "en" || stored === "nl") return stored;
  } catch {}
  return detectBrowserLocale();
}

function resolve(obj: any, path: string): any | undefined {
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[p];
  }
  if (typeof cur === "string" || Array.isArray(cur)) return cur;
  return undefined;
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: "en",
  setLocale: () => {},
  t: (key) => key,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getStoredLocale);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch {}
  }, []);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    let value = resolve(locales[locale], key);
    if (value === undefined && locale !== "en") {
      value = resolve(locales.en, key);
    }
    if (value === undefined && locale !== "de") {
      value = resolve(locales.de, key);
    }
    if (value === undefined) return key;
    if (params && typeof value === "string") {
      for (const [k, v] of Object.entries(params)) {
        value = value.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return value;
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  return useContext(I18nContext);
}

export const useI18n = useTranslation;
