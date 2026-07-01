import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { handleApiError, ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/security/auth";

/**
 * Lista de comissões (CommissionPayment) com filtro opcional por mês de
 * referência ("YYYY-MM"), influencer e status. Usada no painel master.
 */
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month")?.trim() || undefined;
    const influencerId = searchParams.get("influencerId")?.trim() || undefined;
    const status = searchParams.get("status")?.trim() || undefined;

    const where: Prisma.CommissionPaymentWhereInput = {};
    if (month && /^\d{4}-\d{2}$/.test(month)) where.referenceMonth = month;
    if (influencerId) where.influencerId = influencerId;
    if (status === "pending" || status === "paid") where.status = status;

    const [commissions, pendingAgg, paidAgg] = await Promise.all([
      prisma.commissionPayment.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        take: 500,
        select: {
          id: true,
          referenceMonth: true,
          subscriptionPaymentAmount: true,
          appliedCommissionPct: true,
          commissionAmount: true,
          status: true,
          paidAt: true,
          createdAt: true,
          influencer: { select: { id: true, name: true, pixKey: true } },
          company: { select: { id: true, name: true } }
        }
      }),
      prisma.commissionPayment.aggregate({
        where: { ...where, status: "pending" },
        _sum: { commissionAmount: true },
        _count: { _all: true }
      }),
      prisma.commissionPayment.aggregate({
        where: { ...where, status: "paid" },
        _sum: { commissionAmount: true },
        _count: { _all: true }
      })
    ]);

    return ok({
      metrics: {
        pendingTotal: Number(pendingAgg._sum.commissionAmount ?? 0),
        pendingCount: pendingAgg._count._all,
        paidTotal: Number(paidAgg._sum.commissionAmount ?? 0),
        paidCount: paidAgg._count._all
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
        influencerId: c.influencer.id,
        influencerName: c.influencer.name,
        influencerPixKey: c.influencer.pixKey,
        companyId: c.company.id,
        companyName: c.company.name
      }))
    });
  } catch (error) {
    return handleApiError(error);
  }
}
