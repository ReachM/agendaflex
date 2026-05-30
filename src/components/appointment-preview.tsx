"use client";

import {
  Ban,
  CalendarPlus,
  Camera,
  Check,
  CheckCircle,
  CheckSquare,
  ChevronRight,
  Clock,
  Edit2,
  ListChecks,
  Plus,
  Printer,
  Play,
  RefreshCcw,
  StickyNote,
  User,
  X
} from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-api";

type AnyRecord = Record<string, any>;

const statusLabels: Record<string, string> = {
  SCHEDULED: "Agendado",
  CONFIRMED: "Confirmado",
  IN_PROGRESS: "Em atendimento",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
  NO_SHOW: "Não compareceu"
};

const statusBadgeClass: Record<string, string> = {
  SCHEDULED: "status-scheduled",
  CONFIRMED: "status-confirmed",
  IN_PROGRESS: "status-in-progress",
  COMPLETED: "status-completed",
  CANCELLED: "status-cancelled",
  NO_SHOW: "status-no-show"
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatMoney(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

// ─── Enhanced Appointment Preview Modal ────────────────────
export function AppointmentPreviewModal({
  appointment,
  onClose,
  onStatusChange,
  onRefresh,
  role,
  planFeatures
}: {
  appointment: AnyRecord;
  onClose: () => void;
  onStatusChange: (id: string, status: string, reason?: string) => Promise<void>;
  onRefresh: () => void;
  role?: string;
  planFeatures?: Record<string, boolean>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showChecklist, setShowChecklist] = useState(false);

  const status = appointment.status;
  const canManage = !role || ["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER"].includes(role);
  const canChangeStatus = !role || ["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER", "STAFF"].includes(role);
  const isTerminal = status === "CANCELLED" || status === "COMPLETED" || status === "NO_SHOW";
  const checklistAllowed = planFeatures?.allowCustomerChecklist === true;
  const hasChecklist = (appointment.checklists ?? []).length > 0;

  async function handleStatus(newStatus: string, reason?: string) {
    setLoading(true);
    setError("");
    try {
      await onStatusChange(appointment.id, newStatus, reason);
      onRefresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    await handleStatus("CANCELLED", cancelReason);
    setShowCancelModal(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content preview-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        {/* Header */}
        <div className="preview-modal__header">
          <h2 className="section-title" style={{ margin: 0 }}>Detalhes do agendamento</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className={`badge ${statusBadgeClass[status] ?? ""}`}>
              {statusLabels[status] ?? status}
            </span>
            <button className="icon-button secondary" onClick={onClose} type="button" title="Fechar">
              <X size={16} />
            </button>
          </div>
        </div>

        {error && <div className="error-box" style={{ margin: "8px 0" }}>{error}</div>}

        {/* Client & Schedule Info */}
        <div className="detail-cards" style={{ marginTop: 16 }}>
          <div className="detail-card detail-card--client">
            <div className="detail-card__icon"><User size={20} /></div>
            <div className="detail-card__body">
              <span className="detail-card__label">Cliente</span>
              <strong className="detail-card__value">{appointment.customer?.name ?? "-"}</strong>
              <div className="detail-card__meta">
                {appointment.customer?.phone && <span>{appointment.customer.phone}</span>}
                {appointment.customer?.email && <span>{appointment.customer.email}</span>}
              </div>
            </div>
          </div>
          <div className="detail-card detail-card--schedule">
            <div className="detail-card__icon"><CalendarPlus size={20} /></div>
            <div className="detail-card__body">
              <span className="detail-card__label">Agendamento</span>
              <strong className="detail-card__value">{formatDateTime(appointment.startAt)}</strong>
              <div className="detail-card__meta">
                <span>Até: {formatTime(appointment.endAt)}</span>
                <span>Profissional: <strong>{appointment.professional?.name ?? "-"}</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Services */}
        {(appointment.appointmentServices ?? []).length > 0 && (
          <div style={{ marginTop: 16 }}>
            <strong className="preview-section-label">Serviços ({appointment.appointmentServices.length})</strong>
            <div className="preview-services-list">
              {(appointment.appointmentServices as AnyRecord[]).map((as_item: AnyRecord, i: number) => (
                <div key={as_item.id ?? i} className="preview-service-row">
                  <span style={{ fontWeight: 600 }}>{as_item.serviceNameSnapshot ?? as_item.service?.name ?? "-"}</span>
                  <span style={{ color: "var(--primary)", fontWeight: 700 }}>{formatMoney(as_item.unitPrice)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TODO [MVP-FUTURE] Reativar seção de valores financeiros na v2 */}
        {/* <div className="preview-financial" style={{ marginTop: 12 }}>
          <strong className="preview-section-label">Valores</strong>
          <div className="preview-financial__grid">
            {servicesTotal > 0 && (
              <div className="preview-financial__row">
                <span>Serviços</span><span>{formatMoney(servicesTotal)}</span>
              </div>
            )}
            {parts > 0 && (
              <div className="preview-financial__row">
                <span>Peças</span><span>{formatMoney(parts)}</span>
              </div>
            )}
            {labor > 0 && (
              <div className="preview-financial__row">
                <span>Mão de obra</span><span>{formatMoney(labor)}</span>
              </div>
            )}
            {(discountPct > 0 || discountVal > 0) && (
              <div className="preview-financial__row preview-financial__discount">
                <span>Desconto{discountPct > 0 ? ` (${discountPct}%)` : ""}</span>
                <span>- {formatMoney(calculatedDiscount)}</span>
              </div>
            )}
            <div className="preview-financial__total">
              <span>Total</span>
              <strong>{formatMoney(total)}</strong>
            </div>
          </div>
        </div> */}

        {/* Observations */}
        {appointment.notes && (
          <div className="preview-notes" style={{ marginTop: 12 }}>
            <strong className="preview-section-label">Observações</strong>
            <p>{appointment.notes}</p>
          </div>
        )}

        {/* Custom Field Values */}
        {appointment.customValues && Object.keys(appointment.customValues).length > 0 && (
          <div className="preview-notes" style={{ marginTop: 12 }}>
            <strong className="preview-section-label">Campos personalizados</strong>
            <div className="preview-custom-fields">
              {Object.entries(appointment.customValues)
                .filter(([key]) => !key.startsWith("_"))
                .map(([key, val]) => (
                  <div key={key} className="preview-custom-field">
                    <span className="preview-custom-field__key">{key}</span>
                    <span className="preview-custom-field__val">{Array.isArray(val) ? (val as string[]).join(", ") : String(val)}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {checklistAllowed && canManage ? (
          <AppointmentChecklistSection
            appointmentId={appointment.id}
            checklists={appointment.checklists ?? []}
            onChanged={onRefresh}
          />
        ) : null}

        {/* Action Buttons */}
        <div className="preview-actions" style={{ marginTop: 20 }}>
          {/* Status transition buttons */}
          {canChangeStatus && !isTerminal && (
            <div className="preview-actions__group">
              {(status === "SCHEDULED") && (
                <button className="button" onClick={() => handleStatus("CONFIRMED")} disabled={loading} type="button">
                  <Check size={16} /> Confirmar
                </button>
              )}
              {(status === "SCHEDULED" || status === "CONFIRMED") && (
                <button className="button" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }} onClick={() => handleStatus("IN_PROGRESS")} disabled={loading} type="button">
                  <Play size={16} /> Em andamento
                </button>
              )}
              {(status === "SCHEDULED" || status === "CONFIRMED" || status === "IN_PROGRESS") && (
                <button className="button" style={{ background: "linear-gradient(135deg, var(--success), #15803d)" }} onClick={() => handleStatus("COMPLETED")} disabled={loading} type="button">
                  <CheckCircle size={16} /> Concluir
                </button>
              )}
              {!isTerminal && canManage && (
                <button className="button danger" onClick={() => setShowCancelModal(true)} disabled={loading} type="button">
                  <Ban size={16} /> Cancelar
                </button>
              )}
            </div>
          )}

          {checklistAllowed && hasChecklist ? (
            <button className="button secondary" onClick={() => setShowChecklist(true)} type="button">
              <Printer size={16} /> Imprimir checklist
            </button>
          ) : null}

          <button className="button secondary" onClick={onClose} type="button">
            <Edit2 size={16} /> Fechar
          </button>
        </div>

        {/* Cancel Confirmation Modal */}
        {showCancelModal && (
          <div className="modal-overlay" onClick={() => setShowCancelModal(false)} style={{ zIndex: 1001 }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
              <h3 className="section-title">Cancelar agendamento</h3>
              <p style={{ color: "var(--text-secondary)", marginBottom: 12 }}>
                Tem certeza que deseja cancelar este agendamento?
              </p>
              <div className="field full">
                <label>Motivo do cancelamento</label>
                <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Informe o motivo..." />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button className="button danger" onClick={handleCancel} disabled={loading} type="button">
                  <Ban size={16} /> Confirmar cancelamento
                </button>
                <button className="button secondary" onClick={() => setShowCancelModal(false)} type="button">
                  Voltar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Checklist Print View */}
        {showChecklist && (
          <ChecklistPrintModal
            appointment={appointment}
            onClose={() => setShowChecklist(false)}
          />
        )}
      </div>
    </div>
  );
}

// ─── Checklist Print Modal ─────────────────────────────────
function ChecklistPrintModal({ appointment, onClose }: { appointment: AnyRecord; onClose: () => void }) {
  const checklists = appointment.checklists ?? [];

  function handlePrint() {
    window.print();
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1002 }}>
      <div className="modal-content print-checklist" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <div className="toolbar no-print" style={{ marginBottom: 16 }}>
          <h2 className="section-title">Checklist do atendimento</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="button" onClick={handlePrint} type="button">
              <Printer size={16} /> Imprimir
            </button>
            <button className="icon-button secondary" onClick={onClose} type="button">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="print-area">
          <div className="print-header">
            <h2>Checklist de Atendimento</h2>
            <div className="print-info-grid">
              <div><strong>Cliente:</strong> {appointment.customer?.name ?? "-"}</div>
              <div><strong>Data:</strong> {formatDateTime(appointment.startAt)}</div>
              <div><strong>Profissional:</strong> {appointment.professional?.name ?? "-"}</div>
              <div><strong>Status:</strong> {statusLabels[appointment.status] ?? appointment.status}</div>
            </div>
            {(appointment.appointmentServices ?? []).length > 0 && (
              <div style={{ marginTop: 8 }}>
                <strong>Serviços: </strong>
                {(appointment.appointmentServices as AnyRecord[]).map((s: AnyRecord) => s.serviceNameSnapshot ?? s.service?.name).filter(Boolean).join(", ")}
              </div>
            )}
          </div>

          {checklists.map((cl: AnyRecord) => (
            <div key={cl.id} className="print-checklist-section">
              <h3>{cl.title ?? "Checklist"}</h3>
              {cl.notes && <p className="print-notes">{cl.notes}</p>}
              <table className="print-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>✓</th>
                    <th>Item</th>
                  </tr>
                </thead>
                <tbody>
                  {(cl.items ?? []).map((item: AnyRecord) => (
                    <tr key={item.id}>
                      <td style={{ textAlign: "center" }}>
                        {item.isChecked ? "☑" : "☐"}
                      </td>
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
  );
}

// ─── Today's Appointments Section for Dashboard ────────────
export function TodayAppointments({
  appointments,
  onStatusChange,
  onRefresh,
  role,
  planFeatures
}: {
  appointments: AnyRecord[];
  onStatusChange: (id: string, status: string, reason?: string) => Promise<void>;
  onRefresh: () => void;
  role?: string;
  planFeatures?: Record<string, boolean>;
}) {
  const [selectedAppointment, setSelectedAppointment] = useState<AnyRecord | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [profFilter, setProfFilter] = useState("");

  const canChangeStatus = !role || ["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER", "STAFF"].includes(role);

  // Unique professionals for filter
  const professionals = [...new Map(
    appointments.map(a => [a.professionalId, a.professional?.name ?? "-"])
  ).entries()];

  const filtered = appointments.filter(a => {
    if (statusFilter && a.status !== statusFilter) return false;
    if (profFilter && a.professionalId !== profFilter) return false;
    return true;
  });

  async function quickStatus(id: string, status: string) {
    try {
      await onStatusChange(id, status);
      onRefresh();
    } catch { /* handled by parent */ }
  }

  return (
    <>
      <div className="section-divider" style={{ marginTop: 24 }}>
        <h2>Agendamentos de Hoje</h2>
      </div>
      <section className="panel">
        {/* Filters */}
        <div className="today-filters" style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <div className="field" style={{ margin: 0, minWidth: 140 }}>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Todos os status</option>
              {Object.entries(statusLabels).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ margin: 0, minWidth: 140 }}>
            <select value={profFilter} onChange={(e) => setProfFilter(e.target.value)}>
              <option value="">Todos profissionais</option>
              {professionals.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>
          <button className="button secondary" onClick={onRefresh} type="button" style={{ marginLeft: "auto" }}>
            <RefreshCcw size={14} /> Atualizar
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon"><CalendarPlus size={32} /></div>
            <h3>Nenhum agendamento para hoje</h3>
            <p>Não há atendimentos agendados para o dia de hoje{statusFilter ? " com esse filtro" : ""}.</p>
          </div>
        ) : (
          <div className="today-appointments-grid">
            {filtered.map((appt) => {
              const isTerminal = appt.status === "CANCELLED" || appt.status === "COMPLETED" || appt.status === "NO_SHOW";
              return (
                <div key={appt.id} className="today-card" onClick={() => setSelectedAppointment(appt)} role="button" tabIndex={0}>
                  <div className="today-card__time">
                    <Clock size={14} />
                    <span>{formatTime(appt.startAt)} - {formatTime(appt.endAt)}</span>
                  </div>
                  <div className="today-card__info">
                    <strong>{appt.customer?.name ?? "-"}</strong>
                    <span className="muted">
                      {(appt.appointmentServices ?? []).map((s: AnyRecord) => s.serviceNameSnapshot ?? s.service?.name).filter(Boolean).join(", ") || appt.service?.name || "-"}
                    </span>
                    <span className="muted">{appt.professional?.name ?? "-"}</span>
                  </div>
                  <div className="today-card__right">
                    <span className={`badge ${statusBadgeClass[appt.status] ?? ""}`}>
                      {statusLabels[appt.status] ?? appt.status}
                    </span>
                    {/* TODO [MVP-FUTURE] Reativar totalValue na v2 */}
                    {/* {canSeeValues && appt.totalValue && (
                      <span className="today-card__value">{formatMoney(appt.totalValue)}</span>
                    )} */}
                  </div>
                  {/* Quick actions */}
                  {canChangeStatus && !isTerminal && (
                    <div className="today-card__actions" onClick={(e) => e.stopPropagation()}>
                      {(appt.status === "SCHEDULED" || appt.status === "CONFIRMED") && (
                        <button className="button secondary" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => quickStatus(appt.id, "IN_PROGRESS")} type="button" title="Iniciar atendimento">
                          <Play size={12} /> Iniciar
                        </button>
                      )}
                      {(appt.status === "IN_PROGRESS") && (
                        <button className="button" style={{ padding: "4px 8px", fontSize: 11, background: "linear-gradient(135deg, var(--success), #15803d)" }} onClick={() => quickStatus(appt.id, "COMPLETED")} type="button" title="Concluir">
                          <CheckCircle size={12} /> Concluir
                        </button>
                      )}
                      <button className="icon-button secondary" style={{ width: 28, height: 28 }} onClick={() => setSelectedAppointment(appt)} type="button" title="Ver detalhes">
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Preview Modal */}
      {selectedAppointment && (
        <AppointmentPreviewModal
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onStatusChange={onStatusChange}
          onRefresh={() => { onRefresh(); setSelectedAppointment(null); }}
          role={role}
          planFeatures={planFeatures}
        />
      )}
    </>
  );
}

// ─── Appointment Checklist Section ─────────────────────────
type ChecklistTemplateLite = { id: string; name: string; status: "DRAFT" | "ACTIVE" | "PAUSED" };

type ChecklistItem = {
  id: string;
  description: string;
  itemType: "CHECKBOX" | "NOTE" | "PHOTO";
  isChecked: boolean;
  noteValue: string | null;
  photoUrl: string | null;
  sortOrder: number;
};

type Checklist = {
  id: string;
  title: string;
  status: string;
  notes: string | null;
  completedAt: string | null;
  items: ChecklistItem[];
  template?: { id: string; name: string } | null;
};

function AppointmentChecklistSection({
  appointmentId,
  checklists,
  onChanged
}: {
  appointmentId: string;
  checklists: AnyRecord[];
  onChanged: () => void;
}) {
  const [local, setLocal] = useState<Checklist[]>(checklists as unknown as Checklist[]);
  const [templates, setTemplates] = useState<ChecklistTemplateLite[]>([]);
  const [showStart, setShowStart] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLocal(checklists as unknown as Checklist[]);
  }, [checklists]);

  async function loadTemplates() {
    try {
      const data = await apiFetch<{ templates: ChecklistTemplateLite[] }>("/api/checklists/templates?status=ACTIVE");
      setTemplates(data.templates ?? []);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function startFromTemplate(templateId: string) {
    setBusyAction(true);
    setError("");
    try {
      const result = await apiFetch<{ checklist: Checklist }>("/api/checklists", {
        method: "POST",
        body: JSON.stringify({ appointmentId, templateId })
      });
      setLocal(prev => [...prev, result.checklist]);
      setShowStart(false);
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyAction(false);
    }
  }

  async function startBlank() {
    setBusyAction(true);
    setError("");
    try {
      const result = await apiFetch<{ checklist: Checklist }>("/api/checklists", {
        method: "POST",
        body: JSON.stringify({
          appointmentId,
          title: "Checklist do atendimento",
          items: [{ description: "Novo item", itemType: "CHECKBOX" }]
        })
      });
      setLocal(prev => [...prev, result.checklist]);
      setShowStart(false);
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyAction(false);
    }
  }

  async function updateItem(checklistId: string, itemId: string, patch: Partial<ChecklistItem>) {
    setLocal(prev => prev.map(c =>
      c.id === checklistId
        ? { ...c, items: c.items.map(i => i.id === itemId ? { ...i, ...patch } : i) }
        : c
    ));
    try {
      await apiFetch(`/api/checklists/${checklistId}/items/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify(patch)
      });
    } catch (err) {
      setError((err as Error).message);
      onChanged();
    }
  }

  async function completeChecklist(checklistId: string) {
    setBusyAction(true);
    setError("");
    try {
      await apiFetch(`/api/checklists/${checklistId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "completed" })
      });
      setLocal(prev => prev.map(c => c.id === checklistId ? { ...c, status: "completed", completedAt: new Date().toISOString() } : c));
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyAction(false);
    }
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <strong className="preview-section-label">
          <ListChecks size={13} style={{ display: "inline", marginRight: 4, verticalAlign: "-2px" }} />
          Checklist do atendimento
        </strong>
        <button
          className="btn btn-sm btn-ghost"
          type="button"
          onClick={() => { setShowStart(s => !s); if (!showStart) void loadTemplates(); }}
        >
          <Plus size={12} /> {local.length === 0 ? "Iniciar checklist" : "Novo checklist"}
        </button>
      </div>

      {error ? <div className="error-box" style={{ marginBottom: 8 }}>{error}</div> : null}

      {showStart ? (
        <div style={{ padding: 12, border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--surface-muted)", marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>Selecione um template ativo ou comece em branco:</div>
          {templates.length === 0 ? (
            <div className="empty" style={{ padding: 8, fontSize: 12 }}>
              Nenhum template ativo. <a href="/checklists" style={{ color: "var(--primary)", fontWeight: 600 }}>Criar templates</a>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
              {templates.map(t => (
                <button
                  key={t.id}
                  type="button"
                  className="btn btn-sm btn-ghost"
                  style={{ justifyContent: "flex-start", textAlign: "left" }}
                  onClick={() => startFromTemplate(t.id)}
                  disabled={busyAction}
                >
                  <CheckSquare size={12} /> {t.name}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" className="btn btn-sm btn-primary" onClick={startBlank} disabled={busyAction}>
              <Plus size={12} /> Em branco
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setShowStart(false)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {local.length === 0 && !showStart ? (
        <div className="empty" style={{ padding: 12, fontSize: 12 }}>
          Nenhum checklist iniciado. Use os templates de Checklists para padronizar atendimentos.
        </div>
      ) : null}

      {local.map(cl => (
        <ChecklistCard
          key={cl.id}
          checklist={cl}
          onItemChange={(itemId, patch) => updateItem(cl.id, itemId, patch)}
          onComplete={() => completeChecklist(cl.id)}
          busy={busyAction}
        />
      ))}
    </div>
  );
}

function ChecklistCard({
  checklist,
  onItemChange,
  onComplete,
  busy
}: {
  checklist: Checklist;
  onItemChange: (itemId: string, patch: Partial<ChecklistItem>) => void;
  onComplete: () => void;
  busy: boolean;
}) {
  const checkedCount = checklist.items.filter(i => i.isChecked).length;
  const total = checklist.items.length;
  const pct = total > 0 ? Math.round((checkedCount / total) * 100) : 0;
  const isCompleted = checklist.status === "completed";

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--surface)", marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 14px", borderBottom: total > 0 ? "1px solid var(--border)" : 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ fontSize: 13 }}>{checklist.title}</strong>
          {checklist.template ? (
            <div style={{ fontSize: 11, color: "var(--muted)" }}>Baseado em: {checklist.template.name}</div>
          ) : null}
        </div>
        <span className={`pill ${isCompleted ? "pill--success" : pct > 0 ? "pill--info" : "pill--muted"}`}>
          {isCompleted ? <CheckCircle size={11} /> : null}
          {checkedCount}/{total}
        </span>
      </div>

      {total > 0 ? (
        <div style={{ height: 4, background: "var(--surface-muted)" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: isCompleted ? "var(--success)" : "var(--primary)", transition: "width 0.2s" }} />
        </div>
      ) : null}

      <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
        {checklist.items.length === 0 ? (
          <div className="empty" style={{ padding: 8, fontSize: 12 }}>Checklist vazio.</div>
        ) : (
          checklist.items.map(item => (
            <ChecklistItemRow
              key={item.id}
              item={item}
              disabled={isCompleted}
              onChange={(patch) => onItemChange(item.id, patch)}
            />
          ))
        )}

        {!isCompleted && total > 0 ? (
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={onComplete}
              disabled={busy || checkedCount === 0}
              title={checkedCount === 0 ? "Marque ao menos 1 item antes de concluir" : undefined}
            >
              <CheckCircle size={12} /> Concluir checklist
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ChecklistItemRow({
  item,
  disabled,
  onChange
}: {
  item: ChecklistItem;
  disabled: boolean;
  onChange: (patch: Partial<ChecklistItem>) => void;
}) {
  const icon = item.itemType === "PHOTO" ? <Camera size={12} /> : item.itemType === "NOTE" ? <StickyNote size={12} /> : <CheckSquare size={12} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: item.isChecked ? "var(--success-light, #dcfce7)" : "var(--surface)" }}>
      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: disabled ? "default" : "pointer", fontSize: 13 }}>
        <input
          type="checkbox"
          checked={item.isChecked}
          onChange={e => onChange({ isChecked: e.target.checked })}
          disabled={disabled}
          style={{ width: 16, height: 16 }}
        />
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--muted)", fontSize: 10 }}>{icon}</span>
        <span style={{ flex: 1, textDecoration: item.isChecked ? "line-through" : "none", color: item.isChecked ? "var(--muted)" : "var(--text)" }}>
          {item.description}
        </span>
      </label>
      {item.itemType === "NOTE" ? (
        <textarea
          placeholder="Anotação..."
          value={item.noteValue ?? ""}
          onChange={e => onChange({ noteValue: e.target.value })}
          disabled={disabled}
          rows={2}
          style={{ width: "100%", padding: 6, border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, fontFamily: "inherit", resize: "vertical" }}
        />
      ) : null}
      {item.itemType === "PHOTO" ? (
        <input
          type="url"
          placeholder="URL da foto (cole link do drive ou storage)"
          value={item.photoUrl ?? ""}
          onChange={e => onChange({ photoUrl: e.target.value || null })}
          disabled={disabled}
          style={{ width: "100%", padding: 6, border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
        />
      ) : null}
    </div>
  );
}
