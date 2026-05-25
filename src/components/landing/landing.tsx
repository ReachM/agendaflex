"use client";

import {
  ArrowRight,
  BarChart3,
  Bell,
  CalendarCheck,
  Check,
  Cpu,
  HeartPulse,
  LayoutGrid,
  Link2,
  type LucideIcon,
  Menu,
  MessageCircle,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  Stethoscope,
  Users,
  Wrench,
  X
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SEGMENTS } from "@/lib/registration";
import "./landing.css";

type PublicPlan = {
  name: string;
  slug: string;
  description: string | null;
  price: number;
  features: string[];
};

const SEGMENT_ICONS: Record<string, LucideIcon> = {
  CLINICA_MEDICA: Stethoscope,
  OFICINA_MECANICA: Wrench,
  SALAO_BELEZA: Scissors,
  CONSULTORIO: HeartPulse,
  ASSISTENCIA_TECNICA: Cpu,
  PRESTADOR_SERVICOS: Users,
  PERSONALIZADO: LayoutGrid
};

const FEATURES: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: CalendarCheck,
    title: "Agendamento online",
    desc: "Seus clientes marcam sozinhos por uma página pública, 24/7, sem ligação nem WhatsApp manual."
  },
  {
    icon: MessageCircle,
    title: "Lembretes e bot de WhatsApp",
    desc: "Confirmações e lembretes automáticos reduzem faltas. O bot responde e agenda direto na conversa."
  },
  {
    icon: Users,
    title: "Multiprofissional",
    desc: "Agendas separadas por profissional, com horários, serviços e disponibilidade individuais."
  },
  {
    icon: BarChart3,
    title: "Relatórios claros",
    desc: "Acompanhe atendimentos, ocupação e desempenho da equipe com painéis objetivos."
  },
  {
    icon: SlidersHorizontal,
    title: "Campos personalizados",
    desc: "Adapte cadastros e fichas ao seu segmento — do prontuário clínico à placa do veículo."
  },
  {
    icon: Link2,
    title: "Página pública por empresa",
    desc: "Um link só seu para divulgar e receber agendamentos com a cara do seu negócio."
  }
];

