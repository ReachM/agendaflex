import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { resolvePlanFeatures } from "@/lib/security/plan-guard";
import { attachCustomValues } from "@/lib/services/custom-field-values";

export async function GET(request: NextRequest) {
  try {
    const context = await requireTenant(request);
    const cid = context.companyId;
    const planFeatures = await resolvePlanFeatures(cid);

    const now = new Date();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    // Start of month for monthly counts
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [
      customers,
      services,
      professionals,
      todayAppointments,
      pendingAppointments,
      confirmedAppointments,
      completedAppointments,
      cancelledAppointments,
      monthlyAppointments,
      nextAppointments,
      todayProfessionals,
      topServices,
      todayFullAppointments
    ] = await Promise.all([
      prisma.customer.count({ where: { companyId: cid, deletedAt: null } }),
      prisma.service.count({ where: { companyId: cid, isActive: true } }),
      prisma.professional.count({ where: { companyId: cid, isActive: true } }),
      prisma.appointment.count({
        where: { companyId: cid, startAt: { gte: startOfDay, lt: endOfDay } }
      }),
      prisma.appointment.count({
        where: { companyId: cid, status: "SCHEDULED" }
      }),
      prisma.appointment.count({
        where: { companyId: cid, status: "CONFIRMED" }
      }),
      prisma.appointment.count({
        where: { companyId: cid, status: "COMPLETED" }
      }),
      prisma.appointment.count({
        where: { companyId: cid, status: "CANCELLED" }
      }),
      prisma.appointment.count({
        where: { companyId: cid, startAt: { gte: startOfMonth, lt: endOfMonth } }
      }),
      prisma.appointment.findMany({
        where: {
          companyId: cid,
          startAt: { gte: now },
          status: { notIn: ["CANCELLED", "NO_SHOW"] }
        },
        include: {
          customer: true,
          service: true,
          professional: true,
          appointmentServices: { include: { service: true } }
        },
        orderBy: { startAt: "asc" },
        take: 8
      }),
      // Professionals with schedule today
      prisma.appointment.findMany({
        where: {
          companyId: cid,
          startAt: { gte: startOfDay, lt: endOfDay },
          status: { notIn: ["CANCELLED", "NO_SHOW"] }
        },
        select: { professionalId: true, professional: { select: { name: true } } },
        distinct: ["professionalId"]
      }),
      // Top services (most booked)
      prisma.appointment.groupBy({
        by: ["serviceId"],
        where: {
          companyId: cid,
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
          serviceId: { not: null }
        },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 5
      }),
      // Today's appointments with full details for "Agendamentos de Hoje"
      prisma.appointment.findMany({
        where: {
          companyId: cid,
          startAt: { gte: startOfDay, lt: endOfDay }
        },
        include: {
          customer: true,
          service: true,
          professional: true,
          appointmentServices: {
            include: { service: true },
            orderBy: { createdAt: "asc" }
          },
          checklists: {
            select: { id: true, status: true, _count: { select: { items: true } } }
          }
        },
        orderBy: { startAt: "asc" }
      })
    ]);

    // Attach custom values to today's appointments
    const todayAppointmentsWithValues = await attachCustomValues(cid, "APPOINTMENT", todayFullAppointments);

    // Resolve service names for top services
    const topServiceIds = topServices.map(s => s.serviceId).filter(Boolean) as string[];
    const serviceNames = topServiceIds.length > 0
      ? await prisma.service.findMany({
          where: { id: { in: topServiceIds } },
          select: { id: true, name: true }
        })
      : [];

    const topServicesResult = topServices.map(s => {
      const svc = serviceNames.find(n => n.id === s.serviceId);
      return { serviceId: s.serviceId, serviceName: svc?.name ?? "-", count: s._count.id };
    });

    // Attach custom values to next appointments
    const nextAppointmentsWithValues = await attachCustomValues(cid, "APPOINTMENT", nextAppointments);

    const result: Record<string, any> = {
      metrics: {
        customers,
        services,
        professionals,
        todayAppointments,
        pendingAppointments,
        confirmedAppointments,
        completedAppointments,
        cancelledAppointments,
        monthlyAppointments
      },
      nextAppointments: nextAppointmentsWithValues,
      todayAppointmentsList: todayAppointmentsWithValues,
      todayProfessionals: todayProfessionals.map(p => ({
        id: p.professionalId,
        name: p.professional.name
      })),
      topServices: topServicesResult,
      plan: {
        name: planFeatures.planName,
        slug: planFeatures.planSlug,
        maxAppointmentsPerMonth: planFeatures.maxAppointmentsPerMonth,
        usedAppointmentsThisMonth: monthlyAppointments
      }
    };

    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
