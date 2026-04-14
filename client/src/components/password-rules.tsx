import { validatePassword } from "@/lib/password-validation";

interface PasswordRulesProps {
  password: string;
  className?: string;
}

export function PasswordRules({ password, className }: PasswordRulesProps) {
  if (password.length === 0) return null;
  const v = validatePassword(password);
  const count = [v.hasLength, v.hasUppercase, v.hasNumber].filter(Boolean).length;
  const pct = (count / 3) * 100;
  const barColor =
    count === 0 ? "#E5E7EB" :
    count === 1 ? "#F59E0B" :
    count === 2 ? "#84CC16" :
    "#16A34A";

  return (
    <div className={`mt-2.5 ${className ?? ""}`} data-testid="password-rules">
      <div className="w-full h-[4px] bg-[#F3F4F6] rounded-full overflow-hidden mb-2">
        <div
          className="h-full transition-all duration-300 rounded-full"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
      <p className="text-[12px] leading-snug text-[#6B7280]">
        Jouw wachtwoord heeft minimaal{" "}
        <span className="font-medium" style={{ color: v.hasLength ? "#16A34A" : "#E11D48" }}>8 karakters</span>
        {", "}
        <span className="font-medium" style={{ color: v.hasUppercase ? "#16A34A" : "#E11D48" }}>1 hoofdletter</span>
        {" en "}
        <span className="font-medium" style={{ color: v.hasNumber ? "#16A34A" : "#E11D48" }}>1 cijfer</span>
        {" nodig"}
      </p>
    </div>
  );
}
