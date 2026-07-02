import { AppointmentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendAppointmentReminderEmail } from "@/lib/services/notifications";

/**
 * Lembretes de agendamento por E-MAIL (24h e 2h antes), para o cliente final.
 *
 * Canal independente do lembrete via WhatsApp (bot-reminder.ts): NÃO depende do
 * bot estar ligado nem do recurso de plano — qualquer agendamento futuro com
 * e-mail do cliente recebe o lembrete. A idempotência usa as colunas
 * Appointment.reminder24hSentAt / reminder2hSentAt (o WhatsApp usa a tabela
 * SentReminder), então os dois canais nunca interferem entre si.
 *
 * Toda a lógica vive aqui e é testável sem o cron: chame
 * processEmailReminders({ now, intervalMinutes }).
 */

const LOG_PREFIX = "[Email Reminder]";

type ReminderType = "24h" | "2h";

const WINDOWS: { type: ReminderType; hours: number; column: "reminder24hSentAt" | "reminder2hSentAt" }[] = [
  { type: "24h", hours: 24, column: "reminder24hSentAt" },
  { type: "2h", hours: 2, column: "reminder2hSentAt" }
];

export type EmailReminderRunResult = { sent: number; skipped: number; failed: number };

/**
 * PURA. Banda temporal `[now + hours, now + hours + intervalMinutes)` para casar
 * com a cadência do cron: cada agendamento cai na banda uma única vez, e o filtro
 * de coluna nula garante que não haja reenvio. Testável isoladamente.
 */
export function reminderBand(
  now: Date,
  hours: number,
  intervalMinutes: number
): { lower: Date; upper: Date } {
  const lower = new Date(now.getTime() + hours * 60 * 60_000);
  const upper = new Date(lower.getTime() + intervalMinutes * 60_000);
  return { lower, upper };
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo"
  }).format(date);
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo"
  }).format(date);
}

/**
 * Varre as janelas de 24h e 2h e dispara os lembretes por e-mail elegíveis.
 * Elegibilidade: agendamento SCHEDULED/CONFIRMED (nunca cancelado), com e-mail
 * do cliente e a coluna do lembrete ainda nula. O timestamp só é gravado APÓS o
 * envio bem-sucedido — falha do provedor mantém a coluna nula e o lembrete é
 * retentado no próximo ciclo.
 *
 * @param options.now data de referência (default: agora) — facilita testes.
 * @param options.intervalMinutes largura da banda; deve casar com a cadência do
 *        cron (default: 15).
 */
export async function processEmailReminders(
  options: { now?: Date; intervalMinutes?: number } = {}
): Promise<EmailReminderRunResult> {
  const now = options.now ?? new Date();
  const intervalMinutes = options.intervalMinutes ?? 15;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://marcaiflex.com.br";

  const result: EmailReminderRunResult = { sent: 0, skipped: 0, failed: 0 };

  for (const window of WINDOWS) {
    const { lower, upper } = reminderBand(now, window.hours, intervalMinutes);

    const where: Prisma.AppointmentWhereInput = {
      status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] },
      startAt: { gte: lower, lt: upper },
      customer: { email: { not: null } },
      [window.column]: null
    };

    const appointments = await prisma.appointment.findMany({
      where,
      select: {
        id: true,
        startAt: true,
        customer: { select: { name: true, email: true } },
        service: { select: { name: true } },
        professional: { select: { name: true } },
        company: { select: { name: true, tradeName: true, phone: true, address: true, slug: true } }
      }
    });

    for (const appointment of appointments) {
      const email = appointment.customer.email;
      if (!email) {
        result.skipped += 1;
        continue;
      }

      const companyName = appointment.company.tradeName ?? appointment.company.name;
      const bookingUrl = appointment.company.slug ? `${appUrl}/agendar/${appointment.company.slug}` : null;

      try {
        await sendAppointmentReminderEmail(window.type, email, {
          customerName: appointment.customer.name,
          companyName,
          serviceName: appointment.service?.name ?? "Serviço",
          professionalName: appointment.professional.name,
          date: formatDate(appointment.startAt),
          time: formatTime(appointment.startAt),
          companyPhone: appointment.company.phone,
          companyAddress: appointment.company.address,
          bookingUrl
        });
      } catch (error) {
        const detail = error instanceof Error ? error.message : "erro desconhecido";
        console.error(`${LOG_PREFIX} falha appointment=${appointment.id} type=${window.type}: ${detail}`);
        result.failed += 1;
        continue;
      }

      // Marca como enviado SÓ após sucesso. `updateMany` com a coluna ainda nula
      // evita gravar duas vezes em corrida improvável entre ciclos.
      const marker: Prisma.AppointmentUpdateManyMutationInput = { [window.column]: now };
      await prisma.appointment.updateMany({
        where: { id: appointment.id, [window.column]: null },
        data: marker
      });

      result.sent += 1;
      console.log(`${LOG_PREFIX} enviado appointment=${appointment.id} type=${window.type}`);
    }
  }

  return result;
}
