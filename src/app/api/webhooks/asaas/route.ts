import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/security/rate-limit";
import { getRequestIp } from "@/lib/security/request";
import { mapAsaasStatus, parseAsaasWebhook, validateAsaasWebhook } from "@/lib/services/asaas";

/**
 * Webhook do Asaas — ÚNICA fonte de verdade para ativar/renovar/bloquear a
 * assinatura. Rota PÚBLICA (sem requireTenant), igual ao webhook do WhatsApp.
 *
 * Garantias:
 * - Autenticidade: compara o header "asaas-access-token" com ASAAS_WEBHOOK_TOKEN.
 *   Asaas não assina o payload com HMAC; o segredo compartilhado é o mecanismo
 *   oficial. Sem isso, qualquer um forjaria "pagamento aprovado".
 * - Idempotência: cada notificação vira um PaymentEvent (gatewayEventId @unique).
 *   Asaas reenvia em caso de erro — processar 2x ativaria em duplicidade.
 * - Estado pelo payload: Asaas envia o estado completo do recurso no corpo
 *   (diferente do MP), então não precisamos consultar a API para confirmar.
 * - Responde 200 rápido nos casos tratados; 500 só em erro inesperado (Asaas
 *   reenvia automaticamente).
 */

const LOG_PREFIX = "[Webhook Asaas]";

function addOneMonth(base: Date): Date {
  const next = new Date(base);
  next.setMonth(next.getMonth() + 1);
  return next;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function POST(request: NextRequest) {
  try {
    rateLimit(`asaas-webhook:${getRequestIp(request)}`, 600, 60 * 1000);

    if (!process.env.ASAAS_WEBHOOK_TOKEN) {
      console.error(`${LOG_PREFIX} ASAAS_WEBHOOK_TOKEN não configurado.`);
      return NextResponse.json({ error: "Webhook não configurado." }, { status: 500 });
    }

    // 1) Autenticidade — header "asaas-access-token" deve bater com o token configurado.
    if (!validateAsaasWebhook(request)) {
      console.warn(`${LOG_PREFIX} token inválido — ignorando.`);
      return NextResponse.json({ error: "Token inválido." }, { status: 401 });
    }

    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }

    // 2) Extrai os campos relevantes (kind, event, status, ids).
    const resource = parseAsaasWebhook(body);
    if (!resource) {
      return NextResponse.json({ received: true, ignored: "evento não tratado" }, { status: 200 });
    }

    // 3) Idempotência forte: Asaas pode mandar a notificação várias vezes.
    //    Usa body.id se vier; senão monta composto (event + recurso) — Asaas não
    //    garante um event id em todos os eventos.
    const gatewayEventId = String(body.id ?? `${resource.event}:${resource.resourceId}`);
    const seen = await prisma.paymentEvent.findUnique({
      where: { gatewayEventId },
      select: { id: true }
    });
    if (seen) {
      return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
    }

    // 4) Localiza a assinatura: externalReference = CompanySubscription.id,
    //    com fallback para gatewaySubscriptionId.
    let subscription =
      resource.externalReference
        ? await prisma.companySubscription.findUnique({ where: { id: resource.externalReference } })
        : null;
    if (!subscription && resource.gatewaySubscriptionId) {
      subscription = await prisma.companySubscription.findFirst({
        where: { gatewaySubscriptionId: resource.gatewaySubscriptionId }
      });
    }
    if (!subscription) {
      console.warn(`${LOG_PREFIX} assinatura não encontrada para o evento ${resource.event}.`);
      return NextResponse.json(
        { received: true, ignored: "assinatura não encontrada" },
        { status: 200 }
      );
    }

    const mapping = mapAsaasStatus(resource.event, resource.status);
    const now = new Date();
    const current = subscription;

    // 5) Transação: grava o evento (idempotência forte) e aplica o estado.
    try {
      await prisma.$transaction(async (tx) => {
        await tx.paymentEvent.create({
          data: {
            subscriptionId: current.id,
            gatewayEventId,
            gatewayResourceId: resource.resourceId || gatewayEventId,
            type: resource.kind,
            status: resource.status || "unknown",
            rawType: resource.event
          }
        });

        if (!mapping) return; // evento sem efeito (apenas auditado).

        const updates: Prisma.CompanySubscriptionUpdateInput = { status: mapping.status };
        if (mapping.clearPastDue) updates.pastDueSince = null;
        // Marca o início do atraso só se ainda não estava marcado (preserva a régua).
        if (mapping.markPastDue) updates.pastDueSince = current.pastDueSince ?? now;
        if (mapping.advancePeriod) {
          const base =
            current.currentPeriodEnd && current.currentPeriodEnd > now ? current.currentPeriodEnd : now;
          updates.currentPeriodEnd = addOneMonth(base);
        }
        if (resource.kind === "payment") {
          if (resource.paymentId) updates.lastPaymentId = resource.paymentId;
          updates.lastPaymentStatus = resource.status;
        }

        await tx.companySubscription.update({ where: { id: current.id }, data: updates });
      });
    } catch (error) {
      // Corrida com um reenvio simultâneo: PaymentEvent duplicado -> já processado.
      if (isUniqueViolation(error)) {
        return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
      }
      throw error;
    }

    console.log(
      `${LOG_PREFIX} processado: ${resource.event} -> ${mapping?.status ?? "sem efeito"}.`
    );
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    // 500 faz o Asaas reenviar — preferível a perder o evento silenciosamente.
    return handleApiError(error);
  }
}
