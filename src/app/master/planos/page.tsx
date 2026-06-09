"use client";

import { Check, FileText, MessageCircle, Pencil, Sparkles, Tag, Users, X } from "lucide-react";
import { useState } from "react";
import { SAError, SALoading, SAPageHeader, SASwitch, SASysBadge, brl, num } from "@/components/master/sa-bits";
import { useSAData } from "@/components/master/use-sa-data";

type Plan = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number | string;
  maxUsers: number;
  maxProfessionals: number;
  allowClientSelfScheduling: boolean;
  allowAdvancedReports: boolean;
  allowFinancialControl: boolean;
  allowInvoiceRequest: boolean;
  allowCustomerChecklist: boolean;
  allowCustomFields: boolean;
  _count: { subscriptions: number };
};
type PlansResponse = { plans: Plan[] };

const PLAN_COLOR: Record<string, string> = { max: "var(--amber)", pro: "var(--violet)", starter: "var(--teal)" };

function featureList(p: Plan): { label: string; on: boolean }[] {
  return [
    { label: `${p.maxUsers} usuários`, on: true },
    { label: `${p.maxProfessionals} profissionais`, on: true },
    { label: "Agendamento online", on: p.allowClientSelfScheduling },
    { label: "Relatórios avançados", on: p.allowAdvancedReports },
    { label: "Controle financeiro", on: p.allowFinancialControl },
    { label: "Emissão de NFS-e", on: p.allowInvoiceRequest },
    { label: "Campos personalizados", on: p.allowCustomFields }
  ];
}

const ADDONS = [
  { id: "wa-extra", icon: <MessageCircle size={18} />, name: "Instância WhatsApp extra", desc: "Número adicional na Evolution API", price: "R$ 49 / mês" },
  { id: "nfe-pack", icon: <FileText size={18} />, name: "Pacote de NFS-e", desc: "1.000 emissões adicionais", price: "R$ 79 / pacote" },
  { id: "seats", icon: <Users size={18} />, name: "Usuários extras", desc: "5 assentos adicionais", price: "R$ 29 / mês" }
];

const COUPONS = [
  { code: "BEMVINDO20", discount: "20%", usage: "142 usos", active: true },
  { code: "ANUAL2META", discount: "2 meses", usage: "38 usos", active: true },
  { code: "BLACKFRIDAY", discount: "40%", usage: "0 usos", active: false }
];

export default function PlanosPage() {
  const { data, error } = useSAData<PlansResponse>("/api/plans");
  const [addonState, setAddonState] = useState<Record<string, boolean>>({ "wa-extra": true, "nfe-pack": true, seats: false });

  if (!data) {
    return (
      <>
        <SAPageHeader title="Planos & preços" sub="Planos, complementos e cupons" />
        {error ? <SAError>{error}</SAError> : <SALoading />}
      </>
    );
  }

  const visible = data.plans.filter((p) => p.slug !== "free").slice(0, 3);
  const totalSubs = data.plans.reduce((a, p) => a + p._count.subscriptions, 0) || 1;

  return (
    <>
      <SAPageHeader title="Planos & preços" sub="Planos, complementos e cupons" />
      {error ? <SAError>{error}</SAError> : null}

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${visible.length}, 1fr)`, gap: 16, marginBottom: 20 }}>
        {visible.map((p) => {
          const featured = p.slug === "pro";
          const price = Number(p.price);
          const subs = p._count.subscriptions;
          return (
            <div key={p.id} className={`plan-card ${featured ? "plan-card--featured" : ""}`} style={{ position: "relative" }}>
              {featured ? <span className="plan-card__badge">Mais popular</span> : null}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Tag size={16} style={{ color: PLAN_COLOR[p.slug] ?? "var(--violet)" }} />
                <span style={{ fontSize: 16, fontWeight: 800 }}>{p.name}</span>
              </div>
              <div className="plan-card__price" style={{ marginTop: 12 }}>
                {brl(price)} <span className="period">/ mês</span>
              </div>
              <ul className="plan-card__features">
                {featureList(p).map((f, i) => (
                  <li key={i} className={f.on ? "feat-on" : "feat-off"}>
                    {f.on ? <Check size={15} /> : <X size={15} />} {f.label}
                  </li>
                ))}
              </ul>
              <div className="plan-card__stats">
                <span>
                  <strong style={{ color: "var(--text)" }}>{num(subs)}</strong> assinantes
                </span>
                <span>
                  MRR <strong style={{ color: "var(--text)" }}>{brl(price * subs, { compact: true })}</strong>
                </span>
                <span>{Math.round((subs / totalSubs) * 100)}% da base</span>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 14 }}>
                <Pencil size={13} /> Editar
              </button>
            </div>
          );
        })}
      </div>

      <div className="grid-2">
        <section className="panel">
          <div className="panel__head">
            <div className="panel__title">Complementos</div>
            <div className="panel__sub">Add-ons disponíveis</div>
          </div>
          <div className="panel__body panel__body--flush">
            {ADDONS.map((a) => (
              <div className="addon-row" key={a.id}>
                <span className="addon-row__icon">{a.icon}</span>
                <div className="addon-row__info">
                  <div className="addon-row__name">{a.name}</div>
                  <div className="addon-row__desc">{a.desc}</div>
                </div>
                <span className="addon-row__price">{a.price}</span>
                <SASwitch checked={addonState[a.id] ?? false} onChange={(v) => setAddonState((s) => ({ ...s, [a.id]: v }))} />
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel__head">
            <div className="panel__title">Cupons</div>
            <div className="panel__sub"><Sparkles size={12} /> Descontos ativos</div>
          </div>
          <div className="panel__body panel__body--flush">
            {COUPONS.map((c) => (
              <div className="coupon-row" key={c.code}>
                <span className="coupon-row__code">{c.code}</span>
                <div className="coupon-row__info">
                  <div className="coupon-row__discount">{c.discount}</div>
                  <div className="coupon-row__usage">{c.usage}</div>
                </div>
                <SASysBadge tone={c.active ? "ok" : "down"}>{c.active ? "ATIVO" : "INATIVO"}</SASysBadge>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
