"use client";

import {
  ArrowRight,
  Award,
  Briefcase,
  Calendar,
  CalendarDays,
  Clock,
  DollarSign,
  Download,
  FileSpreadsheet,
  Globe,
  LayoutDashboard,
  Lightbulb,
  Lock,
  Plus,
  Star,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users
} from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { apiFetch } from "@/lib/client-api";
import "./relatorios.css";

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
  revenueByDay: { date: string; count: number; revenue: number }[];
  topServices: { id: string; name: string; count: number }[];
  occupancyHeatmap: Record<string, number[]>;
  professionalRanking: { id: string; name: string; revenue: number; appointmentCount: number }[];
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

type TabId = "overview" | "financial" | "customers" | "professionals" | "services" | "occupancy" | "custom";

const TABS: { id: TabId; label: string; icon: typeof LayoutDashboard; planFeature: keyof PlanFeatures | null }[] = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard, planFeature: null },
  { id: "financial", label: "Financeiro", icon: DollarSign, planFeature: "allowAdvancedReports" },
  { id: "customers", label: "Clientes", icon: Users, planFeature: "allowAdvancedReports" },
  { id: "professionals", label: "Profissionais", icon: Award, planFeature: "allowAdvancedReports" },
  { id: "services", label: "Serviços", icon: Briefcase, planFeature: "allowAdvancedReports" },
  { id: "occupancy", label: "Ocupação", icon: Calendar, planFeature: null },
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

