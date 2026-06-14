"use client";

import { useState } from "react";
import {
  Check, ChevronLeft, ChevronRight,
  Calendar, Clock, Link2, Scissors,
  Users, HelpCircle, Mail, Search,
  BookOpen, CalendarDays, DollarSign,
  BarChart, Bot, AlertTriangle
} from "lucide-react";
import "./ajuda.css";

/* ─── Tipos ─────────────────────────────────────────────────── */
type SubStep = { label: string; detail: string };
type RuleCard = { icon: React.ReactNode; title: string; desc: string; detail: string };
type AgendaTab = { label: string; detail: string };
type TutorialStep = {
  id: string;
  badge: string;
  badgeColor: "teal" | "purple" | "amber" | "red" | "gray";
  title: string;
  desc: string;
  renderIllus: () => React.ReactNode;
  tips: { icon: React.ReactNode; html: string }[];
  subSteps?: SubStep[];
  rules?: RuleCard[];
  agendaTabs?: AgendaTab[];
  warn?: string;
  success?: string;
};

/* ─── Dados das sub-etapas de serviços ────────────────────────── */
const SERVICE_FIELDS: SubStep[] = [
  {
    label: "Nome",
    detail: "Nome do serviço exibido ao cliente — use termos que ele reconhece. Ex: \"Corte masculino\", \"Manicure\". Evite nomes internos.",
  },
  {
    label: "Categoria",
    detail: "Agrupa os serviços na listagem. Ex: \"Cabelo\", \"Unhas\", \"Estética\". Você cria as categorias com cor personalizada antes de criar os serviços.",
  },
  {
    label: "Preço (R$)",
    detail: "Valor base exibido ao cliente na tela de agendamento online. Pode ser alterado depois sem impacto nos agendamentos já realizados.",
  },
  {
    label: "Duração (min)",
    detail: "Quanto tempo o profissional fica ocupado. Essencial para o cálculo dos slots: se o serviço dura 45 min e o intervalo de slots é 30 min, o sistema bloqueia automaticamente o tempo correto.",
  },
  {
    label: "Visível online",
    detail: "Marque para que o serviço apareça na tela de agendamento público. Serviços desmarcados ficam apenas para uso interno (agenda manual).",
  },
  {
    label: "Descrição",
    detail: "Texto opcional exibido embaixo do nome na tela de agendamento. Use para detalhar o que está incluso ou dar orientações ao cliente.",
  },
];

/* ─── Dados das regras de horários ────────────────────────────── */
const SCHEDULE_RULES: RuleCard[] = [
  {
    icon: <Clock size={18} />,
    title: "Intervalo entre slots",
    desc: "Espaço entre cada horário disponível. Ex: 30 min → 09:00, 09:30, 10:00…",
    detail: "Opções: 15, 20, 30, 45 ou 60 minutos. O intervalo não precisa ser igual à duração do serviço — o sistema bloqueia o tempo necessário automaticamente e oferece o próximo slot disponível.",
  },
  {
    icon: <AlertTriangle size={18} />,
    title: "Antecedência mínima",
    desc: "Quantas horas antes o cliente precisa agendar.",
    detail: "Valor de 0 a 72 horas. 0 = cliente pode agendar para agora mesmo. Útil para evitar que o cliente apareça sem que o profissional tenha tempo de se preparar.",
  },
  {
    icon: <Calendar size={18} />,
    title: "Limite de dias futuros",
    desc: "Até quantos dias à frente o cliente pode agendar.",
    detail: "Valor de 1 a 365 dias. Para serviços de alta demanda, um limite menor (ex: 30 dias) evita superlotação. Para serviços com planejamento longo, aumente (ex: 90 dias).",
  },
  {
    icon: <Users size={18} />,
    title: "Aprovação manual",
    desc: "Você confirma cada agendamento antes de aparecer como confirmado.",
    detail: "Automática: confirmado na hora, sem ação sua. Manual: o cliente fica como 'pendente' até você aprovar ou recusar. Útil para negócios com agenda controlada. Se ativada, o cliente vê um aviso na tela de agendamento.",
  },
];

