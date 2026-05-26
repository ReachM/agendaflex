"use client";

const QUESTIONS: { q: string; a: React.ReactNode }[] = [
  {
    q: "Eu preciso ter conhecimento técnico pra usar?",
    a: "Não. O MarcaiFlex foi feito pra quem nunca usou um SaaS. Em 5 minutos você cadastra o negócio, conecta o WhatsApp e o bot já tá rodando. Tem tutorial em vídeo passo a passo se travar."
  },
  {
    q: "Funciona com o meu WhatsApp comum ou preciso do Business?",
    a: "Funciona com qualquer um — comum ou Business. O bot conecta via QR Code, sem precisar de aprovação da Meta nem números pagos."
  },
  {
    q: "E se eu quiser atender pessoalmente em vez do bot?",
    a: 'Você assume a conversa a qualquer momento. O bot avisa "olha, vou chamar o atendente humano" e passa a bola. Quando você terminar, devolve pro bot com um clique.'
  },
  {
    q: "Posso testar antes de pagar?",
    a: (
      <>
        Sim. 7 dias com <strong>todos os recursos</strong> liberados, sem precisar cadastrar cartão.
        Se gostar, escolhe o plano. Se não, fica tudo bem — sem cobrança nenhuma.
      </>
    )
  },
  {
    q: "Meus dados ficam seguros?",
    a: "Sim. Banco de dados criptografado, hospedado no Brasil, em conformidade com a LGPD. Você é dono dos seus dados — pode exportar tudo a qualquer momento."
  },
  {
    q: "Tem fidelidade? Posso cancelar quando quiser?",
    a: "Zero fidelidade. Cancela quando quiser, com 1 clique. Sem multa, sem ligação pra retenção, sem letras miúdas."
  },
  {
    q: "Funciona pro meu tipo de negócio?",
    a: "Provavelmente sim. Hoje atendemos salões, clínicas, oficinas, barbearias, estéticas, consultórios, pet shops, estúdios e personal trainers — basicamente qualquer negócio que vive de horário marcado. Se ficar na dúvida, manda um zap pra gente."
  }
];

/** Perguntas frequentes com <details> nativo. */
export function FAQ() {
  return (
    <section id="faq" className="lp-section">
      <div className="lp-container">
        <div className="lp-section__head lp-reveal">
          <span className="lp-eyebrow">Perguntas frequentes</span>
          <h2>Tudo que você precisa saber</h2>
        </div>
        <div className="lp-faq__list">
          {QUESTIONS.map(({ q, a }) => (
            <details className="lp-faq__item lp-reveal" key={q}>
              <summary className="lp-faq__q">
                {q}
                <span className="lp-faq__plus" aria-hidden="true">
                  +
                </span>
              </summary>
              <div className="lp-faq__a">{a}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
