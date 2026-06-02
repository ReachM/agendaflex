"use client";

import Link from "next/link";

/** CTA final full-bleed (fundo dark + blobs via ::before). */
export function FinalCTA() {
  return (
    <section className="lp-final">
      <div className="lp-container">
        <div className="lp-final__card lp-reveal">
          <h2>
            Pronto pra parar de <span className="lp-final__hl">perder horário</span>?
          </h2>
          <p>
            Crie sua conta em minutos e comece o teste grátis de 7 dias hoje mesmo. Sem cartão, sem
            amarra, sem complicação.
          </p>
          <div className="lp-final__actions">
            <Link href="/register" className="lp-btn lp-btn--amber lp-btn--lg">
              Começar agora →
            </Link>
            <a href="#planos" className="lp-btn lp-btn--on-dark lp-btn--lg">
              Ver planos
            </a>
          </div>
          <p className="lp-final__note">7 dias grátis · Sem cartão de crédito · Cancele quando quiser</p>
        </div>
      </div>
    </section>
  );
}
