"use client";

import {
  AlertTriangle,
  Building2,
  DollarSign,
  Database,
  ExternalLink,
  FileText,
  MessageCircle,
  MoreVertical,
  Server,
  TrendingDown,
  UserPlus,
  Zap
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import {
  SABiz,
  SAError,
  SAHealthBar,
  SAKpiCard,
  SALoading,
  SAPageHeader,
  SAPlanTag,
  SAStatusDot,
  SASysBadge,
  avatarClass,
  brl,
  initials,
  num,
  relativeTime
} from "@/components/master/sa-bits";
import { SADonut, SALineChart } from "@/components/master/sa-charts";
import { useSAData } from "@/components/master/use-sa-data";

type Company = {
  id: string;
  name: string;
  slug: string | null;
  plan: string;
  planSlug: string | null;
  mrr: number;
  subStatus: string | null;
  status: string;
  usersCount: number;
  health: "good" | "mid" | "low";
  createdAt: string;
};

type DashboardResponse = {
  metrics: {
    companies: number;
    activeCompanies: number;
    trialingCompanies: number;
    pastDueCompanies: number;
    cancelledLast30: number;
    newCompaniesThisMonth: number;
    users: number;
    mrr: number;
    mrrDelta: number;
    trialCompanies30d: number;
  };
  planMix: { planId: string; planName: string; planSlug: string; count: number }[];
  companies: Company[];
};

type SubsResponse = {
  metrics: { arr: number; conversionRate: number };
  mrrByMonth: { month: string; mrr: number; newSubs: number }[];
};

type HealthResponse = {
  overall: string;
  notifications: { failRate: number };
  bot: { instancesActive: number };
  integrity: { companiesWithoutSubs: number; invoiceErrors7d: number; cancelledSubs30d: number };
};

const PLAN_COLORS: Record<string, string> = {
  pro: "#8b5cf6",
  max: "#fbbf24",
  starter: "#2dd4bf",
  trial: "#38bdf8",
  free: "#64748b"
};

const HEALTH_PCT: Record<string, number> = { good: 88, mid: 58, low: 28 };

function monthShort(iso: string) {
  const [, m] = iso.split("-");
  return ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][Number(m) - 1] ?? m;
}

