"use client";
import { DollarSign, TrendingUp, Users, Percent, BarChart3, CreditCard } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { apiFetch } from "@/lib/client-api";

type AnyRecord = Record<string, any>;

function formatMoney(v?: string | number | null) {
  if (v === null || v === undefined || v === "") return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));
}

const paymentLabels: Record<string, string> = {
  PENDING: "Pendente", PAID: "Pago", PARTIALLY_PAID: "Parcial",
  CANCELLED: "Cancelado", REFUNDED: "Reembolsado"
};

const paymentColors: Record<string, string> = {
  PENDING: "warning", PAID: "success", PARTIALLY_PAID: "status-in-progress",
  CANCELLED: "danger", REFUNDED: "status-inactive"
};

export default function FinanceiroPage() {
  const [data, setData] = useState<AnyRecord | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<AnyRecord>("/api/financial")
      .then(setData)
      .catch(err => setError(err.message));
  }, []);

  if (error) {
    return (
      <>
        <PageHeader title="Financeiro" subtitle="Controle financeiro da empresa" />
        <div className="upgrade-banner">
          <div className="upgrade-banner__icon"><DollarSign size={24} /></div>
          <div className="upgrade-banner__text">
            <strong>Funcionalidade Premium</strong>
            <span>{error}</span>
          </div>
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <PageHeader title="Financeiro" subtitle="Controle financeiro da empresa" />
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><div className="loading-spinner" /></div>
      </>
    );
  }

  const maxRevenue = Math.max(
    ...(data.revenueByService ?? []).map((s: any) => Number(s.total)),
    1
  );

  return (
    <>
      <PageHeader title="Financeiro" subtitle="Controle financeiro da empresa" />

      {/* ─── Revenue Cards ────────────────────────────── */}
      <div className="grid cols-4" style={{ marginBottom: 24 }}>
        <div className="stat-card stat-card--success">
          <div className="stat-card__header"><div className="stat-card__label">Receita Hoje</div><div className="stat-card__icon"><DollarSign size={18} /></div></div>
          <div className="stat-card__value" style={{ fontSize: 22 }}>{formatMoney(data.summary.dayRevenue)}</div>
        </div>
        <div className="stat-card stat-card--success">
          <div className="stat-card__header"><div className="stat-card__label">Receita Semana</div><div className="stat-card__icon"><TrendingUp size={18} /></div></div>
          <div className="stat-card__value" style={{ fontSize: 22 }}>{formatMoney(data.summary.weekRevenue)}</div>
        </div>
        <div className="stat-card stat-card--info">
          <div className="stat-card__header"><div className="stat-card__label">Receita Mês</div><div className="stat-card__icon"><BarChart3 size={18} /></div></div>
          <div className="stat-card__value" style={{ fontSize: 22 }}>{formatMoney(data.summary.monthRevenue)}</div>
        </div>
        <div className="stat-card stat-card--warning">
          <div className="stat-card__header"><div className="stat-card__label">Descontos Total</div><div className="stat-card__icon"><Percent size={18} /></div></div>
          <div className="stat-card__value" style={{ fontSize: 22 }}>{formatMoney(data.summary.totalDiscounts)}</div>
        </div>
      </div>

      {/* ─── Charts ───────────────────────────────────── */}
      <div className="grid cols-2" style={{ marginBottom: 24 }}>
        <section className="panel">
          <h2 className="section-title">Receita por Serviço</h2>
          {(data.revenueByService ?? []).length === 0 ? (
            <div className="empty-state"><div className="empty-state__icon"><BarChart3 size={24} /></div><h3>Nenhum dado financeiro ainda</h3><p>Complete atendimentos para ver a receita por serviço.</p></div>
          ) : (
            <div className="hbar" style={{ marginTop: 16 }}>
              {(data.revenueByService ?? []).map((s: any) => (
                <div key={s.serviceId} className="hbar__item">
                  <span className="hbar__label">{s.serviceName}</span>
                  <div className="hbar__track">
                    <div className="hbar__fill" style={{ width: `${Math.max((Number(s.total) / maxRevenue) * 100, 8)}%` }}>{formatMoney(s.total)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <h2 className="section-title">Clientes que mais gastaram</h2>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table>
              <thead><tr><th>Cliente</th><th>Agendamentos</th><th>Total</th></tr></thead>
              <tbody>
                {(data.topCustomers ?? []).map((c: any) => (
                  <tr key={c.customerId}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div className="avatar avatar--sm">{c.customerName?.[0] ?? "?"}</div>
                        <strong>{c.customerName}</strong>
                      </div>
                    </td>
                    <td>{c.appointmentCount}</td>
                    <td><span style={{ color: "var(--primary)", fontWeight: 700 }}>{formatMoney(c.totalSpent)}</span></td>
                  </tr>
                ))}
                {(data.topCustomers ?? []).length === 0 && <tr><td colSpan={3} className="empty">Nenhum dado.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* ─── Payment Distribution ─────────────────────── */}
      <div className="section-divider"><h2>Status de Pagamento</h2></div>
      <div className="grid cols-4" style={{ marginTop: 12 }}>
        {(data.paymentDistribution ?? []).map((p: any) => (
          <div key={p.paymentStatus} className="stat-card">
            <div className="stat-card__header">
              <div className="stat-card__label">{paymentLabels[p.paymentStatus] ?? p.paymentStatus}</div>
              <div className="stat-card__icon"><CreditCard size={18} /></div>
            </div>
            <div className="stat-card__value">{p._count.id}</div>
          </div>
        ))}
      </div>
    </>
  );
}
