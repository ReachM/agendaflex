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

    // TODO [MVP-FUTURE] Relatórios Max (financeiros) — reativar na v2
    // Seção desabilitada: Ticket Médio, Receita por Mês, Clientes Fiéis por valor gasto
    // if (features.planSlug === "max") { ... }

    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
