import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { commissionTierUpdateSchema } from "@/lib/validation/schemas";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const auth = await requireSuperAdmin(request);
    const { id } = await context.params;
    const body = commissionTierUpdateSchema.parse(await request.json());

    const tier = await prisma.commissionTier.update({
      where: { id },
      data: {
        ...(body.minSubscribers !== undefined ? { minSubscribers: body.minSubscribers } : {}),
        ...(body.maxSubscribers !== undefined ? { maxSubscribers: body.maxSubscribers ?? null } : {}),
        ...(body.commissionPct !== undefined ? { commissionPct: body.commissionPct } : {})
      }
    });

    await audit(request, auth, {
      action: "master.commission_tier_updated",
      entityType: "commission_tier",
      entityId: id
    });

    return ok({
      tier: {
        id: tier.id,
        minSubscribers: tier.minSubscribers,
        maxSubscribers: tier.maxSubscribers,
        commissionPct: Number(tier.commissionPct)
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const auth = await requireSuperAdmin(request);
    const { id } = await context.params;

    await prisma.commissionTier.delete({ where: { id } });
    await audit(request, auth, {
      action: "master.commission_tier_deleted",
      entityType: "commission_tier",
      entityId: id
    });

    return ok({ message: "Faixa removida." });
  } catch (error) {
    return handleApiError(error);
  }
}
