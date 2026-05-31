"use client";

import {
  Briefcase,
  CalendarDays,
  DollarSign,
  Download,
  FileSpreadsheet,
  LayoutDashboard,
  Lock,
  TrendingDown,
  TrendingUp,
  UserCog,
  Users
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { apiFetch } from "@/lib/client-api";

type PlanFeatures = {
  planSlug: string;
  allowAdvancedReports?: boolean;
  allowFinancialControl?: boolean;
};

type OverviewData = {
  totalAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  noShowAppointments: number;
  newCustomers: number;
  revenue: number;
  appointmentsByDay: { date: string; count: number }[];
};

type ServiceRow = {
  serviceId: string;
  serviceName: string;
  count: number;
  revenue: number;
  avgPrice: number;
  cancellationRate: number;
};

type ProfessionalRow = {
  professionalId: string;
  professionalName: string;
  count: number;
  completedCount: number;
  cancelledCount: number;
  revenue: number;
};

type CustomerRow = {
  customerId: string;
  customerName: string;
  appointmentCount: number;
  totalSpent: number;
  lastAppointment: string | null;
  status: string;
};

type CustomersData = {
  rows: CustomerRow[];
  retention: {
    newCustomers: number;
    returningCustomers: number;
    churnRate: number;
  };
};

type FinancialData = {
  revenueByMonth: { month: string; revenue: number; expense: number }[];
  topServices: { name: string; revenue: number }[];
};

type ApiResponse = {
  period: { from: string; to: string };
  planFeatures: PlanFeatures;
  overview?: OverviewData;
  services?: { rows: ServiceRow[] };
  professionals?: { rows: ProfessionalRow[] };
  customers?: CustomersData;
  financial?: FinancialData;
};

type TabId = "overview" | "services" | "professionals" | "customers" | "financial" | "custom";

const TABS: { id: TabId; label: string; icon: typeof LayoutDashboard; planFeature: keyof PlanFeatures | null }[] = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard, planFeature: null },
  { id: "services", label: "Serviços", icon: Briefcase, planFeature: "allowAdvancedReports" },
  { id: "professionals", label: "Profissionais", icon: UserCog, planFeature: "allowAdvancedReports" },
  { id: "customers", label: "Clientes", icon: Users, planFeature: "allowAdvancedReports" },
  { id: "financial", label: "Financeiro", icon: DollarSign, planFeature: "allowAdvancedReports" },
  { id: "custom", label: "Personalizado", icon: Download, planFeature: "allowAdvancedReports" }
];

type Range = "week" | "month" | "quarter" | "year";
const RANGES: { id: Range; label: string }[] = [
  { id: "week", label: "Semana" },
  { id: "month", label: "Mês" },
  { id: "quarter", label: "Trimestre" },
  { id: "year", label: "Ano" }
];

