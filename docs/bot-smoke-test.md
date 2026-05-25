# Smoke test — Bot WhatsApp (in-process / Evolution API)

Roteiro reprodutível para validar o bot **manualmente em ambiente local**, sem
enviar nenhuma mensagem real de WhatsApp. Cobre o webhook
`POST /api/webhooks/whatsapp/<companyId>`, a confirmação/cancelamento, FAQ,
fluxo de agendamento, lembretes e os casos negativos de segurança.

> **Nada de produção é alterado.** Os artefatos são só de teste:
> `scripts/smoke-webhook.ts` (dispara os webhooks) e `scripts/mock-evolution.mjs`
> (captura o envio de saída).

---

## ⚠️ Contas do seed (mapeamento real)

O `prisma/seed.ts` define (autoritativo — confira se tiver dúvida):

| Empresa | slug | Plano | Login |
| --- | --- | --- | --- |
| Clínica Vida | `clinica-vida` | **Pro** | `admin@clinicavida.com` |
| Oficina Central | `oficina-central` | **Max** | `admin@oficinacentral.com` |
| Salão Bella | `salao-bella` | **Starter** | `admin@salaobella.com` |

Senha de todos: `Admin@123456`.

> Atenção: alguns lugares (README antigo) trocam esse mapeamento. O bot só ativa
> em planos com `allowBotIntegration` (**Pro/Max**). Este roteiro usa a
> **Oficina Central (Max)**, porque ela já vem com um agendamento **SCHEDULED
> futuro** no seed (cliente *Carlos Roberto*, `(11) 98888-2000` →
> `5511988882000`), ideal para confirmar/cancelar. Use o **Salão Bella (Starter)**
> se quiser ver o bloqueio por plano.

---

## 1. Variáveis de ambiente

Copie o exemplo e edite o `.env` (NÃO commite segredos):

```bash
cp .env.example .env
```

Relevantes para o bot (já existem no `.env.example`):

| Variável | Para o smoke test |
| --- | --- |
| `EVOLUTION_API_URL` | Aponte para o **mock de captura** (ver seção 6), ex.: `http://localhost:4000`. Assim nada vai para o WhatsApp real. |
| `EVOLUTION_API_KEY` | Qualquer placeholder (o mock ignora). **Nunca** ponha a chave real em arquivo versionado. |
| `WHATSAPP_WEBHOOK_TOKEN` | Token secreto do webhook. O mesmo valor vai no header `x-webhook-token`. Defina um valor (ex.: `troque-por-um-token-aleatorio`). |

`DATABASE_URL` já vem apontando para o Postgres do `docker-compose.yml` (porta `5433`).

---

## 2. Subir banco + migrate + seed

```bash
docker compose up -d            # Postgres em localhost:5433
npx prisma migrate deploy       # aplica as migrations (NÃO use migrate dev — ver nota)
npx prisma generate
npm run db:seed                 # cria empresas, planos, clientes e agendamentos
```

> **Nota (drift de migrations):** num banco **novo** o `migrate deploy` aplica tudo
> limpo. Evite `prisma migrate dev` neste projeto — o histórico está atrás do banco
> e o `dev` pede um reset destrutivo.

Suba a aplicação:

```bash
npm run dev                     # http://localhost:3000
```

---

## 3. Ativar e configurar o bot para a empresa Pro/Max

1. Acesse `http://localhost:3000` e faça login como **`admin@oficinacentral.com` / `Admin@123456`** (plano **Max**).
2. Vá em **Configurações → Bot WhatsApp** (`/configuracoes/bot`).
3. Configure:
   - **Ligar o bot** (switch on → grava `Company.botEnabled = true`).
   - **Instância do WhatsApp**: um nome, ex.: `oficina-central`. **Guarde esse valor** — ele tem que bater com o `instance` do payload e com a `SMOKE_INSTANCE` do script.
   - **Permitir que o bot crie agendamentos** (allowBooking): **ligado** para o caso (e); **desligado** para o caso (f).
   - **FAQ**: adicione ao menos um item, ex.: pergunta `Qual o horário de funcionamento?`, resposta `Seg a Sex, das 8h às 18h.` (usado no caso (d)).
   - **Salvar**.

