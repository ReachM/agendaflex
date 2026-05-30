"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  RefreshCcw,
  Search,
  Settings,
  XCircle
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { apiFetch } from "@/lib/client-api";

type Status = "NOT_REQUESTED" | "REQUESTED" | "UNDER_REVIEW" | "ISSUED" | "SENT_TO_CUSTOMER" | "CANCELLED";

type StatusBreakdown = { status: Status; count: number; total: number };

type TopCompany = {
  companyId: string;
  companyName: string;
  companySlug: string | null;
  companyPlan: string;
  count: number;
  total: number;
};

type RecentInvoice = {
  id: string;
  legalName: string;
  documentNumber: string;
  amount: number;
  status: Status;
  invoiceNumber: string | null;
  issuedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  companyId: string;
  companyName: string;
  companySlug: string | null;
  companyPlan: string;
  customerName: string | null;
};

type Response = {
  metrics: {
    total: number;
    issuedLast30: number;
    cancelledLast30: number;
    pending: number;
    monthlyValueIssued: number;
    configuredCompanies: number;
    autoEmitCompanies: number;
    nfeioConnected: number;
  };
  statusBreakdown: StatusBreakdown[];
  topCompanies: TopCompany[];
  recentInvoices: RecentInvoice[];
};

type StatusFilter = "all" | Status;

const STATUS_LABEL: Record<Status, string> = {
  NOT_REQUESTED: "Não solicitada",
  REQUESTED: "Solicitada",
  UNDER_REVIEW: "Processando",
  ISSUED: "Autorizada",
  SENT_TO_CUSTOMER: "Enviada",
  CANCELLED: "Cancelada"
};

const STATUS_CLASS: Record<Status, string> = {
  NOT_REQUESTED: "pill--muted",
  REQUESTED: "pill--info",
  UNDER_REVIEW: "pill--warn",
  ISSUED: "pill--success",
  SENT_TO_CUSTOMER: "pill--success",
  CANCELLED: "pill--danger"
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(new Date(value));
}

function planTagClass(slug: string): string {
  if (slug === "max") return "plan-tag--max";
  if (slug === "pro") return "plan-tag--pro";
  if (slug === "starter") return "plan-tag--starter";
  return "plan-tag--free";
}

