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
      allActiveSubs,
      planDistribution,
      pastDueCount,
      cancelledLast30,
      newSubsThisMonth,
      trialConverting,
      subscriptions,
      paymentEvents
    ] = await Promise.all([
      prisma.companySubscription.findMany({
        where: { status: { in: ["ACTIVE", "TRIALING"] } },
        select: {
          id: true,
          status: true,
          createdAt: true,
          plan: { select: { id: true, slug: true, name: true, price: true } }
        }
      }),
      prisma.companySubscription.groupBy({
        by: ["planId"],
        where: { status: { in: ["ACTIVE", "TRIALING"] } },
        _count: { id: true }
      }),
      prisma.companySubscription.count({ where: { status: "PAST_DUE" } }),
      prisma.companySubscription.count({ where: { status: "CANCELLED", canceledAt: { gte: last30 } } }),
      prisma.companySubscription.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.companySubscription.count({ where: { status: "TRIALING", trialEndsAt: { gt: now, lt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) } } }),
      prisma.companySubscription.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          status: true,
          startsAt: true,
          endsAt: true,
          trialEndsAt: true,
          canceledAt: true,
          currentPeriodEnd: true,
          pastDueSince: true,
          lastPaymentStatus: true,
          createdAt: true,
          gatewaySubscriptionId: true,
          plan: { select: { id: true, slug: true, name: true, price: true } },
          company: { select: { id: true, name: true, slug: true, segment: true } }
        }
      }),
      prisma.paymentEvent.findMany({
        orderBy: { processedAt: "desc" },
        take: 20,
        select: {
          id: true,
          type: true,
          status: true,
          processedAt: true,
          subscription: {
            select: {
              company: { select: { id: true, name: true } },
              plan: { select: { name: true, price: true } }
            }
          }
        }
      })
    ]);

    // Current MRR: sum of ACTIVE plan prices
    const mrr = allActiveSubs
      .filter(s => s.status === "ACTIVE")
      .reduce((acc, s) => acc + Number(s.plan?.price ?? 0), 0);

    const trialPipelineMrr = allActiveSubs
      .filter(s => s.status === "TRIALING")
      .reduce((acc, s) => acc + Number(s.plan?.price ?? 0), 0);

    // Previous month MRR — subs that were ACTIVE on the first day of prev month
    const prevMonthSubs = await prisma.companySubscription.findMany({
      where: {
        startsAt: { lt: startOfMonth },
        OR: [{ canceledAt: null }, { canceledAt: { gte: startOfPrevMonth } }]
      },
      select: { plan: { select: { price: true } } }
    });
    const prevMrr = prevMonthSubs.reduce((acc, s) => acc + Number(s.plan?.price ?? 0), 0);
    const mrrDelta = prevMrr > 0 ? Number((((mrr - prevMrr) / prevMrr) * 100).toFixed(1)) : 0;
    const mrrGrowth = mrr - prevMrr;

    // MRR by month — last 6 months (approximated from CompanySubscription.createdAt)
    const mrrByMonth: { month: string; mrr: number; newSubs: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const monthSubs = await prisma.companySubscription.findMany({
        where: {
          startsAt: { lt: monthEnd },
          OR: [{ canceledAt: null }, { canceledAt: { gte: monthEnd } }]
        },
        select: { plan: { select: { price: true } } }
      });
      const newSubs = await prisma.companySubscription.count({
        where: { createdAt: { gte: monthStart, lt: monthEnd } }
      });
      mrrByMonth.push({
        month: monthStart.toISOString().slice(0, 7),
        mrr: monthSubs.reduce((acc, s) => acc + Number(s.plan?.price ?? 0), 0),
        newSubs
      });
    }

    // Plan mix breakdown
    const planIds = planDistribution.map(p => p.planId);
    const planMap = planIds.length > 0
      ? await prisma.plan.findMany({ where: { id: { in: planIds } }, select: { id: true, name: true, slug: true, price: true } })
      : [];
    const planMix = planDistribution.map(p => {
      const plan = planMap.find(pl => pl.id === p.planId);
      return {
        planId: p.planId,
        planName: plan?.name ?? "—",
        planSlug: plan?.slug ?? "",
        count: p._count.id,
        mrr: Number(plan?.price ?? 0) * p._count.id
      };
    }).sort((a, b) => b.mrr - a.mrr);

    // Conversion rate (TRIALING ending soon vs ACTIVE)
    const totalActive = allActiveSubs.filter(s => s.status === "ACTIVE").length;
    const totalTrialing = allActiveSubs.filter(s => s.status === "TRIALING").length;
    const conversionRate = totalActive + totalTrialing > 0
      ? Number(((totalActive / (totalActive + totalTrialing)) * 100).toFixed(1))
      : 0;

    return ok({
      metrics: {
        mrr,
        prevMrr,
        mrrGrowth,
        mrrDelta,
        arr: mrr * 12,
        activeSubs: totalActive,
        trialingSubs: totalTrialing,
        pastDueCount,
        cancelledLast30,
        newSubsThisMonth,
        trialConverting,
        trialPipelineMrr,
        conversionRate
      },
      mrrByMonth,
      planMix,
      subscriptions: subscriptions.map(s => ({
        id: s.id,
        status: s.status,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        trialEndsAt: s.trialEndsAt,
        canceledAt: s.canceledAt,
        currentPeriodEnd: s.currentPeriodEnd,
        pastDueSince: s.pastDueSince,
        lastPaymentStatus: s.lastPaymentStatus,
        createdAt: s.createdAt,
        gatewaySubscriptionId: s.gatewaySubscriptionId,
        planName: s.plan?.name ?? null,
        planSlug: s.plan?.slug ?? null,
        price: Number(s.plan?.price ?? 0),
        company: s.company
      })),
      paymentEvents: paymentEvents.map(e => ({
        id: e.id,
        type: e.type,
        status: e.status,
        processedAt: e.processedAt,
        companyName: e.subscription?.company?.name ?? "—",
        planName: e.subscription?.plan?.name ?? "—",
        amount: Number(e.subscription?.plan?.price ?? 0)
      }))
    });
  } catch (error) {
    return handleApiError(error);
  }
}
