"use client";

import { useMemo } from "react";
import type { AnyRecord } from "@/components/agenda/AppointmentCard";
import { initialsOf, professionalColor } from "@/components/agenda/professional-colors";
import { addDays, formatTime, startOfDay } from "@/components/agenda/week-utils";

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short" }).format(date);
}

function durationMin(appointment: AnyRecord): number {
  const ms = new Date(appointment.endAt).getTime() - new Date(appointment.startAt).getTime();
  return Math.max(0, Math.round(ms / 60_000));
}

function serviceLabel(appointment: AnyRecord): string {
  if (Array.isArray(appointment.appointmentServices) && appointment.appointmentServices.length > 0) {
    return appointment.appointmentServices
      .map((s: AnyRecord) => s.serviceNameSnapshot ?? s.service?.name)
      .filter(Boolean)
      .join(" + ");
  }
  return appointment.serviceNameSnapshot ?? appointment.service?.name ?? "";
}

export function DayList({
  appointments,
  selectedDate,
  onSelectAppointment
}: {
  appointments: AnyRecord[];
  selectedDate: Date;
  onSelectAppointment: (appointment: AnyRecord) => void;
}) {
  const dayItems = useMemo(() => {
    const start = startOfDay(selectedDate);
    const end = addDays(start, 1);
    return appointments
      .filter((a) => {
        const t = new Date(a.startAt);
        return t >= start && t < end;
      })
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }, [appointments, selectedDate]);

  return (
    <section className="ag-panel" aria-label="Agendamentos do dia">
      <header className="ag-panel__head">
        <h4 className="ag-panel__title" style={{ textTransform: "capitalize" }}>{formatDate(selectedDate)}</h4>
        <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
          {dayItems.length} {dayItems.length === 1 ? "agendamento" : "agendamentos"}
        </span>
      </header>

      <div className="ag-daylist">
        {dayItems.length === 0 ? (
          <div className="ag-daylist__empty">Nenhum agendamento.</div>
        ) : (
          dayItems.map((appointment) => {
            const start = new Date(appointment.startAt);
            const proName = appointment.professional?.name ?? "—";
            const proColor = professionalColor(appointment.professional?.id);
            const customerName = appointment.customer?.name ?? "Cliente sem nome";
            return (
              <button
                key={appointment.id}
                type="button"
                className="ag-day-item"
                data-status={appointment.status}
                onClick={() => onSelectAppointment(appointment)}
              >
                <span className="ag-day-item__bar" aria-hidden="true" />
                <div className="ag-day-item__body">
                  <div className="ag-day-item__time">
                    {formatTime(start)} · {durationMin(appointment)}min
                  </div>
                  <div className="ag-day-item__name">{customerName}</div>
                  <div className="ag-day-item__svc">
                    {[serviceLabel(appointment), proName].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <span
                  className="ag-day-item__avt"
                  style={{ background: proColor }}
                  title={proName}
                >
                  {initialsOf(proName)}
                </span>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