export default function OverviewPage() {
  const router = useRouter();
  const { data, error, loading } = useSAData<DashboardResponse>("/api/master/dashboard");
  const subs = useSAData<SubsResponse>("/api/master/subscriptions");
  const health = useSAData<HealthResponse>("/api/master/health");

  const donut = useMemo(() => {
    if (!data) return [];
    return data.planMix.map((p) => ({
      label: p.planName,
      value: p.count,
      color: PLAN_COLORS[p.planSlug] ?? "#64748b"
    }));
  }, [data]);

  const recentSignups = useMemo(() => {
    if (!data) return [];
    return [...data.companies].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 6);
  }, [data]);

  async function impersonate(companyId: string) {
    try {
      const res = await fetch("/api/master/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId })
      });
      if (res.ok) {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      /* ignore */
    }
  }

  if (!data) {
    return (
      <>
        <SAPageHeader title="Visão geral" sub="Saúde da plataforma em tempo real" />
        {error ? <SAError>{error}</SAError> : <SALoading />}
      </>
    );
  }

  const m = data.metrics;
  const series = subs.data?.mrrByMonth ?? [];

  return (
    <>
      <SAPageHeader title="Visão geral" sub="Saúde da plataforma em tempo real" />

      {error ? <SAError>{error}</SAError> : null}

      <div className="kpi-grid">
        <SAKpiCard
          label="MRR"
          value={brl(m.mrr)}
          icon={<DollarSign size={18} />}
          delta={`${m.mrrDelta >= 0 ? "+" : ""}${m.mrrDelta}%`}
          deltaDown={m.mrrDelta < 0}
          foot={subs.data ? `ARR ${brl(subs.data.metrics.arr, { compact: true })}` : "ARR —"}
        />
        <SAKpiCard
          label="Empresas ativas"
          value={num(m.activeCompanies)}
          variant="teal"
          icon={<Building2 size={18} />}
          delta={`+${m.newCompaniesThisMonth}`}
          foot="novas no mês"
        />
        <SAKpiCard
          label="Trials ativos"
          value={num(m.trialingCompanies)}
          variant="sky"
          icon={<Zap size={18} />}
          foot={subs.data ? `${subs.data.metrics.conversionRate}% conversão média` : "conversão —"}
        />
        <SAKpiCard
          label="Churn (30d)"
          value={num(m.cancelledLast30)}
          variant="rose"
          icon={<TrendingDown size={18} />}
          foot="cancelamentos"
        />
      </div>

      <div className="grid-2">
        <section className="panel">
          <div className="panel__head">
            <div>
              <div className="panel__title">Crescimento de MRR</div>
              <div className="panel__sub">Últimos 12 meses</div>
            </div>
          </div>
          <div className="panel__body">
            {series.length > 0 ? (
              <SALineChart
                series={[{ color: "#8b5cf6", data: series.map((s) => s.mrr), fill: true }]}
                labels={series.map((s) => monthShort(s.month))}
              />
            ) : (
              <SALoading />
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel__head">
            <div className="panel__title">Distribuição por plano</div>
          </div>
          <div className="panel__body" style={{ display: "flex", justifyContent: "center" }}>
            {donut.length > 0 ? <SADonut slices={donut} /> : <SAStatusDot status="INACTIVE" label="Sem assinaturas" />}
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel__head">
          <div className="panel__title">Empresas</div>
          <Link href="/master/empresas" className="link">
            Ver todas <ExternalLink size={13} />
          </Link>
        </div>
        <div className="panel__body panel__body--flush">
          <table className="tbl">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Plano</th>
                <th>Usuários</th>
                <th>MRR</th>
                <th style={{ width: 130 }}>Saúde</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.companies.slice(0, 8).map((c) => (
                <tr key={c.id}>
                  <td>
                    <SABiz name={c.name} sub={c.slug ?? undefined} seed={c.id} />
                  </td>
                  <td>
                    <SAPlanTag plan={c.planSlug ?? c.plan} />
                  </td>
                  <td className="num">{c.usersCount}</td>
                  <td className="money">{brl(c.mrr)}</td>
                  <td>
                    <SAHealthBar value={HEALTH_PCT[c.health]} />
                  </td>
                  <td>
                    <SAStatusDot status={c.subStatus ?? c.status} />
                  </td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="row-btn imp" title="Impersonate" onClick={() => impersonate(c.id)}>
                        <ExternalLink size={15} />
                      </button>
                      <button type="button" className="row-btn" title="Mais">
                        <MoreVertical size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid-3">
        <section className="panel">
          <div className="panel__head">
            <div className="panel__title">Saúde do sistema</div>
            {health.data ? (
              <SASysBadge tone={health.data.overall === "HEALTHY" ? "ok" : health.data.overall === "WARNING" ? "warn" : "down"}>
                {health.data.overall === "HEALTHY" ? "Operacional" : health.data.overall === "WARNING" ? "Atenção" : "Degradado"}
              </SASysBadge>
            ) : null}
          </div>
          <div className="panel__body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { icon: <Server size={15} />, name: "API principal", tone: "ok" as const, label: "Operacional" },
              { icon: <Database size={15} />, name: "Banco de dados", tone: "ok" as const, label: "Operacional" },
              {
                icon: <MessageCircle size={15} />,
                name: "Evolution API",
                tone: (health.data && health.data.notifications.failRate > 5 ? "warn" : "ok") as "ok" | "warn",
                label: health.data && health.data.notifications.failRate > 5 ? "Degradado" : "Operacional"
              },
              {
                icon: <FileText size={15} />,
                name: "NFE.io",
                tone: (health.data && health.data.integrity.invoiceErrors7d > 10 ? "warn" : "ok") as "ok" | "warn",
                label: health.data && health.data.integrity.invoiceErrors7d > 10 ? "Erros" : "Operacional"
              },
              { icon: <Zap size={15} />, name: "Fila de jobs", tone: "ok" as const, label: "Operacional" },
              { icon: <Database size={15} />, name: "Storage", tone: "ok" as const, label: "Operacional" }
            ].map((s) => (
              <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="svc-card__name" style={{ flex: 1, fontSize: 13 }}>
                  {s.icon} {s.name}
                </span>
                <SASysBadge tone={s.tone}>{s.label}</SASysBadge>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel__head">
            <div className="panel__title">Novos cadastros</div>
            <div className="panel__sub">Recentes</div>
          </div>
          <div className="panel__body">
            {recentSignups.map((c) => (
              <div className="feed-item" key={c.id}>
                <span className={`feed-item__avt ${avatarClass(c.id)}`}>{initials(c.name)}</span>
                <div className="feed-item__info">
                  <div className="feed-item__name">{c.name}</div>
                  <div className="feed-item__meta">
                    <SAPlanTag plan={c.planSlug ?? c.plan} />
                  </div>
                </div>
                <span className="feed-item__time">{relativeTime(c.createdAt)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel__head">
            <div className="panel__title">Alertas</div>
          </div>
          <div className="panel__body">
            <div className="alert-card alert-card--danger">
              <AlertTriangle size={18} className="alert-card__icon" />
              <span className="alert-card__text">Empresas inadimplentes</span>
              <span className="alert-card__count">{m.pastDueCompanies}</span>
            </div>
            <div className="alert-card alert-card--warn">
              <MessageCircle size={18} className="alert-card__icon" />
              <span className="alert-card__text">Sem assinatura ativa</span>
              <span className="alert-card__count">{health.data?.integrity.companiesWithoutSubs ?? "—"}</span>
            </div>
            <div className="alert-card alert-card--warn">
              <FileText size={18} className="alert-card__icon" />
              <span className="alert-card__text">Notas com erro (7d)</span>
              <span className="alert-card__count">{health.data?.integrity.invoiceErrors7d ?? "—"}</span>
            </div>
            <div className="alert-card alert-card--warn">
              <UserPlus size={18} className="alert-card__icon" />
              <span className="alert-card__text">Trials expirando</span>
              <span className="alert-card__count">{m.trialCompanies30d}</span>
            </div>
          </div>
        </section>
      </div>

      {loading ? null : null}
    </>
  );
}
