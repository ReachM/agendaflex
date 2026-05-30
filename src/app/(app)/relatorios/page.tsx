"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Clock,
  DollarSign,
  Download,
  Lightbulb,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { apiFetch } from "@/lib/client-api";

type ServiceRow = { serviceId: string | null; serviceName: string; count: number };
type StatusRow = { status: string; count: number };
type ProRow = { professionalId: string; professionalName: string; specialty: string | null; count: number };
type PeakRow = { hour: number; count: number };
type WeekdayRow = { weekday: number; weekdayName: string; count: number };
type ClientRow = { customerId: string; customerName: string; totalSpent: number; appointmentCount: number };

type ReportData = {
  planLevel: string;
  period: { from: string; to: string };
  starter: {
    totalAppointments: number;
    appointmentsByStatus: StatusRow[];
    totalCustomers: number;
    newCustomers: number;
    topServices: ServiceRow[];
  };
  pro?: {
    byProfessional: ProRow[];
    cancellationRate: number;
    totalCancelled: number;
    clientBookings: number;
    clientBookingRate: number;
    peakHours: PeakRow[];
    hourlyDistribution: PeakRow[];
    weekdayDistribution: WeekdayRow[];
    returningCustomersCount: number;
    retentionRate: number;
    bestDay: WeekdayRow | null;
  };
  max?: {
    totalRevenue: number;
    totalCosts: number;
    totalExpenses: number;
    profit: number;
    margin: number;
    avgTicket: number;
    dailyRevenue: { date: string; total: number }[];
    topClientsBySpend: ClientRow[];
  };
};

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Agendado",
  CONFIRMED: "Confirmado",
  IN_PROGRESS: "Em atendimento",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
  NO_SHOW: "Não compareceu"
};

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "var(--info)",
  CONFIRMED: "var(--primary)",
  IN_PROGRESS: "var(--accent)",
  COMPLETED: "var(--success)",
  CANCELLED: "var(--danger)",
  NO_SHOW: "#94a3b8"
};

type Range = "7d" | "30d" | "month" | "year" | "custom";

const RANGE_LABELS: { id: Range; label: string }[] = [
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "month", label: "Mês" },
  { id: "year", label: "Ano" },
  { id: "custom", label: "Personalizado" }
];

function rangeBounds(range: Range, customFrom: string, customTo: string): { from: string; to: string } {
  const now = new Date();
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);
  let from = new Date(now);
  from.setHours(0, 0, 0, 0);

  if (range === "7d") {
    from.setDate(from.getDate() - 6);
  } else if (range === "30d") {
    from.setDate(from.getDate() - 29);
  } else if (range === "month") {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (range === "year") {
    from = new Date(now.getFullYear(), 0, 1);
  } else if (range === "custom") {
    if (customFrom) from = new Date(customFrom);
    if (customTo) {
      const t = new Date(customTo);
      t.setHours(23, 59, 59, 999);
      return { from: from.toISOString(), to: t.toISOString() };
    }
  }

  return { from: from.toISOString(), to: to.toISOString() };
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(value));
}

type TabKey = "overview" | "financial" | "customers" | "professionals" | "services" | "occupation";

