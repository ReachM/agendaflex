import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/security/auth";

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);
    const [companies, activeCompanies, users, customers, appointments, recentLogs] = await Promise.all([
      prisma.company.count(),
      prisma.company.count({ where: { status: "ACTIVE" } }),
      prisma.user.count(),
      prisma.customer.count(),
      prisma.appointment.count(),
      prisma.auditLog.findMany({
        include: {
          user: { select: { id: true, name: true, email: true } },
          company: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: "desc" },
        take: 8
      })
    ]);

    return ok({
      metrics: {
        companies,
        activeCompanies,
        users,
        customers,
        appointments
      },
      recentLogs
    });
  } catch (error) {
    return handleApiError(error);
  }
}
