import { NextRequest } from "next/server";
import { ApiError, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { couponUpdateSchema } from "@/lib/validation/schemas";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const auth = await requireSuperAdmin(request);
    const { id } = await context.params;
    const body = couponUpdateSchema.parse(await request.json());

    if (body.influencerId) {
      const influencer = await prisma.influencer.findUnique({
        where: { id: body.influencerId },
        select: { id: true }
      });
      if (!influencer) throw new ApiError(404, "Influencer não encontrado.");
    }

    const coupon = await prisma.coupon.update({
      where: { id },
      data: {
        ...(body.code !== undefined ? { code: body.code } : {}),
        ...(body.influencerId !== undefined ? { influencerId: body.influencerId } : {}),
        ...(body.discountPct !== undefined ? { discountPct: body.discountPct ?? null } : {}),
        ...(body.active !== undefined ? { active: body.active } : {})
      }
    });

    await audit(request, auth, {
      action: "master.coupon_updated",
      entityType: "coupon",
      entityId: id
    });

    return ok({ coupon });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const auth = await requireSuperAdmin(request);
    const { id } = await context.params;

    // Cupom já resgatado não pode ser excluído (mantém a rastreabilidade do
    // vínculo tenant↔influencer). Desative-o em vez disso.
    const redemptions = await prisma.couponRedemption.count({ where: { couponId: id } });
    if (redemptions > 0) {
      throw new ApiError(409, "Cupom já utilizado por clientes. Desative-o em vez de excluir.");
    }

    await prisma.coupon.delete({ where: { id } });
    await audit(request, auth, {
      action: "master.coupon_deleted",
      entityType: "coupon",
      entityId: id
    });

    return ok({ message: "Cupom excluído." });
  } catch (error) {
    return handleApiError(error);
  }
}