function formatPrice(price: number): string {
  if (!Number.isFinite(price) || price <= 0) return "Grátis";
  return price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Reveals suaves no scroll via IntersectionObserver, respeitando reduced-motion. */
function useReveal(deps: unknown[] = []) {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const els = Array.from(document.querySelectorAll<HTMLElement>(".lp-reveal:not(.lp-reveal--in)"));
    if (reduce || !("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("lp-reveal--in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("lp-reveal--in");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Parallax leve do mockup do hero (desligado em reduced-motion). */
function useParallax(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        if (ref.current) ref.current.style.transform = `translate3d(0, ${y * 0.05}px, 0)`;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [ref]);
}

function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="lp-header">
      <div className="lp-container lp-header__inner">
        <Link href="/" className="lp-logo" aria-label="AgendaFlex, página inicial">
          <span className="lp-logo__mark">AF</span>
          <span className="lp-logo__word">
            Agenda<span>Flex</span>
          </span>
        </Link>

        <nav className={`lp-nav ${open ? "lp-nav--open" : ""}`} aria-label="Navegação principal">
          <a href="#recursos" onClick={() => setOpen(false)}>
            Recursos
          </a>
          <a href="#planos" onClick={() => setOpen(false)}>
            Planos
          </a>
          <a href="#contato" onClick={() => setOpen(false)}>
            Contato
          </a>
          <div className="lp-nav__cta">
            <Link href="/login" className="lp-btn lp-btn--ghost">
              Entrar
            </Link>
            <Link href="/cadastro" className="lp-btn lp-btn--primary">
              Começar grátis
            </Link>
          </div>
        </nav>

        <button
          type="button"
          className="lp-nav-toggle"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
    </header>
  );
}

function HeroMockup() {
  const floatRef = useRef<HTMLDivElement>(null);
  useParallax(floatRef);

  return (
    <div className="lp-mockup" aria-hidden="true">
      <div className="lp-mockup__window">
        <div className="lp-mockup__chrome">
          <span />
          <span />
          <span />
        </div>
        <div className="lp-mockup__app">
          <aside className="lp-mockup__side">
            <div className="lp-mockup__brand">AF</div>
            <span className="lp-mockup__navitem lp-mockup__navitem--active" />
            <span className="lp-mockup__navitem" />
            <span className="lp-mockup__navitem" />
            <span className="lp-mockup__navitem" />
          </aside>
          <div className="lp-mockup__main">
            <div className="lp-mockup__stats">
              <div className="lp-mockup__stat">
                <strong>128</strong>
                <span>Agendamentos</span>
              </div>
              <div className="lp-mockup__stat">
                <strong>94%</strong>
                <span>Confirmações</span>
              </div>
              <div className="lp-mockup__stat">
                <strong>R$ 12k</strong>
                <span>No mês</span>
              </div>
            </div>
            <div className="lp-mockup__agenda">
              {[
                { t: "09:00", w: "82%" },
                { t: "10:30", w: "64%" },
                { t: "13:00", w: "90%" },
                { t: "15:30", w: "48%" }
              ].map((row) => (
                <div className="lp-mockup__row" key={row.t}>
                  <span className="lp-mockup__time">{row.t}</span>
                  <span className="lp-mockup__bar" style={{ width: row.w }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="lp-mockup__float" ref={floatRef}>
        <div className="lp-float-card lp-float-card--toast">
          <CalendarCheck size={16} />
          <div>
            <strong>Novo agendamento</strong>
            <span>Hoje, 14:00 · confirmado</span>
          </div>
        </div>
        <div className="lp-float-card lp-float-card--wa">
          <MessageCircle size={16} />
          <div>
            <strong>Lembrete enviado</strong>
            <span>WhatsApp · 24h antes</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlansSection() {
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
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

  return (
    <section id="planos" className="lp-section lp-plans">
      <div className="lp-container">
        <div className="lp-section__head lp-reveal">
          <span className="lp-eyebrow">Planos</span>
          <h2>Comece grátis, evolua quando precisar</h2>
          <p>
            7 dias de teste com <strong>todos os recursos liberados</strong>. Sem cartão de crédito.
            Escolha o plano ideal ao concluir o cadastro.
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
              const featured = index === plans.length - 1;
              return (
                <div className={`lp-plan ${featured ? "lp-plan--featured" : ""} lp-reveal`} key={plan.slug}>
                  {featured && <span className="lp-plan__ribbon">Mais completo</span>}
                  <div className="lp-plan__name">{plan.name}</div>
                  <div className="lp-plan__price">
                    {formatPrice(plan.price)}
                    {formatPrice(plan.price) !== "Grátis" && <span>/mês</span>}
                  </div>
                  {plan.description && <p className="lp-plan__desc">{plan.description}</p>}
                  <ul className="lp-plan__features">
                    {plan.features.map((f) => (
                      <li key={f}>
                        <Check size={15} /> {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/cadastro"
                    className={`lp-btn ${featured ? "lp-btn--primary" : "lp-btn--outline"} lp-btn--block`}
                  >
                    Começar teste grátis
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

export function Landing() {
  useReveal();

  return (
    <div className="lp">
      <Header />

      <main>
        {/* ── Hero ───────────────────────────────── */}
        <section className="lp-hero">
          <div className="lp-hero__glow" aria-hidden="true" />
          <div className="lp-container lp-hero__grid">
            <div className="lp-hero__copy">
              <span className="lp-eyebrow lp-anim lp-anim-1">
                <Sparkles size={14} /> Agendamento sem fricção
              </span>
              <h1 className="lp-anim lp-anim-2">
                A agenda do seu negócio, <span className="lp-hl">organizada e cheia</span>.
              </h1>
              <p className="lp-hero__sub lp-anim lp-anim-3">
                Receba agendamentos online, reduza faltas com lembretes automáticos no WhatsApp e
                acompanhe tudo em um painel feito para clínicas, salões, oficinas e prestadores de
                serviço.
              </p>
              <div className="lp-hero__cta lp-anim lp-anim-4">
                <Link href="/cadastro" className="lp-btn lp-btn--primary lp-btn--lg">
                  Começar teste grátis de 7 dias <ArrowRight size={18} />
                </Link>
                <a href="#planos" className="lp-btn lp-btn--ghost lp-btn--lg">
                  Ver planos
                </a>
              </div>
              <p className="lp-hero__note lp-anim lp-anim-5">
                <Check size={15} /> Sem cartão de crédito · <Check size={15} /> Todos os recursos no
                teste
              </p>
            </div>
            <div className="lp-hero__visual lp-anim lp-anim-3">
              <HeroMockup />
            </div>
          </div>
        </section>

        {/* ── Segmentos ──────────────────────────── */}
        <section className="lp-section lp-segments">
          <div className="lp-container">
            <div className="lp-section__head lp-reveal">
              <span className="lp-eyebrow">Para o seu segmento</span>
              <h2>Feito para diferentes tipos de negócio</h2>
              <p>O mesmo poder de agendamento, adaptado ao jeito que você atende.</p>
            </div>
            <div className="lp-segment-grid">
              {SEGMENTS.map((seg, i) => {
                const Icon = SEGMENT_ICONS[seg.value] ?? LayoutGrid;
                return (
                  <div className="lp-segment-card lp-reveal" key={seg.value} style={{ transitionDelay: `${i * 40}ms` }}>
                    <span className="lp-segment-card__icon">
                      <Icon size={20} />
                    </span>
                    <strong>{seg.label}</strong>
                    <span className="lp-segment-card__desc">{seg.description}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Recursos ───────────────────────────── */}
        <section id="recursos" className="lp-section lp-features">
          <div className="lp-container">
            <div className="lp-section__head lp-reveal">
              <span className="lp-eyebrow">Recursos</span>
              <h2>Tudo que você precisa para encher a agenda</h2>
              <p>Menos trabalho manual, menos faltas e mais tempo para atender bem.</p>
            </div>
            <div className="lp-feature-grid">
              {FEATURES.map((feature, i) => {
                const Icon = feature.icon;
                return (
                  <article className="lp-feature-card lp-reveal" key={feature.title} style={{ transitionDelay: `${i * 50}ms` }}>
                    <span className="lp-feature-card__icon">
                      <Icon size={22} />
                    </span>
                    <h3>{feature.title}</h3>
                    <p>{feature.desc}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Planos (dinâmico) ──────────────────── */}
        <PlansSection />

        {/* ── CTA final ──────────────────────────── */}
        <section className="lp-section lp-cta-final">
          <div className="lp-container">
            <div className="lp-cta-final__card lp-reveal">
              <Bell size={28} aria-hidden="true" />
              <h2>Pronto para parar de perder horários?</h2>
              <p>Crie sua conta em minutos e comece o teste grátis de 7 dias hoje mesmo.</p>
              <Link href="/cadastro" className="lp-btn lp-btn--primary lp-btn--lg">
                Começar agora <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ───────────────────────────────── */}
      <footer id="contato" className="lp-footer">
        <div className="lp-container lp-footer__inner">
          <div className="lp-footer__brand">
            <span className="lp-logo__mark">AF</span>
            <span className="lp-logo__word">
              Agenda<span>Flex</span>
            </span>
            <p>Agendamento online para negócios que vivem de horário.</p>
          </div>
          <nav className="lp-footer__links" aria-label="Rodapé">
            <a href="#recursos">Recursos</a>
            <a href="#planos">Planos</a>
            <Link href="/login">Entrar</Link>
            <Link href="/cadastro">Criar conta</Link>
          </nav>
        </div>
        <div className="lp-footer__bar">
          <span>© {new Date().getFullYear()} AgendaFlex. Todos os direitos reservados.</span>
        </div>
      </footer>
    </div>
  );
}
