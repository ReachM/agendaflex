"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Bot,
  Briefcase,
  CalendarPlus,
  Check,
  Clock,
  Copy,
  DollarSign,
  Download,
  Gauge,
  MessageCircle,
  MinusCircle,
  Plus,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users
} from "lucide-react";
import { apiFetch } from "@/lib/client-api";
import { AppointmentPreviewModal } from "@/components/appointment-preview";

type AnyRecord = Record<string, any>;

type Range = "today" | "week" | "month" | "year";

const RANGE_LABELS: { id: Range; label: string }[] = [
  { id: "today", label: "Hoje" },
  { id: "week", label: "Semana" },
  { id: "month", label: "Mês" },
  { id: "year", label: "Ano" }
];

type Revenue14dPoint = { date: string; current: number; previous: number };

type ProfessionalToday = { id: string; name: string; count: number; max: number };

type DashboardData = {
  range: Range;
  metrics: {
    customers: number;
    newCustomersThisMonth: number;
    services: number;
    professionals: number;
    todayAppointments: number;
    pendingAppointments: number;
    confirmedAppointments: number;
    completedAppointments: number;
    cancelledAppointments: number;
    monthlyAppointments: number;
    periodAppointments: number;
    occupancyRate: number;
    bookedHours: number;
    availableHours: number;
  };
  plan: { name: string; slug: string; maxAppointmentsPerMonth: number; usedAppointmentsThisMonth: number };
  todayAppointmentsList: AnyRecord[];
  nextAppointments: AnyRecord[];
  topServices: { serviceId: string | null; serviceName: string; count: number }[];
  professionalsToday: ProfessionalToday[];
  vipCustomers: { customerId: string; name: string; phone: string | null; totalSpent: number; visits: number }[];
  upcomingBirthdays: { id: string; name: string; birthDate: string; phone: string | null }[];
  financial?: {
    dayRevenue: number;
    periodRevenue: number;
    monthRevenue: number;
    prevMonthRevenue: number;
    monthDelta: number;
    monthExpense: number;
    monthBalance: number;
    receivable: number;
    receivableCount: number;
    revenue14d: Revenue14dPoint[];
  };
  bot?: {
    enabled: boolean;
    conversations24h: number;
    reminders24h: number;
    appointments24h: number;
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

const STATUS_CLASS: Record<string, string> = {
  SCHEDULED: "scheduled",
  CONFIRMED: "confirmed",
  IN_PROGRESS: "inprogress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  NO_SHOW: "noshow"
};

const TS_COLORS = [
  { bg: "var(--primary-ghost)", color: "var(--primary-hover)", bar: "linear-gradient(90deg, var(--primary), var(--primary-hover))" },
  { bg: "var(--info-light)",    color: "var(--info)",          bar: "linear-gradient(90deg, var(--info), #60a5fa)" },
  { bg: "var(--accent-light)",  color: "var(--accent)",        bar: "linear-gradient(90deg, var(--accent), var(--gold))" },
  { bg: "var(--purple-light)",  color: "#7c3aed",              bar: "linear-gradient(90deg, #9333ea, #a855f7)" },
  { bg: "var(--success-light)", color: "var(--success)",       bar: "linear-gradient(90deg, var(--success), #22c55e)" }
];

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

function formatMoneyFull(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function firstName(full: string | undefined) {
  if (!full) return "lá";
  return full.split(" ")[0];
}

function todayLabel() {
  const txt = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long"
  }).format(new Date());
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

function dayShort(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit" }).format(new Date(value));
}

function dayWeekShort(value: string) {
  const d = new Date(value);
  const map = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
  return map[d.getDay()];
}

function diffMinutes(start: string, now: Date) {
  return Math.round((new Date(start).getTime() - now.getTime()) / 60000);
}

function buildDonutGradient(segments: { color: string; pct: number }[]): string {
  let acc = 0;
  const parts: string[] = [];
  for (const s of segments) {
    if (s.pct <= 0) continue;
    const start = acc;
    const end = acc + s.pct;
    parts.push(`${s.color} ${start}% ${end}%`);
    acc = end;
  }
  if (acc < 100) parts.push(`var(--border) ${acc}% 100%`);
  return `conic-gradient(${parts.join(", ")})`;
}

export function TenantDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [session, setSession] = useState<AnyRecord | null>(null);
  const [error, setError] = useState("");
  const [range, setRange] = useState<Range>("month");
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<AnyRecord | null>(null);

  const load = useCallback(async (r: Range = range) => {
    setLoading(true);
    setError("");
    try {
      const [dashData, sessionData] = await Promise.all([
        apiFetch<DashboardData>(`/api/dashboard?range=${r}`),
        apiFetch<AnyRecord>("/api/auth/me")
      ]);
      setData(dashData);
      setSession(sessionData);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { void load(range); }, [load, range]);

  async function handleStatusChange(id: string, status: string, reason?: string) {
    await apiFetch(`/api/appointments/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status, ...(reason ? { cancellationReason: reason } : {}) })
    });
    void load(range);
  }

  function exportSummary() {
    if (!data) return;
    const rows: (string | number)[][] = [
      ["Período", data.range],
      [],
      ["KPI", "Valor"],
      ["Agendamentos no período", data.metrics.periodAppointments],
      ["Agendamentos no mês", data.metrics.monthlyAppointments],
      ["Novos clientes (mês)", data.metrics.newCustomersThisMonth],
      ["Taxa de ocupação", `${data.metrics.occupancyRate}%`],
      ["Concluídos", data.metrics.completedAppointments],
      ["Cancelados", data.metrics.cancelledAppointments]
    ];
    if (data.financial) {
      rows.push([], ["Faturamento mês", data.financial.monthRevenue]);
      rows.push(["Saldo do mês", data.financial.monthBalance]);
      rows.push(["A receber", data.financial.receivable]);
    }
    const csv = rows
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dashboard-${data.range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const userName = (session?.user?.name as string | undefined) ?? "";
  const planFeatures = (session?.planFeatures as Record<string, boolean> | undefined) ?? {};
  const role = session?.role as string | undefined;
  const hasFinancial = Boolean(data?.financial);
  const hasBot = Boolean(data?.bot);
  const todayCount = data?.metrics.todayAppointments ?? 0;

  const statusBreakdown = useMemo(() => {
    if (!data) {
      return {
        total: 0,
        confirmed: 0, confirmedPct: 0,
        scheduled: 0, scheduledPct: 0,
        inProgress: 0, inProgressPct: 0,
        completed: 0, completedPct: 0,
        cancelled: 0, cancelledPct: 0,
        noShow: 0, noShowPct: 0
      };
    }
    const m = data.metrics;
    const total =
      m.pendingAppointments +
      m.confirmedAppointments +
      m.completedAppointments +
      m.cancelledAppointments;
    const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);
    return {
      total,
      confirmed: m.confirmedAppointments, confirmedPct: pct(m.confirmedAppointments),
      scheduled: m.pendingAppointments,  scheduledPct: pct(m.pendingAppointments),
      inProgress: 0,                      inProgressPct: 0,
      completed: m.completedAppointments, completedPct: pct(m.completedAppointments),
      cancelled: m.cancelledAppointments, cancelledPct: pct(m.cancelledAppointments),
      noShow: 0,                          noShowPct: 0
    };
  }, [data]);

  const donutGradient = useMemo(
    () =>
      buildDonutGradient([
        { color: "var(--primary)", pct: statusBreakdown.confirmedPct },
        { color: "var(--info)",    pct: statusBreakdown.scheduledPct },
        { color: "var(--accent)",  pct: statusBreakdown.inProgressPct },
        { color: "var(--success)", pct: statusBreakdown.completedPct },
        { color: "var(--danger)",  pct: statusBreakdown.cancelledPct },
        { color: "#cbd5e1",        pct: statusBreakdown.noShowPct }
      ]),
    [statusBreakdown]
  );

  const reminders = useMemo(() => {
    if (!data) return [];
    const now = new Date();
    return (data.nextAppointments ?? [])
      .filter(a => diffMinutes(a.startAt, now) <= 24 * 60 && diffMinutes(a.startAt, now) >= 0)
      .slice(0, 3)
      .map(a => {
        const mins = diffMinutes(a.startAt, now);
        const type: "info" | "warn" | "alert" =
          mins <= 30 ? "alert" : mins <= 180 ? "warn" : "info";
        const customerName = (a.customer?.name as string | undefined) ?? "—";
        const phone = (a.customer?.phone as string | undefined) ?? "";
        const time = formatTime(a.startAt);
        const timeLabel =
          mins <= 60
            ? `em ${Math.max(1, mins)}min`
            : mins <= 24 * 60
              ? `em ${Math.round(mins / 60)}h`
              : time;
        return {
          id: a.id as string,
          type,
          title:
            type === "alert"
              ? `Confirmar com ${customerName} agora`
              : type === "warn"
                ? `Lembrete: ${customerName} às ${time}`
                : `Aviso enviado para ${customerName}`,
          description: phone
            ? `${phone} · ${time}`
            : time,
          timeLabel
        };
      });
  }, [data]);

  return (
    <>
      <div className="dash-greet">
        <div>
          <h1>Olá, {firstName(userName)} 👋</h1>
          <div className="sub">
            {todayLabel()} · <strong>{todayCount}</strong>{" "}
            {todayCount === 1 ? "agendamento hoje" : "agendamentos hoje"}
          </div>
        </div>
        <div className="dash-greet__actions">
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
          <button type="button" className="btn btn-ghost" onClick={exportSummary} disabled={!data}>
            <Download size={15} /> Exportar
          </button>
          <Link className="btn btn-primary" href="/agenda">
            <Plus size={15} /> Novo agendamento
          </Link>
        </div>
      </div>

      {error ? <div className="error-box">{error}</div> : null}

      {loading && !data ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <div className="loading-spinner" />
        </div>
      ) : data ? (
        <>
          {/* ─── KPIs ─── */}
          <div className="dash-kpis">
            <DashKpi
              label="Agendamentos no mês"
              value={String(data.metrics.monthlyAppointments)}
              icon={<CalendarPlus size={18} />}
              variant="info"
              hint={`${data.metrics.completedAppointments} concluídos`}
            />
            {hasFinancial ? (
              <DashKpi
                label="Faturamento (mês)"
                value={formatMoneyFull(data.financial!.monthRevenue)}
                icon={<DollarSign size={18} />}
                variant="success"
                delta={data.financial!.monthDelta}
                hint="vs. mês anterior"
              />
            ) : (
              <DashKpi
                label="Atendimentos concluídos"
                value={String(data.metrics.completedAppointments)}
                icon={<Check size={18} />}
                variant="success"
                hint="Habilite o Financeiro para ver receita"
              />
            )}
            <DashKpi
              label="Novos clientes"
              value={String(data.metrics.newCustomersThisMonth)}
              icon={<Users size={18} />}
              variant="warning"
              hint={`${data.metrics.customers} no total`}
            />
            <DashKpi
              label="Taxa de ocupação"
              value={`${data.metrics.occupancyRate}%`}
              icon={<Gauge size={18} />}
              variant="danger"
              hint={`${data.metrics.bookedHours}h / ${data.metrics.availableHours}h`}
            />
          </div>

          {/* ─── Linha 1: Agenda do dia + Status do mês ─── */}
          <div className="dash-grid">
            <article className="dash-agenda">
              <div className="dash-agenda__head">
                <div>
                  <h3>Agenda do dia</h3>
                  <div className="sub">
                    {data.todayAppointmentsList.length}{" "}
                    {data.todayAppointmentsList.length === 1 ? "atendimento" : "atendimentos"}
                  </div>
                </div>
                <Link className="link" href="/agenda">Ver agenda</Link>
              </div>
              <div className="dash-agenda__list">
                {data.todayAppointmentsList.length === 0 ? (
                  <div className="dash-agenda__empty">Sem atendimentos para hoje.</div>
                ) : (
                  data.todayAppointmentsList.slice(0, 7).map(appt => {
                    const status = (appt.status as string) || "SCHEDULED";
                    const cls = STATUS_CLASS[status] ?? "scheduled";
                    const services =
                      ((appt.appointmentServices ?? []) as AnyRecord[])
                        .map(s => (s.serviceNameSnapshot ?? s.service?.name) as string | undefined)
                        .filter(Boolean)
                        .join(", ") ||
                      (appt.service?.name as string | undefined) ||
                      "—";
                    return (
                      <button
                        key={appt.id}
                        type="button"
                        className="dash-agenda__row"
                        onClick={() => setSelectedAppointment(appt)}
                      >
                        <span className="dash-agenda__time">{formatTime(appt.startAt)}</span>
                        <span className={`dash-agenda__bar dash-agenda__bar--${cls}`} />
                        <div className="dash-agenda__main">
                          <div className="dash-agenda__nm">{appt.customer?.name ?? "—"}</div>
                          <div className="dash-agenda__meta">
                            <span>{services}</span>
                            <span className="dot" />
                            <span>{appt.professional?.name ?? "—"}</span>
                          </div>
                        </div>
                        <span className={`pill pill--${cls}`}>{STATUS_LABELS[status] ?? status}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </article>

            <article className="dash-panel">
              <div className="dash-panel__head">
                <div>
                  <h3>Status do mês</h3>
                  <div className="sub">Distribuição de {statusBreakdown.total} agendamentos</div>
                </div>
                <Link className="link" href="/agenda">Detalhes</Link>
              </div>
              <div className="dash-donut-wrap">
                <div className="dash-donut" style={{ background: donutGradient }}>
                  <div className="dash-donut__center">
                    <div className="v">{statusBreakdown.total}</div>
                    <div className="l">Total</div>
                  </div>
                </div>
                <div className="dash-legend">
                  {[
                    { label: "Confirmado", count: statusBreakdown.confirmed,  pct: statusBreakdown.confirmedPct,  color: "var(--primary)" },
                    { label: "Agendado",   count: statusBreakdown.scheduled,  pct: statusBreakdown.scheduledPct,  color: "var(--info)" },
                    { label: "Concluído",  count: statusBreakdown.completed,  pct: statusBreakdown.completedPct,  color: "var(--success)" },
                    { label: "Cancelado",  count: statusBreakdown.cancelled,  pct: statusBreakdown.cancelledPct,  color: "var(--danger)" }
                  ].map(row => (
                    <div key={row.label} className="dash-legend__row">
                      <span className="dash-legend__dot" style={{ background: row.color }} />
                      <span className="dash-legend__lbl">{row.label}</span>
                      <span className="dash-legend__count">{row.count}</span>
                      <span className="dash-legend__pct">{row.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          </div>

          {/* ─── Linha 2: Chart 14d + Top serviços ─── */}
          <div className="dash-grid">
            {hasFinancial ? (
              <RevenueChart points={data.financial!.revenue14d ?? []} />
            ) : (
              <article className="dash-panel">
                <div className="dash-panel__head">
                  <div>
                    <h3>Faturamento (últimos 14 dias)</h3>
                    <div className="sub">Habilite o módulo Financeiro para ver o gráfico</div>
                  </div>
                </div>
                <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
                  Indisponível no plano atual.
                </div>
              </article>
            )}

            <article className="dash-panel">
              <div className="dash-panel__head">
                <div>
                  <h3>Top serviços</h3>
                  <div className="sub">Mais agendados no período</div>
                </div>
                <Link className="link" href="/servicos">Todos</Link>
              </div>
              {data.topServices.length === 0 ? (
                <div style={{ padding: 28, textAlign: "center", color: "var(--muted)" }}>
                  Sem dados ainda.
                </div>
              ) : (
                <div className="dash-ts">
                  {data.topServices.map((svc, i) => {
                    const c = TS_COLORS[i % TS_COLORS.length];
                    const maxCount = data.topServices[0]?.count ?? 1;
                    return (
                      <div key={svc.serviceId ?? svc.serviceName} className="dash-ts__row">
                        <span className="dash-ts__ico" style={{ background: c.bg, color: c.color }}>
                          <Briefcase size={16} />
                        </span>
                        <div>
                          <div className="dash-ts__name">{svc.serviceName}</div>
                          <div className="dash-ts__bar">
                            <div
                              style={{
                                width: `${Math.max((svc.count / maxCount) * 100, 6)}%`,
                                background: c.bar
                              }}
                            />
                          </div>
                        </div>
                        <div className="dash-ts__count">
                          {svc.count} <em>×</em>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </article>
          </div>

          {/* ─── Linha 3: Quick actions + Lembretes ─── */}
          <div className="dash-grid">
            <article className="dash-panel">
              <div className="dash-panel__head">
                <div>
                  <h3>Ações rápidas</h3>
                  <div className="sub">Atalhos das tarefas mais comuns</div>
                </div>
              </div>
              <div className="dash-quick">
                <QuickAction
                  icon={<CalendarPlus size={18} />}
                  label="Novo agendamento"
                  desc="Selecione cliente e horário"
                  href="/agenda"
                  bg="var(--primary-ghost)"
                  color="var(--primary-hover)"
                />
                <QuickAction
                  icon={<UserPlus size={18} />}
                  label="Cadastrar cliente"
                  desc="Ficha completa do cliente"
                  href="/clientes"
                  bg="var(--info-light)"
                  color="var(--info)"
                />
                {planFeatures.allowFinancialControl ? (
                  <QuickAction
                    icon={<MinusCircle size={18} />}
                    label="Lançar despesa"
                    desc="Saída do caixa"
                    href="/financeiro"
                    bg="var(--accent-light)"
                    color="var(--accent)"
                  />
                ) : null}
                <QuickAction
                  icon={<Copy size={18} />}
                  label="Copiar link público"
                  desc="Compartilhe sua agenda"
                  href="/configuracoes"
                  bg="var(--purple-light)"
                  color="#7c3aed"
                />
              </div>
            </article>

            {hasBot ? (
              <article className="dash-panel">
                <div className="dash-panel__head">
                  <div>
                    <h3>Próximos lembretes (Bot WhatsApp)</h3>
                    <div className="sub">Disparos automáticos nas próximas 24h</div>
                  </div>
                  <Link className="link" href="/configuracoes/bot">Configurar bot</Link>
                </div>
                {reminders.length === 0 ? (
                  <div style={{ padding: 28, textAlign: "center", color: "var(--muted)" }}>
                    Sem lembretes nas próximas 24h.
                  </div>
                ) : (
                  <div className="dash-rems">
                    {reminders.map(r => (
                      <div key={r.id} className={`dash-rem dash-rem--${r.type}`}>
                        <span className="dash-rem__ico">
                          {r.type === "alert" ? <AlertCircle size={16} /> :
                           r.type === "warn"  ? <Clock size={16} /> :
                                                <MessageCircle size={16} />}
                        </span>
                        <div>
                          <div className="dash-rem__t">{r.title}</div>
                          <div className="dash-rem__s">{r.description}</div>
                        </div>
                        <span className="dash-rem__time">{r.timeLabel}</span>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            ) : (
              <article className="dash-panel">
                <div className="dash-panel__head">
                  <div>
                    <h3>Bot WhatsApp</h3>
                    <div className="sub">Configure para receber lembretes automáticos</div>
                  </div>
                  <Link className="link" href="/configuracoes/bot">Configurar</Link>
                </div>
                <div style={{ padding: 28, textAlign: "center", color: "var(--muted)" }}>
                  <Bot size={28} style={{ opacity: 0.45, marginBottom: 8 }} />
                  <div>Bot indisponível no plano atual.</div>
                </div>
              </article>
            )}
          </div>

          {/* ─── Linha 4: Profissionais hoje (full width) ─── */}
          {data.professionalsToday.length > 0 ? (
            <article className="dash-panel" style={{ marginBottom: 18 }}>
              <div className="dash-panel__head">
                <div>
                  <h3>Profissionais hoje</h3>
                  <div className="sub">Atendimentos por agenda</div>
                </div>
              </div>
              <div className="dash-pro">
                {data.professionalsToday.map((pro, idx) => (
                  <div key={pro.id} className="dash-pro__row">
                    <span className={`avatar avatar--md av-${(idx % 8) + 1}`}>
                      {pro.name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()}
                    </span>
                    <div className="dash-pro__col">
                      <div className="dash-pro__nm">{pro.name}</div>
                      <div className="dash-pro__bar">
                        <div
                          style={{
                            width: `${Math.max(
                              pro.max > 0 ? (pro.count / pro.max) * 100 : 0,
                              6
                            )}%`
                          }}
                        />
                      </div>
                    </div>
                    <div className="dash-pro__count">
                      {pro.count} <em>atend.</em>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ) : null}
        </>
      ) : null}

      {selectedAppointment ? (
        <AppointmentPreviewModal
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onStatusChange={handleStatusChange}
          onRefresh={() => { load(range); setSelectedAppointment(null); }}
          role={role}
          planFeatures={planFeatures}
        />
      ) : null}
    </>
  );
}

/* ─── KPI Card ────────────────────────────────────── */

function DashKpi({
  label, value, icon, variant, hint, delta
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  variant: "info" | "success" | "warning" | "danger" | "primary";
  hint?: string;
  delta?: number;
}) {
  const hasDelta = typeof delta === "number" && !Number.isNaN(delta);
  return (
    <div className={`dash-kpi dash-kpi--${variant}`}>
      <div className="dash-kpi__bar" />
      <div className="dash-kpi__head">
        <span className="dash-kpi__lbl">{label}</span>
        <span className="dash-kpi__ico">{icon}</span>
      </div>
      <div className="dash-kpi__val">{value}</div>
      <div className="dash-kpi__foot">
        {hasDelta ? (
          <span
            className={`dash-kpi__delta ${delta! < 0 ? "dash-kpi__delta--down" : "dash-kpi__delta--up"}`}
          >
            {delta! < 0 ? <TrendingDown size={11} /> : <TrendingUp size={11} />}
            {delta! >= 0 ? "+" : ""}
            {delta}%
          </span>
        ) : null}
        {hint ? <span>{hint}</span> : null}
      </div>
    </div>
  );
}

/* ─── Quick action ────────────────────────────────── */

function QuickAction({
  icon, label, desc, href, bg, color
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  href: string;
  bg: string;
  color: string;
}) {
  return (
    <Link href={href} className="dash-quick__item">
      <span className="ico" style={{ background: bg, color }}>
        {icon}
      </span>
      <div>
        <div className="label">{label}</div>
        <div className="desc">{desc}</div>
      </div>
    </Link>
  );
}

/* ─── Revenue chart 14d ───────────────────────────── */

function RevenueChart({ points }: { points: Revenue14dPoint[] }) {
  const max = useMemo(
    () =>
      Math.max(
        1,
        ...points.flatMap(p => [p.current, p.previous])
      ),
    [points]
  );
  const total = useMemo(
    () => points.reduce((acc, p) => acc + p.current, 0),
    [points]
  );

  return (
    <article className="dash-panel">
      <div className="dash-panel__head">
        <div>
          <h3>Faturamento (últimos 14 dias)</h3>
          <div className="sub">Total no período: {formatMoneyFull(total)}</div>
        </div>
        <Link className="link" href="/financeiro">Detalhes</Link>
      </div>
      <div className="dash-chart">
        <div className="dash-chart__y">
          <span>Atual</span>
          <span className="cmp">14d anteriores</span>
        </div>
        <div className="dash-bars">
          {points.length === 0 ? (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", color: "var(--muted)", padding: 20 }}>
              Sem lançamentos pagos nos últimos 14 dias.
            </div>
          ) : (
            points.map((p, i) => {
              const curH = max > 0 ? Math.max((p.current / max) * 100, p.current > 0 ? 3 : 0) : 0;
              const prevH = max > 0 ? Math.max((p.previous / max) * 100, p.previous > 0 ? 3 : 0) : 0;
              return (
                <div key={i} className="dash-bars__col">
                  <span className="tip">
                    {formatMoney(p.current)}
                    {p.previous > 0 ? ` · prev ${formatMoney(p.previous)}` : ""}
                  </span>
                  <div className="b cmp" style={{ height: `${prevH}%` }} />
                  <div className="b" style={{ height: `${curH}%` }} />
                </div>
              );
            })
          )}
        </div>
        <div className="dash-bars__x">
          {points.map((p, i) => (
            <span key={i}>
              {dayShort(p.date)}
              <br />
              {dayWeekShort(p.date)}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}
