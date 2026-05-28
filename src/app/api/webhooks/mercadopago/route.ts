import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/security/rate-limit";
import { getRequestIp } from "@/lib/security/request";
import {
  fetchPayment,
  fetchPreapproval,
  loadEnvIfNeeded,
  mapMpStatus,
  parseMpWebhook,
  validateWebhookSignature
} from "@/lib/services/mercadopago";

/**
 * Webhook do Mercado Pago — ÚNICA fonte de verdade para ativar/renovar/bloquear
 * a assinatura. Rota PÚBLICA (sem requireTenant), igual ao webhook do WhatsApp.
 *
 * Garantias:
 * - Autenticidade: valida header `x-signature` (HMAC-SHA256 com MP_WEBHOOK_SECRET).
 *   Sem isso, qualquer um forjaria "assinatura autorizada".
 * - Idempotência: cada notificação vira um PaymentEvent (gatewayEventId @unique).
 *   MP reenvia em caso de erro — processar 2x ativaria em duplicidade.
 * - Estado canônico: o body do MP só traz `type` + `data.id`. Consultamos a API
 *   (/preapproval/{id} ou /v1/payments/{id}) para pegar status e external_reference,
 *   evitando confiar em payload manipulável.
 * - Responde 200 rápido; 500 só em erro inesperado (MP reenvia automaticamente).
 */

const LOG_PREFIX = "[Webhook MP]";

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

    loadEnvIfNeeded();

    if (!process.env.MP_WEBHOOK_SECRET) {
      console.error(`${LOG_PREFIX} MP_WEBHOOK_SECRET não configurado.`);
      return NextResponse.json({ error: "Webhook não configurado." }, { status: 500 });
    }

    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }

    // 1) Autenticidade — x-signature precisa bater com HMAC(secret, manifest).
    if (!validateWebhookSignature(request, body)) {
      console.warn(`${LOG_PREFIX} assinatura inválida — ignorando.`);
      return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
    }

    const event = parseMpWebhook(body);
    if (!event) {
      return NextResponse.json({ received: true, ignored: "evento não tratado" }, { status: 200 });
    }

    // 2) Idempotência forte: MP envia "id" no body da notificação. Quando
    //    ausente, monta composto (kind + resourceId).
    const gatewayEventId = String(body.id ?? `${event.kind}:${event.resourceId}`);
    const seen = await prisma.paymentEvent.findUnique({
      where: { gatewayEventId },
      select: { id: true }
    });
    if (seen) {
      return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
    }

    // 3) Consulta canônica do estado na API do MP (ignoramos o body — pode
    //    estar incompleto ou ser falsificado se o secret vazar).
    let status = "";
    let externalReference: string | null = null;
    let gatewaySubscriptionId: string | null = null;
    let paymentId: string | null = null;

    if (event.kind === "preapproval") {
      const pre = await fetchPreapproval(event.resourceId);
      if (!pre) {
        return NextResponse.json(
          { received: true, ignored: "preapproval não encontrada no MP" },
          { status: 200 }
        );
      }
      status = pre.status;
      externalReference = pre.external_reference;
      gatewaySubscriptionId = pre.id;
    } else {
      const pay = await fetchPayment(event.resourceId);
      if (!pay) {
        return NextResponse.json(
          { received: true, ignored: "payment não encontrado no MP" },
          { status: 200 }
        );
      }
      status = pay.status;
      externalReference = pay.external_reference;
      gatewaySubscriptionId = pay.preapprovalId;
      paymentId = pay.id;
    }

    // 4) Localiza a assinatura: external_reference = CompanySubscription.id,
    //    com fallback para gatewaySubscriptionId.
    let subscription =
      externalReference
        ? await prisma.companySubscription.findUnique({ where: { id: externalReference } })
        : null;
    if (!subscription && gatewaySubscriptionId) {
      subscription = await prisma.companySubscription.findFirst({
        where: { gatewaySubscriptionId }
      });
    }
    if (!subscription) {
      console.warn(`${LOG_PREFIX} assinatura não encontrada (${event.kind} ${event.resourceId}).`);
      return NextResponse.json(
        { received: true, ignored: "assinatura não encontrada" },
        { status: 200 }
      );
    }

    const mapping = mapMpStatus(event.kind, status);
    const now = new Date();
    const current = subscription;

    // 5) Transação: grava o evento (idempotência forte) e aplica o estado.
    try {
      await prisma.$transaction(async (tx) => {
        await tx.paymentEvent.create({
          data: {
            subscriptionId: current.id,
            gatewayEventId,
            gatewayResourceId: event.resourceId,
            type: event.kind,
            status: status || "unknown",
            rawType: String(body.type ?? body.topic ?? event.kind)
          }
        });

        if (!mapping) return; // evento sem efeito (apenas auditado).

        const updates: Prisma.CompanySubscriptionUpdateInput = { status: mapping.status };
        if (mapping.clearPastDue) updates.pastDueSince = null;
        if (mapping.markPastDue) updates.pastDueSince = current.pastDueSince ?? now;
        if (mapping.advancePeriod) {
          const base =
            current.currentPeriodEnd && current.currentPeriodEnd > now ? current.currentPeriodEnd : now;
          updates.currentPeriodEnd = addOneMonth(base);
        }
        if (event.kind === "payment") {
          if (paymentId) updates.lastPaymentId = paymentId;
          updates.lastPaymentStatus = status;
        }

        await tx.companySubscription.update({ where: { id: current.id }, data: updates });
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
      }
      throw error;
    }

    console.log(
      `${LOG_PREFIX} processado: ${event.kind} ${status} -> ${mapping?.status ?? "sem efeito"}.`
    );
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}
