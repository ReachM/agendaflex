"use client";

import { Ban, Plus, RefreshCcw, Save, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-api";
import { PageHeader, StatCard } from "@/components/page-header";

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

const segments = [
  ["CLINICA_MEDICA", "Clínica médica"],
  ["OFICINA_MECANICA", "Oficina mecânica"],
  ["SALAO_BELEZA", "Salão de beleza"],
  ["CONSULTORIO", "Consultório"],
  ["ASSISTENCIA_TECNICA", "Assistência técnica"],
  ["PRESTADOR_SERVICOS", "Prestador de serviços"],
  ["PERSONALIZADO", "Personalizado"]
];

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

export function MasterDashboard() {
  const [data, setData] = useState<AnyRecord | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<AnyRecord>("/api/master/dashboard").then(setData).catch((err) => setError(err.message));
  }, []);

  return (
    <>
      <PageHeader title="Painel Master" subtitle="Visão geral da plataforma" />
      {error ? <div className="error-box">{error}</div> : null}
      <div className="grid cols-4">
        <StatCard label="Empresas" value={data?.metrics?.companies ?? "-"} />
        <StatCard label="Empresas ativas" value={data?.metrics?.activeCompanies ?? "-"} />
        <StatCard label="Usuários" value={data?.metrics?.users ?? "-"} />
        <StatCard label="Agendamentos" value={data?.metrics?.appointments ?? "-"} />
      </div>
      <section className="panel grid" style={{ marginTop: 16 }}>
        <h2 className="section-title">Logs recentes</h2>
        <LogTable logs={data?.recentLogs ?? []} />
      </section>
    </>
  );
}

