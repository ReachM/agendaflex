import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Marca uma comissão como paga (grava `paidAt`). Alterna para "paid"; se já
 * estiver paga, é no-op idempotente.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const auth = await requireSuperAdmin(request);
    const { id } = await context.params;

    const body = await request.json().catch(() => ({}));
    const unpay = body?.action === "unpay";

    const commission = await prisma.commissionPayment.update({
      where: { id },
      data: unpay
        ? { status: "pending", paidAt: null }
        : { status: "paid", paidAt: new Date() }
    });

    await audit(request, auth, {
      action: unpay ? "master.commission_unpaid" : "master.commission_paid",
      entityType: "commission_payment",
      entityId: id
    });

    return ok({
      commission: {
        id: commission.id,
        status: commission.status,
        paidAt: commission.paidAt
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
