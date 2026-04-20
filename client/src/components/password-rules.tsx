import { validatePassword } from "@/lib/password-validation";
import { useTranslation } from "@/i18n";

interface PasswordRulesProps {
  password: string;
  className?: string;
}

export function PasswordRules({ password, className }: PasswordRulesProps) {
  const { t } = useTranslation();
  if (password.length === 0) return null;
  const v = validatePassword(password);
  const count = [v.hasLength, v.hasUppercase, v.hasNumber].filter(Boolean).length;
  const pct = (count / 3) * 100;
  const barColor =
    count === 0 ? "rgb(var(--ha-card-border))" :
    count === 1 ? "rgb(var(--ha-warning))" :
    count === 2 ? "rgb(var(--ha-accent-yellow))" :
    "rgb(var(--ha-success))";

  return (
    <div className={`mt-2.5 ${className ?? ""}`} data-testid="password-rules">
      <div className="w-full h-[4px] bg-ha-surface rounded-full overflow-hidden mb-2">
        <div
          className="h-full transition-all duration-300 rounded-full"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
      <p className="text-[12px] leading-snug text-ha-text-muted">
        {t("passwordRules.prefix")}{" "}
        <span className="font-medium" style={{ color: v.hasLength ? "rgb(var(--ha-success))" : "rgb(var(--ha-danger))" }}>{t("passwordRules.chars")}</span>
        {", "}
        <span className="font-medium" style={{ color: v.hasUppercase ? "rgb(var(--ha-success))" : "rgb(var(--ha-danger))" }}>{t("passwordRules.uppercase")}</span>
        {" "}{t("passwordRules.andWord")}{" "}
        <span className="font-medium" style={{ color: v.hasNumber ? "rgb(var(--ha-success))" : "rgb(var(--ha-danger))" }}>{t("passwordRules.digit")}</span>
        {t("passwordRules.suffix")}
      </p>
    </div>
  );
}
