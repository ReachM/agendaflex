"use client";

import { CalendarPlus, CheckCircle, Clock } from "lucide-react";
import type { AgendaField, AgendaPreset } from "@/config/agenda-presets";

export type AnyRecord = Record<string, any>;

export type AgendaAccess = {
  canSeeFinancial: boolean;
  canSeeClinicalSensitive: boolean;
  canUseChecklist: boolean;
  canManage: boolean;
  canChangeStatus: boolean;
};

export const statusLabels: Record<string, string> = {
  SCHEDULED: "Agendado",
  CONFIRMED: "Confirmado",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluido",
  CANCELLED: "Cancelado",
  NO_SHOW: "Nao compareceu"
};

export const statusBadgeClass: Record<string, string> = {
  SCHEDULED: "status-scheduled",
  CONFIRMED: "status-confirmed",
  IN_PROGRESS: "status-in-progress",
  COMPLETED: "status-completed",
  CANCELLED: "status-cancelled",
  NO_SHOW: "status-no-show"
};

function formatTime(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatMoney(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

function formatDuration(startAt?: string, endAt?: string) {
  if (!startAt || !endAt) return "-";
  const diff = new Date(endAt).getTime() - new Date(startAt).getTime();
  if (!Number.isFinite(diff) || diff <= 0) return "-";
  return `${Math.round(diff / 60000)} min`;
}

function stringifyValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date) return formatDateTime(value.toISOString());
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  if (typeof value === "boolean") return value ? "Sim" : "Nao";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function firstValue(values: unknown[]) {
  return values.find((value) => value !== null && value !== undefined && value !== "");
}

export function resolveAgendaFieldValue(appointment: AnyRecord, field: AgendaField) {
  const fallbackKeys = field.fallbackKeys ?? [];
  const keys = [field.key, ...fallbackKeys];

  if (field.key === "status") return statusLabels[appointment.status] ?? appointment.status;

  if (field.source === "computed") {
    if (field.key === "startAt") return formatDateTime(appointment.startAt);
    if (field.key === "time") return formatTime(appointment.startAt);
    if (field.key === "duration") return formatDuration(appointment.startAt, appointment.endAt);
  }

  if (field.source === "appointment") {
    return stringifyValue(firstValue(keys.map((key) => appointment[key])));
  }

  if (field.source === "customer") {
    return stringifyValue(firstValue(keys.flatMap((key) => [
      appointment.customer?.[key],
      appointment.customer?.customValues?.[key]
    ])));
  }

  if (field.source === "customerCustom") {
    return stringifyValue(firstValue(keys.map((key) => appointment.customer?.customValues?.[key])));
  }

  if (field.source === "appointmentCustom") {
    return stringifyValue(firstValue(keys.map((key) => appointment.customValues?.[key])));
  }

  if (field.source === "service") {
    const serviceNames = (appointment.appointmentServices ?? [])
      .map((item: AnyRecord) => item.serviceNameSnapshot ?? item.service?.name)
      .filter(Boolean);
    if (field.key === "name" && serviceNames.length > 0) return serviceNames.join(", ");
    return stringifyValue(firstValue(keys.map((key) => appointment.service?.[key])));
  }

  if (field.source === "professional") {
    return stringifyValue(firstValue(keys.map((key) => appointment.professional?.[key])));
  }

  if (field.source === "financial") {
    const value = firstValue(keys.flatMap((key) => [
      appointment[key],
      appointment.customValues?.[key],
      key === "totalValue" ? appointment.customValues?._grandTotal : undefined,
      key === "partsValue" ? appointment.customValues?._partsValue : undefined,
      key === "laborValue" ? appointment.customValues?._laborValue : undefined,
      key === "discountPercent" ? appointment.customValues?._discountPercent : undefined
    ]));
    if (field.key.toLowerCase().includes("percent")) return value ? `${value}%` : "";
    return formatMoney(value as string | number | null);
  }

  if (field.source === "checklist") {
    const count = appointment.checklists?.length ?? 0;
    return count > 0 ? `${count} checklist${count > 1 ? "s" : ""}` : "";
  }

  return "";
}

export function canRenderAgendaField(field: AgendaField, access: AgendaAccess) {
  if (field.financial && !access.canSeeFinancial) return false;
  if (field.sensitive && !access.canSeeClinicalSensitive) return false;
  return true;
}

export function AppointmentCard({
  appointment,
  preset,
  access,
  onOpen
}: {
  appointment: AnyRecord;
  preset: AgendaPreset;
  access: AgendaAccess;
  onOpen: (appointment: AnyRecord) => void;
}) {
  const fields = preset.cardFields
    .filter((field) => canRenderAgendaField(field, access))
    .map((field) => ({ field, value: resolveAgendaFieldValue(appointment, field) }))
    .filter((item) => item.value);

  return (
    <button
      className="panel"
      onClick={() => onOpen(appointment)}
      type="button"
      style={{ textAlign: "left", width: "100%", padding: 14, cursor: "pointer" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div style={{ display: "grid", gap: 5 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)", fontSize: 13 }}>
            <Clock size={14} />
            <strong>{formatTime(appointment.startAt)}</strong>
            <span>-</span>
            <span>{formatTime(appointment.endAt)}</span>
          </div>
          <strong style={{ fontSize: 15 }}>{appointment.customer?.name ?? "-"}</strong>
          <span className="muted" style={{ fontSize: 13 }}>
            {resolveAgendaFieldValue(appointment, { key: "name", label: preset.labels.service, source: "service" }) || "-"}
          </span>
        </div>
        <span className={`badge ${statusBadgeClass[appointment.status] ?? ""}`}>
          {statusLabels[appointment.status] ?? appointment.status}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginTop: 12 }}>
        {fields
          .filter(({ field }) => !["startAt", "status", "name"].includes(field.key) || field.source !== "customer")
          .slice(0, 5)
          .map(({ field, value }) => (
            <div key={`${field.source}:${field.key}`} style={{ minWidth: 0 }}>
              <span className="muted" style={{ display: "block", fontSize: 11 }}>{field.label}</span>
              <strong style={{ display: "block", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</strong>
            </div>
          ))}
      </div>

      {access.canUseChecklist && (appointment.checklists ?? []).length > 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, color: "var(--success)", fontSize: 12, fontWeight: 600 }}>
          <CheckCircle size={14} />
          Checklist vinculado
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, color: "var(--muted)", fontSize: 12 }}>
          <CalendarPlus size={14} />
          {preset.labels.appointment}
        </div>
      )}
    </button>
  );
}
