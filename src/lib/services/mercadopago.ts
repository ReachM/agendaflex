import crypto from "crypto";
import fs from "fs";
import path from "path";
import type { SubscriptionStatus } from "@prisma/client";
import { ApiError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";

/**
 * Ponto ÚNICO de integração com o Mercado Pago (assinaturas recorrentes via
 * /preapproval — fluxo REDIRECT). Toda chamada à API do MP deve passar por aqui.
 *
 * Variáveis de ambiente (NUNCA expor no frontend):
 * - MP_ACCESS_TOKEN:   access token do MP (formato APP_USR-... ou TEST-...).
 * - MP_WEBHOOK_SECRET: segredo configurado no painel do MP — usado para validar
 *                      o header `x-signature` dos webhooks.
 * - MP_BACK_URL:       URL absoluta para a qual o MP redireciona o cliente após
 *                      autorizar/cancelar a assinatura.
 */

const REQUEST_TIMEOUT_MS = 8_000;
const MP_API_BASE = "https://api.mercadopago.com";

/**
 * Lê o .env manualmente caso process.env não tenha as variáveis do MP.
 * Next.js em produção (sob PM2) NÃO carrega .env em runtime para rotas de API —
 * esse fallback garante que as chaves existam. Idêntico ao que existia no
 * asaas.ts; sem isso o checkout cai em "MP não configurado" em produção.
 */
export function loadEnvIfNeeded(): void {
  if (process.env.MP_ACCESS_TOKEN) return;
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
    // silencioso — o erro aparece abaixo quando MP_ACCESS_TOKEN for undefined.
  }
}

// Régua de 7 dias vive em módulo PURO (sem SDK / sem fetch). Re-exportada aqui
// para quem importa de "@/lib/services/mercadopago".
export { PAST_DUE_GRACE_DAYS, pastDueDeadline, isPastDueGraceExpired } from "@/lib/payments/grace";

// ── Config / cliente ──────────────────────────────────────────────

export type MpClient = {
  accessToken: string;
  baseUrl: string;
};

/**
 * Lê o token a CADA chamada (sem cache) — sob PM2 a função pode ser chamada
 * ANTES das envs estarem carregadas. Cache aqui arrisca servir uma chave
 * fantasma se a env aparecer depois.
 */
export function getClient(): MpClient {
  loadEnvIfNeeded();
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("Mercado Pago não configurado: defina MP_ACCESS_TOKEN.");
  }
  return { accessToken, baseUrl: MP_API_BASE };
}

