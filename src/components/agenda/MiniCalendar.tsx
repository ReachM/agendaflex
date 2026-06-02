"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { addDays, isSameDay, startOfDay } from "@/components/agenda/week-utils";

const WEEKDAYS = ["S", "T", "Q", "Q", "S", "S", "D"]; // visual: 7 letras, monday-first

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function buildMonthGrid(reference: Date): Date[] {
  const first = startOfMonth(reference);
  const firstWeekday = first.getDay(); // 0 = dom
  // Quanto recuar até a segunda-feira da semana que contém o dia 1
  const back = (firstWeekday + 6) % 7;
  const gridStart = addDays(first, -back);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

export function MiniCalendar({
  selectedDate,
  daysWithEvents,
  onSelectDate
}: {
  selectedDate: Date;
  /** Dias do mês exibido que possuem agendamentos (ISO yyyy-mm-dd). */
  daysWithEvents: Set<string>;
  onSelectDate: (date: Date) => void;
}) {
  const [reference, setReference] = useState<Date>(() => startOfDay(selectedDate));
  const today = useMemo(() => new Date(), []);
  const grid = useMemo(() => buildMonthGrid(reference), [reference]);

  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(reference);

  function prevMonth() {
    const d = new Date(reference);
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    setReference(d);
  }

  function nextMonth() {
    const d = new Date(reference);
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    setReference(d);
  }

  function isoDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  return (
    <section className="ag-panel" aria-label="Mini calendário">
      <header className="ag-panel__head">
        <h4 className="ag-panel__title" style={{ textTransform: "capitalize" }}>{monthLabel}</h4>
        <div className="ag-panel__nav">
          <button type="button" onClick={prevMonth} aria-label="Mês anterior">
            <ChevronLeft size={14} />
          </button>
          <button type="button" onClick={nextMonth} aria-label="Próximo mês">
            <ChevronRight size={14} />
          </button>
        </div>
      </header>

      <div className="ag-mini__weekdays" aria-hidden="true">
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="ag-mini__weekday">{w}</span>
        ))}
      </div>

      <div className="ag-mini__grid">
        {grid.map((day) => {
          const outOfMonth = day.getMonth() !== reference.getMonth();
          const isToday = isSameDay(day, today);
          const isSelected = isSameDay(day, selectedDate);
          const hasEvents = daysWithEvents.has(isoDate(day));
          const classes = [
            "ag-mini__cell",
            outOfMonth ? "ag-mini__cell--out" : "",
            isToday ? "ag-mini__cell--today" : "",
            isSelected ? "ag-mini__cell--selected" : "",
            hasEvents ? "ag-mini__cell--has" : ""
          ].filter(Boolean).join(" ");
          return (
            <button
              key={day.toISOString()}
              type="button"
              className={classes}
              onClick={() => onSelectDate(day)}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </section>
  );
}
