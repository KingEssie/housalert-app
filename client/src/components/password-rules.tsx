import { validatePassword } from "@/lib/password-validation";

interface RuleRowProps {
  met: boolean;
  label: string;
}

function RuleRow({ met, label }: RuleRowProps) {
  return (
    <p className={`text-[13px] leading-snug ${met ? "text-[#16A34A]" : "text-[#E11D48]"}`}>
      {met ? "✓" : "✗"} {label}
    </p>
  );
}

interface PasswordRulesProps {
  password: string;
  className?: string;
}

export function PasswordRules({ password, className }: PasswordRulesProps) {
  if (password.length === 0) return null;
  const v = validatePassword(password);
  return (
    <div className={`flex flex-col gap-0.5 mt-2 ${className ?? ""}`} data-testid="password-rules">
      <RuleRow met={v.hasLength} label="8 karakters" />
      <RuleRow met={v.hasUppercase} label="1 hoofdletter" />
      <RuleRow met={v.hasNumber} label="1 cijfer" />
    </div>
  );
}
