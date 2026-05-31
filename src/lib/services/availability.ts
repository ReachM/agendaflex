import { AppointmentStatus, Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";

/**
 * Lógica única de disponibilidade/conflito de agenda.
 * Fonte de verdade usada pela página pública de agendamento, pelas rotas
 * internas de appointments e pelo bot de WhatsApp — nunca duplicar.
 */

const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/**
 * Garante que não há agendamento sobreposto para o profissional no intervalo.
 * Aceita um client transacional (tx) para uso dentro de $transaction.
 */
export async function ensureNoConflict(
  input: { companyId: string; professionalId: string; startAt: Date; endAt: Date; excludeId?: string },
  db: Prisma.TransactionClient = prisma,
  message = "Já existe um agendamento para este profissional nesse horário."
): Promise<void> {
  const [conflict, timeOff] = await Promise.all([
    db.appointment.findFirst({
      where: {
        companyId: input.companyId,
        professionalId: input.professionalId,
        status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
        ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
        startAt: { lt: input.endAt },
        endAt: { gt: input.startAt }
      }
    }),
    db.professionalTimeOff.findFirst({
      where: {
        companyId: input.companyId,
        professionalId: input.professionalId,
        startAt: { lt: input.endAt },
        endAt: { gt: input.startAt }
      },
      select: { reason: true }
    })
  ]);

  if (conflict) {
    throw new ApiError(409, message);
  }
  if (timeOff) {
    throw new ApiError(409, `Profissional indisponível neste horário${timeOff.reason ? ` (${timeOff.reason})` : " (bloqueio)"}.`);
  }
}

export type AvailableSlot = { time: string; startAt: string; endAt: string; available: boolean };

export type AvailabilityResult = {
  slots: AvailableSlot[]; // apenas os disponíveis
  allSlots: AvailableSlot[];
  serviceDuration: number;
  date: string;
  message?: string;
};

/**
 * Gera os horários disponíveis para um serviço/profissional/dia, validando
 * janela de funcionamento, antecedência mínima, limite de dias e conflitos com
 * agendamentos existentes. Mesma lógica que a página pública já usava.
 */
export async function getAvailableSlots(input: {
  companyId: string;
  serviceId: string;
  professionalId: string;
  date: string; // YYYY-MM-DD
  requireServicePublic?: boolean;
}): Promise<AvailabilityResult> {
  const { companyId, serviceId, professionalId, date } = input;

  const settings = await prisma.publicBookingSettings.findUnique({ where: { companyId } });
  const slotInterval = settings?.slotIntervalMinutes ?? 30;
  const minNoticeHours = settings?.minNoticeHours ?? 1;
  const maxDaysAhead = settings?.maxDaysAhead ?? 30;

  const [service, professional] = await Promise.all([
    prisma.service.findFirst({
      where: {
        id: serviceId,
        companyId,
        isActive: true,
        ...(input.requireServicePublic ? { isPublic: true } : {})
      }
    }),
    prisma.professional.findFirst({ where: { id: professionalId, companyId, isActive: true } })
  ]);

  if (!service) throw new ApiError(422, "Serviço indisponível.");
  if (!professional) throw new ApiError(422, "Profissional indisponível.");

  const serviceDuration = service.durationMinutes;
  const empty = (message: string): AvailabilityResult => ({ slots: [], allSlots: [], serviceDuration, date, message });

  const requestedDate = new Date(`${date}T00:00:00`);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + maxDaysAhead);

  if (requestedDate < today) return empty("Data no passado.");
  if (requestedDate > maxDate) return empty("Data além do limite permitido.");

  let startMinute = 8 * 60;
  let endMinute = 18 * 60;
  const dayOfWeek = requestedDate.getDay();

  if (professional.workingHours && typeof professional.workingHours === "object") {
    // Supporta dois formatos:
    //   v1 (legado): { start: 9, end: 18, off: false }
    //   v2 (novo): { open: true, from: "09:00", to: "18:00" }   ← salvo pelo ProfessionalManager refatorado
    const wh = professional.workingHours as Record<string, { start?: number; end?: number; off?: boolean; open?: boolean; from?: string; to?: string }>;
    const dayConfig = wh[DAY_KEYS[dayOfWeek]];
    if (dayConfig) {
      // v1
      if (dayConfig.off) return empty("Profissional não atende nesse dia.");
      // v2
      if (dayConfig.open === false) return empty("Profissional não atende nesse dia.");

      if (dayConfig.start !== undefined) startMinute = dayConfig.start * 60;
      if (dayConfig.end !== undefined) endMinute = dayConfig.end * 60;
      if (dayConfig.from) {
        const [h, m] = dayConfig.from.split(":").map(Number);
        if (!Number.isNaN(h)) startMinute = h * 60 + (m || 0);
      }
      if (dayConfig.to) {
        const [h, m] = dayConfig.to.split(":").map(Number);
        if (!Number.isNaN(h)) endMinute = h * 60 + (m || 0);
      }
    }
  } else if (dayOfWeek === 0) {
    // Domingo desligado por padrão APENAS quando não há config explícita.
    return empty("Não há atendimento aos domingos.");
  }

  const dayStart = new Date(requestedDate);
  dayStart.setHours(Math.floor(startMinute / 60), startMinute % 60, 0, 0);
  const dayEnd = new Date(requestedDate);
  dayEnd.setHours(Math.floor(endMinute / 60), endMinute % 60, 0, 0);

  const [existingAppointments, dayTimeOffs] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        companyId,
        professionalId,
        status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
        startAt: { lt: dayEnd },
        endAt: { gt: dayStart }
      },
      select: { startAt: true, endAt: true }
    }),
    prisma.professionalTimeOff.findMany({
      where: {
        companyId,
        professionalId,
        startAt: { lt: dayEnd },
        endAt: { gt: dayStart }
      },
      select: { startAt: true, endAt: true }
    })
  ]);

  const minNotice = new Date(now.getTime() + minNoticeHours * 60 * 60 * 1000);
  const allSlots: AvailableSlot[] = [];

  for (let minutes = startMinute; minutes + serviceDuration <= endMinute; minutes += slotInterval) {
    const slotStart = new Date(requestedDate);
    slotStart.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    const slotEnd = new Date(slotStart.getTime() + serviceDuration * 60 * 1000);

    if (slotStart < minNotice) continue;

    const hasAppointmentConflict = existingAppointments.some((appt) => {
      const apptStart = new Date(appt.startAt);
      const apptEnd = new Date(appt.endAt);
      return slotStart < apptEnd && slotEnd > apptStart;
    });
    const hasTimeOffConflict = dayTimeOffs.some((t) => {
      const tStart = new Date(t.startAt);
      const tEnd = new Date(t.endAt);
      return slotStart < tEnd && slotEnd > tStart;
    });

    const time = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    allSlots.push({ time, startAt: slotStart.toISOString(), endAt: slotEnd.toISOString(), available: !hasAppointmentConflict && !hasTimeOffConflict });
  }

  return { slots: allSlots.filter((s) => s.available), allSlots, serviceDuration, date };
}
