import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/security/rate-limit";
import { getRequestIp } from "@/lib/security/request";
import { fetchWebhookResource, mapMpStatus, validateMpWebhookSignature } from "@/lib/services/mercadopago";

/**
 * Webhook do Mercado Pago — ÚNICA fonte de verdade para ativar/renovar/bloquear
 * a assinatura. Rota PÚBLICA (sem requireTenant), igual ao webhook do WhatsApp.
 *
 * Garantias:
 * - Autenticidade: valida o HMAC do header x-signature com MP_WEBHOOK_SECRET. Sem
 *   isso, qualquer um forjaria "pagamento aprovado".
 * - Idempotência: cada notificação vira um PaymentEvent (mpEventId @unique). O MP
 *   reenvia a mesma notificação várias vezes — processar 2x ativaria em duplicidade.
 * - Estado real: busca o recurso na API do MP (não confia só no corpo).
 * - Responde 200 rápido nos casos tratados; 500 só em erro inesperado (o MP reenvia).
 */

const LOG_PREFIX = "[Webhook MercadoPago]";

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
    rateLimit(`mp-webhook:${getRequestIp(request)}`, 600, 60 * 1000);

    const secret = process.env.MP_WEBHOOK_SECRET;
    if (!secret) {
      console.error(`${LOG_PREFIX} MP_WEBHOOK_SECRET não configurado.`);
      return NextResponse.json({ error: "Webhook não configurado." }, { status: 500 });
    }

    const url = new URL(request.url);
    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }

    const data = (body.data ?? {}) as Record<string, unknown>;
    const type = String(body.type ?? body.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic") ?? "");
    const dataId = String(data.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "");

    // 1) Autenticidade — recalcula o HMAC do x-signature.
    const authentic = validateMpWebhookSignature({
      signatureHeader: request.headers.get("x-signature"),
      requestId: request.headers.get("x-request-id"),
      dataId,
      secret
    });
    if (!authentic) {
      console.warn(`${LOG_PREFIX} assinatura inválida — ignorando.`);
      return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
    }

    if (!dataId) {
      return NextResponse.json({ received: true, ignored: "sem data.id" }, { status: 200 });
    }

    // 2) Idempotência rápida — o MP reenvia a mesma notificação (mesmo id).
    const mpEventId = String(body.id ?? `${type}:${dataId}`);
    const seen = await prisma.paymentEvent.findUnique({ where: { mpEventId }, select: { id: true } });
    if (seen) {
      return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
    }

    // 3) Estado real do recurso (não confiar só no corpo da notificação).
    const resource = await fetchWebhookResource(type, dataId);
    if (!resource) {
      return NextResponse.json({ received: true, ignored: "tipo não tratado" }, { status: 200 });
    }

    // 4) Localizar a assinatura: external_reference = CompanySubscription.id, ou mpPreapprovalId.
    let subscription =
      resource.externalReference
        ? await prisma.companySubscription.findUnique({ where: { id: resource.externalReference } })
        : null;
    if (!subscription && resource.preapprovalId) {
      subscription = await prisma.companySubscription.findFirst({
        where: { mpPreapprovalId: resource.preapprovalId }
      });
    }
    if (!subscription) {
      console.warn(`${LOG_PREFIX} assinatura não encontrada para o recurso notificado.`);
      return NextResponse.json({ received: true, ignored: "assinatura não encontrada" }, { status: 200 });
    }

    const mapping = mapMpStatus(resource.kind, resource.status);
    const now = new Date();
    const current = subscription;

    // 5) Transação: registra o evento (idempotência forte) e aplica o estado.
    try {
      await prisma.$transaction(async (tx) => {
        await tx.paymentEvent.create({
          data: {
            subscriptionId: current.id,
            mpEventId,
            mpResourceId: dataId,
            type: resource.kind,
            status: resource.status || "unknown",
            rawType: type || "unknown"
          }
        });

        if (!mapping) return; // status sem efeito (pending/desconhecido) — só auditado.

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

    console.log(`${LOG_PREFIX} processado: ${resource.kind}/${resource.status} -> ${mapping?.status ?? "sem efeito"}.`);
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    // 500 faz o MP reenviar — preferível a perder o evento silenciosamente.
    return handleApiError(error);
  }
}