/* ─── Dados das tabs de agenda ─────────────────────────────────── */
const AGENDA_TABS: AgendaTab[] = [
  {
    label: "Visão geral",
    detail: "A aba de agenda mostra todos os agendamentos do dia e da semana. Use a visão semanal para uma visão ampla ou a diária para ver os detalhes por horário. No topo há um mini calendário para navegar rapidamente entre as datas.",
  },
  {
    label: "Filtros",
    detail: "Filtre agendamentos por profissional usando os chips coloridos com os nomes no topo. Combine com o filtro de status (pendente / confirmado / cancelado) para ver exatamente o que precisa.",
  },
  {
    label: "Aprovar / cancelar",
    detail: "Clique em um agendamento para abrir o painel de detalhes. Se a aprovação manual estiver ativa, você verá os botões Confirmar e Recusar. Para cancelar um agendamento confirmado, use o botão Cancelar no painel lateral.",
  },
  {
    label: "Estatísticas",
    detail: "A barra de estatísticas no topo mostra: total do dia, confirmados, pendentes e cancelados. Os números atualizam conforme você navega entre as datas.",
  },
];

/* ─── Ilustrações SVG ──────────────────────────────────────────── */
function IllusOverview() {
  return (
    <svg width="100%" viewBox="0 0 680 180" role="img" aria-label="Ordem: Serviços → Profissionais → Link de agenda">
      <defs>
        <marker id="arr-ov" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </marker>
      </defs>
      {/* Box 1 - Serviços */}
      <rect x="50" y="46" width="160" height="88" rx="12" fill="#E1F5EE" stroke="#0F6E56" strokeWidth="0.5" />
      <text x="130" y="82" textAnchor="middle" fontSize="13" fontWeight="500" fill="#085041">Serviços</text>
      <text x="130" y="100" textAnchor="middle" fontSize="11" fill="#0F6E56">Cadastre primeiro</text>
      <text x="130" y="118" textAnchor="middle" fontSize="11" fill="#0F6E56">nome, preço, duração</text>
      {/* Arrow 1→2 */}
      <line x1="210" y1="90" x2="248" y2="90" stroke="#888780" strokeWidth="1.5" markerEnd="url(#arr-ov)" />
      {/* Box 2 - Profissionais */}
      <rect x="250" y="46" width="180" height="88" rx="12" fill="#EEEDFE" stroke="#534AB7" strokeWidth="0.5" />
      <text x="340" y="82" textAnchor="middle" fontSize="13" fontWeight="500" fill="#26215C">Profissionais</text>
      <text x="340" y="100" textAnchor="middle" fontSize="11" fill="#534AB7">Horários + serviços</text>
      <text x="340" y="118" textAnchor="middle" fontSize="11" fill="#534AB7">vinculados</text>
      {/* Arrow 2→3 */}
      <line x1="430" y1="90" x2="468" y2="90" stroke="#888780" strokeWidth="1.5" markerEnd="url(#arr-ov)" />
      {/* Box 3 - Link */}
      <rect x="470" y="46" width="160" height="88" rx="12" fill="#FAEEDA" stroke="#854F0B" strokeWidth="0.5" />
      <text x="550" y="82" textAnchor="middle" fontSize="13" fontWeight="500" fill="#412402">Link de agenda</text>
      <text x="550" y="100" textAnchor="middle" fontSize="11" fill="#854F0B">Compartilhe com</text>
      <text x="550" y="118" textAnchor="middle" fontSize="11" fill="#854F0B">seus clientes</text>
    </svg>
  );
}

