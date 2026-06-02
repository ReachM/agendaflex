"use client";

import type { AnyRecord } from "@/components/agenda/AppointmentCard";
import { professionalColor } from "@/components/agenda/professional-colors";

export function ProfessionalChips({
  professionals,
  activeIds,
  onToggle
}: {
  professionals: AnyRecord[];
  /** Set vazio = nenhum filtro (mostrar todos). Senão, mostrar só os listados. */
  activeIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  if (professionals.length === 0) return null;
  const allOn = activeIds.size === 0;

  return (
    <div className="ag-pros" role="group" aria-label="Filtrar por profissional">
      {professionals.map((pro) => {
        const id = pro.id as string;
        const on = allOn || activeIds.has(id);
        const color = professionalColor(id);
        return (
          <button
            type="button"
            key={id}
            className={`ag-pro-chip${on ? "" : " ag-pro-chip--off"}`}
            style={{ borderColor: on ? color : undefined, color: on ? color : undefined }}
            onClick={() => onToggle(id)}
            aria-pressed={on}
          >
            <span className="ag-pro-chip__dot" style={{ background: color }} />
            <span style={{ color: "var(--text)" }}>{pro.name}</span>
          </button>
        );
      })}
    </div>
  );
}
