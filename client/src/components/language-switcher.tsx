import { useTranslation } from "@/i18n";
import { Globe } from "lucide-react";

const LOCALES = [
  { code: "nl" as const, label: "NL" },
  { code: "de" as const, label: "DE" },
  { code: "en" as const, label: "EN" },
];

interface LanguageSwitcherProps {
  variant?: "light" | "dark";
}

export function LanguageSwitcher({ variant = "light" }: LanguageSwitcherProps) {
  const { locale, setLocale } = useTranslation();

  const isOnDark = variant === "dark";

  return (
    <div className="flex items-center gap-1">
      <Globe
        className="w-3.5 h-3.5 mr-0.5"
        style={{ color: isOnDark ? "rgba(255,255,255,0.6)" : "#334855" }}
      />
      {LOCALES.map((l) => (
        <button
          key={l.code}
          onClick={() => setLocale(l.code)}
          className="text-[12px] font-semibold px-1.5 py-0.5 rounded transition-colors"
          style={{
            color: isOnDark
              ? (locale === l.code ? "#FFFFFF" : "rgba(255,255,255,0.6)")
              : (locale === l.code ? "#111111" : "#334855"),
            backgroundColor: isOnDark
              ? (locale === l.code ? "rgba(255,255,255,0.15)" : "transparent")
              : (locale === l.code ? "#F0F0F0" : "transparent"),
          }}
          data-testid={`lang-${l.code}`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
