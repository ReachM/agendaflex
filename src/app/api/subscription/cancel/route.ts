import { NextRequest } from "next/server";
import { ApiError, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";

/**
 * POST /api/subscription/cancel
 *
 * Cancela a assinatura ativa da empresa.
 * - Exige permissão settings:manage (COMPANY_ADMIN)
 * - Marca CompanySubscription.status = CANCELLED
 * - Grava canceledAt = now()
 * - Registra em audit log
 * - Não deleta dados nem integra com gateway (preparado para Asaas futuro)
 */
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "settings:manage");

    // Apenas COMPANY_ADMIN pode cancelar
    if (context.roleName !== "COMPANY_ADMIN") {
      throw new ApiError(403, "Apenas o administrador da empresa pode cancelar a assinatura.");
    }

    const subscription = await prisma.companySubscription.findFirst({
      where: { companyId: context.companyId },
      orderBy: { createdAt: "desc" }
    });

    if (!subscription) {
      throw new ApiError(404, "Assinatura não encontrada.");
    }

    if (subscription.status === "CANCELLED") {
      throw new ApiError(409, "Esta assinatura já está cancelada.");
    }

    await prisma.companySubscription.update({
      where: { id: subscription.id },
      data: {
        status: "CANCELLED",
        canceledAt: new Date()
      }
    });

    await audit(request, context, {
      action: "subscription.cancel",
      entityType: "subscription",
      entityId: subscription.id,
      companyId: context.companyId,
      newValues: {
        previousStatus: subscription.status,
        canceledAt: new Date().toISOString()
      }
    });

    return ok({
      message: "Assinatura cancelada com sucesso. Seus dados serão mantidos."
    });
  } catch (error) {
    return handleApiError(error);
  }
}