> Em dev o **agendador de lembretes (node-cron) fica desligado** de propósito (só
> sobe em produção via `next start`). A seção 5 mostra como disparar os lembretes
> manualmente.

### Descobrir o `companyId`

O webhook usa o **id** (cuid) da empresa, não o slug. Pegue de um destes jeitos:

- **Prisma Studio**: `npx prisma studio` → tabela `Company` → copie o `id` da *Oficina Central*; **ou**
- **API** (já logado no navegador): abra `http://localhost:3000/api/auth/me` e copie `company.id`.

### Apontar o webhook da sua instância Evolution (para teste com WhatsApp real, depois)

Na sua Evolution API, configure o webhook da instância para:

- **URL**: `https://SEU_APP/api/webhooks/whatsapp/<companyId>`
- **Header**: `x-webhook-token: <WHATSAPP_WEBHOOK_TOKEN>`
- **Evento**: `messages.upsert`

Para este smoke test **não precisa** de Evolution real — o script da seção 4 simula esses POSTs.

---

## 4. Rodando o smoke test (sem WhatsApp real)

Defina as variáveis e rode o script. Ele monta o payload **real** da Evolution
(`messages.upsert` com `data.key.remoteJid`, `data.message.conversation` etc.).

PowerShell (Windows):

```powershell
$env:SMOKE_COMPANY_ID="cole-o-companyId-aqui"
$env:SMOKE_INSTANCE="oficina-central"   # igual ao configurado na tela
# WHATSAPP_WEBHOOK_TOKEN é lido do .env automaticamente
npx tsx scripts/smoke-webhook.ts all
```

bash:

```bash
SMOKE_COMPANY_ID="cole-o-companyId-aqui" SMOKE_INSTANCE="oficina-central" \
  npx tsx scripts/smoke-webhook.ts all
```

Cenários individuais:

| Comando | Caso |
| --- | --- |
| `npx tsx scripts/smoke-webhook.ts security` | (g) sem token, token errado, instância errada, `fromMe=true` |
| `npx tsx scripts/smoke-webhook.ts confirm` | (a) `"1"` confirma agendamento SCHEDULED |
| `npx tsx scripts/smoke-webhook.ts cancel` | (b) `"2"` cancela agendamento SCHEDULED |
| `npx tsx scripts/smoke-webhook.ts nopending` | (c) `"1"/"2"` sem agendamento → "não encontrei…" |
| `npx tsx scripts/smoke-webhook.ts faq` | (d) pergunta que casa com o FAQ |
| `npx tsx scripts/smoke-webhook.ts book-start` | (e) início do fluxo (allowBooking on) |
| `npx tsx scripts/smoke-webhook.ts book-disabled` | (f) agendar com allowBooking off → recusa amigável |
| `npx tsx scripts/smoke-webhook.ts all` | conjunto seguro: g + c + d + fallback + e |

**Ordem importa em (a)/(b):** o agendamento SCHEDULED do seed é único. `confirm`
o leva a CONFIRMED; rode `npm run db:seed` antes de testar `cancel`.

### O que o script mostra (e o que NÃO mostra)

- A **resposta HTTP** do webhook é sempre `200 {"received":true}` para mensagens
  processadas (ou `{"received":true,"ignored":true}` quando ignora). Os casos de
  segurança retornam `401`/`403` de verdade.
- A **resposta do bot (texto)** NÃO vem no corpo HTTP — ela é enviada via
  `sendTextMessage` para a Evolution. Para vê-la, use a **captura de saída**
  (seção 6) ou os **logs** (seção 5). O script imprime, em cada caso, a resposta
  esperada para você comparar.

---

## 5. Como inspecionar o resultado

### Logs do servidor (terminal do `npm run dev`)

Procure pelos prefixos:

- `[Bot WhatsApp]` — webhook: `mensagem recebida company=… phone=*** chars=…`,
  `agendamento confirmado`, `agendamento cancelado`, `falha de envio`, `uso sem plano`.
- `[Bot Booking]` — fluxo de agendamento: `agendamento criado company=… appointment=…`,
  conflito, falha.
- `[Bot Reminder]` — lembretes: `enviado …`, `falha …`, `ciclo concluído …`.

