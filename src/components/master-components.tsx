"use client";

import { Plus, RefreshCcw } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-api";
import { PageHeader, StatCard } from "@/components/page-header";

type AnyRecord = Record<string, any>;

const segments = [
  ["CLINICA_MEDICA", "Clínica médica"],
  ["OFICINA_MECANICA", "Oficina mecânica"],
  ["SALAO_BELEZA", "Salão de beleza"],
  ["CONSULTORIO", "Consultório"],
  ["ASSISTENCIA_TECNICA", "Assistência técnica"],
  ["PRESTADOR_SERVICOS", "Prestador de serviços"],
  ["PERSONALIZADO", "Personalizado"]
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
    const data = await apiFetch<{ companies: AnyRecord[] }>("/api/companies");
    setCompanies(data.companies);
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
          <Input label="Admin nome" value={form.adminName} onChange={(adminName) => setForm({ ...form, adminName })} />
          <Input label="Admin e-mail" type="email" value={form.adminEmail} onChange={(adminEmail) => setForm({ ...form, adminEmail })} />
          <Input label="Admin senha" value={form.adminPassword} onChange={(adminPassword) => setForm({ ...form, adminPassword })} />
          <div className="field">
            <label>Plano</label>
            <input value={form.plan} onChange={(event) => setForm({ ...form, plan: event.target.value })} />
          </div>
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
                  <span className={`badge ${company.status === "ACTIVE" ? "success" : "danger"}`}>{company.status}</span>
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

function Input({
  label,
  value,
  onChange,
  required,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} />
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
