import { AppointmentStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiError, ok, ApiError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { requireBotToken } from "@/middleware/require-bot-token";

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  serviceId: z.string().optional(),
  professionalId: z.string().optional()
});

/**
 * GET /api/bot/data/availability?date=YYYY-MM-DD&serviceId=xxx&professionalId=xxx
 * Returns available time slots for a given date.
 * Reuses the same availability logic as the public booking slots.
 */
export async function GET(request: NextRequest) {
  try {
    const { companyId } = await requireBotToken(request);

    const params = querySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    );

    // If serviceId provided, validate and get duration
    let serviceDuration = 60; // default
    if (params.serviceId) {
      const service = await prisma.service.findFirst({
        where: { id: params.serviceId, companyId, isActive: true }
      });
      if (!service) throw new ApiError(422, "Serviço não encontrado ou inativo.");
      serviceDuration = service.durationMinutes;
    }

    // Get professionals to check availability for
    const profWhere: { companyId: string; isActive: boolean; id?: string } = {
      companyId,
      isActive: true
    };
    if (params.professionalId) {
      profWhere.id = params.professionalId;
    }

    const professionals = await prisma.professional.findMany({
      where: profWhere,
      select: { id: true, name: true, workingHours: true }
    });

    if (professionals.length === 0) {
      return ok([]);
    }

    const requestedDate = new Date(`${params.date}T00:00:00`);
    const dayOfWeek = requestedDate.getDay();
    const dayKeys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

    const now = new Date();
    const slots: { date: string; time: string; professionalId: string; professionalName: string }[] = [];

    for (const prof of professionals) {
      // Determine working hours
      let startHour = 8;
      let endHour = 18;

      if (prof.workingHours && typeof prof.workingHours === "object") {
        const wh = prof.workingHours as Record<string, { start?: number; end?: number; off?: boolean }>;
        const dayConfig = wh[dayKeys[dayOfWeek]];
        if (dayConfig?.off) continue;
        if (dayConfig?.start !== undefined) startHour = dayConfig.start;
        if (dayConfig?.end !== undefined) endHour = dayConfig.end;
      }

      // Sunday off by default
      if (dayOfWeek === 0) continue;

      // Fetch existing appointments for this professional on this day
      const dayStart = new Date(requestedDate);
      dayStart.setHours(startHour, 0, 0, 0);
      const dayEnd = new Date(requestedDate);
      dayEnd.setHours(endHour, 0, 0, 0);

      const existingAppointments = await prisma.appointment.findMany({
        where: {
          companyId,
          professionalId: prof.id,
          status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
          startAt: { lt: dayEnd },
          endAt: { gt: dayStart }
        },
        select: { startAt: true, endAt: true }
      });

      // Generate time slots (30-minute intervals)
      const slotInterval = 30;

      for (let minutes = startHour * 60; minutes + serviceDuration <= endHour * 60; minutes += slotInterval) {
        const slotStart = new Date(requestedDate);
        slotStart.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
        const slotEnd = new Date(slotStart.getTime() + serviceDuration * 60 * 1000);

        // Skip past slots
        if (slotStart < now) continue;

        // Check conflicts
        const hasConflict = existingAppointments.some((appt) => {
          const apptStart = new Date(appt.startAt);
          const apptEnd = new Date(appt.endAt);
          return slotStart < apptEnd && slotEnd > apptStart;
        });

        if (!hasConflict) {
          const timeStr = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
          slots.push({
            date: params.date,
            time: timeStr,
            professionalId: prof.id,
            professionalName: prof.name
          });
        }
      }
    }

    return ok(slots);
  } catch (error) {
    return handleApiError(error);
  }
}
