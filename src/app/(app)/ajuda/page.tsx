"use client";
import { useState } from "react";
import {
  CalendarDays, Users, DollarSign, BarChart,
  Link2, Bot, Search, ChevronRight, BookOpen,
  HelpCircle, Mail
} from "lucide-react";
import "./ajuda.css";

const SECTIONS = [
  {
    key: "inicio",
    label: "Primeiros passos",
    icon: BookOpen,
    articles: [
      {
        title: "Como configurar seu salão",
        desc: "Adicione suas informações, horários de funcionamento e personalize seu link de agendamento.",
        steps: [
          "Acesse Configurações → Perfil da empresa",
          "Preencha nome, CNPJ, endereço e telefone",
          "Vá em Horário de funcionamento e configure os dias e horários",
          "Acesse Link de Agendamento para personalizar a página pública",
        ],
      },
      {
        title: "Adicionando profissionais",
        desc: "Cadastre sua equipe para que os clientes possam escolher com quem querem se atender.",
        steps: [
          "Vá em Profissionais → Adicionar profissional",
          "Preencha nome, especialidade e horário de trabalho",
          "Defina quais serviços cada profissional oferece",
          "Ative a opção 'Visível no agendamento online' se quiser que apareça no link público",
        ],
      },
      {
        title: "Cadastrando seus serviços",
        desc: "Crie categorias e serviços com preços e duração para aparecerem no agendamento.",
        steps: [
          "Vá em Serviços → Nova categoria (ex: Cabelo, Unhas)",
          "Clique em + Novo serviço dentro da categoria",
          "Defina nome, preço e duração em minutos",
          "Ative 'Disponível online' para aparecer no link público",
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
        title: "Criar um agendamento",
        desc: "Adicione manualmente um agendamento para um cliente.",
        steps: [
          "Acesse Agenda → + Novo agendamento",
          "Selecione o cliente (busque pelo nome ou cadastre novo)",
          "Escolha o profissional, serviço e horário disponível",
          "Clique em Salvar — o agendamento aparece na grade",
        ],
      },
      {
        title: "Gerenciar status dos agendamentos",
        desc: "Acompanhe e atualize o status de cada atendimento.",
        steps: [
          "Clique em qualquer agendamento na grade semanal",
          "O painel lateral mostra todos os detalhes",
          "Use 'Finalizar' para marcar como concluído",
          "Use 'Cancelar' para cancelar o atendimento",
        ],
      },
      {
        title: "Filtrar por profissional",
        desc: "Visualize a agenda de um profissional específico.",
        steps: [
          "Na parte superior da agenda, veja os chips coloridos com os nomes",
          "Clique em um chip para mostrar apenas os agendamentos daquele profissional",
          "Clique novamente para desfazer o filtro",
        ],
      },
    ],
  },
  {
    key: "clientes",
    label: "Clientes",
    icon: Users,
    articles: [
      {
        title: "Cadastrar um cliente",
        desc: "Adicione clientes manualmente ao seu cadastro.",
        steps: [
          "Vá em Clientes → + Novo cliente",
          "Preencha nome, telefone e e-mail",
          "Adicione observações importantes (ex: alergias, preferências)",
          "Salve — o cliente aparece na lista",
        ],
      },
      {
        title: "Ver histórico de um cliente",
        desc: "Acesse todo o histórico de atendimentos de um cliente.",
        steps: [
          "Na lista de clientes, clique na linha do cliente",
          "O painel lateral abre com os dados completos",
          "Role para baixo para ver o histórico recente de atendimentos",
          "Clique em 'Ver histórico completo' para visualizar tudo",
        ],
      },
    ],
  },
  {
    key: "link",
    label: "Link de Agendamento",
    icon: Link2,
    articles: [
      {
        title: "Compartilhar seu link público",
        desc: "Deixe clientes agendarem 24h por dia pelo seu link.",
        steps: [
          "Vá em Link de Agendamento no menu lateral",
          "Copie o link (ex: marcaiflex.com.br/agendar/seusalao)",
          "Compartilhe no WhatsApp, Instagram, Google Meu Negócio",
          "Clientes podem agendar sem precisar ligar",
        ],
      },
      {
        title: "Personalizar a página de agendamento",
        desc: "Ajuste as configurações do link público.",
        steps: [
          "Acesse Configurações → Link de Agendamento",
          "Defina antecedência mínima (ex: 1 hora) e máxima (ex: 30 dias)",
          "Escolha se quer aprovar agendamentos manualmente ou automaticamente",
          "Adicione uma mensagem de confirmação personalizada",
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
        desc: "Controle o fluxo de caixa do seu salão.",
        steps: [
          "Vá em Financeiro → + Nova entrada (para receitas)",
          "Ou → + Nova despesa (para gastos como aluguel, produtos)",
          "Preencha valor, categoria e forma de pagamento",
          "Os KPIs do dashboard atualizam automaticamente",
        ],
      },
      {
        title: "Entender o DRE simplificado",
        desc: "Veja a saúde financeira do seu negócio.",
        steps: [
          "O DRE mostra: Receita Bruta → Custos Diretos → Despesas Operacionais → Lucro Líquido",
          "Use o filtro de período (Hoje / Semana / Mês / Ano)",
          "A margem de lucro aparece em porcentagem",
          "Exporte os dados em CSV para sua contabilidade",
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
        desc: "Envie lembretes automáticos para seus clientes via WhatsApp.",
        steps: [
          "Vá em Bot WhatsApp no menu lateral",
          "Conecte seu número escaneando o QR Code",
          "Configure as mensagens de lembrete (24h antes, 2h antes)",
          "O bot dispara automaticamente para todos os agendamentos confirmados",
        ],
      },
      {
        title: "Agendamento via bot",
        desc: "Clientes podem agendar pelo WhatsApp conversando com o bot.",
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
        title: "Analisar desempenho do salão",
        desc: "Use os relatórios para tomar decisões baseadas em dados.",
        steps: [
          "Vá em Relatórios para ver o painel analítico completo",
          "Veja faturamento por dia, semana ou mês",
          "Identifique os serviços mais agendados",
          "Acompanhe a taxa de ocupação dos profissionais",
        ],
      },
      {
        title: "Exportar relatórios prontos",
        desc: "Baixe relatórios em PDF ou Excel com um clique.",
        steps: [
          "Na página de Relatórios, role até 'Relatórios pré-prontos'",
          "Escolha: Fechamento mensal, Comissões da equipe, Clientes VIP, etc.",
          "Clique na seta → para gerar e baixar",
        ],
      },
    ],
  },
];

export default function AjudaPage() {
  const [activeSection, setActiveSection] = useState("inicio");
  const [search, setSearch] = useState("");
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null);

  const section = SECTIONS.find(s => s.key === activeSection)!;

  const filteredSections = search.trim()
    ? SECTIONS.map(s => ({
        ...s,
        articles: s.articles.filter(a =>
          a.title.toLowerCase().includes(search.toLowerCase()) ||
          a.desc.toLowerCase().includes(search.toLowerCase())
        ),
      })).filter(s => s.articles.length > 0)
    : [section];

  return (
    <div className="help-page">
      {/* Header */}
      <div className="help-hero">
        <HelpCircle size={32} className="help-hero__icon" />
        <h1>Central de Ajuda</h1>
        <p>Como podemos ajudar você hoje?</p>
        <div className="help-search">
          <Search size={16} />
          <input
            placeholder="Buscar artigos de ajuda..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="help-layout">
        {/* Sidebar de seções */}
        {!search && (
          <aside className="help-nav">
            {SECTIONS.map(s => (
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
          {filteredSections.map(sec => (
            <div key={sec.key}>
              {search && (
                <h2 className="help-section-label">
                  <sec.icon size={16} /> {sec.label}
                </h2>
              )}
              {sec.articles.map(article => (
                <div
                  key={article.title}
                  className={`help-card${expandedArticle === article.title ? " is-open" : ""}`}
                >
                  <button
                    className="help-card__head"
                    onClick={() => setExpandedArticle(
                      expandedArticle === article.title ? null : article.title
                    )}
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
                        {article.steps.map((step, i) => (
                          <li key={i}>
                            <span className="n">{i + 1}</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}

          {/* Card de suporte */}
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
  );
}
