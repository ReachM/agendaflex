"use client";

import {
  Ban,
  Building2,
  DollarSign,
  Download,
  Plus,
  RefreshCcw,
  Search,
  Sparkles,
  TrendingDown,
  Trash2,
  Users,
  X
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/client-api";
import { PageHeader } from "@/components/page-header";

type AnyRecord = Record<string, any>;

type MasterCompany = {
  id: string;
  name: string;
  slug: string | null;
  segment: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  plan: string;
  planName: string | null;
  planSlug: string | null;
  mrr: number;
  subStatus: "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELLED" | "EXPIRED" | null;
  currentPeriodEnd: string | null;
  usersCount: number;
  customersCount: number;
  appointmentsCount: number;
  health: "good" | "mid" | "low";
  createdAt: string;
};

type MasterDashboardData = {
  metrics: {
    companies: number;
    activeCompanies: number;
    trialingCompanies: number;
    pastDueCompanies: number;
    cancelledLast30: number;
    newCompaniesThisMonth: number;
    users: number;
    customers: number;
    appointments: number;
    mrr: number;
    mrrDelta: number;
    trialCompanies30d: number;
  };
  planMix: { planId: string; planName: string; planSlug: string; count: number }[];
  companies: MasterCompany[];
  recentLogs: AnyRecord[];
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function planTagClass(planSlug: string | null | undefined): string {
  if (planSlug === "max") return "plan-tag--max";
  if (planSlug === "pro") return "plan-tag--pro";
  if (planSlug === "starter") return "plan-tag--starter";
  return "plan-tag--free";
}

function subStatusDot(status: MasterCompany["subStatus"], companyStatus: MasterCompany["status"]) {
  if (companyStatus === "SUSPENDED") return { cls: "status-dot--churned", label: "Suspensa" };
  if (status === "ACTIVE") return { cls: "status-dot--active", label: "Ativa" };
  if (status === "TRIALING") return { cls: "status-dot--trial", label: "Em trial" };
  if (status === "PAST_DUE") return { cls: "status-dot--overdue", label: "Inadimplente" };
  if (status === "CANCELLED" || status === "EXPIRED") return { cls: "status-dot--churned", label: "Cancelada" };
  return { cls: "status-dot--churned", label: "Sem assinatura" };
}

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
  const [data, setData] = useState<MasterDashboardData | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELLED">("all");

  function load() {
    apiFetch<MasterDashboardData>("/api/master/dashboard").then(setData).catch((err) => setError(err.message));
  }

  useEffect(() => { load(); }, []);

  const filteredCompanies = useMemo(() => {
    if (!data) return [];
    let rows = data.companies;
    if (statusFilter !== "all") {
      rows = rows.filter(c => {
        if (statusFilter === "ACTIVE") return c.status === "ACTIVE" && c.subStatus === "ACTIVE";
        if (statusFilter === "TRIALING") return c.subStatus === "TRIALING";
        if (statusFilter === "PAST_DUE") return c.subStatus === "PAST_DUE";
        if (statusFilter === "CANCELLED") return c.status !== "ACTIVE" || c.subStatus === "CANCELLED";
        return true;
      });
    }
    const term = search.trim().toLowerCase();
    if (term) {
      rows = rows.filter(c =>
        c.name.toLowerCase().includes(term) ||
        (c.slug ?? "").toLowerCase().includes(term) ||
        c.segment.toLowerCase().includes(term)
      );
    }
    return rows;
  }, [data, search, statusFilter]);

  const m = data?.metrics;
  const totalActiveSubs = (data?.planMix ?? []).reduce((acc, p) => acc + p.count, 0);

  return (
    <>
      <PageHeader
        title="Visão geral da plataforma"
        subtitle={`${m?.activeCompanies ?? 0} empresas ativas · ${m?.users ?? 0} usuários`}
        actions={
          <>
            <span className="env-pill"><span className="dot" /> PRODUCTION</span>
            <button type="button" className="btn btn-ghost" onClick={load}>
              <RefreshCcw size={15} /> Atualizar
            </button>
            <button type="button" className="btn btn-primary">
              <Plus size={15} /> Nova empresa
            </button>
          </>
        }
      />

      {error ? <div className="error-box">{error}</div> : null}

      {!data ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <div className="loading-spinner" />
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid cols-4" style={{ marginBottom: 22 }}>
            <KpiCard
              variant="default"
              icon={<DollarSign size={18} />}
              label="MRR atual"
              value={formatMoney(m?.mrr ?? 0)}
              delta={m?.mrrDelta ?? 0}
            />
            <KpiCard
              variant="emerald"
              icon={<Building2 size={18} />}
              label="Empresas ativas"
              value={String(m?.activeCompanies ?? 0)}
              footHint={`${m?.newCompaniesThisMonth ?? 0} novas no mês`}
            />
            <KpiCard
              variant="sky"
              icon={<Sparkles size={18} />}
              label="Trials ativos"
              value={String(m?.trialingCompanies ?? 0)}
              footHint={`${m?.trialCompanies30d ?? 0} convertendo`}
            />
            <KpiCard
              variant="rose"
              icon={<TrendingDown size={18} />}
              label="Churn 30d"
              value={String(m?.cancelledLast30 ?? 0)}
              footHint={`${m?.pastDueCompanies ?? 0} inadimplentes`}
            />
          </div>

          {/* Plan distribution + Recent logs */}
          <div className="grid cols-2" style={{ marginBottom: 20 }}>
            <div className="panel">
              <div className="panel__head">
                <div>
                  <div className="panel__title">Distribuição por plano</div>
                  <div className="panel__sub">Assinaturas ativas e em trial</div>
                </div>
              </div>
              <div className="panel__body">
                {data.planMix.length === 0 ? (
                  <div className="empty">Sem assinaturas registradas.</div>
                ) : (
                  <div className="hbar">
                    {data.planMix.map(p => {
                      const pct = totalActiveSubs > 0 ? (p.count / totalActiveSubs) * 100 : 0;
                      return (
                        <div key={p.planId} className="hbar__item">
                          <span className="hbar__label">
                            <span className={`plan-tag ${planTagClass(p.planSlug)}`}>{p.planName}</span>
                          </span>
                          <div className="hbar__track">
                            <div className="hbar__fill" style={{ width: `${Math.max(pct, 6)}%` }}>{p.count}</div>
                          </div>
                          <span className="hbar__value">{pct.toFixed(0)}%</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="panel">
              <div className="panel__head">
                <div>
                  <div className="panel__title">Atividade recente</div>
                  <div className="panel__sub">Últimas ações auditadas</div>
                </div>
              </div>
              <div className="panel__body panel__body--flush">
                <LogTable logs={data.recentLogs} />
              </div>
            </div>
          </div>

          {/* Companies table */}
          <div className="panel">
            <div className="panel__head" style={{ flexDirection: "column", alignItems: "stretch", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div className="panel__title">Empresas</div>
                  <div className="panel__sub">{filteredCompanies.length} de {data.companies.length} exibidas</div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" className={`chip-tab ${statusFilter === "all" ? "is-on" : ""}`} onClick={() => setStatusFilter("all")}>Todas</button>
                  <button type="button" className={`chip-tab ${statusFilter === "ACTIVE" ? "is-on" : ""}`} onClick={() => setStatusFilter("ACTIVE")}>Ativas</button>
                  <button type="button" className={`chip-tab ${statusFilter === "TRIALING" ? "is-on" : ""}`} onClick={() => setStatusFilter("TRIALING")}>Trial</button>
                  <button type="button" className={`chip-tab ${statusFilter === "PAST_DUE" ? "is-on" : ""}`} onClick={() => setStatusFilter("PAST_DUE")}>Inadimplentes</button>
                  <button type="button" className={`chip-tab ${statusFilter === "CANCELLED" ? "is-on" : ""}`} onClick={() => setStatusFilter("CANCELLED")}>Canceladas</button>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div className="inline-search" style={{ flex: 1, minWidth: 240 }}>
                  <Search size={14} />
                  <input
                    type="search"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar por nome, slug ou segmento..."
                  />
                </div>
                <button type="button" className="btn btn-ghost btn-sm">
                  <Download size={13} /> Exportar
                </button>
              </div>
            </div>
            <div className="panel__body panel__body--flush">
              {filteredCompanies.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state__icon"><Building2 size={24} /></div>
                  <h3>Nenhuma empresa no filtro</h3>
                  <p>Ajuste a busca ou troque o filtro de status.</p>
                </div>
              ) : (
                <div className="table-wrap" style={{ borderRadius: 0, border: 0, boxShadow: "none" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Empresa</th>
                        <th>Plano</th>
                        <th className="col-hide-mobile">Usuários</th>
                        <th>MRR</th>
                        <th className="col-hide-mobile">Saúde</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCompanies.map((c, idx) => {
                        const avtClass = `av-${(idx % 8) + 1}`;
                        const initials = c.name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
                        const status = subStatusDot(c.subStatus, c.status);
                        return (
                          <tr key={c.id}>
                            <td>
                              <div className="biz">
                                <span className={`biz__avt ${avtClass}`}>{initials}</span>
                                <div>
                                  <div className="biz__nm">{c.name}</div>
                                  <div className="biz__sub">{c.slug ? `${c.slug} · ` : ""}{c.segment.replaceAll("_", " ").toLowerCase()}</div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className={`plan-tag ${planTagClass(c.planSlug ?? c.plan)}`}>
                                {c.planName ?? c.plan}
                              </span>
                            </td>
                            <td className="col-hide-mobile">
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                <Users size={13} /> {c.usersCount}
                              </span>
                            </td>
                            <td style={{ fontWeight: 700 }}>{formatMoney(c.mrr)}</td>
                            <td className="col-hide-mobile">
                              <span className={`health health--${c.health}`}>
                                <span className="health__bar"><div style={{ width: c.health === "good" ? "80%" : c.health === "mid" ? "55%" : "28%" }} /></span>
                                <span className="health__v">{c.health === "good" ? "OK" : c.health === "mid" ? "MED" : "BAIXA"}</span>
                              </span>
                            </td>
                            <td>
                              <span className={`status-dot ${status.cls}`}>
                                <span className="d" /> {status.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function KpiCard({
  label,
  value,
  icon,
  variant,
  delta,
  footHint
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  variant: "default" | "emerald" | "sky" | "rose" | "amber" | "teal";
  delta?: number;
  footHint?: string;
}) {
  const variantClass = variant === "default" ? "" : `kpi--${variant}`;
  return (
    <div className={`kpi ${variantClass}`}>
      <div className="kpi__head">
        <span className="kpi__label">{label}</span>
        <span className="kpi__icon">{icon}</span>
      </div>
      <div className="kpi__value">{value}</div>
      <div className="kpi__foot">
        {delta !== undefined ? (
          <span className={`kpi__delta ${delta < 0 ? "kpi__delta--down" : ""}`}>
            {delta >= 0 ? "+" : ""}{delta}%
          </span>
        ) : null}
        {footHint ? <span>{footHint}</span> : null}
      </div>
    </div>
  );
}

type MasterCompanyRow = {
  id: string;
  name: string;
  tradeName: string | null;
  email: string;
  phone: string | null;
  slug: string | null;
  document: string | null;
  segment: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  plan: string;
  createdAt: string;
  counts: { users: number; customers: number; appointments: number; professionals: number; services: number };
  subscription: {
    status: "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELLED" | "EXPIRED";
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
    canceledAt: string | null;
    planName: string | null;
    planSlug: string | null;
    price: number;
  } | null;
  mrr: number;
  health: "good" | "mid" | "low";
};

type StatusFilter = "all" | "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELLED";

export function CompanyManager() {
  const [companies, setCompanies] = useState<MasterCompanyRow[]>([]);
  const [plans, setPlans] = useState<AnyRecord[]>([]);
  const [error, setError] = useState("");
  const [loadingList, setLoadingList] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);

  async function load() {
    setError("");
    setLoadingList(true);
    try {
      const [companyData, planData] = await Promise.all([
        apiFetch<{ companies: MasterCompanyRow[] }>("/api/companies"),
        apiFetch<{ plans: AnyRecord[] }>("/api/plans").catch(() => ({ plans: [] }))
      ]);
      setCompanies(companyData.companies);
      setPlans(planData.plans.filter((p: AnyRecord) => p.isActive));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function updateStatus(company: MasterCompanyRow, status: string) {
    try {
      await apiFetch(`/api/companies/${company.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function updatePlan(company: MasterCompanyRow, plan: string) {
    try {
      await apiFetch(`/api/companies/${company.id}`, {
        method: "PATCH",
        body: JSON.stringify({ plan })
      });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const filtered = useMemo(() => {
    let rows = companies;
    if (statusFilter !== "all") {
      rows = rows.filter(c => {
        if (statusFilter === "ACTIVE") return c.status === "ACTIVE" && c.subscription?.status === "ACTIVE";
        if (statusFilter === "TRIALING") return c.subscription?.status === "TRIALING";
        if (statusFilter === "PAST_DUE") return c.subscription?.status === "PAST_DUE";
        if (statusFilter === "CANCELLED") return c.status !== "ACTIVE" || c.subscription?.status === "CANCELLED";
        return true;
      });
    }
    if (planFilter !== "all") {
      rows = rows.filter(c => (c.subscription?.planSlug ?? c.plan) === planFilter);
    }
    const term = search.trim().toLowerCase();
    if (term) {
      rows = rows.filter(c =>
        c.name.toLowerCase().includes(term) ||
        (c.slug ?? "").toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term) ||
        (c.document ?? "").toLowerCase().includes(term)
      );
    }
    return rows;
  }, [companies, statusFilter, planFilter, search]);

  const totalMrr = useMemo(() => companies.reduce((acc, c) => acc + c.mrr, 0), [companies]);

  return (
    <>
      <PageHeader
        title="Empresas"
        subtitle={`${companies.length} tenants · MRR total ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalMrr)}`}
        actions={
          <>
            <span className="env-pill"><span className="dot" /> PRODUCTION</span>
            <button type="button" className="btn btn-ghost" onClick={() => load()} disabled={loadingList}>
              <RefreshCcw size={15} /> Atualizar
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
              <Plus size={15} /> Nova empresa
            </button>
          </>
        }
      />

      {error ? <div className="error-box">{error}</div> : null}

      <section className="panel">
        <div className="panel__head" style={{ flexDirection: "column", alignItems: "stretch", gap: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className={`chip-tab ${statusFilter === "all" ? "is-on" : ""}`} onClick={() => setStatusFilter("all")}>Todas</button>
            <button type="button" className={`chip-tab ${statusFilter === "ACTIVE" ? "is-on" : ""}`} onClick={() => setStatusFilter("ACTIVE")}>Ativas</button>
            <button type="button" className={`chip-tab ${statusFilter === "TRIALING" ? "is-on" : ""}`} onClick={() => setStatusFilter("TRIALING")}>Trial</button>
            <button type="button" className={`chip-tab ${statusFilter === "PAST_DUE" ? "is-on" : ""}`} onClick={() => setStatusFilter("PAST_DUE")}>Inadimplentes</button>
            <button type="button" className={`chip-tab ${statusFilter === "CANCELLED" ? "is-on" : ""}`} onClick={() => setStatusFilter("CANCELLED")}>Canceladas/Suspensas</button>
            <select className="chip-tab" value={planFilter} onChange={e => setPlanFilter(e.target.value)} style={{ marginLeft: "auto" }}>
              <option value="all">Todos os planos</option>
              {plans.map(p => <option key={p.id} value={p.slug}>{p.name}</option>)}
            </select>
          </div>
          <div className="inline-search">
            <Search size={14} />
            <input
              type="search"
              placeholder="Buscar por nome, slug, e-mail ou documento..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="panel__body panel__body--flush">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon"><Building2 size={24} /></div>
              <h3>Nenhuma empresa no filtro</h3>
              <p>Ajuste a busca, troque o filtro de status ou crie uma nova empresa.</p>
            </div>
          ) : (
            <div className="table-wrap" style={{ borderRadius: 0, border: 0, boxShadow: "none" }}>
              <table>
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>Plano</th>
                    <th className="col-hide-mobile">Usuários</th>
                    <th>MRR</th>
                    <th className="col-hide-mobile">Saúde</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, idx) => {
                    const avtClass = `av-${(idx % 8) + 1}`;
                    const initials = c.name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
                    const subStatus = c.subscription?.status ?? null;
                    let statusCls = "status-dot--churned";
                    let statusLabel = "Sem assinatura";
                    if (c.status === "SUSPENDED") {
                      statusCls = "status-dot--churned"; statusLabel = "Suspensa";
                    } else if (subStatus === "ACTIVE") {
                      statusCls = "status-dot--active"; statusLabel = "Ativa";
                    } else if (subStatus === "TRIALING") {
                      statusCls = "status-dot--trial"; statusLabel = "Trial";
                    } else if (subStatus === "PAST_DUE") {
                      statusCls = "status-dot--overdue"; statusLabel = "Inadimplente";
                    } else if (subStatus === "CANCELLED" || subStatus === "EXPIRED") {
                      statusCls = "status-dot--churned"; statusLabel = "Cancelada";
                    }
                    const planSlug = c.subscription?.planSlug ?? c.plan;
                    const planTagCls = planSlug === "max" ? "plan-tag--max" : planSlug === "pro" ? "plan-tag--pro" : planSlug === "starter" ? "plan-tag--starter" : "plan-tag--free";
                    return (
                      <tr key={c.id}>
                        <td>
                          <div className="biz">
                            <span className={`biz__avt ${avtClass}`}>{initials}</span>
                            <div>
                              <div className="biz__nm">{c.name}</div>
                              <div className="biz__sub">{c.slug ? `${c.slug} · ` : ""}{c.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <select
                            className="badge-select"
                            value={c.plan}
                            onChange={e => updatePlan(c, e.target.value)}
                            title={`Mudar plano de ${c.name}`}
                          >
                            {plans.length > 0 ? (
                              plans.map(p => <option key={p.id} value={p.slug}>{p.name}</option>)
                            ) : (
                              <>
                                <option value="starter">Starter</option>
                                <option value="pro">Pro</option>
                                <option value="max">Max</option>
                              </>
                            )}
                          </select>
                          <span className={`plan-tag ${planTagCls}`} style={{ marginLeft: 8 }}>{c.subscription?.planName ?? c.plan}</span>
                        </td>
                        <td className="col-hide-mobile">
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <Users size={13} /> {c.counts.users}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700 }}>
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c.mrr)}
                        </td>
                        <td className="col-hide-mobile">
                          <span className={`health health--${c.health}`}>
                            <span className="health__bar"><div style={{ width: c.health === "good" ? "80%" : c.health === "mid" ? "55%" : "28%" }} /></span>
                            <span className="health__v">{c.health === "good" ? "OK" : c.health === "mid" ? "MED" : "BAIXA"}</span>
                          </span>
                        </td>
                        <td>
                          <span className={`status-dot ${statusCls}`}>
                            <span className="d" /> {statusLabel}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {c.status === "ACTIVE" ? (
                            <button type="button" className="btn btn-sm btn-danger-ghost" onClick={() => updateStatus(c, "SUSPENDED")}>
                              <Ban size={12} /> Suspender
                            </button>
                          ) : (
                            <button type="button" className="btn btn-sm btn-ghost" onClick={() => updateStatus(c, "ACTIVE")}>
                              Reativar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {createOpen ? (
        <NewCompanyModal
          plans={plans}
          onClose={() => setCreateOpen(false)}
          onSaved={() => { setCreateOpen(false); load(); }}
        />
      ) : null}
    </>
  );
}

function NewCompanyModal({
  plans,
  onClose,
  onSaved
}: {
  plans: AnyRecord[];
  onClose: () => void;
  onSaved: () => void;
}) {
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiFetch("/api/companies", { method: "POST", body: JSON.stringify(form) });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
        <div className="preview-modal__header">
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Nova empresa</h2>
          <button type="button" className="icon-button secondary" onClick={onClose} aria-label="Fechar"><X size={16} /></button>
        </div>

        {error ? <div className="error-box" style={{ marginTop: 16 }}>{error}</div> : null}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16, marginTop: 16 }}>
          <div className="form-grid">
            <Input label="Razão social *" value={form.name} onChange={(name) => setForm({ ...form, name })} required />
            <Input label="Nome fantasia" value={form.tradeName} onChange={(tradeName) => setForm({ ...form, tradeName })} />
            <Input label="E-mail *" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} required />
            <Input label="Telefone" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />
            <Input label="CNPJ / CPF" value={form.document} onChange={(document) => setForm({ ...form, document })} />
            <div className="field">
              <label>Segmento</label>
              <select value={form.segment} onChange={e => setForm({ ...form, segment: e.target.value })}>
                {segments.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Plano inicial</label>
              <select value={form.plan} onChange={e => setForm({ ...form, plan: e.target.value })}>
                {plans.length > 0 ? plans.map(p => (
                  <option key={p.id} value={p.slug}>
                    {p.name} — {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(p.price ?? 0))}/mês
                  </option>
                )) : (
                  <>
                    <option value="starter">Starter</option>
                    <option value="pro">Pro</option>
                    <option value="max">Max</option>
                  </>
                )}
              </select>
            </div>
            <Input label="Admin nome" value={form.adminName} onChange={(adminName) => setForm({ ...form, adminName })} />
            <Input label="Admin e-mail" type="email" value={form.adminEmail} onChange={(adminEmail) => setForm({ ...form, adminEmail })} />
            <Input label="Admin senha" value={form.adminPassword} onChange={(adminPassword) => setForm({ ...form, adminPassword })} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Plus size={14} /> {saving ? "Criando..." : "Criar empresa"}
            </button>
          </div>
        </form>
      </div>
    </div>
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
