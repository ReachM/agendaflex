"use client";

import { ArrowLeft, Percent, Ticket, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { use } from "react";
import {
  SAError,
  SALoading,
  SAMiniKpi,
  SAPageHeader,
  SAStatusDot,
  SASysBadge,
  brl,
  formatDate,
  num
} from "@/components/master/sa-bits";
import { useSAData } from "@/components/master/use-sa-data";

type Coupon = {
  id: string;
  code: string;
  discountPct: number | null;
  active: boolean;
  createdAt: string;
  redemptionsCount: number;
};
type Commission = {
  id: string;
  referenceMonth: string;
  subscriptionPaymentAmount: number;
  appliedCommissionPct: number;
  commissionAmount: number;
  status: string;
  paidAt: string | null;
  createdAt: string;
  companyId: string;
  companyName: string;
};
type Response = {
  influencer: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    pixKey: string | null;
    active: boolean;
    notes: string | null;
    createdAt: string;
    coupons: Coupon[];
  };
  tier: { subscribersCount: number; commissionPct: number };
  commissions: Commission[];
};

export default function InfluencerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error } = useSAData<Response>(`/api/master/influencers/${id}`);

  if (!data) {
    return (
      <>
        <SAPageHeader title="Influenciador" />
        {error ? <SAError>{error}</SAError> : <SALoading />}
      </>
    );
  }

  const inf = data.influencer;
  const pending = data.commissions.filter((c) => c.status === "pending").reduce((a, c) => a + c.commissionAmount, 0);

  return (
    <>
      <SAPageHeader
        title={inf.name}
        sub={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <SAStatusDot status={inf.active ? "ACTIVE" : "INACTIVE"} label={inf.active ? "Ativo" : "Inativo"} />
            {inf.email ?? inf.phone ?? "—"}
          </span>
        }
        actions={
          <Link href="/master/influencers" className="btn btn-ghost">
            <ArrowLeft size={15} /> Voltar
          </Link>
        }
      />
      {error ? <SAError>{error}</SAError> : null}

      <div className="mini-kpis">
        <SAMiniKpi value={num(data.tier.subscribersCount)} label="assinantes ativos" icon={<Users size={18} />} variant="teal" />
        <SAMiniKpi value={`${data.tier.commissionPct}%`} label="faixa de comissão atual" icon={<Percent size={18} />} variant="sky" />
        <SAMiniKpi value={num(inf.coupons.length)} label="cupons" icon={<Ticket size={18} />} />
        <SAMiniKpi value={brl(pending)} label="comissão pendente" icon={<Wallet size={18} />} variant="amber" />
      </div>

      {inf.pixKey ? (
        <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
          Chave PIX para repasse: <strong style={{ color: "var(--text)", fontFamily: "var(--mono)" }}>{inf.pixKey}</strong>
        </p>
      ) : null}

      <div className="grid-2">
        <section className="panel">
          <div className="panel__head">
            <div className="panel__title">Cupons</div>
          </div>
          <div className="panel__body panel__body--flush">
            {inf.coupons.length === 0 ? (
              <p style={{ padding: 16, color: "var(--muted)", fontSize: 13 }}>Nenhum cupom cadastrado.</p>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Desconto</th>
                    <th>Usos</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {inf.coupons.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontFamily: "var(--mono)", fontWeight: 700 }}>{c.code}</td>
                      <td>{c.discountPct != null ? `${c.discountPct}%` : "—"}</td>
                      <td>{num(c.redemptionsCount)}</td>
                      <td>
                        <SASysBadge tone={c.active ? "ok" : "down"}>{c.active ? "ATIVO" : "INATIVO"}</SASysBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel__head">
            <div className="panel__title">Histórico de comissões</div>
          </div>
          <div className="panel__body panel__body--flush">
            {data.commissions.length === 0 ? (
              <p style={{ padding: 16, color: "var(--muted)", fontSize: 13 }}>Nenhuma comissão registrada ainda.</p>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Mês</th>
                    <th>Cliente</th>
                    <th>%</th>
                    <th>Comissão</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.commissions.map((c) => (
                    <tr key={c.id}>
                      <td>{c.referenceMonth}</td>
                      <td style={{ fontSize: 12.5 }}>{c.companyName}</td>
                      <td>{c.appliedCommissionPct}%</td>
                      <td>{brl(c.commissionAmount)}</td>
                      <td>
                        <SASysBadge tone={c.status === "paid" ? "ok" : "warn"}>
                          {c.status === "paid" ? `PAGO ${formatDate(c.paidAt)}` : "PENDENTE"}
                        </SASysBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
