"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import type { AnyRecord } from "@/components/agenda/AppointmentCard";
import { ProfessionalChips } from "@/components/agenda/ProfessionalChips";
import { formatWeekLabel } from "@/components/agenda/week-utils";

export function WeekToolbar({
  weekStart,
  professionals,
  activeProfessionalIds,
  onPrev,
  onNext,
  onToday,
  onToggleProfessional
}: {
  weekStart: Date;
  professionals: AnyRecord[];
  activeProfessionalIds: Set<string>;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onToggleProfessional: (id: string) => void;
}) {
  const { range, year } = formatWeekLabel(weekStart);

  return (
    <div className="ag-toolbar">
      <div className="ag-toolbar__left">
        <div className="ag-nav" role="group" aria-label="Navegar semanas">
          <button type="button" onClick={onPrev} aria-label="Semana anterior">
            <ChevronLeft size={16} />
          </button>
          <button type="button" className="ag-nav__today" onClick={onToday}>
            <CalendarDays size={13} />
            Hoje
          </button>
          <button type="button" onClick={onNext} aria-label="Próxima semana">
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="ag-week-label">
          {range} <span className="ag-week-label__muted">· {year}</span>
        </div>
      </div>
      <ProfessionalChips
        professionals={professionals}
        activeIds={activeProfessionalIds}
        onToggle={onToggleProfessional}
      />
    </div>
  );
}
