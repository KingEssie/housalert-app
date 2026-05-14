import { log } from "../log";
import { pool as pgPool } from "../pg-pool";

export type SupportedLang = string;
const KNOWN_LANGS = ["nl", "de", "en", "fr", "es", "tr", "ar", "pl"];

const LANG_NAMES: Record<string, string> = {
  nl: "Dutch",
  de: "German",
  en: "English",
  fr: "French",
  es: "Spanish",
  tr: "Turkish",
  ar: "Arabic",
  pl: "Polish",
};

const SENSITIVE_PATTERNS = [
  /\b[0-9]{13,19}\b/,
  /\b[A-Za-z0-9_\-]{32,}\b/,
  /password|wachtwoord|passwort/i,
  /api[_\-. ]?key|api[_\-. ]?secret|access[_\-. ]?token/i,
];

function hasSensitiveData(text: string): boolean {
  return SENSITIVE_PATTERNS.some(p => p.test(text));
}

async function callOpenAI(prompt: string): Promise<string | null> {
  try {
    const { openai } = await import("../replit_integrations/audio/client");
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 1024,
    });
    return res.choices[0]?.message?.content?.trim() || null;
  } catch (err: any) {
    log(`[translate] OpenAI call failed: ${err.message}`);
    return null;
  }
}

export async function detectMsgLanguage(text: string): Promise<string> {
  const snippet = text.slice(0, 400);
  const options = KNOWN_LANGS.join(", ");
  const result = await callOpenAI(
    `Detect the language of the following text. Reply with ONLY a BCP-47 language code such as ${options} or another two-letter code.\n\nText: "${snippet}"`
  );
  if (result) {
    const clean = result.toLowerCase().trim().slice(0, 5);
    return clean || "unknown";
  }
  return "unknown";
}

export async function getUserPreferredLanguage(userId: string): Promise<string> {
  try {
    const { rows } = await pgPool.query(
      "SELECT language FROM user_profile_data WHERE user_id = $1",
      [userId]
    );
    const lang = rows[0]?.language as string | undefined;
    if (lang && lang.length >= 2) return lang.toLowerCase();
  } catch {
  }
  return "nl";
}

async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string | null> {
  if (sourceLang === targetLang) return text;
  const src = LANG_NAMES[sourceLang] || sourceLang;
  const tgt = LANG_NAMES[targetLang] || targetLang;
  const prompt = `Translate the following ${src} support message to ${tgt}.

Rules:
- Preserve meaning, tone (friendly and professional), and formatting
- Do not add or remove information
- Keep URLs, email addresses, prices, dates, and city names unchanged
- Keep "HousAlert" unchanged
- Return ONLY the translated text, no explanation or prefix

Message:
${text}`;
  return callOpenAI(prompt);
}

export async function detectAndStoreLanguage(messageId: number, text: string): Promise<void> {
  try {
    const lang = await detectMsgLanguage(text);
    await pgPool.query(
      `UPDATE support_ticket_messages SET original_language = $1 WHERE id = $2`,
      [lang, messageId]
    );
    log(`[translate] msg ${messageId}: detected lang=${lang}`);
  } catch (err: any) {
    log(`[translate] detectAndStoreLanguage failed for msg ${messageId}: ${err.message}`);
  }
}

export async function ensureTranslation(
  messageId: number,
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string | null> {
  if (sourceLang === targetLang) return text;
  if (hasSensitiveData(text)) {
    log(`[translate] msg ${messageId}: sensitive data — skipping translation to ${targetLang}`);
    return null;
  }

  const translated = await translateText(text, sourceLang, targetLang);
  if (!translated) return null;

  try {
    await pgPool.query(
      `UPDATE support_ticket_messages
       SET translations = COALESCE(translations, '{}') || jsonb_build_object($1::text, $2::text),
           translation_status = 'translated',
           translated_at = NOW()
       WHERE id = $3`,
      [targetLang, translated, messageId]
    );
  } catch (err: any) {
    log(`[translate] Failed to persist translation for msg ${messageId} to ${targetLang}: ${err.message}`);
  }

  return translated;
}

export async function applyDisplayBodies(
  messages: any[],
  viewerLang: string
): Promise<any[]> {
  const results = await Promise.all(
    messages.map(async (msg) => {
      const originalBody = msg.original_body || msg.message;
      const sourceLang = msg.original_language;

      if (!sourceLang || sourceLang === "unknown") {
        return { ...msg, display_body: originalBody, original_body: originalBody, translated: false };
      }

      if (sourceLang === viewerLang) {
        return { ...msg, display_body: originalBody, original_body: originalBody, translated: false };
      }

      const existingTranslations: Record<string, string> = msg.translations || {};
      if (existingTranslations[viewerLang]) {
        return {
          ...msg,
          display_body: existingTranslations[viewerLang],
          original_body: originalBody,
          translated: true,
        };
      }

      const translatedText = await ensureTranslation(msg.id, originalBody, sourceLang, viewerLang);
      if (translatedText) {
        return {
          ...msg,
          display_body: translatedText,
          original_body: originalBody,
          translated: true,
        };
      }

      return {
        ...msg,
        display_body: originalBody,
        original_body: originalBody,
        translated: false,
        translation_status: msg.translation_status === "translated" ? "translated" : "failed",
      };
    })
  );
  return results;
}
