import { AppointmentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolvePlanFeatures } from "@/lib/security/plan-guard";
import { sendTextMessage } from "@/lib/services/whatsapp";

/**
 * Lembretes automáticos de agendamento via WhatsApp (Evolution API).
 * Toda a lógica vive aqui (funções nomeadas) e é testável sem o cron:
 * basta chamar processReminders({ now, intervalMinutes }).
 *
 * Idempotência garantida por SentReminder(appointmentId, type) — o @@unique
 * impede qualquer duplicidade mesmo em ciclos/reinícios sobrepostos.
 */

const LOG_PREFIX = "[Bot Reminder]";

type ReminderType = "24h" | "2h";

const REMINDER_WINDOWS: { type: ReminderType; hours: number; flag: "send24h" | "send2h" }[] = [
  { type: "24h", hours: 24, flag: "send24h" },
  { type: "2h", hours: 2, flag: "send2h" }
];

type ReminderConfig = { enabled: boolean; send24h: boolean; send2h: boolean };

export type ReminderRunResult = { sent: number; skipped: number; failed: number };

function parseReminderConfig(raw: unknown): ReminderConfig {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const value = raw as Record<string, unknown>;
    return {
      enabled: value.enabled === true,
      send24h: value.send24h === true,
      send2h: value.send2h === true
    };
  }
  return { enabled: false, send24h: false, send2h: false };
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits ? `***${digits.slice(-4)}` : "***";
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

/** Monta a mensagem do lembrete no formato definido pelo produto. */
export function buildReminderMessage(input: {
  nome: string;
  servico: string;
  profissional: string;
  data: string;
  hora: string;
}): string {
  return (
    `Olá ${input.nome}! Lembrete do seu agendamento:\n` +
    `Serviço: ${input.servico} | Profissional: ${input.profissional}\n` +
    `Data: ${input.data} às ${input.hora}\n` +
    "Responda: 1 - Confirmar | 2 - Cancelar"
  );
}

async function isPlanAllowed(companyId: string, cache: Map<string, boolean>): Promise<boolean> {
  const cached = cache.get(companyId);
  if (cached !== undefined) return cached;
  const features = await resolvePlanFeatures(companyId);
  cache.set(companyId, features.allowBotIntegration);
  return features.allowBotIntegration;
}

type ReminderAppointment = {
  id: string;
  companyId: string;
  startAt: Date;
  customer: { name: string; phone: string | null; whatsapp: string | null };
  service: { name: string } | null;
  professional: { name: string };
  company: {
    botEnabled: boolean;
    botConfiguration: { reminderConfig: unknown } | null;
  };
};

/**
 * Decide e envia o lembrete de um agendamento para uma janela específica.
 * Retorna o efeito para fins de contagem/telemetria.
 */
async function sendReminderForAppointment(
  appointment: ReminderAppointment,
  window: { type: ReminderType; flag: "send24h" | "send2h" },
  planCache: Map<string, boolean>
): Promise<"sent" | "skipped" | "failed"> {
  const { companyId } = appointment;

  // Bot desligado para a empresa.
  if (!appointment.company.botEnabled) return "skipped";

  // Janela de lembrete desligada na configuração.
  const config = parseReminderConfig(appointment.company.botConfiguration?.reminderConfig);
  if (!config.enabled || !config[window.flag]) return "skipped";

  // Plano sem o recurso.
  if (!(await isPlanAllowed(companyId, planCache))) return "skipped";

  // Idempotência: já enviado este tipo para este agendamento.
  const already = await prisma.sentReminder.findUnique({
    where: { appointmentId_type: { appointmentId: appointment.id, type: window.type } }
  });
  if (already) return "skipped";

  const phone = appointment.customer.phone ?? appointment.customer.whatsapp;
  if (!phone) {
    console.warn(`${LOG_PREFIX} sem telefone company=${companyId} appointment=${appointment.id}`);
    return "skipped";
  }

  const message = buildReminderMessage({
    nome: appointment.customer.name,
    servico: appointment.service?.name ?? "serviço",
    profissional: appointment.professional.name,
    data: formatDate(appointment.startAt),
    hora: formatTime(appointment.startAt)
  });

  try {
    await sendTextMessage(companyId, phone, message);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "erro desconhecido";
    console.error(
      `${LOG_PREFIX} falha company=${companyId} appointment=${appointment.id} type=${window.type} phone=${maskPhone(phone)}: ${detail}`
    );
    return "failed";
  }

  // Só registra após envio com sucesso (o @@unique garante zero duplicado).
  try {
    await prisma.sentReminder.create({ data: { appointmentId: appointment.id, type: window.type } });
  } catch {
    // Corrida com outro ciclo: registro já existe (P2002). Mensagem já enviada — ok.
  }

  console.log(
    `${LOG_PREFIX} enviado company=${companyId} appointment=${appointment.id} type=${window.type} phone=${maskPhone(phone)}`
  );
  return "sent";
}

/**
 * Varre as janelas de 24h e 2h e dispara os lembretes elegíveis.
 * @param options.now data de referência (default: agora) — facilita testes.
 * @param options.intervalMinutes largura da banda de cada janela; deve casar
 *        com a cadência do cron (default: 15).
 */
export async function processReminders(
  options: { now?: Date; intervalMinutes?: number } = {}
): Promise<ReminderRunResult> {
  const now = options.now ?? new Date();
  const intervalMs = (options.intervalMinutes ?? 15) * 60_000;

  const result: ReminderRunResult = { sent: 0, skipped: 0, failed: 0 };
  const planCache = new Map<string, boolean>();

  for (const window of REMINDER_WINDOWS) {
    const lower = new Date(now.getTime() + window.hours * 60 * 60_000);
    const upper = new Date(lower.getTime() + intervalMs);

    const appointments = await prisma.appointment.findMany({
      where: {
        status: AppointmentStatus.SCHEDULED,
        startAt: { gte: lower, lt: upper }
      },
      select: {
        id: true,
        companyId: true,
        startAt: true,
        customer: { select: { name: true, phone: true, whatsapp: true } },
        service: { select: { name: true } },
        professional: { select: { name: true } },
        company: {
          select: {
            botEnabled: true,
            botConfiguration: { select: { reminderConfig: true } }
          }
        }
      }
    });

    for (const appointment of appointments) {
      const outcome = await sendReminderForAppointment(appointment, window, planCache);
      result[outcome] += 1;
    }
  }

  return result;
}