async function mpFetch(endpoint: string, init?: RequestInit): Promise<Response> {
  const client = getClient();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${client.baseUrl}${endpoint}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${client.accessToken}`,
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

async function readMpError(response: Response): Promise<string> {
  try {
    const body = (await response.clone().json()) as { message?: string; error?: string };
    if (body?.message) return String(body.message);
    if (body?.error) return String(body.error);
  } catch {
    // ignora
  }
  return `HTTP ${response.status}`;
}

// ── Subscription (fluxo REDIRECT via /preapproval) ────────────────

export type CreateSubscriptionInput = {
  /** Plan.id interno (não o slug). */
  planId: string;
  companyId: string;
  payerEmail: string;
  payerName: string;
};

export type CreateSubscriptionResult = {
  /** ID interno da CompanySubscription. */
  subscriptionId: string;
  /** ID da preapproval no MP. */
  gatewaySubscriptionId: string;
  /** MP não retorna um customer id na criação da preapproval — fica vazio. */
  gatewayCustomerId: string;
  /** init_point: URL para o front redirecionar (página de autorização do MP). */
  checkoutUrl: string;
  payerEmail: string;
};

type MpPreapprovalResponse = {
  id?: string;
  init_point?: string;
  sandbox_init_point?: string;
};

/**
 * Cria uma assinatura no MP (POST /preapproval, status=pending).
 *
 * Por que `status: "pending"`:
 *   sem um `card_token_id` o MP exige que o cliente autorize o pagamento na
 *   página dele — `init_point` é onde mandamos o usuário. A assinatura SÓ vira
 *   `authorized` quando o cliente conclui a autorização e o MP nos avisa via
 *   webhook (subscription_preapproval / authorized). Fonte de verdade do
 *   status: webhook.
 *
 * external_reference = CompanySubscription.id — o webhook usa esse campo para
 * amarrar o evento à assinatura interna.
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

  loadEnvIfNeeded();
  const backUrl = process.env.MP_BACK_URL;
  if (!backUrl) {
    throw new ApiError(500, "Mercado Pago não configurado: defina MP_BACK_URL.");
  }

  const payerEmail = input.payerEmail.trim().toLowerCase();
  if (!payerEmail) throw new ApiError(400, "E-mail do pagador é obrigatório.");

  const body = {
    reason: `MarcaiFlex — Plano ${plan.name}`,
    auto_recurring: {
      frequency: 1,
      frequency_type: "months" as const,
      transaction_amount: amount,
      currency_id: "BRL" as const
    },
    payer_email: payerEmail,
    back_url: backUrl,
    status: "pending" as const,
    external_reference: subscription.id
  };

  let preapproval: MpPreapprovalResponse;
  try {
    const create = await mpFetch(`/preapproval`, {
      method: "POST",
      body: JSON.stringify(body)
    });
    if (!create.ok) {
      console.error(`[MP] Falha ao criar preapproval: ${await readMpError(create)}`);
      throw new ApiError(502, "Falha ao iniciar o pagamento. Tente novamente em instantes.");
    }
    preapproval = (await create.json()) as MpPreapprovalResponse;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error("[MP] Erro inesperado ao criar preapproval.");
    throw new ApiError(502, "Falha ao iniciar o pagamento. Tente novamente em instantes.");
  }

  const gatewaySubscriptionId = preapproval.id ?? "";
  if (!gatewaySubscriptionId) {
    console.error("[MP] Preapproval criada sem id.");
    throw new ApiError(502, "Falha ao iniciar o pagamento. Tente novamente em instantes.");
  }

  // init_point > sandbox_init_point. Ambos vêm preenchidos quando o token é de
  // teste; em produção só vem `init_point`.
  const checkoutUrl = preapproval.init_point || preapproval.sandbox_init_point || "";
  if (!checkoutUrl) {
    console.error("[MP] Preapproval criada sem init_point.");
    throw new ApiError(502, "Falha ao gerar o link de pagamento.");
  }

  return {
    subscriptionId: subscription.id,
    gatewaySubscriptionId,
    gatewayCustomerId: "",
    checkoutUrl,
    payerEmail
  };
}

// ── Mapeamento de status do MP -> efeito interno ──────────────────

export type MpEventKind = "payment" | "preapproval";

export type MpStatusMapping = {
  status: SubscriptionStatus;
  advancePeriod: boolean;
  markPastDue: boolean;
  clearPastDue: boolean;
};

/**
 * Traduz um evento do MP para o efeito interno na assinatura. Função PURA —
 * usada pelo webhook. Retorna `null` para eventos que não exigem mudança
 * (preapproval pending, payment in_process etc.), para o webhook registrar
 * o evento (auditoria/idempotência) sem alterar a CompanySubscription.
 *
 * Mapeamento:
 * - preapproval status="authorized"                          -> ACTIVE
 * - preapproval status="cancelled" | "paused" | "finished"   -> CANCELLED
 * - payment status="approved"                                -> ACTIVE
 * - payment status="rejected" | "cancelled" | "charged_back" -> PAST_DUE
 * - outros (pending, in_process, ...) -> null (sem efeito)
 */
export function mapMpStatus(kind: MpEventKind, status: string | null | undefined): MpStatusMapping | null {
  const s = (status ?? "").toLowerCase().trim();
  if (!s) return null;

  if (kind === "preapproval") {
    if (s === "authorized") {
      return { status: "ACTIVE", advancePeriod: true, markPastDue: false, clearPastDue: true };
    }
    if (s === "cancelled" || s === "paused" || s === "finished") {
      return { status: "CANCELLED", advancePeriod: false, markPastDue: false, clearPastDue: false };
    }
    return null;
  }

  // kind === "payment"
  if (s === "approved") {
    return { status: "ACTIVE", advancePeriod: true, markPastDue: false, clearPastDue: true };
  }
  if (s === "rejected" || s === "cancelled" || s === "charged_back") {
    return { status: "PAST_DUE", advancePeriod: false, markPastDue: true, clearPastDue: false };
  }
  return null;
}

// ── Webhook: validação por assinatura HMAC ────────────────────────

type HasHeaders = { headers: { get(name: string): string | null } };

/**
 * Valida a autenticidade do webhook do MP via header `x-signature`.
 *
 * Formato do header:   `ts=<unix-ts>,v1=<hex>`
 * Manifest assinado:   `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 * Hash:                HMAC-SHA256(MP_WEBHOOK_SECRET, manifest) em hex
 *
 * Comparação em tempo constante. Sem o `MP_WEBHOOK_SECRET` configurado a
 * função retorna `false` — fail-closed.
 */
export function validateWebhookSignature(request: HasHeaders, body: unknown): boolean {
  loadEnvIfNeeded();
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return false;

  const sigHeader = request.headers.get("x-signature");
  const requestId = request.headers.get("x-request-id");
  if (!sigHeader || !requestId) return false;

  // Quebra "ts=...,v1=..." em pares.
  let ts = "";
  let v1 = "";
  for (const part of sigHeader.split(",")) {
    const [k, ...rest] = part.split("=");
    const key = (k ?? "").trim();
    const value = rest.join("=").trim();
    if (key === "ts") ts = value;
    else if (key === "v1") v1 = value;
  }
  if (!ts || !v1) return false;

  // data.id: o MP usa o campo do body. Aceita tanto string quanto number.
  const dataId = extractDataId(body);
  if (!dataId) return false;

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

  // Comparação em tempo constante — protege contra ataques de timing.
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(v1, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function extractDataId(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const b = body as Record<string, unknown>;
  const data = b.data;
  if (data && typeof data === "object") {
    const id = (data as Record<string, unknown>).id;
    if (id != null) return String(id);
  }
  return "";
}

// ── Webhook: extração + consulta canônica do estado ───────────────

export type MpWebhookEvent = {
  kind: MpEventKind;
  /** ID do recurso afetado (payment id ou preapproval id). */
  resourceId: string;
};

/**
 * Extrai (kind, resourceId) do payload de notificação do MP. O MP manda só
 * `type` + `data.id` no webhook — para descobrir status e external_reference
 * é preciso consultar a API (ver `fetchPreapproval` / `fetchPayment`).
 *
 * Tipos suportados:
 * - "subscription_preapproval"           -> kind="preapproval"
 * - "subscription_authorized_payment"    -> kind="payment"
 * - "payment"                            -> kind="payment"
 */
export function parseMpWebhook(body: unknown): MpWebhookEvent | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const type = String(b.type ?? b.topic ?? "").toLowerCase().trim();
  const resourceId = extractDataId(body);
  if (!type || !resourceId) return null;

  if (type === "subscription_preapproval") {
    return { kind: "preapproval", resourceId };
  }
  if (type === "subscription_authorized_payment" || type === "payment") {
    return { kind: "payment", resourceId };
  }
  return null;
}

export type MpPreapproval = {
  id: string;
  status: string;
  external_reference: string | null;
};

export type MpPayment = {
  id: string;
  status: string;
  external_reference: string | null;
  /** Preapproval associada — preenchido quando o pagamento veio de uma assinatura. */
  preapprovalId: string | null;
  /** Valor efetivamente cobrado (usado para calcular a comissão do influencer). */
  transactionAmount: number | null;
};

/** GET /preapproval/{id} — consulta canônica do estado da assinatura. */
export async function fetchPreapproval(id: string): Promise<MpPreapproval | null> {
  const res = await mpFetch(`/preapproval/${encodeURIComponent(id)}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    console.error(`[MP] Falha ao consultar preapproval ${id}: HTTP ${res.status}`);
    return null;
  }
  const data = (await res.json()) as Record<string, unknown>;
  return {
    id: String(data.id ?? id),
    status: String(data.status ?? ""),
    external_reference: data.external_reference != null ? String(data.external_reference) : null
  };
}

/** GET /v1/payments/{id} — consulta canônica do estado do pagamento. */
export async function fetchPayment(id: string): Promise<MpPayment | null> {
  const res = await mpFetch(`/v1/payments/${encodeURIComponent(id)}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    console.error(`[MP] Falha ao consultar payment ${id}: HTTP ${res.status}`);
    return null;
  }
  const data = (await res.json()) as Record<string, unknown>;
  const amount = Number(data.transaction_amount);
  return {
    id: String(data.id ?? id),
    status: String(data.status ?? ""),
    external_reference: data.external_reference != null ? String(data.external_reference) : null,
    preapprovalId: data.preapproval_id != null ? String(data.preapproval_id) : null,
    transactionAmount: Number.isFinite(amount) ? amount : null
  };
}