export default function RelatoriosPage() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [range, setRange] = useState<Range>("month");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [planFeatures, setPlanFeatures] = useState<PlanFeatures | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (tab: TabId, currentRange: Range) => {
    if (tab === "custom") return;
    // "occupancy" reusa o endpoint overview (heatmap está lá)
    const tabForApi = tab === "overview" || tab === "occupancy" ? "overview" : tab;
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
          <>
            <div className="range-pill" role="tablist" aria-label="Período">
              {RANGES.map((r) => (
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
            <button type="button" className="btn btn-ghost" onClick={() => alert("Exportar PDF em breve.")}>
              <Download size={15} /> Exportar PDF
            </button>
            <button type="button" className="btn btn-primary" onClick={() => alert("Agendamento de envio em breve.")}>
              <Plus size={15} /> Agendar envio
            </button>
          </>
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
      ) : activeTab === "occupancy" && data.overview ? (
        <OccupancyTab data={data.overview} />
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
    <div className="rep-tabs">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const locked = !!(tab.planFeature && !planFeatures?.[tab.planFeature]);
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect(tab.id)}
            disabled={locked}
            title={locked ? "Disponível no plano Pro e Max" : tab.label}
            className={`rep-tab${activeTab === tab.id ? " is-on" : ""}`}
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

const SERVICE_BAR_COLORS = [
  "linear-gradient(90deg, var(--primary), var(--primary-hover))",
  "linear-gradient(90deg, var(--info), #60a5fa)",
  "linear-gradient(90deg, #db2777, #f472b6)",
  "linear-gradient(90deg, #9333ea, #a855f7)",
  "linear-gradient(90deg, var(--accent), var(--gold))",
  "linear-gradient(90deg, var(--success), #22c55e)"
];

const MEDAL_STYLES = [
  "linear-gradient(135deg, #fbbf24, #d97706)",
  "linear-gradient(135deg, #cbd5e1, #94a3b8)",
  "linear-gradient(135deg, #fda4af, #f43f5e)"
];

const PRO_BAR_COLORS = [
  "linear-gradient(90deg, var(--primary), var(--primary-hover))",
  "linear-gradient(90deg, var(--info), #60a5fa)",
  "linear-gradient(90deg, var(--accent), var(--gold))",
  "linear-gradient(90deg, #9333ea, #a855f7)",
  "linear-gradient(90deg, #db2777, #f472b6)"
];

const AVATAR_COLORS = [
  "#0d9488", "#2563eb", "#d97706", "#9333ea",
  "#dc2626", "#16a34a", "#0891b2", "#c2410c"
];

function hashString(s: string): number {
  let h = 0;
  for (const c of s) h = c.charCodeAt(0) + ((h << 5) - h);
  return Math.abs(h);
}

function avatarColor(name: string): string {
  return AVATAR_COLORS[hashString(name) % AVATAR_COLORS.length];
}

function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";
}

const DAYS_LABEL = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const HEAT_HOURS = ["08","09","10","11","12","13","14","15","16","17","18","19"];

function buildInsight(data: OverviewData): { title: string; description: string } {
  const heatmap = data.occupancyHeatmap;
  if (!heatmap || Object.keys(heatmap).length === 0) {
    return {
      title: "Comece a registrar dados",
      description: "Conforme os agendamentos forem entrando, mostraremos análises personalizadas aqui."
    };
  }
  let bestDay = -1;
  let bestVal = -1;
  const dayTotals = [0, 0, 0, 0, 0, 0, 0];
  for (const arr of Object.values(heatmap)) {
    for (let i = 0; i < 7; i++) dayTotals[i] += arr[i] ?? 0;
  }
  for (let i = 0; i < 7; i++) {
    if (dayTotals[i] > bestVal) { bestVal = dayTotals[i]; bestDay = i; }
  }
  const total = dayTotals.reduce((a, b) => a + b, 0);
  const pct = total > 0 ? Math.round((dayTotals[bestDay] / total) * 100) : 0;
  if (bestDay < 0 || pct === 0) {
    return {
      title: "Distribuição equilibrada",
      description: "Os agendamentos do período estão distribuídos de forma uniforme entre os dias da semana."
    };
  }
  return {
    title: `${DAYS_LABEL[bestDay]} é seu dia de ouro`,
    description: `${pct}% da intensidade de agendamentos do período se concentra em ${DAYS_LABEL[bestDay].toLowerCase()}.`
  };
}

function RevenueLineChart({ data }: { data: { date: string; revenue: number; count: number }[] }) {
  if (!data.length) {
    return (
      <div className="empty" style={{ padding: 30, textAlign: "center" }}>
        Sem dados de faturamento no período.
      </div>
    );
  }
  const W = 600;
  const H = 200;
  const maxRev = Math.max(1, ...data.map(d => d.revenue));
  const maxCnt = Math.max(1, ...data.map(d => d.count));
  const step = data.length > 1 ? W / (data.length - 1) : W;
  const revPointsArr = data.map((d, i) =>
    [i * step, H - (d.revenue / maxRev) * (H - 20)] as const
  );
  const cntPointsArr = data.map((d, i) =>
    [i * step, H - (d.count / maxCnt) * (H - 40)] as const
  );
  const revPoints = revPointsArr.map(([x, y]) => `${x},${y}`).join(" ");
  const cntPoints = cntPointsArr.map(([x, y]) => `${x},${y}`).join(" ");
  const areaPath = `M${revPoints} L${W},${H} L0,${H} Z`;
  const labelStep = Math.max(1, Math.floor(data.length / 6));

  return (
    <div className="linechart">
      <div className="lcleg">
        <span><i style={{ background: "var(--primary)" }} /> Faturamento (R$)</span>
        <span><i style={{ background: "var(--accent)" }} /> Atendimentos</span>
      </div>
      <svg className="lc-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {[40, 80, 120, 160].map(y => (
          <line key={y} x1="0" y1={y} x2={W} y2={y} stroke="#e2e8f0" strokeDasharray="3,3" />
        ))}
        <path fill="rgba(13,148,136,0.12)" d={areaPath} />
        <polyline fill="none" stroke="#0d9488" strokeWidth="2.5" strokeLinejoin="round" points={revPoints} />
        <polyline fill="none" stroke="#d97706" strokeWidth="2" strokeDasharray="4,3" strokeLinejoin="round" points={cntPoints} />
        {revPointsArr
          .filter((_, i) => i % labelStep === 0 || i === revPointsArr.length - 1)
          .map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="3" fill="#0d9488" />
          ))}
      </svg>
      <div className="lcaxis">
        {data
          .filter((_, i) => i % labelStep === 0 || i === data.length - 1)
          .map(d => (
            <span key={d.date}>{formatDayShort(d.date)}</span>
          ))}
      </div>
    </div>
  );
}