function IllusServico() {
  const fields = [
    { name: "Nome do serviço", req: true, ex: "Corte masculino" },
    { name: "Categoria", req: false, ex: "Cabelo, Estética…" },
    { name: "Preço base (R$)", req: false, ex: "R$ 50,00" },
    { name: "Duração (minutos)", req: true, ex: "45 min" },
    { name: "Visível online", req: false, ex: "Toggle ativo/inativo" },
    { name: "Descrição", req: false, ex: "Texto opcional" },
  ];
  return (
    <div style={{ padding: "16px 24px 8px" }}>
      <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
        Campos ao criar um serviço — clique em cada um acima para saber mais
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {fields.map((f) => (
          <div key={f.name} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)",
            background: "var(--surface)", fontSize: 13,
          }}>
            <span style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
              {f.name}
              {f.req && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 99, background: "var(--primary-ghost)", color: "var(--primary-hover)" }}>
                  obrigatório
                </span>
              )}
            </span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{f.ex}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function IlhussProfissional() {
  const days = [
    { d: "Segunda", open: true },
    { d: "Terça", open: true },
    { d: "Quarta", open: true },
    { d: "Quinta", open: true },
    { d: "Sexta", open: true },
    { d: "Sábado", open: false },
    { d: "Domingo", open: false },
  ];
  return (
    <div style={{ padding: "16px 24px 8px" }}>
      <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
        Configure os dias e horários de cada profissional
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {days.map((d) => (
          <div key={d.d} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "8px 12px", borderRadius: 8,
            border: `1px solid ${d.open ? "var(--primary-light)" : "var(--border)"}`,
            background: d.open ? "var(--primary-ghost)" : "var(--surface-muted)",
            fontSize: 13,
          }}>
            <span style={{ fontWeight: 600, color: d.open ? "var(--text)" : "var(--muted)" }}>{d.d}</span>
            {d.open
              ? <><span style={{ fontSize: 12, color: "var(--primary-hover)" }}>09:00 – 18:00</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: "var(--primary-ghost)", color: "var(--primary-hover)" }}>Aberto</span></>
              : <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: "var(--surface-muted)", color: "var(--muted-2)" }}>Fechado</span>
            }
          </div>
        ))}
      </div>
    </div>
  );
}

function IllusLink() {
  return (
    <div style={{ padding: "20px 24px 12px" }}>
      <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
        Link público da sua empresa
      </p>
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
        borderRadius: 10, border: "1px solid var(--primary-light)",
        background: "var(--primary-ghost)", marginBottom: 14,
      }}>
        <Link2 size={15} color="var(--primary)" />
        <span style={{ fontSize: 13, color: "var(--primary-hover)", fontWeight: 600 }}>
          marcaiflex.com.br/agendar/<strong>seu-negocio</strong>
        </span>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {["WhatsApp", "Instagram Bio", "QR Code", "Embed no site", "Copiar link"].map((label) => (
          <div key={label} style={{
            padding: "6px 14px", borderRadius: 99,
            border: "1px solid var(--border)", background: "var(--surface)",
            fontSize: 12, fontWeight: 500, color: "var(--text-secondary)",
          }}>{label}</div>
        ))}
      </div>
    </div>
  );
}

