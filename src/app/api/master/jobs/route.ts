import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/security/auth";

type JobInfo = {
  key: string;
  label: string;
  schedule: string;
  scheduleLabel: string;
  description: string;
  lastRunAt: string | null;
  nextRunAt: string;
  last24h: { sent: number };
};

function nextQuarterHour(from: Date): Date {
  const next = new Date(from);
  next.setSeconds(0, 0);
  const minute = next.getMinutes();
  const delta = 15 - (minute % 15 || 15);
  next.setMinutes(minute + delta);
  return next;
}

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [lastReminder, remindersLast24h] = await Promise.all([
      prisma.sentReminder.findFirst({
        orderBy: { sentAt: "desc" },
        select: { sentAt: true }
      }),
      prisma.sentReminder.count({ where: { sentAt: { gte: last24h } } })
    ]);

    const jobs: JobInfo[] = [
      {
        key: "bot-reminders",
        label: "Lembretes WhatsApp",
        schedule: "*/15 * * * *",
        scheduleLabel: "A cada 15 minutos",
        description: "Dispara lembretes de 24h e 2h para agendamentos confirmados com WhatsApp habilitado.",
        lastRunAt: lastReminder?.sentAt.toISOString() ?? null,
        nextRunAt: nextQuarterHour(now).toISOString(),
        last24h: { sent: remindersLast24h }
      }
    ];

    return ok({ jobs, now: now.toISOString() });
  } catch (error) {
    return handleApiError(error);
  }
}
