import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/security/auth";

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);

    const now = new Date();
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [events30d, impersonations, recent] = await Promise.all([
      prisma.auditLog.count({ where: { createdAt: { gte: last30d } } }),
      prisma.auditLog.count({ where: { createdAt: { gte: last30d }, action: { contains: "impersonate", mode: "insensitive" } } }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 80,
        include: {
          user: { select: { id: true, name: true, email: true } },
          company: { select: { id: true, name: true } }
        }
      })
    ]);

    const securityActions = ["login", "logout", "password", "auth", "permission", "role"];
    const criticalActions = ["delete", "remove", "suspend", "cancel", "destroy"];

    const isSecurity = (a: string) => securityActions.some((k) => a.toLowerCase().includes(k));
    const isCritical = (a: string) => criticalActions.some((k) => a.toLowerCase().includes(k));

    const events = recent.map((a) => ({
      id: a.id,
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId,
      createdAt: a.createdAt,
      ipAddress: a.ipAddress,
      companyName: a.company?.name ?? null,
      userName: a.user?.name ?? null,
      userEmail: a.user?.email ?? null,
      severity: isCritical(a.action) ? "crit" : isSecurity(a.action) ? "warn" : a.action.toLowerCase().includes("create") ? "ok" : "info"
    }));

    return ok({
      metrics: {
        events30d,
        impersonations,
        securityEvents: events.filter((e) => e.severity === "warn").length,
        criticalEvents: events.filter((e) => e.severity === "crit").length
      },
      events
    });
  } catch (error) {
    return handleApiError(error);
  }
}