> Os logs **mascaram o telefone** (`***8888`) e não imprimem o texto da mensagem —
> por isso o texto da resposta é verificado na captura de saída (seção 6).

### Banco de dados (Prisma Studio: `npx prisma studio`)

- **Confirmar/cancelar**: tabela `Appointment` → o registro do cliente alvo deve
  mudar `status` de `SCHEDULED` para `CONFIRMED` (caso a) ou `CANCELLED` com
  `canceledAt` preenchido (caso b).
- **Início de fluxo (e)**: tabela `BotConversationState` → deve aparecer uma linha
  para `(companyId, phone)` com `step = AWAITING_SERVICE`. Ao concluir o fluxo, ela
  é apagada e nasce um `Appointment` com `source = BOT`, `status = SCHEDULED`.

### Lembretes + `SentReminder`

O cron não roda em dev; dispare manualmente. O seed cria um agendamento
SCHEDULED para amanhã (Oficina Central), então perto da janela de 24h o lembrete
sai. Com o bot ativo (botEnabled + plano + `reminderConfig` ligado) e a instância
configurada:

```bash
npx tsx -e "import('./src/lib/services/bot-reminder').then(m=>m.processReminders().then(r=>console.log('resultado:',r)))"
```

(ou aponte um `now`/intervalo: `processReminders({ now: new Date('2026-05-25T09:00:00'), intervalMinutes: 15 })`).

Verifique:

- O **mock** (seção 6) deve capturar o envio do lembrete.
- Tabela `SentReminder` → uma linha `(appointmentId, type)` (`"24h"` ou `"2h"`).
- Rodar de novo **não duplica** (idempotência pela unique `(appointmentId, type)`).

---

## 6. Verificar o envio de saída SEM mandar WhatsApp real

O bot responde via `sendTextMessage` →
`POST {EVOLUTION_API_URL}/message/sendText/{instance}` com header `apikey` e body
`{ number, text }`. Para inspecionar isso sem WhatsApp real, aponte
`EVOLUTION_API_URL` para um **capturador**:

### Opção A — mock local (recomendado)

```bash
node scripts/mock-evolution.mjs        # sobe em http://localhost:4000
```

No `.env`: `EVOLUTION_API_URL="http://localhost:4000"` e reinicie o `npm run dev`.

Ao rodar os cenários, o terminal do mock mostra, para cada resposta do bot:

```
────────── Evolution OUT capturada ──────────
POST /message/sendText/oficina-central
rota /message/sendText/{instance}? SIM ✅
header apikey presente? SIM ✅
body: {"number":"5511988882000","text":"✅ Agendamento confirmado! ..."}
  → number: 5511988882000
  → text:   ✅ Agendamento confirmado! ...
```

Confira: **path** `/message/sendText/<instance>`, **header `apikey`** presente, e
**body** `{ number, text }` com o telefone e o texto da resposta esperada.

### Opção B — webhook.site (zero setup)

1. Abra https://webhook.site e copie a URL única.
2. `.env`: `EVOLUTION_API_URL="https://webhook.site/<seu-id>"` e reinicie o `npm run dev`.
3. Cada resposta do bot aparece como uma requisição nova: confira method `POST`,
   path terminando em `/message/sendText/<instance>`, header `apikey` e o body JSON
   `{ number, text }`.

> Tanto o mock quanto o webhook.site respondem `200`, então o bot considera o envio
> bem-sucedido. Se `EVOLUTION_API_URL` estiver errado ou a `whatsappInstance` não
> estiver configurada, o webhook ainda responde `200 {received:true}`, mas os logs
> mostram `[Bot WhatsApp] falha de envio …` — útil para diagnosticar.

---

## 7. Fluxo de agendamento ponta a ponta (automatizado)

O `scripts/smoke-booking-flow.ts` percorre a conversa de agendamento inteira
contra a **Oficina Central (Max)**, enviando as mensagens em sequência e lendo o
banco (via Prisma) entre os passos. Ele descobre a empresa pelo slug
`oficina-central` e usa a `whatsappInstance` que você configurou (não precisa
passar `companyId` nem `instance`).

> **Como ele escolhe serviço/horário:** entre os passos, o script lê
> `BotConversationState.context` (que o bot persiste) para saber as **opções reais**
> que o bot ofertou — e escolhe entre elas. Assim o horário agendado é
> comprovadamente **um dos ofertados pelo sistema, nunca inventado**.

