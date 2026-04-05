import { useTranslation } from "@/i18n";
import { Globe } from "lucide-react";
import { OB } from "@/components/onboarding-ui";

const LOCALES = [
  { code: "nl" as const, label: "NL" },
  { code: "de" as const, label: "DE" },
  { code: "en" as const, label: "EN" },
];

export function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation();

  return (
    <div className="flex items-center gap-1">
      <Globe className="w-3.5 h-3.5 mr-0.5" style={{ color: OB.textMuted }} />
      {LOCALES.map((l) => (
        <button
          key={l.code}
          onClick={() => setLocale(l.code)}
          className="text-[12px] font-semibold px-1.5 py-0.5 rounded transition-colors"
          style={{
            color: locale === l.code ? OB.text : OB.textMuted,
            backgroundColor: locale === l.code ? "#F0F0F0" : "transparent",
          }}
          data-testid={`lang-${l.code}`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