export default function MasterNotasFiscaisPage() {
  const [data, setData] = useState<Response | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiFetch<Response>("/api/master/invoices");
      setData(result);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let rows = data.recentInvoices;
    if (statusFilter !== "all") rows = rows.filter(i => i.status === statusFilter);
    const term = search.trim().toLowerCase();
    if (term) {
      rows = rows.filter(i =>
        i.companyName.toLowerCase().includes(term) ||
        i.legalName.toLowerCase().includes(term) ||
        i.documentNumber.toLowerCase().includes(term) ||
        (i.invoiceNumber ?? "").toLowerCase().includes(term)
      );
    }
    return rows;
  }, [data, statusFilter, search]);

  if (!data) {
    return (
      <>
        <PageHeader title="Notas fiscais (global)" subtitle="Status das emissões em todas as empresas" />
        {error ? <div className="error-box">{error}</div> : <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><div className="loading-spinner" /></div>}
      </>
    );
  }

  const m = data.metrics;
  const maxCount = Math.max(...data.topCompanies.map(c => c.count), 1);

  function countByStatus(status: Status) {
    return data?.statusBreakdown.find(s => s.status === status)?.count ?? 0;
  }

  return (
    <>
      <PageHeader
        title="Notas fiscais (global)"
        subtitle={`${m.total} solicitações · ${m.configuredCompanies} empresas com emissor cadastrado`}
        actions={
          <>
            <span className="env-pill"><span className="dot" /> PRODUCTION</span>
            <button type="button" className="btn btn-ghost" onClick={load} disabled={loading}>
              <RefreshCcw size={15} /> Atualizar
            </button>
          </>
        }
      />

      {error ? <div className="error-box">{error}</div> : null}

      <div className="grid cols-4" style={{ marginBottom: 22 }}>
        <Kpi label="Autorizadas (30d)" value={String(m.issuedLast30)} icon={<CheckCircle2 size={18} />} variant="emerald" hint={`${countByStatus("ISSUED")} no total`} />
        <Kpi label="Processando" value={String(m.pending)} icon={<Loader2 size={18} />} variant="amber" />
        <Kpi label="Canceladas (30d)" value={String(m.cancelledLast30)} icon={<XCircle size={18} />} variant="rose" />
        <Kpi label="Valor emitido (mês)" value={formatMoney(m.monthlyValueIssued)} icon={<FileText size={18} />} variant="default" />
      </div>

      <div className="grid cols-2" style={{ marginBottom: 20 }}>
        <section className="panel">
          <div className="panel__head">
            <div>
              <div className="panel__title">Distribuição por status</div>
              <div className="panel__sub">Total de solicitações no histórico</div>
            </div>
          </div>
          <div className="panel__body">
            {data.statusBreakdown.length === 0 ? (
              <div className="empty">Sem notas registradas.</div>
            ) : (
              <div className="hbar">
                {data.statusBreakdown.map(s => {
                  const max = Math.max(...data.statusBreakdown.map(x => x.count), 1);
                  return (
                    <div key={s.status} className="hbar__item">
                      <span className="hbar__label">
                        <span className={`pill ${STATUS_CLASS[s.status]}`}>{STATUS_LABEL[s.status]}</span>
                      </span>
                      <div className="hbar__track">
                        <div className="hbar__fill" style={{ width: `${Math.max((s.count / max) * 100, 6)}%` }}>{s.count}</div>
                      </div>
                      <span className="hbar__value">{formatMoney(s.total)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel__head">
            <div>
              <div className="panel__title">Configuração NFE.io</div>
              <div className="panel__sub">Empresas com emissor cadastrado</div>
            </div>
          </div>
          <div className="panel__body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <ConfigRow
              label="Emissor cadastrado"
              count={m.configuredCompanies}
              max={data.topCompanies.length > 0 ? Math.max(m.configuredCompanies, 10) : 10}
              icon={<Settings size={14} />}
              ok
            />
            <ConfigRow
              label="Chave NFE.io conectada"
              count={m.nfeioConnected}
              max={m.configuredCompanies > 0 ? m.configuredCompanies : 10}
              icon={<CheckCircle2 size={14} />}
              ok={m.nfeioConnected > 0}
            />
            <ConfigRow
              label="Emissão automática ativa"
              count={m.autoEmitCompanies}
              max={m.nfeioConnected > 0 ? m.nfeioConnected : 10}
              icon={<CheckCircle2 size={14} />}
              ok={m.autoEmitCompanies > 0}
            />
            {m.nfeioConnected === 0 && m.configuredCompanies > 0 ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 10, border: "1px solid var(--warning, #fbbf24)", borderRadius: "var(--radius)", background: "var(--warn-ghost, rgba(251,191,36,0.14))", color: "var(--warning)", fontSize: 12 }}>
                <AlertTriangle size={14} /> Há emissores cadastrados sem chave NFE.io — emissões ficam manuais até a chave ser conectada.
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="panel__head">
          <div>
            <div className="panel__title">Top empresas emissoras</div>
            <div className="panel__sub">Por quantidade de solicitações no histórico</div>
          </div>
        </div>
        <div className="panel__body">
          {data.topCompanies.length === 0 ? (
            <div className="empty">Sem emissões registradas.</div>
          ) : (
            <div className="hbar">
              {data.topCompanies.map(c => (
                <div key={c.companyId} className="hbar__item">
                  <span className="hbar__label" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <strong>{c.companyName}</strong>
                    <span className={`plan-tag ${planTagClass(c.companyPlan)}`}>{c.companyPlan.toUpperCase()}</span>
                  </span>
                  <div className="hbar__track">
                    <div className="hbar__fill" style={{ width: `${Math.max((c.count / maxCount) * 100, 6)}%` }}>{c.count}</div>
                  </div>
                  <span className="hbar__value">{formatMoney(c.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel__head" style={{ flexDirection: "column", alignItems: "stretch", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div className="panel__title">Solicitações recentes</div>
              <div className="panel__sub">{filtered.length} de {data.recentInvoices.length} exibidas</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className={`chip-tab ${statusFilter === "all" ? "is-on" : ""}`} onClick={() => setStatusFilter("all")}>Todas</button>
              <button type="button" className={`chip-tab ${statusFilter === "ISSUED" ? "is-on" : ""}`} onClick={() => setStatusFilter("ISSUED")}>Autorizadas</button>
              <button type="button" className={`chip-tab ${statusFilter === "UNDER_REVIEW" ? "is-on" : ""}`} onClick={() => setStatusFilter("UNDER_REVIEW")}>Processando</button>
              <button type="button" className={`chip-tab ${statusFilter === "REQUESTED" ? "is-on" : ""}`} onClick={() => setStatusFilter("REQUESTED")}>Solicitadas</button>
              <button type="button" className={`chip-tab ${statusFilter === "CANCELLED" ? "is-on" : ""}`} onClick={() => setStatusFilter("CANCELLED")}>Canceladas</button>
            </div>
          </div>
          <div className="inline-search">
            <Search size={14} />
            <input type="search" placeholder="Buscar por empresa, tomador, CNPJ ou nº NF..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="panel__body panel__body--flush">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon"><FileText size={24} /></div>
              <h3>Nenhuma nota no filtro</h3>
              <p>Ajuste a busca ou troque o filtro.</p>
            </div>
          ) : (
            <div className="table-wrap" style={{ borderRadius: 0, border: 0, boxShadow: "none" }}>
              <table>
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>Tomador</th>
                    <th className="col-hide-mobile">Nº NF</th>
                    <th>Status</th>
                    <th className="col-hide-mobile">Data</th>
                    <th style={{ textAlign: "right" }}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((i, idx) => {
                    const initials = i.companyName.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
                    return (
                      <tr key={i.id}>
                        <td>
                          <div className="biz">
                            <span className={`biz__avt av-${(idx % 8) + 1}`}>{initials}</span>
                            <div>
                              <div className="biz__nm">{i.companyName}</div>
                              <div className="biz__sub">
                                <span className={`plan-tag ${planTagClass(i.companyPlan)}`}>{i.companyPlan.toUpperCase()}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <strong style={{ fontSize: 13 }}>{i.legalName}</strong>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>{i.documentNumber}</div>
                          {i.errorMessage ? <div style={{ fontSize: 11, color: "var(--danger)" }}>{i.errorMessage}</div> : null}
                        </td>
                        <td className="col-hide-mobile" style={{ fontFamily: "monospace", fontSize: 12 }}>{i.invoiceNumber ?? "—"}</td>
                        <td><span className={`pill ${STATUS_CLASS[i.status]}`}>{STATUS_LABEL[i.status]}</span></td>
                        <td className="col-hide-mobile" style={{ fontSize: 12, color: "var(--muted)" }}>
                          {formatDate(i.issuedAt ?? i.createdAt)}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>{formatMoney(i.amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function Kpi({ label, value, icon, variant = "default", hint }: {
  label: string;
  value: string;
  icon: React.ReactNode;
  variant?: "default" | "emerald" | "sky" | "rose" | "amber";
  hint?: string;
}) {
  const cls = variant === "default" ? "" : `kpi--${variant}`;
  return (
    <div className={`kpi ${cls}`}>
      <div className="kpi__head">
        <span className="kpi__label">{label}</span>
        <span className="kpi__icon">{icon}</span>
      </div>
      <div className="kpi__value">{value}</div>
      {hint ? <div className="kpi__foot"><span>{hint}</span></div> : null}
    </div>
  );
}

function ConfigRow({ label, count, max, icon, ok }: {
  label: string;
  count: number;
  max: number;
  icon: React.ReactNode;
  ok: boolean;
}) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{icon} {label}</span>
        <strong style={{ color: ok ? "var(--success)" : "var(--muted)" }}>{count}</strong>
      </div>
      <div style={{ height: 6, background: "var(--surface-muted)", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.max(pct, 6)}%`, background: ok ? "var(--success)" : "var(--muted-2)", borderRadius: 999 }} />
      </div>
    </div>
  );
}
