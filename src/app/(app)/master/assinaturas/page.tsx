"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CreditCard,
  DollarSign,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { apiFetch } from "@/lib/client-api";

type Metrics = {
  mrr: number;
  prevMrr: number;
  mrrGrowth: number;
  mrrDelta: number;
  arr: number;
  activeSubs: number;
  trialingSubs: number;
  pastDueCount: number;
  cancelledLast30: number;
  newSubsThisMonth: number;
  trialConverting: number;
  trialPipelineMrr: number;
  conversionRate: number;
};

type MrrMonth = { month: string; mrr: number; newSubs: number };

type PlanMix = { planId: string; planName: string; planSlug: string; count: number; mrr: number };

type Subscription = {
  id: string;
  status: "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELLED" | "EXPIRED";
  startsAt: string;
  endsAt: string | null;
  trialEndsAt: string | null;
  canceledAt: string | null;
  currentPeriodEnd: string | null;
  pastDueSince: string | null;
  lastPaymentStatus: string | null;
  createdAt: string;
  gatewaySubscriptionId: string | null;
  planName: string | null;
  planSlug: string | null;
  price: number;
  company: { id: string; name: string; slug: string | null; segment: string };
};

type PaymentEvent = {
  id: string;
  type: string;
  status: string;
  processedAt: string;
  companyName: string;
  planName: string;
  amount: number;
};

type Response = {
  metrics: Metrics;
  mrrByMonth: MrrMonth[];
  planMix: PlanMix[];
  subscriptions: Subscription[];
  paymentEvents: PaymentEvent[];
};

type StatusFilter = "all" | "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELLED";

const STATUS_LABEL: Record<Subscription["status"], string> = {
  ACTIVE: "Ativa",
  TRIALING: "Trial",
  PAST_DUE: "Inadimplente",
  CANCELLED: "Cancelada",
  EXPIRED: "Expirada"
};

const STATUS_DOT: Record<Subscription["status"], string> = {
  ACTIVE: "status-dot--active",
  TRIALING: "status-dot--trial",
  PAST_DUE: "status-dot--overdue",
  CANCELLED: "status-dot--churned",
  EXPIRED: "status-dot--churned"
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(new Date(value));
}

