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

    const dateFilter = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {})
    };
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    // ─── Starter Reports ──────────────────────────────
    const [totalAppointments, appointmentsByStatus, totalCustomers, topServices] = await Promise.all([
      prisma.appointment.count({
        where: { companyId: cid, ...(hasDateFilter ? { startAt: dateFilter } : {}) }
      }),
      prisma.appointment.groupBy({
        by: ["status"],
        where: { companyId: cid, ...(hasDateFilter ? { startAt: dateFilter } : {}) },
        _count: { id: true }
      }),
      prisma.customer.count({ where: { companyId: cid, deletedAt: null } }),
      prisma.appointment.groupBy({
        by: ["serviceId"],
        where: { companyId: cid, status: { notIn: ["CANCELLED", "NO_SHOW"] }, serviceId: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 10
      })
    ]);

    const serviceIds = topServices.map(s => s.serviceId).filter(Boolean) as string[];
    const serviceMap = serviceIds.length > 0
      ? await prisma.service.findMany({ where: { id: { in: serviceIds } }, select: { id: true, name: true } })
      : [];

    const result: Record<string, any> = {
      planLevel: features.planSlug,
      starter: {
        totalAppointments,
        appointmentsByStatus: appointmentsByStatus.map(s => ({
          status: s.status,
          count: s._count.id
        })),
        totalCustomers,
        topServices: topServices.map(s => ({
          serviceId: s.serviceId,
          serviceName: serviceMap.find(sv => sv.id === s.serviceId)?.name ?? "-",
          count: s._count.id
        }))
      }
    };

    // ─── Pro Reports ──────────────────────────────────
    if (features.planSlug === "pro" || features.planSlug === "max") {
      const [byProfessional, cancellationRate, byClientBooking, peakHours] = await Promise.all([
        prisma.appointment.groupBy({
          by: ["professionalId"],
          where: { companyId: cid, ...(hasDateFilter ? { startAt: dateFilter } : {}) },
          _count: { id: true },
          orderBy: { _count: { id: "desc" } },
          take: 10
        }),
        prisma.appointment.count({
          where: { companyId: cid, status: "CANCELLED", ...(hasDateFilter ? { startAt: dateFilter } : {}) }
        }),
        prisma.appointment.count({
          where: { companyId: cid, bookedByClient: true, ...(hasDateFilter ? { startAt: dateFilter } : {}) }
        }),
        // Peak hours approximation
        prisma.appointment.findMany({
          where: { companyId: cid, status: { notIn: ["CANCELLED", "NO_SHOW"] } },
          select: { startAt: true },
          take: 500
        })
      ]);

      const profIds = byProfessional.map(p => p.professionalId);
      const profMap = profIds.length > 0
        ? await prisma.professional.findMany({ where: { id: { in: profIds } }, select: { id: true, name: true } })
        : [];

      // Calculate peak hours
      const hourCounts: Record<number, number> = {};
      peakHours.forEach(a => {
        const h = new Date(a.startAt).getHours();
        hourCounts[h] = (hourCounts[h] || 0) + 1;
      });
      const peakHoursResult = Object.entries(hourCounts)
        .map(([hour, count]) => ({ hour: Number(hour), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      result.pro = {
        byProfessional: byProfessional.map(p => ({
          professionalId: p.professionalId,
          professionalName: profMap.find(pr => pr.id === p.professionalId)?.name ?? "-",
          count: p._count.id
        })),
        cancellationRate: totalAppointments > 0 ? ((cancellationRate / totalAppointments) * 100).toFixed(1) : 0,
        totalCancelled: cancellationRate,
        clientBookings: byClientBooking,
        peakHours: peakHoursResult
      };
    }

    // ─── Max Reports ──────────────────────────────────
    if (features.planSlug === "max") {
      const now = new Date();
      const monthsAgo6 = new Date(now.getFullYear(), now.getMonth() - 5, 1);

      const [monthlyRevenue, avgTicket, loyalCustomers] = await Promise.all([
        // Monthly revenue for last 6 months
        prisma.appointment.findMany({
          where: {
            companyId: cid,
            status: "COMPLETED",
            totalValue: { not: null },
            startAt: { gte: monthsAgo6 }
          },
          select: { startAt: true, totalValue: true }
        }),
        prisma.appointment.aggregate({
          where: { companyId: cid, status: "COMPLETED", totalValue: { not: null } },
          _avg: { totalValue: true }
        }),
        // Most loyal customers
        prisma.appointment.groupBy({
          by: ["customerId"],
          where: { companyId: cid, status: "COMPLETED" },
          _count: { id: true },
          _sum: { totalValue: true },
          orderBy: { _count: { id: "desc" } },
          take: 10
        })
      ]);

      // Group revenue by month
      const revenueByMonth: Record<string, number> = {};
      monthlyRevenue.forEach(a => {
        const key = `${new Date(a.startAt).getFullYear()}-${String(new Date(a.startAt).getMonth() + 1).padStart(2, "0")}`;
        revenueByMonth[key] = (revenueByMonth[key] || 0) + Number(a.totalValue ?? 0);
      });

      const loyalCustomerIds = loyalCustomers.map(c => c.customerId);
      const loyalCustomerMap = loyalCustomerIds.length > 0
        ? await prisma.customer.findMany({ where: { id: { in: loyalCustomerIds } }, select: { id: true, name: true } })
        : [];

      // Last appointment for loyal customers
      const lastAppointments = loyalCustomerIds.length > 0
        ? await prisma.appointment.findMany({
            where: { companyId: cid, customerId: { in: loyalCustomerIds }, status: "COMPLETED" },
            orderBy: { startAt: "desc" },
            distinct: ["customerId"],
            select: { customerId: true, startAt: true }
          })
        : [];

      result.max = {
        revenueByMonth: Object.entries(revenueByMonth).map(([month, total]) => ({ month, total })),
        avgTicket: avgTicket._avg.totalValue ?? 0,
        loyalCustomers: loyalCustomers.map(c => {
          const customer = loyalCustomerMap.find(cu => cu.id === c.customerId);
          const lastAppt = lastAppointments.find(la => la.customerId === c.customerId);
          return {
            customerId: c.customerId,
            customerName: customer?.name ?? "-",
            appointmentCount: c._count.id,
            totalSpent: c._sum.totalValue ?? 0,
            lastAppointment: lastAppt?.startAt ?? null
          };
        })
      };
    }

    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