function rangeBounds(range: Range): { from: string; to: string } {
  const now = new Date();
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);

  if (range === "week") from.setDate(from.getDate() - 6);
  else if (range === "month") from.setDate(from.getDate() - 29);
  else if (range === "quarter") from.setMonth(from.getMonth() - 3);
  else from.setFullYear(from.getFullYear() - 1);

  return { from: from.toISOString(), to: to.toISOString() };
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatMonthLabel(key: string): string {
  const [year, month] = key.split("-");
  const labels = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${labels[Number(month) - 1] ?? month}/${year.slice(-2)}`;
}

function formatDayShort(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function pct(part: number, total: number): string {
  if (total === 0) return "0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}

export default function RelatoriosPage() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [range, setRange] = useState<Range>("month");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [planFeatures, setPlanFeatures] = useState<PlanFeatures | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (tab: TabId, currentRange: Range) => {
    if (tab === "custom") return;
    const tabForApi = tab === "overview" ? "overview" : tab;
    setLoading(true);
    setError("");
    try {
      const { from, to } = rangeBounds(currentRange);
      const res = await apiFetch<ApiResponse>(
        `/api/reports?tab=${tabForApi}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      );
      setData(res);
      setPlanFeatures(res.planFeatures);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(activeTab, range);
  }, [activeTab, range, load]);

  function handleTabClick(tab: TabId) {
    const meta = TABS.find((t) => t.id === tab);
    if (meta?.planFeature && !planFeatures?.[meta.planFeature]) return;
    setActiveTab(tab);
  }

  return (
    <>
      <PageHeader
        title="Relatórios"
        subtitle="Visão analítica do seu negócio"
        actions={
          <div style={{ display: "flex", gap: 4, background: "var(--surface-muted)", padding: 4, borderRadius: 9 }}>
            {RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRange(r.id)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "none",
                  background: range === r.id ? "var(--surface)" : "transparent",
                  color: range === r.id ? "var(--text)" : "var(--muted)",
                  fontWeight: range === r.id ? 600 : 500,
                  fontSize: 12.5,
                  cursor: "pointer",
                  boxShadow: range === r.id ? "var(--shadow-sm)" : "none",
                  transition: "all var(--transition)"
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      />

      <TabBar activeTab={activeTab} planFeatures={planFeatures} onSelect={handleTabClick} />

      {error && <div className="error-box">{error}</div>}

      {activeTab === "custom" ? (
        <CustomTab range={range} />
      ) : loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <div className="loading-spinner" />
        </div>
      ) : !data ? (
        <div className="empty-state">
          <h3>Sem dados</h3>
          <p>Selecione um período para visualizar os relatórios.</p>
        </div>
      ) : activeTab === "overview" && data.overview ? (
        <OverviewTab data={data.overview} />
      ) : activeTab === "services" && data.services ? (
        <ServicesTab rows={data.services.rows} />
      ) : activeTab === "professionals" && data.professionals ? (
        <ProfessionalsTab rows={data.professionals.rows} />
      ) : activeTab === "customers" && data.customers ? (
        <CustomersTab data={data.customers} />
      ) : activeTab === "financial" && data.financial ? (
        <FinancialTab data={data.financial} />
      ) : (
        <div className="empty-state">
          <h3>Sem dados para esta aba</h3>
        </div>
      )}
    </>
  );
}

function TabBar({
  activeTab,
  planFeatures,
  onSelect
}: {
  activeTab: TabId;
  planFeatures: PlanFeatures | null;
  onSelect: (tab: TabId) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        padding: 4,
        background: "var(--surface-muted)",
        borderRadius: "var(--radius)",
        marginBottom: 24,
        flexWrap: "wrap"
      }}
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const locked = !!(tab.planFeature && !planFeatures?.[tab.planFeature]);
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect(tab.id)}
            disabled={locked}
            title={locked ? "Disponível no plano Pro e Max" : tab.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "8px 14px",
              borderRadius: 8,
              border: "none",
              background: isActive ? "var(--surface)" : "transparent",
              color: isActive ? "var(--text)" : "var(--muted)",
              fontWeight: isActive ? 600 : 500,
              fontSize: 13.5,
              cursor: locked ? "not-allowed" : "pointer",
              boxShadow: isActive ? "var(--shadow-sm)" : "none",
              opacity: locked ? 0.55 : 1,
              transition: "all var(--transition)"
            }}
          >
            <Icon size={14} />
            {tab.label}
            {locked && <Lock size={12} style={{ marginLeft: 2 }} />}
          </button>
        );
      })}
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon,
  variant = "default"
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ReactNode;
  variant?: "default" | "success" | "danger" | "info" | "warning";
}) {
  const cls = variant === "default" ? "" : `stat-card--${variant}`;
  return (
    <div className={`stat-card ${cls}`}>
      <div className="stat-card__header">
        <div>
          <div className="stat-card__label">{label}</div>
          <div className="stat-card__value">{String(value)}</div>
        </div>
        <div className="stat-card__icon">{icon}</div>
      </div>
      {hint && <div className="stat-card__footer">{hint}</div>}
    </div>
  );
}

