"use client";

import {
  Ban,
  CalendarPlus,
  Plus,
  RefreshCcw,
  Save,
  Trash2,
  UserPlus
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { DynamicFields, type CustomValues } from "@/components/dynamic-fields";
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

const entityLabels: [string, string][] = [
  ["CUSTOMER", "Clientes"],
  ["APPOINTMENT", "Agendamentos"],
  ["SERVICE", "Serviços"],
  ["PROFESSIONAL", "Profissionais"]
];

const fieldTypes: [string, string][] = [
  ["SHORT_TEXT", "Texto curto"],
  ["LONG_TEXT", "Texto longo"],
  ["NUMBER", "Número"],
  ["MONEY", "Valor monetário"],
  ["PERCENT", "Porcentagem"],
  ["DATE", "Data"],
  ["TIME", "Hora"],
  ["DATETIME", "Data e hora"],
  ["SINGLE_SELECT", "Seleção única"],
  ["MULTI_SELECT", "Seleção múltipla"],
  ["CHECKBOX", "Checkbox"],
  ["BOOLEAN", "Sim/Não"],
  ["EMAIL", "E-mail"],
  ["PHONE", "Telefone"],
  ["CPF_CNPJ", "CPF/CNPJ"],
  ["FILE", "Arquivo"]
];

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

  useEffect(() => {
    apiFetch<AnyRecord>("/api/dashboard").then(setData).catch((err) => setError(err.message));
  }, []);

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
          </>
        }
      />
      <ErrorBox error={error} />
      <div className="grid cols-3">
        <StatCard label="Agendamentos hoje" value={data?.metrics?.todayAppointments ?? "-"} />
        <StatCard label="Pendentes" value={data?.metrics?.pendingAppointments ?? "-"} />
        <StatCard label="Concluídos" value={data?.metrics?.completedAppointments ?? "-"} />
        <StatCard label="Clientes" value={data?.metrics?.customers ?? "-"} />
        <StatCard label="Serviços" value={data?.metrics?.services ?? "-"} />
        <StatCard label="Profissionais" value={data?.metrics?.professionals ?? "-"} />
      </div>
      <section className="panel grid" style={{ marginTop: 16 }}>
        <h2 className="section-title">Próximos agendamentos</h2>
        <AppointmentTable appointments={data?.nextAppointments ?? []} compact />
      </section>
    </>
  );
}

