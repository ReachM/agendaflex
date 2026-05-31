"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Bot,
  CalendarPlus,
  Cake,
  CheckCircle,
  Clock,
  DollarSign,
  Download,
  FileText,
  Gauge,
  Gift,
  MessageCircle,
  Plus,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { apiFetch } from "@/lib/client-api";
import { AppointmentPreviewModal, TodayAppointments } from "@/components/appointment-preview";

type AnyRecord = Record<string, any>;

type Range = "today" | "week" | "month" | "year";

const RANGE_LABELS: { id: Range; label: string }[] = [
  { id: "today", label: "Hoje" },
  { id: "week", label: "Semana" },
  { id: "month", label: "Mês" },
  { id: "year", label: "Ano" }
];

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
  };
  bot?: {
    enabled: boolean;
    conversations24h: number;
    reminders24h: number;
    appointments24h: number;
  };
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatBirth(value: string) {
  const d = new Date(value);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(d);
}

function firstName(full: string | undefined) {
  if (!full) return "lá";
  return full.split(" ")[0];
}

function todayLabel() {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date());
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
    const rows = [
      ["Período", `${data.range} (${new Date(data.metrics.monthlyAppointments ? Date.now() : 0).toLocaleDateString("pt-BR")})`],
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
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
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

  const statusDistribution = useMemo(() => {
    if (!data) return [];
    const m = data.metrics;
    const total = m.confirmedAppointments + m.completedAppointments + m.cancelledAppointments + m.pendingAppointments;
    return [
      { label: "Agendados", value: m.pendingAppointments, color: "var(--info)", total },
      { label: "Confirmados", value: m.confirmedAppointments, color: "var(--primary)", total },
      { label: "Concluídos", value: m.completedAppointments, color: "var(--success)", total },
      { label: "Cancelados", value: m.cancelledAppointments, color: "var(--danger)", total }
    ];
  }, [data]);

  return (
    <>
      <PageHeader
        title={`Olá, ${firstName(userName)} 👋`}
        subtitle={todayLabel()}
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
            <button type="button" className="btn btn-ghost" onClick={exportSummary} disabled={!data}>
              <Download size={15} /> Exportar
            </button>
            <Link className="btn btn-primary" href="/agenda">
              <Plus size={15} /> Novo agendamento
            </Link>
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
            <Kpi
              label="Agendamentos no mês"
              value={String(data.metrics.monthlyAppointments)}
              icon={<CalendarPlus size={20} />}
              variant="info"
              hint={`${data.metrics.completedAppointments} concluídos`}
            />
            {hasFinancial ? (
              <Kpi
                label="Faturamento (mês)"
                value={formatMoney(data.financial!.monthRevenue)}
                icon={<DollarSign size={20} />}
                variant="success"
                delta={data.financial!.monthDelta}
              />
            ) : (
              <Kpi
                label="Atendimentos concluídos"
                value={String(data.metrics.completedAppointments)}
                icon={<CheckCircle size={20} />}
                variant="success"
                hint="Habilite o Financeiro para ver receita"
              />
            )}
            <Kpi
              label="Novos clientes (mês)"
              value={String(data.metrics.newCustomersThisMonth)}
              icon={<Users size={20} />}
              variant="warning"
              hint={`${data.metrics.customers} no total`}
            />
            <Kpi
              label="Taxa de ocupação"
              value={`${data.metrics.occupancyRate}%`}
              icon={<Gauge size={20} />}
              variant="danger"
              hint={`${data.metrics.bookedHours}h / ${data.metrics.availableHours}h disponíveis`}
            />
          </div>

          {/* ─── Status do mês + Blocos rápidos ─── */}
          <div className="grid cols-2" style={{ marginBottom: 16 }}>
            <section className="panel">
              <div className="panel__head">
                <div>
                  <div className="panel__title">Status do mês</div>
                  <div className="panel__sub">Distribuição dos {data.metrics.monthlyAppointments} agendamentos</div>
                </div>
              </div>
              <div className="panel__body">
                <div className="hbar">
                  {statusDistribution.map(s => {
                    const pct = s.total > 0 ? (s.value / s.total) * 100 : 0;
                    return (
                      <div key={s.label} className="hbar__item">
                        <span className="hbar__label">{s.label}</span>
                        <div className="hbar__track">
                          <div className="hbar__fill" style={{ width: `${Math.max(pct, 4)}%`, background: s.color }}>{s.value}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="panel">
              <div className="panel__head">
                <div>
                  <div className="panel__title">Atalhos rápidos</div>
                  <div className="panel__sub">Acesso direto às principais ações</div>
                </div>
              </div>
              <div className="panel__body">
                <div className="grid cols-2" style={{ gap: 10 }}>
                  <QuickAction icon={<CalendarPlus size={18} />} label="Novo agendamento" href="/agenda" color="var(--primary)" />
                  <QuickAction icon={<Users size={18} />} label="Cadastrar cliente" href="/clientes" color="var(--info)" />
                  {planFeatures.allowFinancialControl ? (
                    <QuickAction icon={<TrendingDown size={18} />} label="Lançar despesa" href="/financeiro" color="var(--danger)" />
                  ) : null}
                  {planFeatures.allowBotIntegration ? (
                    <QuickAction icon={<Bot size={18} />} label="Configurar bot" href="/configuracoes/bot" color="var(--warning)" />
                  ) : null}
                  {planFeatures.allowInvoiceRequest ? (
                    <QuickAction icon={<FileText size={18} />} label="Emitir nota" href="/notas-fiscais" color="var(--purple)" />
                  ) : null}
                  <QuickAction icon={<Activity size={18} />} label="Ver relatórios" href="/relatorios" color="var(--success)" />
                </div>
              </div>
            </section>
          </div>

          {/* ─── Today + sidebar widgets ─── */}
          <div className="grid" style={{ gridTemplateColumns: "1.6fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <TodayAppointments
                appointments={data.todayAppointmentsList}
                onStatusChange={handleStatusChange}
                onRefresh={() => load(range)}
                role={role}
                planFeatures={planFeatures}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Próximos horários */}
              <section className="panel">
                <div className="panel__head">
                  <div>
                    <div className="panel__title">Próximos horários</div>
                    <div className="panel__sub">Os 8 mais próximos</div>
                  </div>
                </div>
                <div className="panel__body panel__body--flush">
                  {data.nextAppointments.length === 0 ? (
                    <div className="empty" style={{ padding: 16 }}>Sem agendamentos futuros.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {data.nextAppointments.slice(0, 6).map(appt => (
                        <button
                          key={appt.id}
                          type="button"
                          onClick={() => setSelectedAppointment(appt)}
                          style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "10px 16px", border: 0,
                            borderBottom: "1px solid var(--border)",
                            background: "transparent", cursor: "pointer", textAlign: "left",
                            width: "100%"
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-muted)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                        >
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 50, color: "var(--primary)" }}>
                            <Clock size={13} />
                            <strong style={{ fontSize: 12 }}>{formatTime(appt.startAt)}</strong>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <strong style={{ fontSize: 13 }}>{appt.customer?.name ?? "—"}</strong>
                            <div style={{ fontSize: 11, color: "var(--muted)" }}>
                              {(appt.appointmentServices ?? []).map((s: AnyRecord) => s.serviceNameSnapshot ?? s.service?.name).filter(Boolean).join(", ") || appt.service?.name || "—"}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* Clientes VIP */}
              <section className="panel">
                <div className="panel__head">
                  <div>
                    <div className="panel__title">Clientes VIP</div>
                    <div className="panel__sub">Top 5 por total gasto</div>
                  </div>
                </div>
                <div className="panel__body panel__body--flush">
                  {data.vipCustomers.length === 0 ? (
                    <div className="empty" style={{ padding: 16 }}>Sem dados de valor por cliente.</div>
                  ) : (
                    data.vipCustomers.map((c, idx) => (
                      <div key={c.customerId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
                        <span className={`avatar avatar--sm av-${(idx % 8) + 1}`}>{c.name[0]?.toUpperCase() ?? "?"}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <strong style={{ fontSize: 13 }}>{c.name}</strong>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>{c.visits} visitas</div>
                        </div>
                        <strong style={{ fontSize: 13, color: "var(--primary)" }}>{formatMoney(c.totalSpent)}</strong>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Aniversariantes */}
              {data.upcomingBirthdays.length > 0 ? (
                <section className="panel">
                  <div className="panel__head">
                    <div>
                      <div className="panel__title">
                        <Cake size={14} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px", color: "var(--pink, #db2777)" }} />
                        Aniversariantes
                      </div>
                      <div className="panel__sub">Próximos 30 dias</div>
                    </div>
                  </div>
                  <div className="panel__body panel__body--flush">
                    {data.upcomingBirthdays.map((b, idx) => (
                      <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
                        <span className={`avatar avatar--sm av-${(idx % 8) + 1}`}><Gift size={12} /></span>
                        <div style={{ flex: 1 }}>
                          <strong style={{ fontSize: 13 }}>{b.name}</strong>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>{b.phone ?? "—"}</div>
                        </div>
                        <span style={{ fontSize: 12, color: "var(--pink, #db2777)", fontWeight: 700 }}>{formatBirth(b.birthDate)}</span>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {/* Bot resume */}
              {hasBot ? (
                <section className="panel">
                  <div className="panel__head">
                    <div>
                      <div className="panel__title">
                        <Bot size={14} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px", color: "var(--primary)" }} />
                        Bot WhatsApp
                      </div>
                      <div className="panel__sub">Últimas 24h</div>
                    </div>
                    <span className={`pill ${data.bot!.enabled ? "pill--success" : "pill--muted"}`}>
                      <span className="dot-s" /> {data.bot!.enabled ? "Online" : "Desligado"}
                    </span>
                  </div>
                  <div className="panel__body">
                    <div className="metric-row">
                      <span className="metric-row__label"><MessageCircle size={13} /> Conversas</span>
                      <span className="metric-row__value">{data.bot!.conversations24h}</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-row__label"><CalendarPlus size={13} /> Agendados pelo bot</span>
                      <span className="metric-row__value">{data.bot!.appointments24h}</span>
                    </div>
                    <div className="metric-row" style={{ borderBottom: 0 }}>
                      <span className="metric-row__label"><Clock size={13} /> Lembretes enviados</span>
                      <span className="metric-row__value">{data.bot!.reminders24h}</span>
                    </div>
                  </div>
                </section>
              ) : null}
            </div>
          </div>

          {/* ─── Top serviços (faixa final) ─── */}
          {data.topServices.length > 0 ? (
            <section className="panel">
              <div className="panel__head">
                <div>
                  <div className="panel__title">
                    <Sparkles size={14} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px", color: "var(--warning)" }} />
                    Serviços mais agendados
                  </div>
                </div>
              </div>
              <div className="panel__body">
                <div className="hbar">
                  {data.topServices.map(s => {
                    const max = Math.max(...data.topServices.map(x => x.count), 1);
                    return (
                      <div key={s.serviceId ?? s.serviceName} className="hbar__item">
                        <span className="hbar__label">{s.serviceName}</span>
                        <div className="hbar__track">
                          <div className="hbar__fill" style={{ width: `${Math.max((s.count / max) * 100, 6)}%` }}>{s.count}x</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
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

function Kpi({ label, value, icon, variant, hint, delta }: {
  label: string;
  value: string;
  icon: React.ReactNode;
  variant: "success" | "danger" | "info" | "warning";
  hint?: string;
  delta?: number;
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
      <div className="stat-card__footer" style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {delta !== undefined ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 999, color: delta < 0 ? "var(--danger)" : "var(--success)", background: delta < 0 ? "var(--danger-light)" : "var(--success-light)" }}>
            {delta < 0 ? <TrendingDown size={11} /> : <TrendingUp size={11} />}
            {delta >= 0 ? "+" : ""}{delta}%
          </span>
        ) : null}
        {hint ? <span>{hint}</span> : null}
      </div>
    </div>
  );
}

function QuickAction({ icon, label, href, color }: {
  icon: React.ReactNode;
  label: string;
  href: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "12px 14px",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        background: "var(--surface)",
        textDecoration: "none",
        transition: "all 0.15s",
        color: "var(--text)"
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.background = "var(--surface-muted)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--surface)"; }}
    >
      <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--surface-muted)", color, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <strong style={{ fontSize: 13 }}>{label}</strong>
    </Link>
  );
}
