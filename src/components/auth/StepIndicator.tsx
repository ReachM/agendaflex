import { Check } from "lucide-react";

type Step = {
  label: string;
};

export function StepIndicator({ steps, current }: { steps: Step[]; current: number }) {
  return (
    <ol className="auth-steps" aria-label={`Passo ${current} de ${steps.length}`}>
      {steps.map((step, idx) => {
        const n = idx + 1;
        const done = n < current;
        const active = n === current;
        const status = done ? "done" : active ? "current" : "todo";
        return (
          <li key={step.label} className={`auth-step auth-step--${status}`}>
            <span className="auth-step__dot">{done ? <Check size={14} /> : n}</span>
            <span className="auth-step__label">{step.label}</span>
            {idx < steps.length - 1 ? (
              <span className={`auth-step__bar${done ? " auth-step__bar--done" : ""}`} />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
