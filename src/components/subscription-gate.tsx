"use client";

import { AlertTriangle, Check, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { CheckoutModal } from "@/components/checkout-modal";

export type SubscriptionState = {
  status: string;
  planSlug: string | null;
  planName: string | null;
  isTrial: boolean;
  trialEndsAt: string | null;
  trialDaysLeft: number;
  isBlocked: boolean;
};

type PublicPlan = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: string | number;
  maxUsers: number;
  maxProfessionals: number;
  maxCustomers: number;
  maxAppointmentsPerMonth: number;
  allowClientSelfScheduling: boolean;
  allowAdvancedReports: boolean;
  allowBotIntegration: boolean;
};

function formatPrice(price: string | number): string {
  const value = typeof price === "string" ? Number(price) : price;
  if (!Number.isFinite(value) || value <= 0) return "Grátis";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Banner persistente durante o trial (não bloqueado). */
export function TrialBanner({ daysLeft }: { daysLeft: number }) {
  const lastDay = daysLeft <= 0;
  return (
    <div className={`trial-banner ${lastDay ? "trial-banner--urgent" : ""}`} role="status">
      <Clock size={16} />
      <span>
        {lastDay
          ? "Seu teste grátis acaba hoje. Assine um plano para não perder o acesso."
          : `Faltam ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"} do seu teste grátis.`}
      </span>
    </div>
  );
}

/**
 * Modal NÃO dispensável exibido quando o trial expira. Não fecha por clique fora
 * nem tem botão de fechar — a única saída é assinar um plano.
 */
export function TrialExpiredModal() {
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkout, setCheckout] = useState<{ slug: string; name: string; amount: number } | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/subscription/plans")
      .then((r) => (r.ok ? r.json() : { plans: [] }))
      .then((data) => {
        if (active) setPlans(data.plans ?? []);
      })
      .catch(() => {
        if (active) setPlans([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function handleSubscribe(plan: PublicPlan) {
    setCheckout({ slug: plan.slug, name: plan.name, amount: Number(plan.price) });
  }

  if (checkout) {
    return (
      <CheckoutModal
        planSlug={checkout.slug}
        planName={checkout.name}
        amount={checkout.amount}
        onClose={() => setCheckout(null)}
        onSuccess={() => window.location.reload()}
      />
    );
  }

  return (
    <div className="trial-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="trial-modal-title">
      <div className="trial-modal">
        <div className="trial-modal-header">
          <AlertTriangle size={28} className="trial-modal-icon" />
          <h2 id="trial-modal-title">Seu teste grátis terminou</h2>
          <p>Escolha um plano para continuar usando o MarcaiFlex. Seus dados estão salvos.</p>
        </div>

        {loading ? (
          <div className="trial-modal-loading">
            <div className="loading-spinner" />
          </div>
        ) : (
          <div className="trial-plan-grid">
            {plans.map((plan) => (
              <div className="trial-plan-card" key={plan.id}>
                <div className="trial-plan-name">{plan.name}</div>
                <div className="trial-plan-price">
                  {formatPrice(plan.price)}
                  {formatPrice(plan.price) !== "Grátis" && <span>/mês</span>}
                </div>
                {plan.description && <p className="trial-plan-desc">{plan.description}</p>}
                <ul className="trial-plan-features">
                  <li>
                    <Check size={14} /> {plan.maxProfessionals} profissionais
                  </li>
                  <li>
                    <Check size={14} /> {plan.maxAppointmentsPerMonth.toLocaleString("pt-BR")} agendamentos/mês
                  </li>
                  {plan.allowClientSelfScheduling && (
                    <li>
                      <Check size={14} /> Agendamento online
                    </li>
                  )}
                  {plan.allowBotIntegration && (
                    <li>
                      <Check size={14} /> Bot WhatsApp
                    </li>
                  )}
                  {plan.allowAdvancedReports && (
                    <li>
                      <Check size={14} /> Relatórios avançados
                    </li>
                  )}
                </ul>
                <button className="button primary" onClick={() => handleSubscribe(plan)} type="button">
                  Assinar {plan.name}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
