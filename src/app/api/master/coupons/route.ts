import { NextRequest } from "next/server";
import { ApiError, created, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { couponCreateSchema } from "@/lib/validation/schemas";

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);

    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true,
        code: true,
        discountPct: true,
        active: true,
        createdAt: true,
        influencer: { select: { id: true, name: true } },
        _count: { select: { redemptions: true } }
      }
    });

    return ok({
      coupons: coupons.map((c) => ({
        id: c.id,
        code: c.code,
        discountPct: c.discountPct != null ? Number(c.discountPct) : null,
        active: c.active,
        createdAt: c.createdAt,
        influencerId: c.influencer.id,
        influencerName: c.influencer.name,
        redemptionsCount: c._count.redemptions
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
    const body = couponCreateSchema.parse(await request.json());

    const influencer = await prisma.influencer.findUnique({
      where: { id: body.influencerId },
      select: { id: true }
    });
    if (!influencer) throw new ApiError(404, "Influencer não encontrado.");

    const coupon = await prisma.coupon.create({
      data: {
        code: body.code,
        influencerId: body.influencerId,
        discountPct: body.discountPct ?? null,
        active: body.active
      }
    });

    await audit(request, auth, {
      action: "master.coupon_created",
      entityType: "coupon",
      entityId: coupon.id,
      newValues: { code: coupon.code, influencerId: body.influencerId }
    });

    return created({ coupon });
  } catch (error) {
    return handleApiError(error);
  }
}
