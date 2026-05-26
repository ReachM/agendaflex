"use client";

import {
  BarChart3,
  CalendarCheck,
  CheckSquare,
  CreditCard,
  MessageCircle,
  UserPlus,
  type LucideIcon
} from "lucide-react";

const FEATURES: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: CalendarCheck,
    title: "Agendamento online",
    desc: "Seu cliente marca por uma página pública 24/7. Sem ligação, sem zap manual, sem dor."
  },
  {
    icon: MessageCircle,
    title: "Bot de WhatsApp",
    desc: "Atende, confirma, lembra e reagenda direto na conversa. Sem você abrir nada."
  },
  {
    icon: UserPlus,
    title: "Multi-profissionais",
    desc: "Cada um com sua agenda, cores próprias, serviços e horários individuais."
  },
  {
    icon: BarChart3,
    title: "Relatórios claros",
    desc: "Faturamento, taxa de no-show, clientes que somem. Tudo em um painel direto."
  },
  {
    icon: CreditCard,
    title: "Pagamento online",
    desc: "Mercado Pago + Pix integrados. Cobre antes ou depois — você decide."
  },
  {
    icon: CheckSquare,
    title: "Checklists por serviço",
    desc: "Padronize o atendimento — do prontuário ao checklist da oficina."
  }
];

/** Grid de recursos. */
export function Features() {
  return (
    <section id="recursos" className="lp-section">
      <div className="lp-container">
        <div className="lp-section__head lp-reveal">
          <span className="lp-eyebrow">Recursos</span>
          <h2>Tudo num lugar só</h2>
          <p>Menos abas abertas. Menos trabalho manual. Mais tempo pra atender bem.</p>
        </div>
        <div className="lp-feature-grid">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <article className="lp-feature-card lp-reveal" key={feature.title}>
                <span className="lp-feature-card__icon">
                  <Icon size={22} strokeWidth={1.75} />
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.desc}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
