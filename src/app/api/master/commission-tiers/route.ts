import { NextRequest } from "next/server";
import { created, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { commissionTierCreateSchema } from "@/lib/validation/schemas";

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);

    const tiers = await prisma.commissionTier.findMany({
      orderBy: { minSubscribers: "asc" }
    });

    return ok({
      tiers: tiers.map((t) => ({
        id: t.id,
        minSubscribers: t.minSubscribers,
        maxSubscribers: t.maxSubscribers,
        commissionPct: Number(t.commissionPct)
      }))
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const auth = await requireSuperAdmin(request);
    const body = commissionTierCreateSchema.parse(await request.json());

    const tier = await prisma.commissionTier.create({
      data: {
        minSubscribers: body.minSubscribers,
        maxSubscribers: body.maxSubscribers ?? null,
        commissionPct: body.commissionPct
      }
    });

    await audit(request, auth, {
      action: "master.commission_tier_created",
      entityType: "commission_tier",
      entityId: tier.id
    });

    return created({ tier });
  } catch (error) {
    return handleApiError(error);
  }
}
