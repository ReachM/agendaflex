"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  Building2,
  CheckCircle2,
  Database,
  History,
  Mail,
  RefreshCcw,
  Users,
  XCircle,
  Zap
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { apiFetch } from "@/lib/client-api";

type Overall = "HEALTHY" | "WARNING" | "DEGRADED";

type Health = {
  overall: Overall;
  dbLatencyMs: number;
  volume: {
    totalCompanies: number;
    activeCompanies: number;
    suspendedCompanies: number;
    totalUsers: number;
    activeUsers: number;
    totalCustomers: number;
    appointmentsToday: number;
    appointmentsLast7d: number;
    appointmentsLast30d: number;
  };
  notifications: {
    sent24h: number;
    failed24h: number;
    failRate: number;
  };
  bot: {
    conversations24h: number;
    instancesActive: number;
    reminders24h: number;
  };
  integrity: {
    companiesWithoutSubs: number;
    orphanProfessionals: number;
    invoiceErrors7d: number;
    cancelledSubs30d: number;
  };
  audit: {
    events24h: number;
    recent: {
      id: string;
      action: string;
      entityType: string;
      entityId: string | null;
      createdAt: string;
      companyName: string | null;
      userName: string | null;
      userEmail: string | null;
    }[];
  };
  database: {
    tables: { table: string; rows: number }[];
  };
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatRelative(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

const OVERALL_LABEL: Record<Overall, { label: string; cls: string; icon: React.ReactNode }> = {
  HEALTHY: { label: "Saudável", cls: "pill--success", icon: <CheckCircle2 size={14} /> },
  WARNING: { label: "Atenção", cls: "pill--warn", icon: <AlertTriangle size={14} /> },
  DEGRADED: { label: "Degradado", cls: "pill--danger", icon: <XCircle size={14} /> }
};

export default function MasterSaudePage() {
  const [data, setData] = useState<Health | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiFetch<Health>("/api/master/health");
      setData(result);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (!data) {
    return (
      <>
        <PageHeader title="Saúde do sistema" subtitle="Métricas técnicas e disponibilidade" />
        {error ? <div className="error-box">{error}</div> : <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><div className="loading-spinner" /></div>}
      </>
    );
  }

  const overall = OVERALL_LABEL[data.overall];

  return (
    <>
      <PageHeader
        title="Saúde do sistema"
        subtitle="Métricas técnicas, integridade e eventos recentes"
        actions={
          <>
            <span className={`pill ${overall.cls}`}>{overall.icon} {overall.label}</span>
            <span className="env-pill"><span className="dot" /> PRODUCTION</span>
            <button type="button" className="btn btn-ghost" onClick={load} disabled={loading}>
              <RefreshCcw size={15} /> Atualizar
            </button>
          </>
        }
      />

      {error ? <div className="error-box">{error}</div> : null}

      {/* Top KPIs */}
      <div className="grid cols-4" style={{ marginBottom: 22 }}>
        <KpiCard label="Latência DB" value={`${data.dbLatencyMs} ms`} icon={<Database size={18} />} variant={data.dbLatencyMs < 200 ? "emerald" : data.dbLatencyMs < 500 ? "amber" : "rose"} hint="round-trip da request" />
        <KpiCard label="Eventos auditados (24h)" value={String(data.audit.events24h)} icon={<History size={18} />} variant="default" />
        <KpiCard label="Falhas de notificação" value={`${data.notifications.failRate}%`} icon={<Mail size={18} />} variant={data.notifications.failRate < 5 ? "emerald" : data.notifications.failRate < 20 ? "amber" : "rose"} hint={`${data.notifications.failed24h} / ${data.notifications.sent24h} em 24h`} />
        <KpiCard label="Instâncias WhatsApp" value={String(data.bot.instancesActive)} icon={<Bot size={18} />} variant="sky" hint={`${data.bot.conversations24h} conversas / 24h`} />
      </div>

      {/* Volume + Integrity */}
      <div className="grid cols-2" style={{ marginBottom: 20 }}>
        <section className="panel">
          <div className="panel__head">
            <div>
              <div className="panel__title">Volume</div>
              <div className="panel__sub">Movimentação geral da plataforma</div>
            </div>
          </div>
          <div className="panel__body">
            <MetricRow icon={<Building2 size={14} />} label="Empresas ativas" value={data.volume.activeCompanies} suffix={` de ${data.volume.totalCompanies}`} />
            <MetricRow icon={<Building2 size={14} />} label="Empresas suspensas" value={data.volume.suspendedCompanies} variant={data.volume.suspendedCompanies > 0 ? "danger" : undefined} />
            <MetricRow icon={<Users size={14} />} label="Usuários totais" value={data.volume.totalUsers} suffix={` · ${data.volume.activeUsers} ativos (30d)`} />
            <MetricRow icon={<Users size={14} />} label="Clientes cadastrados" value={data.volume.totalCustomers} />
            <MetricRow icon={<Activity size={14} />} label="Agendamentos hoje" value={data.volume.appointmentsToday} />
            <MetricRow icon={<Activity size={14} />} label="Últimos 7 dias" value={data.volume.appointmentsLast7d} />
            <MetricRow icon={<Activity size={14} />} label="Últimos 30 dias" value={data.volume.appointmentsLast30d} />
          </div>
        </section>

        <section className="panel">
          <div className="panel__head">
            <div>
              <div className="panel__title">Integridade</div>
              <div className="panel__sub">Verificações de consistência</div>
            </div>
          </div>
          <div className="panel__body">
            <IntegrityRow
              label="Empresas ativas sem assinatura"
              count={data.integrity.companiesWithoutSubs}
              ok={data.integrity.companiesWithoutSubs === 0}
              description="Tenants ACTIVE precisam de subscription ACTIVE ou TRIALING"
            />
            <IntegrityRow
              label="Profissionais sem horário de trabalho"
              count={data.integrity.orphanProfessionals}
              ok={data.integrity.orphanProfessionals === 0}
              description="Profissionais ativos com workingHours=null não aparecem no link público"
            />
            <IntegrityRow
              label="Notas fiscais canceladas (7d)"
              count={data.integrity.invoiceErrors7d}
              ok={data.integrity.invoiceErrors7d < 5}
              description="Cancelamentos altos podem indicar erro de integração NFE.io"
              warningThreshold
            />
            <IntegrityRow
              label="Assinaturas canceladas (30d)"
              count={data.integrity.cancelledSubs30d}
              ok={data.integrity.cancelledSubs30d < 3}
              description="Churn mensal acima do esperado"
              warningThreshold
            />
          </div>
        </section>
      </div>

      {/* Bot + Reminders + Audit */}
      <div className="grid cols-3" style={{ marginBottom: 20 }}>
        <section className="panel">
          <div className="panel__head">
            <div>
              <div className="panel__title">
                <Bot size={14} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px" }} />
                Bot WhatsApp
              </div>
              <div className="panel__sub">Últimas 24h</div>
            </div>
          </div>
          <div className="panel__body">
            <MetricRow icon={<Zap size={14} />} label="Conversas ativas" value={data.bot.conversations24h} />
            <MetricRow icon={<Bot size={14} />} label="Instâncias conectadas" value={data.bot.instancesActive} />
            <MetricRow icon={<Mail size={14} />} label="Lembretes enviados" value={data.bot.reminders24h} />
          </div>
        </section>

        <section className="panel">
          <div className="panel__head">
            <div>
              <div className="panel__title">
                <Mail size={14} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px" }} />
                Notificações
              </div>
              <div className="panel__sub">Últimas 24h</div>
            </div>
          </div>
          <div className="panel__body">
            <MetricRow icon={<Mail size={14} />} label="Enviadas" value={data.notifications.sent24h} />
            <MetricRow icon={<XCircle size={14} />} label="Falharam" value={data.notifications.failed24h} variant={data.notifications.failed24h > 0 ? "danger" : undefined} />
            <MetricRow icon={<Activity size={14} />} label="Taxa de falha" value={`${data.notifications.failRate}%`} variant={data.notifications.failRate > 5 ? "warning" : undefined} />
          </div>
        </section>

        <section className="panel">
          <div className="panel__head">
            <div>
              <div className="panel__title">
                <Database size={14} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px" }} />
                Banco de dados
              </div>
              <div className="panel__sub">Top 10 tabelas por linhas</div>
            </div>
          </div>
          <div className="panel__body" style={{ maxHeight: 240, overflowY: "auto" }}>
            {data.database.tables.length === 0 ? (
              <div className="empty">Sem dados de pg_stat_user_tables.</div>
            ) : (
              data.database.tables.map(t => (
                <div key={t.table} className="metric-row">
                  <span className="metric-row__label" style={{ fontFamily: "monospace", fontSize: 12 }}>{t.table}</span>
                  <span className="metric-row__value">{t.rows.toLocaleString("pt-BR")}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Audit log */}
      <section className="panel">
        <div className="panel__head">
          <div>
            <div className="panel__title">
              <History size={14} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px" }} />
              Atividade recente
            </div>
            <div className="panel__sub">{data.audit.recent.length} últimos eventos das 24h ({data.audit.events24h} no total)</div>
          </div>
        </div>
        <div className="panel__body panel__body--flush">
          {data.audit.recent.length === 0 ? (
            <div className="empty">Sem atividade nas últimas 24h.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Ação</th>
                  <th>Entidade</th>
                  <th className="col-hide-mobile">Empresa</th>
                  <th className="col-hide-mobile">Usuário</th>
                </tr>
              </thead>
              <tbody>
                {data.audit.recent.map(e => (
                  <tr key={e.id}>
                    <td style={{ fontSize: 12, color: "var(--muted)" }}>
                      {formatRelative(e.createdAt)} atrás
                      <div style={{ fontSize: 10 }}>{formatDate(e.createdAt)}</div>
                    </td>
                    <td><span className="pill pill--violet" style={{ textTransform: "lowercase" }}>{e.action}</span></td>
                    <td><span style={{ fontSize: 12, fontFamily: "monospace" }}>{e.entityType}</span></td>
                    <td className="col-hide-mobile">{e.companyName ?? "—"}</td>
                    <td className="col-hide-mobile">
                      {e.userName ? (
                        <div>
                          <strong style={{ fontSize: 13 }}>{e.userName}</strong>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>{e.userEmail}</div>
                        </div>
                      ) : "—"}
                    </td>
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

function MetricRow({ icon, label, value, suffix, variant }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  suffix?: string;
  variant?: "danger" | "warning" | "success";
}) {
  const valueCls = variant === "danger" ? "metric-row__value--danger" : variant === "warning" ? "" : variant === "success" ? "metric-row__value--success" : "";
  const valueStyle = variant === "warning" ? { color: "var(--warning, #fbbf24)" } : undefined;
  return (
    <div className="metric-row">
      <span className="metric-row__label">{icon} {label}</span>
      <span className={`metric-row__value ${valueCls}`} style={valueStyle}>
        {value}
        {suffix ? <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: 12, marginLeft: 4 }}>{suffix}</span> : null}
      </span>
    </div>
  );
}

function IntegrityRow({ label, count, ok, description, warningThreshold }: {
  label: string;
  count: number;
  ok: boolean;
  description: string;
  warningThreshold?: boolean;
}) {
  const pillCls = ok ? "pill--success" : warningThreshold ? "pill--warn" : "pill--danger";
  return (
    <div className="metric-row" style={{ alignItems: "flex-start" }}>
      <span className="metric-row__label" style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {ok ? <CheckCircle2 size={14} style={{ color: "var(--success)" }} /> : <AlertTriangle size={14} style={{ color: warningThreshold ? "var(--warning)" : "var(--danger)" }} />}
          <span>{label}</span>
        </div>
        <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 20 }}>{description}</span>
      </span>
      <span className={`pill ${pillCls}`}>{count}</span>
    </div>
  );
}

function KpiCard({ label, value, icon, variant = "default", hint }: {
  label: string;
  value: string;
  icon: React.ReactNode;
  variant?: "default" | "emerald" | "sky" | "rose" | "amber";
  hint?: string;
}) {
  const cls = variant === "default" ? "" : `kpi--${variant}`;
  return (
    <div className={`kpi ${cls}`}>
      <div className="kpi__head">
        <span className="kpi__label">{label}</span>
        <span className="kpi__icon">{icon}</span>
      </div>
      <div className="kpi__value">{value}</div>
      {hint ? <div className="kpi__foot"><span>{hint}</span></div> : null}
    </div>
  );
}
