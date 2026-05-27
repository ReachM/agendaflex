import fs from "fs";
import path from "path";
import type { SubscriptionStatus } from "@prisma/client";
import { ApiError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";

/**
 * Lê o .env manualmente caso process.env não tenha as variáveis do Asaas.
 * Next.js em produção (especialmente sob PM2) NÃO carrega .env em runtime para
 * rotas de API — esse fallback garante que as chaves existam.
 */
export function loadEnvIfNeeded(): void {
  if (process.env.ASAAS_API_KEY) return; // já está no env, ok
  try {
    const envPath = path.join(process.cwd(), ".env");
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx < 0) continue;
      const key = trimmed.substring(0, idx).trim();
      let value = trimmed.substring(idx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (key && !process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // silencioso — o erro será capturado abaixo quando ASAAS_API_KEY for undefined
  }
}

// Régua de 7 dias vive em módulo PURO (sem SDK / sem fetch). Re-exportada aqui
// para quem importa de "@/lib/services/asaas".
export { PAST_DUE_GRACE_DAYS, pastDueDeadline, isPastDueGraceExpired } from "@/lib/payments/grace";

/**
 * Ponto ÚNICO de integração com o Asaas (assinaturas recorrentes).
 * Toda chamada à API do Asaas deve passar por aqui — não espalhar fetch pelo
 * código. Funções nomeadas, sem classes, seguindo o padrão de src/lib/services/.
 *
 * Variáveis de ambiente (nunca expor no frontend):
 * - ASAAS_API_KEY:       $aact_... (sandbox começa com $aact_YTU...)
 * - ASAAS_WEBHOOK_TOKEN: token definido por nós e configurado no painel Asaas;
 *                        comparado contra o header "asaas-access-token".
 * - ASAAS_SANDBOX:       "true" usa sandbox; "false" produção. Default: true.
 */

const REQUEST_TIMEOUT_MS = 8_000;
const ASAAS_API_BASE_SANDBOX = "https://sandbox.asaas.com/api/v3";
const ASAAS_API_BASE_PROD = "https://www.asaas.com/api/v3";

// ── Config / cliente ──────────────────────────────────────────────

export type AsaasClient = {
  apiKey: string;
  baseUrl: string;
  sandbox: boolean;
};

/**
 * Lê config a CADA chamada (sem cache) — em PM2/Ubuntu o processo pode chegar a
 * tocar essa função ANTES das envs estarem carregadas (ver instrumentation.ts).
 * Como a config aqui é barata de montar, não vale a pena cachear e arriscar
 * servir uma key fantasma se a env reaparecer depois.
 */
export function getAsaasClient(): AsaasClient {
  loadEnvIfNeeded(); // garante que o .env foi lido
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) {
    throw new Error("Asaas não configurado: defina ASAAS_API_KEY.");
  }
  // Default seguro: sandbox. Só vai para produção se ASAAS_SANDBOX=false explícito.
  const sandbox = String(process.env.ASAAS_SANDBOX ?? "true").toLowerCase() !== "false";
  return {
    apiKey,
    baseUrl: sandbox ? ASAAS_API_BASE_SANDBOX : ASAAS_API_BASE_PROD,
    sandbox
  };
}

async function asaasFetch(endpoint: string, init?: RequestInit): Promise<Response> {
  const client = getAsaasClient();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${client.baseUrl}${endpoint}`, {
      ...init,
      headers: {
        access_token: client.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init?.headers ?? {})
      },
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

async function readAsaasError(response: Response): Promise<string> {
  // Tenta ler { errors: [{ description }] } sem vazar pro cliente.
  try {
    const body = (await response.clone().json()) as { errors?: Array<{ description?: string }> };
    const first = body?.errors?.[0]?.description;
    if (first) return String(first);
  } catch {
    // ignora
  }
  return `HTTP ${response.status}`;
}

// ── Customer ──────────────────────────────────────────────────────

export type CreateOrGetCustomerInput = {
  name: string;
  email: string;
  cpfCnpj?: string;
};

type AsaasCustomerResponse = {
  id?: string;
  data?: Array<{ id?: string }>;
};

/**
 * Busca um cliente do Asaas pelo email; se não existir, cria.
 * Retorna o `id` do cliente (formato `cus_...`). Não persiste em lugar nenhum —
 * a responsabilidade de guardar `gatewayCustomerId` em CompanySubscription é
 * de `createSubscription()` (ponto único de escrita).
 */
export async function createOrGetCustomer(input: CreateOrGetCustomerInput): Promise<{ id: string }> {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new ApiError(400, "E-mail do pagador é obrigatório.");

  // 1) GET /customers?email=
  const search = await asaasFetch(`/customers?email=${encodeURIComponent(email)}&limit=1`);
  if (search.ok) {
    const list = (await search.json()) as AsaasCustomerResponse;
    const existing = list.data?.[0]?.id;
    if (existing) return { id: existing };
  } else {
    console.warn(`[Asaas] Falha ao consultar cliente por e-mail (status ${search.status}).`);
  }

  // 2) POST /customers — cria novo
  const createBody: Record<string, unknown> = { name: input.name, email };
  if (input.cpfCnpj) createBody.cpfCnpj = input.cpfCnpj;

  const created = await asaasFetch(`/customers`, {
    method: "POST",
    body: JSON.stringify(createBody)
  });
  if (!created.ok) {
    console.error(`[Asaas] Falha ao criar cliente: ${await readAsaasError(created)}`);
    throw new ApiError(502, "Falha ao criar cliente no Asaas. Tente novamente.");
  }
  const customer = (await created.json()) as AsaasCustomerResponse;
  if (!customer.id) {
    console.error("[Asaas] Resposta de criação de cliente sem id.");
    throw new ApiError(502, "Falha ao criar cliente no Asaas.");
  }
  return { id: customer.id };
}

// ── Subscription (fluxo REDIRECT) ─────────────────────────────────

export type CreateSubscriptionInput = {
  /** Plan.id interno (não o slug). */
  planId: string;
  companyId: string;
  payerEmail: string;
  payerName: string;
  cpfCnpj?: string;
};

export type CreateSubscriptionResult = {
  /** ID interno da CompanySubscription. */
  subscriptionId: string;
  /** ID da assinatura no Asaas (formato `sub_...`). */
  gatewaySubscriptionId: string;
  /** ID do cliente no Asaas (formato `cus_...`). */
  gatewayCustomerId: string;
  /** URL para o front redirecionar (página de pagamento Asaas, multi-método). */
  checkoutUrl: string;
  payerEmail: string;
};

function todayPlusOneISO(): string {
  // Asaas exige nextDueDate >= hoje no fuso local. Usamos amanhã (UTC) com folga
  // segura para qualquer fuso BR (UTC-2/-3). Não formatamos com toLocaleString
  // para evitar locale-dependência.
  const next = new Date();
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

type AsaasSubscriptionResponse = {
  id?: string;
  paymentLink?: string;
};

type AsaasPaymentsListResponse = {
  data?: Array<{ id?: string; invoiceUrl?: string; bankSlipUrl?: string }>;
};

/**
 * Cria assinatura no Asaas (fluxo REDIRECT — Opção A):
 *   1) busca/cria o Customer
 *   2) POST /subscriptions com billingType="UNDEFINED" (deixa o cliente escolher
 *      o método na página do Asaas: cartão / pix / boleto)
 *   3) lê a URL de pagamento — preferência: `paymentLink` da própria assinatura;
 *      fallback: `invoiceUrl` da primeira cobrança gerada (`GET /subscriptions/{id}/payments`).
 *
 * NÃO ativamos a assinatura aqui — fonte de verdade do status é o WEBHOOK.
 * `externalReference` = CompanySubscription.id, para o webhook amarrar a confirmação.
 */
export async function createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
  const plan = await prisma.plan.findFirst({ where: { id: input.planId, isActive: true } });
  if (!plan) throw new ApiError(400, "Plano inválido ou indisponível.");

  const amount = Number(plan.price);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, "Este plano não está disponível para assinatura paga.");
  }

  const subscription = await prisma.companySubscription.findFirst({
    where: { companyId: input.companyId },
    orderBy: { createdAt: "desc" }
  });
  if (!subscription) throw new ApiError(404, "Assinatura da empresa não encontrada.");

  // 1) Customer
  const customer = await createOrGetCustomer({
    name: input.payerName,
    email: input.payerEmail,
    cpfCnpj: input.cpfCnpj
  });

  // 2) Subscription
  const body = {
    customer: customer.id,
    billingType: "UNDEFINED" as const,
    nextDueDate: todayPlusOneISO(),
    value: amount,
    cycle: "MONTHLY" as const,
    description: `MarcaiFlex — Plano ${plan.name}`,
    externalReference: subscription.id
  };

  let subResponse: AsaasSubscriptionResponse;
  try {
    const create = await asaasFetch(`/subscriptions`, {
      method: "POST",
      body: JSON.stringify(body)
    });
    if (!create.ok) {
      console.error(`[Asaas] Falha ao criar assinatura: ${await readAsaasError(create)}`);
      throw new ApiError(502, "Falha ao iniciar o pagamento. Tente novamente em instantes.");
    }
    subResponse = (await create.json()) as AsaasSubscriptionResponse;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error("[Asaas] Erro inesperado ao criar assinatura.");
    throw new ApiError(502, "Falha ao iniciar o pagamento. Tente novamente em instantes.");
  }

  const gatewaySubscriptionId = subResponse.id ?? "";
  if (!gatewaySubscriptionId) {
    console.error("[Asaas] Assinatura criada sem id.");
    throw new ApiError(502, "Falha ao iniciar o pagamento. Tente novamente em instantes.");
  }

  // 3) Checkout URL
  let checkoutUrl = typeof subResponse.paymentLink === "string" ? subResponse.paymentLink : "";
  if (!checkoutUrl) {
    const payments = await asaasFetch(
      `/subscriptions/${encodeURIComponent(gatewaySubscriptionId)}/payments?limit=1`
    );
    if (payments.ok) {
      const list = (await payments.json()) as AsaasPaymentsListResponse;
      checkoutUrl = list.data?.[0]?.invoiceUrl ?? "";
    }
  }
  if (!checkoutUrl) {
    console.error("[Asaas] Não foi possível obter URL de checkout da assinatura criada.");
    throw new ApiError(502, "Falha ao gerar o link de pagamento.");
  }

  return {
    subscriptionId: subscription.id,
    gatewaySubscriptionId,
    gatewayCustomerId: customer.id,
    checkoutUrl,
    payerEmail: input.payerEmail
  };
}

// ── Mapeamento de eventos do Asaas -> efeito interno ──────────────

export type AsaasEventKind = "payment" | "subscription";

export type AsaasStatusMapping = {
  status: SubscriptionStatus;
  advancePeriod: boolean;
  markPastDue: boolean;
  clearPastDue: boolean;
};

/**
 * Traduz um evento do Asaas para o efeito interno na assinatura. Função PURA —
 * usada pelo webhook. Retorna `null` para eventos que não exigem mudança de
 * estado (ex.: SUBSCRIPTION_CREATED, PAYMENT_DELETED), para o webhook simplesmente
 * registrar o evento (auditoria/idempotência) sem alterar a CompanySubscription.
 *
 * Transições cobertas (conforme régua de PAST_DUE de 7 dias):
 * - PAYMENT_CONFIRMED / PAYMENT_RECEIVED       -> ACTIVE  (limpa pastDueSince, empurra período)
 * - PAYMENT_OVERDUE                            -> PAST_DUE (marca pastDueSince)
 * - SUBSCRIPTION_INACTIVATED / SUBSCRIPTION_DELETED -> CANCELLED
 * - outros (PAYMENT_DELETED, PAYMENT_REFUNDED, SUBSCRIPTION_CREATED, ...) -> null (sem efeito)
 *
 * `paymentStatus` é opcional e ignorado hoje — mantido na assinatura da função
 * para futura desambiguação fina (ex.: distinguir refund parcial de total).
 */
export function mapAsaasStatus(event: string, _paymentStatus?: string | null): AsaasStatusMapping | null {
  void _paymentStatus;
  const e = (event ?? "").toUpperCase().trim();

  switch (e) {
    case "PAYMENT_CONFIRMED":
    case "PAYMENT_RECEIVED":
      return { status: "ACTIVE", advancePeriod: true, markPastDue: false, clearPastDue: true };
    case "PAYMENT_OVERDUE":
      return { status: "PAST_DUE", advancePeriod: false, markPastDue: true, clearPastDue: false };
    case "SUBSCRIPTION_INACTIVATED":
    case "SUBSCRIPTION_DELETED":
      return { status: "CANCELLED", advancePeriod: false, markPastDue: false, clearPastDue: false };
    default:
      return null;
  }
}

// ── Webhook: validação por token ──────────────────────────────────

type HasHeaders = { headers: { get(name: string): string | null } };

/**
 * Valida a autenticidade do webhook do Asaas comparando o header
 * "asaas-access-token" contra ASAAS_WEBHOOK_TOKEN. Constante por design — Asaas
 * não assina o payload com HMAC; o segredo compartilhado é o mecanismo oficial.
 */
export function validateAsaasWebhook(request: HasHeaders): boolean {
  loadEnvIfNeeded(); // garante que o .env foi lido
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!expected) return false;
  const received = request.headers.get("asaas-access-token");
  if (!received) return false;
  // Comparação direta basta — o segredo é um identificador opaco, não há canal
  // para ataque de timing aqui (não comparamos hash de mensagem do usuário).
  return received === expected;
}

// ── Webhook: extração do payload ──────────────────────────────────

export type WebhookResource = {
  kind: AsaasEventKind;
  /** Evento bruto do Asaas (PAYMENT_CONFIRMED, SUBSCRIPTION_DELETED, etc.). */
  event: string;
  /** Status bruto da entidade (CONFIRMED, RECEIVED, OVERDUE, ...) — pode ser vazio. */
  status: string;
  /** ID da assinatura no Asaas, se presente no payload. */
  gatewaySubscriptionId: string | null;
  /** ID do pagamento no Asaas, quando o evento é PAYMENT_*. */
  paymentId: string | null;
  /** Espelha o externalReference (CompanySubscription.id interno). */
  externalReference: string | null;
  /** ID do recurso afetado (paymentId para PAYMENT_*, subscriptionId para SUBSCRIPTION_*). */
  resourceId: string;
};

/**
 * Extrai os campos relevantes do payload de webhook do Asaas. Asaas envia o
 * estado COMPLETO da entidade no corpo da notificação (não exige uma 2ª chamada
 * para confirmar, diferente do que o MP fazia).
 *
 * Estrutura típica:
 * - eventos PAYMENT_*:      { event, payment: { id, subscription, status, ... } }
 * - eventos SUBSCRIPTION_*: { event, subscription: { id, status, ... } }
 */
export function parseAsaasWebhook(body: unknown): WebhookResource | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const event = String(b.event ?? "").toUpperCase().trim();
  if (!event) return null;

  if (event.startsWith("PAYMENT_")) {
    const payment = (b.payment ?? {}) as Record<string, unknown>;
    const paymentId = payment.id != null ? String(payment.id) : null;
    const subId = payment.subscription != null ? String(payment.subscription) : null;
    return {
      kind: "payment",
      event,
      status: String(payment.status ?? ""),
      gatewaySubscriptionId: subId,
      paymentId,
      externalReference: payment.externalReference != null ? String(payment.externalReference) : null,
      resourceId: paymentId ?? subId ?? ""
    };
  }

  if (event.startsWith("SUBSCRIPTION_")) {
    const sub = (b.subscription ?? {}) as Record<string, unknown>;
    const subId = sub.id != null ? String(sub.id) : null;
    return {
      kind: "subscription",
      event,
      status: String(sub.status ?? ""),
      gatewaySubscriptionId: subId,
      paymentId: null,
      externalReference: sub.externalReference != null ? String(sub.externalReference) : null,
      resourceId: subId ?? ""
    };
  }

  return null;
}
