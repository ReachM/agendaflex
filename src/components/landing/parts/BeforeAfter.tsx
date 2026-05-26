"use client";

const BEFORE = [
  "Cliente marca às 23h — você só vê na segunda",
  "Dupla marcação toda semana",
  "Faltas que ninguém viu chegando",
  "Nada de relatório, nada de visão",
  "Você nunca desliga o WhatsApp"
];

const AFTER = [
  "Bot atende e confirma a qualquer hora",
  "Lembrete automático corta faltas em 40%",
  "Status em tempo real, sem confusão",
  "Receita por profissional num clique",
  "Você dorme, o bot trabalha"
];

/** Comparativo "Antes x Depois". Marcadores (× / ✓) vêm via CSS ::before. */
export function BeforeAfter() {
  return (
    <section className="lp-section lp-ba">
      <div className="lp-container">
        <div className="lp-section__head lp-reveal">
          <span className="lp-eyebrow lp-eyebrow--amber">Da gambiarra · pro profissional</span>
          <h2>
            Como sua semana muda
            <br />
            depois do MarcaiFlex
          </h2>
        </div>
        <div className="lp-ba-grid">
          <div className="lp-ba-card lp-ba-card--before lp-reveal">
            <span className="lp-ba-card__tag">✗ Antes</span>
            <h3>
              Caderno, post-it e
              <br />
              zap perdido nas mensagens.
            </h3>
            <ul className="lp-ba-list">
              {BEFORE.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="lp-ba-card lp-ba-card--after lp-reveal">
            <span className="lp-ba-card__tag">✓ Depois</span>
            <h3>
              Agenda redondinha,
              <br />
              relatório na palma.
            </h3>
            <ul className="lp-ba-list">
              {AFTER.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
