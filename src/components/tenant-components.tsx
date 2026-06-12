"use client";

import {
  Ban,
  Calendar,
  CalendarPlus,
  Check,
  Clock,
  Download,
  Edit2,
  Eye,
  Mail,
  MessageCircle,
  MoreVertical,
  Package,
  Palette,
  Pencil,
  Phone,
  Plus,
  RefreshCcw,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Upload,
  Users,
  UserPlus,
  X
} from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
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

export { TenantDashboard } from "@/components/tenant-dashboard";


const AVATAR_COLORS = [
  "#0d9488", "#2563eb", "#d97706", "#9333ea",
  "#dc2626", "#16a34a", "#0891b2", "#c2410c"
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (const c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";
}

function formatMoneyCompact(value: number): string {
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(1).replace(".", ",")}k`;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatMonthYear(value: string): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(value));
}

function formatTenure(createdAt: string): string {
  if (!createdAt) return "";
  const diff = Date.now() - new Date(createdAt).getTime();
  const months = Math.floor(diff / (30 * 24 * 60 * 60 * 1000));
  if (months < 1) return "novo";
  if (months < 12) return `há ${months} ${months === 1 ? "mês" : "meses"}`;
  const years = Math.floor(months / 12);
  return `há ${years} ${years === 1 ? "ano" : "anos"}`;
}

function formatBirthDate(value: string): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
}

function CustomerTag({ tag }: { tag: string | null }) {
  if (!tag || tag === "REGULAR") return null;
  const map: Record<string, { cls: string; label: string }> = {
    VIP:       { cls: "cl-tag--vip",       label: "⭐ VIP" },
    NEW:       { cls: "cl-tag--new",       label: "Novo" },
    RECURRING: { cls: "cl-tag--recurring", label: "Recorrente" },
    INACTIVE:  { cls: "cl-tag--inactive",  label: "Inativo" }
  };
  const entry = map[tag];
  if (!entry) return null;
  return <span className={`cl-tag ${entry.cls}`}>{entry.label}</span>;
}

const PAGE_SIZE = 20;

export function CustomerManager() {
  const [customers, setCustomers] = useState<AnyRecord[]>([]);
  const [metrics, setMetrics] = useState<{ total: number; vipCount: number; newCount: number; newThisMonth: number; inactiveCount: number; avgTicket: number; totalSpent: number } | null>(null);
  const [tagFilter, setTagFilter] = useState<"all" | "VIP" | "NEW" | "INACTIVE">("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
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

  // Import/Export CSV
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    errors: number;
    message: string;
    errorDetails: string[];
  } | null>(null);

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
    const params = new URLSearchParams();
    if (tagFilter !== "all") params.set("tag", tagFilter);
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    const [customerData, fieldData] = await Promise.all([
      apiFetch<{ customers: AnyRecord[]; segment?: string; metrics?: typeof metrics }>(`/api/customers?${params}`),
      apiFetch<{ customFields: CustomField[] }>("/api/custom-fields?entityType=CUSTOMER")
    ]);
    setCustomers(customerData.customers);
    setFields(fieldData.customFields.filter((field) => field.isActive));
    if (customerData.segment) setSegment(customerData.segment);
    if (customerData.metrics) setMetrics(customerData.metrics);
  }

  // Debounce de busca (300ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset paginacao quando filtro ou busca mudam
  useEffect(() => {
    setPage(1);
  }, [tagFilter, debouncedSearch]);

  useEffect(() => {
    load().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagFilter, debouncedSearch]);

  function formatMoney(value: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  }

  function formatLastVisit(value: string | null) {
    if (!value) return "Nunca";
    const diff = Date.now() - new Date(value).getTime();
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    if (days === 0) return "Hoje";
    if (days === 1) return "Ontem";
    if (days < 30) return `${days}d atrás`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} mês${months > 1 ? "es" : ""}`;
    return `${Math.floor(days / 365)}+ anos`;
  }

  // Lista paginada client-side (API retorna ate 200)
  const totalPages = Math.max(1, Math.ceil(customers.length / PAGE_SIZE));
  const pagedCustomers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return customers.slice(start, start + PAGE_SIZE);
  }, [customers, page]);

  const visiblePages = useMemo(() => {
    const pages: number[] = [];
    const maxLeft = Math.max(1, page - 1);
    const maxRight = Math.min(totalPages, page + 1);
    for (let p = maxLeft; p <= maxRight; p++) pages.push(p);
    if (!pages.includes(1)) pages.unshift(1);
    return [...new Set(pages)];
  }, [page, totalPages]);

  const selectedCustomer = useMemo(
    () => customers.find(c => c.id === selectedId) ?? null,
    [customers, selectedId]
  );

  // Esc fecha o painel de detalhe (relevante no drawer mobile)
  useEffect(() => {
    if (!selectedId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSelectedId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  const from = customers.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, customers.length);

  function handleWhatsApp(phone: string) {
    const digits = (phone ?? "").replace(/\D/g, "");
    if (!digits) return;
    const num = digits.startsWith("55") ? digits : `55${digits}`;
    window.open(`https://wa.me/${num}`, "_blank", "noopener");
  }

  async function exportCustomers() {
    setExporting(true);
    try {
      const res = await fetch("/api/customers/export");
      if (!res.ok) {
        alert("Erro ao exportar.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `clientes-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Erro ao exportar.");
    } finally {
      setExporting(false);
    }
  }

  function openImport() {
    setImportResult(null);
    setShowImport(true);
  }

  async function handleImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      alert("Apenas arquivos .csv são aceitos.");
      e.target.value = "";
      return;
    }

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/customers/import", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error ?? "Erro ao importar.");
        return;
      }

      setImportResult(data);
      await load(); // recarrega a lista de clientes
    } catch {
      alert("Erro ao processar arquivo.");
    } finally {
      setImporting(false);
      e.target.value = ""; // permite reenviar o mesmo arquivo
    }
  }

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
            {f.birthDate && <div className="field"><label>Idade</label><input readOnly value={calculateAge(f.birthDate)} tabIndex={-1} style={{ background: "var(--surface-muted)" }} /></div>}
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

  const entityLabel = isHealthSegment ? "paciente" : "cliente";
  const entityLabelPlural = isHealthSegment ? "pacientes" : "clientes";

  return (
    <>
      <PageHeader
        title={isHealthSegment ? "Pacientes" : "Clientes"}
        subtitle={
          metrics
            ? `${metrics.total} cadastros · ${metrics.newThisMonth} novos no mês · ${metrics.total - metrics.inactiveCount} ativos`
            : "Carregando…"
        }
        actions={
          <>
            <button type="button" className="btn btn-ghost" onClick={exportCustomers} disabled={exporting}>
              <Download size={15} />
              {exporting ? "Exportando..." : "Exportar CSV"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={openImport}>
              <Upload size={15} />
              Importar CSV
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setShowForm(s => !s)}>
              <Plus size={15} />
              {showForm ? "Fechar formulário" : `Novo ${entityLabel}`}
            </button>
          </>
        }
      />
      <ErrorBox error={error} />

      {/* ─── Stats Strip ─────────────────────────────────── */}
      {metrics ? (
        <section className="cl-stats">
          <div className="cl-stat">
            <div className="cl-stat__ico"><Users size={18} /></div>
            <div>
              <div className="cl-stat__v">{metrics.total}</div>
              <div className="cl-stat__l">Total de {entityLabelPlural}</div>
            </div>
          </div>
          <div className="cl-stat cl-stat--info">
            <div className="cl-stat__ico"><UserPlus size={18} /></div>
            <div>
              <div className="cl-stat__v">{metrics.newThisMonth}</div>
              <div className="cl-stat__l">Novos este mês</div>
            </div>
          </div>
          <div className="cl-stat cl-stat--accent">
            <div className="cl-stat__ico"><Star size={18} /></div>
            <div>
              <div className="cl-stat__v">{metrics.vipCount}</div>
              <div className="cl-stat__l">VIP (≥ 5 visitas ou R$ 1k)</div>
            </div>
          </div>
          <div className="cl-stat cl-stat--purple">
            <div className="cl-stat__ico"><Package size={18} /></div>
            <div>
              <div className="cl-stat__v">{formatMoney(metrics.avgTicket)}</div>
              <div className="cl-stat__l">Ticket médio</div>
            </div>
          </div>
        </section>
      ) : null}

      {/* ─── Formulário de criação inline ────────────────── */}
      {showForm ? (
        <section className="form-panel grid" style={{ marginBottom: 20 }}>
          <h2 className="section-title">Novo {entityLabel}</h2>
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
            <div className="field full" style={{ display: "flex", gap: 10 }}>
              <button className="button" type="submit">
                <Save size={16} />
                Salvar {entityLabel}
              </button>
              <button type="button" className="button secondary" onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </form>
        </section>
      ) : null}

      {/* ─── Grid principal: lista + detalhe ─────────────── */}
      <div className="cl-grid">
        {/* Painel lista */}
        <div className="cl-list-panel">
          {/* Filter bar */}
          <div className="cl-filterbar">
            <div className="cl-search">
              <Search size={15} />
              <input
                type="search"
                placeholder={`Buscar por nome, telefone, ${isHealthSegment ? "CPF" : "e-mail ou CPF"}…`}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {([
              { key: "all",      label: "Todos",    count: metrics?.total ?? 0 },
              { key: "VIP",      label: "VIP",      count: metrics?.vipCount ?? 0 },
              { key: "NEW",      label: "Novos",    count: metrics?.newCount ?? 0 },
              { key: "INACTIVE", label: "Inativos", count: metrics?.inactiveCount ?? 0 }
            ] as const).map(chip => (
              <button
                key={chip.key}
                type="button"
                className={`cl-chip${tagFilter === chip.key ? " is-on" : ""}`}
                onClick={() => setTagFilter(chip.key)}
              >
                {chip.label}
                <span className="count">{chip.count}</span>
              </button>
            ))}
            <button type="button" className="cl-chip" onClick={() => alert("Filtros avançados em breve.") }>
              <SlidersHorizontal size={13} />
              Filtros
            </button>
          </div>

          {/* Tabela */}
          {customers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon"><UserPlus size={24} /></div>
              <h3>Nenhum {entityLabel} encontrado</h3>
              <p>Ajuste o filtro ou cadastre um novo registro.</p>
            </div>
          ) : (
            <>
              <table className="cl-table">
                <thead>
                  <tr>
                    <th>{isHealthSegment ? "Paciente" : "Cliente"}</th>
                    <th>Última visita</th>
                    <th>Visitas</th>
                    <th>Total gasto</th>
                    <th>Tag</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pagedCustomers.map((customer) => {
                    const name = customer.name as string;
                    const stats = customer.stats ?? { visitCount: 0, totalSpent: 0, lastVisit: null };
                    const isSelected = selectedId === customer.id;
                    return (
                      <tr
                        key={customer.id}
                        className={isSelected ? "is-selected" : ""}
                        onClick={() => setSelectedId(customer.id)}
                      >
                        <td>
                          <div className="cl-name">
                            <span
                              className="cl-avatar cl-avatar--md"
                              style={{ background: getAvatarColor(name) }}
                            >
                              {getInitials(name)}
                            </span>
                            <div>
                              <div className="nm">{name}</div>
                              <div className="meta">{customer.phone ?? customer.whatsapp ?? "—"}</div>
                            </div>
                          </div>
                        </td>
                        <td className="cl-num">{formatLastVisit(stats.lastVisit)}</td>
                        <td className="cl-num">{stats.visitCount}</td>
                        <td className="cl-money">{formatMoney(stats.totalSpent)}</td>
                        <td><CustomerTag tag={customer.tag ?? null} /></td>
                        <td>
                          <div className="cl-actions">
                            {(customer.phone || customer.whatsapp) ? (
                              <button
                                type="button"
                                className="cl-rowbtn cl-rowbtn--wa"
                                title="WhatsApp"
                                onClick={e => { e.stopPropagation(); handleWhatsApp(customer.whatsapp ?? customer.phone); }}
                              >
                                <MessageCircle size={14} />
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="cl-rowbtn"
                              title="Editar"
                              onClick={e => { e.stopPropagation(); openEdit(customer); }}
                            >
                              <MoreVertical size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Paginação */}
              {customers.length > PAGE_SIZE ? (
                <div className="cl-pagination">
                  <span>Mostrando {from}–{to} de {customers.length}</span>
                  <div className="cl-pagination__pages">
                    <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
                    {visiblePages.map(p => (
                      <button
                        key={p}
                        type="button"
                        className={page === p ? "is-active" : ""}
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </button>
                    ))}
                    {!visiblePages.includes(totalPages) ? (
                      <>
                        <span className="dots">…</span>
                        <button
                          type="button"
                          className={page === totalPages ? "is-active" : ""}
                          onClick={() => setPage(totalPages)}
                        >
                          {totalPages}
                        </button>
                      </>
                    ) : null}
                    <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>

        {/* Backdrop do drawer no mobile (≤1180px) */}
        {selectedCustomer ? (
          <div className="cl-detail-overlay" onClick={() => setSelectedId(null)} />
        ) : null}

        {/* Painel de detalhe (vira bottom-sheet no mobile) */}
        <aside className={`cl-detail ${selectedCustomer ? "is-open" : ""}`}>
          {selectedCustomer ? (
            <>
              <button
                type="button"
                className="cl-detail__close"
                onClick={() => setSelectedId(null)}
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
              <CustomerDetailPanel
                customer={selectedCustomer}
                isHealthSegment={isHealthSegment}
                onEdit={() => openEdit(selectedCustomer)}
                onAnonymize={() => anonymize(selectedCustomer.id)}
                onWhatsApp={() => handleWhatsApp(selectedCustomer.whatsapp ?? selectedCustomer.phone)}
                formatMoney={formatMoney}
              />
            </>
          ) : (
            <div className="cl-detail__empty">
              <Users size={32} />
              <p>Selecione um {entityLabel} para ver os detalhes</p>
            </div>
          )}
        </aside>
      </div>

      {/* ─── Modal de edição ──────────────────────────────── */}
      {editingId ? (
        <div className="modal-overlay" onClick={closeEdit}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700 }}>
            <div className="toolbar" style={{ marginBottom: 16 }}>
              <h2 className="section-title">Editar {entityLabel}</h2>
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

      {showImport ? (
        <div className="modal-overlay" onClick={() => setShowImport(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="toolbar" style={{ marginBottom: 16 }}>
              <h2 className="section-title">Importar {entityLabelPlural}</h2>
              <button className="icon-button secondary" type="button" onClick={() => setShowImport(false)} title="Fechar">
                <X size={16} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Instrução + download do template */}
              <div
                style={{
                  background: "var(--info-light)",
                  border: "1px solid var(--info)",
                  borderRadius: "var(--radius)",
                  padding: "12px 14px",
                  fontSize: 13.5,
                  color: "var(--text-secondary)",
                  lineHeight: 1.5
                }}
              >
                <strong>Antes de importar:</strong> baixe o template CSV para garantir que seus dados estão no formato correto.
                <br />
                <a
                  href="/templates/importar-clientes.csv"
                  download
                  style={{ color: "var(--primary)", fontWeight: 600, marginTop: 6, display: "inline-block" }}
                >
                  ↓ Baixar template CSV
                </a>
              </div>

              {/* Regras */}
              <ul style={{ fontSize: 13, color: "var(--muted)", paddingLeft: 18, lineHeight: 1.8, margin: 0 }}>
                <li><strong>Nome</strong> é obrigatório — linhas sem nome são ignoradas</li>
                <li>{isHealthSegment ? "Pacientes" : "Clientes"} com telefone já cadastrado são ignorados (evita duplicata)</li>
                <li>Data de nascimento: DD/MM/AAAA</li>
                <li>Máximo de 2.000 cadastros por importação</li>
              </ul>

              {/* Upload */}
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                  padding: "24px 16px",
                  border: "2px dashed var(--border)",
                  borderRadius: "var(--radius-lg)",
                  cursor: importing ? "default" : "pointer",
                  background: "var(--surface-muted)"
                }}
              >
                <Upload size={24} style={{ color: "var(--muted)" }} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>
                  {importing ? "Importando..." : "Clique para selecionar o arquivo .csv"}
                </span>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>Apenas .csv</span>
                <input
                  type="file"
                  accept=".csv"
                  style={{ display: "none" }}
                  disabled={importing}
                  onChange={handleImport}
                />
              </label>

              {/* Resultado */}
              {importResult ? (
                <div
                  style={{
                    background: importResult.errors > 0 ? "var(--accent-light)" : "var(--success-light)",
                    border: `1px solid ${importResult.errors > 0 ? "var(--accent)" : "var(--success)"}`,
                    borderRadius: "var(--radius)",
                    padding: "12px 14px"
                  }}
                >
                  <p style={{ fontWeight: 700, fontSize: 14, margin: "0 0 4px" }}>{importResult.message}</p>
                  {importResult.errorDetails.map((detail, i) => (
                    <p key={i} style={{ fontSize: 12, color: "var(--muted)", margin: "2px 0" }}>{detail}</p>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function CustomerDetailPanel({
  customer,
  isHealthSegment,
  onEdit,
  onAnonymize,
  onWhatsApp,
  formatMoney
}: {
  customer: AnyRecord;
  isHealthSegment: boolean;
  onEdit: () => void;
  onAnonymize: () => void;
  onWhatsApp: () => void;
  formatMoney: (value: number) => string;
}) {
  const name = customer.name as string;
  const stats = customer.stats ?? { visitCount: 0, totalSpent: 0, avgTicket: 0, lastVisit: null };
  const phone = customer.phone ?? customer.whatsapp ?? "";
  const initials = getInitials(name);
  const color = getAvatarColor(name);

  const allergies = customer.allergies && customer.allergies !== "[Restrito]" ? customer.allergies : null;
  const hasContactRow = phone || customer.email || customer.birthDate;

  function age(birth: string | null | undefined) {
    if (!birth) return "";
    const d = new Date(birth);
    const today = new Date();
    let a = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) a--;
    return `${a} anos`;
  }

  return (
    <>
      <div className="cl-detail__hero">
        <span className="cl-avatar cl-avatar--xl" style={{ background: color }}>
          {initials}
        </span>
        <div className="cl-detail__name">{name}</div>
        <div className="cl-detail__tags">
          {customer.tag === "VIP" ? <span className="cl-tag cl-tag--vip">⭐ {isHealthSegment ? "Paciente" : "Cliente"} VIP</span> : null}
          {customer.tag && customer.tag !== "VIP" ? <CustomerTag tag={customer.tag} /> : null}
        </div>
      </div>

      <div className="cl-detail__stats">
        <div>
          <div className="v">{stats.visitCount}</div>
          <div className="l">VISITAS</div>
        </div>
        <div>
          <div className="v">{formatMoneyCompact(stats.totalSpent ?? 0)}</div>
          <div className="l">TOTAL GASTO</div>
        </div>
        <div>
          <div className="v">{formatMoney(stats.avgTicket ?? 0)}</div>
          <div className="l">TICKET MÉDIO</div>
        </div>
      </div>

      <div className="cl-detail__contacts">
        {phone ? (
          <button type="button" className="btn cl-btn-wa" onClick={onWhatsApp}>
            <MessageCircle size={15} />
            WhatsApp
          </button>
        ) : null}
        <button type="button" className="btn btn-ghost" onClick={onEdit}>
          <Pencil size={15} />
          Editar
        </button>
      </div>

      {hasContactRow ? (
        <div className="cl-detail__section">
          <h4>Contato e dados</h4>
          {phone ? (
            <div className="cl-row">
              <Phone size={14} />
              <div className="v">{phone}{customer.whatsapp ? <span className="sm">· WhatsApp</span> : null}</div>
            </div>
          ) : null}
          {customer.email ? (
            <div className="cl-row">
              <Mail size={14} />
              <div className="v">{customer.email}</div>
            </div>
          ) : null}
          {customer.birthDate ? (
            <div className="cl-row">
              <Calendar size={14} />
              <div className="v">
                {formatBirthDate(customer.birthDate)}
                <span className="sm">· {age(customer.birthDate)}</span>
              </div>
            </div>
          ) : null}
          {customer.createdAt ? (
            <div className="cl-row">
              <Clock size={14} />
              <div className="v">
                {isHealthSegment ? "Paciente" : "Cliente"} desde {formatMonthYear(customer.createdAt)}
                <span className="sm">· {formatTenure(customer.createdAt)}</span>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {allergies ? (
        <div className="cl-detail__section">
          <h4>Atenção</h4>
          <div className="cl-allergy-note">
            <strong>⚠️ Alergias: {allergies}</strong>
          </div>
        </div>
      ) : null}

      <div className="cl-detail__section">
        <h4>Ações</h4>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-ghost" onClick={onEdit}>
            <Edit2 size={14} />
            Editar cadastro
          </button>
          <button type="button" className="btn btn-danger-ghost" onClick={onAnonymize}>
            <ShieldCheck size={14} />
            Anonimizar (LGPD)
          </button>
        </div>
      </div>
    </>
  );
}

export { ServiceManager } from "@/components/service-manager";

export { ProfessionalManager } from "@/components/professional-manager";

const PRICING_FIELD_KEYS = new Set(["valor_da_peca", "valor_da_mao_de_obra", "desconto_em_porcentagem", "valor_total"]);

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
  const [, setPricing] = useState({ partsValue: "", laborValue: "", discountPercent: "" });

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

  // ─── Editing state ─────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSelectedServiceIds, setEditSelectedServiceIds] = useState<string[]>([]);
  const [, setEditPricing] = useState({ partsValue: "", laborValue: "", discountPercent: "" });

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
  const filteredFields = useMemo(() => fields.filter((f) => !PRICING_FIELD_KEYS.has(f.fieldKey)), [fields]);

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
              {/* Pricing financeiro fica em /agenda (AgendaPage v2), não neste form legacy */}
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
          {/* Pricing financeiro fica em /agenda (AgendaPage v2), não neste form legacy */}
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

export { SettingsView } from "@/components/settings-view";

const BRAND_COLORS = [
  { hex: "#0d9488", label: "Teal (padrão)" },
  { hex: "#d97706", label: "Âmbar" },
  { hex: "#9333ea", label: "Roxo" },
  { hex: "#db2777", label: "Rosa" },
  { hex: "#2563eb", label: "Azul" },
  { hex: "#16a34a", label: "Verde" },
  { hex: "#0f172a", label: "Slate" }
];

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
  const [primaryColor, setPrimaryColor] = useState<string>("#0d9488");

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
      setPrimaryColor(data.settings?.primaryColor ?? "#0d9488");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => { load(); }, []);

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

        {settings?.enabled && publicLink && (
          <ShareToolkit publicLink={publicLink} companyName={company?.name ?? "Agendamento"} copied={copied} onCopy={copyLink} />
        )}
      </section>

      {/* Configuration Grid */}
      <div className="grid cols-2" style={{ gap: 16 }}>
        {/* Link de agendamento (somente leitura) */}
        <section className="panel">
          <h2 className="section-title">Link personalizado</h2>
          <div className="form-grid">
            <div className="field full">
              <label>Seu link de agendamento</label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="text"
                  value={`marcaiflex.com.br/agendar/${settings?.publicSlug ?? "sua-empresa"}`}
                  readOnly
                  disabled
                />
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => navigator.clipboard.writeText(`https://marcaiflex.com.br/agendar/${settings?.publicSlug ?? "sua-empresa"}`)}
                >
                  Copiar
                </button>
              </div>
              <small style={{ color: "var(--muted)", marginTop: 4, display: "block" }}>
                Para alterar o link, entre em contato: <a href="mailto:contato@marcaiflex.com.br">contato@marcaiflex.com.br</a>
              </small>
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

      {/* Identidade visual */}
      <section className="panel" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <span style={{ width: 36, height: 36, borderRadius: 10, background: "var(--primary-light)", color: "var(--primary)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Palette size={18} />
          </span>
          <div>
            <h2 className="section-title" style={{ margin: 0 }}>Identidade visual</h2>
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
              Cor primária exibida na sua página pública de agendamento
            </p>
          </div>
        </div>

        <div className="field">
          <label>Cor primária</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
            {BRAND_COLORS.map((c) => (
              <button
                key={c.hex}
                type="button"
                title={c.label}
                onClick={() => {
                  setPrimaryColor(c.hex);
                  save({ primaryColor: c.hex });
                }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: c.hex,
                  border: "none",
                  cursor: "pointer",
                  outline: primaryColor === c.hex ? `3px solid ${c.hex}` : "3px solid transparent",
                  outlineOffset: 2,
                  transition: "outline var(--transition)",
                  boxShadow: primaryColor === c.hex ? "0 0 0 1px #fff inset" : "none"
                }}
                aria-label={c.label}
                aria-pressed={primaryColor === c.hex}
              />
            ))}
            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                onBlur={(e) => save({ primaryColor: e.target.value })}
                style={{ width: 32, height: 32, borderRadius: "50%", border: "none", cursor: "pointer", padding: 0, background: "transparent" }}
              />
              <span style={{ fontSize: 12, color: "var(--muted)" }}>Customizada</span>
            </label>
          </div>
        </div>

        {/* Preview mini */}
        <div style={{ marginTop: 16, padding: 16, background: "var(--surface-muted)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>Pré-visualização</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: primaryColor, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 14 }}>
              {(company?.name ?? "M")
                .split(" ")
                .slice(0, 2)
                .map((w: string) => w[0])
                .join("")
                .toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{company?.name ?? "Sua empresa"}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>Agendar serviço</div>
            </div>
          </div>
          <div style={{ marginTop: 10, height: 36, borderRadius: 8, background: primaryColor, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 600 }}>
            Confirmar agendamento
          </div>
        </div>
      </section>

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
                <label key={svc.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", background: svc.isPublic ? "var(--surface-muted)" : "var(--surface)" }}>
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
                <label key={prof.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", background: prof.isPublic ? "var(--surface-muted)" : "var(--surface)" }}>
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

function ShareToolkit({ publicLink, companyName, copied, onCopy }: { publicLink: string; companyName: string; copied: boolean; onCopy: () => void }) {
  const [showEmbed, setShowEmbed] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=${encodeURIComponent(publicLink)}`;
  const waMessage = encodeURIComponent(`Olá! Para agendar seu horário em ${companyName} acesse: ${publicLink}`);
  const waUrl = `https://wa.me/?text=${waMessage}`;
  const embedSnippet = `<iframe src="${publicLink}" width="100%" height="800" frameborder="0" style="border:0;border-radius:14px;max-width:600px"></iframe>`;

  function copyEmbed() {
    navigator.clipboard.writeText(embedSnippet);
    setEmbedCopied(true);
    setTimeout(() => setEmbedCopied(false), 2000);
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 16, alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ background: "var(--surface-muted)", padding: "12px 14px", borderRadius: "var(--radius)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <input
            type="text"
            readOnly
            value={publicLink}
            style={{ flex: 1, minWidth: 200, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "8px 12px", fontSize: 13 }}
            onFocus={e => e.currentTarget.select()}
          />
          <button className="btn btn-primary btn-sm" type="button" onClick={onCopy}>
            {copied ? <><Check size={13} /> Copiado</> : "Copiar link"}
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a className="btn btn-sm btn-ghost" href={publicLink} target="_blank" rel="noopener noreferrer">
            🔗 Abrir
          </a>
          <a className="btn btn-sm btn-ghost" href={waUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#25d366" }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/></svg>
            WhatsApp
          </a>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => { navigator.clipboard.writeText(`📅 Agende seu horário: ${publicLink}`); alert("Texto para bio copiado!"); }} style={{ color: "#e1306c" }}>
            📷 Bio Instagram
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setShowEmbed(s => !s)}>
            {"</>"} Embed no site
          </button>
        </div>

        {showEmbed ? (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 12 }}>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Cole no HTML do seu site</div>
            <pre style={{ background: "var(--bg)", padding: 10, borderRadius: 6, fontSize: 11, overflow: "auto", margin: 0 }}>{embedSnippet}</pre>
            <button type="button" className="btn btn-sm btn-ghost" onClick={copyEmbed} style={{ marginTop: 8 }}>
              {embedCopied ? <><Check size={12} /> Copiado</> : "Copiar código"}
            </button>
          </div>
        ) : null}
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 12, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrUrl} alt={`QR Code para ${publicLink}`} width={180} height={180} style={{ borderRadius: 8 }} />
        <span style={{ fontSize: 11, color: "var(--muted)" }}>Aponte a câmera para agendar</span>
        <a className="btn btn-sm btn-ghost" href={qrUrl} download={`qr-code-${companyName.toLowerCase().replace(/\s+/g, '-')}.png`}>
          Baixar QR
        </a>
      </div>
    </div>
  );
}
