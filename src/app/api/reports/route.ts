import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handleApiError, ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { requirePlanFeature, resolvePlanFeatures } from "@/lib/security/plan-guard";

const tabSchema = z.enum(["overview", "services", "professionals", "customers", "financial"]);

function parseDateRange(searchParams: URLSearchParams) {
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 30);
  defaultFrom.setHours(0, 0, 0, 0);
  return {
    from: from ? new Date(from) : defaultFrom,
    to: to ? new Date(to) : now
  };
}

function isoDay(value: Date) {
  return value.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireTenant(request, "reports:view");
    const cid = context.companyId;

    const tabParam = request.nextUrl.searchParams.get("tab") ?? "overview";
    const parsedTab = tabSchema.safeParse(tabParam);
    if (!parsedTab.success) {
      throw new ApiError(400, `Tab inválida: ${tabParam}`);
    }
    const tab = parsedTab.data;

    if (tab !== "overview") {
      await requirePlanFeature(context, "allowAdvancedReports", "Relatórios avançados");
    }

    const { from, to } = parseDateRange(request.nextUrl.searchParams);
    const dateFilter = { gte: from, lte: to };
    const features = await resolvePlanFeatures(cid);
    const period = { from: from.toISOString(), to: to.toISOString() };

    if (tab === "overview") {
      const [statusCounts, newCustomers, revenueAgg, appointments] = await Promise.all([
        prisma.appointment.groupBy({
          by: ["status"],
          where: { companyId: cid, startAt: dateFilter },
          _count: { id: true }
        }),
        prisma.customer.count({
          where: { companyId: cid, deletedAt: null, createdAt: dateFilter }
        }),
        prisma.financialRecord.aggregate({
          where: { companyId: cid, flowType: "REVENUE", paymentStatus: "PAID", paidAt: dateFilter },
          _sum: { amount: true }
        }),
        prisma.appointment.findMany({
          where: { companyId: cid, startAt: dateFilter },
          select: { startAt: true }
        })
      ]);

      const totalAppointments = statusCounts.reduce((acc, s) => acc + s._count.id, 0);
      const byStatus = (status: string) =>
        statusCounts.find((s) => s.status === status)?._count.id ?? 0;

      const dayMap = new Map<string, number>();
      for (const a of appointments) {
        const key = isoDay(a.startAt);
        dayMap.set(key, (dayMap.get(key) ?? 0) + 1);
      }
      const appointmentsByDay = Array.from(dayMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, count }));

      return ok({
        period,
        planFeatures: features,
        overview: {
          totalAppointments,
          completedAppointments: byStatus("COMPLETED"),
          cancelledAppointments: byStatus("CANCELLED"),
          noShowAppointments: byStatus("NO_SHOW"),
          newCustomers,
          revenue: Number(revenueAgg._sum.amount ?? 0),
          appointmentsByDay
        }
      });
    }

    if (tab === "services") {
      const rows = await prisma.appointmentService.groupBy({
        by: ["serviceId"],
        where: {
          companyId: cid,
          appointment: { startAt: dateFilter }
        },
        _count: { id: true },
        _sum: { totalPrice: true }
      });

      const serviceIds = rows.map((r) => r.serviceId);
      const [services, cancelledByService] = await Promise.all([
        serviceIds.length > 0
          ? prisma.service.findMany({
              where: { id: { in: serviceIds } },
              select: { id: true, name: true }
            })
          : Promise.resolve([]),
        serviceIds.length > 0
          ? prisma.appointmentService.groupBy({
              by: ["serviceId"],
              where: {
                companyId: cid,
                serviceId: { in: serviceIds },
                appointment: { startAt: dateFilter, status: "CANCELLED" }
              },
              _count: { id: true }
            })
          : Promise.resolve([])
      ]);

      const nameMap = new Map(services.map((s) => [s.id, s.name]));
      const cancelMap = new Map(cancelledByService.map((c) => [c.serviceId, c._count.id]));

      const out = rows
        .map((r) => {
          const count = r._count.id;
          const revenue = Number(r._sum.totalPrice ?? 0);
          const cancelled = cancelMap.get(r.serviceId) ?? 0;
          return {
            serviceId: r.serviceId,
            serviceName: nameMap.get(r.serviceId) ?? "—",
            count,
            revenue,
            avgPrice: count > 0 ? Number((revenue / count).toFixed(2)) : 0,
            cancellationRate: count > 0 ? Number(((cancelled / count) * 100).toFixed(1)) : 0
          };
        })
        .sort((a, b) => b.count - a.count);

      return ok({ period, planFeatures: features, services: { rows: out } });
    }

    if (tab === "professionals") {
      const [counts, statusByProf, revenueByProf] = await Promise.all([
        prisma.appointment.groupBy({
          by: ["professionalId"],
          where: { companyId: cid, startAt: dateFilter },
          _count: { id: true }
        }),
        prisma.appointment.groupBy({
          by: ["professionalId", "status"],
          where: { companyId: cid, startAt: dateFilter },
          _count: { id: true }
        }),
        prisma.appointment.groupBy({
          by: ["professionalId"],
          where: {
            companyId: cid,
            startAt: dateFilter,
            status: "COMPLETED",
            totalValue: { not: null }
          },
          _sum: { totalValue: true }
        })
      ]);

      const profIds = counts.map((c) => c.professionalId);
      const profs = profIds.length > 0
        ? await prisma.professional.findMany({
            where: { id: { in: profIds } },
            select: { id: true, name: true }
          })
        : [];
      const nameMap = new Map(profs.map((p) => [p.id, p.name]));

      const statusMap = new Map<string, Record<string, number>>();
      for (const s of statusByProf) {
        const cur = statusMap.get(s.professionalId) ?? {};
        cur[s.status] = s._count.id;
        statusMap.set(s.professionalId, cur);
      }
      const revenueMap = new Map(
        revenueByProf.map((r) => [r.professionalId, Number(r._sum.totalValue ?? 0)])
      );

      const out = counts
        .map((c) => {
          const status = statusMap.get(c.professionalId) ?? {};
          return {
            professionalId: c.professionalId,
            professionalName: nameMap.get(c.professionalId) ?? "—",
            count: c._count.id,
            completedCount: status.COMPLETED ?? 0,
            cancelledCount: status.CANCELLED ?? 0,
            revenue: revenueMap.get(c.professionalId) ?? 0
          };
        })
        .sort((a, b) => b.count - a.count);

      return ok({ period, planFeatures: features, professionals: { rows: out } });
    }

    if (tab === "customers") {
      const [appointmentsByCustomer, lastAppointmentByCustomer, newCustomers, returningCustomers, totalCustomers] = await Promise.all([
        prisma.appointment.groupBy({
          by: ["customerId"],
          where: { companyId: cid, status: "COMPLETED", totalValue: { not: null } },
          _sum: { totalValue: true },
          _count: { id: true },
          orderBy: { _sum: { totalValue: "desc" } },
          take: 50
        }),
        prisma.appointment.groupBy({
          by: ["customerId"],
          where: { companyId: cid },
          _max: { startAt: true }
        }),
        prisma.customer.count({
          where: { companyId: cid, deletedAt: null, createdAt: dateFilter }
        }),
        prisma.appointment.groupBy({
          by: ["customerId"],
          where: { companyId: cid, status: "COMPLETED" },
          _count: { id: true },
          having: { id: { _count: { gt: 1 } } }
        }),
        prisma.customer.count({ where: { companyId: cid, deletedAt: null } })
      ]);

      const customerIds = appointmentsByCustomer.map((a) => a.customerId);
      const customers = customerIds.length > 0
        ? await prisma.customer.findMany({
            where: { id: { in: customerIds } },
            select: { id: true, name: true, status: true }
          })
        : [];
      const custMap = new Map(customers.map((c) => [c.id, c]));
      const lastMap = new Map(
        lastAppointmentByCustomer.map((l) => [l.customerId, l._max.startAt])
      );

      const rows = appointmentsByCustomer.map((a) => {
        const c = custMap.get(a.customerId);
        const last = lastMap.get(a.customerId) ?? null;
        return {
          customerId: a.customerId,
          customerName: c?.name ?? "—",
          appointmentCount: a._count.id,
          totalSpent: Number(a._sum.totalValue ?? 0),
          lastAppointment: last ? last.toISOString() : null,
          status: c?.status ?? "active"
        };
      });

      return ok({
        period,
        planFeatures: features,
        customers: {
          rows,
          retention: {
            newCustomers,
            returningCustomers: returningCustomers.length,
            churnRate: totalCustomers > 0
              ? Number((((totalCustomers - returningCustomers.length) / totalCustomers) * 100).toFixed(1))
              : 0
          }
        }
      });
    }

    // financial
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [financialRecords, topServiceRows] = await Promise.all([
      prisma.financialRecord.findMany({
        where: {
          companyId: cid,
          paymentStatus: "PAID",
          paidAt: { gte: sixMonthsAgo, lte: now }
        },
        select: { paidAt: true, amount: true, flowType: true }
      }),
      prisma.appointmentService.groupBy({
        by: ["serviceId"],
        where: {
          companyId: cid,
          appointment: { startAt: dateFilter, status: "COMPLETED" }
        },
        _sum: { totalPrice: true },
        orderBy: { _sum: { totalPrice: "desc" } },
        take: 10
      })
    ]);

    const monthMap = new Map<string, { revenue: number; expense: number }>();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthMap.set(key, { revenue: 0, expense: 0 });
    }
    for (const r of financialRecords) {
      if (!r.paidAt) continue;
      const d = new Date(r.paidAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const bucket = monthMap.get(key);
      if (!bucket) continue;
      const amount = Number(r.amount);
      if (r.flowType === "REVENUE") bucket.revenue += amount;
      else bucket.expense += amount;
    }
    const revenueByMonth = Array.from(monthMap.entries()).map(([month, v]) => ({
      month,
      revenue: Number(v.revenue.toFixed(2)),
      expense: Number(v.expense.toFixed(2))
    }));

    const topServiceIds = topServiceRows.map((r) => r.serviceId);
    const topServiceMap = topServiceIds.length > 0
      ? new Map(
          (await prisma.service.findMany({
            where: { id: { in: topServiceIds } },
            select: { id: true, name: true }
          })).map((s) => [s.id, s.name])
        )
      : new Map();

    const topServices = topServiceRows.map((r) => ({
      name: topServiceMap.get(r.serviceId) ?? "—",
      revenue: Number(r._sum.totalPrice ?? 0)
    }));

    return ok({
      period,
      planFeatures: features,
      financial: { revenueByMonth, topServices }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
