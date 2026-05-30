import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/security/auth";

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);

    const dbStart = Date.now();
    const [
      // Volume metrics
      totalCompanies,
      activeCompanies,
      suspendedCompanies,
      totalUsers,
      activeUsers,
      totalCustomers,
      appointmentsToday,
      appointmentsLast7d,
      appointmentsLast30d,
      // Notifications
      notificationsLast24h,
      notificationsFailedLast24h,
      // Bot
      botConversations24h,
      botInstancesActive,
      // Reminders
      remindersLast24h,
      // Errors / problems
      invoiceErrors,
      cancelledLast30d,
      // Audit
      auditLast24h,
      recentAudit,
      // Integrity checks
      companiesWithoutSubs,
      orphanProfessionals
    ] = await Promise.all([
      prisma.company.count(),
      prisma.company.count({ where: { status: "ACTIVE" } }),
      prisma.company.count({ where: { status: { in: ["SUSPENDED", "INACTIVE"] } } }),
      prisma.user.count(),
      prisma.user.count({ where: { auditLogs: { some: { createdAt: { gte: last30d } } } } }),
      prisma.customer.count({ where: { deletedAt: null } }),
      prisma.appointment.count({ where: { startAt: { gte: startOfDay } } }),
      prisma.appointment.count({ where: { startAt: { gte: last7d } } }),
      prisma.appointment.count({ where: { startAt: { gte: last30d } } }),
      prisma.notificationLog.count({ where: { createdAt: { gte: last24h } } }),
      prisma.notificationLog.count({ where: { createdAt: { gte: last24h }, status: "FAILED" } }),
      prisma.botConversationState.count({ where: { updatedAt: { gte: last24h } } }),
      prisma.companyBotConfig.count({ where: { whatsappInstance: { not: null }, company: { botEnabled: true } } }),
      prisma.sentReminder.count({ where: { sentAt: { gte: last24h } } }),
      prisma.invoiceRequest.count({ where: { status: "CANCELLED", updatedAt: { gte: last7d } } }),
      prisma.companySubscription.count({ where: { status: "CANCELLED", canceledAt: { gte: last30d } } }),
      prisma.auditLog.count({ where: { createdAt: { gte: last24h } } }),
      prisma.auditLog.findMany({
        where: { createdAt: { gte: last24h } },
        include: {
          user: { select: { id: true, name: true, email: true } },
          company: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: "desc" },
        take: 15
      }),
      prisma.company.count({
        where: { status: "ACTIVE", subscriptions: { none: { status: { in: ["ACTIVE", "TRIALING"] } } } }
      }),
      prisma.professional.count({ where: { isActive: true, workingHours: { equals: null as unknown as object } } })
    ]);
    const dbLatencyMs = Date.now() - dbStart;

    // Status assessment
    const notificationFailRate = notificationsLast24h > 0
      ? Number(((notificationsFailedLast24h / notificationsLast24h) * 100).toFixed(1))
      : 0;

    const overall =
      notificationFailRate > 20 || suspendedCompanies > activeCompanies * 0.2 ? "DEGRADED" :
      notificationFailRate > 5 || invoiceErrors > 10 ? "WARNING" :
      "HEALTHY";

    // Database section
    const tableSize = await prisma.$queryRawUnsafe<{ table: string; rows: bigint }[]>(`
      SELECT relname AS table, n_live_tup AS rows
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
      ORDER BY n_live_tup DESC
      LIMIT 10
    `).catch(() => [] as { table: string; rows: bigint }[]);

    return ok({
      overall,
      dbLatencyMs,
      volume: {
        totalCompanies,
        activeCompanies,
        suspendedCompanies,
        totalUsers,
        activeUsers,
        totalCustomers,
        appointmentsToday,
        appointmentsLast7d,
        appointmentsLast30d
      },
      notifications: {
        sent24h: notificationsLast24h,
        failed24h: notificationsFailedLast24h,
        failRate: notificationFailRate
      },
      bot: {
        conversations24h: botConversations24h,
        instancesActive: botInstancesActive,
        reminders24h: remindersLast24h
      },
      integrity: {
        companiesWithoutSubs,
        orphanProfessionals,
        invoiceErrors7d: invoiceErrors,
        cancelledSubs30d: cancelledLast30d
      },
      audit: {
        events24h: auditLast24h,
        recent: recentAudit.map(a => ({
          id: a.id,
          action: a.action,
          entityType: a.entityType,
          entityId: a.entityId,
          createdAt: a.createdAt,
          companyName: a.company?.name ?? null,
          userName: a.user?.name ?? null,
          userEmail: a.user?.email ?? null
        }))
      },
      database: {
        tables: tableSize.map(t => ({ table: t.table, rows: Number(t.rows) }))
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
