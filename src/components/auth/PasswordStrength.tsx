import { evaluatePasswordStrength } from "@/lib/registration";

const COLORS = ["#dc2626", "#dc2626", "#d97706", "#16a34a", "#15803d"];

export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const strength = evaluatePasswordStrength(password);
  const pct = (strength.score / 4) * 100;
  const color = COLORS[strength.score];
  return (
    <div className="auth-password-meter" aria-live="polite">
      <div className="auth-password-meter__bar">
        <span style={{ width: `${pct}%`, background: color }} />
      </div>
      <small style={{ color }}>{strength.label}</small>
    </div>
  );
}
