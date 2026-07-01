"use client";

import { CheckCircle2, RefreshCcw, RotateCcw, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import {
  SABiz,
  SAEmpty,
  SAError,
  SALoading,
  SAMiniKpi,
  SAPageHeader,
  SASysBadge,
  brl,
  formatDate,
  num
} from "@/components/master/sa-bits";
import { useSAData } from "@/components/master/use-sa-data";
import { apiFetch } from "@/lib/client-api";

type Commission = {
  id: string;
  referenceMonth: string;
  subscriptionPaymentAmount: number;
  appliedCommissionPct: number;
  commissionAmount: number;
  status: string;
  paidAt: string | null;
  createdAt: string;
  influencerId: string;
  influencerName: string;
  influencerPixKey: string | null;
  companyId: string;
  companyName: string;
};
type Response = {
  metrics: { pendingTotal: number; pendingCount: number; paidTotal: number; paidCount: number };
  commissions: Commission[];
};
type InfluencersResponse = { influencers: { id: string; name: string }[] };

type StatusFilter = "all" | "pending" | "paid";

export default function ComissoesPage() {
  const [month, setMonth] = useState("");
  const [influencerId, setInfluencerId] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (month) p.set("month", month);
    if (influencerId) p.set("influencerId", influencerId);
    if (status !== "all") p.set("status", status);
    const s = p.toString();
    return s ? `?${s}` : "";
  }, [month, influencerId, status]);

  const { data, error, loading, reload } = useSAData<Response>(`/api/master/commissions${query}`);
  const { data: infData } = useSAData<InfluencersResponse>("/api/master/influencers");
  const influencers = infData?.influencers ?? [];

  async function togglePaid(c: Commission) {
    const paying = c.status !== "paid";
    setBusyId(c.id);
    try {
      await apiFetch(`/api/master/commissions/${c.id}/mark-paid`, {
        method: "PATCH",
        body: JSON.stringify(paying ? {} : { action: "unpay" })
      });
      void reload();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  if (!data) {
    return (
      <>
        <SAPageHeader title="Comissões" sub="Repasses aos influenciadores" />
        {error ? <SAError>{error}</SAError> : <SALoading />}
      </>
    );
  }

  const m = data.metrics;

  return (
    <>
      <SAPageHeader
        title="Comissões"
        sub={`${num(m.pendingCount + m.paidCount)} registros`}
        actions={
          <button type="button" className="btn btn-ghost" onClick={reload} disabled={loading}>
            <RefreshCcw size={15} /> Atualizar
          </button>
        }
      />
      {error ? <SAError>{error}</SAError> : null}

      <div className="mini-kpis">
        <SAMiniKpi value={brl(m.pendingTotal)} label={`pendente (${num(m.pendingCount)})`} icon={<Wallet size={18} />} variant="amber" />
        <SAMiniKpi value={brl(m.paidTotal)} label={`pago (${num(m.paidCount)})`} icon={<CheckCircle2 size={18} />} variant="teal" />
      </div>

      <section className="panel">
        <div className="tbl-filter" style={{ gap: 10, flexWrap: "wrap" }}>
          <input
            type="month"
            className="input"
            style={{ maxWidth: 170 }}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
          <select className="input" style={{ maxWidth: 220 }} value={influencerId} onChange={(e) => setInfluencerId(e.target.value)}>
            <option value="">Todos os influenciadores</option>
            {influencers.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
          {(["all", "pending", "paid"] as StatusFilter[]).map((s) => (
            <button key={s} type="button" className={`chip-tab ${status === s ? "is-on" : ""}`} onClick={() => setStatus(s)}>
              {s === "all" ? "Todas" : s === "pending" ? "Pendentes" : "Pagas"}
            </button>
          ))}
        </div>

        <div className="panel__body panel__body--flush">
          {data.commissions.length === 0 ? (
            <SAEmpty icon={<Wallet size={24} />} title="Nenhuma comissão" message="Ajuste os filtros ou aguarde os pagamentos." />
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Influenciador</th>
                  <th>Cliente</th>
                  <th>Mês</th>
                  <th>Pagamento</th>
                  <th>%</th>
                  <th>Comissão</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.commissions.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <SABiz name={c.influencerName} sub={c.influencerPixKey ?? "sem PIX"} seed={c.influencerId} />
                    </td>
                    <td style={{ fontSize: 12.5 }}>{c.companyName}</td>
                    <td>{c.referenceMonth}</td>
                    <td>{brl(c.subscriptionPaymentAmount)}</td>
                    <td>{c.appliedCommissionPct}%</td>
                    <td style={{ fontWeight: 700 }}>{brl(c.commissionAmount)}</td>
                    <td>
                      <SASysBadge tone={c.status === "paid" ? "ok" : "warn"}>
                        {c.status === "paid" ? `PAGO ${formatDate(c.paidAt)}` : "PENDENTE"}
                      </SASysBadge>
                    </td>
                    <td>
                      {c.status === "paid" ? (
                        <button type="button" className="btn btn-ghost btn-sm" disabled={busyId === c.id} onClick={() => togglePaid(c)}>
                          <RotateCcw size={13} /> Desfazer
                        </button>
                      ) : (
                        <button type="button" className="btn btn-primary btn-sm" disabled={busyId === c.id} onClick={() => togglePaid(c)}>
                          <CheckCircle2 size={13} /> Marcar pago
                        </button>
                      )}
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
