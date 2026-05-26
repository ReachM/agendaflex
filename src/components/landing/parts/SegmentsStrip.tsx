"use client";

import {
  Clock,
  HeartPulse,
  Scissors,
  Sparkles,
  Stethoscope,
  Users,
  Wrench,
  type LucideIcon
} from "lucide-react";

const CHIPS: { icon: LucideIcon; label: string }[] = [
  { icon: Scissors, label: "Salão" },
  { icon: HeartPulse, label: "Clínica" },
  { icon: Wrench, label: "Oficina" },
  { icon: Stethoscope, label: "Consultório" },
  { icon: Sparkles, label: "Estética" },
  { icon: Clock, label: "Barbearia" },
  { icon: Users, label: "Personal" }
];

/** Faixa horizontal "Funciona para" + chips de segmentos. */
export function SegmentsStrip() {
  return (
    <section className="lp-strip">
      <div className="lp-container lp-strip__inner">
        <span className="lp-strip__label">Funciona para</span>
        <div className="lp-strip__chips">
          {CHIPS.map(({ icon: Icon, label }) => (
            <span className="lp-chip" key={label}>
              <Icon size={15} /> {label}
            </span>
          ))}
          <span className="lp-chip lp-chip--amber">+ o seu</span>
        </div>
      </div>
    </section>
  );
}
