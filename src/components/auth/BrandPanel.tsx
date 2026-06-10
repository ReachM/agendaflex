import { Calendar, MessageCircle, Receipt, Sparkles, Smartphone, Wallet } from "lucide-react";
import Link from "next/link";
import { Mark } from "@/components/brand/Mark";
import { Wordmark } from "@/components/brand/Wordmark";

type Variant = "login" | "register";

type Feature = {
  icon: React.ReactNode;
  text: React.ReactNode;
};

const FEATURES: Record<Variant, Feature[]> = {
  login: [
    { icon: <Calendar size={16} />, text: "Agenda inteligente com link público" },
    { icon: <MessageCircle size={16} />, text: "Lembretes automáticos no WhatsApp" },
    { icon: <Receipt size={16} />, text: "Financeiro e notas fiscais integrados" }
  ],
  register: [
    { icon: <Sparkles size={16} />, text: "7 dias grátis sem cartão" },
    { icon: <Calendar size={16} />, text: "Sua página de agendamento pronta" },
    { icon: <Smartphone size={16} />, text: "Bot do WhatsApp em poucos cliques" },
    { icon: <Wallet size={16} />, text: "Cancele quando quiser" }
  ]
};

const HEADLINES: Record<Variant, { badge: string; title: string; sub: string }> = {
  login: {
    badge: "A AGENDA DO SEU NEGÓCIO",
    title: "Sua agenda cheia, sem o telefone tocando.",
    sub: "Agendamento online, lembretes no WhatsApp e controle financeiro num só lugar."
  },
  register: {
    badge: "COMECE GRÁTIS",
    title: "Em 2 minutos sua agenda está no ar.",
    sub: "Teste grátis por 7 dias, sem cartão. Cancele quando quiser."
  }
};

const TOP_LINKS: Record<Variant, { label: string; cta: string; href: string }> = {
  login: { label: "Não tem conta?", cta: "Começar grátis", href: "/register" },
  register: { label: "Já tem conta?", cta: "Entrar", href: "/login" }
};

const AVATARS: { initials: string; bg: string }[] = [
  { initials: "CA", bg: "linear-gradient(135deg,#0d9488,#0f766e)" },
  { initials: "MV", bg: "linear-gradient(135deg,#d97706,#b45309)" },
  { initials: "RG", bg: "linear-gradient(135deg,#9333ea,#7e22ce)" },
  { initials: "HD", bg: "linear-gradient(135deg,#db2777,#9d174d)" }
];

export function BrandPanel({ variant }: { variant: Variant }) {
  const features = FEATURES[variant];
  const headline = HEADLINES[variant];
  const top = TOP_LINKS[variant];

  return (
    <aside className="auth-brand" aria-hidden="false">
      <div className="auth-brand__top">
        <div className="auth-brand__logo">
          <Mark size="md" variant="dark" />
          <Wordmark variant="light" size="md" />
        </div>
        <div>
          {top.label}{" "}
          <Link href={top.href} className="auth-brand__top-link">
            {top.cta}
          </Link>
        </div>
      </div>

      <div className="auth-brand__body">
        <span className="auth-brand__badge">{headline.badge}</span>
        <h1 className="auth-brand__headline">{headline.title}</h1>
        <p className="auth-brand__sub">{headline.sub}</p>

        <ul className="auth-brand__features">
          {features.map((feature, idx) => (
            <li key={idx} className="auth-brand__feature">
              <span className="auth-brand__feature-icon">{feature.icon}</span>
              <span>{feature.text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="auth-brand__social">
        <div className="auth-brand__avatars">
          {AVATARS.map((a) => (
            <span key={a.initials} className="auth-brand__avatar" style={{ background: a.bg }}>
              {a.initials}
            </span>
          ))}
        </div>
        <div className="auth-brand__social-text">
          <span className="auth-brand__stars">★★★★★</span> 1.284 negócios já organizam a agenda com a MarcaiFlex
        </div>
      </div>
    </aside>
  );
}
