# Webhook do Mercado Pago (assinaturas)

O webhook é a **única fonte de verdade** para ativar/renovar/bloquear a assinatura.
Endpoint: `POST /api/webhooks/mercadopago` (rota pública, validada por assinatura).

## Fluxo atual — REDIRECT (Opção A)

O checkout vive em duas etapas claras. **Nenhum dado de cartão passa pelo nosso domínio:**

1. **Criação do preapproval (`POST /api/subscription/checkout`)**
   - Front envia apenas `{ planSlug }` (e opcionalmente `payerEmail`).
   - Backend cria o preapproval com `status: "pending"`, `external_reference =
     CompanySubscription.id`, recebe `init_point` (URL do MP) e responde com
     `{ checkoutUrl, status: "pending_confirmation" }`.
   - Backend grava `mpPreapprovalId` na assinatura, mas **não** ativa.
2. **Autorização no Mercado Pago**
   - O front redireciona para `checkoutUrl`. Cliente digita o cartão no ambiente do MP.
   - Após autorizar, MP redireciona o cliente para `MP_BACK_URL`.
3. **Ativação via webhook**
   - O MP envia a notificação → o webhook valida a assinatura, busca o estado real
     na API do MP, aplica `mapMpStatus` e atualiza a assinatura (ver tabela abaixo).

> A Opção B (Brick transparente, com tokenização no front) **não está em uso**.
> Trocar para B no futuro só exige aceitar `cardTokenId` no body do checkout e
> repassar para `createSubscription`; o resto do back-end já é compatível.

## Variáveis de ambiente

No `.env` (use SEMPRE credenciais de **TESTE** primeiro):

```
MP_ACCESS_TOKEN="TEST-..."      # access token (server)
MP_WEBHOOK_SECRET="..."         # "Assinatura secreta" do webhook (NÃO commitar valor real)
MP_BACK_URL="https://marcaiflex.com.br/dashboard"
# Mantida por compatibilidade caso futuramente troquemos para a Opção B (transparente):
NEXT_PUBLIC_MP_PUBLIC_KEY="TEST-..."
```

> O `MP_WEBHOOK_SECRET` é a "assinatura secreta" gerada na configuração do webhook
> no painel do MP — é com ela que recalculamos o HMAC do header `x-signature`.
> Nunca exponha esse valor; mantenha apenas placeholders no `.env.example`.

## Como configurar no painel do Mercado Pago

1. Painel do MP → **Suas integrações** → sua aplicação → **Webhooks**.
2. Em modo de **teste**, informe a URL pública do endpoint:
   `https://SEU-DOMINIO/api/webhooks/mercadopago`
3. Selecione os eventos de **Assinaturas/Planos**:
   - `preapproval` (criação/autorização/cancelamento da assinatura)
   - `subscription_authorized_payment` (cobranças recorrentes)
   - (opcional) `payment`
4. Copie a **Assinatura secreta** exibida e coloque em `MP_WEBHOOK_SECRET`.

## Testando localmente com ngrok

O MP precisa de uma URL pública para entregar a notificação.

```bash
# 1) suba o app
npm run dev

# 2) exponha a porta 3000
ngrok http 3000

# 3) use a URL https do ngrok no painel do MP, ex:
#    https://abcd-1234.ngrok-free.app/api/webhooks/mercadopago
```

Faça um checkout de teste usando os cartões de teste do MP (digitados no
ambiente do MP, após o redirect). Os efeitos esperados:

- `authorized` / pagamento `approved` → **ACTIVE**, limpa `pastDueSince`, empurra
  `currentPeriodEnd` +1 mês, grava `lastPaymentId`/`lastPaymentStatus`;
- pagamento `rejected` → **PAST_DUE** (marca `pastDueSince`); o bloqueio só ocorre
  após **7 dias** de tolerância (régua `isPastDueGraceExpired`);
- preapproval `cancelled` → **CANCELLED**.

## Idempotência

O MP reenvia a mesma notificação várias vezes. Cada uma é registrada em
`PaymentEvent` (`mpEventId @unique`); reenvios são respondidos com `200` sem
reprocessar. Por isso uma cobrança nunca é aplicada em duplicidade.

## Diagnóstico

- Assinatura inválida → `401` (não processa). Confirme `MP_WEBHOOK_SECRET`.
- `200 { ignored: "assinatura não encontrada" }` → o `external_reference`/
  `mpPreapprovalId` não casou com nenhuma `CompanySubscription` (verifique se o
  checkout gravou o `mpPreapprovalId`).
- Os logs usam o prefixo `[Webhook MercadoPago]` e não incluem dados sensíveis.
- Se o erro aparecer no momento do **POST /subscription/checkout** (não no webhook),
  o log do servidor agora detalha a causa com o prefixo `[MercadoPago] Erro
  detalhado:` (motivo real do MP — campo recusado, status, response).