function monthLabel(yyyymm: string) {
  const [y, m] = yyyymm.split("-");
  const labels = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${labels[Number(m) - 1]}/${y.slice(2)}`;
}

function planTagClass(slug: string | null | undefined): string {
  if (slug === "max") return "plan-tag--max";
  if (slug === "pro") return "plan-tag--pro";
  if (slug === "starter") return "plan-tag--starter";
  return "plan-tag--free";
}

export default function MasterAssinaturasPage() {
  const [data, setData] = useState<Response | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const load = useCallback(async () => {
    try {
      const result = await apiFetch<Response>("/api/master/subscriptions");
      setData(result);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let rows = data.subscriptions;
    if (statusFilter !== "all") {
      rows = rows.filter(s => s.status === statusFilter);
    }
    const term = search.trim().toLowerCase();
    if (term) {
      rows = rows.filter(s =>
        s.company.name.toLowerCase().includes(term) ||
        (s.company.slug ?? "").toLowerCase().includes(term) ||
        (s.planName ?? "").toLowerCase().includes(term)
      );
    }
    return rows;
  }, [data, statusFilter, search]);

  const maxMrr = data ? Math.max(...data.mrrByMonth.map(m => m.mrr), 1) : 1;
  const totalActiveSubs = data ? data.planMix.reduce((acc, p) => acc + p.count, 0) : 0;

  if (!data) {
    return (
      <>
        <PageHeader title="Assinaturas & MRR" subtitle="Receita recorrente, churn e cohorts" />
        {error ? <div className="error-box">{error}</div> : <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><div className="loading-spinner" /></div>}
      </>
    );
  }

  const m = data.metrics;

  return (
    <>
      <PageHeader
        title="Assinaturas & MRR"
        subtitle={`${m.activeSubs} ativas · ${m.trialingSubs} em trial · ${formatMoney(m.mrr)} de MRR`}
        actions={
          <span className="env-pill"><span className="dot" /> PRODUCTION</span>
        }
      />

      {error ? <div className="error-box">{error}</div> : null}

      {/* KPIs */}
      <div className="grid cols-4" style={{ marginBottom: 22 }}>
        <Kpi label="MRR atual" value={formatMoney(m.mrr)} icon={<DollarSign size={18} />} delta={m.mrrDelta} />
        <Kpi label="ARR projetado" value={formatMoney(m.arr)} icon={<TrendingUp size={18} />} variant="emerald" hint={`Cresc. ${formatMoney(m.mrrGrowth)}/mês`} />
        <Kpi label="Trials ativos" value={String(m.trialingSubs)} icon={<Sparkles size={18} />} variant="sky" hint={`${m.trialConverting} convertem em 7d`} />
        <Kpi label="Churn 30d" value={String(m.cancelledLast30)} icon={<TrendingDown size={18} />} variant="rose" hint={`${m.pastDueCount} inadimplentes`} />
      </div>

      {/* MRR chart + plan mix */}
      <div className="grid cols-2" style={{ marginBottom: 20 }}>
        <section className="panel">
          <div className="panel__head">
            <div>
              <div className="panel__title">MRR — últimos 6 meses</div>
              <div className="panel__sub">Cresc. {m.mrrDelta >= 0 ? "+" : ""}{m.mrrDelta}% vs mês anterior</div>
            </div>
          </div>
          <div className="panel__body">
            <div className="bar-chart" style={{ height: 180 }}>
              {data.mrrByMonth.map(month => {
                const pct = (month.mrr / maxMrr) * 100;
                return (
                  <div key={month.month} style={{ flex: 1, minWidth: 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 6 }} title={`${monthLabel(month.month)}: ${formatMoney(month.mrr)} · ${month.newSubs} novas`}>
                    <span style={{ fontSize: 10, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
                      {formatMoney(month.mrr).replace("R$", "").trim()}
                    </span>
                    <div style={{ width: "100%", height: `${Math.max(pct, 4)}%`, background: "linear-gradient(180deg, var(--violet, #8b5cf6), var(--violet-hover, #7c3aed))", borderRadius: "4px 4px 0 0" }} />
                    <span style={{ fontSize: 10, color: "var(--muted)" }}>{monthLabel(month.month)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel__head">
            <div>
              <div className="panel__title">Distribuição por plano</div>
              <div className="panel__sub">{totalActiveSubs} assinaturas em curso</div>
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
                      <span className="hbar__value">{formatMoney(p.mrr)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Subscriptions table */}
      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="panel__head" style={{ flexDirection: "column", alignItems: "stretch", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div className="panel__title">Assinaturas</div>
              <div className="panel__sub">{filtered.length} de {data.subscriptions.length} exibidas</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className={`chip-tab ${statusFilter === "all" ? "is-on" : ""}`} onClick={() => setStatusFilter("all")}>Todas</button>
              <button type="button" className={`chip-tab ${statusFilter === "ACTIVE" ? "is-on" : ""}`} onClick={() => setStatusFilter("ACTIVE")}>Ativas</button>
              <button type="button" className={`chip-tab ${statusFilter === "TRIALING" ? "is-on" : ""}`} onClick={() => setStatusFilter("TRIALING")}>Trial</button>
              <button type="button" className={`chip-tab ${statusFilter === "PAST_DUE" ? "is-on" : ""}`} onClick={() => setStatusFilter("PAST_DUE")}>Inadimplentes</button>
              <button type="button" className={`chip-tab ${statusFilter === "CANCELLED" ? "is-on" : ""}`} onClick={() => setStatusFilter("CANCELLED")}>Canceladas</button>
            </div>
          </div>
          <div className="inline-search">
            <Search size={14} />
            <input type="search" placeholder="Buscar por empresa, slug ou plano..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="panel__body panel__body--flush">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon"><CreditCard size={24} /></div>
              <h3>Nenhuma assinatura no filtro</h3>
              <p>Ajuste a busca ou troque o filtro.</p>
            </div>
          ) : (
            <div className="table-wrap" style={{ borderRadius: 0, border: 0, boxShadow: "none" }}>
              <table>
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>Plano</th>
                    <th>Status</th>
                    <th className="col-hide-mobile">Próximo ciclo</th>
                    <th style={{ textAlign: "right" }}>MRR</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s, idx) => {
                    const avtClass = `av-${(idx % 8) + 1}`;
                    const initials = s.company.name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
                    return (
                      <tr key={s.id}>
                        <td>
                          <div className="biz">
                            <span className={`biz__avt ${avtClass}`}>{initials}</span>
                            <div>
                              <div className="biz__nm">{s.company.name}</div>
                              <div className="biz__sub">{s.company.slug ?? s.company.segment.toLowerCase()}</div>
                            </div>
                          </div>
                        </td>
                        <td><span className={`plan-tag ${planTagClass(s.planSlug)}`}>{s.planName ?? "—"}</span></td>
                        <td>
                          <span className={`status-dot ${STATUS_DOT[s.status]}`}>
                            <span className="d" /> {STATUS_LABEL[s.status]}
                          </span>
                        </td>
                        <td className="col-hide-mobile" style={{ fontSize: 12, color: "var(--muted)" }}>
                          {s.status === "TRIALING" ? `Trial até ${formatDate(s.trialEndsAt)}` :
                           s.status === "PAST_DUE" ? `Atrasada desde ${formatDate(s.pastDueSince)}` :
                           s.status === "CANCELLED" ? `Encerrada em ${formatDate(s.canceledAt)}` :
                           formatDate(s.currentPeriodEnd)}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>{formatMoney(s.price)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Recent payment events */}
      <section className="panel">
        <div className="panel__head">
          <div>
            <div className="panel__title">Últimos eventos de pagamento</div>
            <div className="panel__sub">Webhooks processados do Mercado Pago</div>
          </div>
        </div>
        <div className="panel__body panel__body--flush">
          {data.paymentEvents.length === 0 ? (
            <div className="empty">Sem eventos registrados.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Tipo</th>
                  <th>Status</th>
                  <th className="col-hide-mobile">Processado</th>
                  <th style={{ textAlign: "right" }}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {data.paymentEvents.map(e => {
                  const ok = e.status === "approved" || e.status === "PAID";
                  return (
                    <tr key={e.id}>
                      <td><strong style={{ fontSize: 13 }}>{e.companyName}</strong></td>
                      <td><span className="pill pill--info" style={{ textTransform: "lowercase" }}>{e.type}</span></td>
                      <td>{ok ? <span className="pill pill--success"><span className="dot-s" />OK</span> : <span className="pill pill--warn">{e.status}</span>}</td>
                      <td className="col-hide-mobile" style={{ fontSize: 12, color: "var(--muted)" }}>{formatDate(e.processedAt)}</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>{formatMoney(e.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  );
}

function Kpi({
  label, value, icon, variant = "default", delta, hint
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  variant?: "default" | "emerald" | "sky" | "rose" | "amber" | "teal";
  delta?: number;
  hint?: string;
}) {
  const variantCls = variant === "default" ? "" : `kpi--${variant}`;
  return (
    <div className={`kpi ${variantCls}`}>
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
        {hint ? <span>{hint}</span> : null}
      </div>
    </div>
  );
}
