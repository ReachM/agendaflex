"use client";

import { AlertTriangle, Check, Clock, Rocket, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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

/** Forma do /api/plans/public — features já vêm prontas como string[]. */
type PublicPlanLite = {
  name: string;
  slug: string;
  description: string | null;
  price: number;
  features: string[];
};

function formatPrice(price: string | number): string {
  const value = typeof price === "string" ? Number(price) : price;
  if (!Number.isFinite(value) || value <= 0) return "Grátis";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Modal de upgrade DISPENSÁVEL, exibido durante o trial (cliente NÃO bloqueado).
 * Fecha pelo X, clique fora ou Esc — o cliente pode continuar usando no trial.
 * Consome /api/plans/public e abre o checkout do MP no plano escolhido. O trial
 * segue como fallback até o webhook confirmar o pagamento.
 */
function UpgradeModal({ onClose }: { onClose: () => void }) {
  const [plans, setPlans] = useState<PublicPlanLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkout, setCheckout] = useState<{ slug: string; name: string; amount: number } | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/plans/public")
      .then((r) => (r.ok ? r.json() : { plans: [] }))
      .then((data) => {
        if (active) setPlans((data.plans ?? []).filter((p: PublicPlanLite) => Number(p.price) > 0));
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

  // Esc fecha o modal (não bloqueante).
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
    <div
      className="trial-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
      onClick={onClose}
    >
      <div className="trial-modal" onClick={(e) => e.stopPropagation()}>
        <button className="trial-modal__close" type="button" aria-label="Fechar" onClick={onClose}>
          <X size={20} />
        </button>
        <div className="trial-modal-header">
          <Rocket size={28} className="trial-modal-icon trial-modal-icon--primary" />
          <h2 id="upgrade-modal-title">Fazer upgrade do seu plano</h2>
          <p>
            Garanta seu acesso depois do teste. Você continua no trial normalmente até a confirmação do
            pagamento.
          </p>
        </div>

        {loading ? (
          <div className="trial-modal-loading">
            <div className="loading-spinner" />
          </div>
        ) : (
          <div className="trial-plan-grid">
            {plans.map((plan) => (
              <div className="trial-plan-card" key={plan.slug}>
                <div className="trial-plan-name">{plan.name}</div>
                <div className="trial-plan-price">
                  {formatPrice(plan.price)}
                  {formatPrice(plan.price) !== "Grátis" && <span>/mês</span>}
                </div>
                {plan.description && <p className="trial-plan-desc">{plan.description}</p>}
                <ul className="trial-plan-features">
                  {plan.features.map((f) => (
                    <li key={f}>
                      <Check size={14} /> {f}
                    </li>
                  ))}
                </ul>
                <button
                  className="button primary"
                  type="button"
                  onClick={() => setCheckout({ slug: plan.slug, name: plan.name, amount: Number(plan.price) })}
                >
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

/** Banner persistente durante o trial (não bloqueado), com CTA de upgrade. */
export function TrialBanner({ daysLeft }: { daysLeft: number }) {
  const [showUpgrade, setShowUpgrade] = useState(false);
  const lastDay = daysLeft <= 0;
  const close = useCallback(() => setShowUpgrade(false), []);
  return (
    <>
      <div className={`trial-banner ${lastDay ? "trial-banner--urgent" : ""}`} role="status">
        <Clock size={16} />
        <span>
          {lastDay
            ? "Seu teste grátis acaba hoje. Assine um plano para não perder o acesso."
            : `Faltam ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"} do seu teste grátis.`}
        </span>
        <button className="trial-banner__cta" type="button" onClick={() => setShowUpgrade(true)}>
          Fazer upgrade
        </button>
      </div>
      {showUpgrade && <UpgradeModal onClose={close} />}
    </>
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