function OccupancyHeatmap({ data }: { data: Record<string, number[]> }) {
  return (
    <>
      <div className="heatmap">
        <div className="hh" />
        {DAYS_LABEL.map(d => <div key={d} className="hd">{d}</div>)}
        {HEAT_HOURS.map(h => (
          <Fragment key={h}>
            <div className="hh">{h}h</div>
            {(data[h] ?? [0, 0, 0, 0, 0, 0, 0]).map((v, i) => (
              <div
                key={`${h}-${i}`}
                className={`cell v${Math.max(0, Math.min(5, v))}`}
                title={`${h}h ${DAYS_LABEL[i]} — intensidade ${v}`}
              />
            ))}
          </Fragment>
        ))}
      </div>
      <div className="heat-legend">
        Menos
        <span className="squares">
          {["#f1f5f9", "#ccfbf1", "#5eead4", "#14b8a6", "var(--primary-hover)", "#134e4a"].map(c => (
            <span key={c} style={{ background: c }} />
          ))}
        </span>
        Mais
      </div>
    </>
  );
}

const TEMPLATES = [
  { icon: DollarSign, color: ["var(--primary-ghost)", "var(--primary-hover)"], name: "Fechamento mensal",       desc: "DRE · Fluxo · Comissões" },
  { icon: Award,      color: ["var(--accent-light)",  "var(--accent)"],         name: "Comissões da equipe",     desc: "Detalhamento por profissional" },
  { icon: Users,      color: ["var(--info-light)",    "var(--info)"],           name: "Aniversariantes",         desc: "Próximos 30 dias" },
  { icon: Star,       color: ["#f3e8ff",              "#7c3aed"],               name: "Clientes VIP",            desc: "Top 36 do salão" },
  { icon: TrendingUp, color: ["var(--success-light)", "var(--success)"],        name: "Performance de serviços", desc: "Receita por serviço" },
  { icon: Globe,      color: ["#fce7f3",              "#db2777"],               name: "Clientes inativos",       desc: "Não voltam há 90+ dias" }
];

