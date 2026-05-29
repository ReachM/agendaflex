"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Building2,
  CreditCard,
  DollarSign,
  Download,
  FolderTree,
  PiggyBank,
  Plus,
  Settings2,
  TrendingDown,
  TrendingUp,
  Wallet,
  X
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { apiFetch } from "@/lib/client-api";

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

const STATUS_CLASS: Record<PaymentStatus, string> = {
  PENDING: "pill--warn",
  PAID: "pill--success",
  PARTIALLY_PAID: "pill--info",
  CANCELLED: "pill--cancelled",
  REFUNDED: "pill--muted"
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(new Date(value));
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
    if (tab === "all") return data.records;
    if (tab === "REVENUE") return data.records.filter(r => r.flowType === "REVENUE");
    return data.records.filter(r => r.flowType === "EXPENSE" || r.flowType === "COST");
  }, [data, tab]);

  const cashFlowMax = useMemo(() => {
    if (!data?.cashFlow14d.length) return 1;
    return Math.max(...data.cashFlow14d.flatMap(d => [d.revenue, d.expense]), 1);
  }, [data]);

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

  return (
    <>
      <PageHeader
        title="Financeiro"
        subtitle="Fluxo de caixa, lançamentos e DRE simplificado"
        actions={
          <>
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
            {data?.accounts.length ? (
              <select
                className="select"
                value={accountFilter}
                onChange={e => setAccountFilter(e.target.value)}
                style={{ width: "auto", minWidth: 160 }}
              >
                <option value="">Todas as contas</option>
                {data.accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            ) : null}
            <button type="button" className="btn btn-ghost" onClick={() => setManageOpen(true)}>
              <Settings2 size={15} />
              Gerenciar
            </button>
            <button type="button" className="btn btn-ghost" onClick={exportCsv} disabled={!data}>
              <Download size={15} />
              Exportar
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setNewRecordOpen("EXPENSE")}>
              <ArrowDownCircle size={15} />
              Nova despesa
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setNewRecordOpen("REVENUE")}>
              <Plus size={15} />
              Nova entrada
            </button>
          </>
        }
      />

      {error ? <div className="error-box">{error}</div> : null}

      {loading && !data ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <div className="loading-spinner" />
        </div>
      ) : data ? (
        <>
          {/* ─── KPIs ─── */}
          <div className="grid cols-4" style={{ marginBottom: 16 }}>
            <KpiCard
              label="Entradas"
              value={formatMoney(data.summary.revenue)}
              icon={<TrendingUp size={20} />}
              variant="success"
              hint={`${data.records.filter(r => r.flowType === "REVENUE").length} lançamentos`}
            />
            <KpiCard
              label="Saídas"
              value={formatMoney(data.summary.cost + data.summary.expense)}
              icon={<TrendingDown size={20} />}
              variant="danger"
              hint={`${data.records.filter(r => r.flowType !== "REVENUE").length} lançamentos`}
            />
            <KpiCard
              label="Saldo do período"
              value={formatMoney(data.summary.profit)}
              icon={<DollarSign size={20} />}
              variant={data.summary.profit >= 0 ? "info" : "danger"}
              hint={`Margem ${data.summary.margin}%`}
            />
            <KpiCard
              label="A receber"
              value={formatMoney(data.summary.receivable)}
              icon={<Wallet size={20} />}
              variant="warning"
              hint={`${data.summary.receivableCount} lançamentos pendentes`}
            />
          </div>

          {/* ─── DRE + Fluxo de caixa ─── */}
          <div className="grid cols-2" style={{ marginBottom: 16 }}>
            <div className="panel">
              <div className="panel__head">
                <div>
                  <div className="panel__title">DRE simplificado</div>
                  <div className="panel__sub">Receita − Custos − Despesas = Lucro</div>
                </div>
              </div>
              <div className="panel__body">
                <div className="metric-row">
                  <span className="metric-row__label"><ArrowUpCircle size={14} /> Receita bruta</span>
                  <span className="metric-row__value metric-row__value--success">{formatMoney(data.dre.revenue)}</span>
                </div>
                <div className="metric-row">
                  <span className="metric-row__label"><ArrowDownCircle size={14} /> (−) Custos diretos</span>
                  <span className="metric-row__value metric-row__value--danger">{formatMoney(data.dre.cost)}</span>
                </div>
                <div className="metric-row">
                  <span className="metric-row__label"><ArrowDownCircle size={14} /> (−) Despesas operacionais</span>
                  <span className="metric-row__value metric-row__value--danger">{formatMoney(data.dre.expense)}</span>
                </div>
                <div className="metric-row" style={{ borderTop: "2px solid var(--border)", marginTop: 6 }}>
                  <span className="metric-row__label"><PiggyBank size={14} /> = Lucro líquido</span>
                  <span className="metric-row__value metric-row__value--primary">{formatMoney(data.dre.profit)}</span>
                </div>
                <div className="metric-row" style={{ borderBottom: 0 }}>
                  <span className="metric-row__label">Margem</span>
                  <span className="metric-row__value">{data.dre.margin}%</span>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel__head">
                <div>
                  <div className="panel__title">Fluxo de caixa — últimos 14 dias</div>
                  <div className="panel__sub">Entradas vs Saídas por dia</div>
                </div>
              </div>
              <div className="panel__body" style={{ paddingTop: 16 }}>
                <div className="bar-chart" style={{ height: 180 }}>
                  {data.cashFlow14d.map((d) => {
                    const revPct = (d.revenue / cashFlowMax) * 100;
                    const expPct = (d.expense / cashFlowMax) * 100;
                    return (
                      <div key={d.date} style={{ flex: 1, display: "flex", gap: 2, alignItems: "flex-end", minWidth: 0 }}>
                        <div style={{ flex: 1, background: "linear-gradient(180deg, var(--success), #15803d)", borderRadius: "4px 4px 0 0", height: `${Math.max(revPct, 2)}%` }} title={`Entrada ${formatMoney(d.revenue)}`} />
                        <div style={{ flex: 1, background: "linear-gradient(180deg, var(--danger), #b91c1c)", borderRadius: "4px 4px 0 0", height: `${Math.max(expPct, 2)}%` }} title={`Saída ${formatMoney(d.expense)}`} />
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 16, marginTop: 16, fontSize: 12, color: "var(--muted)" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--success)" }} /> Entradas
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--danger)" }} /> Saídas
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Top despesas + Aging + Pagamento ─── */}
          <div className="grid cols-3" style={{ marginBottom: 16 }}>
            <div className="panel">
              <div className="panel__head">
                <div>
                  <div className="panel__title">Top despesas por categoria</div>
                </div>
              </div>
              <div className="panel__body">
                {data.topExpenseCategories.length === 0 ? (
                  <EmptyMini text="Sem despesas categorizadas no período." />
                ) : (
                  <div className="hbar">
                    {data.topExpenseCategories.map(c => {
                      const max = Math.max(...data.topExpenseCategories.map(x => x.total), 1);
                      const pct = (c.total / max) * 100;
                      return (
                        <div key={c.categoryId ?? c.categoryName} className="hbar__item">
                          <span className="hbar__label">{c.categoryName}</span>
                          <div className="hbar__track">
                            <div className="hbar__fill" style={{ width: `${pct}%` }}>{formatMoney(c.total)}</div>
                          </div>
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
                  <div className="panel__title">A receber — aging</div>
                </div>
              </div>
              <div className="panel__body">
                <div className="metric-row">
                  <span className="metric-row__label">A vencer</span>
                  <span className="metric-row__value metric-row__value--success">{formatMoney(data.aging.upcoming)}</span>
                </div>
                <div className="metric-row">
                  <span className="metric-row__label">Vencido 1–7d</span>
                  <span className="metric-row__value">{formatMoney(data.aging.overdue1to7)}</span>
                </div>
                <div className="metric-row">
                  <span className="metric-row__label">Vencido 8–30d</span>
                  <span className="metric-row__value metric-row__value--danger">{formatMoney(data.aging.overdue8to30)}</span>
                </div>
                <div className="metric-row" style={{ borderBottom: 0 }}>
                  <span className="metric-row__label">Vencido +30d</span>
                  <span className="metric-row__value metric-row__value--danger">{formatMoney(data.aging.overdue30plus)}</span>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel__head">
                <div>
                  <div className="panel__title">Formas de pagamento</div>
                </div>
              </div>
              <div className="panel__body">
                {data.paymentDistribution.length === 0 ? (
                  <EmptyMini text="Sem pagamentos no período." />
                ) : (
                  <div className="hbar">
                    {data.paymentDistribution.map(p => {
                      const total = data.paymentDistribution.reduce((acc, x) => acc + x.total, 0) || 1;
                      const pct = (p.total / total) * 100;
                      return (
                        <div key={p.method ?? "-"} className="hbar__item">
                          <span className="hbar__label">{p.method ? (PAYMENT_METHOD_LABELS[p.method] ?? p.method) : "—"}</span>
                          <div className="hbar__track">
                            <div className="hbar__fill" style={{ width: `${pct}%` }}>{formatMoney(p.total)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ─── Tabela ─── */}
          <div className="panel">
            <div className="panel__head" style={{ flexDirection: "column", alignItems: "stretch", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div className="panel__title">Lançamentos recentes</div>
                  <div className="panel__sub">{filteredRecords.length} lançamentos exibidos</div>
                </div>
                <div className="tabs">
                  <button type="button" className={`tab ${tab === "all" ? "active" : ""}`} onClick={() => setTab("all")}>Todos</button>
                  <button type="button" className={`tab ${tab === "REVENUE" ? "active" : ""}`} onClick={() => setTab("REVENUE")}>Entradas</button>
                  <button type="button" className={`tab ${tab === "EXPENSE" ? "active" : ""}`} onClick={() => setTab("EXPENSE")}>Saídas</button>
                </div>
              </div>
            </div>
            <div className="panel__body panel__body--flush">
              {filteredRecords.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state__icon"><DollarSign size={24} /></div>
                  <h3>Nenhum lançamento no período</h3>
                  <p>Crie sua primeira entrada ou despesa para começar a acompanhar.</p>
                </div>
              ) : (
                <div className="table-wrap" style={{ borderRadius: 0, border: 0, boxShadow: "none" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Descrição</th>
                        <th className="col-hide-mobile">Categoria</th>
                        <th className="col-hide-mobile">Conta</th>
                        <th className="col-hide-mobile">Método</th>
                        <th>Data</th>
                        <th className="col-hide-mobile">Vencimento</th>
                        <th>Status</th>
                        <th style={{ textAlign: "right" }}>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecords.map(r => (
                        <tr key={r.id}>
                          <td>
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              <strong style={{ fontSize: 13 }}>{r.description ?? "—"}</strong>
                              {r.customer?.name ? <span className="muted" style={{ fontSize: 11 }}>{r.customer.name}</span> : null}
                            </div>
                          </td>
                          <td className="col-hide-mobile">{r.category?.name ?? "—"}</td>
                          <td className="col-hide-mobile">{r.account?.name ?? "—"}</td>
                          <td className="col-hide-mobile">{r.paymentMethod ? (PAYMENT_METHOD_LABELS[r.paymentMethod] ?? r.paymentMethod) : "—"}</td>
                          <td>{formatDate(r.paidAt ?? r.createdAt)}</td>
                          <td className="col-hide-mobile">{r.dueDate ? formatDate(r.dueDate) : "—"}</td>
                          <td><span className={`pill ${STATUS_CLASS[r.paymentStatus]}`}>{STATUS_LABELS[r.paymentStatus]}</span></td>
                          <td style={{ textAlign: "right", fontWeight: 700, color: r.flowType === "REVENUE" ? "var(--success)" : "var(--danger)" }}>
                            {r.flowType === "REVENUE" ? "+" : "−"} {formatMoney(r.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
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

function KpiCard({ label, value, icon, variant, hint }: {
  label: string;
  value: string;
  icon: React.ReactNode;
  variant: "success" | "danger" | "info" | "warning";
  hint?: string;
}) {
  const classMap: Record<string, string> = {
    success: "stat-card--success",
    danger: "stat-card--danger",
    info: "stat-card--info",
    warning: "stat-card--warning"
  };
  return (
    <div className={`stat-card ${classMap[variant]}`}>
      <div className="stat-card__header">
        <div>
          <div className="stat-card__label">{label}</div>
          <div className="stat-card__value">{value}</div>
        </div>
        <div className="stat-card__icon">{icon}</div>
      </div>
      {hint ? <div className="stat-card__footer">{hint}</div> : null}
    </div>
  );
}

function EmptyMini({ text }: { text: string }) {
  return <div className="empty" style={{ padding: 20 }}>{text}</div>;
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
