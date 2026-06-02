"use client";

import { useMemo } from "react";
import type { AnyRecord } from "@/components/agenda/AppointmentCard";
import { addDays, startOfDay } from "@/components/agenda/week-utils";

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

function appointmentValue(appointment: AnyRecord): number {
  // 1) Campo totalValue na própria appointment (preferencial; vem do backend
  //    quando há permissão financeira).
  if (typeof appointment.totalValue === "number") return appointment.totalValue;
  if (typeof appointment.totalValue === "string" && appointment.totalValue !== "") {
    const n = Number(appointment.totalValue);
    if (Number.isFinite(n)) return n;
  }
  // 2) _grandTotal salvo em customValues durante a criação.
  const grand = appointment.customValues?._grandTotal;
  if (typeof grand === "number") return grand;
  // 3) Soma de unitPrice em appointmentServices.
  if (Array.isArray(appointment.appointmentServices)) {
    return appointment.appointmentServices.reduce((sum: number, item: AnyRecord) => {
      const v = item.totalPrice ?? item.unitPrice;
      if (typeof v === "number") return sum + v;
      if (typeof v === "string" && v !== "") {
        const n = Number(v);
        return Number.isFinite(n) ? sum + n : sum;
      }
      return sum;
    }, 0);
  }
  return 0;
}

/**
 * Estima a ocupação como a fração de horas trabalhadas (8–20h, 7 dias) já
 * preenchidas com agendamentos não cancelados. Assume `professionalCount`
 * profissionais — quando 0, retorna 0.
 */
function occupancyRate(appointments: AnyRecord[], weekStart: Date, professionalCount: number): number {
  if (professionalCount === 0) return 0;
  const start = startOfDay(weekStart);
  const end = addDays(start, 7);
  const minutesUsed = appointments
    .filter((a) => a.status !== "CANCELLED" && a.status !== "NO_SHOW")
    .filter((a) => {
      const t = new Date(a.startAt);
      return t >= start && t < end;
    })
    .reduce((sum, a) => {
      const ms = new Date(a.endAt).getTime() - new Date(a.startAt).getTime();
      return sum + Math.max(0, ms / 60_000);
    }, 0);
  const minutesAvailable = professionalCount * 7 * 12 * 60; // 12h * 7 dias
  if (minutesAvailable <= 0) return 0;
  return Math.min(100, Math.round((minutesUsed / minutesAvailable) * 100));
}

export function StatsStrip({
  appointments,
  weekStart,
  professionalCount,
  showFinancial
}: {
  appointments: AnyRecord[];
  weekStart: Date;
  professionalCount: number;
  showFinancial: boolean;
}) {
  const start = useMemo(() => startOfDay(weekStart), [weekStart]);
  const end = useMemo(() => addDays(start, 7), [start]);

  const weekAppointments = useMemo(
    () =>
      appointments.filter((a) => {
        const t = new Date(a.startAt);
        return t >= start && t < end;
      }),
    [appointments, start, end]
  );

  const totalCount = weekAppointments.filter((a) => a.status !== "CANCELLED").length;
  const revenue = showFinancial
    ? weekAppointments
        .filter((a) => a.status !== "CANCELLED" && a.status !== "NO_SHOW")
        .reduce((sum, a) => sum + appointmentValue(a), 0)
    : 0;
  const occupancy = occupancyRate(appointments, weekStart, professionalCount);

  return (
    <div className="ag-stats" aria-label="Resumo da semana">
      <div className="ag-stat">
        <div className="ag-stat__v">{totalCount}</div>
        <div className="ag-stat__l">Agendamentos · esta semana</div>
      </div>
      {showFinancial ? (
        <div className="ag-stat ag-stat--ok">
          <div className="ag-stat__v">{formatBRL(revenue)}</div>
          <div className="ag-stat__l">Receita prevista</div>
        </div>
      ) : (
        <div className="ag-stat">
          <div className="ag-stat__v">—</div>
          <div className="ag-stat__l">Receita prevista</div>
        </div>
      )}
      <div className="ag-stat ag-stat--accent">
        <div className="ag-stat__v">{occupancy}%</div>
        <div className="ag-stat__l">Taxa de ocupação</div>
      </div>
    </div>
  );
}
