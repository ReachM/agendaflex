"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useReveal } from "../hooks";

type PublicPlan = {
  name: string;
  slug: string;
  description: string | null;
  price: number;
  features: string[];
};

/** Valor inteiro em pt-BR (49, 89, 149). Preço <= 0 é tratado como "Grátis". */
function priceValue(price: number): string | null {
  if (!Number.isFinite(price) || price <= 0) return null;
  return Math.round(price).toLocaleString("pt-BR");
}

/** Planos dinâmicos vindos de /api/plans/public. NUNCA hardcode. */
export function Pricing() {
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  // Re-roda os reveals quando os cards assíncronos entram no DOM.
  useReveal([status, plans.length]);

  useEffect(() => {
    let active = true;
    fetch("/api/plans/public")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("fail"))))
      .then((data) => {
        if (!active) return;
        const list: PublicPlan[] = data.plans ?? [];
        setPlans(list);
        setStatus(list.length ? "ok" : "error");
      })
      .catch(() => active && setStatus("error"));
    return () => {
      active = false;
    };
  }, []);

  // Plano do meio em destaque (quando há 3); senão o último.
  const featuredIndex = plans.length >= 3 ? 1 : plans.length - 1;

  return (
    <section id="planos" className="lp-section">
      <div className="lp-container">
        <div className="lp-section__head lp-reveal">
          <span className="lp-eyebrow">Planos</span>
          <h2>Comece grátis, evolua quando precisar</h2>
          <p>
            7 dias com <strong>todos os recursos liberados</strong>. Sem cartão de crédito. Cancele a
            qualquer momento.
          </p>
        </div>

        {status === "loading" && (
          <div className="lp-plans__loading">
            <div className="loading-spinner" />
          </div>
        )}

        {status === "ok" && (
          <div className="lp-plan-grid">
            {plans.map((plan, index) => {
              const featured = index === featuredIndex;
              const value = priceValue(plan.price);
              return (
                <div className={`lp-plan ${featured ? "lp-plan--featured" : ""} lp-reveal`} key={plan.slug}>
                  {featured && <span className="lp-plan__ribbon">Mais popular</span>}
                  <span className="lp-plan__name">{plan.name}</span>
                  <div className="lp-plan__price">
                    {value ? (
                      <>
                        <span className="lp-plan__currency">R$</span>
                        <strong>{value}</strong>
                        <span className="lp-plan__per">/mês</span>
                      </>
                    ) : (
                      <strong>Grátis</strong>
                    )}
                  </div>
                  {plan.description && <p className="lp-plan__desc">{plan.description}</p>}
                  <ul className="lp-plan__features">
                    {plan.features.map((f) => (
                      <li key={f}>
                        <span className="lp-ck">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/cadastro"
                    className={`lp-btn ${featured ? "lp-btn--primary" : "lp-btn--outline"} lp-btn--block`}
                  >
                    Começar grátis
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        {status === "error" && (
          <div className="lp-plans__fallback lp-reveal">
            <p>Veja todos os planos e comece seu teste grátis de 7 dias em poucos minutos.</p>
            <Link href="/cadastro" className="lp-btn lp-btn--primary">
              Ver planos e começar <ArrowRight size={18} />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
