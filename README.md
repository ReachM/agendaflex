<div align="center">
  <img src="https://via.placeholder.com/150/0f172a/5eead4?text=MarcaiFlex" alt="MarcaiFlex Logo" width="120" height="120" style="border-radius: 20px;" />
  
  <h1>MarcaiFlex SaaS</h1>
  <p><strong>A Plataforma Definitiva de Agendamentos e Gestão para Empresas</strong></p>

  <p>
    <a href="#funcionalidades">Funcionalidades</a> •
    <a href="#tecnologias">Tecnologias</a> •
    <a href="#arquitetura-multi-tenant">Arquitetura</a> •
    <a href="#planos-e-recursos">Planos</a> •
    <a href="#como-rodar">Como Rodar</a>
  </p>
</div>

---

O **MarcaiFlex** evoluiu de um sistema básico de agendamento para um **SaaS Multi-tenant robusto e escalável**. Projetado para atender desde profissionais autônomos até grandes clínicas e oficinas, o MarcaiFlex oferece uma gestão completa de múltiplos serviços, fluxo de caixa, emissão de notas fiscais, checklists dinâmicos e páginas públicas de agendamento. Tudo isso garantindo **isolamento total de dados por empresa** e conformidade com a LGPD.

## ✨ Funcionalidades Principais

- 🏢 **Multi-Tenant Nativo:** Isolamento total de dados. Cada empresa (Tenant) possui seus próprios clientes, serviços, agendamentos e profissionais.
- 💳 **Planos SaaS (Tiered Subscriptions):** Controle de acesso a funcionalidades via planos (Starter, Pro, Max) utilizando um poderoso `Plan Guard`.
- 📅 **Agendamentos Multi-Serviço:** Os clientes podem agendar vários serviços em uma única sessão. Os preços são salvos como *snapshots* para garantir integridade financeira histórica.
- 💰 **Módulo Financeiro (Max):** Controle de caixa, despesas, ticket médio, análise de clientes fiéis e relatórios de receita por mês e por serviço.
- 📄 **Notas Fiscais:** Fluxo de solicitação, aprovação e emissão de notas fiscais integrado.
- ✅ **Checklists de Atendimento:** Criação de checklists personalizados para documentar etapas do atendimento, ideal para oficinas e clínicas.
- 🌐 **Página de Agendamento Pública:** Cada empresa ganha uma página pública otimizada em SEO para clientes agendarem serviços diretamente, com validação de conflitos em tempo real.
- 🎨 **Campos Personalizados:** Crie campos customizados dinâmicos para Clientes, Serviços, Profissionais e Agendamentos.
- 🔒 **Segurança e LGPD:** Role-Based Access Control (RBAC), logs de auditoria detalhados e middlewares de segurança robustos.

---

## 🛠️ Tecnologias

O projeto utiliza um stack moderno focado em performance, tipagem forte e developer experience:

