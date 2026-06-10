import { execSync } from "child_process";
import { readFileSync } from "fs";
import os from "os";
import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/security/auth";

// ── Métricas do servidor (Linux em produção; fallback gracioso em outras plataformas) ──

function getCpuUsage(): number {
  // Uso acumulado desde o boot via os.cpus() — síncrono e sem dependências.
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;
  for (const cpu of cpus) {
    for (const type in cpu.times) {
      totalTick += (cpu.times as Record<string, number>)[type];
    }
    totalIdle += cpu.times.idle;
  }
  if (totalTick === 0) return 0;
  return Math.round((1 - totalIdle / totalTick) * 100);
}

function getMemoryMetrics() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  return {
    totalGb: Number((totalMem / 1e9).toFixed(1)),
    usedGb: Number((usedMem / 1e9).toFixed(1)),
    freeGb: Number((freeMem / 1e9).toFixed(1)),
    usedPercent: Math.round((usedMem / totalMem) * 100),
  };
}

function getDiskMetrics() {
  // df -k / é universal no Linux; em Windows/outros, retorna null (UI mostra "—").
  try {
    const dfOutput = execSync("df -k /", { timeout: 2000, stdio: ["ignore", "pipe", "ignore"] }).toString();
    const lines = dfOutput.trim().split("\n");
    if (lines.length < 2) return null;
    const parts = lines[1].trim().split(/\s+/);
    const totalKb = parseInt(parts[1], 10);
    const usedKb = parseInt(parts[2], 10);
    const freeKb = parseInt(parts[3], 10);
    if (!totalKb) return null;
    return {
      totalGb: Number((totalKb / 1e6).toFixed(1)),
      usedGb: Number((usedKb / 1e6).toFixed(1)),
      freeGb: Number((freeKb / 1e6).toFixed(1)),
      usedPercent: Math.round((usedKb / totalKb) * 100),
    };
  } catch {
    return null;
  }
}

function getLoadAvg() {
  const [l1, l5, l15] = os.loadavg();
  return { l1: Number(l1.toFixed(2)), l5: Number(l5.toFixed(2)), l15: Number(l15.toFixed(2)) };
}

function getNetworkStats() {
  // /proc/net/dev — disponível em qualquer Linux; fallback zero em outras plataformas.
  try {
    const content = readFileSync("/proc/net/dev", "utf-8");
    const lines = content.split("\n").slice(2); // pula header
    let rxBytes = 0;
    let txBytes = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("lo:")) continue; // pula loopback
      const parts = trimmed.replace(/:/g, " ").split(/\s+/);
      rxBytes += parseInt(parts[1], 10) || 0;
      txBytes += parseInt(parts[9], 10) || 0;
    }
    return { rxGb: Number((rxBytes / 1e9).toFixed(2)), txGb: Number((txBytes / 1e9).toFixed(2)) };
  } catch {
    return { rxGb: 0, txGb: 0 };
  }
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

type EvolutionData = {
  total: number;
  connected: number;
  connecting: number;
  disconnected: number;
  instances: { name: string; state: string }[];
};

async function fetchEvolutionInstances(): Promise<EvolutionData | null> {
  const baseUrl = process.env.EVOLUTION_API_URL ?? "http://localhost:8080";
  const apiKey = process.env.EVOLUTION_API_KEY ?? "";
  try {
    const res = await fetch(`${baseUrl}/instance/fetchInstances`, {
      headers: { apikey: apiKey },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const raw = (await res.json()) as unknown;
    if (!Array.isArray(raw)) return null;
    // A Evolution API varia o shape: ora { instance: { instanceName, state } }, ora plano.
    const items = raw.map((entry) => {
      const e = entry as Record<string, unknown>;
      const inst = (e.instance ?? e) as Record<string, unknown>;
      const name = String(inst.instanceName ?? inst.name ?? "—");
      const state = String(inst.state ?? inst.connectionStatus ?? "close");
      return { name, state };
    });
    return {
      total: items.length,
      connected: items.filter((i) => i.state === "open").length,
      connecting: items.filter((i) => i.state === "connecting").length,
      disconnected: items.filter((i) => i.state === "close").length,
      instances: items,
    };
  } catch {
    return null; // Evolution API offline ou não configurada
  }
}

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
      orphanProfessionals,
      // Database connections
      activeDbConns,
      totalDbConns,
      maxDbConns
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
      prisma.professional.count({ where: { isActive: true, workingHours: { equals: null as unknown as object } } }),
      prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT count(*) FROM pg_stat_activity WHERE state = 'active' AND datname = current_database()`
      ).catch(() => [{ count: BigInt(0) }]),
      prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()`
      ).catch(() => [{ count: BigInt(0) }]),
      prisma.$queryRawUnsafe<{ setting: string }[]>(
        `SELECT setting FROM pg_settings WHERE name = 'max_connections'`
      ).catch(() => [{ setting: "100" }])
    ]);
    const dbLatencyMs = Date.now() - dbStart;

    const dbActiveConnections = Number(activeDbConns[0]?.count ?? 0);
    const dbTotalConnections = Number(totalDbConns[0]?.count ?? 0);
    const dbMaxConnections = Number(maxDbConns[0]?.setting ?? 100);

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

    const evolutionData = await fetchEvolutionInstances();

    const processUptimeSec = Math.floor(process.uptime());
    const systemUptimeSec = Math.floor(os.uptime());

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
        tables: tableSize.map(t => ({ table: t.table, rows: Number(t.rows) })),
        activeConnections: dbActiveConnections,
        totalConnections: dbTotalConnections,
        maxConnections: dbMaxConnections,
        connectionPercent: dbMaxConnections > 0
          ? Math.round((dbTotalConnections / dbMaxConnections) * 100)
          : 0
      },
      infrastructure: {
        cpu: {
          usedPercent: getCpuUsage(),
          cores: os.cpus().length,
          model: os.cpus()[0]?.model ?? "unknown",
          loadAvg: getLoadAvg()
        },
        memory: getMemoryMetrics(),
        disk: getDiskMetrics(),
        network: getNetworkStats(),
        uptime: {
          processSec: processUptimeSec,
          processLabel: formatUptime(processUptimeSec),
          systemSec: systemUptimeSec,
          systemLabel: formatUptime(systemUptimeSec)
        },
        nodeVersion: process.version,
        platform: process.platform
      },
      evolutionApi: evolutionData ?? {
        total: 0,
        connected: 0,
        connecting: 0,
        disconnected: 0,
        instances: [],
        offline: true
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