function OverviewTab({ data }: { data: OverviewData }) {
  const insight = buildInsight(data);
  const cancelled = data.cancelledAppointments + data.noShowAppointments;
  const completionPct = data.totalAppointments > 0
    ? Math.round((data.completedAppointments / data.totalAppointments) * 100)
    : 0;
  const last30Series = data.revenueByDay.slice(-30);
  const topServices = data.topServices;
  const maxServiceCount = topServices[0]?.count ?? 1;
  const ranking = data.professionalRanking;
  const topRevenue = ranking[0]?.revenue ?? 1;

  return (
    <>
      <div className="insight-banner">
        <span className="insight-banner__ico"><Lightbulb size={18} /></span>
        <div>
          <h4>💡 {insight.title}</h4>
          <p>{insight.description}</p>
        </div>
      </div>

      <section className="kpi-row">
        <div className="rk">
          <div className="rk__l" style={{ color: "var(--primary-hover)" }}>
            <DollarSign size={13} />
            Faturamento
          </div>
          <div className="rk__v">{formatMoney(data.revenue)}</div>
          <div className="rk__d">{data.totalAppointments} agendamentos no período</div>
        </div>
        <div className="rk">
          <div className="rk__l" style={{ color: "var(--accent)" }}>
            <CalendarDays size={13} />
            Atendimentos
          </div>
          <div className="rk__v">{data.totalAppointments}</div>
          <div className="rk__d">
            <strong>{completionPct}%</strong>concluídos · {cancelled} cancelados
          </div>
        </div>
        <div className="rk">
          <div className="rk__l" style={{ color: "var(--info)" }}>
            <UserPlus size={13} />
            Novos clientes
          </div>
          <div className="rk__v">{data.newCustomers}</div>
          <div className="rk__d">no período selecionado</div>
        </div>
        <div className="rk">
          <div className="rk__l" style={{ color: "#9333ea" }}>
            <Clock size={13} />
            Taxa de conclusão
          </div>
          <div className="rk__v">{completionPct}%</div>
          <div className="rk__d">{data.completedAppointments} concluídos</div>
        </div>
      </section>

      <section className="grid-big">
        <article className="panel">
          <div className="panel__head">
            <div>
              <div className="panel__title">Faturamento por dia</div>
              <div className="panel__sub">Receita paga e atendimentos · {last30Series.length} dias</div>
            </div>
          </div>
          <RevenueLineChart data={last30Series} />
        </article>

        <article className="panel">
          <div className="panel__head">
            <div>
              <div className="panel__title">Top serviços</div>
              <div className="panel__sub">Mais procurados no período</div>
            </div>
          </div>
          {topServices.length === 0 ? (
            <div className="empty" style={{ padding: 30, textAlign: "center" }}>
              Sem serviços agendados.
            </div>
          ) : (
            <div className="hbars">
              {topServices.map((svc, i) => (
                <div key={svc.id} className="hbar">
                  <div className="hbar__l">{svc.name}</div>
                  <div className="hbar__b">
                    <div style={{
                      width: `${(svc.count / maxServiceCount) * 92}%`,
                      background: SERVICE_BAR_COLORS[i % SERVICE_BAR_COLORS.length]
                    }} />
                  </div>
                  <div className="hbar__v">{svc.count}×</div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="grid-2">
        <article className="panel">
          <div className="panel__head">
            <div>
              <div className="panel__title">Ocupação por hora × dia</div>
              <div className="panel__sub">Concentração de agendamentos</div>
            </div>
          </div>
          <OccupancyHeatmap data={data.occupancyHeatmap} />
        </article>

        <article className="panel">
          <div className="panel__head">
            <div>
              <div className="panel__title">Ranking de profissionais</div>
              <div className="panel__sub">Top {ranking.length} por receita</div>
            </div>
          </div>
          {ranking.length === 0 ? (
            <div className="empty" style={{ padding: 30, textAlign: "center" }}>
              Sem dados de profissionais.
            </div>
          ) : (
            ranking.map((pro, i) => (
              <div key={pro.id} className="rank-row">
                <span
                  className="rank-row__pos"
                  style={i < 3 ? { background: MEDAL_STYLES[i], color: "#fff" } : undefined}
                >
                  {i + 1}
                </span>
                <div className="rank-row__nm">
                  <span className="rank-row__avatar" style={{ background: avatarColor(pro.name) }}>
                    {initials(pro.name)}
                  </span>
                  <div className="col">
                    <span className="nm">{pro.name}</span>
                    <span className="sub">{pro.appointmentCount} atendimentos</span>
                  </div>
                </div>
                <div className="rank-row__count">{formatMoney(pro.revenue)}</div>
                <div className="rank-row__bar">
                  <div style={{
                    width: `${topRevenue > 0 ? (pro.revenue / topRevenue) * 96 : 0}%`,
                    background: PRO_BAR_COLORS[i % PRO_BAR_COLORS.length]
                  }} />
                </div>
              </div>
            ))
          )}
        </article>
      </section>

      <section className="panel">
        <div className="panel__head">
          <div>
            <div className="panel__title">Relatórios pré-prontos</div>
            <div className="panel__sub">Modelos para exportar em PDF ou Excel</div>
          </div>
        </div>
        <div style={{ padding: "4px 20px 20px" }}>
          <div className="tpl-grid">
            {TEMPLATES.map(tpl => {
              const Icon = tpl.icon;
              return (
                <button
                  key={tpl.name}
                  type="button"
                  className="tpl"
                  onClick={() => alert(`Exportar "${tpl.name}" em breve.`)}
                >
                  <span className="tpl__ico" style={{ background: tpl.color[0], color: tpl.color[1] }}>
                    <Icon size={16} />
                  </span>
                  <div>
                    <div className="tpl__nm">{tpl.name}</div>
                    <div className="tpl__d">{tpl.desc}</div>
                  </div>
                  <span className="tpl__go"><ArrowRight size={14} /></span>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}

function OccupancyTab({ data }: { data: OverviewData }) {
  return (
    <section className="panel">
      <div className="panel__head">
        <div>
          <div className="panel__title">Ocupação por hora × dia</div>
          <div className="panel__sub">Heatmap dos agendamentos do período · escala 0-5</div>
        </div>
      </div>
      <OccupancyHeatmap data={data.occupancyHeatmap} />
    </section>
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
