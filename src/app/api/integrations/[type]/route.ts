import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";

const typeSchema = z.enum(["nfeio", "stripe", "asaas", "mercadopago"]);

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "settings:manage");
    const { type } = await params;

    const parsedType = typeSchema.safeParse(type);
    if (!parsedType.success) {
      throw new ApiError(400, `Tipo de integração inválido: ${type}`);
    }

    const existing = await prisma.companyIntegration.findUnique({
      where: { companyId_type: { companyId: context.companyId, type: parsedType.data } },
      select: { id: true }
    });

    if (!existing) {
      throw new ApiError(404, "Integração não encontrada.");
    }

    const integration = await prisma.companyIntegration.update({
      where: { id: existing.id },
      data: { isActive: false, config: {} as Prisma.InputJsonValue, apiKeyHint: null }
    });

    await audit(request, context, {
      action: "integration.disconnect",
      entityType: "integration",
      entityId: integration.id,
      newValues: { type: integration.type }
    });

    return ok({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
