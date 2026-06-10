"use client";

/** Depoimento em destaque (card dark). */
export function Testimonial() {
  return (
    <section className="lp-section">
      <div className="lp-container">
        <figure className="lp-testi lp-reveal">
          <div className="lp-testi__photo" aria-hidden="true">
            <span className="lp-testi__badge">⭐ Cliente desde 2024</span>
          </div>
          <div className="lp-testi__content">
            <blockquote className="lp-testi__quote">
              Acabou o caderno e o caos no WhatsApp. O bot confirma sozinho — eu só apareço pra
              atender. Faturei 30% mais no primeiro mês só por parar de perder horário.
            </blockquote>
            <figcaption className="lp-testi__author">
              <div className="lp-testi__av">JM</div>
              <div>
                <strong>Júlia Moraes</strong>
                <span>Studio JM · Curitiba/PR · 4 profissionais</span>
              </div>
            </figcaption>
          </div>
        </figure>
      </div>
    </section>
  );
}
