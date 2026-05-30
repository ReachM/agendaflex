import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { resolvePlanFeatures } from "@/lib/security/plan-guard";

export async function GET(request: NextRequest) {
  try {
    const context = await requireTenant(request, "reports:view");
    const cid = context.companyId;
    const features = await resolvePlanFeatures(cid);
    const params = request.nextUrl.searchParams;
    const from = params.get("from");
    const to = params.get("to");

    const now = new Date();
    const defaultFrom = new Date();
    defaultFrom.setDate(defaultFrom.getDate() - 30);
    const periodFrom = from ? new Date(from) : defaultFrom;
    const periodTo = to ? new Date(to) : now;

    const dateFilter = { gte: periodFrom, lte: periodTo };

    // ─── Visão geral / Starter ────────────────────────
    const [totalAppointments, appointmentsByStatus, totalCustomers, newCustomers, topServices] = await Promise.all([
      prisma.appointment.count({ where: { companyId: cid, startAt: dateFilter } }),
      prisma.appointment.groupBy({
        by: ["status"],
        where: { companyId: cid, startAt: dateFilter },
        _count: { id: true }
      }),
      prisma.customer.count({ where: { companyId: cid, deletedAt: null } }),
      prisma.customer.count({ where: { companyId: cid, deletedAt: null, createdAt: dateFilter } }),
      prisma.appointment.groupBy({
        by: ["serviceId"],
        where: { companyId: cid, startAt: dateFilter, status: { notIn: ["CANCELLED", "NO_SHOW"] }, serviceId: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 10
      })
    ]);

    const serviceIds = topServices.map(s => s.serviceId).filter(Boolean) as string[];
    const serviceMap = serviceIds.length > 0
      ? await prisma.service.findMany({ where: { id: { in: serviceIds } }, select: { id: true, name: true } })
      : [];

    const result: Record<string, unknown> = {
      planLevel: features.planSlug,
      period: { from: periodFrom.toISOString(), to: periodTo.toISOString() },
      starter: {
        totalAppointments,
        appointmentsByStatus: appointmentsByStatus.map(s => ({
          status: s.status,
          count: s._count.id
        })),
        totalCustomers,
        newCustomers,
        topServices: topServices.map(s => ({
          serviceId: s.serviceId,
          serviceName: serviceMap.find(sv => sv.id === s.serviceId)?.name ?? "-",
          count: s._count.id
        }))
      }
    };

    // ─── Pro Reports ──────────────────────────────────
    if (features.planSlug === "pro" || features.planSlug === "max") {
      const [byProfessional, cancellationCount, byClientBooking, hourlyAppts, weekdayAppts, returningCustomers] = await Promise.all([
        prisma.appointment.groupBy({
          by: ["professionalId"],
          where: { companyId: cid, startAt: dateFilter, status: { notIn: ["CANCELLED", "NO_SHOW"] } },
          _count: { id: true },
          orderBy: { _count: { id: "desc" } },
          take: 10
        }),
        prisma.appointment.count({
          where: { companyId: cid, startAt: dateFilter, status: "CANCELLED" }
        }),
        prisma.appointment.count({
          where: { companyId: cid, startAt: dateFilter, bookedByClient: true }
        }),
        // Hourly distribution
        prisma.appointment.findMany({
          where: { companyId: cid, startAt: dateFilter, status: { notIn: ["CANCELLED", "NO_SHOW"] } },
          select: { startAt: true, customerId: true }
        }),
        // Weekday distribution (uses same data)
        prisma.appointment.findMany({
          where: { companyId: cid, startAt: dateFilter, status: { notIn: ["CANCELLED", "NO_SHOW"] } },
          select: { startAt: true }
        }),
        // Returning customers (have 2+ completed appointments)
        prisma.appointment.groupBy({
          by: ["customerId"],
          where: { companyId: cid, status: "COMPLETED" },
          _count: { id: true },
          having: { id: { _count: { gt: 1 } } }
        })
      ]);

      const profIds = byProfessional.map(p => p.professionalId);
      const profMap = profIds.length > 0
        ? await prisma.professional.findMany({ where: { id: { in: profIds } }, select: { id: true, name: true, specialty: true } })
        : [];

      // Hourly distribution (occupation)
      const hourCounts: Record<number, number> = {};
      const customerVisits = new Map<string, number>();
      hourlyAppts.forEach(a => {
        const h = new Date(a.startAt).getHours();
        hourCounts[h] = (hourCounts[h] || 0) + 1;
        customerVisits.set(a.customerId, (customerVisits.get(a.customerId) ?? 0) + 1);
      });
      const hourlyDistribution = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: hourCounts[h] ?? 0 }));
      const peakHours = [...hourlyDistribution]
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .filter(h => h.count > 0);

      // Weekday distribution
      const dayCounts: Record<number, number> = {};
      weekdayAppts.forEach(a => {
        const d = new Date(a.startAt).getDay();
        dayCounts[d] = (dayCounts[d] || 0) + 1;
      });
      const weekdayDistribution = Array.from({ length: 7 }, (_, d) => ({ weekday: d, count: dayCounts[d] ?? 0 }));
      const bestDay = [...weekdayDistribution].sort((a, b) => b.count - a.count)[0];
      const weekdayLabels = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

      result.pro = {
        byProfessional: byProfessional.map(p => {
          const prof = profMap.find(pr => pr.id === p.professionalId);
          return {
            professionalId: p.professionalId,
            professionalName: prof?.name ?? "-",
            specialty: prof?.specialty ?? null,
            count: p._count.id
          };
        }),
        cancellationRate: totalAppointments > 0 ? Number(((cancellationCount / totalAppointments) * 100).toFixed(1)) : 0,
        totalCancelled: cancellationCount,
        clientBookings: byClientBooking,
        clientBookingRate: totalAppointments > 0 ? Number(((byClientBooking / totalAppointments) * 100).toFixed(1)) : 0,
        peakHours,
        hourlyDistribution,
        weekdayDistribution: weekdayDistribution.map(w => ({ weekday: w.weekday, weekdayName: weekdayLabels[w.weekday], count: w.count })),
        returningCustomersCount: returningCustomers.length,
        retentionRate: totalCustomers > 0 ? Number(((returningCustomers.length / totalCustomers) * 100).toFixed(1)) : 0,
        bestDay: bestDay && bestDay.count > 0 ? { weekday: bestDay.weekday, weekdayName: weekdayLabels[bestDay.weekday], count: bestDay.count } : null
      };
    }

    // ─── Max Reports (financial) ──────────────────────
    if (features.allowFinancialControl) {
      const [totalRevenue, totalCosts, totalExpenses, dailyRevenue, topClientsBySpend, monthlyAppointmentValue] = await Promise.all([
        prisma.financialRecord.aggregate({
          where: { companyId: cid, flowType: "REVENUE", paymentStatus: "PAID", paidAt: dateFilter },
          _sum: { amount: true }
        }),
        prisma.financialRecord.aggregate({
          where: { companyId: cid, flowType: "COST", paymentStatus: "PAID", paidAt: dateFilter },
          _sum: { amount: true }
        }),
        prisma.financialRecord.aggregate({
          where: { companyId: cid, flowType: "EXPENSE", paymentStatus: "PAID", paidAt: dateFilter },
          _sum: { amount: true }
        }),
        // Daily revenue from financial records
        prisma.financialRecord.findMany({
          where: { companyId: cid, flowType: "REVENUE", paymentStatus: "PAID", paidAt: dateFilter },
          select: { paidAt: true, amount: true }
        }),
        prisma.appointment.groupBy({
          by: ["customerId"],
          where: { companyId: cid, status: "COMPLETED", totalValue: { not: null } },
          _sum: { totalValue: true },
          _count: { id: true },
          orderBy: { _sum: { totalValue: "desc" } },
          take: 10
        }),
        prisma.appointment.aggregate({
          where: { companyId: cid, status: "COMPLETED", totalValue: { not: null }, startAt: dateFilter },
          _sum: { totalValue: true },
          _count: { id: true }
        })
      ]);

      const customerIds = topClientsBySpend.map(c => c.customerId);
      const customerMap = customerIds.length > 0
        ? await prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, name: true } })
        : [];

      // Daily revenue bucket
      const revenueByDayMap = new Map<string, number>();
      for (const r of dailyRevenue) {
        if (!r.paidAt) continue;
        const key = new Date(r.paidAt).toISOString().slice(0, 10);
        revenueByDayMap.set(key, (revenueByDayMap.get(key) ?? 0) + Number(r.amount));
      }
      const dailyRevenueArr = Array.from(revenueByDayMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, total]) => ({ date, total }));

      const revenueNum = Number(totalRevenue._sum.amount ?? 0);
      const costsNum = Number(totalCosts._sum.amount ?? 0);
      const expensesNum = Number(totalExpenses._sum.amount ?? 0);
      const profit = revenueNum - costsNum - expensesNum;
      const avgTicket = (monthlyAppointmentValue._count.id ?? 0) > 0
        ? Number(monthlyAppointmentValue._sum.totalValue ?? 0) / monthlyAppointmentValue._count.id
        : 0;

      result.max = {
        totalRevenue: revenueNum,
        totalCosts: costsNum,
        totalExpenses: expensesNum,
        profit,
        margin: revenueNum > 0 ? Number(((profit / revenueNum) * 100).toFixed(1)) : 0,
        avgTicket,
        dailyRevenue: dailyRevenueArr,
        topClientsBySpend: topClientsBySpend.map(c => ({
          customerId: c.customerId,
          customerName: customerMap.find(cu => cu.id === c.customerId)?.name ?? "-",
          totalSpent: Number(c._sum.totalValue ?? 0),
          appointmentCount: c._count.id
        }))
      };
    }

    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