export default function RelatoriosPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [tab, setTab] = useState<TabKey>("overview");

  const load = useCallback(async () => {
    setLoading(true);
    const { from, to } = rangeBounds(range, customFrom, customTo);
    const params = new URLSearchParams({ from, to });
    try {
      const result = await apiFetch<ReportData>(`/api/reports?${params}`);
      setData(result);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [range, customFrom, customTo]);

  useEffect(() => { void load(); }, [load]);

  const completedCount = useMemo(() =>
    data?.starter.appointmentsByStatus.find(s => s.status === "COMPLETED")?.count ?? 0,
    [data]);

  const insight = useMemo(() => {
    if (!data?.pro?.bestDay) return null;
    return `${data.pro.bestDay.weekdayName} é seu dia de ouro: ${data.pro.bestDay.count} atendimentos no período.`;
  }, [data]);

  function exportCsv() {
    if (!data) return;
    const rows: (string | number)[][] = [
      ["Período", `${data.period.from} → ${data.period.to}`],
      [],
      ["Visão geral"],
      ["Total agendamentos", data.starter.totalAppointments],
      ["Concluídos", completedCount],
      ["Clientes cadastrados", data.starter.totalCustomers],
      ["Novos no período", data.starter.newCustomers],
      [],
      ["Status", "Quantidade"],
      ...data.starter.appointmentsByStatus.map(s => [STATUS_LABELS[s.status] ?? s.status, s.count] as (string | number)[]),
      [],
      ["Top serviços", "Vezes agendado"],
      ...data.starter.topServices.map(s => [s.serviceName, s.count] as (string | number)[])
    ];
    if (data.pro) {
      rows.push([], ["Profissionais", "Atendimentos"]);
      data.pro.byProfessional.forEach(p => rows.push([p.professionalName, p.count]));
    }
    if (data.max) {
      rows.push([], ["Financeiro"]);
      rows.push(["Receita", data.max.totalRevenue]);
      rows.push(["Custos", data.max.totalCosts]);
      rows.push(["Despesas", data.max.totalExpenses]);
      rows.push(["Lucro", data.max.profit]);
      rows.push(["Margem (%)", data.max.margin]);
      rows.push(["Ticket médio", data.max.avgTicket]);
    }
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-${range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const showFinancialTab = Boolean(data?.max);
  const showProTabs = Boolean(data?.pro);
  const tabs: { id: TabKey; label: string; visible: boolean }[] = [
    { id: "overview", label: "Visão geral", visible: true },
    { id: "financial", label: "Financeiro", visible: showFinancialTab },
    { id: "customers", label: "Clientes", visible: true },
    { id: "professionals", label: "Profissionais", visible: showProTabs },
    { id: "services", label: "Serviços", visible: true },
    { id: "occupation", label: "Ocupação", visible: showProTabs }
  ];
  const visibleTabs = tabs.filter(t => t.visible);

  return (
    <>
      <PageHeader
        title="Relatórios"
        subtitle={`Indicadores do plano ${data?.planLevel?.toUpperCase() ?? ""}`}
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
            {range === "custom" ? (
              <>
                <input className="input" type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ width: 150 }} />
                <input className="input" type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ width: 150 }} />
              </>
            ) : null}
            <button type="button" className="btn btn-ghost" onClick={exportCsv} disabled={!data}>
              <Download size={15} /> Exportar
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
          {insight ? (
            <div className="panel" style={{ marginBottom: 16, padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--warning-light)", color: "var(--warning)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <Lightbulb size={20} />
              </div>
              <div>
                <strong style={{ fontSize: 14 }}>Insight automático</strong>
                <div style={{ fontSize: 13, color: "var(--muted)" }}>{insight}</div>
              </div>
            </div>
          ) : null}

          {/* Tabs */}
          <div className="tabs" style={{ marginBottom: 16 }}>
            {visibleTabs.map(t => (
              <button
                key={t.id}
                type="button"
                className={`tab ${tab === t.id ? "active" : ""}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "overview" ? (
            <OverviewTab data={data} completedCount={completedCount} />
          ) : tab === "financial" && data.max ? (
            <FinancialTab data={data.max} />
          ) : tab === "customers" ? (
            <CustomersTab data={data} />
          ) : tab === "professionals" && data.pro ? (
            <ProfessionalsTab data={data.pro} />
          ) : tab === "services" ? (
            <ServicesTab services={data.starter.topServices} />
          ) : tab === "occupation" && data.pro ? (
            <OccupationTab data={data.pro} />
          ) : null}
        </>
      ) : null}
    </>
  );
}

function OverviewTab({ data, completedCount }: { data: ReportData; completedCount: number }) {
  const statusMax = Math.max(...data.starter.appointmentsByStatus.map(s => s.count), 1);
  const conversionRate = data.starter.totalAppointments > 0
    ? Number(((completedCount / data.starter.totalAppointments) * 100).toFixed(0))
    : 0;

  return (
    <>
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <KpiCard label="Atendimentos" value={String(data.starter.totalAppointments)} icon={<BarChart3 size={20} />} variant="info" hint={`${completedCount} concluídos`} />
        <KpiCard label="Taxa de conclusão" value={`${conversionRate}%`} icon={<Sparkles size={20} />} variant="success" hint={`${completedCount}/${data.starter.totalAppointments}`} />
        <KpiCard label="Novos clientes" value={String(data.starter.newCustomers)} icon={<Users size={20} />} variant="warning" hint={`${data.starter.totalCustomers} no total`} />
        {data.pro ? (
          <KpiCard label="Cancelamentos" value={`${data.pro.cancellationRate}%`} icon={<TrendingDown size={20} />} variant="danger" hint={`${data.pro.totalCancelled} no período`} />
        ) : (
          <KpiCard label="Serviço top" value={data.starter.topServices[0]?.serviceName ?? "—"} icon={<TrendingUp size={20} />} variant="success" hint={`${data.starter.topServices[0]?.count ?? 0}x agendado`} />
        )}
      </div>

      <div className="grid cols-2" style={{ marginBottom: 16 }}>
        <section className="panel">
          <div className="panel__head">
            <div className="panel__title">Distribuição por status</div>
          </div>
          <div className="panel__body">
            <div className="hbar">
              {data.starter.appointmentsByStatus.map(s => (
                <div key={s.status} className="hbar__item">
                  <span className="hbar__label">{STATUS_LABELS[s.status] ?? s.status}</span>
                  <div className="hbar__track">
                    <div className="hbar__fill" style={{ width: `${Math.max((s.count / statusMax) * 100, 8)}%`, background: STATUS_COLORS[s.status] }}>{s.count}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel__head">
            <div className="panel__title">Top serviços</div>
          </div>
          <div className="panel__body">
            <ServicesBars services={data.starter.topServices.slice(0, 6)} />
          </div>
        </section>
      </div>
    </>
  );
}

function FinancialTab({ data }: { data: NonNullable<ReportData["max"]> }) {
  const maxDaily = Math.max(...data.dailyRevenue.map(d => d.total), 1);
  return (
    <>
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <KpiCard label="Receita" value={formatMoney(data.totalRevenue)} icon={<TrendingUp size={20} />} variant="success" />
        <KpiCard label="Custos" value={formatMoney(data.totalCosts)} icon={<TrendingDown size={20} />} variant="warning" />
        <KpiCard label="Despesas" value={formatMoney(data.totalExpenses)} icon={<TrendingDown size={20} />} variant="danger" />
        <KpiCard label="Lucro" value={formatMoney(data.profit)} icon={<DollarSign size={20} />} variant="info" hint={`Margem ${data.margin}%`} />
      </div>

      <div className="grid cols-2" style={{ marginBottom: 16 }}>
        <section className="panel">
          <div className="panel__head">
            <div className="panel__title">Faturamento por dia</div>
            <div className="panel__sub">Receita paga no período</div>
          </div>
          <div className="panel__body">
            {data.dailyRevenue.length === 0 ? (
              <div className="empty">Sem receita paga no período.</div>
            ) : (
              <div className="bar-chart" style={{ height: 180 }}>
                {data.dailyRevenue.map(d => {
                  const pct = (d.total / maxDaily) * 100;
                  return (
                    <div key={d.date} style={{ flex: 1, minWidth: 12, position: "relative", display: "flex", alignItems: "flex-end" }} title={`${formatDate(d.date)}: ${formatMoney(d.total)}`}>
                      <div style={{ width: "100%", height: `${Math.max(pct, 4)}%`, background: "linear-gradient(180deg, var(--success), #15803d)", borderRadius: "4px 4px 0 0" }} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel__head">
            <div className="panel__title">Ticket médio</div>
            <div className="panel__sub">Por atendimento concluído</div>
          </div>
          <div className="panel__body" style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: "var(--text)" }}>{formatMoney(data.avgTicket)}</div>
            <div style={{ marginTop: 8, fontSize: 13, color: "var(--muted)" }}>
              {data.topClientsBySpend.length} clientes acompanhados
            </div>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel__head">
          <div className="panel__title">Clientes mais valiosos</div>
          <div className="panel__sub">Total gasto histórico</div>
        </div>
        <div className="panel__body panel__body--flush">
          {data.topClientsBySpend.length === 0 ? (
            <div className="empty">Sem dados ainda.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Atendimentos</th>
                  <th style={{ textAlign: "right" }}>Total gasto</th>
                </tr>
              </thead>
              <tbody>
                {data.topClientsBySpend.map(c => (
                  <tr key={c.customerId}>
                    <td>{c.customerName}</td>
                    <td>{c.appointmentCount}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{formatMoney(c.totalSpent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  );
}

function CustomersTab({ data }: { data: ReportData }) {
  return (
    <div className="grid cols-3" style={{ marginBottom: 16 }}>
      <KpiCard label="Total cadastrados" value={String(data.starter.totalCustomers)} icon={<Users size={20} />} variant="info" />
      <KpiCard label="Novos no período" value={String(data.starter.newCustomers)} icon={<Sparkles size={20} />} variant="success" />
      {data.pro ? (
        <KpiCard label="Retenção" value={`${data.pro.retentionRate}%`} icon={<TrendingUp size={20} />} variant="warning" hint={`${data.pro.returningCustomersCount} recorrentes`} />
      ) : null}
    </div>
  );
}

function ProfessionalsTab({ data }: { data: NonNullable<ReportData["pro"]> }) {
  const max = Math.max(...data.byProfessional.map(p => p.count), 1);
  return (
    <section className="panel">
      <div className="panel__head">
        <div className="panel__title">Ranking de profissionais</div>
        <div className="panel__sub">Atendimentos concluídos no período</div>
      </div>
      <div className="panel__body">
        {data.byProfessional.length === 0 ? (
          <div className="empty">Sem dados.</div>
        ) : (
          <div className="hbar">
            {data.byProfessional.map((p, idx) => (
              <div key={p.professionalId} className="hbar__item">
                <span className="hbar__label" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span className={`avatar avatar--sm av-${(idx % 8) + 1}`}>{p.professionalName[0]?.toUpperCase() ?? "?"}</span>
                  <span>
                    {p.professionalName}
                    {p.specialty ? <span style={{ color: "var(--muted)", fontSize: 11, display: "block" }}>{p.specialty}</span> : null}
                  </span>
                </span>
                <div className="hbar__track">
                  <div className="hbar__fill" style={{ width: `${(p.count / max) * 100}%` }}>{p.count}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ServicesTab({ services }: { services: ServiceRow[] }) {
  return (
    <section className="panel">
      <div className="panel__head">
        <div className="panel__title">Serviços mais procurados</div>
        <div className="panel__sub">Top 10 do período</div>
      </div>
      <div className="panel__body">
        <ServicesBars services={services} />
      </div>
    </section>
  );
}

function ServicesBars({ services }: { services: ServiceRow[] }) {
  if (services.length === 0) return <div className="empty">Sem dados.</div>;
  const max = Math.max(...services.map(s => s.count), 1);
  return (
    <div className="hbar">
      {services.map(s => (
        <div key={s.serviceId ?? s.serviceName} className="hbar__item">
          <span className="hbar__label">{s.serviceName}</span>
          <div className="hbar__track">
            <div className="hbar__fill" style={{ width: `${Math.max((s.count / max) * 100, 8)}%` }}>{s.count}x</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function OccupationTab({ data }: { data: NonNullable<ReportData["pro"]> }) {
  const hourMax = Math.max(...data.hourlyDistribution.map(h => h.count), 1);
  const dayMax = Math.max(...data.weekdayDistribution.map(d => d.count), 1);

  return (
    <div className="grid cols-2" style={{ marginBottom: 16 }}>
      <section className="panel">
        <div className="panel__head">
          <div className="panel__title">Ocupação por hora</div>
          <div className="panel__sub">Distribuição 0h–23h</div>
        </div>
        <div className="panel__body">
          <div className="bar-chart" style={{ height: 180 }}>
            {data.hourlyDistribution.map(h => {
              const pct = (h.count / hourMax) * 100;
              return (
                <div key={h.hour} style={{ flex: 1, minWidth: 6, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 4 }} title={`${String(h.hour).padStart(2, "0")}:00 — ${h.count} agendamentos`}>
                  <div style={{ width: "100%", height: `${Math.max(pct, 2)}%`, background: "linear-gradient(180deg, var(--primary), var(--primary-hover))", borderRadius: "4px 4px 0 0" }} />
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: "var(--muted)" }}>
            <span>00h</span><span>06h</span><span>12h</span><span>18h</span><span>23h</span>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">
          <div className="panel__title">Ocupação por dia da semana</div>
          <div className="panel__sub">Atendimentos concluídos</div>
        </div>
        <div className="panel__body">
          <div className="hbar">
            {data.weekdayDistribution.map(d => (
              <div key={d.weekday} className="hbar__item">
                <span className="hbar__label">{d.weekdayName}</span>
                <div className="hbar__track">
                  <div className="hbar__fill" style={{ width: `${Math.max((d.count / dayMax) * 100, 4)}%` }}>{d.count}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel" style={{ gridColumn: "1 / -1" }}>
        <div className="panel__head">
          <div className="panel__title">Horários mais procurados</div>
        </div>
        <div className="panel__body">
          {data.peakHours.length === 0 ? (
            <div className="empty">Sem dados.</div>
          ) : (
            data.peakHours.map(h => (
              <div key={h.hour} className="metric-row">
                <span className="metric-row__label"><Clock size={14} />{String(h.hour).padStart(2, "0")}:00</span>
                <span className="metric-row__value">{h.count} atendimentos</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  variant,
  hint
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  variant: "success" | "danger" | "info" | "warning";
  hint?: string;
}) {
  const cls: Record<string, string> = {
    success: "stat-card--success",
    danger: "stat-card--danger",
    info: "stat-card--info",
    warning: "stat-card--warning"
  };
  return (
    <div className={`stat-card ${cls[variant]}`}>
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