export function CustomerManager() {
  const [customers, setCustomers] = useState<AnyRecord[]>([]);
  const [fields, setFields] = useState<CustomField[]>([]);
  const [customValues, setCustomValues] = useState<CustomValues>({});
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", cpf: "", birthDate: "", notes: "" });

  async function load() {
    const [customerData, fieldData] = await Promise.all([
      apiFetch<{ customers: AnyRecord[] }>("/api/customers"),
      apiFetch<{ customFields: CustomField[] }>("/api/custom-fields?entityType=CUSTOMER")
    ]);
    setCustomers(customerData.customers);
    setFields(fieldData.customFields.filter((field) => field.isActive));
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
      setForm({ name: "", email: "", phone: "", cpf: "", birthDate: "", notes: "" });
      setCustomValues({});
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function anonymize(id: string) {
    await apiFetch(`/api/customers/${id}?mode=anonymize`, { method: "DELETE" });
    await load();
  }

  return (
    <>
      <PageHeader title="Clientes" subtitle="Clientes finais, pacientes ou consumidores" />
      <ErrorBox error={error} />
      <section className="form-panel grid">
        <h2 className="section-title">Novo cliente</h2>
        <form className="form-grid" onSubmit={submit}>
          <Input label="Nome" value={form.name} onChange={(name) => setForm({ ...form, name })} required />
          <Input label="E-mail" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} />
          <Input label="Telefone" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />
          <Input label="CPF" value={form.cpf} onChange={(cpf) => setForm({ ...form, cpf })} />
          <Input label="Nascimento" type="date" value={form.birthDate} onChange={(birthDate) => setForm({ ...form, birthDate })} />
          <TextArea label="Observações" value={form.notes} onChange={(notes) => setForm({ ...form, notes })} />
          <DynamicFields fields={fields} values={customValues} onChange={setCustomValues} />
          <div className="field full">
            <button className="button" type="submit">
              <Save size={16} />
              Salvar cliente
            </button>
          </div>
        </form>
      </section>
      <section className="table-wrap" style={{ marginTop: 16 }}>
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Contato</th>
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
                </td>
                <td>
                  {customer.email ?? "-"}
                  <br />
                  <span className="muted">{customer.phone ?? "-"}</span>
                </td>
                <td><span className="badge">{customer.status}</span></td>
                <td>{summarizeCustomValues(customer.customValues)}</td>
                <td>
                  <button className="icon-button secondary" title="Anonimizar" onClick={() => anonymize(customer.id)} type="button">
                    <Trash2 size={16} />
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

export function ServiceManager() {
  const [services, setServices] = useState<AnyRecord[]>([]);
  const [fields, setFields] = useState<CustomField[]>([]);
  const [customValues, setCustomValues] = useState<CustomValues>({});
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", description: "", basePrice: "", durationMinutes: "60" });

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

  async function deactivate(id: string) {
    await apiFetch(`/api/services/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: false })
    });
    await load();
  }

  return (
    <>
      <PageHeader title="Serviços" subtitle="Catálogo de serviços do tenant" />
      <ErrorBox error={error} />
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
                  <button className="icon-button secondary" title="Desativar" onClick={() => deactivate(service.id)} type="button">
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
  const [form, setForm] = useState({
    customerId: "",
    serviceId: "",
    professionalId: "",
    startAt: toDateTimeInput(now),
    endAt: toDateTimeInput(later),
    status: "SCHEDULED",
    notes: "",
    internalNotes: ""
  });

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

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      await apiFetch("/api/appointments", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          startAt: new Date(form.startAt).toISOString(),
          endAt: new Date(form.endAt).toISOString(),
          customValues
        })
      });
      setCustomValues({});
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function cancel(id: string) {
    await apiFetch(`/api/appointments/${id}`, { method: "DELETE" });
    await load();
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
      <section className="form-panel grid">
        <h2 className="section-title">Novo agendamento</h2>
        <form className="form-grid" onSubmit={submit}>
          <Select label="Cliente" value={form.customerId} onChange={(customerId) => setForm({ ...form, customerId })} required options={customers.map((item) => [item.id, item.name])} />
          <Select label="Serviço" value={form.serviceId} onChange={(serviceId) => setForm({ ...form, serviceId })} required options={services.map((item) => [item.id, item.name])} />
          <Select label="Profissional" value={form.professionalId} onChange={(professionalId) => setForm({ ...form, professionalId })} required options={professionals.map((item) => [item.id, item.name])} />
          <Select label="Status" value={form.status} onChange={(status) => setForm({ ...form, status })} options={Object.entries(statusLabels)} />
          <Input label="Início" type="datetime-local" value={form.startAt} onChange={(startAt) => setForm({ ...form, startAt })} required />
          <Input label="Fim" type="datetime-local" value={form.endAt} onChange={(endAt) => setForm({ ...form, endAt })} required min={form.startAt} />
          <TextArea label="Observações gerais" value={form.notes} onChange={(notes) => setForm({ ...form, notes })} />
          <TextArea label="Observações internas" value={form.internalNotes} onChange={(internalNotes) => setForm({ ...form, internalNotes })} />
          <DynamicFields fields={fields} values={customValues} onChange={setCustomValues} />
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
        {view === "list" ? <AppointmentTable appointments={appointments} onCancel={cancel} /> : <CalendarBoard view={view} appointments={appointments} />}
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

function AppointmentTable({
  appointments,
  onCancel,
  compact
}: {
  appointments: AnyRecord[];
  onCancel?: (id: string) => void;
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
            {onCancel ? <th>Ações</th> : null}
          </tr>
        </thead>
        <tbody>
          {appointments.map((appointment) => (
            <tr key={appointment.id}>
              <td>{formatDateTime(appointment.startAt)}</td>
              <td>{appointment.customer?.name ?? "-"}</td>
              <td>{appointment.service?.name ?? "-"}</td>
              <td>{appointment.professional?.name ?? "-"}</td>
              <td><span className="badge">{statusLabels[appointment.status] ?? appointment.status}</span></td>
              {!compact ? <td>{summarizeCustomValues(appointment.customValues)}</td> : null}
              {onCancel ? (
                <td>
                  <button className="icon-button secondary" title="Cancelar" onClick={() => onCancel(appointment.id)} type="button">
                    <Ban size={16} />
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

function CalendarBoard({ appointments, view }: { appointments: AnyRecord[]; view: "day" | "week" | "month" }) {
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
              <div className="appointment-chip" key={appointment.id}>
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

export function CustomFieldManager() {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    entityType: "CUSTOMER",
    label: "",
    fieldKey: "",
    fieldType: "SHORT_TEXT",
    isRequired: false,
    sortOrder: "0",
    placeholder: "",
    helpText: "",
    options: ""
  });

  async function load() {
    const data = await apiFetch<{ customFields: CustomField[] }>("/api/custom-fields");
    setFields(data.customFields);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      await apiFetch("/api/custom-fields", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          sortOrder: Number(form.sortOrder),
          options: form.options
            ? form.options.split(",").map((item) => item.trim()).filter(Boolean)
            : undefined
        })
      });
      setForm({ ...form, label: "", fieldKey: "", placeholder: "", helpText: "", options: "" });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function deactivate(id: string) {
    await apiFetch(`/api/custom-fields/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <>
      <PageHeader title="Campos personalizados" subtitle="Configuração dinâmica por entidade" />
      <ErrorBox error={error} />
      <section className="form-panel grid">
        <h2 className="section-title">Novo campo</h2>
        <form className="form-grid" onSubmit={submit}>
          <Select label="Entidade" value={form.entityType} onChange={(entityType) => setForm({ ...form, entityType })} options={entityLabels} />
          <Select label="Tipo" value={form.fieldType} onChange={(fieldType) => setForm({ ...form, fieldType })} options={fieldTypes} />
          <Input label="Nome do campo" value={form.label} onChange={(label) => setForm({ ...form, label })} required />
          <Input label="Chave interna" value={form.fieldKey} onChange={(fieldKey) => setForm({ ...form, fieldKey })} />
          <Input label="Ordem" type="number" value={form.sortOrder} onChange={(sortOrder) => setForm({ ...form, sortOrder })} />
          <Input label="Placeholder" value={form.placeholder} onChange={(placeholder) => setForm({ ...form, placeholder })} />
          <Input label="Texto de ajuda" value={form.helpText} onChange={(helpText) => setForm({ ...form, helpText })} full />
          <Input label="Opções separadas por vírgula" value={form.options} onChange={(options) => setForm({ ...form, options })} full />
          <div className="field">
            <label>Obrigatório</label>
            <div className="checkbox-line">
              <input type="checkbox" checked={form.isRequired} onChange={(event) => setForm({ ...form, isRequired: event.target.checked })} />
              <span className="muted">Sim</span>
            </div>
          </div>
          <div className="field full">
            <button className="button" type="submit">
              <Plus size={16} />
              Criar campo
            </button>
          </div>
        </form>
      </section>
      <section className="table-wrap" style={{ marginTop: 16 }}>
        <table>
          <thead>
            <tr>
              <th>Campo</th>
              <th>Entidade</th>
              <th>Tipo</th>
              <th>Obrigatório</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => (
              <tr key={field.id}>
                <td><strong>{field.label}</strong><br /><span className="muted">{field.fieldKey}</span></td>
                <td>{field.entityType}</td>
                <td>{field.fieldType}</td>
                <td>{field.isRequired ? "Sim" : "Não"}</td>
                <td><span className={`badge ${field.isActive ? "success" : "danger"}`}>{field.isActive ? "Ativo" : "Inativo"}</span></td>
                <td>
                  <button className="icon-button secondary" title="Desativar" onClick={() => deactivate(field.id)} type="button">
                    <Trash2 size={16} />
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
