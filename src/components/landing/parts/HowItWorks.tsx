"use client";

const STEPS: { title: string; desc: string; amber?: boolean }[] = [
  {
    title: "Cliente manda zap",
    desc: "Sem app, sem cadastro, sem fricção. Ele conversa com o bot do jeito que já está acostumado."
  },
  {
    title: "Bot oferece horários",
    desc: "Mostra só os disponíveis no seu calendário, na hora certa, com o profissional certo."
  },
  {
    title: "Você atende",
    desc: "A confirmação já entrou na agenda. Lembrete automático sai 24h e 2h antes do horário.",
    amber: true
  }
];

/** "Como funciona" — 3 passos numerados. */
export function HowItWorks() {
  return (
    <section id="como-funciona" className="lp-section">
      <div className="lp-container">
        <div className="lp-section__head lp-reveal">
          <span className="lp-eyebrow">Como funciona</span>
          <h2>
            O bot faz tudo. <span className="lp-i">Você só atende</span>.
          </h2>
          <p>Do primeiro &quot;oi&quot; do cliente até a confirmação na sua agenda — sem você precisar abrir o app.</p>
        </div>

        <div className="lp-step-grid">
          {STEPS.map((step, i) => (
            <article className="lp-step lp-reveal" key={step.title}>
              <div className={`lp-step__num ${step.amber ? "lp-step__num--amber" : ""}`}>{i + 1}</div>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
