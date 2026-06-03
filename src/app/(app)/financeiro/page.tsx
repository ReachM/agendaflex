"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  FolderTree,
  MoreVertical,
  Plus,
  Search,
  Settings2,
  Tag,
  TrendingUp,
  Wallet,
  X
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { apiFetch } from "@/lib/client-api";
import "./financeiro.css";

type FlowType = "REVENUE" | "COST" | "EXPENSE";
type PaymentStatus = "PENDING" | "PAID" | "PARTIALLY_PAID" | "CANCELLED" | "REFUNDED";

type Category = {
  id: string;
  name: string;
  type: FlowType;
  color: string | null;
  sortOrder: number;
  isActive: boolean;
};

type Account = {
  id: string;
  name: string;
  type: "CHECKING" | "SAVINGS" | "CASH" | "OTHER";
  initialBalance: number;
  isActive: boolean;
  sortOrder: number;
  currentBalance?: number;
};

type FinancialRecord = {
  id: string;
  description: string | null;
  amount: number;
  flowType: FlowType;
  type: string;
  paymentStatus: PaymentStatus;
  paymentMethod: string | null;
  paidAt: string | null;
  dueDate: string | null;
  createdAt: string;
  appointment?: { id: string; startAt: string; status: string } | null;
  customer?: { id: string; name: string } | null;
  category?: { id: string; name: string; color: string | null } | null;
  account?: { id: string; name: string; type: string } | null;
};

type DashboardData = {
  summary: {
    revenue: number;
    cost: number;
    expense: number;
    profit: number;
    margin: number;
    dayRevenue: number;
    monthRevenue: number;
    receivable: number;
    receivableCount: number;
  };
  cashFlow14d: { date: string; revenue: number; expense: number }[];
  dre: { revenue: number; cost: number; expense: number; profit: number; margin: number };
  aging: { upcoming: number; overdue1to7: number; overdue8to30: number; overdue30plus: number };
  agingItems: {
    id: string;
    amount: number;
    dueDate: string;
    customerName: string | null;
    description: string | null;
    bucket: "upcoming" | "overdue1to7" | "overdue8to30" | "overdue30plus";
  }[];
  topExpenseCategories: { categoryId: string | null; categoryName: string; color: string | null; total: number; count: number }[];
  paymentDistribution: { method: string | null; total: number; count: number }[];
  categories: Category[];
  accounts: Account[];
  records: FinancialRecord[];
};

type Range = "today" | "week" | "month" | "quarter" | "year";

const RANGE_LABELS: { id: Range; label: string }[] = [
  { id: "today", label: "Hoje" },
  { id: "week", label: "Semana" },
  { id: "month", label: "Mês" },
  { id: "quarter", label: "Trimestre" },
  { id: "year", label: "Ano" }
];

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Dinheiro",
  PIX: "PIX",
  CREDIT_CARD: "Cartão crédito",
  DEBIT_CARD: "Cartão débito",
  BOLETO: "Boleto",
  TRANSFER: "Transferência",
  OTHER: "Outro"
};

const STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Pendente",
  PAID: "Pago",
  PARTIALLY_PAID: "Parcial",
  CANCELLED: "Cancelado",
  REFUNDED: "Estornado"
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function formatCompact(value: number): string {
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(1).replace(".", ",")}k`;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(new Date(value));
}

function formatDateShort(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(value));
}

function formatPeriodLabel(range: Range): string {
  const now = new Date();
  if (range === "today") {
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(now);
  }
  if (range === "week") {
    const start = new Date(now);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const sFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
    return `${sFmt.format(start)} – ${sFmt.format(end)}`;
  }
  if (range === "month") {
    return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(now);
  }
  if (range === "quarter") {
    const q = Math.floor(now.getMonth() / 3) + 1;
    return `${q}º trimestre ${now.getFullYear()}`;
  }
  return String(now.getFullYear());
}

const PAYMENT_GROUP_COLOR: Record<string, string> = {
  PIX: "var(--primary)",
  CREDIT_CARD: "var(--info)",
  DEBIT_CARD: "var(--accent)",
  CASH: "#cbd5e1",
  BOLETO: "#a78bfa",
  TRANSFER: "#475569",
  OTHER: "#94a3b8"
};

const CATEGORY_GRADIENTS = [
  { color: "var(--accent)", colorLight: "var(--accent-light)", gradient: "linear-gradient(90deg, var(--accent), #fbbf24)" },
  { color: "#9333ea",       colorLight: "#f3e8ff",            gradient: "linear-gradient(90deg, #9333ea, #a855f7)" },
  { color: "var(--info)",   colorLight: "var(--info-light)",  gradient: "linear-gradient(90deg, var(--info), #60a5fa)" },
  { color: "var(--danger)", colorLight: "var(--danger-light)", gradient: "linear-gradient(90deg, var(--danger), #f87171)" },
  { color: "var(--success)", colorLight: "var(--success-light)", gradient: "linear-gradient(90deg, var(--success), #4ade80)" },
  { color: "#0891b2",       colorLight: "#cffafe",            gradient: "linear-gradient(90deg, #0891b2, #06b6d4)" }
];

function hashString(s: string): number {
  let h = 0;
  for (const c of s) h = c.charCodeAt(0) + ((h << 5) - h);
  return Math.abs(h);
}

function categoryStyle(name: string) {
  return CATEGORY_GRADIENTS[hashString(name) % CATEGORY_GRADIENTS.length];
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data?.length) return <div className="fkpi__sparkline" />;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 200;
  const h = 40;
  const step = data.length > 1 ? w / (data.length - 1) : w;
  const points = data.map((v, i) => `${i * step},${(h - 2) - ((v - min) / range) * (h - 6)}`).join(" ");
  const area = `${points} ${w},${h} 0,${h}`;
  const fill = color + "20";

  return (
    <svg className="fkpi__sparkline" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline fill={fill} stroke="none" points={area} />
      <polyline fill="none" stroke={color} strokeWidth="2" points={points} />
    </svg>
  );
}

function rangeBounds(range: Range): { from: string; to: string } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (range === "week") {
    start.setDate(start.getDate() - start.getDay());
  } else if (range === "month") {
    start.setDate(1);
  } else if (range === "quarter") {
    const q = Math.floor(start.getMonth() / 3);
    start.setMonth(q * 3, 1);
  } else if (range === "year") {
    start.setMonth(0, 1);
  }
  return { from: start.toISOString(), to: end.toISOString() };
}

export default function FinanceiroPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>("month");
  const [accountFilter, setAccountFilter] = useState<string>("");
  const [tab, setTab] = useState<"all" | "REVENUE" | "EXPENSE">("all");
  const [txSearch, setTxSearch] = useState("");
  const [newRecordOpen, setNewRecordOpen] = useState<null | "REVENUE" | "EXPENSE">(null);
  const [manageOpen, setManageOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { from, to } = rangeBounds(range);
    const params = new URLSearchParams({ from, to });
    if (accountFilter) params.set("accountId", accountFilter);
    try {
      const result = await apiFetch<DashboardData>(`/api/financial?${params}`);
      setData(result);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [range, accountFilter]);

  useEffect(() => { void load(); }, [load]);

  const filteredRecords = useMemo(() => {
    if (!data) return [];
    let list = data.records;
    if (tab === "REVENUE") list = list.filter(r => r.flowType === "REVENUE");
    else if (tab === "EXPENSE") list = list.filter(r => r.flowType === "EXPENSE" || r.flowType === "COST");
    if (txSearch.trim()) {
      const q = txSearch.trim().toLowerCase();
      list = list.filter(r =>
        (r.description ?? "").toLowerCase().includes(q) ||
        (r.category?.name ?? "").toLowerCase().includes(q) ||
        (r.customer?.name ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [data, tab, txSearch]);

  const txCounts = useMemo(() => {
    if (!data) return { all: 0, revenue: 0, expense: 0 };
    const revenue = data.records.filter(r => r.flowType === "REVENUE").length;
    const expense = data.records.filter(r => r.flowType !== "REVENUE").length;
    return { all: data.records.length, revenue, expense };
  }, [data]);

  const sparklines = useMemo(() => {
    if (!data) return { income: [], expense: [], balance: [], receivable: [] as number[] };
    const income = data.cashFlow14d.map(d => d.revenue);
    const expense = data.cashFlow14d.map(d => d.expense);
    const balance = data.cashFlow14d.map(d => d.revenue - d.expense);
    return { income, expense, balance, receivable: [] as number[] };
  }, [data]);

  const overdueCount = useMemo(() => {
    if (!data) return 0;
    return data.agingItems.filter(i => i.bucket !== "upcoming").length;
  }, [data]);

  const cashFlowMax = useMemo(() => {
    if (!data?.cashFlow14d.length) return 1;
    return Math.max(...data.cashFlow14d.flatMap(d => [d.revenue, d.expense]), 1);
  }, [data]);

  const accumulated = useMemo(() => {
    if (!data) return 0;
    return data.cashFlow14d.reduce((acc, d) => acc + (d.revenue - d.expense), 0);
  }, [data]);

  const cashflowSubtitle = useMemo(() => {
    if (!data) return "";
    return data.records.length > 0
      ? `Últimos 7 dias · ${data.records.length} lançamentos`
      : "Últimos 7 dias";
  }, [data]);

  const topExpensesNormalized = useMemo(() => {
    if (!data?.topExpenseCategories.length) return [];
    const totalAll = data.topExpenseCategories.reduce((acc, c) => acc + c.total, 0) || 1;
    const max = Math.max(...data.topExpenseCategories.map(c => c.total), 1);
    return data.topExpenseCategories.slice(0, 6).map(c => {
      const style = categoryStyle(c.categoryName);
      return {
        ...c,
        pct: Math.round((c.total / totalAll) * 100),
        barWidth: Math.round((c.total / max) * 100),
        ...style
      };
    });
  }, [data]);

  const payment = useMemo(() => {
    if (!data?.paymentDistribution.length) {
      return { total: 0, pix: 0, credit: 0, debit: 0, cash: 0, other: 0, pixPct: 0, creditPct: 0, debitPct: 0, cashPct: 0, otherPct: 0 };
    }
    const byMethod = (m: string) => data.paymentDistribution.find(p => p.method === m)?.total ?? 0;
    const pix = byMethod("PIX");
    const credit = byMethod("CREDIT_CARD");
    const debit = byMethod("DEBIT_CARD");
    const cash = byMethod("CASH");
    const otherKnown = pix + credit + debit + cash;
    const total = data.paymentDistribution.reduce((acc, p) => acc + p.total, 0);
    const other = Math.max(0, total - otherKnown);
    const pct = (v: number) => total > 0 ? Math.round((v / total) * 100) : 0;
    return {
      total,
      pix, credit, debit, cash, other,
      pixPct: pct(pix),
      creditPct: pct(credit),
      debitPct: pct(debit),
      cashPct: pct(cash),
      otherPct: pct(other)
    };
  }, [data]);

  const aging = useMemo(() => {
    if (!data) return null;
    const { upcoming, overdue1to7, overdue8to30, overdue30plus } = data.aging;
    const total = upcoming + overdue1to7 + overdue8to30 + overdue30plus;
    const pct = (v: number) => total > 0 ? Math.round((v / total) * 100) : 0;
    return {
      total,
      count: data.agingItems.length,
      upcoming, overdue7: overdue1to7, overdue30: overdue8to30, overdueOld: overdue30plus,
      upcomingPct: pct(upcoming),
      overdue7Pct: pct(overdue1to7),
      overdue30Pct: pct(overdue8to30),
      overdueOldPct: pct(overdue30plus)
    };
  }, [data]);

  function txMeta(r: FinancialRecord): string {
    if (r.customer?.name) return r.customer.name;
    if (r.account?.name) return r.account.name;
    if (r.appointment?.id) return "Agendamento";
    return STATUS_LABELS[r.paymentStatus];
  }

  function exportCsv() {
    if (!data) return;
    const rows = [
      ["Data", "Descrição", "Fluxo", "Categoria", "Conta", "Método", "Status", "Valor"],
      ...data.records.map(r => [
        formatDate(r.createdAt),
        r.description ?? "",
        r.flowType,
        r.category?.name ?? "",
        r.account?.name ?? "",
        r.paymentMethod ? (PAYMENT_METHOD_LABELS[r.paymentMethod] ?? r.paymentMethod) : "",
        STATUS_LABELS[r.paymentStatus],
        r.amount.toFixed(2).replace(".", ",")
      ])
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financeiro-${range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalExpensesPeriod = data ? data.summary.cost + data.summary.expense : 0;

  return (
    <>
      <PageHeader
        title="Financeiro"
        subtitle="Fluxo de caixa, lançamentos e DRE simplificado"
        actions={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setManageOpen(true)}>
              <Settings2 size={15} />
              Gerenciar
            </button>
            <button type="button" className="btn btn-ghost" onClick={exportCsv} disabled={!data}>
              <Download size={15} />
              Exportar
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setNewRecordOpen("EXPENSE")}>
              <ArrowDownLeft size={15} />
              Nova despesa
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setNewRecordOpen("REVENUE")}>
              <ArrowUpRight size={15} />
              Nova entrada
            </button>
          </>
        }
      />

      {/* ── Barra de período ── */}
      <div className="fin-bar">
        <div className="fin-bar__left">
          <div className="date-range">
            <Calendar size={14} />
            {formatPeriodLabel(range)}
            <span className="arrows">
              <button type="button" aria-label="Período anterior"><ChevronLeft size={11} /></button>
              <button type="button" aria-label="Próximo período"><ChevronRight size={11} /></button>
            </span>
          </div>
          <div className="range-pill" role="tablist" aria-label="Período">
            {RANGE_LABELS.map(r => (
              <button
                key={r.id}
                type="button"
                className={range === r.id ? "is-active" : ""}
                onClick={() => setRange(r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div className="fin-bar__right">
          {data?.accounts.length ? (
            <select
              className="select"
              value={accountFilter}
              onChange={e => setAccountFilter(e.target.value)}
              style={{ height: 34, width: "auto", minWidth: 160 }}
            >
              <option value="">Todas as contas</option>
              {data.accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      {error ? <div className="error-box">{error}</div> : null}

      {loading && !data ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <div className="loading-spinner" />
        </div>
      ) : data ? (
        <>
          {/* ── KPIs ── */}
          <section className="kpi-grid">
            <article className="fkpi">
              <div className="fkpi__row">
                <span className="fkpi__label">Entradas</span>
                <span className="fkpi__icon"><ArrowUpRight size={16} /></span>
              </div>
              <div className="fkpi__value">
                <span className="unit">R$</span>
                {formatNumber(data.summary.revenue)}
              </div>
              <div className="fkpi__delta">
                <strong>{txCounts.revenue}</strong>
                lançamentos no período
              </div>
              <Sparkline data={sparklines.income} color="#16a34a" />
            </article>

            <article className="fkpi fkpi--out">
              <div className="fkpi__row">
                <span className="fkpi__label">Saídas</span>
                <span className="fkpi__icon"><ArrowDownLeft size={16} /></span>
              </div>
              <div className="fkpi__value">
                <span className="unit">R$</span>
                {formatNumber(totalExpensesPeriod)}
              </div>
              <div className="fkpi__delta">
                <strong className="down">{txCounts.expense}</strong>
                lançamentos no período
              </div>
              <Sparkline data={sparklines.expense} color="#dc2626" />
            </article>

            <article className="fkpi fkpi--bal">
              <div className="fkpi__row">
                <span className="fkpi__label">Saldo do período</span>
                <span className="fkpi__icon"><TrendingUp size={16} /></span>
              </div>
              <div className="fkpi__value">
                <span className="unit">R$</span>
                {formatNumber(data.summary.profit)}
              </div>
              <div className="fkpi__delta">
                <strong>{data.summary.margin}%</strong>
                margem de lucro
              </div>
              <Sparkline data={sparklines.balance} color="#0d9488" />
            </article>

            <article className="fkpi fkpi--rec">
              <div className="fkpi__row">
                <span className="fkpi__label">A receber</span>
                <span className="fkpi__icon"><Clock size={16} /></span>
              </div>
              <div className="fkpi__value">
                <span className="unit">R$</span>
                {formatNumber(data.summary.receivable)}
              </div>
              <div className="fkpi__delta">
                <strong className="warn">{data.summary.receivableCount} títulos</strong>
                {overdueCount > 0 ? `${overdueCount} vencido${overdueCount > 1 ? "s" : ""}` : "em dia"}
              </div>
              <Sparkline data={sparklines.receivable.length > 0 ? sparklines.receivable : [0,0,0,0]} color="#d97706" />
            </article>
          </section>

          {/* ── DRE simplificado ── */}
          <section className="dre">
            <div className="dre-card">
              <div className="dre-card__l">Receita bruta</div>
              <div className="dre-card__v">{formatMoney(data.dre.revenue)}</div>
              <div className="dre-card__d">{txCounts.revenue} entradas</div>
            </div>
            <div className="dre-card">
              <div className="dre-card__l">(−) Custos diretos</div>
              <div className="dre-card__v" style={{ color: "var(--danger)" }}>{formatMoney(data.dre.cost)}</div>
              <div className="dre-card__d">Produtos · comissões</div>
            </div>
            <div className="dre-card">
              <div className="dre-card__l">(−) Despesas operacionais</div>
              <div className="dre-card__v" style={{ color: "var(--danger)" }}>{formatMoney(data.dre.expense)}</div>
              <div className="dre-card__d">Aluguel · luz · marketing</div>
            </div>
            <div className="dre-card dre-card--profit">
              <div className="dre-card__l">= Lucro líquido</div>
              <div className="dre-card__v">{formatMoney(data.dre.profit)}</div>
              <div className="dre-card__d">Margem {data.dre.margin}%</div>
            </div>
          </section>

          {/* ── Grid principal: Cashflow + Top despesas ── */}
          <section className="grid-main">
            <article className="panel">
              <div className="panel__head">
                <div>
                  <div className="panel__title">Fluxo de caixa — últimos 14 dias</div>
                  <div className="panel__sub">Entradas e saídas diárias</div>
                </div>
              </div>
              <div className="cashflow">
                <div className="cashflow__legend">
                  <span><i style={{ background: "var(--success)" }} /> Entradas</span>
                  <span><i style={{ background: "var(--danger)" }} /> Saídas</span>
                  <span style={{ marginLeft: "auto", color: "var(--muted)" }}>
                    Acumulado:{" "}
                    <strong style={{ color: accumulated >= 0 ? "var(--primary-hover)" : "var(--danger)" }}>
                      {accumulated >= 0 ? "+" : ""}{formatMoney(accumulated)}
                    </strong>
                  </span>
                </div>
                <div className="bars14">
                  {data.cashFlow14d.map(d => {
                    const inH = Math.max((d.revenue / cashFlowMax) * 100, d.revenue > 0 ? 2 : 0);
                    const outH = Math.max((d.expense / cashFlowMax) * 100, d.expense > 0 ? 2 : 0);
                    return (
                      <div key={d.date} className="col">
                        <div className="tip">
                          <strong>+{formatCompact(d.revenue)}</strong> / -{formatCompact(d.expense)}
                        </div>
                        <div className="stack">
                          <div className="in" style={{ height: `${inH}%` }} />
                          <div className="out" style={{ height: `${outH}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="x-axis">
                  {data.cashFlow14d.map(d => (
                    <span key={d.date}>{formatDateShort(d.date)}</span>
                  ))}
                </div>
              </div>
            </article>

            <article className="panel">
              <div className="panel__head">
                <div>
                  <div className="panel__title">Top despesas — período</div>
                  <div className="panel__sub">{cashflowSubtitle.replace("Últimos 7 dias · ", "").replace("Últimos 7 dias", "")} Por categoria</div>
                </div>
              </div>
              {topExpensesNormalized.length === 0 ? (
                <div className="empty" style={{ padding: 20 }}>Sem despesas categorizadas no período.</div>
              ) : (
                <div className="cat-list">
                  {topExpensesNormalized.map(cat => (
                    <div key={cat.categoryId ?? cat.categoryName} className="cat-row">
                      <span className="cat-row__ico" style={{ background: cat.colorLight, color: cat.color }}>
                        <Tag size={14} />
                      </span>
                      <div className="cat-row__main">
                        <div className="cat-row__name">
                          {cat.categoryName}
                          <span className="cat-row__money">{formatMoney(cat.total)} <em>· {cat.pct}%</em></span>
                        </div>
                        <div className="cat-row__bar">
                          <div style={{ width: `${cat.barWidth}%`, background: cat.gradient }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </section>

          {/* ── Grid 2: Lançamentos + (A receber + Formas pgto) ── */}
          <section className="grid-main">
            <article className="panel">
              <div className="panel__head">
                <div>
                  <div className="panel__title">Lançamentos recentes</div>
                  <div className="panel__sub">{data.records.length} lançamentos no período</div>
                </div>
              </div>

              <div className="tx-filter">
                <button type="button"
                  className={`pill-tab${tab === "all" ? " is-on" : ""}`}
                  onClick={() => setTab("all")}>
                  Todos<span className="count">{txCounts.all}</span>
                </button>
                <button type="button"
                  className={`pill-tab${tab === "REVENUE" ? " is-on" : ""}`}
                  onClick={() => setTab("REVENUE")}>
                  Entradas<span className="count">{txCounts.revenue}</span>
                </button>
                <button type="button"
                  className={`pill-tab${tab === "EXPENSE" ? " is-on" : ""}`}
                  onClick={() => setTab("EXPENSE")}>
                  Saídas<span className="count">{txCounts.expense}</span>
                </button>
                <div className="grow">
                  <Search size={14} />
                  <input
                    type="search"
                    placeholder="Buscar lançamento…"
                    value={txSearch}
                    onChange={e => setTxSearch(e.target.value)}
                  />
                </div>
              </div>

              {filteredRecords.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state__icon"><DollarSign size={24} /></div>
                  <h3>Nenhum lançamento</h3>
                  <p>Ajuste o filtro ou cadastre uma nova entrada/despesa.</p>
                </div>
              ) : (
                <table className="tx-table">
                  <thead>
                    <tr>
                      <th>Descrição</th>
                      <th>Categoria</th>
                      <th>Pagamento</th>
                      <th>Data</th>
                      <th style={{ textAlign: "right" }}>Valor</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.slice(0, 30).map(r => {
                      const isOut = r.flowType !== "REVENUE";
                      const catStyle = r.category?.name ? categoryStyle(r.category.name) : null;
                      return (
                        <tr key={r.id} className={isOut ? "is-out" : ""}>
                          <td>
                            <div className="desc-cell">
                              <span className="ico-cell">
                                {isOut ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                              </span>
                              <div>
                                <div className="desc-main">{r.description ?? "—"}</div>
                                <div className="desc-sub">{txMeta(r)}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            {r.category?.name ? (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  padding: "2px 8px",
                                  borderRadius: 5,
                                  fontSize: 11,
                                  fontWeight: 600,
                                  background: catStyle?.colorLight ?? "var(--surface-muted)",
                                  color: catStyle?.color ?? "var(--muted)"
                                }}
                              >
                                {r.category.name}
                              </span>
                            ) : (
                              <span style={{ color: "var(--muted)", fontSize: 11 }}>—</span>
                            )}
                          </td>
                          <td>
                            <span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                              {r.paymentMethod ? (PAYMENT_METHOD_LABELS[r.paymentMethod] ?? r.paymentMethod) : "—"}
                            </span>
                          </td>
                          <td style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)" }}>
                            {formatDate(r.paidAt ?? r.createdAt)}
                          </td>
                          <td className="money">
                            {isOut ? "− " : "+ "}{formatMoney(r.amount)}
                          </td>
                          <td>
                            <div className="row-actions">
                              <button type="button" className="row-btn" aria-label="Mais opções">
                                <MoreVertical size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </article>

            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* A receber — aging */}
              {aging ? (
                <article className="panel">
                  <div className="panel__head">
                    <div>
                      <div className="panel__title">A receber — aging</div>
                      <div className="panel__sub">{aging.count} títulos · {formatMoney(aging.total)}</div>
                    </div>
                  </div>
                  {([
                    { label: "A vencer (próximos 30d)", value: aging.upcoming,    color: "var(--success)", barColor: "var(--success)", pct: aging.upcomingPct },
                    { label: "Vencido 1–7 dias",        value: aging.overdue7,    color: "var(--accent)",  barColor: "var(--accent)",  pct: aging.overdue7Pct },
                    { label: "Vencido 8–30 dias",       value: aging.overdue30,   color: "var(--danger)",  barColor: "var(--danger)",  pct: aging.overdue30Pct },
                    { label: "Vencido +30 dias",        value: aging.overdueOld,  color: "var(--danger)",  barColor: "#7f1d1d",        pct: aging.overdueOldPct }
                  ]).map(row => (
                    <div key={row.label} className="ar-row">
                      <div className="ar-row__main">
                        <div className="ar-row__nm">{row.label}</div>
                        <div className="ar-row__b">
                          <div style={{ width: `${row.pct}%`, background: row.barColor }} />
                        </div>
                      </div>
                      <div className="ar-row__v" style={{ color: row.color }}>{formatMoney(row.value)}</div>
                    </div>
                  ))}
                </article>
              ) : null}

              {/* Formas de pagamento */}
              <article className="panel">
                <div className="panel__head">
                  <div>
                    <div className="panel__title">Formas de pagamento</div>
                    <div className="panel__sub">Distribuição no período</div>
                  </div>
                </div>

                {payment.total === 0 ? (
                  <div className="empty" style={{ padding: 20 }}>Sem pagamentos no período.</div>
                ) : (
                  <>
                    <div
                      className="donut-pm"
                      style={{
                        background: `conic-gradient(
                          var(--primary) 0 ${payment.pixPct}%,
                          var(--info) ${payment.pixPct}% ${payment.pixPct + payment.creditPct}%,
                          var(--accent) ${payment.pixPct + payment.creditPct}% ${payment.pixPct + payment.creditPct + payment.debitPct}%,
                          #cbd5e1 ${payment.pixPct + payment.creditPct + payment.debitPct}% ${payment.pixPct + payment.creditPct + payment.debitPct + payment.cashPct}%,
                          #94a3b8 ${payment.pixPct + payment.creditPct + payment.debitPct + payment.cashPct}% 100%
                        )`
                      }}
                    >
                      <div className="donut-pm__center">
                        <div className="donut-pm__v">{formatCompact(payment.total)}</div>
                        <div className="donut-pm__l">Total</div>
                      </div>
                    </div>

                    <div className="pm-legend">
                      {[
                        { label: "PIX",      color: PAYMENT_GROUP_COLOR.PIX,         value: payment.pix,    pct: payment.pixPct,    show: payment.pix > 0 },
                        { label: "Crédito",  color: PAYMENT_GROUP_COLOR.CREDIT_CARD, value: payment.credit, pct: payment.creditPct, show: payment.credit > 0 },
                        { label: "Débito",   color: PAYMENT_GROUP_COLOR.DEBIT_CARD,  value: payment.debit,  pct: payment.debitPct,  show: payment.debit > 0 },
                        { label: "Dinheiro", color: PAYMENT_GROUP_COLOR.CASH,        value: payment.cash,   pct: payment.cashPct,   show: payment.cash > 0 },
                        { label: "Outros",   color: PAYMENT_GROUP_COLOR.OTHER,       value: payment.other,  pct: payment.otherPct,  show: payment.other > 0 }
                      ].filter(i => i.show).map(item => (
                        <div key={item.label} className="pm-legend__row">
                          <span className="dot" style={{ background: item.color }} />
                          <span className="nm">{item.label}</span>
                          <span className="v">{formatMoney(item.value)} · {item.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </article>
            </div>
          </section>
        </>
      ) : null}

      {newRecordOpen && data ? (
        <NewRecordModal
          initialFlow={newRecordOpen}
          categories={data.categories}
          accounts={data.accounts}
          onClose={() => setNewRecordOpen(null)}
          onSaved={() => { setNewRecordOpen(null); void load(); }}
        />
      ) : null}

      {manageOpen ? (
        <ManageModal
          categories={data?.categories ?? []}
          accounts={data?.accounts ?? []}
          onClose={() => setManageOpen(false)}
          onRefresh={load}
        />
      ) : null}
    </>
  );
}

function NewRecordModal({
  initialFlow,
  categories,
  accounts,
  onClose,
  onSaved
}: {
  initialFlow: "REVENUE" | "EXPENSE";
  categories: Category[];
  accounts: Account[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [flowType, setFlowType] = useState<FlowType>(initialFlow);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("PAID");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const filteredCategories = categories.filter(c => c.type === flowType);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiFetch("/api/financial", {
        method: "POST",
        body: JSON.stringify({
          flowType,
          description: description || null,
          amount: Number(amount.replace(/\./g, "").replace(",", ".")),
          categoryId: categoryId || null,
          accountId: accountId || null,
          paymentMethod: paymentMethod || null,
          paymentStatus,
          paidAt: paymentStatus === "PAID" ? paidAt : null,
          dueDate: dueDate || null
        })
      });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <div className="preview-modal__header">
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            {flowType === "REVENUE" ? "Nova entrada" : "Nova saída"}
          </h2>
          <button type="button" className="icon-button secondary" onClick={onClose} aria-label="Fechar"><X size={16} /></button>
        </div>

        {error ? <div className="error-box" style={{ marginTop: 16 }}>{error}</div> : null}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16, marginTop: 16 }}>
          <div className="tabs" style={{ alignSelf: "start" }}>
            <button type="button" className={`tab ${flowType === "REVENUE" ? "active" : ""}`} onClick={() => setFlowType("REVENUE")}>Entrada</button>
            <button type="button" className={`tab ${flowType === "EXPENSE" ? "active" : ""}`} onClick={() => setFlowType("EXPENSE")}>Despesa</button>
            <button type="button" className={`tab ${flowType === "COST" ? "active" : ""}`} onClick={() => setFlowType("COST")}>Custo direto</button>
          </div>

          <div className="form-grid">
            <div className="field full">
              <label>Descrição *</label>
              <input className="input" required value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex.: Pagamento de aluguel" />
            </div>
            <div className="field">
              <label>Valor *</label>
              <input className="input" required inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" />
            </div>
            <div className="field">
              <label>Categoria</label>
              <select className="select" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                <option value="">— Sem categoria —</option>
                {filteredCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Conta</label>
              <select className="select" value={accountId} onChange={e => setAccountId(e.target.value)}>
                <option value="">— Sem conta —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Método de pagamento</label>
              <select className="select" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                <option value="">—</option>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Status</label>
              <select className="select" value={paymentStatus} onChange={e => setPaymentStatus(e.target.value as PaymentStatus)}>
                {(Object.keys(STATUS_LABELS) as PaymentStatus[]).map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Pago em</label>
              <input className="input" type="date" value={paidAt} onChange={e => setPaidAt(e.target.value)} disabled={paymentStatus !== "PAID"} />
            </div>
            <div className="field">
              <label>Vencimento</label>
              <input className="input" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Salvando..." : "Salvar lançamento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ManageModal({
  categories,
  accounts,
  onClose,
  onRefresh
}: {
  categories: Category[];
  accounts: Account[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [tab, setTab] = useState<"categories" | "accounts">("categories");
  const [catName, setCatName] = useState("");
  const [catType, setCatType] = useState<FlowType>("EXPENSE");
  const [acctName, setAcctName] = useState("");
  const [acctType, setAcctType] = useState<Account["type"]>("CHECKING");
  const [acctInitial, setAcctInitial] = useState("0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await apiFetch("/api/financial/categories", {
        method: "POST",
        body: JSON.stringify({ name: catName, type: catType })
      });
      setCatName("");
      onRefresh();
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  async function removeCategory(id: string) {
    if (!confirm("Desativar esta categoria?")) return;
    try {
      await apiFetch(`/api/financial/categories/${id}`, { method: "DELETE" });
      onRefresh();
    } catch (err) { setError((err as Error).message); }
  }

  async function addAccount(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await apiFetch("/api/financial/accounts", {
        method: "POST",
        body: JSON.stringify({
          name: acctName,
          type: acctType,
          initialBalance: Number(acctInitial.replace(/\./g, "").replace(",", ".")) || 0
        })
      });
      setAcctName(""); setAcctInitial("0");
      onRefresh();
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  async function removeAccount(id: string) {
    if (!confirm("Desativar esta conta?")) return;
    try {
      await apiFetch(`/api/financial/accounts/${id}`, { method: "DELETE" });
      onRefresh();
    } catch (err) { setError((err as Error).message); }
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
        <div className="preview-modal__header">
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Gerenciar categorias e contas</h2>
          <button type="button" className="icon-button secondary" onClick={onClose} aria-label="Fechar"><X size={16} /></button>
        </div>

        <div className="tabs" style={{ marginTop: 16, alignSelf: "start" }}>
          <button type="button" className={`tab ${tab === "categories" ? "active" : ""}`} onClick={() => setTab("categories")}>
            <FolderTree size={14} style={{ marginRight: 6 }} /> Categorias
          </button>
          <button type="button" className={`tab ${tab === "accounts" ? "active" : ""}`} onClick={() => setTab("accounts")}>
            <Building2 size={14} style={{ marginRight: 6 }} /> Contas
          </button>
        </div>

        {error ? <div className="error-box" style={{ marginTop: 16 }}>{error}</div> : null}

        {tab === "categories" ? (
          <>
            <form onSubmit={addCategory} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, marginTop: 16 }}>
              <input className="input" required placeholder="Nome da categoria" value={catName} onChange={e => setCatName(e.target.value)} />
              <select className="select" value={catType} onChange={e => setCatType(e.target.value as FlowType)} style={{ minWidth: 140 }}>
                <option value="REVENUE">Receita</option>
                <option value="COST">Custo direto</option>
                <option value="EXPENSE">Despesa</option>
              </select>
              <button type="submit" className="btn btn-primary" disabled={busy}>Adicionar</button>
            </form>
            <div style={{ marginTop: 16 }}>
              {categories.length === 0 ? (
                <div className="empty">Nenhuma categoria cadastrada.</div>
              ) : (
                <table>
                  <thead>
                    <tr><th>Nome</th><th>Tipo</th><th></th></tr>
                  </thead>
                  <tbody>
                    {categories.map(c => (
                      <tr key={c.id}>
                        <td>{c.name}</td>
                        <td>{c.type === "REVENUE" ? "Receita" : c.type === "COST" ? "Custo" : "Despesa"}</td>
                        <td style={{ textAlign: "right" }}>
                          <button type="button" className="btn btn-sm btn-danger-ghost" onClick={() => removeCategory(c.id)}>Desativar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        ) : (
          <>
            <form onSubmit={addAccount} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 10, marginTop: 16 }}>
              <input className="input" required placeholder="Nome da conta" value={acctName} onChange={e => setAcctName(e.target.value)} />
              <select className="select" value={acctType} onChange={e => setAcctType(e.target.value as Account["type"])} style={{ minWidth: 140 }}>
                <option value="CHECKING">Conta corrente</option>
                <option value="SAVINGS">Poupança</option>
                <option value="CASH">Caixa</option>
                <option value="OTHER">Outro</option>
              </select>
              <input className="input" placeholder="Saldo inicial" value={acctInitial} onChange={e => setAcctInitial(e.target.value)} style={{ width: 130 }} />
              <button type="submit" className="btn btn-primary" disabled={busy}>Adicionar</button>
            </form>
            <div style={{ marginTop: 16 }}>
              {accounts.length === 0 ? (
                <div className="empty">Nenhuma conta cadastrada.</div>
              ) : (
                <table>
                  <thead>
                    <tr><th>Nome</th><th>Tipo</th><th style={{ textAlign: "right" }}>Saldo atual</th><th></th></tr>
                  </thead>
                  <tbody>
                    {accounts.map(a => (
                      <tr key={a.id}>
                        <td><CreditCard size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />{a.name}</td>
                        <td>{a.type === "CHECKING" ? "Corrente" : a.type === "SAVINGS" ? "Poupança" : a.type === "CASH" ? "Caixa" : "Outro"}</td>
                        <td style={{ textAlign: "right", fontWeight: 600 }}>{formatMoney(a.currentBalance ?? a.initialBalance)}</td>
                        <td style={{ textAlign: "right" }}>
                          <button type="button" className="btn btn-sm btn-danger-ghost" onClick={() => removeAccount(a.id)}>Desativar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
