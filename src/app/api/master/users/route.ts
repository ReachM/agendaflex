import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/security/auth";

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);

    const now = new Date();
    const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [users, lastAudits, totalUsers, activeLast30, superAdmins, totalMemberships] = await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          createdAt: true,
          systemRole: { select: { name: true } },
          memberships: {
            where: { status: "ACTIVE" },
            select: {
              status: true,
              company: { select: { id: true, name: true, slug: true, plan: true } },
              role: { select: { name: true } }
            }
          }
        }
      }),
      prisma.auditLog.groupBy({
        by: ["userId"],
        where: { userId: { not: null }, createdAt: { gte: last30 } },
        _max: { createdAt: true }
      }),
      prisma.user.count(),
      prisma.user.count({ where: { auditLogs: { some: { createdAt: { gte: last30 } } } } }),
      prisma.user.count({ where: { systemRole: { name: "SUPER_ADMIN" } } }),
      prisma.companyUser.count({ where: { status: "ACTIVE" } })
    ]);

    const lastAccessMap = new Map<string, Date>();
    for (const a of lastAudits) {
      if (a.userId && a._max.createdAt) lastAccessMap.set(a.userId, a._max.createdAt);
    }

    return ok({
      metrics: {
        totalUsers,
        activeLast30,
        superAdmins,
        totalMemberships,
        inactiveCount: totalUsers - activeLast30
      },
      users: users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        status: u.status,
        createdAt: u.createdAt,
        systemRole: u.systemRole?.name ?? null,
        memberships: u.memberships.map(m => ({
          companyId: m.company.id,
          companyName: m.company.name,
          companySlug: m.company.slug,
          plan: m.company.plan,
          roleName: m.role.name
        })),
        lastAccessAt: lastAccessMap.get(u.id) ?? null
      }))
    });
  } catch (error) {
    return handleApiError(error);
  }
}
