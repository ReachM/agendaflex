"use client";

import { Ban, CalendarDays, CalendarPlus, Check, ChevronLeft, ChevronRight, Clock, DollarSign, Edit2, Eye, Plus, Save, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  getAgendaPreset,
  isClinicalSensitiveFieldKey,
  isFinancialFieldKey,
  type AgendaPreset
} from "@/config/agenda-presets";
import { AgendaFilters, type AgendaFilterValues } from "@/components/agenda/AgendaFilters";
import { AppointmentCard, canRenderAgendaField, resolveAgendaFieldValue, statusBadgeClass, statusLabels, type AgendaAccess, type AnyRecord } from "@/components/agenda/AppointmentCard";
import { AppointmentPreview } from "@/components/agenda/AppointmentPreview";
import { DayList } from "@/components/agenda/DayList";
import { MiniCalendar } from "@/components/agenda/MiniCalendar";
import { StatsStrip } from "@/components/agenda/StatsStrip";
import { WeekCalendar } from "@/components/agenda/WeekCalendar";
import { WeekToolbar } from "@/components/agenda/WeekToolbar";
import { addDays as addDaysWeek, isSameDay as isSameDayWeek, startOfDay as startOfDayWeek, startOfWeek as startOfWeekWeek } from "@/components/agenda/week-utils";
import { DynamicFields, type CustomValues } from "@/components/dynamic-fields";
import { PageHeader } from "@/components/page-header";
import { apiFetch } from "@/lib/client-api";

type CustomField = {
  id: string;
  entityType: string;
  label: string;
  fieldKey: string;
  fieldType: string;
  isRequired: boolean;
  options?: string[] | null;
  isActive: boolean;
  sortOrder: number;
};

type AppointmentFormState = {
  customerId: string;
  professionalId: string;
  startAt: string;
  endAt: string;
  status: string;
  notes: string;
  internalNotes: string;
};