function OverviewTab({ data }: { data: OverviewData }) {
  const maxBar = data.appointmentsByDay.reduce((m, d) => Math.max(m, d.count), 0) || 1;
  const last30 = data.appointmentsByDay.slice(-30);

  return (
    <>
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <KpiCard
          label="Total de agendamentos"
          value={data.totalAppointments}
          icon={<CalendarDays size={20} />}
          variant="info"
        />
        <KpiCard
          label="Concluídos"
          value={data.completedAppointments}
          hint={pct(data.completedAppointments, data.totalAppointments) + " do total"}
          icon={<TrendingUp size={20} />}
          variant="success"
        />
        <KpiCard
          label="Cancelados / no-show"
          value={data.cancelledAppointments + data.noShowAppointments}
          hint={pct(data.cancelledAppointments + data.noShowAppointments, data.totalAppointments) + " do total"}
          icon={<TrendingDown size={20} />}
          variant="danger"
        />
        <KpiCard
          label="Novos clientes"
          value={data.newCustomers}
          hint={formatMoney(data.revenue) + " em receita paga"}
          icon={<Users size={20} />}
          variant="warning"
        />
      </div>

      <section className="panel">
        <div className="panel__head">
          <div>
            <div className="panel__title">Agendamentos por dia</div>
            <div className="panel__sub">Últimos {last30.length} dias</div>
          </div>
        </div>
        <div className="panel__body">
          {last30.length === 0 ? (
            <div className="empty-state">
              <h3>Sem agendamentos no período</h3>
            </div>
          ) : (
            <BarChart
              data={last30.map((d) => ({ label: formatDayShort(d.date), value: d.count }))}
              max={maxBar}
              valueFormatter={(v) => String(v)}
            />
          )}
        </div>
      </section>
    </>
  );
}