export function CompanyManager() {
  const [companies, setCompanies] = useState<AnyRecord[]>([]);
  const [plans, setPlans] = useState<AnyRecord[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    tradeName: "",
    email: "",
    phone: "",
    document: "",
    segment: "PERSONALIZADO",
    status: "ACTIVE",
    plan: "starter",
    adminName: "",
    adminEmail: "",
    adminPassword: "Admin@123456"
  });

  async function load() {
    setError("");
    const [companyData, planData] = await Promise.all([
      apiFetch<{ companies: AnyRecord[] }>("/api/companies"),
      apiFetch<{ plans: AnyRecord[] }>("/api/plans").catch(() => ({ plans: [] }))
    ]);
    setCompanies(companyData.companies);
    setPlans(planData.plans.filter((p: AnyRecord) => p.isActive));
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await apiFetch("/api/companies", {
        method: "POST",
        body: JSON.stringify(form)
      });
      setForm({
        name: "",
        tradeName: "",
        email: "",
        phone: "",
        document: "",
        segment: "PERSONALIZADO",
        status: "ACTIVE",
        plan: "starter",
        adminName: "",
        adminEmail: "",
        adminPassword: "Admin@123456"
      });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(company: AnyRecord, status: string) {
    await apiFetch(`/api/companies/${company.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
    await load();
  }

  async function updatePlan(company: AnyRecord, plan: string) {
    await apiFetch(`/api/companies/${company.id}`, {
      method: "PATCH",
      body: JSON.stringify({ plan })
    });
    await load();
  }

  return (
    <>
      <PageHeader
        title="Empresas"
        subtitle="Cadastro e status dos tenants"
        actions={
          <button className="button secondary" onClick={() => load()} type="button">
            <RefreshCcw size={16} />
            Atualizar
          </button>
        }
      />
      {error ? <div className="error-box">{error}</div> : null}

      <section className="form-panel grid">
        <h2 className="section-title">Nova empresa</h2>
        <form className="form-grid" onSubmit={onSubmit}>
          <Input label="Nome da empresa" value={form.name} onChange={(name) => setForm({ ...form, name })} required />
          <Input label="Nome fantasia" value={form.tradeName} onChange={(tradeName) => setForm({ ...form, tradeName })} />
          <Input label="E-mail" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} required />
          <Input label="Telefone" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />
          <Input label="CNPJ/CPF" value={form.document} onChange={(document) => setForm({ ...form, document })} />
          <div className="field">
            <label>Segmento</label>
            <select value={form.segment} onChange={(event) => setForm({ ...form, segment: event.target.value })}>
              {segments.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Plano</label>
            <select value={form.plan} onChange={(event) => setForm({ ...form, plan: event.target.value })}>
              {plans.length > 0 ? (
                plans.map((plan) => (
                  <option key={plan.id} value={plan.slug}>
                    {plan.name} — {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(plan.price ?? 0))}/mês
                  </option>
                ))
              ) : (
                <>
                  <option value="starter">Starter</option>
                  <option value="pro">Profissional</option>
                  <option value="max">Max</option>
                </>
              )}
            </select>
          </div>
          <Input label="Admin nome" value={form.adminName} onChange={(adminName) => setForm({ ...form, adminName })} />
          <Input label="Admin e-mail" type="email" value={form.adminEmail} onChange={(adminEmail) => setForm({ ...form, adminEmail })} />
          <Input label="Admin senha" value={form.adminPassword} onChange={(adminPassword) => setForm({ ...form, adminPassword })} />
          <div className="field full">
            <button className="button" disabled={loading} type="submit">
              <Plus size={16} />
              Criar empresa
            </button>
          </div>
        </form>
      </section>

      <section className="table-wrap" style={{ marginTop: 16 }}>
        <table>
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Segmento</th>
              <th>Plano</th>
              <th>Status</th>
              <th>Uso</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((company) => (
              <tr key={company.id}>
                <td>
                  <strong>{company.name}</strong>
                  <br />
                  <span className="muted">{company.email}</span>
                </td>
                <td>{company.segment}</td>
                <td>
                  <select
                    className="badge-select"
                    value={company.plan ?? "starter"}
                    onChange={(e) => updatePlan(company, e.target.value)}
                  >
                    {plans.length > 0 ? (
                      plans.map((plan) => (
                        <option key={plan.id} value={plan.slug}>{plan.name}</option>
                      ))
                    ) : (
                      <>
                        <option value="starter">Starter</option>
                        <option value="pro">Profissional</option>
                        <option value="max">Max</option>
                      </>
                    )}
                  </select>
                </td>
                <td>
                  <span className={`badge ${company.status === "ACTIVE" ? "status-active" : company.status === "SUSPENDED" ? "status-suspended" : "status-inactive"}`}>{company.status === "ACTIVE" ? "Ativa" : company.status === "SUSPENDED" ? "Suspensa" : "Inativa"}</span>
                </td>
                <td>
                  {company._count?.users ?? 0} usuários, {company._count?.customers ?? 0} clientes,{" "}
                  {company._count?.appointments ?? 0} agendamentos
                </td>
                <td>
                  <div className="toolbar">
                    <button className="button secondary" onClick={() => updateStatus(company, "ACTIVE")} type="button">
                      Ativar
                    </button>
                    <button className="button danger" onClick={() => updateStatus(company, "SUSPENDED")} type="button">
                      Suspender
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

export function MasterCustomFieldManager() {
  const [companies, setCompanies] = useState<AnyRecord[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedCompanyName, setSelectedCompanyName] = useState("");
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

  useEffect(() => {
    apiFetch<{ companies: AnyRecord[] }>("/api/companies")
      .then((data) => setCompanies(data.companies))
      .catch((err) => setError(err.message));
  }, []);

  async function loadFields(companyId: string) {
    if (!companyId) {
      setFields([]);
      return;
    }
    try {
      setError("");
      const data = await apiFetch<{ customFields: CustomField[]; company: AnyRecord }>(
        `/api/master/custom-fields?companyId=${companyId}`
      );
      setFields(data.customFields);
      setSelectedCompanyName(data.company?.name ?? "");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function handleCompanyChange(companyId: string) {
    setSelectedCompanyId(companyId);
    const company = companies.find((c) => c.id === companyId);
    setSelectedCompanyName(company?.name ?? "");
    loadFields(companyId);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!selectedCompanyId) {
      setError("Selecione uma empresa antes de criar um campo.");
      return;
    }
    try {
      await apiFetch("/api/master/custom-fields", {
        method: "POST",
        body: JSON.stringify({
          companyId: selectedCompanyId,
          ...form,
          sortOrder: Number(form.sortOrder),
          options: form.options
            ? form.options.split(",").map((item) => item.trim()).filter(Boolean)
            : undefined
        })
      });
      setForm({ ...form, label: "", fieldKey: "", placeholder: "", helpText: "", options: "" });
      await loadFields(selectedCompanyId);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function deactivate(id: string) {
    try {
      await apiFetch(`/api/master/custom-fields/${id}`, { method: "DELETE" });
      await loadFields(selectedCompanyId);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        title="Campos Personalizados"
        subtitle="Gerenciar campos dinâmicos por empresa"
        actions={
          selectedCompanyId ? (
            <button className="button secondary" onClick={() => loadFields(selectedCompanyId)} type="button">
              <RefreshCcw size={16} />
              Atualizar
            </button>
          ) : null
        }
      />
      {error ? <div className="error-box">{error}</div> : null}

      <section className="form-panel grid" style={{ marginBottom: 16 }}>
        <h2 className="section-title">Selecionar empresa</h2>
        <div className="form-grid">
          <div className="field full">
            <label>Empresa</label>
            <select value={selectedCompanyId} onChange={(e) => handleCompanyChange(e.target.value)}>
              <option value="">Selecione uma empresa</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name} — {company.segment}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {selectedCompanyId ? (
        <>
          <section className="form-panel grid">
            <h2 className="section-title">
              Novo campo para <strong>{selectedCompanyName}</strong>
            </h2>
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
                {fields.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty">Nenhum campo personalizado cadastrado para esta empresa.</td>
                  </tr>
                ) : null}
                {fields.map((field) => (
                  <tr key={field.id}>
                    <td><strong>{field.label}</strong><br /><span className="muted">{field.fieldKey}</span></td>
                    <td>{entityLabels.find(([k]) => k === field.entityType)?.[1] ?? field.entityType}</td>
                    <td>{fieldTypes.find(([k]) => k === field.fieldType)?.[1] ?? field.fieldType}</td>
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
      ) : (
        <section className="panel grid">
          <div className="empty">Selecione uma empresa acima para gerenciar seus campos personalizados.</div>
        </section>
      )}
    </>
  );
}

function Input({
  label,
  value,
  onChange,
  required,
  type = "text",
  full
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  full?: boolean;
}) {
  return (
    <div className={`field ${full ? "full" : ""}`}>
      <label>{label}</label>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} />
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

function LogTable({ logs }: { logs: AnyRecord[] }) {
  if (!logs.length) return <div className="empty">Sem registros.</div>;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Quando</th>
            <th>Ação</th>
            <th>Empresa</th>
            <th>Usuário</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{formatDateTime(log.createdAt)}</td>
              <td>{log.action}</td>
              <td>{log.company?.name ?? "-"}</td>
              <td>{log.user?.email ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}