function formatMoney(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

function toDateTimeInput(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function ErrorBox({ error }: { error: string }) {
  return error ? <div className="error-box">{error}</div> : null;
}

function fieldIsVisible(field: CustomField, access: AgendaAccess) {
  if (isFinancialFieldKey(field.fieldKey) && !access.canSeeFinancial) return false;
  if (isClinicalSensitiveFieldKey(field.fieldKey) && !access.canSeeClinicalSensitive) return false;
  return field.isActive;
}

function makeParams(filters: AgendaFilterValues) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  return params.toString();
}

function emptyAccess(): AgendaAccess {
  return {
    canSeeFinancial: false,
    canSeeClinicalSensitive: false,
    canUseChecklist: false,
    canManage: false,
    canChangeStatus: false
  };
}

function Input({
  label,
  value,
  onChange,
  required,
  type = "text",
  full,
  min
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  full?: boolean;
  min?: string;
}) {
  return (
    <div className={`field ${full ? "full" : ""}`}>
      <label>{label}</label>
      <input min={min} required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  required
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
  required?: boolean;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <select required={required} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Selecione</option>
        {options.map(([optionValue, label]) => (
          <option key={optionValue} value={optionValue}>{label}</option>
        ))}
      </select>
    </div>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="field full">
      <label>{label}</label>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function MultiServiceSelect({
  label,
  services,
  selectedIds,
  onChange,
  showPrices
}: {
  label: string;
  services: AnyRecord[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  showPrices: boolean;
}) {
  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((sid) => sid !== id) : [...selectedIds, id]);
  }

  return (
    <div className="field full">
      <label>{label} <span className="muted" style={{ fontWeight: 400 }}>({selectedIds.length} selecionado{selectedIds.length !== 1 ? "s" : ""})</span></label>
      <div className="multi-service-grid">
        {services.length === 0 ? (
          <span className="muted" style={{ padding: 8 }}>Nenhum servico ativo cadastrado.</span>
        ) : (
          services.map((service) => {
            const checked = selectedIds.includes(service.id);
            return (
              <div
                aria-checked={checked}
                className={`service-chip ${checked ? "selected" : ""}`}
                key={service.id}
                onClick={() => toggle(service.id)}
                onKeyDown={(event) => {
                  if (event.key === " " || event.key === "Enter") {
                    event.preventDefault();
                    toggle(service.id);
                  }
                }}
                role="checkbox"
                tabIndex={0}
              >
                <div className={`service-chip__check ${checked ? "active" : ""}`}>{checked ? <Check size={14} /> : null}</div>
                <div className="service-chip__info">
                  <strong>{service.name}</strong>
                  {service.description ? <span className="muted">{service.description}</span> : null}
                </div>
                {showPrices ? <div className="service-chip__price">{formatMoney(service.basePrice)}</div> : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function PricingSummary({
  services,
  selectedIds,
  pricing,
  onPricingChange
}: {
  services: AnyRecord[];
  selectedIds: string[];
  pricing: { partsValue: string; laborValue: string; discountPercent: string };
  onPricingChange: (pricing: { partsValue: string; laborValue: string; discountPercent: string }) => void;
}) {
  const servicesTotal = selectedIds.reduce((sum, id) => {
    const service = services.find((item) => item.id === id);
    return sum + (service?.basePrice ? Number(service.basePrice) : 0);
  }, 0);
  const parts = pricing.partsValue ? Number(pricing.partsValue) : 0;
  const labor = pricing.laborValue ? Number(pricing.laborValue) : 0;
  const discount = pricing.discountPercent ? Number(pricing.discountPercent) : 0;
  const subtotal = servicesTotal + parts + labor;
  const grandTotal = subtotal - subtotal * discount / 100;

  return (
    <div className="field full">
      <div className="price-calculator">
        <div className="price-calculator__section-title">
          <DollarSign size={14} />
          Valores
        </div>
        <div className="price-calculator__fields">
          <div className="price-calculator__field">
            <label>Valor da peca (R$)</label>
            <input min="0" step="0.01" type="number" value={pricing.partsValue} onChange={(event) => onPricingChange({ ...pricing, partsValue: event.target.value })} />
          </div>
          <div className="price-calculator__field">
            <label>Mao de obra (R$)</label>
            <input min="0" step="0.01" type="number" value={pricing.laborValue} onChange={(event) => onPricingChange({ ...pricing, laborValue: event.target.value })} />
          </div>
          <div className="price-calculator__field">
            <label>Desconto (%)</label>
            <input max="100" min="0" step="0.1" type="number" value={pricing.discountPercent} onChange={(event) => onPricingChange({ ...pricing, discountPercent: event.target.value })} />
          </div>
        </div>
        <div className="price-calculator__grand-total">
          <span>Total estimado</span>
          <strong>{formatMoney(grandTotal)}</strong>
        </div>
      </div>
    </div>
  );
}

function AppointmentForm({
  preset,
  access,
  customers,
  services,
  professionals,
  fields,
  form,
  setForm,
  selectedServiceIds,
  setSelectedServiceIds,
  customValues,
  setCustomValues,
  pricing,
  setPricing,
  submitLabel,
  onSubmit,
  saving
}: {
  preset: AgendaPreset;
  access: AgendaAccess;
  customers: AnyRecord[];
  services: AnyRecord[];
  professionals: AnyRecord[];
  fields: CustomField[];
  form: AppointmentFormState;
  setForm: (form: AppointmentFormState) => void;
  selectedServiceIds: string[];
  setSelectedServiceIds: (ids: string[]) => void;
  customValues: CustomValues;
  setCustomValues: (values: CustomValues) => void;
  pricing: { partsValue: string; laborValue: string; discountPercent: string };
  setPricing: (pricing: { partsValue: string; laborValue: string; discountPercent: string }) => void;
  submitLabel: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  saving?: boolean;
}) {
  const visibleFields = fields.filter((field) => fieldIsVisible(field, access));

  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <Select label={preset.labels.customer} value={form.customerId} onChange={(customerId) => setForm({ ...form, customerId })} required options={customers.map((item) => [item.id, item.name])} />
      <Select label={preset.labels.professional} value={form.professionalId} onChange={(professionalId) => setForm({ ...form, professionalId })} required options={professionals.map((item) => [item.id, item.name])} />
      <Select label="Status" value={form.status} onChange={(status) => setForm({ ...form, status })} options={Object.entries(statusLabels)} />
      <MultiServiceSelect label={preset.labels.service} services={services} selectedIds={selectedServiceIds} onChange={setSelectedServiceIds} showPrices={access.canSeeFinancial} />
      <Input label="Inicio" type="datetime-local" value={form.startAt} onChange={(startAt) => setForm({ ...form, startAt })} required />
      <Input label="Fim" type="datetime-local" value={form.endAt} onChange={(endAt) => setForm({ ...form, endAt })} required min={form.startAt} />
      <TextArea label="Observacoes gerais" value={form.notes} onChange={(notes) => setForm({ ...form, notes })} />
      <TextArea label="Observacoes internas" value={form.internalNotes} onChange={(internalNotes) => setForm({ ...form, internalNotes })} />
      <DynamicFields fields={visibleFields as any} values={customValues} onChange={setCustomValues} />
      {access.canSeeFinancial && preset.showFinancial ? (
        <PricingSummary services={services} selectedIds={selectedServiceIds} pricing={pricing} onPricingChange={setPricing} />
      ) : null}
      <div className="field full">
        <button className="button" disabled={saving} type="submit">
          <Save size={16} />
          {saving ? "Salvando..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

function AgendaTable({
  appointments,
  preset,
  access,
  onOpen,
  onEdit,
  onCancel
}: {
  appointments: AnyRecord[];
  preset: AgendaPreset;
  access: AgendaAccess;
  onOpen: (appointment: AnyRecord) => void;
  onEdit: (appointment: AnyRecord) => void;
  onCancel: (id: string) => void;
}) {
  const columns = preset.tableColumns.filter((column) => canRenderAgendaField(column, access));

  if (appointments.length === 0) return <div className="empty">{preset.emptyState}</div>;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => <th key={`${column.source}:${column.key}`}>{column.label}</th>)}
            <th>Acoes</th>
          </tr>
        </thead>
        <tbody>
          {appointments.map((appointment) => (
            <tr key={appointment.id}>
              {columns.map((column) => (
                <td key={`${appointment.id}:${column.source}:${column.key}`}>
                  {column.key === "status" ? (
                    <span className={`badge ${statusBadgeClass[appointment.status] ?? ""}`}>
                      {statusLabels[appointment.status] ?? appointment.status}
                    </span>
                  ) : (
                    resolveAgendaFieldValue(appointment, column) || "-"
                  )}
                </td>
              ))}
              <td>
                <div className="toolbar" style={{ gap: 6 }}>
                  <button className="icon-button secondary" title="Ver detalhes" onClick={() => onOpen(appointment)} type="button">
                    <Eye size={16} />
                  </button>
                  {access.canManage ? (
                    <button className="icon-button secondary" title="Editar" onClick={() => onEdit(appointment)} type="button">
                      <Edit2 size={16} />
                    </button>
                  ) : null}
                  {access.canManage && appointment.status !== "CANCELLED" ? (
                    <button className="icon-button secondary" title="Cancelar" onClick={() => onCancel(appointment.id)} type="button">
                      <Ban size={16} />
                    </button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type TimeOff = {
  id: string;
  professionalId: string;
  startAt: string;
  endAt: string;
  reason: string | null;
  professional: { id: string; name: string };
};

export function AgendaPage() {
  const now = new Date();
  const [appointments, setAppointments] = useState<AnyRecord[]>([]);
  const [customers, setCustomers] = useState<AnyRecord[]>([]);
  const [services, setServices] = useState<AnyRecord[]>([]);
  const [professionals, setProfessionals] = useState<AnyRecord[]>([]);
  const [timeOffs, setTimeOffs] = useState<TimeOff[]>([]);
  const [fields, setFields] = useState<CustomField[]>([]);
  const [preset, setPreset] = useState<AgendaPreset>(getAgendaPreset(null));
  const [access, setAccess] = useState<AgendaAccess>(emptyAccess());
  const [filters, setFilters] = useState<AgendaFilterValues>({});
  const [view, setView] = useState<"cards" | "table" | "week">("week");
  const [referenceDate, setReferenceDate] = useState<Date>(new Date());
  // Filtros visuais do redesenho da semana (não vão para a API; aplicados
  // client-side em cima do `appointments` já carregado).
  const [activeProfessionalIds, setActiveProfessionalIds] = useState<Set<string>>(() => new Set());
  const [selectedDate, setSelectedDate] = useState<Date>(() => startOfDayWeek(new Date()));
  const [error, setError] = useState("");
  const [selectedAppointment, setSelectedAppointment] = useState<AnyRecord | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<AnyRecord | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockForm, setBlockForm] = useState({
    professionalId: "",
    startAt: toDateTimeInput(now),
    endAt: toDateTimeInput(addHours(now, 1)),
    reason: ""
  });
  const [blockError, setBlockError] = useState("");

  const [form, setForm] = useState<AppointmentFormState>({
    customerId: "",
    professionalId: "",
    startAt: toDateTimeInput(now),
    endAt: toDateTimeInput(addHours(now, 1)),
    status: "SCHEDULED",
    notes: "",
    internalNotes: ""
  });
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [customValues, setCustomValues] = useState<CustomValues>({});
  const [pricing, setPricing] = useState({ partsValue: "", laborValue: "", discountPercent: "" });

  const [editForm, setEditForm] = useState<AppointmentFormState>({ ...form });
  const [editServiceIds, setEditServiceIds] = useState<string[]>([]);
  const [editCustomValues, setEditCustomValues] = useState<CustomValues>({});
  const [editPricing, setEditPricing] = useState({ partsValue: "", laborValue: "", discountPercent: "" });
  const [editError, setEditError] = useState("");

  const appointmentFields = fields.filter((field) => field.entityType === "APPOINTMENT");

  // ── Derivados do redesenho semanal ─────────────────────────────────────
  const weekStart = useMemo(() => startOfWeekWeek(referenceDate), [referenceDate]);

  /** Agendamentos visíveis: aplica os chips de profissional sobre o resultado da API. */
  const filteredAppointments = useMemo(() => {
    if (activeProfessionalIds.size === 0) return appointments;
    return appointments.filter((a) => activeProfessionalIds.has(a.professional?.id ?? ""));
  }, [appointments, activeProfessionalIds]);

  /** Set yyyy-mm-dd com agendamentos — usado pelos pontinhos no mini-calendário. */
  const daysWithEvents = useMemo(() => {
    const set = new Set<string>();
    for (const a of filteredAppointments) {
      const d = new Date(a.startAt);
      set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    }
    return set;
  }, [filteredAppointments]);

  function toggleProfessional(id: string) {
    setActiveProfessionalIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function goPrevWeek() {
    setReferenceDate((d) => addDaysWeek(d, -7));
  }

  function goNextWeek() {
    setReferenceDate((d) => addDaysWeek(d, 7));
  }

  function goWeekToday() {
    const today = new Date();
    setReferenceDate(today);
    setSelectedDate(startOfDayWeek(today));
  }

  function handleMiniSelectDate(date: Date) {
    setSelectedDate(startOfDayWeek(date));
    // Se o dia escolhido cair fora da semana atual, navega.
    const ws = startOfWeekWeek(date);
    if (!isSameDayWeek(ws, weekStart)) setReferenceDate(date);
  }

  async function load(nextFilters = filters) {
    setError("");
    const query = makeParams(nextFilters);

    // 7-day window around referenceDate for TimeOff fetch
    const winStart = new Date(referenceDate);
    winStart.setHours(0, 0, 0, 0);
    winStart.setDate(winStart.getDate() - 7);
    const winEnd = new Date(referenceDate);
    winEnd.setDate(winEnd.getDate() + 30);

    const [appointmentData, customerData, serviceData, professionalData, fieldData, timeOffData] = await Promise.all([
      apiFetch<{ appointments: AnyRecord[]; agenda?: { preset: AgendaPreset; access: AgendaAccess } }>(`/api/appointments${query ? `?${query}` : ""}`),
      apiFetch<{ customers: AnyRecord[] }>("/api/customers"),
      apiFetch<{ services: AnyRecord[] }>("/api/services"),
      apiFetch<{ professionals: AnyRecord[] }>("/api/professionals"),
      apiFetch<{ customFields: CustomField[] }>("/api/custom-fields"),
      apiFetch<{ timeOffs: TimeOff[] }>(`/api/professional-time-off?from=${winStart.toISOString()}&to=${winEnd.toISOString()}`).catch(() => ({ timeOffs: [] as TimeOff[] }))
    ]);

    setAppointments(appointmentData.appointments);
    setPreset(appointmentData.agenda?.preset ?? getAgendaPreset(null));
    setAccess(appointmentData.agenda?.access ?? emptyAccess());
    setCustomers(customerData.customers);
    setServices(serviceData.services.filter((service) => service.isActive));
    setProfessionals(professionalData.professionals.filter((professional) => professional.isActive));
    setFields(fieldData.customFields.filter((field) => field.isActive));
    setTimeOffs(timeOffData.timeOffs ?? []);
  }

  async function submitBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBlockError("");
    if (!blockForm.professionalId) {
      setBlockError("Selecione um profissional");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/professional-time-off", {
        method: "POST",
        body: JSON.stringify({
          professionalId: blockForm.professionalId,
          startAt: new Date(blockForm.startAt).toISOString(),
          endAt: new Date(blockForm.endAt).toISOString(),
          reason: blockForm.reason || null
        })
      });
      setShowBlockModal(false);
      setBlockForm({ professionalId: "", startAt: toDateTimeInput(new Date()), endAt: toDateTimeInput(addHours(new Date(), 1)), reason: "" });
      await load();
    } catch (err) {
      setBlockError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function removeTimeOff(id: string) {
    if (!confirm("Remover este bloqueio de horário?")) return;
    try {
      await apiFetch(`/api/professional-time-off/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function navigateDays(deltaDays: number) {
    const next = new Date(referenceDate);
    next.setDate(next.getDate() + deltaDays);
    setReferenceDate(next);
  }

  function navigateToday() {
    setReferenceDate(new Date());
  }

  function setProfessionalFilter(professionalId: string) {
    setFilters({ ...filters, professionalId });
  }

  useEffect(() => {
    load().catch((err) => setError((err as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load(filters).catch((err) => setError((err as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  function resetCreateForm() {
    setForm({
      customerId: "",
      professionalId: "",
      startAt: toDateTimeInput(new Date()),
      endAt: toDateTimeInput(addHours(new Date(), 1)),
      status: "SCHEDULED",
      notes: "",
      internalNotes: ""
    });
    setSelectedServiceIds([]);
    setCustomValues({});
    setPricing({ partsValue: "", laborValue: "", discountPercent: "" });
  }

  function payloadFromForm(state: AppointmentFormState, serviceIds: string[], values: CustomValues, price: typeof pricing) {
    const customPayload: Record<string, unknown> = {
      ...values,
      _serviceIds: serviceIds
    };

    if (access.canSeeFinancial && preset.showFinancial) {
      const parts = price.partsValue ? Number(price.partsValue) : 0;
      const labor = price.laborValue ? Number(price.laborValue) : 0;
      const discount = price.discountPercent ? Number(price.discountPercent) : 0;
      const servicesTotal = serviceIds.reduce((sum, id) => {
        const service = services.find((item) => item.id === id);
        return sum + (service?.basePrice ? Number(service.basePrice) : 0);
      }, 0);
      customPayload._servicesTotal = servicesTotal;
      customPayload._partsValue = parts;
      customPayload._laborValue = labor;
      customPayload._discountPercent = discount;
      customPayload._grandTotal = servicesTotal + parts + labor - (servicesTotal + parts + labor) * discount / 100;
    }

    return {
      ...state,
      serviceId: serviceIds[0],
      startAt: new Date(state.startAt).toISOString(),
      endAt: new Date(state.endAt).toISOString(),
      customValues: customPayload
    };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (selectedServiceIds.length === 0) {
      setError(`Selecione pelo menos um ${preset.labels.service.toLowerCase()}.`);
      return;
    }
    try {
      setSaving(true);
      await apiFetch("/api/appointments", {
        method: "POST",
        body: JSON.stringify(payloadFromForm(form, selectedServiceIds, customValues, pricing))
      });
      resetCreateForm();
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function openEdit(appointment: AnyRecord) {
    setEditingAppointment(appointment);
    setEditError("");
    setEditForm({
      customerId: appointment.customerId ?? "",
      professionalId: appointment.professionalId ?? "",
      startAt: toDateTimeInput(new Date(appointment.startAt)),
      endAt: toDateTimeInput(new Date(appointment.endAt)),
      status: appointment.status ?? "SCHEDULED",
      notes: appointment.notes ?? "",
      internalNotes: appointment.internalNotes ?? ""
    });
    const savedIds = appointment.customValues?._serviceIds;
    setEditServiceIds(Array.isArray(savedIds) && savedIds.length > 0 ? savedIds : appointment.serviceId ? [appointment.serviceId] : []);
    setEditPricing({
      partsValue: appointment.customValues?._partsValue != null ? String(appointment.customValues._partsValue) : appointment.partsValue != null ? String(appointment.partsValue) : "",
      laborValue: appointment.customValues?._laborValue != null ? String(appointment.customValues._laborValue) : appointment.laborValue != null ? String(appointment.laborValue) : "",
      discountPercent: appointment.customValues?._discountPercent != null ? String(appointment.customValues._discountPercent) : appointment.discountPercent != null ? String(appointment.discountPercent) : ""
    });
    const reservedKeys = new Set(["_serviceIds", "_servicesTotal", "_grandTotal", "_totalPrice", "_partsValue", "_laborValue", "_discountPercent"]);
    const clean: CustomValues = {};
    for (const [key, value] of Object.entries(appointment.customValues ?? {})) {
      if (!reservedKeys.has(key)) clean[key] = value as any;
    }
    setEditCustomValues(clean);
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingAppointment) return;
    if (editServiceIds.length === 0) {
      setEditError(`Selecione pelo menos um ${preset.labels.service.toLowerCase()}.`);
      return;
    }
    setEditError("");
    setSaving(true);
    try {
      await apiFetch(`/api/appointments/${editingAppointment.id}`, {
        method: "PATCH",
        body: JSON.stringify(payloadFromForm(editForm, editServiceIds, editCustomValues, editPricing))
      });
      setEditingAppointment(null);
      await load();
    } catch (err) {
      setEditError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(id: string, status: string) {
    setError("");
    await apiFetch(`/api/appointments/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
    await load();
  }

  async function cancel(id: string) {
    await changeStatus(id, "CANCELLED");
  }

  const referenceLabel = useMemo(() => {
    return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(referenceDate);
  }, [referenceDate]);

  return (
    <>
      <PageHeader
        title={preset.title}
        subtitle={`${referenceLabel} · ${appointments.length} agendamentos`}
        actions={
          <>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: 3, border: "1px solid var(--border)", borderRadius: 9, background: "var(--surface)" }}>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => navigateDays(-7)} title="Semana anterior">
                <ChevronLeft size={13} />
              </button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={navigateToday}>
                <CalendarDays size={13} /> Hoje
              </button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => navigateDays(7)} title="Próxima semana">
                <ChevronRight size={13} />
              </button>
            </div>
            <select
              className="select"
              value={filters.professionalId ?? ""}
              onChange={e => setProfessionalFilter(e.target.value)}
              style={{ width: "auto", minWidth: 180, height: 38 }}
            >
              <option value="">Todos profissionais</option>
              {professionals.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {access.canManage ? (
              <>
                <button type="button" className="btn btn-ghost" onClick={() => setShowBlockModal(true)}>
                  <Ban size={15} /> Bloquear horário
                </button>
                <button type="button" className="btn btn-primary" onClick={() => setShowCreate(v => !v)}>
                  <Plus size={15} />
                  {showCreate ? "Ocultar formulário" : preset.labels.newAppointment}
                </button>
              </>
            ) : null}
          </>
        }
      />
      <ErrorBox error={error} />

      {timeOffs.length > 0 ? (
        <section className="panel" style={{ marginBottom: 16 }}>
          <div className="panel__head">
            <div>
              <div className="panel__title">
                <Ban size={14} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px", color: "var(--danger)" }} />
                Bloqueios ativos ({timeOffs.length})
              </div>
              <div className="panel__sub">Períodos em que os profissionais não aceitam agendamento</div>
            </div>
          </div>
          <div className="panel__body" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {timeOffs.map(t => (
              <div key={t.id} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 10px", border: "1px solid var(--danger-light)", borderRadius: 999, background: "var(--danger-light)", fontSize: 12 }}>
                <strong>{t.professional.name}</strong>
                <span style={{ color: "var(--muted)" }}>
                  {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(t.startAt))}
                  {" → "}
                  {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(t.endAt))}
                </span>
                {t.reason ? <span style={{ color: "var(--danger)", fontStyle: "italic" }}>· {t.reason}</span> : null}
                {access.canManage ? (
                  <button type="button" onClick={() => removeTimeOff(t.id)} style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--danger)", padding: 0 }} title="Remover bloqueio">
                    <Trash2 size={12} />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {showCreate && access.canManage ? (
        <section className="form-panel grid" style={{ marginBottom: 16 }}>
          <h2 className="section-title">{preset.labels.newAppointment}</h2>
          <AppointmentForm
            access={access}
            customValues={customValues}
            customers={customers}
            fields={appointmentFields}
            form={form}
            onSubmit={submit}
            preset={preset}
            pricing={pricing}
            professionals={professionals}
            saving={saving}
            selectedServiceIds={selectedServiceIds}
            services={services}
            setCustomValues={setCustomValues}
            setForm={setForm}
            setPricing={setPricing}
            setSelectedServiceIds={setSelectedServiceIds}
            submitLabel={`Salvar ${preset.labels.appointment.toLowerCase()}`}
          />
        </section>
      ) : null}

      <AgendaFilters
        access={access}
        customers={customers}
        onChange={setFilters}
        onRefresh={() => load()}
        preset={preset}
        professionals={professionals}
        services={services}
        values={filters}
      />

      <section className="panel grid">
        <div className="toolbar">
          <h2 className="section-title">Visualizacao</h2>
          <div className="tabs">
            {[
              ["cards", "Cards"],
              ["table", "Tabela"],
              ["week", "Semana"]
            ].map(([value, label]) => (
              <button className={`tab ${view === value ? "active" : ""}`} key={value} onClick={() => setView(value as any)} type="button">
                {label}
              </button>
            ))}
          </div>
        </div>

        {appointments.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon"><CalendarPlus size={32} /></div>
            <h3>{preset.emptyState}</h3>
            <p>Use os filtros ou cadastre um novo {preset.labels.appointment.toLowerCase()}.</p>
          </div>
        ) : view === "cards" ? (
          <div className="grid cols-3">
            {appointments.map((appointment) => (
              <AppointmentCard appointment={appointment} access={access} key={appointment.id} onOpen={setSelectedAppointment} preset={preset} />
            ))}
          </div>
        ) : view === "table" ? (
          <AgendaTable appointments={appointments} access={access} onCancel={cancel} onEdit={openEdit} onOpen={setSelectedAppointment} preset={preset} />
        ) : (
          <>
            <WeekToolbar
              weekStart={weekStart}
              professionals={professionals}
              activeProfessionalIds={activeProfessionalIds}
              onPrev={goPrevWeek}
              onNext={goNextWeek}
              onToday={goWeekToday}
              onToggleProfessional={toggleProfessional}
            />
            <div className="ag-grid">
              <div className="ag-main">
                <WeekCalendar
                  appointments={filteredAppointments}
                  weekStart={weekStart}
                  onSelectAppointment={setSelectedAppointment}
                />
                <StatsStrip
                  appointments={filteredAppointments}
                  weekStart={weekStart}
                  professionalCount={
                    activeProfessionalIds.size > 0 ? activeProfessionalIds.size : professionals.length
                  }
                  showFinancial={access.canSeeFinancial && preset.showFinancial}
                />
              </div>
              <aside className="ag-sidebar">
                <MiniCalendar
                  selectedDate={selectedDate}
                  daysWithEvents={daysWithEvents}
                  onSelectDate={handleMiniSelectDate}
                />
                <DayList
                  appointments={filteredAppointments}
                  selectedDate={selectedDate}
                  onSelectAppointment={setSelectedAppointment}
                />
              </aside>
            </div>
          </>
        )}
      </section>

      {selectedAppointment ? (
        <AppointmentPreview
          access={access}
          appointment={selectedAppointment}
          customFields={fields}
          onClose={() => setSelectedAppointment(null)}
          onRefresh={() => load()}
          onStatusChange={changeStatus}
          preset={preset}
        />
      ) : null}

      {showBlockModal ? (
        <div className="modal-overlay" onClick={() => setShowBlockModal(false)} role="dialog" aria-modal="true">
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="preview-modal__header">
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                <Ban size={18} style={{ display: "inline", marginRight: 8, verticalAlign: "-3px", color: "var(--danger)" }} />
                Bloquear horário
              </h2>
              <button type="button" className="icon-button secondary" onClick={() => setShowBlockModal(false)} aria-label="Fechar">
                <X size={16} />
              </button>
            </div>

            <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
              O profissional não receberá agendamentos neste período. Conflito com agendamentos existentes é validado no servidor.
            </p>

            <ErrorBox error={blockError} />

            <form onSubmit={submitBlock} style={{ display: "grid", gap: 16, marginTop: 16 }}>
              <div className="field">
                <label>Profissional *</label>
                <select className="select" required value={blockForm.professionalId} onChange={e => setBlockForm({ ...blockForm, professionalId: e.target.value })}>
                  <option value="">Selecione um profissional</option>
                  {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-grid">
                <div className="field">
                  <label>Início *</label>
                  <input className="input" type="datetime-local" required value={blockForm.startAt} onChange={e => setBlockForm({ ...blockForm, startAt: e.target.value })} />
                </div>
                <div className="field">
                  <label>Fim *</label>
                  <input className="input" type="datetime-local" required min={blockForm.startAt} value={blockForm.endAt} onChange={e => setBlockForm({ ...blockForm, endAt: e.target.value })} />
                </div>
              </div>
              <div className="field">
                <label>Motivo (opcional)</label>
                <input className="input" maxLength={200} value={blockForm.reason} onChange={e => setBlockForm({ ...blockForm, reason: e.target.value })} placeholder="Ex.: Folga, Curso, Médico" />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowBlockModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  <Clock size={14} /> {saving ? "Bloqueando..." : "Bloquear horário"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editingAppointment ? (
        <div className="modal-overlay" onClick={() => setEditingAppointment(null)}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <div className="toolbar" style={{ marginBottom: 16 }}>
              <h2 className="section-title">{preset.labels.editAppointment}</h2>
              <button className="icon-button secondary" onClick={() => setEditingAppointment(null)} title="Fechar" type="button">
                <X size={16} />
              </button>
            </div>
            <ErrorBox error={editError} />
            <AppointmentForm
              access={access}
              customValues={editCustomValues}
              customers={customers}
              fields={appointmentFields}
              form={editForm}
              onSubmit={submitEdit}
              preset={preset}
              pricing={editPricing}
              professionals={professionals}
              saving={saving}
              selectedServiceIds={editServiceIds}
              services={services}
              setCustomValues={setEditCustomValues}
              setForm={setEditForm}
              setPricing={setEditPricing}
              setSelectedServiceIds={setEditServiceIds}
              submitLabel="Salvar alteracoes"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
