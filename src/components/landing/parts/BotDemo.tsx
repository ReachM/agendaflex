"use client";

const CHECKLIST = [
  "Atende 24/7, mesmo quando você não pode",
  "Oferece só horários disponíveis no seu calendário",
  "Confirma e adiciona direto na sua agenda",
  "Envia lembrete 24h e 2h antes — reduz faltas em 40%",
  "Você assume a conversa a qualquer momento"
];

type Bubble = {
  side: "in" | "out";
  text: string;
  meta: string;
  /** Quando presente, renderiza as opções de horário como botões empilhados. */
  opts?: string[];
};

const BUBBLES: Bubble[] = [
  { side: "in", text: "Oi Camila! Sou o assistente do Salão da Júlia 👋", meta: "11:32" },
  { side: "in", text: "Quer marcar um horário? Tô aqui pra ajudar.", meta: "11:32" },
  { side: "out", text: "Oii! Queria um corte essa semana", meta: "11:33 ✓✓" },
  {
    side: "in",
    text: "Boa! Achei essas opções aqui:",
    meta: "11:33",
    opts: ["Quinta · 28/05 · 14h", "Sexta · 29/05 · 10h30", "Sábado · 30/05 · 09h"]
  },
  { side: "out", text: "Quinta 14h tá perfeito", meta: "11:33 ✓✓" },
  { side: "in", text: "Marcado! ✓ Te lembro 24h antes. Qualquer coisa, é só chamar 💚", meta: "11:33" }
];

/** Bot WhatsApp — seção split (fundo branco) com mock de conversa. */
export function BotDemo() {
  return (
    <section className="lp-section lp-split">
      <div className="lp-container lp-split__grid">
        <div className="lp-split__copy lp-reveal">
          <span className="lp-eyebrow">Bot WhatsApp · Evolution API</span>
          <h2>
            Sua agenda <span className="lp-i">conversa</span> com seus clientes.
          </h2>
          <p>
            O bot integra com seu número de WhatsApp e atende como você atenderia — só que sem erro,
            sem esquecer, e às 3 da manhã também.
          </p>
          <ul className="lp-checklist">
            {CHECKLIST.map((item) => (
              <li key={item}>
                <span className="lp-ck">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="lp-reveal">
          <div className="lp-wa" aria-hidden="true">
            <div className="lp-wa__screen">
              <div className="lp-wa__top">
                <div className="lp-wa__av">MF</div>
                <div className="lp-wa__name">
                  <strong>Salão da Júlia</strong>
                  <span>online · respondendo</span>
                </div>
              </div>
              <div className="lp-wa__msgs">
                {BUBBLES.map((b, i) => (
                  <div
                    className={`lp-bubble lp-bubble--${b.side}`}
                    key={i}
                    style={{ animationDelay: `${i * 0.15}s` }}
                  >
                    {b.text}
                    {b.opts && (
                      <div className="lp-bubble__opts">
                        {b.opts.map((o) => (
                          <button type="button" tabIndex={-1} key={o}>
                            {o}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="lp-bubble__meta">{b.meta}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