function ServicesTab({ rows }: { rows: ServiceRow[] }) {
  return (
    <section className="panel">
      <div className="panel__head">
        <div>
          <div className="panel__title">Desempenho por serviço</div>
          <div className="panel__sub">{rows.length} serviços com agendamentos no período</div>
        </div>
      </div>
      <div className="panel__body panel__body--flush">
        {rows.length === 0 ? (
          <div className="empty-state">
            <h3>Sem dados de serviços no período</h3>
          </div>
        ) : (
          <div className="table-wrap" style={{ borderRadius: 0, border: 0, boxShadow: "none" }}>
            <table>
              <thead>
                <tr>
                  <th>Serviço</th>
                  <th style={{ textAlign: "right" }}>Agendamentos</th>
                  <th style={{ textAlign: "right" }}>Receita total</th>
                  <th style={{ textAlign: "right" }}>Preço médio</th>
                  <th style={{ textAlign: "right" }}>Taxa cancelamento</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.serviceId}>
                    <td style={{ fontWeight: 600 }}>{r.serviceName}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{r.count}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{formatMoney(r.revenue)}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{formatMoney(r.avgPrice)}</td>
                    <td style={{ textAlign: "right" }}>
                      <span className={`pill ${r.cancellationRate > 15 ? "pill--danger" : r.cancellationRate > 5 ? "pill--warn" : "pill--success"}`}>
                        {r.cancellationRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function ProfessionalsTab({ rows }: { rows: ProfessionalRow[] }) {
  return (
    <section className="panel">
      <div className="panel__head">
        <div>
          <div className="panel__title">Desempenho por profissional</div>
          <div className="panel__sub">{rows.length} profissionais com atividade no período</div>
        </div>
      </div>
      <div className="panel__body panel__body--flush">
        {rows.length === 0 ? (
          <div className="empty-state">
            <h3>Sem dados de profissionais no período</h3>
          </div>
        ) : (
          <div className="table-wrap" style={{ borderRadius: 0, border: 0, boxShadow: "none" }}>
            <table>
              <thead>
                <tr>
                  <th>Profissional</th>
                  <th style={{ textAlign: "right" }}>Agendamentos</th>
                  <th style={{ textAlign: "right" }}>Concluídos</th>
                  <th style={{ textAlign: "right" }}>Cancelados</th>
                  <th style={{ textAlign: "right" }}>Receita gerada</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.professionalId}>
                    <td style={{ fontWeight: 600 }}>{r.professionalName}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{r.count}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      <span className="pill pill--success">{r.completedCount}</span>
                    </td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      <span className="pill pill--danger">{r.cancelledCount}</span>
                    </td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{formatMoney(r.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function CustomersTab({ data }: { data: CustomersData }) {
  const total = data.retention.newCustomers + data.retention.returningCustomers;
  const returningRate = total > 0
    ? Number(((data.retention.returningCustomers / total) * 100).toFixed(1))
    : 0;

  return (
    <>
      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <KpiCard label="Novos clientes" value={data.retention.newCustomers} icon={<Users size={20} />} variant="info" />
        <KpiCard label="Recorrentes" value={data.retention.returningCustomers} icon={<TrendingUp size={20} />} variant="success" />
        <KpiCard label="Taxa de retorno" value={`${returningRate}%`} hint={`Churn: ${data.retention.churnRate}%`} icon={<TrendingDown size={20} />} variant="warning" />
      </div>

      <section className="panel">
        <div className="panel__head">
          <div>
            <div className="panel__title">Top 50 clientes por valor gasto</div>
            <div className="panel__sub">{data.rows.length} clientes listados</div>
          </div>
        </div>
        <div className="panel__body panel__body--flush">
          {data.rows.length === 0 ? (
            <div className="empty-state">
              <h3>Sem clientes com gastos registrados</h3>
            </div>
          ) : (
            <div className="table-wrap" style={{ borderRadius: 0, border: 0, boxShadow: "none" }}>
              <table>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th style={{ textAlign: "right" }}>Agendamentos</th>
                    <th style={{ textAlign: "right" }}>Total gasto</th>
                    <th>Último atendimento</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.customerId}>
                      <td style={{ fontWeight: 600 }}>{r.customerName}</td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{r.appointmentCount}</td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{formatMoney(r.totalSpent)}</td>
                      <td>{r.lastAppointment ? formatDayShort(r.lastAppointment.slice(0, 10)) : "—"}</td>
                      <td>
                        <span className={`pill ${r.status === "active" ? "pill--success" : "pill--muted"}`}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function FinancialTab({ data }: { data: FinancialData }) {
  const max = data.revenueByMonth.reduce((m, r) => Math.max(m, r.revenue, r.expense), 0) || 1;

  return (
    <>
      <section className="panel" style={{ marginBottom: 16 }}>
        <div className="panel__head">
          <div>
            <div className="panel__title">Receita x despesa por mês</div>
            <div className="panel__sub">Últimos 6 meses</div>
          </div>
        </div>
        <div className="panel__body">
          <DualBarChart
            data={data.revenueByMonth.map((r) => ({
              label: formatMonthLabel(r.month),
              revenue: r.revenue,
              expense: r.expense
            }))}
            max={max}
          />
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">
          <div>
            <div className="panel__title">Top serviços por receita</div>
            <div className="panel__sub">{data.topServices.length} serviços</div>
          </div>
        </div>
        <div className="panel__body panel__body--flush">
          {data.topServices.length === 0 ? (
            <div className="empty-state">
              <h3>Sem receita no período</h3>
            </div>
          ) : (
            <div className="table-wrap" style={{ borderRadius: 0, border: 0, boxShadow: "none" }}>
              <table>
                <thead>
                  <tr>
                    <th>Serviço</th>
                    <th style={{ textAlign: "right" }}>Receita</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topServices.map((s, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{formatMoney(s.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function CustomTab({ range }: { range: Range }) {
  const initial = useMemo(() => rangeBounds(range), [range]);
  const [from, setFrom] = useState(initial.from.slice(0, 10));
  const [to, setTo] = useState(initial.to.slice(0, 10));
  const [statuses, setStatuses] = useState<string[]>([]);
  const [professionalId, setProfessionalId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [services, setServices] = useState<{ id: string; name: string }[]>([]);
  const [professionals, setProfessionals] = useState<{ id: string; name: string }[]>([]);
  const [toast, setToast] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [sv, pr] = await Promise.all([
          apiFetch<{ services: { id: string; name: string }[] }>("/api/services"),
          apiFetch<{ professionals: { id: string; name: string }[] }>("/api/professionals")
        ]);
        setServices(sv.services ?? []);
        setProfessionals(pr.professionals ?? []);
      } catch {
        // silently — filters just stay empty
      }
    })();
  }, []);

  const STATUS_OPTIONS = [
    { id: "SCHEDULED", label: "Agendado" },
    { id: "CONFIRMED", label: "Confirmado" },
    { id: "IN_PROGRESS", label: "Em atendimento" },
    { id: "COMPLETED", label: "Concluído" },
    { id: "CANCELLED", label: "Cancelado" },
    { id: "NO_SHOW", label: "Não compareceu" }
  ];

  function toggleStatus(id: string) {
    setStatuses((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  function buildQuery(): string {
    const params = new URLSearchParams();
    if (from) params.set("from", `${from}T00:00:00.000Z`);
    if (to) params.set("to", `${to}T23:59:59.999Z`);
    statuses.forEach((s) => params.append("status", s));
    if (professionalId) params.set("professionalId", professionalId);
    if (serviceId) params.set("serviceId", serviceId);
    return params.toString();
  }

  function exportCsv() {
    window.location.href = `/api/reports/export?${buildQuery()}`;
  }

  function exportPdf() {
    setToast("Exportação em PDF: em breve.");
    setTimeout(() => setToast(""), 3000);
  }

  return (
    <section className="panel">
      <div className="panel__head">
        <div>
          <div className="panel__title">Exportação personalizada</div>
          <div className="panel__sub">Filtre o período e baixe os dados em CSV.</div>
        </div>
      </div>
      <div className="panel__body">
        {toast && (
          <div style={{ padding: "10px 14px", borderRadius: 8, background: "var(--info-light)", color: "var(--info)", fontSize: 13, marginBottom: 14 }}>
            {toast}
          </div>
        )}

        <div className="form-grid">
          <div className="field">
            <label>De</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="field">
            <label>Até</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="field">
            <label>Profissional</label>
            <select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
              <option value="">Todos</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Serviço</label>
            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              <option value="">Todos</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="field full">
            <label>Status</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
              {STATUS_OPTIONS.map((opt) => {
                const on = statuses.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleStatus(opt.id)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 999,
                      border: `1px solid ${on ? "var(--primary)" : "var(--border)"}`,
                      background: on ? "var(--primary-ghost)" : "var(--surface)",
                      color: on ? "var(--primary)" : "var(--text-secondary)",
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all var(--transition)"
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-primary" onClick={exportCsv}>
            <FileSpreadsheet size={14} /> Exportar CSV
          </button>
          <button type="button" className="btn btn-ghost" onClick={exportPdf}>
            <Download size={14} /> Exportar PDF
          </button>
        </div>
      </div>
    </section>
  );
}

function BarChart({
  data,
  max,
  valueFormatter
}: {
  data: { label: string; value: number }[];
  max: number;
  valueFormatter: (v: number) => string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 220, paddingTop: 12 }}>
      {data.map((d, i) => {
        const heightPct = max > 0 ? (d.value / max) * 100 : 0;
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", minWidth: 0 }}>
            <div
              style={{
                width: "100%",
                background: "linear-gradient(180deg, var(--primary) 0%, var(--primary-hover) 100%)",
                borderRadius: "4px 4px 0 0",
                height: `${heightPct}%`,
                minHeight: d.value > 0 ? 2 : 0,
                position: "relative",
                transition: "height var(--transition)"
              }}
              title={`${d.label}: ${valueFormatter(d.value)}`}
            />
            <span style={{ fontSize: 9.5, color: "var(--muted)", marginTop: 6, transform: "rotate(-45deg)", transformOrigin: "center", whiteSpace: "nowrap" }}>
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DualBarChart({
  data,
  max
}: {
  data: { label: string; revenue: number; expense: number }[];
  max: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--success)" }} /> Receita
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--danger)" }} /> Despesa
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 220 }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, width: "100%", height: "100%" }}>
              <div
                style={{
                  flex: 1,
                  background: "var(--success)",
                  borderRadius: "4px 4px 0 0",
                  height: `${(d.revenue / max) * 100}%`,
                  minHeight: d.revenue > 0 ? 2 : 0
                }}
                title={`Receita: ${formatMoney(d.revenue)}`}
              />
              <div
                style={{
                  flex: 1,
                  background: "var(--danger)",
                  borderRadius: "4px 4px 0 0",
                  height: `${(d.expense / max) * 100}%`,
                  minHeight: d.expense > 0 ? 2 : 0
                }}
                title={`Despesa: ${formatMoney(d.expense)}`}
              />
            </div>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