### Pré-requisitos

- Banco no ar + seed aplicado (seção 2).
- Bot **ativado** para a Oficina Central em `/configuracoes/bot`: `botEnabled` on,
  `whatsappInstance` preenchida, **allowBooking ON** (para o cenário positivo).
- `WHATSAPP_WEBHOOK_TOKEN` no `.env` **e o servidor reiniciado** com esse valor.
- (Opcional, recomendado) `scripts/mock-evolution.mjs` rodando, para ver os textos
  de resposta. Mesmo sem o mock, o agendamento é criado no banco — o envio apenas
  falha e é logado como `[Bot WhatsApp] falha de envio`.

### Rodar

```bash
npx tsx scripts/smoke-booking-flow.ts all        # positivo + negativo
npx tsx scripts/smoke-booking-flow.ts positive   # só o fluxo feliz
npx tsx scripts/smoke-booking-flow.ts negative    # só o sub-cenário allowBooking=false
```

Telefones de teste (sobrescrevíveis por env `SMOKE_POS_PHONE` / `SMOKE_NEG_PHONE`):
`5511970000001` (positivo) e `5511970000002` (negativo).

### Idempotência

Antes de cada execução o script **limpa** o cliente de teste, seus agendamentos
(cascade em `AppointmentService`/`SentReminder`) e o `BotConversationState` daquele
número — então pode rodar quantas vezes quiser. Se quiser limpar manualmente:
`npx prisma studio` → apague a linha de `BotConversationState` com o `phone` de
teste (e, se quiser, o cliente/agendamentos correspondentes).

### Como interpretar

Cada passo imprime **enviado → HTTP**, o **step lido do banco**, e ✅/❌ por
verificação. No fim, um resumo e o **exit code** (0 = tudo passou).

**Positivo** valida as transições e a criação:

1. `"quero agendar"` → `step = AWAITING_SERVICE`, bot ofertou `serviceOptions`.
2. escolhe o serviço (1º real ofertado) → `step = AWAITING_DATE`, `serviceId` gravado.
3. informa data (tenta dias úteis até haver vaga) → `step = AWAITING_SLOT`, `slotOptions` reais.
4. escolhe o 1º horário → `step = AWAITING_NAME` (cliente novo).
5. informa o nome → `BotConversationState` removido + `Appointment` criado com
   `source = BOT`, `status = SCHEDULED`, `startAt` **igual ao horário escolhido** e
   **pertencente ao conjunto ofertado** no passo 3.

**Negativo** (sub-cenário): o script grava `allowBooking = false` temporariamente
(restaura no fim, via `try/finally`), envia `"quero agendar"` de outro número e
verifica que **não** avançou o step e **não** criou `Appointment` (a recusa
amigável sai na captura).

> Para conferir o texto de confirmação/recusa, olhe o terminal do mock
> (`scripts/mock-evolution.mjs`) — o corpo HTTP do webhook continua sendo só
> `{received:true}`.

---

## Resumo do "esperado" por cenário

| Caso | HTTP | Resposta do bot (na captura/logs) | Efeito no banco |
| --- | --- | --- | --- |
| (a) `"1"` confirma | `200 {received:true}` | `✅ Agendamento confirmado! …` | `SCHEDULED → CONFIRMED` |
| (b) `"2"` cancela | `200 {received:true}` | `Agendamento cancelado. …` | `SCHEDULED → CANCELLED` |
| (c) `"1"/"2"` sem agendamento | `200 {received:true}` | `Não encontrei nenhum agendamento pendente para este número.` | — |
| (d) FAQ | `200 {received:true}` | a resposta configurada | — |
| (e) `agendar` (on) | `200 {received:true}` | `Vamos agendar! 📅 Escolha o serviço…` | cria `BotConversationState` |
| (f) `agendar` (off) | `200 {received:true}` | `O agendamento pelo WhatsApp está desativado…` | — |
| (g1) sem token | `401` | — | — |
| (g2) token errado | `401` | — | — |
| (g3) instância errada | `403` | — | — |
| (g4) `fromMe=true` | `200 {received:true,ignored:true}` | (nenhuma — ignorado) | — |
