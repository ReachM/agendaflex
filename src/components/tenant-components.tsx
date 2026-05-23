"use client";

import {
  Ban,
  Briefcase,
  CalendarPlus,
  Check,
  CheckCircle,
  Clock,
  DollarSign,
  Edit2,
  Eye,
  Plus,
  RefreshCcw,
  Save,
  Trash2,
  User,
  UserPlus,
  Users,
  X
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { DynamicFields, type CustomValues } from "@/components/dynamic-fields";
import { AppointmentPreviewModal, TodayAppointments } from "@/components/appointment-preview";
import { PageHeader, StatCard } from "@/components/page-header";
import { apiFetch } from "@/lib/client-api";

type AnyRecord = Record<string, any>;

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
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatMoney(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

function toDateTimeInput(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function summarizeCustomValues(values: AnyRecord | undefined) {
  if (!values || Object.keys(values).length === 0) return "-";
  return Object.entries(values)
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`)
    .join(" | ");
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
      <input
        min={min}
        required={required}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  full = true
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  full?: boolean;
}) {
  return (
    <div className={`field ${full ? "full" : ""}`}>
      <label>{label}</label>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function ErrorBox({ error }: { error: string }) {
  return error ? <div className="error-box">{error}</div> : null;
}

export function TenantDashboard() {
  const [data, setData] = useState<AnyRecord | null>(null);
  const [error, setError] = useState("");
  const [selectedAppointment, setSelectedAppointment] = useState<AnyRecord | null>(null);
  const [session, setSession] = useState<AnyRecord | null>(null);

  async function loadData() {
    setError("");
    try {
      const [dashData, sessionData] = await Promise.all([
        apiFetch<AnyRecord>("/api/dashboard"),
        apiFetch<AnyRecord>("/api/auth/me")
      ]);
      setData(dashData);
      setSession(sessionData);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => { loadData(); }, []);

  async function handleStatusChange(id: string, status: string, reason?: string) {
    await apiFetch(`/api/appointments/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status, ...(reason ? { cancellationReason: reason } : {}) })
    });
  }

  const planUsagePercent = data?.plan
    ? Math.min(100, Math.round((data.plan.usedAppointmentsThisMonth / Math.max(data.plan.maxAppointmentsPerMonth, 1)) * 100))
    : 0;
  const planBarClass = planUsagePercent > 85 ? "progress-bar__fill--danger" : planUsagePercent > 60 ? "progress-bar__fill--warning" : "";

  const topServicesMax = Math.max(...(data?.topServices ?? []).map((s: AnyRecord) => s.count), 1);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Resumo operacional da empresa"
        actions={
          <>
            <Link className="button" href="/agenda">
              <CalendarPlus size={16} />
              Agendamento
            </Link>
            <Link className="button secondary" href="/clientes">
              <Plus size={16} />
              Cliente
            </Link>
            <Link className="button secondary" href="/servicos">
              <Briefcase size={16} />
              Serviço
            </Link>
            <Link className="button secondary" href="/profissionais">
              <Users size={16} />
              Profissional
            </Link>
          </>
        }
      />
      <ErrorBox error={error} />

      {/* ─── Stat Cards ───────────────────────────────── */}
      <div className="grid cols-3">
        <div className="stat-card stat-card--info">
          <div className="stat-card__header">
            <div className="stat-card__label">Agendamentos hoje</div>
            <div className="stat-card__icon"><CalendarPlus size={18} /></div>
          </div>
          <div className="stat-card__value">{data?.metrics?.todayAppointments ?? "-"}</div>
          <div className="stat-card__footer">Total no mês: {data?.metrics?.monthlyAppointments ?? "-"}</div>
        </div>
        <div className="stat-card stat-card--warning">
          <div className="stat-card__header">
            <div className="stat-card__label">Pendentes</div>
            <div className="stat-card__icon"><Clock size={18} /></div>
          </div>
          <div className="stat-card__value">{data?.metrics?.pendingAppointments ?? "-"}</div>
          <div className="stat-card__footer">Aguardando confirmação</div>
        </div>
        <div className="stat-card stat-card--success">
          <div className="stat-card__header">
            <div className="stat-card__label">Concluídos</div>
            <div className="stat-card__icon"><CheckCircle size={18} /></div>
          </div>
          <div className="stat-card__value">{data?.metrics?.completedAppointments ?? "-"}</div>
          <div className="stat-card__footer">Confirmados: {data?.metrics?.confirmedAppointments ?? "-"}</div>
        </div>
        <div className="stat-card stat-card--danger">
          <div className="stat-card__header">
            <div className="stat-card__label">Cancelados</div>
            <div className="stat-card__icon"><Ban size={18} /></div>
          </div>
          <div className="stat-card__value">{data?.metrics?.cancelledAppointments ?? "-"}</div>
        </div>
        <div className="stat-card stat-card--purple">
          <div className="stat-card__header">
            <div className="stat-card__label">Clientes</div>
            <div className="stat-card__icon"><Users size={18} /></div>
          </div>
          <div className="stat-card__value">{data?.metrics?.customers ?? "-"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__header">
            <div className="stat-card__label">Serviços ativos</div>
            <div className="stat-card__icon"><Briefcase size={18} /></div>
          </div>
          <div className="stat-card__value">{data?.metrics?.services ?? "-"}</div>
          <div className="stat-card__footer">Profissionais: {data?.metrics?.professionals ?? "-"}</div>
        </div>
      </div>

      {/* ─── Plan Usage ───────────────────────────────── */}
      {data?.plan ? (
        <section className="panel" style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 className="section-title" style={{ margin: 0 }}>Uso do plano</h2>
            <span className={`plan-badge plan-badge--${data.plan.slug}`}>{data.plan.name}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
            <span style={{ color: "var(--text-secondary)" }}>Agendamentos no mês</span>
            <strong>{data.plan.usedAppointmentsThisMonth} / {data.plan.maxAppointmentsPerMonth}</strong>
          </div>
          <div className="progress-bar">
            <div className={`progress-bar__fill ${planBarClass}`} style={{ width: `${planUsagePercent}%` }} />
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>{planUsagePercent}% utilizado</div>
        </section>
      ) : null}

      {/* ─── Today's Appointments (NEW) ────────────────── */}
      <TodayAppointments
        appointments={data?.todayAppointmentsList ?? []}
        onStatusChange={handleStatusChange}
        onRefresh={loadData}
        role={session?.role}
        planFeatures={session?.planFeatures}
      />

      {/* ─── Next Appointments ────────────────────────── */}
      <div className="section-divider"><h2>Próximos agendamentos</h2></div>
      <section className="panel">
        <AppointmentTable
          appointments={data?.nextAppointments ?? []}
          compact
          onView={setSelectedAppointment}
        />
      </section>

      {/* ─── Enhanced Appointment Detail Modal ─────────── */}
      {selectedAppointment ? (
        <AppointmentPreviewModal
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onStatusChange={handleStatusChange}
          onRefresh={() => { loadData(); setSelectedAppointment(null); }}
          role={session?.role}
          planFeatures={session?.planFeatures}
        />
      ) : null}

      {/* ─── Bottom Grid ──────────────────────────────── */}
      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <section className="panel">
          <h2 className="section-title">Serviços mais agendados</h2>
          {(data?.topServices ?? []).length === 0 ? <div className="empty">Nenhum dado ainda.</div> : (
            <div className="hbar" style={{ marginTop: 12 }}>
              {(data?.topServices ?? []).map((svc: AnyRecord) => (
                <div key={svc.serviceId} className="hbar__item">
                  <span className="hbar__label">{svc.serviceName}</span>
                  <div className="hbar__track">
                    <div className="hbar__fill" style={{ width: `${Math.max((svc.count / topServicesMax) * 100, 8)}%` }}>{svc.count}x</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="panel">
          <h2 className="section-title">Profissionais com agenda hoje</h2>
          {(data?.todayProfessionals ?? []).length === 0 ? (
            <div className="empty-state"><div className="empty-state__icon"><Users size={24} /></div><h3>Nenhum profissional com agenda hoje</h3></div>
          ) : (
            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              {(data?.todayProfessionals ?? []).map((prof: AnyRecord) => (
                <div key={prof.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--surface)" }}>
                  <div className="avatar avatar--sm">{prof.name?.[0] ?? "?"}</div>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{prof.name}</span>
                  <span className="status-dot status-dot--active" style={{ marginLeft: "auto" }} />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

export function CustomerManager() {
  const [customers, setCustomers] = useState<AnyRecord[]>([]);
  const [fields, setFields] = useState<CustomField[]>([]);
  const [customValues, setCustomValues] = useState<CustomValues>({});
  const [error, setError] = useState("");
  const [segment, setSegment] = useState<string>("");
  const [formTab, setFormTab] = useState<"basic" | "address" | "health" | "notes">("basic");
  const [form, setForm] = useState({
    name: "", email: "", phone: "", whatsapp: "", cpf: "", rg: "",
    birthDate: "", gender: "", notes: "",
    zipCode: "", address: "", addressNumber: "", neighborhood: "", city: "", state: "", complement: "",
    healthInsurance: "", healthInsuranceNumber: "", bloodType: "", allergies: "",
    medications: "", preExistingConditions: "", requiredCare: "", clinicalNotes: "",
    emergencyContact: "", emergencyPhone: "", legalGuardian: "", legalGuardianCpf: "",
    origin: "", internalNotes: ""
  });

  // ─── Editing state ─────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ ...form });
  const [editCustomValues, setEditCustomValues] = useState<CustomValues>({});
  const [editError, setEditError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editTab, setEditTab] = useState<"basic" | "address" | "health" | "notes">("basic");

  const isHealthSegment = ["CLINICA_MEDICA", "CONSULTORIO"].includes(segment);

  function calculateAge(birthDate: string): string {
    if (!birthDate) return "";
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return `${age} anos`;
  }

  async function load() {
    const [customerData, fieldData] = await Promise.all([
      apiFetch<{ customers: AnyRecord[]; segment?: string }>("/api/customers"),
      apiFetch<{ customFields: CustomField[] }>("/api/custom-fields?entityType=CUSTOMER")
    ]);
    setCustomers(customerData.customers);
    setFields(fieldData.customFields.filter((field) => field.isActive));
    if (customerData.segment) setSegment(customerData.segment);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      await apiFetch("/api/customers", {
        method: "POST",
        body: JSON.stringify({ ...form, customValues })
      });
      setForm({
        name: "", email: "", phone: "", whatsapp: "", cpf: "", rg: "",
        birthDate: "", gender: "", notes: "",
        zipCode: "", address: "", addressNumber: "", neighborhood: "", city: "", state: "", complement: "",
        healthInsurance: "", healthInsuranceNumber: "", bloodType: "", allergies: "",
        medications: "", preExistingConditions: "", requiredCare: "", clinicalNotes: "",
        emergencyContact: "", emergencyPhone: "", legalGuardian: "", legalGuardianCpf: "",
        origin: "", internalNotes: ""
      });
      setCustomValues({});
      setFormTab("basic");
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function openEdit(customer: AnyRecord) {
    setEditingId(customer.id);
    setEditError("");
    setEditTab("basic");
    setEditForm({
      name: customer.name ?? "",
      email: customer.email ?? "",
      phone: customer.phone ?? "",
      whatsapp: customer.whatsapp ?? "",
      cpf: customer.cpf ?? "",
      rg: customer.rg ?? "",
      birthDate: customer.birthDate ? customer.birthDate.slice(0, 10) : "",
      gender: customer.gender ?? "",
      notes: customer.notes ?? "",
      zipCode: customer.zipCode ?? "",
      address: customer.address ?? "",
      addressNumber: customer.addressNumber ?? "",
      neighborhood: customer.neighborhood ?? "",
      city: customer.city ?? "",
      state: customer.state ?? "",
      complement: customer.complement ?? "",
      healthInsurance: customer.healthInsurance ?? "",
      healthInsuranceNumber: customer.healthInsuranceNumber ?? "",
      bloodType: customer.bloodType ?? "",
      allergies: customer.allergies ?? "",
      medications: customer.medications ?? "",
      preExistingConditions: customer.preExistingConditions ?? "",
      requiredCare: customer.requiredCare ?? "",
      clinicalNotes: customer.clinicalNotes ?? "",
      emergencyContact: customer.emergencyContact ?? "",
      emergencyPhone: customer.emergencyPhone ?? "",
      legalGuardian: customer.legalGuardian ?? "",
      legalGuardianCpf: customer.legalGuardianCpf ?? "",
      origin: customer.origin ?? "",
      internalNotes: customer.internalNotes ?? ""
    });
    const cv: CustomValues = {};
    if (customer.customValues && typeof customer.customValues === "object") {
      for (const [key, value] of Object.entries(customer.customValues)) {
        cv[key] = value as any;
      }
    }
    setEditCustomValues(cv);
  }

  function closeEdit() {
    setEditingId(null);
    setEditError("");
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;
    setEditError("");
    setSaving(true);
    try {
      await apiFetch(`/api/customers/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify({ ...editForm, customValues: editCustomValues })
      });
      closeEdit();
      await load();
    } catch (err) {
      setEditError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function anonymize(id: string) {
    await apiFetch(`/api/customers/${id}?mode=anonymize`, { method: "DELETE" });
    await load();
  }

  const tabs: { key: string; label: string }[] = [
    { key: "basic", label: "Dados básicos" },
    { key: "address", label: "Endereço" },
    ...(isHealthSegment ? [{ key: "health", label: "🩺 Saúde" }] : []),
    { key: "notes", label: "Observações" }
  ];

  function renderFormFields(f: typeof form, setter: (v: typeof form) => void, currentTab: string) {
    switch (currentTab) {
      case "basic":
        return (
          <>
            <Input label="Nome completo *" value={f.name} onChange={(name) => setter({ ...f, name })} required />
            <Input label="E-mail" type="email" value={f.email} onChange={(email) => setter({ ...f, email })} />
            <Input label="Telefone" value={f.phone} onChange={(phone) => setter({ ...f, phone })} />
            <Input label="WhatsApp" value={f.whatsapp} onChange={(whatsapp) => setter({ ...f, whatsapp })} />
            <Input label="CPF" value={f.cpf} onChange={(cpf) => setter({ ...f, cpf })} />
            <Input label="RG" value={f.rg} onChange={(rg) => setter({ ...f, rg })} />
            <Input label="Data de nascimento" type="date" value={f.birthDate} onChange={(birthDate) => setter({ ...f, birthDate })} />
            {f.birthDate && <div className="field"><label>Idade</label><input readOnly value={calculateAge(f.birthDate)} tabIndex={-1} style={{ background: "var(--surface-alt)" }} /></div>}
            <div className="field">
              <label>Sexo</label>
              <select value={f.gender} onChange={(e) => setter({ ...f, gender: e.target.value })}>
                <option value="">Selecione</option>
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
                <option value="O">Outro</option>
              </select>
            </div>
            <div className="field">
              <label>Origem</label>
              <select value={f.origin} onChange={(e) => setter({ ...f, origin: e.target.value })}>
                <option value="">Selecione</option>
                <option value="INDICACAO">Indicação</option>
                <option value="INSTAGRAM">Instagram</option>
                <option value="GOOGLE">Google</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="PRESENCIAL">Presencial</option>
                <option value="OUTRO">Outro</option>
              </select>
            </div>
          </>
        );
      case "address":
        return (
          <>
            <Input label="CEP" value={f.zipCode} onChange={(zipCode) => setter({ ...f, zipCode })} />
            <Input label="Endereço" value={f.address} onChange={(address) => setter({ ...f, address })} />
            <Input label="Número" value={f.addressNumber} onChange={(addressNumber) => setter({ ...f, addressNumber })} />
            <Input label="Bairro" value={f.neighborhood} onChange={(neighborhood) => setter({ ...f, neighborhood })} />
            <Input label="Cidade" value={f.city} onChange={(city) => setter({ ...f, city })} />
            <Input label="Estado" value={f.state} onChange={(state) => setter({ ...f, state })} />
            <Input label="Complemento" value={f.complement} onChange={(complement) => setter({ ...f, complement })} />
          </>
        );
      case "health":
        return (
          <>
            <div className="field full" style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#fef3c7", color: "#92400e", borderRadius: "var(--radius)", fontSize: 13 }}>
                🔒 Dados protegidos pela LGPD — acesso restrito.
              </div>
            </div>
            <Input label="Convênio" value={f.healthInsurance} onChange={(healthInsurance) => setter({ ...f, healthInsurance })} />
            <Input label="Nº Carteirinha" value={f.healthInsuranceNumber} onChange={(healthInsuranceNumber) => setter({ ...f, healthInsuranceNumber })} />
            <div className="field">
              <label>Tipo sanguíneo</label>
              <select value={f.bloodType} onChange={(e) => setter({ ...f, bloodType: e.target.value })}>
                <option value="">Selecione</option>
                {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <TextArea label="Alergias" value={f.allergies} onChange={(allergies) => setter({ ...f, allergies })} />
            <TextArea label="Medicamentos em uso" value={f.medications} onChange={(medications) => setter({ ...f, medications })} />
            <TextArea label="Condições pré-existentes" value={f.preExistingConditions} onChange={(preExistingConditions) => setter({ ...f, preExistingConditions })} />
            <TextArea label="Cuidados necessários" value={f.requiredCare} onChange={(requiredCare) => setter({ ...f, requiredCare })} />
            <Input label="Contato de emergência" value={f.emergencyContact} onChange={(emergencyContact) => setter({ ...f, emergencyContact })} />
            <Input label="Telefone de emergência" value={f.emergencyPhone} onChange={(emergencyPhone) => setter({ ...f, emergencyPhone })} />
            <Input label="Responsável legal" value={f.legalGuardian} onChange={(legalGuardian) => setter({ ...f, legalGuardian })} />
            <Input label="CPF do responsável" value={f.legalGuardianCpf} onChange={(legalGuardianCpf) => setter({ ...f, legalGuardianCpf })} />
          </>
        );
      case "notes":
        return (
          <>
            <TextArea label="Observações gerais" value={f.notes} onChange={(notes) => setter({ ...f, notes })} />
            {isHealthSegment && <TextArea label="Observações clínicas" value={f.clinicalNotes} onChange={(clinicalNotes) => setter({ ...f, clinicalNotes })} />}
            <TextArea label="Observações internas" value={f.internalNotes} onChange={(internalNotes) => setter({ ...f, internalNotes })} />
          </>
        );
      default: return null;
    }
  }

  return (
    <>
      <PageHeader title={isHealthSegment ? "Pacientes" : "Clientes"} subtitle={isHealthSegment ? "Cadastro de pacientes da clínica" : "Clientes finais, pacientes ou consumidores"} />
      <ErrorBox error={error} />

      {/* ─── Edit Modal ───────────────────────────────────── */}
      {editingId ? (
        <div className="modal-overlay" onClick={closeEdit}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700 }}>
            <div className="toolbar" style={{ marginBottom: 16 }}>
              <h2 className="section-title">Editar {isHealthSegment ? "paciente" : "cliente"}</h2>
              <button className="icon-button secondary" onClick={closeEdit} type="button" title="Fechar">
                <X size={16} />
              </button>
            </div>
            <ErrorBox error={editError} />
            <div className="tabs" style={{ marginBottom: 16 }}>
              {tabs.map((tab) => (
                <button key={tab.key} className={`tab ${editTab === tab.key ? "active" : ""}`} type="button" onClick={() => setEditTab(tab.key as any)}>
                  {tab.label}
                </button>
              ))}
            </div>
            <form className="form-grid" onSubmit={submitEdit}>
              {renderFormFields(editForm, setEditForm, editTab)}
              {editTab === "notes" && <DynamicFields fields={fields} values={editCustomValues} onChange={setEditCustomValues} />}
              <div className="field full" style={{ display: "flex", gap: 12 }}>
                <button className="button" type="submit" disabled={saving}>
                  <Save size={16} />
                  {saving ? "Salvando..." : "Salvar alterações"}
                </button>
                <button className="button secondary" type="button" onClick={closeEdit}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <section className="form-panel grid">
        <h2 className="section-title">Novo {isHealthSegment ? "paciente" : "cliente"}</h2>
        <div className="tabs" style={{ marginBottom: 12 }}>
          {tabs.map((tab) => (
            <button key={tab.key} className={`tab ${formTab === tab.key ? "active" : ""}`} type="button" onClick={() => setFormTab(tab.key as any)}>
              {tab.label}
            </button>
          ))}
        </div>
        <form className="form-grid" onSubmit={submit}>
          {renderFormFields(form, setForm, formTab)}
          {formTab === "notes" && <DynamicFields fields={fields} values={customValues} onChange={setCustomValues} />}
          <div className="field full">
            <button className="button" type="submit">
              <Save size={16} />
              Salvar {isHealthSegment ? "paciente" : "cliente"}
            </button>
          </div>
        </form>
      </section>
      <section className="table-wrap" style={{ marginTop: 16 }}>
        <table>
          <thead>
            <tr>
              <th>{isHealthSegment ? "Paciente" : "Cliente"}</th>
              <th>Contato</th>
              {isHealthSegment && <th>Convênio</th>}
              <th>Status</th>
              <th>Campos</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td>
                  <strong>{customer.name}</strong>
                  <br />
                  <span className="muted">{customer.cpf ?? "-"}</span>
                  {customer.birthDate && <><br /><span className="muted" style={{ fontSize: 12 }}>{calculateAge(customer.birthDate.slice(0, 10))}</span></>}
                </td>
                <td>
                  {customer.email ?? "-"}
                  <br />
                  <span className="muted">{customer.phone ?? "-"}</span>
                </td>
                {isHealthSegment && <td><span className="muted">{customer.healthInsurance ?? "-"}</span></td>}
                <td><span className={`badge ${customer.status === "active" ? "status-active" : "status-inactive"}`}>{customer.status === "active" ? "Ativo" : customer.status}</span></td>
                <td>{summarizeCustomValues(customer.customValues)}</td>
                <td>
                  <div className="toolbar" style={{ gap: 6 }}>
                    <button className="icon-button secondary" title="Editar" onClick={() => openEdit(customer)} type="button">
                      <Edit2 size={16} />
                    </button>
                    <button className="icon-button secondary" title="Anonimizar" onClick={() => anonymize(customer.id)} type="button">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

export function ServiceManager() {
  const [services, setServices] = useState<AnyRecord[]>([]);
  const [fields, setFields] = useState<CustomField[]>([]);
  const [customValues, setCustomValues] = useState<CustomValues>({});
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", description: "", basePrice: "", durationMinutes: "60" });

  // ─── Editing state ─────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "", basePrice: "", durationMinutes: "60" });
  const [editCustomValues, setEditCustomValues] = useState<CustomValues>({});
  const [editError, setEditError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const [serviceData, fieldData] = await Promise.all([
      apiFetch<{ services: AnyRecord[] }>("/api/services"),
      apiFetch<{ customFields: CustomField[] }>("/api/custom-fields?entityType=SERVICE")
    ]);
    setServices(serviceData.services);
    setFields(fieldData.customFields.filter((field) => field.isActive));
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      await apiFetch("/api/services", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          basePrice: form.basePrice ? Number(form.basePrice) : undefined,
          durationMinutes: Number(form.durationMinutes),
          customValues
        })
      });
      setForm({ name: "", description: "", basePrice: "", durationMinutes: "60" });
      setCustomValues({});
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function openEdit(service: AnyRecord) {
    setEditingId(service.id);
    setEditError("");
    setEditForm({
      name: service.name ?? "",
      description: service.description ?? "",
      basePrice: service.basePrice != null ? String(service.basePrice) : "",
      durationMinutes: service.durationMinutes != null ? String(service.durationMinutes) : "60"
    });
    const cv: CustomValues = {};
    if (service.customValues && typeof service.customValues === "object") {
      for (const [key, value] of Object.entries(service.customValues)) {
        cv[key] = value as any;
      }
    }
    setEditCustomValues(cv);
  }

  function closeEdit() {
    setEditingId(null);
    setEditError("");
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;
    setEditError("");
    setSaving(true);
    try {
      await apiFetch(`/api/services/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...editForm,
          basePrice: editForm.basePrice ? Number(editForm.basePrice) : undefined,
          durationMinutes: Number(editForm.durationMinutes),
          customValues: editCustomValues
        })
      });
      closeEdit();
      await load();
    } catch (err) {
      setEditError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(id: string, active: boolean) {
    await apiFetch(`/api/services/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: active })
    });
    await load();
  }

  return (
    <>
      <PageHeader title="Serviços" subtitle="Catálogo de serviços do tenant" />
      <ErrorBox error={error} />

      {/* ─── Edit Modal ───────────────────────────────────── */}
      {editingId ? (
        <div className="modal-overlay" onClick={closeEdit}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="toolbar" style={{ marginBottom: 16 }}>
              <h2 className="section-title">Editar serviço</h2>
              <button className="icon-button secondary" onClick={closeEdit} type="button" title="Fechar">
                <X size={16} />
              </button>
            </div>
            <ErrorBox error={editError} />
            <form className="form-grid" onSubmit={submitEdit}>
              <Input label="Nome" value={editForm.name} onChange={(name) => setEditForm({ ...editForm, name })} required />
              <Input label="Valor base" type="number" value={editForm.basePrice} onChange={(basePrice) => setEditForm({ ...editForm, basePrice })} />
              <Input label="Duração em minutos" type="number" value={editForm.durationMinutes} onChange={(durationMinutes) => setEditForm({ ...editForm, durationMinutes })} required />
              <TextArea label="Descrição" value={editForm.description} onChange={(description) => setEditForm({ ...editForm, description })} />
              <DynamicFields fields={fields} values={editCustomValues} onChange={setEditCustomValues} />
              <div className="field full" style={{ display: "flex", gap: 12 }}>
                <button className="button" type="submit" disabled={saving}>
                  <Save size={16} />
                  {saving ? "Salvando..." : "Salvar alterações"}
                </button>
                <button className="button secondary" type="button" onClick={closeEdit}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <section className="form-panel grid">
        <h2 className="section-title">Novo serviço</h2>
        <form className="form-grid" onSubmit={submit}>
          <Input label="Nome" value={form.name} onChange={(name) => setForm({ ...form, name })} required />
          <Input label="Valor base" type="number" value={form.basePrice} onChange={(basePrice) => setForm({ ...form, basePrice })} />
          <Input label="Duração em minutos" type="number" value={form.durationMinutes} onChange={(durationMinutes) => setForm({ ...form, durationMinutes })} required />
          <TextArea label="Descrição" value={form.description} onChange={(description) => setForm({ ...form, description })} />
          <DynamicFields fields={fields} values={customValues} onChange={setCustomValues} />
          <div className="field full">
            <button className="button" type="submit">
              <Save size={16} />
              Salvar serviço
            </button>
          </div>
        </form>
      </section>
      <section className="table-wrap" style={{ marginTop: 16 }}>
        <table>
          <thead>
            <tr>
              <th>Serviço</th>
              <th>Valor</th>
              <th>Duração</th>
              <th>Status</th>
              <th>Campos</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {services.map((service) => (
              <tr key={service.id}>
                <td><strong>{service.name}</strong><br /><span className="muted">{service.description ?? "-"}</span></td>
                <td>{formatMoney(service.basePrice)}</td>
                <td>{service.durationMinutes} min</td>
                <td><span className={`badge ${service.isActive ? "success" : "danger"}`}>{service.isActive ? "Ativo" : "Inativo"}</span></td>
                <td>{summarizeCustomValues(service.customValues)}</td>
                <td>
                  <div className="toolbar" style={{ gap: 6 }}>
                    <button className="icon-button secondary" title="Editar" onClick={() => openEdit(service)} type="button">
                      <Edit2 size={16} />
                    </button>
                    {service.isActive ? (
                      <button className="icon-button secondary" title="Desativar" onClick={() => toggleActive(service.id, false)} type="button">
                        <Ban size={16} />
                      </button>
                    ) : (
                      <button className="icon-button" title="Ativar" onClick={() => toggleActive(service.id, true)} type="button" style={{ background: 'linear-gradient(135deg, var(--success) 0%, #15803d 100%)' }}>
                        <CheckCircle size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

export function ProfessionalManager() {
  const [professionals, setProfessionals] = useState<AnyRecord[]>([]);
  const [fields, setFields] = useState<CustomField[]>([]);
  const [customValues, setCustomValues] = useState<CustomValues>({});
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", specialty: "" });

  async function load() {
    const [professionalData, fieldData] = await Promise.all([
      apiFetch<{ professionals: AnyRecord[] }>("/api/professionals"),
      apiFetch<{ customFields: CustomField[] }>("/api/custom-fields?entityType=PROFESSIONAL")
    ]);
    setProfessionals(professionalData.professionals);
    setFields(fieldData.customFields.filter((field) => field.isActive));
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      await apiFetch("/api/professionals", {
        method: "POST",
        body: JSON.stringify({ ...form, customValues })
      });
      setForm({ name: "", email: "", phone: "", specialty: "" });
      setCustomValues({});
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function deactivate(id: string) {
    await apiFetch(`/api/professionals/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: false })
    });
    await load();
  }

  return (
    <>
      <PageHeader title="Profissionais" subtitle="Equipe vinculada à agenda" />
      <ErrorBox error={error} />
      <section className="form-panel grid">
        <h2 className="section-title">Novo profissional</h2>
        <form className="form-grid" onSubmit={submit}>
          <Input label="Nome" value={form.name} onChange={(name) => setForm({ ...form, name })} required />
          <Input label="E-mail" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} />
          <Input label="Telefone" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />
          <Input label="Especialidade/cargo" value={form.specialty} onChange={(specialty) => setForm({ ...form, specialty })} />
          <DynamicFields fields={fields} values={customValues} onChange={setCustomValues} />
          <div className="field full">
            <button className="button" type="submit">
              <Save size={16} />
              Salvar profissional
            </button>
          </div>
        </form>
      </section>
      <section className="table-wrap" style={{ marginTop: 16 }}>
        <table>
          <thead>
            <tr>
              <th>Profissional</th>
              <th>Contato</th>
              <th>Status</th>
              <th>Campos</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {professionals.map((professional) => (
              <tr key={professional.id}>
                <td><strong>{professional.name}</strong><br /><span className="muted">{professional.specialty ?? "-"}</span></td>
                <td>{professional.email ?? "-"}<br /><span className="muted">{professional.phone ?? "-"}</span></td>
                <td><span className={`badge ${professional.isActive ? "success" : "danger"}`}>{professional.isActive ? "Ativo" : "Inativo"}</span></td>
                <td>{summarizeCustomValues(professional.customValues)}</td>
                <td>
                  <button className="icon-button secondary" title="Desativar" onClick={() => deactivate(professional.id)} type="button">
                    <Ban size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

export function AppointmentManager() {
  const now = new Date();
  const later = new Date(now.getTime() + 60 * 60 * 1000);
  const [appointments, setAppointments] = useState<AnyRecord[]>([]);
  const [customers, setCustomers] = useState<AnyRecord[]>([]);
  const [services, setServices] = useState<AnyRecord[]>([]);
  const [professionals, setProfessionals] = useState<AnyRecord[]>([]);
  const [fields, setFields] = useState<CustomField[]>([]);
  const [customValues, setCustomValues] = useState<CustomValues>({});
  const [view, setView] = useState<"list" | "day" | "week" | "month">("week");
  const [error, setError] = useState("");
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [pricing, setPricing] = useState({ partsValue: "", laborValue: "", discountPercent: "" });

  const [form, setForm] = useState({
    customerId: "",
    professionalId: "",
    startAt: toDateTimeInput(now),
    endAt: toDateTimeInput(later),
    status: "SCHEDULED",
    notes: "",
    internalNotes: ""
  });

  const selectedServicesTotal = useMemo(() => {
    return selectedServiceIds.reduce((sum, id) => {
      const svc = services.find((s) => s.id === id);
      return sum + (svc?.basePrice ? Number(svc.basePrice) : 0);
    }, 0);
  }, [selectedServiceIds, services]);

  const selectedServiceNames = useMemo(() => {
    return selectedServiceIds.map((id) => services.find((s) => s.id === id)?.name).filter(Boolean).join(", ");
  }, [selectedServiceIds, services]);

  // ─── Editing state ─────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSelectedServiceIds, setEditSelectedServiceIds] = useState<string[]>([]);
  const [editPricing, setEditPricing] = useState({ partsValue: "", laborValue: "", discountPercent: "" });

  const [editForm, setEditForm] = useState({
    customerId: "",
    professionalId: "",
    startAt: "",
    endAt: "",
    status: "SCHEDULED",
    notes: "",
    internalNotes: ""
  });
  const [editCustomValues, setEditCustomValues] = useState<CustomValues>({});
  const [editError, setEditError] = useState("");

  const editServicesTotal = useMemo(() => {
    return editSelectedServiceIds.reduce((sum, id) => {
      const svc = services.find((s) => s.id === id);
      return sum + (svc?.basePrice ? Number(svc.basePrice) : 0);
    }, 0);
  }, [editSelectedServiceIds, services]);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [appointmentData, customerData, serviceData, professionalData, fieldData] = await Promise.all([
      apiFetch<{ appointments: AnyRecord[] }>("/api/appointments"),
      apiFetch<{ customers: AnyRecord[] }>("/api/customers"),
      apiFetch<{ services: AnyRecord[] }>("/api/services"),
      apiFetch<{ professionals: AnyRecord[] }>("/api/professionals"),
      apiFetch<{ customFields: CustomField[] }>("/api/custom-fields?entityType=APPOINTMENT")
    ]);
    setAppointments(appointmentData.appointments);
    setCustomers(customerData.customers);
    setServices(serviceData.services.filter((service) => service.isActive));
    setProfessionals(professionalData.professionals.filter((professional) => professional.isActive));
    setFields(fieldData.customFields.filter((field) => field.isActive));
  }

  // Filter out old pricing custom fields — now handled by PricingCalculator
  const pricingFieldKeys = new Set(["valor_da_peca", "valor_da_mao_de_obra", "desconto_em_porcentagem", "valor_total"]);
  const filteredFields = useMemo(() => fields.filter((f) => !pricingFieldKeys.has(f.fieldKey)), [fields]);

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (selectedServiceIds.length === 0) {
      setError("Selecione pelo menos um serviço.");
      return;
    }
    try {
      // TODO [MVP-FUTURE] Reativar pricing financeiro na v2
      await apiFetch("/api/appointments", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          serviceId: selectedServiceIds[0],
          startAt: new Date(form.startAt).toISOString(),
          endAt: new Date(form.endAt).toISOString(),
          customValues: {
            ...customValues,
            _serviceIds: selectedServiceIds,
            _servicesTotal: selectedServicesTotal
          }
        })
      });
      setCustomValues({});
      setSelectedServiceIds([]);
      setPricing({ partsValue: "", laborValue: "", discountPercent: "" });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function cancel(id: string) {
    await apiFetch(`/api/appointments/${id}`, { method: "DELETE" });
    await load();
  }

  function openEdit(appointment: AnyRecord) {
    setEditingId(appointment.id);
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
    // Restore multi-service selection
    const savedIds = appointment.customValues?._serviceIds;
    if (Array.isArray(savedIds) && savedIds.length > 0) {
      setEditSelectedServiceIds(savedIds);
    } else {
      setEditSelectedServiceIds(appointment.serviceId ? [appointment.serviceId] : []);
    }
    // Restore pricing fields
    const cv_pricing = appointment.customValues ?? {};
    setEditPricing({
      partsValue: cv_pricing._partsValue != null ? String(cv_pricing._partsValue) : "",
      laborValue: cv_pricing._laborValue != null ? String(cv_pricing._laborValue) : "",
      discountPercent: cv_pricing._discountPercent != null ? String(cv_pricing._discountPercent) : ""
    });
    // Load existing custom values
    const reservedKeys = new Set(["_serviceIds", "_servicesTotal", "_grandTotal", "_totalPrice", "_partsValue", "_laborValue", "_discountPercent"]);
    const cv: CustomValues = {};
    if (appointment.customValues && typeof appointment.customValues === "object") {
      for (const [key, value] of Object.entries(appointment.customValues)) {
        if (!reservedKeys.has(key)) {
          cv[key] = value as any;
        }
      }
    }
    setEditCustomValues(cv);
  }

  function closeEdit() {
    setEditingId(null);
    setEditError("");
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;
    if (editSelectedServiceIds.length === 0) {
      setEditError("Selecione pelo menos um serviço.");
      return;
    }
    setEditError("");
    setSaving(true);
    try {
      // TODO [MVP-FUTURE] Reativar pricing financeiro na v2
      await apiFetch(`/api/appointments/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...editForm,
          serviceId: editSelectedServiceIds[0],
          startAt: new Date(editForm.startAt).toISOString(),
          endAt: new Date(editForm.endAt).toISOString(),
          customValues: {
            ...editCustomValues,
            _serviceIds: editSelectedServiceIds,
            _servicesTotal: editServicesTotal
          }
        })
      });
      closeEdit();
      await load();
    } catch (err) {
      setEditError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(id: string, status: string) {
    setError("");
    try {
      await apiFetch(`/api/appointments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        title="Agenda"
        subtitle="Calendário e controle dos atendimentos"
        actions={
          <button className="button secondary" onClick={() => load()} type="button">
            <RefreshCcw size={16} />
            Atualizar
          </button>
        }
      />
      <ErrorBox error={error} />

      {/* ─── Edit Modal ───────────────────────────────────── */}
      {editingId ? (
        <div className="modal-overlay" onClick={closeEdit}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="toolbar" style={{ marginBottom: 16 }}>
              <h2 className="section-title">Editar agendamento</h2>
              <button className="icon-button secondary" onClick={closeEdit} type="button" title="Fechar">
                <X size={16} />
              </button>
            </div>
            <ErrorBox error={editError} />
            <form className="form-grid" onSubmit={submitEdit}>
              <Select label="Cliente" value={editForm.customerId} onChange={(customerId) => setEditForm({ ...editForm, customerId })} required options={customers.map((item) => [item.id, item.name])} />
              <Select label="Profissional" value={editForm.professionalId} onChange={(professionalId) => setEditForm({ ...editForm, professionalId })} required options={professionals.map((item) => [item.id, item.name])} />
              <Select label="Status" value={editForm.status} onChange={(status) => setEditForm({ ...editForm, status })} options={Object.entries(statusLabels)} />
              <MultiServiceSelect services={services} selectedIds={editSelectedServiceIds} onChange={setEditSelectedServiceIds} />
              <Input label="Início" type="datetime-local" value={editForm.startAt} onChange={(startAt) => setEditForm({ ...editForm, startAt })} required />
              <Input label="Fim" type="datetime-local" value={editForm.endAt} onChange={(endAt) => setEditForm({ ...editForm, endAt })} required min={editForm.startAt} />
              <TextArea label="Observações gerais" value={editForm.notes} onChange={(notes) => setEditForm({ ...editForm, notes })} />
              <TextArea label="Observações internas" value={editForm.internalNotes} onChange={(internalNotes) => setEditForm({ ...editForm, internalNotes })} />
              <DynamicFields fields={filteredFields} values={editCustomValues} onChange={setEditCustomValues} />
              {/* TODO [MVP-FUTURE] Reativar calculadora financeira na v2 */}
              {/* <PricingSummary services={services} selectedIds={editSelectedServiceIds} servicesTotal={editServicesTotal} pricing={editPricing} onPricingChange={setEditPricing} /> */}
              <div className="field full" style={{ display: "flex", gap: 12 }}>
                <button className="button" type="submit" disabled={saving}>
                  <Save size={16} />
                  {saving ? "Salvando..." : "Salvar alterações"}
                </button>
                <button className="button secondary" type="button" onClick={closeEdit}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <section className="form-panel grid">
        <h2 className="section-title">Novo agendamento</h2>
        <form className="form-grid" onSubmit={submit}>
          <Select label="Cliente" value={form.customerId} onChange={(customerId) => setForm({ ...form, customerId })} required options={customers.map((item) => [item.id, item.name])} />
          <Select label="Profissional" value={form.professionalId} onChange={(professionalId) => setForm({ ...form, professionalId })} required options={professionals.map((item) => [item.id, item.name])} />
          <Select label="Status" value={form.status} onChange={(status) => setForm({ ...form, status })} options={Object.entries(statusLabels)} />
          <MultiServiceSelect services={services} selectedIds={selectedServiceIds} onChange={setSelectedServiceIds} />
          <Input label="Início" type="datetime-local" value={form.startAt} onChange={(startAt) => setForm({ ...form, startAt })} required />
          <Input label="Fim" type="datetime-local" value={form.endAt} onChange={(endAt) => setForm({ ...form, endAt })} required min={form.startAt} />
          <TextArea label="Observações gerais" value={form.notes} onChange={(notes) => setForm({ ...form, notes })} />
          <TextArea label="Observações internas" value={form.internalNotes} onChange={(internalNotes) => setForm({ ...form, internalNotes })} />
          <DynamicFields fields={filteredFields} values={customValues} onChange={setCustomValues} />
          {/* TODO [MVP-FUTURE] Reativar calculadora financeira na v2 */}
          {/* <PricingSummary services={services} selectedIds={selectedServiceIds} servicesTotal={selectedServicesTotal} pricing={pricing} onPricingChange={setPricing} /> */}
          <div className="field full">
            <button className="button" type="submit">
              <CalendarPlus size={16} />
              Salvar agendamento
            </button>
          </div>
        </form>
      </section>

      <section className="panel grid" style={{ marginTop: 16 }}>
        <div className="toolbar">
          <h2 className="section-title">Visualização</h2>
          <div className="tabs">
            {[
              ["list", "Lista"],
              ["day", "Dia"],
              ["week", "Semana"],
              ["month", "Mês"]
            ].map(([value, label]) => (
              <button className={`tab ${view === value ? "active" : ""}`} key={value} onClick={() => setView(value as any)} type="button">
                {label}
              </button>
            ))}
          </div>
        </div>
        {view === "list" ? (
          <AppointmentTable appointments={appointments} onCancel={cancel} onEdit={openEdit} onStatusChange={changeStatus} />
        ) : (
          <CalendarBoard view={view} appointments={appointments} onEdit={openEdit} />
        )}
      </section>
    </>
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
      <select value={value} onChange={(event) => onChange(event.target.value)} required={required}>
        <option value="">Selecionar</option>
        {options.map(([optionValue, label]) => (
          <option key={optionValue} value={optionValue}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}

function MultiServiceSelect({
  services,
  selectedIds,
  onChange
}: {
  services: AnyRecord[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((sid) => sid !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  return (
    <div className="field full">
      <label>Serviços <span className="muted" style={{ fontWeight: 400 }}>({selectedIds.length} selecionado{selectedIds.length !== 1 ? "s" : ""})</span></label>
      <div className="multi-service-grid">
        {services.length === 0 ? (
          <span className="muted" style={{ padding: 8 }}>Nenhum serviço ativo cadastrado.</span>
        ) : (
          services.map((svc) => {
            const checked = selectedIds.includes(svc.id);
            return (
              <div
                key={svc.id}
                className={`service-chip ${checked ? "selected" : ""}`}
                onClick={() => toggle(svc.id)}
                role="checkbox"
                aria-checked={checked}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(svc.id); } }}
              >
                <div className={`service-chip__check ${checked ? "active" : ""}`}>
                  {checked ? <Check size={14} /> : null}
                </div>
                <div className="service-chip__info">
                  <strong>{svc.name}</strong>
                  {svc.description ? <span className="muted">{svc.description}</span> : null}
                </div>
                <div className="service-chip__price">
                  {svc.basePrice != null ? formatMoney(svc.basePrice) : "-"}
                </div>
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
  servicesTotal,
  pricing,
  onPricingChange
}: {
  services: AnyRecord[];
  selectedIds: string[];
  servicesTotal: number;
  pricing: { partsValue: string; laborValue: string; discountPercent: string };
  onPricingChange: (p: { partsValue: string; laborValue: string; discountPercent: string }) => void;
}) {
  const parts = pricing.partsValue ? Number(pricing.partsValue) : 0;
  const labor = pricing.laborValue ? Number(pricing.laborValue) : 0;
  const discount = pricing.discountPercent ? Number(pricing.discountPercent) : 0;
  const subtotal = servicesTotal + parts + labor;
  const discountValue = subtotal * discount / 100;
  const grandTotal = subtotal - discountValue;

  return (
    <div className="field full">
      <div className="price-calculator">
        {/* Serviços selecionados */}
        {selectedIds.length > 0 ? (
          <div className="price-calculator__section">
            <div className="price-calculator__section-title">
              <DollarSign size={14} />
              Serviços selecionados
            </div>
            {selectedIds.map((id) => {
              const svc = services.find((s) => s.id === id);
              if (!svc) return null;
              return (
                <div key={id} className="price-calculator__row">
                  <span>{svc.name}</span>
                  <span>{svc.basePrice != null ? formatMoney(svc.basePrice) : "-"}</span>
                </div>
              );
            })}
            <div className="price-calculator__row subtotal">
              <span>Subtotal serviços</span>
              <strong>{formatMoney(servicesTotal)}</strong>
            </div>
          </div>
        ) : null}

        {/* Campos editáveis */}
        <div className="price-calculator__fields">
          <div className="price-calculator__field">
            <label>Valor da Peça (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={pricing.partsValue}
              onChange={(e) => onPricingChange({ ...pricing, partsValue: e.target.value })}
            />
          </div>
          <div className="price-calculator__field">
            <label>Mão de Obra (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={pricing.laborValue}
              onChange={(e) => onPricingChange({ ...pricing, laborValue: e.target.value })}
            />
          </div>
          <div className="price-calculator__field">
            <label>Desconto (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              placeholder="0"
              value={pricing.discountPercent}
              onChange={(e) => onPricingChange({ ...pricing, discountPercent: e.target.value })}
            />
          </div>
        </div>

        {/* Totais */}
        <div className="price-calculator__totals">
          <div className="price-calculator__row">
            <span>Serviços</span>
            <span>{formatMoney(servicesTotal)}</span>
          </div>
          {parts > 0 ? (
            <div className="price-calculator__row">
              <span>Peças</span>
              <span>{formatMoney(parts)}</span>
            </div>
          ) : null}
          {labor > 0 ? (
            <div className="price-calculator__row">
              <span>Mão de obra</span>
              <span>{formatMoney(labor)}</span>
            </div>
          ) : null}
          {discount > 0 ? (
            <div className="price-calculator__row discount">
              <span>Desconto ({discount}%)</span>
              <span>- {formatMoney(discountValue)}</span>
            </div>
          ) : null}
          <div className="price-calculator__grand-total">
            <span>Valor Total</span>
            <strong>{formatMoney(grandTotal)}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}



function AppointmentTable({
  appointments,
  onCancel,
  onEdit,
  onStatusChange,
  onView,
  compact
}: {
  appointments: AnyRecord[];
  onCancel?: (id: string) => void;
  onEdit?: (appointment: AnyRecord) => void;
  onStatusChange?: (id: string, status: string) => void;
  onView?: (appointment: AnyRecord) => void;
  compact?: boolean;
}) {
  if (!appointments.length) return <div className="empty">Sem agendamentos.</div>;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Quando</th>
            <th>Cliente</th>
            <th>Serviço</th>
            <th>Profissional</th>
            <th>Status</th>
            {!compact ? <th>Campos</th> : null}
            {(onCancel || onEdit) ? <th>Ações</th> : null}
            {onView && compact ? <th></th> : null}
          </tr>
        </thead>
        <tbody>
          {appointments.map((appointment) => (
            <tr
              key={appointment.id}
              className={onView ? "clickable-row" : ""}
              onClick={onView ? () => onView(appointment) : undefined}
              style={onView ? { cursor: "pointer" } : undefined}
            >
              <td>{formatDateTime(appointment.startAt)}</td>
              <td>{appointment.customer?.name ?? "-"}</td>
              <td>{appointment.service?.name ?? "-"}</td>
              <td>{appointment.professional?.name ?? "-"}</td>
              <td>
                {onStatusChange ? (
                  <select
                    className="badge-select"
                    value={appointment.status}
                    onChange={(e) => {
                      e.stopPropagation();
                      onStatusChange(appointment.id, e.target.value);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                ) : (
                  <span className={`badge ${statusBadgeClass[appointment.status] ?? ""}`}>{statusLabels[appointment.status] ?? appointment.status}</span>
                )}
              </td>
              {!compact ? <td>{summarizeCustomValues(appointment.customValues)}</td> : null}
              {(onCancel || onEdit) ? (
                <td>
                  <div className="toolbar" style={{ gap: 6 }}>
                    {onEdit ? (
                      <button className="icon-button secondary" title="Editar" onClick={(e) => { e.stopPropagation(); onEdit(appointment); }} type="button">
                        <Edit2 size={16} />
                      </button>
                    ) : null}
                    {onCancel && appointment.status !== "CANCELLED" ? (
                      <button className="icon-button secondary" title="Cancelar" onClick={(e) => { e.stopPropagation(); onCancel(appointment.id); }} type="button">
                        <Ban size={16} />
                      </button>
                    ) : null}
                  </div>
                </td>
              ) : null}
              {onView && compact ? (
                <td>
                  <button
                    className="icon-button secondary"
                    title="Ver detalhes"
                    onClick={(e) => { e.stopPropagation(); onView(appointment); }}
                    type="button"
                  >
                    <Eye size={16} />
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CalendarBoard({ appointments, view, onEdit }: { appointments: AnyRecord[]; view: "day" | "week" | "month"; onEdit?: (appointment: AnyRecord) => void }) {
  const days = useMemo(() => {
    const count = view === "day" ? 1 : view === "week" ? 7 : 28;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: count }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [view]);

  return (
    <div className="calendar-board">
      {days.map((day) => {
        const nextDay = new Date(day);
        nextDay.setDate(day.getDate() + 1);
        const items = appointments.filter((appointment) => {
          const start = new Date(appointment.startAt);
          return start >= day && start < nextDay;
        });
        return (
          <div className="calendar-day" key={day.toISOString()}>
            <strong>{new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).format(day)}</strong>
            {items.map((appointment) => (
              <div
                className="appointment-chip clickable"
                key={appointment.id}
                onClick={() => onEdit?.(appointment)}
                title="Clique para editar"
                role="button"
                tabIndex={0}
              >
                <span>{new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(appointment.startAt))}</span>
                <strong>{appointment.customer?.name ?? "-"}</strong>
                <span>{appointment.professional?.name ?? "-"}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}



export function UserManager() {
  const [users, setUsers] = useState<AnyRecord[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "Admin@123456",
    roleName: "STAFF"
  });

  async function load() {
    const data = await apiFetch<{ users: AnyRecord[] }>("/api/users");
    setUsers(data.users);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      await apiFetch("/api/users", {
        method: "POST",
        body: JSON.stringify(form)
      });
      setForm({ name: "", email: "", password: "Admin@123456", roleName: "STAFF" });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <>
      <PageHeader title="Usuários" subtitle="Equipe interna e perfis de acesso" />
      <ErrorBox error={error} />
      <section className="form-panel grid">
        <h2 className="section-title">Novo usuário</h2>
        <form className="form-grid" onSubmit={submit}>
          <Input label="Nome" value={form.name} onChange={(name) => setForm({ ...form, name })} required />
          <Input label="E-mail" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} required />
          <Input label="Senha" value={form.password} onChange={(password) => setForm({ ...form, password })} required />
          <Select
            label="Perfil"
            value={form.roleName}
            onChange={(roleName) => setForm({ ...form, roleName })}
            options={[
              ["COMPANY_ADMIN", "Administrador"],
              ["MANAGER", "Gerente"],
              ["STAFF", "Atendente/Profissional"],
              ["USER", "Usuário comum"]
            ]}
          />
          <div className="field full">
            <button className="button" type="submit">
              <UserPlus size={16} />
              Criar usuário
            </button>
          </div>
        </form>
      </section>
      <section className="table-wrap" style={{ marginTop: 16 }}>
        <table>
          <thead>
            <tr>
              <th>Usuário</th>
              <th>Perfil</th>
              <th>Status</th>
              <th>Criado em</th>
            </tr>
          </thead>
          <tbody>
            {users.map((membership) => (
              <tr key={membership.id}>
                <td><strong>{membership.user.name}</strong><br /><span className="muted">{membership.user.email}</span></td>
                <td>{membership.role.name}</td>
                <td><span className={`badge ${membership.status === "ACTIVE" ? "success" : "danger"}`}>{membership.status}</span></td>
                <td>{formatDateTime(membership.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

export function LogViewer() {
  const [logs, setLogs] = useState<AnyRecord[]>([]);
  const [error, setError] = useState("");

  async function load() {
    const data = await apiFetch<{ logs: AnyRecord[] }>("/api/audit-logs");
    setLogs(data.logs);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  return (
    <>
      <PageHeader
        title="Logs"
        subtitle="Auditoria de ações relevantes"
        actions={
          <button className="button secondary" onClick={() => load()} type="button">
            <RefreshCcw size={16} />
            Atualizar
          </button>
        }
      />
      <ErrorBox error={error} />
      <section className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Quando</th>
              <th>Ação</th>
              <th>Entidade</th>
              <th>Empresa</th>
              <th>Usuário</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{formatDateTime(log.createdAt)}</td>
                <td>{log.action}</td>
                <td>{log.entityType}</td>
                <td>{log.company?.name ?? "-"}</td>
                <td>{log.user?.email ?? "-"}</td>
                <td>{log.ipAddress ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

export function ReportsView() {
  const [data, setData] = useState<AnyRecord | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<AnyRecord>("/api/dashboard").then(setData).catch((err) => setError(err.message));
  }, []);

  return (
    <>
      <PageHeader title="Relatórios" subtitle="Indicadores simples do tenant" />
      <ErrorBox error={error} />
      <div className="grid cols-3">
        <StatCard label="Clientes ativos" value={data?.metrics?.customers ?? "-"} />
        <StatCard label="Serviços ativos" value={data?.metrics?.services ?? "-"} />
        <StatCard label="Profissionais ativos" value={data?.metrics?.professionals ?? "-"} />
        <StatCard label="Agendamentos hoje" value={data?.metrics?.todayAppointments ?? "-"} />
        <StatCard label="Pendentes" value={data?.metrics?.pendingAppointments ?? "-"} />
        <StatCard label="Concluídos" value={data?.metrics?.completedAppointments ?? "-"} />
      </div>
    </>
  );
}

export function SettingsView() {
  const [session, setSession] = useState<AnyRecord | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<AnyRecord>("/api/auth/me").then(setSession).catch((err) => setError(err.message));
  }, []);

  return (
    <>
      <PageHeader title="Configurações" subtitle="Dados gerais da empresa" />
      <ErrorBox error={error} />
      <section className="panel grid">
        <h2 className="section-title">{session?.company?.name ?? "Empresa"}</h2>
        <div className="grid cols-3">
          <StatCard label="Status" value={session?.company?.status ?? "-"} />
          <StatCard label="Segmento" value={session?.company?.segment ?? "-"} />
          <StatCard label="Plano" value={session?.company?.plan ?? "-"} />
        </div>
      </section>
    </>
  );
}

export function BookingSettingsManager() {
  const [settings, setSettings] = useState<AnyRecord | null>(null);
  const [services, setServices] = useState<AnyRecord[]>([]);
  const [professionals, setProfessionals] = useState<AnyRecord[]>([]);
  const [company, setCompany] = useState<AnyRecord | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [copied, setCopied] = useState(false);
  const [session, setSession] = useState<AnyRecord | null>(null);

  async function load() {
    setError("");
    try {
      const [data, sessionData] = await Promise.all([
        apiFetch<AnyRecord>("/api/booking-settings"),
        apiFetch<AnyRecord>("/api/auth/me")
      ]);
      setSettings(data.settings);
      setServices(data.services);
      setProfessionals(data.professionals);
      setCompany(data.company);
      setSession(sessionData);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => { load(); }, []);

  const planSlug = session?.company?.plan ?? company?.plan ?? "starter";
  const isStarter = planSlug === "starter";
  const publicLink = settings?.publicSlug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/agendar/${settings.publicSlug}`
    : "";

  async function save(updates: AnyRecord) {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await apiFetch<AnyRecord>("/api/booking-settings", {
        method: "PATCH",
        body: JSON.stringify(updates)
      });
      setSettings(res.settings);
      setSuccess("Configurações salvas com sucesso!");
      setTimeout(() => setSuccess(""), 3000);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function copyLink() {
    if (publicLink) {
      navigator.clipboard.writeText(publicLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (isStarter) {
    return (
      <>
        <PageHeader title="Link de Agenda" subtitle="Agendamento online para clientes" />
        <section className="panel" style={{ textAlign: "center", padding: "60px 32px" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg, #818cf8, #6366f1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <CalendarPlus size={28} color="#fff" />
          </div>
          <h2 style={{ marginBottom: 8 }}>Agendamento online</h2>
          <p style={{ color: "var(--muted)", marginBottom: 24, maxWidth: 440, margin: "0 auto 24px" }}>
            Crie um link público para seus clientes agendarem online. Disponível nos planos Pro e Max.
          </p>
          <div style={{ padding: "12px 20px", background: "var(--surface-alt)", borderRadius: "var(--radius)", display: "inline-block", fontSize: 14, color: "var(--warning)" }}>
            ⚡ Faça upgrade para o plano Pro ou Max para liberar essa funcionalidade.
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Link de Agenda" subtitle="Configure o agendamento online da sua empresa" />
      <ErrorBox error={error} />
      {success && <div className="success-box" style={{ padding: "12px 16px", background: "#dcfce7", color: "#166534", borderRadius: "var(--radius)", marginBottom: 16, fontSize: 14 }}>{success}</div>}

      {/* Status & Link Card */}
      <section className="panel" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: settings?.enabled ? "#22c55e" : "#ef4444" }} />
            <span style={{ fontWeight: 600 }}>
              Agendamento online {settings?.enabled ? "ativo" : "inativo"}
            </span>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={settings?.enabled ?? false}
              onChange={(e) => save({ enabled: e.target.checked })}
              style={{ width: 18, height: 18 }}
            />
            {settings?.enabled ? "Desativar" : "Ativar"}
          </label>
        </div>

        {settings?.enabled && (
          <div style={{ background: "var(--surface-alt)", padding: "14px 16px", borderRadius: "var(--radius)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <input
              type="text"
              readOnly
              value={publicLink}
              style={{ flex: 1, minWidth: 200, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "8px 12px", fontSize: 13 }}
            />
            <button className="button" type="button" onClick={copyLink} style={{ minWidth: 120 }}>
              {copied ? "✓ Copiado!" : "Copiar link"}
            </button>
            <a className="button secondary" href={publicLink} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
              Abrir ↗
            </a>
          </div>
        )}
      </section>

      {/* Configuration Grid */}
      <div className="grid cols-2" style={{ gap: 16 }}>
        {/* Slug Configuration */}
        <section className="panel">
          <h2 className="section-title">Link personalizado</h2>
          <div className="form-grid">
            <div className="field full">
              <label>Slug da empresa</label>
              <input
                type="text"
                value={settings?.publicSlug ?? ""}
                onChange={(e) => setSettings({ ...settings, publicSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                placeholder="sua-empresa"
              />
              <small style={{ color: "var(--muted)", marginTop: 4, display: "block" }}>
                URL: /agendar/{settings?.publicSlug ?? "sua-empresa"}
              </small>
            </div>
            <div className="field full">
              <button className="button" type="button" onClick={() => save({ publicSlug: settings?.publicSlug })} disabled={saving}>
                <Save size={16} /> Salvar slug
              </button>
            </div>
          </div>
        </section>

        {/* Approval Settings */}
        <section className="panel">
          <h2 className="section-title">Aprovação</h2>
          <div className="form-grid">
            <div className="field full">
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={settings?.requireManualApproval ?? false}
                  onChange={(e) => save({ requireManualApproval: e.target.checked })}
                  style={{ width: 18, height: 18 }}
                />
                Exigir aprovação manual
              </label>
              <small style={{ color: "var(--muted)", marginTop: 4, display: "block" }}>
                {settings?.requireManualApproval
                  ? "Novos agendamentos ficam como pendentes até aprovação."
                  : "Agendamentos são confirmados automaticamente."}
              </small>
            </div>
            <div className="field full">
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={settings?.allowChooseProfessional ?? true}
                  onChange={(e) => save({ allowChooseProfessional: e.target.checked })}
                  style={{ width: 18, height: 18 }}
                />
                Cliente pode escolher o profissional
              </label>
            </div>
            <div className="field full">
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={settings?.sendEmailNotifications ?? true}
                  onChange={(e) => save({ sendEmailNotifications: e.target.checked })}
                  style={{ width: 18, height: 18 }}
                />
                Enviar notificações por e-mail
              </label>
            </div>
          </div>
        </section>
      </div>

      {/* Scheduling Rules */}
      <section className="panel" style={{ marginTop: 16 }}>
        <h2 className="section-title">Regras de horários</h2>
        <div className="form-grid">
          <div className="field">
            <label>Intervalo entre horários (minutos)</label>
            <select
              value={settings?.slotIntervalMinutes ?? 30}
              onChange={(e) => save({ slotIntervalMinutes: Number(e.target.value) })}
            >
              <option value={15}>15 minutos</option>
              <option value={20}>20 minutos</option>
              <option value={30}>30 minutos</option>
              <option value={45}>45 minutos</option>
              <option value={60}>60 minutos</option>
            </select>
          </div>
          <div className="field">
            <label>Antecedência mínima (horas)</label>
            <input
              type="number"
              min={0}
              max={72}
              value={settings?.minNoticeHours ?? 1}
              onChange={(e) => save({ minNoticeHours: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label>Limite de dias futuros</label>
            <input
              type="number"
              min={1}
              max={365}
              value={settings?.maxDaysAhead ?? 30}
              onChange={(e) => save({ maxDaysAhead: Number(e.target.value) })}
            />
          </div>
        </div>
      </section>

      {/* Services & Professionals */}
      <div className="grid cols-2" style={{ marginTop: 16, gap: 16 }}>
        <section className="panel">
          <h2 className="section-title">Serviços no agendamento online</h2>
          {services.length === 0 ? (
            <div className="empty">Nenhum serviço cadastrado.</div>
          ) : (
            <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
              {services.map((svc) => (
                <label key={svc.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", background: svc.isPublic ? "var(--surface-alt)" : "var(--surface)" }}>
                  <input
                    type="checkbox"
                    checked={svc.isPublic}
                    onChange={(e) => {
                      const updated = services.map(s => s.id === svc.id ? { ...s, isPublic: e.target.checked } : s);
                      setServices(updated);
                      save({ publicServiceIds: updated.filter(s => s.isPublic).map(s => s.id) });
                    }}
                    style={{ width: 16, height: 16 }}
                  />
                  <span style={{ fontWeight: 500 }}>{svc.name}</span>
                  {svc.basePrice && <span style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 13 }}>R$ {Number(svc.basePrice).toFixed(2)}</span>}
                </label>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <h2 className="section-title">Profissionais no agendamento online</h2>
          {professionals.length === 0 ? (
            <div className="empty">Nenhum profissional cadastrado.</div>
          ) : (
            <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
              {professionals.map((prof) => (
                <label key={prof.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", background: prof.isPublic ? "var(--surface-alt)" : "var(--surface)" }}>
                  <input
                    type="checkbox"
                    checked={prof.isPublic}
                    onChange={(e) => {
                      const updated = professionals.map(p => p.id === prof.id ? { ...p, isPublic: e.target.checked } : p);
                      setProfessionals(updated);
                      save({ publicProfessionalIds: updated.filter(p => p.isPublic).map(p => p.id) });
                    }}
                    style={{ width: 16, height: 16 }}
                  />
                  <span style={{ fontWeight: 500 }}>{prof.name}</span>
                  {prof.specialty && <span style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 13 }}>{prof.specialty}</span>}
                </label>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Instructions */}
      <section className="panel" style={{ marginTop: 16 }}>
        <h2 className="section-title">Mensagens</h2>
        <div className="form-grid">
          <div className="field full">
            <label>Instruções para o cliente</label>
            <textarea
              value={settings?.instructions ?? ""}
              onChange={(e) => setSettings({ ...settings, instructions: e.target.value })}
              placeholder="Ex: Chegue 10 minutos antes do horário agendado."
              rows={3}
            />
          </div>
          <div className="field full">
            <label>Mensagem de confirmação</label>
            <textarea
              value={settings?.confirmationMessage ?? ""}
              onChange={(e) => setSettings({ ...settings, confirmationMessage: e.target.value })}
              placeholder="Ex: Agendamento confirmado! Entraremos em contato se necessário."
              rows={3}
            />
          </div>
          <div className="field full">
            <button className="button" type="button" onClick={() => save({ instructions: settings?.instructions, confirmationMessage: settings?.confirmationMessage })} disabled={saving}>
              <Save size={16} /> Salvar mensagens
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
