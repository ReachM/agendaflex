import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/security/auth";

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      companies,
      activeCompanies,
      trialingCompanies,
      pastDueCompanies,
      cancelledLast30,
      newCompaniesThisMonth,
      users,
      customers,
      appointments,
      activeSubs,
      planDistribution,
      companiesList,
      recentLogs
    ] = await Promise.all([
      prisma.company.count(),
      prisma.company.count({ where: { status: "ACTIVE" } }),
      prisma.companySubscription.count({ where: { status: "TRIALING" } }),
      prisma.companySubscription.count({ where: { status: "PAST_DUE" } }),
      prisma.companySubscription.count({ where: { status: "CANCELLED", canceledAt: { gte: last30 } } }),
      prisma.company.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.user.count(),
      prisma.customer.count(),
      prisma.appointment.count(),
      prisma.companySubscription.findMany({
        where: { status: { in: ["ACTIVE", "TRIALING"] } },
        select: { id: true, status: true, plan: { select: { id: true, slug: true, name: true, price: true } } }
      }),
      prisma.companySubscription.groupBy({
        by: ["planId"],
        where: { status: { in: ["ACTIVE", "TRIALING"] } },
        _count: { id: true }
      }),
      prisma.company.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          segment: true,
          status: true,
          plan: true,
          createdAt: true,
          _count: { select: { users: true, customers: true, appointments: true } },
          subscriptions: {
            where: { status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] } },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { status: true, currentPeriodEnd: true, plan: { select: { name: true, slug: true, price: true } } }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 50
      }),
      prisma.auditLog.findMany({
        include: {
          user: { select: { id: true, name: true, email: true } },
          company: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: "desc" },
        take: 8
      })
    ]);

    const mrr = activeSubs
      .filter(s => s.status === "ACTIVE")
      .reduce((acc, s) => acc + Number(s.plan?.price ?? 0), 0);

    const trialCompanies30d = activeSubs.filter(s => s.status === "TRIALING").length;

    const planIds = planDistribution.map(p => p.planId);
    const planMap = planIds.length > 0
      ? await prisma.plan.findMany({ where: { id: { in: planIds } }, select: { id: true, name: true, slug: true } })
      : [];

    const planMix = planDistribution.map(p => ({
      planId: p.planId,
      planName: planMap.find(pl => pl.id === p.planId)?.name ?? "—",
      planSlug: planMap.find(pl => pl.id === p.planId)?.slug ?? "",
      count: p._count.id
    })).sort((a, b) => b.count - a.count);

    // Previous month MRR (rough approx using subscriptions that existed last month)
    const prevMonthActive = await prisma.companySubscription.findMany({
      where: {
        status: { in: ["ACTIVE", "CANCELLED"] },
        startsAt: { lt: startOfMonth },
        OR: [{ canceledAt: null }, { canceledAt: { gte: startOfPrevMonth } }]
      },
      select: { plan: { select: { price: true } } }
    });
    const prevMrr = prevMonthActive.reduce((acc, s) => acc + Number(s.plan?.price ?? 0), 0);
    const mrrDelta = prevMrr > 0 ? Number((((mrr - prevMrr) / prevMrr) * 100).toFixed(1)) : 0;

    const companiesWithHealth = companiesList.map(c => {
      const sub = c.subscriptions[0] ?? null;
      const usage = c._count.appointments;
      const health: "good" | "mid" | "low" =
        sub?.status === "PAST_DUE" ? "low" : usage > 50 ? "good" : usage > 5 ? "mid" : "low";
      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        segment: c.segment,
        status: c.status,
        plan: c.plan,
        planName: sub?.plan?.name ?? null,
        planSlug: sub?.plan?.slug ?? null,
        mrr: Number(sub?.plan?.price ?? 0),
        subStatus: sub?.status ?? null,
        currentPeriodEnd: sub?.currentPeriodEnd ?? null,
        usersCount: c._count.users,
        customersCount: c._count.customers,
        appointmentsCount: c._count.appointments,
        health,
        createdAt: c.createdAt
      };
    });

    return ok({
      metrics: {
        companies,
        activeCompanies,
        trialingCompanies,
        pastDueCompanies,
        cancelledLast30,
        newCompaniesThisMonth,
        users,
        customers,
        appointments,
        mrr,
        mrrDelta,
        trialCompanies30d
      },
      planMix,
      companies: companiesWithHealth,
      recentLogs
    });
  } catch (error) {
    return handleApiError(error);
  }
}
