import { MercadoPagoConfig, PreApproval } from "mercadopago";
import type { SubscriptionStatus } from "@prisma/client";
import { ApiError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";

/**
 * Ponto ÚNICO de integração com o Mercado Pago (produto Assinaturas/preapproval).
 * Toda chamada ao SDK deve passar por aqui — não espalhar o SDK pelo código.
 * Funções nomeadas, sem classes, seguindo o padrão de src/lib/services/.
 *
 * Variáveis de ambiente (nunca expor no frontend):
 * - MP_ACCESS_TOKEN: access token (use as credenciais de TESTE primeiro)
 * - MP_WEBHOOK_SECRET: assinatura secreta para validar webhooks (etapa 4.3)
 * - MP_BACK_URL: URL de retorno do checkout (etapa 4.2)
 *
 * NOTA: esta etapa (4.1) é apenas fundação. Checkout (preapproval) e webhook
 * serão implementados nas etapas 4.2/4.3 e usarão getMercadoPagoClient() +
 * mapMpStatus() definidos aqui.
 */

const REQUEST_TIMEOUT_MS = 8_000;

/** Tolerância de cartão recusado: 7 dias em PAST_DUE antes de bloquear o acesso. */
export const PAST_DUE_GRACE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

// ── Config / cliente ──────────────────────────────────────────────

function requireEnv(name: "MP_ACCESS_TOKEN" | "MP_WEBHOOK_SECRET" | "MP_BACK_URL"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Mercado Pago não configurado: defina ${name}.`);
  }
  return value;
}

export function getMercadoPagoWebhookSecret(): string {
  return requireEnv("MP_WEBHOOK_SECRET");
}

export function getMercadoPagoBackUrl(): string {
  return requireEnv("MP_BACK_URL");
}

let cachedClient: MercadoPagoConfig | null = null;

/**
 * Inicializa (uma vez) e retorna o cliente do SDK a partir do MP_ACCESS_TOKEN.
 * Lazy: só lê o env e constrói quando realmente for usar o MP, para não quebrar
 * build/test quando a credencial não está presente.
 */
export function getMercadoPagoClient(): MercadoPagoConfig {
  if (!cachedClient) {
    cachedClient = new MercadoPagoConfig({
      accessToken: requireEnv("MP_ACCESS_TOKEN"),
      options: { timeout: REQUEST_TIMEOUT_MS }
    });
  }
  return cachedClient;
}

// ── Mapeamento de status MP -> status interno (PURO, testável) ─────

export type MpEventKind = "preapproval" | "payment";

export type MpStatusMapping = {
  /** Status interno a ser aplicado na CompanySubscription. */
  status: SubscriptionStatus;
  /** Empurrar currentPeriodEnd para frente (pagamento recorrente aprovado). */
  advancePeriod: boolean;
  /** Entrou em atraso: marcar pastDueSince (início da régua de 7 dias). */
  markPastDue: boolean;
  /** Voltou a ficar em dia: limpar pastDueSince. */
  clearPastDue: boolean;
};

/**
 * Traduz um evento do Mercado Pago para o efeito interno na assinatura.
 * Função PURA — será usada pelo webhook na etapa 4.3. Retorna `null` para
 * status que não exigem mudança (ex.: "pending", "in_process", desconhecidos),
 * para o webhook simplesmente ignorar com segurança.
 *
 * Transições cobertas:
 * - preapproval "authorized"     -> ACTIVE   (assinatura ativa; limpa atraso)
 * - preapproval "cancelled"      -> CANCELLED
 * - preapproval "paused"         -> PAST_DUE (marca início do atraso)
 * - payment recorrente "approved"-> ACTIVE   (+ empurra currentPeriodEnd)
 * - payment "rejected"           -> PAST_DUE (marca início do atraso)
 * - payment "cancelled"          -> CANCELLED
 * - payment "refunded"/"charged_back" -> PAST_DUE (marca início do atraso)
 */
export function mapMpStatus(kind: MpEventKind, mpStatus: string): MpStatusMapping | null {
  const status = (mpStatus ?? "").toLowerCase().trim();

  if (kind === "preapproval") {
    switch (status) {
      case "authorized":
        return { status: "ACTIVE", advancePeriod: false, markPastDue: false, clearPastDue: true };
      case "cancelled":
        return { status: "CANCELLED", advancePeriod: false, markPastDue: false, clearPastDue: false };
      case "paused":
        return { status: "PAST_DUE", advancePeriod: false, markPastDue: true, clearPastDue: false };
      default:
        return null;
    }
  }

  // kind === "payment" (cobrança recorrente do preapproval)
  switch (status) {
    case "approved":
      return { status: "ACTIVE", advancePeriod: true, markPastDue: false, clearPastDue: true };
    case "rejected":
      return { status: "PAST_DUE", advancePeriod: false, markPastDue: true, clearPastDue: false };
    case "cancelled":
      return { status: "CANCELLED", advancePeriod: false, markPastDue: false, clearPastDue: false };
    case "refunded":
    case "charged_back":
      return { status: "PAST_DUE", advancePeriod: false, markPastDue: true, clearPastDue: false };
    default:
      return null;
  }
}

// ── Régua dos 7 dias de PAST_DUE (PURO, testável) ─────────────────

/** Momento em que o período de tolerância (7 dias) termina. */
export function pastDueDeadline(pastDueSince: Date): Date {
  return new Date(pastDueSince.getTime() + PAST_DUE_GRACE_DAYS * DAY_MS);
}

/**
 * A tolerância de cartão recusado já estourou? `true` => deve bloquear o acesso.
 * Dentro dos 7 dias retorna `false` (ainda ativo). Sem pastDueSince => não
 * bloqueia por este motivo.
 */
export function isPastDueGraceExpired(pastDueSince: Date | null | undefined, now: Date = new Date()): boolean {
  if (!pastDueSince) return false;
  return now.getTime() >= pastDueDeadline(pastDueSince).getTime();
}

// ── Criação da assinatura recorrente (preapproval) ────────────────

export type CreateSubscriptionInput = {
  /** Plan.id interno (não o slug). */
  planId: string;
  companyId: string;
  /** Token do cartão gerado no FRONT. Nunca recebemos PAN/CVV. */
  cardTokenId: string;
  payerEmail: string;
};

export type CreateSubscriptionResult = {
  preapprovalId: string;
  status: string;
  subscriptionId: string;
  payerEmail: string;
};

/**
 * Converte erros do MP em mensagens amigáveis, SEM vazar detalhes internos.
 * Importante: nunca recebemos dados de cartão (só o token), então não há PAN/CVV
 * para vazar; ainda assim evitamos ecoar o erro bruto do MP para o cliente.
 */
function toFriendlyMpError(error: unknown): ApiError {
  const raw =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : "";
  const lower = raw.toLowerCase();

  if (lower.includes("card") || lower.includes("token") || lower.includes("cvv") || lower.includes("payment_method")) {
    return new ApiError(402, "Não foi possível autorizar o cartão. Confira os dados ou tente outro cartão.");
  }
  // Log enxuto para diagnóstico (sem dados sensíveis — não os temos).
  console.error("[MercadoPago] Falha ao criar preapproval.");
  return new ApiError(502, "Falha ao processar o pagamento. Tente novamente em instantes.");
}

/**
 * Cria a assinatura recorrente no Mercado Pago (POST /preapproval) a partir do
 * Plan interno e do card_token gerado no front. Cobrança mensal em BRL.
 * `external_reference` = id da CompanySubscription, para o webhook (4.3) amarrar
 * a confirmação. NÃO ativa a assinatura internamente — isso é papel do webhook.
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

  const preapproval = new PreApproval(getMercadoPagoClient());

  let response;
  try {
    response = await preapproval.create({
      body: {
        reason: `AgendaFlex — Plano ${plan.name}`,
        external_reference: subscription.id,
        payer_email: input.payerEmail,
        card_token_id: input.cardTokenId,
        status: "authorized",
        back_url: getMercadoPagoBackUrl(),
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: amount,
          currency_id: "BRL"
        }
      }
    });
  } catch (error) {
    throw toFriendlyMpError(error);
  }

  if (!response?.id) {
    throw new ApiError(502, "Não foi possível criar a assinatura no Mercado Pago. Tente novamente.");
  }

  return {
    preapprovalId: response.id,
    status: response.status ?? "pending",
    subscriptionId: subscription.id,
    payerEmail: input.payerEmail
  };
}
