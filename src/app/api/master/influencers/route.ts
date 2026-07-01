import { NextRequest } from "next/server";
import { created, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { influencerCreateSchema } from "@/lib/validation/schemas";

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);

    const [influencers, redemptionsByInfluencer, pendingByInfluencer] = await Promise.all([
      prisma.influencer.findMany({
        orderBy: { createdAt: "desc" },
        take: 300,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          pixKey: true,
          active: true,
          createdAt: true,
          _count: { select: { coupons: true } }
        }
      }),
      // nº de tenants vinculados (resgates) por influencer, via cupom.
      prisma.couponRedemption.groupBy({
        by: ["couponId"],
        _count: { _all: true }
      }),
      // total de comissão pendente por influencer.
      prisma.commissionPayment.groupBy({
        by: ["influencerId"],
        where: { status: "pending" },
        _sum: { commissionAmount: true }
      })
    ]);

    // Mapeia couponId -> influencerId para agregar os resgates por influencer.
    const coupons = await prisma.coupon.findMany({ select: { id: true, influencerId: true } });
    const couponToInfluencer = new Map(coupons.map((c) => [c.id, c.influencerId]));
    const redemptionsCount = new Map<string, number>();
    for (const r of redemptionsByInfluencer) {
      const infId = couponToInfluencer.get(r.couponId);
      if (!infId) continue;
      redemptionsCount.set(infId, (redemptionsCount.get(infId) ?? 0) + r._count._all);
    }
    const pendingMap = new Map(
      pendingByInfluencer.map((p) => [p.influencerId, Number(p._sum.commissionAmount ?? 0)])
    );

    const totalActive = influencers.filter((i) => i.active).length;
    const totalPending = [...pendingMap.values()].reduce((a, b) => a + b, 0);

    return ok({
      metrics: {
        total: influencers.length,
        active: totalActive,
        inactive: influencers.length - totalActive,
        pendingCommissionTotal: totalPending
      },
      influencers: influencers.map((i) => ({
        id: i.id,
        name: i.name,
        email: i.email,
        phone: i.phone,
        pixKey: i.pixKey,
        active: i.active,
        createdAt: i.createdAt,
        couponsCount: i._count.coupons,
        subscribersCount: redemptionsCount.get(i.id) ?? 0,
        pendingCommission: pendingMap.get(i.id) ?? 0
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
    const body = influencerCreateSchema.parse(await request.json());

    const influencer = await prisma.influencer.create({
      data: {
        name: body.name,
        email: body.email ?? null,
        phone: body.phone ?? null,
        pixKey: body.pixKey ?? null,
        active: body.active,
        notes: body.notes ?? null
      }
    });

    await audit(request, auth, {
      action: "master.influencer_created",
      entityType: "influencer",
      entityId: influencer.id,
      newValues: { name: influencer.name }
    });

    return created({ influencer });
  } catch (error) {
    return handleApiError(error);
  }
}
