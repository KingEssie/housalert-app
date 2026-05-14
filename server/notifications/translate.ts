import { log } from "../log";
import { pool as pgPool } from "../pg-pool";

type SupportedLang = "nl" | "de" | "en";
const SUPPORTED_LANGS: SupportedLang[] = ["nl", "de", "en"];

const LANG_NAMES: Record<string, string> = {
  nl: "Dutch",
  de: "German",
  en: "English",
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

export async function detectMsgLanguage(text: string): Promise<SupportedLang> {
  const snippet = text.slice(0, 400);
  const result = await callOpenAI(
    `Detect the language of the following text. Reply with ONLY one of: nl, de, en\n\nText: "${snippet}"`
  );
  if (result && SUPPORTED_LANGS.includes(result.toLowerCase() as SupportedLang)) {
    return result.toLowerCase() as SupportedLang;
  }
  return "nl";
}

export async function translateText(
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
- Return ONLY the translated text, no explanation

Message:
${text}`;
  return callOpenAI(prompt);
}

export async function getUserPreferredLanguage(userId: string): Promise<SupportedLang> {
  try {
    const { rows } = await pgPool.query(
      "SELECT language FROM user_profile_data WHERE user_id = $1",
      [userId]
    );
    const lang = rows[0]?.language as string | undefined;
    if (lang && SUPPORTED_LANGS.includes(lang as SupportedLang)) {
      return lang as SupportedLang;
    }
  } catch {
  }
  return "nl";
}

export type TranslationResult = {
  original_body: string;
  original_language: string;
  translated_body_nl: string | null;
  translated_body_de: string | null;
  translated_body_en: string | null;
  translation_status: "translated" | "failed" | "not_needed";
  translated_at: string | null;
};

export async function translateAndUpdateMessage(
  messageId: number,
  text: string,
  targetLangs: SupportedLang[]
): Promise<TranslationResult> {
  const result: TranslationResult = {
    original_body: text,
    original_language: "nl",
    translated_body_nl: null,
    translated_body_de: null,
    translated_body_en: null,
    translation_status: "not_needed",
    translated_at: null,
  };

  if (hasSensitiveData(text)) {
    log(`[translate] msg ${messageId}: sensitive data detected — skipping`);
    await pgPool.query(
      `UPDATE support_ticket_messages SET original_body=$1, original_language='unknown', translation_status='not_needed' WHERE id=$2`,
      [text, messageId]
    ).catch(() => {});
    return result;
  }

  try {
    result.original_language = await detectMsgLanguage(text);
  } catch {
  }

  const toLangs = targetLangs.filter(l => l !== result.original_language);

  if (toLangs.length === 0) {
    result.translation_status = "not_needed";
    await pgPool.query(
      `UPDATE support_ticket_messages SET original_body=$1, original_language=$2, translation_status='not_needed' WHERE id=$3`,
      [text, result.original_language, messageId]
    ).catch(() => {});
    return result;
  }

  let anySuccess = false;
  await Promise.all(
    toLangs.map(async (lang) => {
      try {
        const translated = await translateText(text, result.original_language, lang);
        if (translated) {
          (result as any)[`translated_body_${lang}`] = translated;
          anySuccess = true;
        }
      } catch (err: any) {
        log(`[translate] msg ${messageId} to ${lang} failed: ${err.message}`);
      }
    })
  );

  result.translation_status = anySuccess ? "translated" : "failed";
  if (anySuccess) result.translated_at = new Date().toISOString();

  try {
    await pgPool.query(
      `UPDATE support_ticket_messages SET
        original_body=$1, original_language=$2,
        translated_body_nl=$3, translated_body_de=$4, translated_body_en=$5,
        translation_status=$6, translated_at=$7
      WHERE id=$8`,
      [
        result.original_body,
        result.original_language,
        result.translated_body_nl,
        result.translated_body_de,
        result.translated_body_en,
        result.translation_status,
        result.translated_at,
        messageId,
      ]
    );
    log(`[translate] msg ${messageId}: lang=${result.original_language} status=${result.translation_status}`);
  } catch (err: any) {
    log(`[translate] Failed to persist translation for msg ${messageId}: ${err.message}`);
  }

  return result;
}

export function applyDisplayBodies(messages: any[], viewerLang: string): any[] {
  return messages.map(msg => {
    const originalBody = msg.original_body || msg.message;
    const translatedCol = `translated_body_${viewerLang}`;
    const isTranslated =
      msg.translation_status === "translated" &&
      msg.original_language &&
      msg.original_language !== viewerLang &&
      msg[translatedCol];
    return {
      ...msg,
      display_body: isTranslated ? msg[translatedCol] : originalBody,
      original_body: originalBody,
      translated: !!isTranslated,
    };
  });
}
