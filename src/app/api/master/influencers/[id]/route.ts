import { NextRequest } from "next/server";
import { ApiError, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { calculateInfluencerTier } from "@/lib/services/commissions";
import { influencerUpdateSchema } from "@/lib/validation/schemas";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requireSuperAdmin(request);
    const { id } = await context.params;

    const influencer = await prisma.influencer.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        pixKey: true,
        active: true,
        notes: true,
        createdAt: true,
        coupons: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            code: true,
            discountPct: true,
            active: true,
            createdAt: true,
            _count: { select: { redemptions: true } }
          }
        }
      }
    });
    if (!influencer) throw new ApiError(404, "Influencer não encontrado.");

    const tier = await calculateInfluencerTier(id);

    const commissions = await prisma.commissionPayment.findMany({
      where: { influencerId: id },
      orderBy: [{ referenceMonth: "desc" }, { createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        referenceMonth: true,
        subscriptionPaymentAmount: true,
        appliedCommissionPct: true,
        commissionAmount: true,
        status: true,
        paidAt: true,
        createdAt: true,
        company: { select: { id: true, name: true } }
      }
    });

    return ok({
      influencer: {
        ...influencer,
        coupons: influencer.coupons.map((c) => ({
          id: c.id,
          code: c.code,
          discountPct: c.discountPct != null ? Number(c.discountPct) : null,
          active: c.active,
          createdAt: c.createdAt,
          redemptionsCount: c._count.redemptions
        }))
      },
      tier: {
        subscribersCount: tier.subscriberCount,
        commissionPct: tier.commissionPct
      },
      commissions: commissions.map((c) => ({
        id: c.id,
        referenceMonth: c.referenceMonth,
        subscriptionPaymentAmount: Number(c.subscriptionPaymentAmount),
        appliedCommissionPct: Number(c.appliedCommissionPct),
        commissionAmount: Number(c.commissionAmount),
        status: c.status,
        paidAt: c.paidAt,
        createdAt: c.createdAt,
        companyId: c.company.id,
        companyName: c.company.name
      }))
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const auth = await requireSuperAdmin(request);
    const { id } = await context.params;
    const body = influencerUpdateSchema.parse(await request.json());

    const influencer = await prisma.influencer.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.email !== undefined ? { email: body.email ?? null } : {}),
        ...(body.phone !== undefined ? { phone: body.phone ?? null } : {}),
        ...(body.pixKey !== undefined ? { pixKey: body.pixKey ?? null } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
        ...(body.notes !== undefined ? { notes: body.notes ?? null } : {})
      }
    });

    await audit(request, auth, {
      action: "master.influencer_updated",
      entityType: "influencer",
      entityId: id
    });

    return ok({ influencer });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const auth = await requireSuperAdmin(request);
    const { id } = await context.params;

    // Não remove influencers com histórico (comissões) — nesse caso, desative-o.
    const commissionCount = await prisma.commissionPayment.count({ where: { influencerId: id } });
    if (commissionCount > 0) {
      throw new ApiError(
        409,
        "Influencer possui histórico de comissões. Desative-o em vez de excluir."
      );
    }
    // Bloqueia se algum cupom já foi resgatado (vínculo com tenant ativo).
    const redemptionCount = await prisma.couponRedemption.count({
      where: { coupon: { influencerId: id } }
    });
    if (redemptionCount > 0) {
      throw new ApiError(
        409,
        "Influencer possui cupons já utilizados por clientes. Desative-o em vez de excluir."
      );
    }

    await prisma.influencer.delete({ where: { id } });
    await audit(request, auth, {
      action: "master.influencer_deleted",
      entityType: "influencer",
      entityId: id
    });

    return ok({ message: "Influencer excluído." });
  } catch (error) {
    return handleApiError(error);
  }
}
