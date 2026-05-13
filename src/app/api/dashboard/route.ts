import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";

export async function GET(request: NextRequest) {
  try {
    const context = await requireTenant(request, "reports:view");
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const [
      customers,
      services,
      professionals,
      todayAppointments,
      pendingAppointments,
      completedAppointments,
      nextAppointments
    ] = await Promise.all([
      prisma.customer.count({ where: { companyId: context.companyId, deletedAt: null } }),
      prisma.service.count({ where: { companyId: context.companyId, isActive: true } }),
      prisma.professional.count({ where: { companyId: context.companyId, isActive: true } }),
      prisma.appointment.count({
        where: {
          companyId: context.companyId,
          startAt: { gte: startOfDay, lt: endOfDay }
        }
      }),
      prisma.appointment.count({ where: { companyId: context.companyId, status: { in: ["SCHEDULED", "CONFIRMED"] } } }),
      prisma.appointment.count({ where: { companyId: context.companyId, status: "COMPLETED" } }),
      prisma.appointment.findMany({
        where: {
          companyId: context.companyId,
          startAt: { gte: new Date() },
          status: { notIn: ["CANCELLED", "NO_SHOW"] }
        },
        include: {
          customer: true,
          service: true,
          professional: true
        },
        orderBy: { startAt: "asc" },
        take: 6
      })
    ]);

    return ok({
      metrics: {
        customers,
        services,
        professionals,
        todayAppointments,
        pendingAppointments,
        completedAppointments
      },
      nextAppointments
    });
  } catch (error) {
    return handleApiError(error);
  }
}
