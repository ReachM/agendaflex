"use client";
import { Activity, BarChart3, Calendar, Clock, TrendingDown, TrendingUp, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { apiFetch } from "@/lib/client-api";

type AnyRecord = Record<string, any>;

const statusLabels: Record<string, string> = {
  SCHEDULED: "Agendado", CONFIRMED: "Confirmado", IN_PROGRESS: "Em atendimento",
  COMPLETED: "Concluído", CANCELLED: "Cancelado", NO_SHOW: "Não compareceu"
};

const statusColors: Record<string, string> = {
  SCHEDULED: "var(--info)", CONFIRMED: "var(--primary)", IN_PROGRESS: "var(--accent)",
  COMPLETED: "var(--success)", CANCELLED: "var(--danger)", NO_SHOW: "#94a3b8"
};

export default function RelatoriosPage() {
  const [data, setData] = useState<AnyRecord | null>(null);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  function load() {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    apiFetch<AnyRecord>(`/api/reports?${params}`).then(setData).catch(err => setError(err.message));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  if (!data) {
    return (
      <>
        <PageHeader title="Relatórios" subtitle="Indicadores e métricas da empresa" />
        {error ? <div className="error-box">{error}</div> : <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><div className="loading-spinner" /></div>}
      </>
    );
  }

  const s = data.starter;
  const p = data.pro;

  const statusMax = Math.max(...(s.appointmentsByStatus ?? []).map((st: any) => st.count), 1);
  const svcMax = Math.max(...(s.topServices ?? []).map((sv: any) => sv.count), 1);

  return (
    <>
      <PageHeader title="Relatórios" subtitle={`Indicadores do plano ${data.planLevel?.toUpperCase()}`} />

      {/* ─── Filters ──────────────────────────────────── */}
      <div className="search-bar">
        <Calendar size={16} style={{ color: "var(--muted)" }} />
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        <span style={{ color: "var(--muted)", fontSize: 13 }}>até</span>
        <input type="date" value={to} onChange={e => setTo(e.target.value)} />
        <button className="button secondary" onClick={load} type="button">Filtrar</button>
      </div>

      {/* ─── Starter: Overview ────────────────────────── */}
      <div className="section-divider"><h2>Visão Geral</h2></div>
      <div className="grid cols-3" style={{ marginBottom: 24 }}>
        <div className="stat-card stat-card--info">
          <div className="stat-card__header"><div className="stat-card__label">Total de Agendamentos</div><div className="stat-card__icon"><BarChart3 size={18} /></div></div>
          <div className="stat-card__value">{s.totalAppointments ?? "-"}</div>
        </div>
        <div className="stat-card stat-card--purple">
          <div className="stat-card__header"><div className="stat-card__label">Clientes Cadastrados</div><div className="stat-card__icon"><Users size={18} /></div></div>
          <div className="stat-card__value">{s.totalCustomers ?? "-"}</div>
        </div>
        <div className="stat-card stat-card--success">
          <div className="stat-card__header"><div className="stat-card__label">Serviço mais agendado</div><div className="stat-card__icon"><TrendingUp size={18} /></div></div>
          <div className="stat-card__value" style={{ fontSize: 18 }}>{s.topServices?.[0]?.serviceName ?? "-"}</div>
          <div className="stat-card__footer">{s.topServices?.[0]?.count ?? 0}x agendado</div>
        </div>
      </div>

      <div className="grid cols-2" style={{ marginBottom: 24 }}>
        {/* Status Distribution */}
        <section className="panel">
          <h2 className="section-title">Agendamentos por Status</h2>
          <div className="hbar" style={{ marginTop: 16 }}>
            {(s.appointmentsByStatus ?? []).map((st: any) => (
              <div key={st.status} className="hbar__item">
                <span className="hbar__label">{statusLabels[st.status] ?? st.status}</span>
                <div className="hbar__track">
                  <div className="hbar__fill" style={{ width: `${Math.max((st.count / statusMax) * 100, 8)}%`, background: statusColors[st.status] ?? "var(--primary)" }}>{st.count}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Top Services */}
        <section className="panel">
          <h2 className="section-title">Serviços Mais Agendados</h2>
          <div className="hbar" style={{ marginTop: 16 }}>
            {(s.topServices ?? []).map((svc: any) => (
              <div key={svc.serviceId} className="hbar__item">
                <span className="hbar__label">{svc.serviceName}</span>
                <div className="hbar__track">
                  <div className="hbar__fill" style={{ width: `${Math.max((svc.count / svcMax) * 100, 8)}%` }}>{svc.count}x</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ─── Pro Reports (non-financial) ────────────── */}
      {p && (
        <>
          <div className="section-divider"><h2>Relatórios Pro</h2></div>
          <div className="grid cols-3" style={{ marginBottom: 24 }}>
            <div className="stat-card stat-card--danger">
              <div className="stat-card__header"><div className="stat-card__label">Taxa de Cancelamento</div><div className="stat-card__icon"><TrendingDown size={18} /></div></div>
              <div className="stat-card__value">{p.cancellationRate}%</div>
              <div className="stat-card__footer">{p.totalCancelled} cancelados</div>
            </div>
            <div className="stat-card stat-card--info">
              <div className="stat-card__header"><div className="stat-card__label">Agendamentos Online</div><div className="stat-card__icon"><Activity size={18} /></div></div>
              <div className="stat-card__value">{p.clientBookings ?? 0}</div>
              <div className="stat-card__footer">Via página pública</div>
            </div>
            <div className="stat-card stat-card--warning">
              <div className="stat-card__header"><div className="stat-card__label">Horário Pico</div><div className="stat-card__icon"><Clock size={18} /></div></div>
              <div className="stat-card__value">{p.peakHours?.[0] ? `${String(p.peakHours[0].hour).padStart(2, "0")}:00` : "-"}</div>
              <div className="stat-card__footer">{p.peakHours?.[0]?.count ?? 0} agendamentos</div>
            </div>
          </div>
          <div className="grid cols-2" style={{ marginBottom: 24 }}>
            <section className="panel">
              <h2 className="section-title">Agendamentos por Profissional</h2>
              {(p.byProfessional ?? []).length === 0 ? <div className="empty">Sem dados.</div> : (
                <div style={{ marginTop: 12 }}>
                  {(p.byProfessional ?? []).map((prof: any) => (
                    <div key={prof.professionalId} className="metric-row">
                      <span className="metric-row__label">
                        <div className="avatar avatar--sm">{prof.professionalName?.[0] ?? "?"}</div>
                        {prof.professionalName}
                      </span>
                      <span className="metric-row__value metric-row__value--primary">{prof.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section className="panel">
              <h2 className="section-title">Horários Mais Procurados</h2>
              {(p.peakHours ?? []).length === 0 ? <div className="empty">Sem dados.</div> : (
                <div style={{ marginTop: 12 }}>
                  {(p.peakHours ?? []).map((h: any) => (
                    <div key={h.hour} className="metric-row">
                      <span className="metric-row__label"><Clock size={14} />{String(h.hour).padStart(2, "0")}:00</span>
                      <span className="metric-row__value">{h.count} agendamentos</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}

      {/* TODO [MVP-FUTURE] Relatórios Max (financeiros) — reativar na v2 */}
      {/* Seção removida: Ticket Médio, Receita por Mês, Clientes Fiéis */}
    </>
  );
}
