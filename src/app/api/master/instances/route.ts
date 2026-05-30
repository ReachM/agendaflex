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

    const configs = await prisma.companyBotConfig.findMany({
      include: {
        company: {
          select: { id: true, name: true, slug: true, plan: true, status: true, botEnabled: true }
        }
      },
      orderBy: { updatedAt: "desc" }
    });

    // Aggregate conversation and reminder counts per company in two queries
    const companyIds = configs.map(c => c.companyId);

    const [conversationCounts, reminderCounts, botAppointments7d] = await Promise.all([
      companyIds.length > 0
        ? prisma.botConversationState.groupBy({
            by: ["companyId"],
            where: { companyId: { in: companyIds }, updatedAt: { gte: last24h } },
            _count: { id: true }
          })
        : Promise.resolve([] as { companyId: string; _count: { id: number } }[]),
      companyIds.length > 0
        ? prisma.sentReminder.groupBy({
            by: ["appointmentId"],
            where: { sentAt: { gte: last24h }, appointment: { companyId: { in: companyIds } } },
            _count: { id: true }
          }).then(async () => {
            const reminders = await prisma.sentReminder.findMany({
              where: { sentAt: { gte: last24h } },
              select: { appointment: { select: { companyId: true } } }
            });
            const map = new Map<string, number>();
            for (const r of reminders) {
              const cid = r.appointment.companyId;
              map.set(cid, (map.get(cid) ?? 0) + 1);
            }
            return map;
          })
        : Promise.resolve(new Map<string, number>()),
      companyIds.length > 0
        ? prisma.appointment.groupBy({
            by: ["companyId"],
            where: { companyId: { in: companyIds }, source: "BOT", createdAt: { gte: last7d } },
            _count: { id: true }
          })
        : Promise.resolve([] as { companyId: string; _count: { id: number } }[])
    ]);

    const convMap = new Map<string, number>();
    for (const c of conversationCounts) convMap.set(c.companyId, c._count.id);
    const apptMap = new Map<string, number>();
    for (const a of botAppointments7d) apptMap.set(a.companyId, a._count.id);

    // Total platform-level KPIs
    const [activeBots, instancesWithKey, totalConversations24h, totalReminders24h, totalBotAppts7d] = await Promise.all([
      prisma.company.count({ where: { botEnabled: true } }),
      prisma.companyBotConfig.count({ where: { whatsappInstance: { not: null } } }),
      prisma.botConversationState.count({ where: { updatedAt: { gte: last24h } } }),
      prisma.sentReminder.count({ where: { sentAt: { gte: last24h } } }),
      prisma.appointment.count({ where: { source: "BOT", createdAt: { gte: last7d } } })
    ]);

    return ok({
      metrics: {
        totalConfigured: configs.length,
        activeBots,
        instancesWithKey,
        totalConversations24h,
        totalReminders24h,
        totalBotAppts7d
      },
      instances: configs.map(c => {
        const conv24h = convMap.get(c.companyId) ?? 0;
        const rem24h = reminderCounts.get(c.companyId) ?? 0;
        const appts7d = apptMap.get(c.companyId) ?? 0;
        const connected = c.company.botEnabled && Boolean(c.whatsappInstance);
        const idleDays = Math.floor((now.getTime() - new Date(c.updatedAt).getTime()) / (24 * 60 * 60 * 1000));
        const health: "good" | "mid" | "low" =
          !connected ? "low" :
          conv24h > 0 || rem24h > 0 ? "good" :
          idleDays < 7 ? "mid" : "low";
        return {
          id: c.id,
          companyId: c.companyId,
          companyName: c.company.name,
          companySlug: c.company.slug,
          companyPlan: c.company.plan,
          companyStatus: c.company.status,
          botEnabled: c.company.botEnabled,
          whatsappInstance: c.whatsappInstance,
          allowBooking: c.allowBooking,
          updatedAt: c.updatedAt,
          createdAt: c.createdAt,
          stats: { conversations24h: conv24h, reminders24h: rem24h, botAppointments7d: appts7d },
          health,
          idleDays
        };
      })
    });
  } catch (error) {
    return handleApiError(error);
  }
}
