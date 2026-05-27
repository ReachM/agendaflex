import { NextRequest } from "next/server";
import { ApiError, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { rateLimit } from "@/lib/security/rate-limit";
import { createSubscription } from "@/lib/services/asaas";
import { subscriptionCheckoutSchema } from "@/lib/validation/schemas";

/**
 * Inicia a assinatura recorrente no Asaas — fluxo REDIRECT.
 *
 * skipSubscriptionCheck: true — o cliente com trial VENCIDO precisa conseguir
 * pagar; esta é a única escrita liberada mesmo bloqueado.
 *
 * NENHUM dado de cartão passa por aqui: criamos a assinatura no Asaas com
 * billingType=UNDEFINED e o cliente é redirecionado para a página de pagamento
 * do Asaas, onde escolhe o método (cartão / pix / boleto). A ativação definitiva
 * (status ACTIVE) é feita pelo WEBHOOK (fonte de verdade) — aqui só vinculamos
 * a assinatura e o customer.
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
      select: { id: true, gatewaySubscriptionId: true }
    });
    if (!subscription) throw new ApiError(404, "Assinatura da empresa não encontrada.");

    // Idempotência: já existe uma assinatura vinculada -> não cria outra.
    if (subscription.gatewaySubscriptionId) {
      throw new ApiError(
        409,
        "Esta empresa já possui uma assinatura. Não é necessário assinar novamente."
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
      /** URL para o front redirecionar o cliente (página de pagamento do Asaas). */
      checkoutUrl: result.checkoutUrl,
      message: "Assinatura criada. Conclua o pagamento na página do Asaas."
    });
  } catch (error) {
    return handleApiError(error);
  }
}