- **Framework:** [Next.js 15](https://nextjs.org/) (App Router)
- **Linguagem:** [TypeScript](https://www.typescriptlang.org/)
- **Banco de Dados:** PostgreSQL
- **ORM:** [Prisma](https://www.prisma.io/)
- **Estilização:** CSS Vanilla Premium (Design System customizado com variáveis CSS)
- **Ícones:** [Lucide React](https://lucide.dev/)
- **Autenticação e Segurança:** JWT, bcrypt, CSRF protection e Rate Limiting
- **Validação:** [Zod](https://zod.dev/)

---

## 🏗️ Arquitetura Multi-Tenant e Segurança

A arquitetura do MarcaiFlex garante que os dados de uma empresa jamais vazem para outra. 

1. **Contexto Autenticado:** Todas as operações do backend passam por `requireTenant`, que injeta o `companyId` autenticado diretamente na camada de acesso a dados. Nunca confiamos no `companyId` enviado pelo frontend.
2. **Plan Guard:** Acesso a rotas e ações (como acessar o módulo financeiro ou criar checklists) é protegido pelo `requirePlanFeature`. O sistema valida em tempo real se a assinatura da empresa contempla o recurso requisitado.
3. **Auditoria:** Ações destrutivas e alterações sensíveis geram registros automáticos de auditoria (quem fez, o que fez, quando, IP e User-Agent).

---

## 📦 Planos e Recursos (SaaS Model)

| Funcionalidade | Starter | Pro | Max |
| :--- | :---: | :---: | :---: |
| **Limite de Agendamentos/mês** | 100 | 500 | Ilimitado |
| **Página Pública de Agendamento** | ❌ | ✅ | ✅ |
| **Multi-Serviços por Agendamento**| ❌ | ✅ | ✅ |
| **Módulo Financeiro e DRE** | ❌ | ❌ | ✅ |
| **Checklists de Atendimento** | ❌ | ❌ | ✅ |
| **Solicitação de Notas Fiscais** | ❌ | ❌ | ✅ |
| **Relatórios Avançados** | Básico | Avançado | Completo |

---

## 🚀 Como Rodar Localmente

### Pré-requisitos
- Node.js 18+
- PostgreSQL rodando localmente ou via Docker

### Passos para Instalação

1. **Clone o repositório e instale as dependências:**
   ```bash
   git clone https://github.com/ReachM/agendaflex
   cd agendaflex
   npm install
   ```
   *(No Windows, se houver restrições de script, use `npm.cmd install`)*

2. **Configure as Variáveis de Ambiente:**
   Copie o arquivo de exemplo e edite a string de conexão do banco.
   ```bash
   cp .env.example .env
   ```

3. **Suba o Banco de Dados (opcional via Docker):**
   ```bash
   docker compose up -d
   ```

4. **Prepare o Banco de Dados:**
   Gere as tabelas e povoe o banco com os dados iniciais, planos SaaS e empresas de teste.
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

5. **Inicie o Servidor de Desenvolvimento:**
   ```bash
   npm run dev
   ```
   Acesse a aplicação em `http://localhost:3000`.

---

## 🔑 Credenciais de Teste (Geradas pelo Seed)

Após rodar o seed, o sistema já conta com algumas contas de teste pré-configuradas:

- **Super Administrador (Master):** `admin@marcaiflex.com` / `Admin@123456`
- **Inquilino Plano Starter:** `admin@clinicavida.com` / `Admin@123456`
- **Inquilino Plano Pro:** `admin@salaobella.com` / `Admin@123456`
- **Inquilino Plano Max:** `admin@oficinacentral.com` / `Admin@123456`

> **Aviso:** Mude essas credenciais imediatamente caso suba a aplicação para um ambiente de produção!

---

## 🧪 Testes

A suíte de testes valida a lógica de multi-tenancy, o RBAC (Role-Based Access Control) e a aplicação dos limites dos planos (Plan Guard).

Para rodar os testes:
```bash
npm run test
```

---

## ⏰ Lembretes automáticos do Bot (agendador interno)

Os lembretes de agendamento via WhatsApp (Evolution API) são disparados por um
**agendador interno em `node-cron`** que roda **dentro do próprio processo Next**
(`next start`) — não há Vercel Cron, cron do sistema, nem endpoint externo.

**Como sobe com o container:**

1. O Next executa `src/instrumentation.ts` (hook `register()`) **uma vez** no
   bootstrap do servidor.
2. O agendador só é ativado quando `NEXT_RUNTIME === "nodejs"` **e**
   `NODE_ENV === "production"` (ou seja, no `next start` do container). Em
   desenvolvimento (`next dev`) ele fica desligado para não duplicar com o
   hot-reload. Uma flag global (`globalThis`) garante uma única instância por
   processo.
3. A cada **15 minutos** o cron chama `processReminders()`
   ([src/lib/services/bot-reminder.ts](src/lib/services/bot-reminder.ts)), que
   varre os agendamentos `SCHEDULED` nas janelas de **24h** e **2h**.
4. Um lembrete só é enviado se: `Company.botEnabled` = true, o plano tem
   `allowBotIntegration`, a janela está ligada em `reminderConfig`, e ainda **não
   existe** `SentReminder(appointmentId, type)`. Após o envio, grava-se o
   `SentReminder` — o `@@unique(appointmentId, type)` garante **zero duplicado**.

**Pré-requisitos de ambiente** (ver `.env.example`): `EVOLUTION_API_URL`,
`EVOLUTION_API_KEY` e `WHATSAPP_WEBHOOK_TOKEN`.

> **Escala horizontal:** o agendador vive no processo Node. Se você rodar
> **múltiplas réplicas** do container, cada réplica terá seu próprio cron. A
> duplicidade de **mensagens** continua barrada pelo `SentReminder` (idempotência
> no banco), mas se quiser apenas um disparador, rode o cron em uma única
> réplica/worker dedicado.

A lógica é **testável sem o cron**: basta chamar
`processReminders({ now, intervalMinutes })` com uma data fixa.

---

<div align="center">
  <p>Construído com ❤️ e dedicação à excelência em arquitetura de software.</p>
</div>