function IllusAgenda() {
  const stats = [
    { label: "Confirmados", n: 8, color: "#16a34a", bg: "#dcfce7" },
    { label: "Pendentes", n: 3, color: "#d97706", bg: "#fef3c7" },
    { label: "Cancelados", n: 1, color: "#dc2626", bg: "#fee2e2" },
  ];
  const slots = [
    { time: "09:00", name: "Ana Costa", svc: "Manicure", status: "confirmed" },
    { time: "10:00", name: "João Silva", svc: "Corte masculino", status: "pending" },
    { time: "11:30", name: "Maria Lopes", svc: "Coloração", status: "confirmed" },
  ];
  return (
    <div style={{ padding: "16px 24px 8px" }}>
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        {stats.map((s) => (
          <div key={s.label} style={{ flex: 1, padding: "10px 14px", borderRadius: 8, background: s.bg, textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.n}</div>
            <div style={{ fontSize: 11, color: s.color, marginTop: 2, opacity: 0.85 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
        {slots.map((s) => (
          <div key={s.time} style={{
            display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
            borderBottom: "1px solid var(--border)", background: "var(--surface)", fontSize: 13,
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", minWidth: 40 }}>{s.time}</span>
            <span style={{ fontWeight: 600, color: "var(--text)", flex: 1 }}>{s.name}</span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{s.svc}</span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
              background: s.status === "confirmed" ? "#dcfce7" : "#fef3c7",
              color: s.status === "confirmed" ? "#16a34a" : "#d97706",
            }}>
              {s.status === "confirmed" ? "Confirmado" : "Pendente"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Definição dos steps ──────────────────────────────────────── */
const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "overview",
    badge: "Visão geral",
    badgeColor: "gray",
    title: "Como configurar o MarcaiFlex",
    desc: "Siga essa ordem e em minutos seus clientes já poderão agendar online.",
    renderIllus: () => <IllusOverview />,
    tips: [
      { icon: <Scissors size={14} />, html: "<strong>1º Serviços</strong> — cadastre os serviços que o negócio oferece." },
      { icon: <Users size={14} />, html: "<strong>2º Profissionais</strong> — configure horários e vincule os serviços." },
      { icon: <Link2 size={14} />, html: "<strong>3º Link de agenda</strong> — compartilhe com seus clientes e pronto." },
    ],
  },
  {
    id: "servicos",
    badge: "Passo 1",
    badgeColor: "teal",
    title: "Cadastrar serviços",
    desc: "Os serviços são a base de tudo. Adicione-os primeiro — eles serão usados na configuração dos profissionais.",
    renderIllus: () => <IllusServico />,
    subSteps: SERVICE_FIELDS,
    tips: [
      { icon: <AlertTriangle size={14} />, html: "<strong>Por que primeiro?</strong> Ao cadastrar profissionais, você escolhe quais serviços eles atendem — então os serviços precisam existir antes." },
      { icon: <Check size={14} />, html: "Ative <strong>\"Visível online\"</strong> nos serviços que aparecem no agendamento público." },
    ],
  },
  {
    id: "profissionais",
    badge: "Passo 2",
    badgeColor: "purple",
    title: "Cadastrar profissionais",
    desc: "Configure o horário de trabalho de cada profissional e quais serviços ele atende.",
    renderIllus: () => <IlhussProfissional />,
    warn: "Sem dias configurados, os horários do profissional não aparecem para o cliente — mesmo que o serviço esteja ativo.",
    tips: [
      { icon: <Clock size={14} />, html: "<strong>Horários por dia:</strong> ative cada dia da semana e defina início e fim." },
      { icon: <Scissors size={14} />, html: "<strong>Vincule os serviços</strong> que o profissional vai atender. Só os serviços do passo 1 aparecem aqui." },
    ],
  },
  {
    id: "link",
    badge: "Passo 3",
    badgeColor: "amber",
    title: "Link de agenda e configurações",
    desc: "Configure como o agendamento online vai funcionar e compartilhe o link com seus clientes.",
    renderIllus: () => <IllusLink />,
    rules: SCHEDULE_RULES,
    success: "Assim que profissional e serviços estiverem prontos, o link já está funcionando. Não é preciso publicar manualmente.",
    tips: [
      { icon: <Check size={14} />, html: "<strong>Cor primária:</strong> personalize a cor dos botões e seleções que o cliente vê." },
      { icon: <Link2 size={14} />, html: "Compartilhe por <strong>WhatsApp, Instagram Bio, link direto ou QR Code.</strong>" },
    ],
  },
  {
    id: "agenda",
    badge: "Aba Agenda",
    badgeColor: "red",
    title: "Como usar a aba de agenda",
    desc: "Aqui você gerencia todos os agendamentos: visualiza, aprova, cancela e filtra por profissional.",
    renderIllus: () => <IllusAgenda />,
    agendaTabs: AGENDA_TABS,
    tips: [
      { icon: <CalendarDays size={14} />, html: "<strong>Filtros:</strong> filtre por profissional e por status (pendente, confirmado, cancelado)." },
      { icon: <Check size={14} />, html: "Se ativou <strong>aprovação manual</strong>, os agendamentos ficam \"Pendente\" até você confirmar." },
    ],
  },
];

const BADGE_COLORS: Record<string, { bg: string; color: string }> = {
  teal:   { bg: "var(--primary-ghost)", color: "var(--primary-hover)" },
  purple: { bg: "#EEEDFE", color: "#534AB7" },
  amber:  { bg: "#FAEEDA", color: "#854F0B" },
  red:    { bg: "#FCEBEB", color: "#A32D2D" },
  gray:   { bg: "var(--surface-muted)", color: "var(--muted)" },
};

/* ─── Sections para a central de ajuda clássica ────────────────── */
const HELP_SECTIONS = [
  {
    key: "inicio",
    label: "Primeiros passos",
    icon: BookOpen,
    articles: [
      {
        title: "Ordem correta de configuração",
        desc: "Serviços primeiro, depois profissionais, depois link.",
        steps: [
          "Vá em Serviços → Novo serviço e cadastre todos os serviços com duração e preço",
          "Vá em Profissionais → configure horários e vincule os serviços a cada profissional",
          "Acesse Link de Agenda, ative o agendamento online e compartilhe o link",
        ],
      },
      {
        title: "Cadastrar serviços",
        desc: "Adicione nome, preço, duração e ative no link público.",
        steps: [
          "Clique em Serviços no menu lateral",
          "Clique em + Nova categoria (ex: Cabelo) — defina cor para organizar",
          "Dentro da categoria clique em + Novo serviço",
          "Preencha nome, preço base e duração em minutos",
          "Marque 'Visível no link público' para aparecer no agendamento online",
        ],
      },
      {
        title: "Cadastrar profissionais",
        desc: "Configure horários de trabalho e vincule os serviços.",
        steps: [
          "Clique em Profissionais → + Novo profissional",
          "Preencha nome e especialidade",
          "Configure os dias da semana: ative cada dia e defina horário de início e fim",
          "Selecione quais serviços esse profissional atende",
          "Salve — ele aparece disponível no link de agendamento",
        ],
      },
    ],
  },
  {
    key: "agenda",
    label: "Agenda",
    icon: CalendarDays,
    articles: [
      {
        title: "Criar um agendamento manualmente",
        desc: "Adicione agendamentos diretamente pela agenda.",
        steps: [
          "Acesse Agenda → + Novo agendamento",
          "Selecione o cliente (busque pelo nome ou cadastre novo)",
          "Escolha profissional, serviço e horário disponível",
          "Clique em Salvar — o agendamento aparece na grade",
        ],
      },
      {
        title: "Aprovar ou cancelar agendamentos",
        desc: "Gerencie o status de cada atendimento.",
        steps: [
          "Clique em qualquer agendamento na grade semanal ou diária",
          "O painel lateral mostra todos os detalhes",
          "Se aprovação manual estiver ativa: clique Confirmar ou Recusar",
          "Para cancelar um confirmado: botão Cancelar no painel lateral",
        ],
      },
      {
        title: "Filtrar por profissional",
        desc: "Veja a agenda de um profissional específico.",
        steps: [
          "No topo da agenda aparecem chips coloridos com o nome de cada profissional",
          "Clique num chip para mostrar só os agendamentos daquele profissional",
          "Clique novamente no chip para desfazer o filtro",
        ],
      },
    ],
  },
  {
    key: "link",
    label: "Link de agenda",
    icon: Link2,
    articles: [
      {
        title: "Compartilhar o link público",
        desc: "Deixe clientes agendarem 24h por dia.",
        steps: [
          "Vá em Link de Agenda no menu lateral",
          "Ative o toggle 'Agendamento online ativo'",
          "Copie o link (ex: marcaiflex.com.br/agendar/seusalao)",
          "Compartilhe no WhatsApp, Instagram Bio, Google Meu Negócio e onde quiser",
        ],
      },
      {
        title: "Configurar regras de horário",
        desc: "Controle quando e como os clientes podem agendar.",
        steps: [
          "Acesse Link de Agenda → seção Regras de horários",
          "Intervalo entre slots: tempo entre cada horário disponível (30 min recomendado)",
          "Antecedência mínima: quantas horas antes o cliente pode agendar (ex: 1h)",
          "Limite de dias futuros: até quantos dias à frente aceita agendamentos (ex: 30 dias)",
          "Aprovação manual: ative para aprovar cada agendamento antes de confirmar",
        ],
      },
      {
        title: "Identidade visual",
        desc: "Personalize as cores do link público.",
        steps: [
          "Em Link de Agenda → Identidade visual",
          "Escolha uma cor da paleta ou use a cor customizada",
          "A cor é aplicada nos botões e seleções da tela que o cliente vê",
        ],
      },
    ],
  },
  {
    key: "financeiro",
    label: "Financeiro",
    icon: DollarSign,
    badge: "PRO",
    articles: [
      {
        title: "Lançar entradas e saídas",
        desc: "Controle o fluxo de caixa do seu negócio.",
        steps: [
          "Vá em Financeiro → + Nova entrada (para receitas)",
          "Ou → + Nova despesa (para gastos como aluguel, produtos)",
          "Preencha valor, categoria e forma de pagamento",
          "Os KPIs do dashboard atualizam automaticamente",
        ],
      },
      {
        title: "Entender o DRE",
        desc: "Veja a saúde financeira do negócio.",
        steps: [
          "O DRE mostra: Receita → Custos Diretos → Despesas Operacionais → Lucro Líquido",
          "Use o filtro de período (Hoje / Semana / Mês / Ano)",
          "A margem de lucro aparece em porcentagem",
          "Exporte os dados em CSV para a contabilidade",
        ],
      },
    ],
  },
  {
    key: "bot",
    label: "Bot WhatsApp",
    icon: Bot,
    badge: "MAX",
    articles: [
      {
        title: "Ativar o bot de lembretes",
        desc: "Envie lembretes automáticos via WhatsApp.",
        steps: [
          "Vá em Bot WhatsApp no menu lateral",
          "Conecte seu número escaneando o QR Code",
          "Configure as mensagens de lembrete (24h antes, 2h antes)",
          "O bot dispara automaticamente para todos os agendamentos confirmados",
        ],
      },
      {
        title: "Agendamento pelo WhatsApp",
        desc: "Clientes podem agendar conversando com o bot.",
        steps: [
          "Com o bot conectado, clientes que mandarem mensagem recebem um menu automático",
          "O cliente escolhe serviço, profissional e horário pelo chat",
          "O agendamento é criado automaticamente na sua agenda",
          "Você recebe uma notificação de novo agendamento",
        ],
      },
    ],
  },
  {
    key: "relatorios",
    label: "Relatórios",
    icon: BarChart,
    badge: "PRO",
    articles: [
      {
        title: "Analisar desempenho",
        desc: "Use os relatórios para tomar decisões com dados.",
        steps: [
          "Vá em Relatórios para ver o painel analítico completo",
          "Veja faturamento por dia, semana ou mês",
          "Identifique os serviços mais agendados",
          "Acompanhe a taxa de ocupação dos profissionais",
        ],
      },
    ],
  },
];

/* ─── Componente Principal ─────────────────────────────────────── */
export default function AjudaPage() {
  const [mode, setMode] = useState<"tutorial" | "faq">("tutorial");
  const [tutStep, setTutStep] = useState(0);
  const [subStep, setSubStep] = useState(0);
  const [activeRule, setActiveRule] = useState(0);
  const [activeTab, setActiveTab] = useState(0);
  const [activeSection, setActiveSection] = useState("inicio");
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const step = TUTORIAL_STEPS[tutStep];
  const badgeStyle = BADGE_COLORS[step.badgeColor];

  function goNext() {
    if (tutStep < TUTORIAL_STEPS.length - 1) {
      setTutStep(tutStep + 1);
      setSubStep(0);
      setActiveRule(0);
      setActiveTab(0);
    } else {
      setTutStep(0);
      setSubStep(0);
    }
  }
  function goBack() {
    if (tutStep > 0) {
      setTutStep(tutStep - 1);
      setSubStep(0);
      setActiveRule(0);
      setActiveTab(0);
    }
  }

  // Seções filtradas para a busca
  const filteredSections = search.trim()
    ? HELP_SECTIONS.map((s) => ({
        ...s,
        articles: s.articles.filter(
          (a) =>
            a.title.toLowerCase().includes(search.toLowerCase()) ||
            a.desc.toLowerCase().includes(search.toLowerCase())
        ),
      })).filter((s) => s.articles.length > 0)
    : [HELP_SECTIONS.find((s) => s.key === activeSection)!];

  return (
    <div className="help-page">
      {/* Hero */}
      <div className="help-hero">
        <HelpCircle size={32} className="help-hero__icon" />
        <h1>Central de Ajuda</h1>
        <p>Tutorial guiado ou busca por tópico — escolha como quer aprender.</p>
        {/* Toggle tutorial vs faq */}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16 }}>
          <button
            className={`btn${mode === "tutorial" ? " btn-primary" : " btn-ghost"}`}
            onClick={() => setMode("tutorial")}
          >
            Tutorial passo a passo
          </button>
          <button
            className={`btn${mode === "faq" ? " btn-primary" : " btn-ghost"}`}
            onClick={() => setMode("faq")}
          >
            Buscar artigos
          </button>
        </div>
      </div>

      {/* ── MODO TUTORIAL ── */}
      {mode === "tutorial" && (
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 24px 48px" }}>
          {/* Barra de progresso */}
          <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "20px 0 24px" }}>
            <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
              Etapa {tutStep + 1} de {TUTORIAL_STEPS.length}
            </span>
            {TUTORIAL_STEPS.map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1, height: 3, borderRadius: 99,
                  background: i < tutStep ? "var(--primary)" : i === tutStep ? "var(--primary-light)" : "var(--border)",
                  transition: "background 0.3s",
                }}
              />
            ))}
          </div>

          {/* Card principal */}
          <div className="panel" style={{ marginBottom: 16, overflow: "hidden" }}>
            {/* Cabeçalho */}
            <div style={{ padding: "20px 24px 0" }}>
              <div style={{
                display: "inline-block", fontSize: 11, fontWeight: 700, padding: "3px 10px",
                borderRadius: 99, marginBottom: 12,
                background: badgeStyle.bg, color: badgeStyle.color,
              }}>
                {step.badge}
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 6 }}>{step.title}</h2>
              <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 20, lineHeight: 1.6 }}>{step.desc}</p>
            </div>

            {/* Ilustração */}
            <div style={{ borderTop: "1px solid var(--border)", background: "var(--surface-muted)" }}>
              {step.renderIllus()}
            </div>

            {/* Sub-steps (campos do serviço) */}
            {step.subSteps && (
              <>
                <div style={{ padding: "16px 24px 4px" }}>
                  <p style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Clique em cada campo para saber mais
                  </p>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "8px 24px 12px" }}>
                  {step.subSteps.map((ss, i) => (
                    <button
                      key={ss.label}
                      onClick={() => setSubStep(i)}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        fontSize: 12, fontWeight: 600, padding: "6px 14px",
                        borderRadius: 99, cursor: "pointer", transition: "all 0.15s",
                        border: i === subStep ? "1px solid var(--primary)" : "1px solid var(--border)",
                        background: i === subStep ? "var(--primary-ghost)" : "var(--surface)",
                        color: i === subStep ? "var(--primary-hover)" : "var(--text-secondary)",
                      }}
                    >
                      {ss.label}
                    </button>
                  ))}
                </div>
                <div style={{
                  margin: "0 24px 20px", padding: "14px 16px",
                  borderRadius: 8, background: "var(--surface-muted)",
                  border: "1px solid var(--border)", fontSize: 13,
                  color: "var(--text-secondary)", lineHeight: 1.6,
                  minHeight: 60,
                }}>
                  <div dangerouslySetInnerHTML={{ __html: step.subSteps[subStep].detail }} />
                </div>
              </>
            )}

            {/* Regras de horários */}
            {step.rules && (
              <>
                <div style={{ padding: "4px 24px 8px" }}>
                  <p style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Regras de horários — clique para entender
                  </p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "0 24px 12px" }}>
                  {step.rules.map((r, i) => (
                    <button
                      key={r.title}
                      onClick={() => setActiveRule(i)}
                      style={{
                        padding: 14, borderRadius: 8, textAlign: "left", cursor: "pointer",
                        border: i === activeRule ? "1px solid var(--primary)" : "1px solid var(--border)",
                        background: i === activeRule ? "var(--primary-ghost)" : "var(--surface-muted)",
                        transition: "all 0.15s",
                      }}
                    >
                      <div style={{ color: i === activeRule ? "var(--primary)" : "var(--muted)", marginBottom: 8 }}>{r.icon}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: i === activeRule ? "var(--primary-hover)" : "var(--text)", marginBottom: 4 }}>{r.title}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.4 }}>{r.desc}</div>
                    </button>
                  ))}
                </div>
                <div style={{
                  margin: "0 24px 20px", padding: "14px 16px",
                  borderRadius: 8, background: "var(--surface-muted)",
                  border: "1px solid var(--border)", fontSize: 13,
                  color: "var(--text-secondary)", lineHeight: 1.6,
                }}>
                  <div dangerouslySetInnerHTML={{ __html: step.rules[activeRule].detail }} />
                </div>
              </>
            )}

            {/* Tabs de agenda */}
            {step.agendaTabs && (
              <>
                <div style={{ display: "flex", gap: 4, padding: "0 24px", marginBottom: 12, overflowX: "auto" }}>
                  {step.agendaTabs.map((t, i) => (
                    <button
                      key={t.label}
                      onClick={() => setActiveTab(i)}
                      style={{
                        fontSize: 12, fontWeight: 600, padding: "7px 14px",
                        borderRadius: 8, border: "none", cursor: "pointer",
                        whiteSpace: "nowrap", transition: "all 0.15s",
                        background: i === activeTab ? "var(--surface-muted)" : "transparent",
                        color: i === activeTab ? "var(--text)" : "var(--muted)",
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <div style={{
                  margin: "0 24px 20px", padding: "14px 16px",
                  borderRadius: 8, background: "var(--surface-muted)",
                  border: "1px solid var(--border)", fontSize: 13,
                  color: "var(--text-secondary)", lineHeight: 1.6,
                }}>
                  <div dangerouslySetInnerHTML={{ __html: step.agendaTabs[activeTab].detail }} />
                </div>
              </>
            )}

            {/* Aviso */}
            {step.warn && (
              <div style={{
                margin: "0 24px 16px", padding: "12px 14px",
                borderRadius: 8, background: "#fef3c7", border: "1px solid #fcd34d",
                fontSize: 13, color: "#92400e", display: "flex", gap: 10, alignItems: "flex-start",
              }}>
                <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                <span dangerouslySetInnerHTML={{ __html: step.warn }} />
              </div>
            )}

            {/* Sucesso */}
            {step.success && (
              <div style={{
                margin: "0 24px 16px", padding: "12px 14px",
                borderRadius: 8, background: "#dcfce7", border: "1px solid #86efac",
                fontSize: 13, color: "#166534", display: "flex", gap: 10, alignItems: "flex-start",
              }}>
                <Check size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{step.success}</span>
              </div>
            )}

            {/* Tips */}
            <div style={{ padding: "0 24px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
              {step.tips.map((t, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  <span style={{ color: "var(--primary)", marginTop: 1, flexShrink: 0 }}>{t.icon}</span>
                  <span dangerouslySetInnerHTML={{ __html: t.html }} />
                </div>
              ))}
            </div>
          </div>

          {/* Navegação */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button className="btn btn-ghost" onClick={goBack} disabled={tutStep === 0} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <ChevronLeft size={16} /> Anterior
            </button>
            <button className="btn btn-primary" onClick={goNext} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {tutStep === TUTORIAL_STEPS.length - 1 ? "Recomeçar" : "Próxima etapa"}
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── MODO FAQ ── */}
      {mode === "faq" && (
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 24px 48px" }}>
          {/* Busca */}
          <div className="help-search" style={{ maxWidth: 420, margin: "0 auto 28px" }}>
            <Search size={16} />
            <input
              placeholder="Buscar artigos de ajuda..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="help-layout">
            {/* Sidebar */}
            {!search && (
              <aside className="help-nav">
                {HELP_SECTIONS.map((s) => (
                  <button
                    key={s.key}
                    className={`help-nav__item${activeSection === s.key ? " is-on" : ""}`}
                    onClick={() => setActiveSection(s.key)}
                  >
                    <s.icon size={16} />
                    {s.label}
                    {s.badge && (
                      <span className={`help-badge help-badge--${s.badge.toLowerCase()}`}>
                        {s.badge}
                      </span>
                    )}
                    <ChevronRight size={14} className="arr" />
                  </button>
                ))}
              </aside>
            )}

            {/* Artigos */}
            <div className="help-content">
              {filteredSections.map((sec) => (
                <div key={sec.key}>
                  {search && (
                    <h2 className="help-section-label">
                      <sec.icon size={16} /> {sec.label}
                    </h2>
                  )}
                  {sec.articles.map((article) => (
                    <div
                      key={article.title}
                      className={`help-card${expandedArticle === article.title ? " is-open" : ""}`}
                    >
                      <button
                        className="help-card__head"
                        onClick={() =>
                          setExpandedArticle(
                            expandedArticle === article.title ? null : article.title
                          )
                        }
                      >
                        <div>
                          <div className="help-card__title">{article.title}</div>
                          <div className="help-card__desc">{article.desc}</div>
                        </div>
                        <ChevronRight size={16} className="help-card__arr" />
                      </button>
                      {expandedArticle === article.title && (
                        <div className="help-card__body">
                          <ol className="help-steps">
                            {article.steps.map((s, i) => (
                              <li key={i}>
                                <span className="n">{i + 1}</span>
                                <span>{s}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}

              {/* Suporte */}
              <div className="help-support">
                <Mail size={20} />
                <div>
                  <h4>Não encontrou o que procurava?</h4>
                  <p>Nossa equipe responde em até 24h úteis.</p>
                </div>
                <a href="mailto:contato@marcaiflex.com.br" className="btn btn-primary">
                  Falar com suporte
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
