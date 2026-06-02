"use client";

import { useEffect, useMemo, useState } from "react";
import type { AnyRecord } from "@/components/agenda/AppointmentCard";
import {
  addDays,
  END_HOUR,
  formatHourLabel,
  formatTime,
  getWeekDays,
  HOUR_HEIGHT,
  HOURS,
  isSameDay,
  minutesOfDay,
  rectForRange,
  START_HOUR
} from "@/components/agenda/week-utils";

const WEEKDAY_LABELS = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];

function eventsByDay(appointments: AnyRecord[], days: Date[]): AnyRecord[][] {
  return days.map((day) => {
    const next = addDays(day, 1);
    return appointments.filter((appointment) => {
      const start = new Date(appointment.startAt);
      return start >= day && start < next;
    });
  });
}

export function WeekCalendar({
  appointments,
  weekStart,
  onSelectAppointment
}: {
  appointments: AnyRecord[];
  weekStart: Date;
  onSelectAppointment: (appointment: AnyRecord) => void;
}) {
  const days = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const byDay = useMemo(() => eventsByDay(appointments, days), [appointments, days]);
  const today = useMemo(() => new Date(), []);

  // Now-line: só aparece se "agora" está em uma das colunas e dentro do range
  // visível (8h–20h). Atualiza a cada 60s.
  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNowTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const nowDate = new Date();
  // dep: nowTick triggers a re-render which re-derives nowDate
  void nowTick;
  const nowMinutes = minutesOfDay(nowDate);
  const showNowLine = nowMinutes >= START_HOUR * 60 && nowMinutes <= END_HOUR * 60 + 60;
  const nowTop = ((nowMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
  const nowDayIndex = days.findIndex((d) => isSameDay(d, nowDate));

  return (
    <div className="ag-cal" role="grid" aria-label="Calendário semanal">
      <div className="ag-cal__head">
        <div className="ag-cal__head-cell ag-cal__head-cell--gutter" aria-hidden="true" />
        {days.map((day, idx) => {
          const isToday = isSameDay(day, today);
          return (
            <div className="ag-cal__head-cell" key={day.toISOString()}>
              <span className="ag-cal__dow">{WEEKDAY_LABELS[idx]}</span>
              <span className={`ag-cal__num${isToday ? " ag-cal__num--today" : ""}`}>
                {day.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      <div className="ag-cal__body">
        <div className="ag-cal__gutter">
          {HOURS.map((hour) => (
            <div className="ag-cal__hour" key={hour}>
              {formatHourLabel(hour)}
            </div>
          ))}
        </div>

        {days.map((day, idx) => {
          const dayEvents = byDay[idx] ?? [];
          const isToday = isSameDay(day, today);
          return (
            <div
              className={`ag-cal__col${isToday ? " ag-cal__col--today" : ""}`}
              key={day.toISOString()}
            >
              {HOURS.map((hour) => (
                <div className="ag-cal__slot" key={`${day.toISOString()}-${hour}`} />
              ))}

              {dayEvents.map((appointment) => {
                const start = new Date(appointment.startAt);
                const end = new Date(appointment.endAt);
                const { top, height } = rectForRange(start, end);
                const client = appointment.customer?.name ?? "Sem cliente";
                const serviceLabel =
                  appointment.serviceNameSnapshot ??
                  appointment.service?.name ??
                  (Array.isArray(appointment.appointmentServices)
                    ? appointment.appointmentServices
                        .map((s: AnyRecord) => s.serviceNameSnapshot ?? s.service?.name)
                        .filter(Boolean)
                        .join(" + ")
                    : "");

                return (
                  <button
                    key={appointment.id}
                    type="button"
                    className="ag-ev"
                    data-status={appointment.status}
                    style={{ top, height }}
                    onClick={() => onSelectAppointment(appointment)}
                    title={`${client} — ${formatTime(start)} → ${formatTime(end)}`}
                  >
                    <div className="ag-ev__t">{client}</div>
                    {serviceLabel ? <div className="ag-ev__s">{serviceLabel}</div> : null}
                    <div className="ag-ev__time">
                      {formatTime(start)} — {formatTime(end)}
                    </div>
                  </button>
                );
              })}

              {showNowLine && idx === nowDayIndex ? (
                <div className="ag-nowline" style={{ top: nowTop }} aria-hidden="true" />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
