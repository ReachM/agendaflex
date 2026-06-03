import type { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { created, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { attachCustomValues, saveCustomFieldValues } from "@/lib/services/custom-field-values";
import { listQuerySchema, professionalCreateSchema } from "@/lib/validation/schemas";

const WORKING_DAY_MINUTES = 8 * 60;

export async function GET(request: NextRequest) {
  try {
    const context = await requireTenant(request, "professionals:view");
    const query = listQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));

    const professionals = await prisma.professional.findMany({
      where: {
        companyId: context.companyId,
        ...(query.status ? { isActive: query.status === "active" } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                { email: { contains: query.search, mode: "insensitive" } },
                { specialty: { contains: query.search, mode: "insensitive" } }
              ]
            }
          : {})
      },
      include: {
        services: {
          include: { service: { select: { id: true, name: true } } }
        },
        _count: { select: { timeOffs: true } }
      },
      orderBy: { name: "asc" },
      take: 100
    });

    // Aggregate appointments per professional (last 30 days)
    const now = new Date();
    const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
    const professionalIds = professionals.map(p => p.id);

    const [appointmentAggs, revenueAggs, upcomingMap, todayAggs, todayRevenueAgg] = professionalIds.length > 0
      ? await Promise.all([
          prisma.appointment.findMany({
            where: {
              companyId: context.companyId,
              professionalId: { in: professionalIds },
              startAt: { gte: last30 },
              status: { notIn: ["CANCELLED", "NO_SHOW"] }
            },
            select: { professionalId: true, startAt: true, endAt: true, status: true }
          }),
          prisma.appointment.groupBy({
            by: ["professionalId"],
            where: {
              companyId: context.companyId,
              professionalId: { in: professionalIds },
              status: "COMPLETED",
              totalValue: { not: null }
            },
            _sum: { totalValue: true },
            _count: { id: true }
          }),
          prisma.appointment.findMany({
            where: {
              companyId: context.companyId,
              professionalId: { in: professionalIds },
              startAt: { gte: now },
              status: { notIn: ["CANCELLED", "NO_SHOW"] }
            },
            select: { professionalId: true, startAt: true },
            orderBy: { startAt: "asc" }
          }),
          prisma.appointment.groupBy({
            by: ["professionalId"],
            where: {
              companyId: context.companyId,
              professionalId: { in: professionalIds },
              startAt: { gte: startOfToday, lt: endOfToday },
              status: { notIn: ["CANCELLED", "NO_SHOW"] }
            },
            _count: { id: true }
          }),
          prisma.appointment.aggregate({
            where: {
              companyId: context.companyId,
              professionalId: { in: professionalIds },
              startAt: { gte: startOfToday, lt: endOfToday },
              status: "COMPLETED",
              totalValue: { not: null }
            },
            _sum: { totalValue: true }
          })
        ])
      : [[], [], [], [], { _sum: { totalValue: null } } as { _sum: { totalValue: number | null } }];

    const todayCountMap = new Map<string, number>();
    for (const t of todayAggs) todayCountMap.set(t.professionalId, t._count.id);

    const minutesMap = new Map<string, number>();
    const completedMap = new Map<string, number>();
    for (const a of appointmentAggs) {
      const duration = (new Date(a.endAt).getTime() - new Date(a.startAt).getTime()) / 60000;
      minutesMap.set(a.professionalId, (minutesMap.get(a.professionalId) ?? 0) + duration);
      if (a.status === "COMPLETED") {
        completedMap.set(a.professionalId, (completedMap.get(a.professionalId) ?? 0) + 1);
      }
    }
    const revenueMap = new Map(revenueAggs.map(r => [r.professionalId, { sum: Number(r._sum.totalValue ?? 0), count: r._count.id }]));
    const upcomingByProf = new Map<string, Date>();
    for (const u of upcomingMap) {
      if (!upcomingByProf.has(u.professionalId)) {
        upcomingByProf.set(u.professionalId, u.startAt);
      }
    }

    const enriched = professionals.map(p => {
      const booked = minutesMap.get(p.id) ?? 0;
      // Available minutes: 30 days × 8h, or based on workingHours if structured
      const workingHours = p.workingHours as Record<string, { open?: boolean; from?: string; to?: string }> | null;
      let availablePerWeek = 0;
      if (workingHours) {
        for (const d of ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"]) {
          const day = workingHours[d];
          if (day?.open && day.from && day.to) {
            const [fh, fm] = day.from.split(":").map(Number);
            const [th, tm] = day.to.split(":").map(Number);
            availablePerWeek += Math.max(0, (th * 60 + tm) - (fh * 60 + fm));
          }
        }
      }
      const availableMinutes = availablePerWeek > 0
        ? (availablePerWeek / 7) * 30 // approx 30 days
        : WORKING_DAY_MINUTES * 22; // 22 working days/month fallback
      const occupancyRate = availableMinutes > 0 ? Math.min(100, Math.round((booked / availableMinutes) * 100)) : 0;

      const rev = revenueMap.get(p.id) ?? { sum: 0, count: 0 };

      return {
        ...p,
        serviceIds: p.services.map(ps => ps.serviceId),
        services: p.services.map(ps => ps.service),
        stats: {
          appointmentsLast30d: appointmentAggs.filter(a => a.professionalId === p.id).length,
          appointmentsToday: todayCountMap.get(p.id) ?? 0,
          completedTotal: completedMap.get(p.id) ?? 0,
          revenueTotal: rev.sum,
          revenueCount: rev.count,
          avgTicket: rev.count > 0 ? Number((rev.sum / rev.count).toFixed(2)) : 0,
          bookedHoursLast30d: Math.round(booked / 60),
          availableHoursLast30d: Math.round(availableMinutes / 60),
          occupancyRate
        },
        nextAppointmentAt: upcomingByProf.get(p.id) ?? null
      };
    });

    return ok({
      professionals: await attachCustomValues(context.companyId, "PROFESSIONAL", enriched),
      metrics: {
        totalProfessionals: professionals.length,
        activeProfessionals: professionals.filter(p => p.isActive).length,
        avgOccupancy: enriched.length > 0
          ? Math.round(enriched.reduce((acc, p) => acc + p.stats.occupancyRate, 0) / enriched.length)
          : 0,
        totalRevenue: enriched.reduce((acc, p) => acc + p.stats.revenueTotal, 0),
        revenueToday: Number(todayRevenueAgg._sum.totalValue ?? 0)
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "professionals:manage");
    const body = professionalCreateSchema.parse(await request.json());

    // Validate service ownership
    if (body.serviceIds && body.serviceIds.length > 0) {
      const owned = await prisma.service.count({
        where: { id: { in: body.serviceIds }, companyId: context.companyId }
      });
      if (owned !== body.serviceIds.length) {
        throw new Error("Um ou mais serviços não pertencem à empresa");
      }
    }

    const professional = await prisma.professional.create({
      data: {
        companyId: context.companyId,
        name: body.name,
        email: body.email?.toLowerCase(),
        phone: body.phone,
        specialty: body.specialty,
        avatarUrl: body.avatarUrl,
        isActive: body.isActive,
        isPublic: body.isPublic,
        workingHours: body.workingHours as Prisma.InputJsonValue | undefined,
        ...(body.serviceIds && body.serviceIds.length > 0
          ? {
              services: {
                create: body.serviceIds.map(serviceId => ({
                  companyId: context.companyId,
                  serviceId
                }))
              }
            }
          : {})
      }
    });

    await saveCustomFieldValues({
      companyId: context.companyId,
      entityType: "PROFESSIONAL",
      entityId: professional.id,
      values: body.customValues
    });

    await audit(request, context, {
      action: "professional.create",
      entityType: "professional",
      entityId: professional.id,
      newValues: { id: professional.id, name: professional.name, serviceCount: body.serviceIds?.length ?? 0 }
    });

    const [withValues] = await attachCustomValues(context.companyId, "PROFESSIONAL", [professional]);
    return created({ professional: withValues });
  } catch (error) {
    return handleApiError(error);
  }
}
