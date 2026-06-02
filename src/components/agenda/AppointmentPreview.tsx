"use client";

import { CalendarPlus, User, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AgendaPreset } from "@/config/agenda-presets";
import { AgendaActions } from "@/components/agenda/AgendaActions";
import {
  canRenderAgendaField,
  resolveAgendaFieldValue,
  statusLabels,
  type AgendaAccess,
  type AnyRecord
} from "@/components/agenda/AppointmentCard";
import { apiFetch } from "@/lib/client-api";

const STATUS_PILL_CLASS: Record<string, string> = {
  SCHEDULED: "ag-pill ag-pill--scheduled",
  CONFIRMED: "ag-pill ag-pill--confirmed",
  IN_PROGRESS: "ag-pill ag-pill--inprogress",
  COMPLETED: "ag-pill ag-pill--completed",
  CANCELLED: "ag-pill ag-pill--cancelled",
  NO_SHOW: "ag-pill ag-pill--noshow"
};

type CustomField = {
  label: string;
  fieldKey: string;
  entityType: string;
  isActive: boolean;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatMoney(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  if (typeof value === "boolean") return value ? "Sim" : "Nao";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function labelFor(fields: CustomField[], entityType: string, key: string) {
  return fields.find((field) => field.entityType === entityType && field.fieldKey === key)?.label ?? key;
}

function fieldIdentity(source: string, key: string) {
  return `${source}:${key}`;
}

export function AppointmentPreview({
  appointment,
  preset,
  access,
  customFields,
  onClose,
  onStatusChange,
  onRefresh
}: {
  appointment: AnyRecord;
  preset: AgendaPreset;
  access: AgendaAccess;
  customFields: CustomField[];
  onClose: () => void;
  onStatusChange: (id: string, status: string) => Promise<void>;
  onRefresh: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPrint, setShowPrint] = useState(false);

  // ESC fecha o drawer
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const visiblePresetFields = useMemo(() => {
    return preset.previewFields
      .filter((field) => canRenderAgendaField(field, access))
      .map((field) => ({ field, value: resolveAgendaFieldValue(appointment, field) }))
      .filter((item) => item.value);
  }, [access, appointment, preset.previewFields]);

  const usedFieldKeys = new Set(
    preset.previewFields.flatMap((field) => [
      fieldIdentity(field.source, field.key),
      ...(field.fallbackKeys ?? []).map((key) => fieldIdentity(field.source, key))
    ])
  );

  const appointmentCustom = Object.entries(appointment.customValues ?? {})
    .filter(([key]) => !key.startsWith("_") && !usedFieldKeys.has(fieldIdentity("appointmentCustom", key)));

  const customerCustom = Object.entries(appointment.customer?.customValues ?? {})
    .filter(([key]) => !usedFieldKeys.has(fieldIdentity("customerCustom", key)) && !usedFieldKeys.has(fieldIdentity("customer", key)));

  async function handleStatus(status: string) {
    setLoading(true);
    setError("");
    try {
      await onStatusChange(appointment.id, status);
      onRefresh();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function createChecklist() {
    setLoading(true);
    setError("");
    try {
      await apiFetch("/api/checklists", {
        method: "POST",
        body: JSON.stringify({
          appointmentId: appointment.id,
          title: preset.labels.checklist,
          items: preset.checklistTemplate.map((description, sortOrder) => ({ description, sortOrder }))
        })
      });
      onRefresh();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const pillClass = STATUS_PILL_CLASS[appointment.status] ?? "ag-pill ag-pill--scheduled";

  return (
    <>
      <div
        className="ag-drawer-overlay ag-drawer-overlay--open"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="ag-drawer ag-drawer--open"
        role="dialog"
        aria-modal="true"
        aria-label={preset.labels.appointment}
      >
        <header className="ag-drawer__head">
          <div>
            <h3>{preset.labels.appointment}</h3>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}>{formatDateTime(appointment.startAt)}</p>
          </div>
          <button className="ag-drawer__close" onClick={onClose} title="Fechar" type="button" aria-label="Fechar">
            <X size={18} />
          </button>
        </header>

        <div className="ag-drawer__body">
        <span className={pillClass}>
          <span className="ag-pill__dot" aria-hidden="true" />
          {statusLabels[appointment.status] ?? appointment.status}
        </span>

        {error ? <div className="error-box" style={{ marginTop: 0, marginBottom: 12 }}>{error}</div> : null}

        <div className="detail-cards" style={{ marginTop: 4 }}>
          <div className="detail-card detail-card--client">
            <div className="detail-card__icon"><User size={20} /></div>
            <div className="detail-card__body">
              <span className="detail-card__label">{preset.labels.customer}</span>
              <strong className="detail-card__value">{appointment.customer?.name ?? "-"}</strong>
              <div className="detail-card__meta">
                {appointment.customer?.phone ? <span>{appointment.customer.phone}</span> : null}
                {appointment.customer?.email ? <span>{appointment.customer.email}</span> : null}
              </div>
            </div>
          </div>
          <div className="detail-card detail-card--schedule">
            <div className="detail-card__icon"><CalendarPlus size={20} /></div>
            <div className="detail-card__body">
              <span className="detail-card__label">{preset.labels.professional}</span>
              <strong className="detail-card__value">{appointment.professional?.name ?? "-"}</strong>
              <div className="detail-card__meta">
                <span>{preset.labels.service}: {appointment.service?.name ?? "-"}</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10, marginTop: 16 }}>
          {visiblePresetFields.map(({ field, value }) => (
            <div key={`${field.source}:${field.key}`} style={{ padding: 12, border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--surface)" }}>
              <span className="muted" style={{ display: "block", fontSize: 12 }}>{field.label}</span>
              <strong style={{ display: "block", fontSize: 14, marginTop: 3 }}>{value}</strong>
            </div>
          ))}
        </div>

        {(appointment.appointmentServices ?? []).length > 0 ? (
          <div style={{ marginTop: 16 }}>
            <strong className="preview-section-label">{preset.labels.service}</strong>
            <div className="preview-services-list">
              {(appointment.appointmentServices as AnyRecord[]).map((item, index) => (
                <div className="preview-service-row" key={item.id ?? index}>
                  <span style={{ fontWeight: 600 }}>{item.serviceNameSnapshot ?? item.service?.name ?? "-"}</span>
                  {access.canSeeFinancial && item.unitPrice ? (
                    <span style={{ color: "var(--primary)", fontWeight: 700 }}>{formatMoney(item.unitPrice)}</span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {access.canSeeFinancial && preset.showFinancial ? (
          <div className="preview-financial" style={{ marginTop: 12 }}>
            <strong className="preview-section-label">Valores</strong>
            <div className="preview-financial__grid">
              <div className="preview-financial__row"><span>Pecas</span><span>{formatMoney(appointment.partsValue)}</span></div>
              <div className="preview-financial__row"><span>Mao de obra</span><span>{formatMoney(appointment.laborValue)}</span></div>
              <div className="preview-financial__row"><span>Desconto</span><span>{appointment.discountPercent ? `${appointment.discountPercent}%` : "-"}</span></div>
              <div className="preview-financial__total"><span>Total</span><strong>{formatMoney(appointment.totalValue)}</strong></div>
            </div>
          </div>
        ) : null}

        {appointment.notes ? (
          <div className="preview-notes" style={{ marginTop: 12 }}>
            <strong className="preview-section-label">Observacoes</strong>
            <p>{appointment.notes}</p>
          </div>
        ) : null}

        {appointmentCustom.length > 0 || customerCustom.length > 0 ? (
          <div className="preview-notes" style={{ marginTop: 12 }}>
            <strong className="preview-section-label">Campos personalizados</strong>
            <div className="preview-custom-fields">
              {customerCustom.map(([key, value]) => (
                <div className="preview-custom-field" key={`customer:${key}`}>
                  <span className="preview-custom-field__key">{labelFor(customFields, "CUSTOMER", key)}</span>
                  <span className="preview-custom-field__val">{formatValue(value)}</span>
                </div>
              ))}
              {appointmentCustom.map(([key, value]) => (
                <div className="preview-custom-field" key={`appointment:${key}`}>
                  <span className="preview-custom-field__key">{labelFor(customFields, "APPOINTMENT", key)}</span>
                  <span className="preview-custom-field__val">{formatValue(value)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {access.canUseChecklist && (appointment.checklists ?? []).length > 0 ? (
          <div className="preview-checklist-summary" style={{ marginTop: 12 }}>
            <strong className="preview-section-label">{preset.labels.checklist}</strong>
            {(appointment.checklists as AnyRecord[]).map((checklist) => (
              <div className="preview-checklist-badge" key={checklist.id}>
                <span>{checklist.title ?? preset.labels.checklist}</span>
                <span className="muted">({checklist._count?.items ?? checklist.items?.length ?? 0} itens)</span>
                <span className={`badge ${checklist.status === "completed" ? "success" : "warning"}`}>
                  {checklist.status === "completed" ? "Completo" : "Em andamento"}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        <AgendaActions
          appointment={appointment}
          preset={preset}
          access={access}
          loading={loading}
          onStatus={handleStatus}
          onChecklist={createChecklist}
          onPrint={() => setShowPrint(true)}
        />

        {showPrint ? (
          <div className="modal-overlay" style={{ zIndex: 1001 }} onClick={() => setShowPrint(false)}>
            <div className="modal-content print-checklist" style={{ maxWidth: 620 }} onClick={(event) => event.stopPropagation()}>
              <div className="toolbar no-print" style={{ marginBottom: 16 }}>
                <h2 className="section-title">{preset.labels.checklist}</h2>
                <button className="button" onClick={() => window.print()} type="button">Imprimir</button>
              </div>
              <div className="print-area">
                <div className="print-header">
                  <h2>{preset.labels.checklist}</h2>
                  <div><strong>{preset.labels.customer}:</strong> {appointment.customer?.name ?? "-"}</div>
                  <div><strong>{preset.labels.professional}:</strong> {appointment.professional?.name ?? "-"}</div>
                  <div><strong>Data:</strong> {formatDateTime(appointment.startAt)}</div>
                </div>
                {(appointment.checklists ?? []).map((checklist: AnyRecord) => (
                  <div className="print-checklist-section" key={checklist.id}>
                    <h3>{checklist.title ?? preset.labels.checklist}</h3>
                    <table className="print-table">
                      <tbody>
                        {(checklist.items ?? []).map((item: AnyRecord) => (
                          <tr key={item.id}>
                            <td style={{ width: 40, textAlign: "center" }}>{item.isChecked ? "X" : ""}</td>
                            <td>{item.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
        </div>
      </aside>
    </>
  );
}
