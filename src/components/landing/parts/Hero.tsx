"use client";

import { CalendarDays, Check, MessageCircle } from "lucide-react";
import Link from "next/link";

/** Linhas da agenda mockada (horário · barra de ocupação · status). */
const AGENDA_ROWS = [
  { t: "09:00", w: "80%", status: "ok" as const },
  { t: "10:30", w: "64%", status: "ok" as const },
  { t: "13:00", w: "92%", status: "ok" as const },
  { t: "15:30", w: "50%", status: "wait" as const },
  { t: "17:00", w: "74%", status: "ok" as const }
];

function HeroMockup() {
  return (
    // Floats são irmãos do .lp-mockup (não filhos) para não serem cortados pelo
    // overflow:hidden do mockup; o offset parent é .lp-hero__visual (overflow:visible).
    <>
      <div className="lp-mockup" aria-hidden="true">
        <div className="lp-mockup__chrome">
          <span />
          <span />
          <span />
        </div>
        <div className="lp-mockup__app">
          <aside className="lp-mockup__side">
            <div className="lp-mockup__brand">MF</div>
            <span className="lp-mockup__navitem lp-mockup__navitem--on" />
            <span className="lp-mockup__navitem" />
            <span className="lp-mockup__navitem" />
            <span className="lp-mockup__navitem" />
            <span className="lp-mockup__navitem" />
          </aside>
          <div className="lp-mockup__main">
            <div className="lp-mockup__title">Agenda — Quinta, 28 mai</div>
            <div className="lp-mockup__sub">14 agendamentos · 86% confirmados via bot</div>
            <div className="lp-mockup__stats">
              <div className="lp-mockup__stat">
                <strong>14</strong>
                <span>Hoje</span>
              </div>
              <div className="lp-mockup__stat">
                <strong>12</strong>
                <span>Confirmados</span>
              </div>
              <div className="lp-mockup__stat">
                <strong>R$ 2,4k</strong>
                <span>Receita</span>
              </div>
            </div>
            <div className="lp-mockup__agenda">
              {AGENDA_ROWS.map((row) => (
                <div className="lp-mockup__row" key={row.t}>
                  <span className="lp-mockup__time">{row.t}</span>
                  <span className="lp-mockup__bar" style={{ width: row.w }} />
                  <span className={`lp-mockup__status lp-mockup__status--${row.status}`}>
                    {row.status === "ok" ? "OK" : "⏱"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="lp-float-card lp-float-card--toast">
        <span className="lp-float-card__ic">
          <CalendarDays size={14} />
        </span>
        <div>
          <strong>Novo agendamento</strong>
          <span className="lp-float-card__sub">Hoje, 14:00 · confirmado</span>
        </div>
      </div>
      <div className="lp-float-card lp-float-card--wa">
        <span className="lp-float-card__ic">
          <MessageCircle size={14} />
        </span>
        <div>
          <strong>Lembrete enviado</strong>
          <span className="lp-float-card__sub">WhatsApp · 24h antes</span>
        </div>
      </div>
    </>
  );
}

export function Hero() {
  return (
    <section className="lp-hero">
      <div className="lp-container lp-hero__grid">
        <div className="lp-hero__copy">
          <span className="lp-eyebrow">Agendamento + Bot WhatsApp</span>
          <h1>
            Sua agenda cheia, <span className="lp-hl">sem o telefone tocando</span>.
          </h1>
          <p className="lp-lede lp-hero__sub">
            Receba agendamentos online, reduza faltas com lembretes automáticos no WhatsApp e
            acompanhe tudo em um painel feito para{" "}
            <strong>qualquer negócio que trabalha com horário marcado</strong>.
          </p>
          <div className="lp-hero__cta">
            <Link href="/register" className="lp-btn lp-btn--primary lp-btn--lg">
              Começar teste grátis de 7 dias →
            </Link>
            <a href="#planos" className="lp-btn lp-btn--ghost lp-btn--lg">
              Ver planos
            </a>
          </div>
          <div className="lp-hero__note">
            <span>
              <span className="lp-ck">
                <Check size={11} strokeWidth={3} />
              </span>{" "}
              Sem cartão de crédito
            </span>
            <span>
              <span className="lp-ck">
                <Check size={11} strokeWidth={3} />
              </span>{" "}
              Todos os recursos liberados
            </span>
            <span>
              <span className="lp-ck">
                <Check size={11} strokeWidth={3} />
              </span>{" "}
              5 min pra começar
            </span>
          </div>
        </div>

        <div className="lp-hero__visual">
          <HeroMockup />
        </div>
      </div>
    </section>
  );
}
