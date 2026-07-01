import { NextRequest } from "next/server";
import { ApiError, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { rateLimit } from "@/lib/security/rate-limit";
import { redeemCoupon } from "@/lib/services/commissions";
import { createSubscription } from "@/lib/services/mercadopago";
import { subscriptionCheckoutSchema } from "@/lib/validation/schemas";

/**
 * Inicia a assinatura recorrente no Mercado Pago — fluxo REDIRECT.
 *
 * skipSubscriptionCheck: true — o cliente com trial VENCIDO precisa conseguir
 * pagar; esta é a única escrita liberada mesmo bloqueado.
 *
 * NENHUM dado de cartão passa por aqui: criamos a preapproval com status=pending
 * e o cliente é redirecionado para o `init_point` do MP, onde autoriza o
 * pagamento. A ativação definitiva (status ACTIVE) é feita pelo WEBHOOK
 * (fonte de verdade) — aqui só vinculamos a assinatura ao gateway.
 */
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "settings:manage", { skipSubscriptionCheck: true });
    rateLimit(`subscription-checkout:${context.companyId}`, 10, 60 * 1000);

    const body = subscriptionCheckoutSchema.parse(await request.json());

    const plan = await prisma.plan.findFirst({
      where: { slug: body.planSlug, isActive: true },
      select: { id: true, slug: true }
    });
    if (!plan) throw new ApiError(404, "Plano não encontrado ou indisponível.");

    const subscription = await prisma.companySubscription.findFirst({
      where: { companyId: context.companyId },
      orderBy: { createdAt: "desc" },
      select: { id: true, gatewaySubscriptionId: true, status: true }
    });
    if (!subscription) throw new ApiError(404, "Assinatura da empresa não encontrada.");

    // Idempotência: só bloqueia se já existe uma assinatura ATIVA vinculada.
    // Estados TRIALING/EXPIRED/CANCELLED/PAST_DUE (mesmo com gatewaySubscriptionId
    // de uma tentativa anterior) PRECISAM poder iniciar/refazer o checkout —
    // caso contrário o cliente com trial expirado fica preso sem conseguir pagar.
    if (subscription.gatewaySubscriptionId && subscription.status === "ACTIVE") {
      throw new ApiError(
        409,
        "Esta empresa já possui uma assinatura ativa."
      );
    }

    const payerEmail = body.payerEmail?.trim().toLowerCase() || context.user.email;
    const payerName = context.user.name || context.user.email;

    const result = await createSubscription({
      planId: plan.id,
      companyId: context.companyId,
      payerEmail,
      payerName
    });

    // Vincula a assinatura/customer do gateway e o pagador. NÃO viramos status
    // para ACTIVE aqui — confirmação é do webhook.
    await prisma.companySubscription.update({
      where: { id: result.subscriptionId },
      data: {
        planId: plan.id,
        gatewaySubscriptionId: result.gatewaySubscriptionId,
        gatewayCustomerId: result.gatewayCustomerId,
        payerEmail: result.payerEmail
      }
    });

    // Cupom informado no checkout: vincula o tenant ao influencer se ainda não
    // houver vínculo (idempotente). Inválido não bloqueia o checkout.
    if (body.couponCode) {
      try {
        await redeemCoupon(context.companyId, body.couponCode);
      } catch (err) {
        console.error("[Coupon Redeem] falha ao vincular cupom no checkout:", err);
      }
    }

    // Auditoria SEM dados sensíveis (no fluxo redirect nem existe card token).
    await audit(request, context, {
      action: "subscription.checkout",
      entityType: "subscription",
      entityId: result.subscriptionId,
      companyId: context.companyId,
      newValues: {
        planSlug: plan.slug,
        gatewaySubscriptionId: result.gatewaySubscriptionId,
        gatewayCustomerId: result.gatewayCustomerId
      }
    });

    return ok({
      status: "pending_confirmation",
      /** init_point: URL para o front redirecionar (autorização no MP). */
      checkoutUrl: result.checkoutUrl,
      message: "Assinatura criada. Conclua o pagamento na página do Mercado Pago."
    });
  } catch (error) {
    return handleApiError(error);
  }
}
