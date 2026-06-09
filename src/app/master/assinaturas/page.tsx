"use client";

import { CreditCard, DollarSign, TrendingUp, Users } from "lucide-react";
import { useMemo } from "react";
import {
  SAError,
  SAKpiCard,
  SALoading,
  SAPageHeader,
  SAStatusDot,
  brl,
  formatDate,
  num
} from "@/components/master/sa-bits";
import { SABarChart, SAWaterfall, type WaterfallRow } from "@/components/master/sa-charts";
import { useSAData } from "@/components/master/use-sa-data";

type PlanMix = { planId: string; planName: string; planSlug: string; count: number; mrr: number };
type PaymentEvent = {
  id: string;
  type: string;
  status: string;
  processedAt: string | null;
  companyName: string;
  planName: string;
  amount: number;
};
type SubsResponse = {
  metrics: {
    mrr: number;
    prevMrr: number;
    mrrDelta: number;
    arr: number;
    activeSubs: number;
    trialingSubs: number;
    pastDueCount: number;
    cancelledLast30: number;
    newSubsThisMonth: number;
    conversionRate: number;
  };
  mrrByMonth: { month: string; mrr: number; newSubs: number }[];
  planMix: PlanMix[];
  paymentEvents: PaymentEvent[];
};

const PLAN_COLORS: Record<string, string> = {
  pro: "#8b5cf6",
  max: "#fbbf24",
  starter: "#2dd4bf",
  trial: "#38bdf8",
  free: "#64748b"
};

function monthShort(iso: string) {
  const [, m] = iso.split("-");
  return ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][Number(m) - 1] ?? m;
}

export default function AssinaturasPage() {
  const { data, error } = useSAData<SubsResponse>("/api/master/subscriptions");

  const bars = useMemo(() => {
    if (!data) return [];
    return data.mrrByMonth.map((row) => ({
      label: monthShort(row.month),
      segments: [{ value: row.mrr, color: "#8b5cf6" }]
    }));
  }, [data]);

  const waterfall = useMemo<WaterfallRow[]>(() => {
    if (!data) return [];
    const { prevMrr, mrr, newSubsThisMonth } = data.metrics;
    const net = mrr - prevMrr;
    return [
      { label: "Base inicial", value: prevMrr, kind: "base" },
      { label: `Novo MRR (${newSubsThisMonth})`, value: Math.max(net, 0), kind: "pos" },
      { label: "Variação líquida", value: Math.abs(net), kind: net >= 0 ? "pos" : "neg" },
      { label: "MRR final", value: mrr, kind: "total" }
    ];
  }, [data]);

  const planTotal = useMemo(() => (data ? data.planMix.reduce((a, p) => a + p.mrr, 0) || 1 : 1), [data]);

  if (!data) {
    return (
      <>
        <SAPageHeader title="Assinaturas & MRR" sub="Receita recorrente e cobranças" />
        {error ? <SAError>{error}</SAError> : <SALoading />}
      </>
    );
  }

  const m = data.metrics;
  const arpa = m.activeSubs > 0 ? m.mrr / m.activeSubs : 0;

  return (
    <>
      <SAPageHeader title="Assinaturas & MRR" sub="Receita recorrente e cobranças" />
      {error ? <SAError>{error}</SAError> : null}

      <div className="kpi-grid">
        <SAKpiCard
          label="MRR"
          value={brl(m.mrr)}
          icon={<DollarSign size={18} />}
          delta={`${m.mrrDelta >= 0 ? "+" : ""}${m.mrrDelta}%`}
          deltaDown={m.mrrDelta < 0}
          foot={`ARR ${brl(m.arr, { compact: true })}`}
        />
        <SAKpiCard label="ARPA" value={brl(arpa)} variant="teal" icon={<Users size={18} />} foot={`${num(m.activeSubs)} assinantes ativos`} />
        <SAKpiCard label="Conversão trial" value={`${m.conversionRate}%`} variant="sky" icon={<TrendingUp size={18} />} foot={`${num(m.trialingSubs)} em trial`} />
        <SAKpiCard label="Inadimplência" value={num(m.pastDueCount)} variant="rose" icon={<CreditCard size={18} />} foot={`${num(m.cancelledLast30)} canceladas (30d)`} />
      </div>

      <div className="grid-2">
        <section className="panel">
          <div className="panel__head">
            <div className="panel__title">MRR por mês</div>
            <div className="panel__sub">12 meses</div>
          </div>
          <div className="panel__body">
            {bars.length > 0 ? <SABarChart data={bars} /> : <SALoading />}
          </div>
        </section>

        <section className="panel">
          <div className="panel__head">
            <div className="panel__title">Movimentação do mês</div>
          </div>
          <div className="panel__body">
            <SAWaterfall rows={waterfall} />
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel__head">
          <div className="panel__title">Receita por plano</div>
        </div>
        <div className="panel__body">
          {data.planMix.map((p) => (
            <div key={p.planId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ width: 110, fontSize: 13, fontWeight: 600 }}>{p.planName}</span>
              <div className="waterfall__bar" style={{ flex: 1 }}>
                <div style={{ width: `${(p.mrr / planTotal) * 100}%`, background: PLAN_COLORS[p.planSlug] ?? "#64748b", height: "100%" }} />
              </div>
              <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)", minWidth: 56, textAlign: "right" }}>
                {Math.round((p.mrr / planTotal) * 100)}%
              </span>
              <span className="money" style={{ minWidth: 90, textAlign: "right" }}>{brl(p.mrr)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">
          <div className="panel__title">Cobranças recentes</div>
        </div>
        <div className="panel__body panel__body--flush">
          <table className="tbl">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Plano</th>
                <th>Tipo</th>
                <th>Valor</th>
                <th>Data</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.paymentEvents.map((e) => {
                const paid = e.status === "PAID" || e.status === "SUCCEEDED" || e.status === "APPROVED";
                return (
                  <tr key={e.id}>
                    <td style={{ fontWeight: 600 }}>{e.companyName}</td>
                    <td style={{ color: "var(--text-secondary)", fontSize: 12.5 }}>{e.planName}</td>
                    <td style={{ color: "var(--muted)", fontSize: 12 }}>{e.type}</td>
                    <td className="money">{brl(e.amount)}</td>
                    <td className="num" style={{ color: "var(--muted)" }}>{formatDate(e.processedAt)}</td>
                    <td>
                      <SAStatusDot status={paid ? "ACTIVE" : "PAST_DUE"} label={paid ? "Pago" : "Falhou"} />
                    </td>
                  </tr>
                );
              })}
              {data.paymentEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ color: "var(--muted)", textAlign: "center", padding: 28 }}>
                    Sem cobranças registradas.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
