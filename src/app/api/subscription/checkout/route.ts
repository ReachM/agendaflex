import { NextRequest } from "next/server";
import { ApiError, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { rateLimit } from "@/lib/security/rate-limit";
import { createSubscription } from "@/lib/services/mercadopago";
import { subscriptionCheckoutSchema } from "@/lib/validation/schemas";

/**
 * Inicia a assinatura recorrente no Mercado Pago — fluxo REDIRECT (Opção A).
 *
 * skipSubscriptionCheck: true — o cliente com trial VENCIDO precisa conseguir
 * pagar; esta é a única escrita liberada mesmo bloqueado.
 *
 * NENHUM dado de cartão passa por aqui: criamos o preapproval com status
 * "pending" e o cliente é redirecionado para o `init_point` (URL do MP) onde
 * digita o cartão e autoriza. A ativação definitiva (status ACTIVE) é feita
 * pelo WEBHOOK (fonte de verdade) — aqui só vinculamos o preapproval.
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
      select: { id: true, mpPreapprovalId: true }
    });
    if (!subscription) throw new ApiError(404, "Assinatura da empresa não encontrada.");

    // Idempotência: já existe um preapproval vinculado -> não cria outro.
    if (subscription.mpPreapprovalId) {
      throw new ApiError(409, "Esta empresa já possui uma assinatura. Não é necessário assinar novamente.");
    }

    const payerEmail = body.payerEmail?.trim().toLowerCase() || context.user.email;

    const result = await createSubscription({
      planId: plan.id,
      companyId: context.companyId,
      payerEmail
    });

    // Vincula o preapproval e o pagador. NÃO viramos status para ACTIVE aqui:
    // a confirmação é do webhook.
    await prisma.companySubscription.update({
      where: { id: result.subscriptionId },
      data: {
        planId: plan.id,
        mpPreapprovalId: result.preapprovalId,
        mpPayerEmail: result.payerEmail
      }
    });

    // Auditoria SEM dados sensíveis (no fluxo redirect nem existe card token).
    await audit(request, context, {
      action: "subscription.checkout",
      entityType: "subscription",
      entityId: result.subscriptionId,
      companyId: context.companyId,
      newValues: { planSlug: plan.slug, preapprovalId: result.preapprovalId, mpStatus: result.status }
    });

    return ok({
      status: "pending_confirmation",
      preapprovalStatus: result.status,
      /** URL para o front redirecionar o cliente (autorização no MP). */
      checkoutUrl: result.initPoint,
      message: "Assinatura criada. Conclua a autorização no Mercado Pago."
    });
  } catch (error) {
    return handleApiError(error);
  }
}
