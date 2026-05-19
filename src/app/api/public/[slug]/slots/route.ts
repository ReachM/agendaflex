import { AppointmentStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { ApiError, handleApiError, ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/public/[slug]/slots?date=YYYY-MM-DD&serviceId=xxx&professionalId=xxx
 * Returns available time slots for a given date, service and professional.
 * No authentication required — this is a public endpoint.
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const url = request.nextUrl;
    const dateStr = url.searchParams.get("date");
    const serviceId = url.searchParams.get("serviceId");
    const professionalId = url.searchParams.get("professionalId");

    if (!dateStr || !serviceId || !professionalId) {
      throw new ApiError(422, "Parâmetros obrigatórios: date, serviceId, professionalId.");
    }

    // Find company
    const company = await prisma.company.findUnique({
      where: { slug },
      select: { id: true, status: true, publicBookingEnabled: true }
    });

    if (!company || company.status !== "ACTIVE" || !company.publicBookingEnabled) {
      throw new ApiError(404, "Página de agendamento não encontrada ou desativada.");
    }

    // Get booking settings
    const settings = await prisma.publicBookingSettings.findUnique({
      where: { companyId: company.id }
    });

    const slotInterval = settings?.slotIntervalMinutes ?? 30;
    const minNoticeHours = settings?.minNoticeHours ?? 1;
    const maxDaysAhead = settings?.maxDaysAhead ?? 30;

    // Validate service and professional
    const [service, professional] = await Promise.all([
      prisma.service.findFirst({
        where: { id: serviceId, companyId: company.id, isActive: true, isPublic: true }
      }),
      prisma.professional.findFirst({
        where: { id: professionalId, companyId: company.id, isActive: true }
      })
    ]);

    if (!service) throw new ApiError(422, "Serviço indisponível.");
    if (!professional) throw new ApiError(422, "Profissional indisponível.");

    // Parse date and validate range
    const requestedDate = new Date(`${dateStr}T00:00:00`);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + maxDaysAhead);

    if (requestedDate < today) {
      return ok({ slots: [], message: "Data no passado." });
    }
    if (requestedDate > maxDate) {
      return ok({ slots: [], message: "Data além do limite permitido." });
    }

    // Working hours: default 8h-18h (can be customized via professional.workingHours)
    let startHour = 8;
    let endHour = 18;
    const dayOfWeek = requestedDate.getDay(); // 0=Sunday

    if (professional.workingHours && typeof professional.workingHours === "object") {
      const wh = professional.workingHours as Record<string, { start?: number; end?: number; off?: boolean }>;
      const dayKey = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][dayOfWeek];
      const dayConfig = wh[dayKey];
      if (dayConfig?.off) {
        return ok({ slots: [], message: "Profissional não atende nesse dia." });
      }
      if (dayConfig?.start !== undefined) startHour = dayConfig.start;
      if (dayConfig?.end !== undefined) endHour = dayConfig.end;
    }

    // Sunday off by default
    if (dayOfWeek === 0) {
      return ok({ slots: [], message: "Não há atendimento aos domingos." });
    }

    // Get existing appointments for this day/professional
    const dayStart = new Date(requestedDate);
    dayStart.setHours(startHour, 0, 0, 0);
    const dayEnd = new Date(requestedDate);
    dayEnd.setHours(endHour, 0, 0, 0);

    const existingAppointments = await prisma.appointment.findMany({
      where: {
        companyId: company.id,
        professionalId: professional.id,
        status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
        startAt: { lt: dayEnd },
        endAt: { gt: dayStart }
      },
      select: { startAt: true, endAt: true }
    });

    // Generate time slots
    const serviceDuration = service.durationMinutes;
    const slots: { time: string; startAt: string; endAt: string; available: boolean }[] = [];
    const minNotice = new Date(now.getTime() + minNoticeHours * 60 * 60 * 1000);

    for (let minutes = startHour * 60; minutes + serviceDuration <= endHour * 60; minutes += slotInterval) {
      const slotStart = new Date(requestedDate);
      slotStart.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
      const slotEnd = new Date(slotStart.getTime() + serviceDuration * 60 * 1000);

      // Check if slot is in the past or too soon
      if (slotStart < minNotice) continue;

      // Check for conflicts with existing appointments
      const hasConflict = existingAppointments.some(appt => {
        const apptStart = new Date(appt.startAt);
        const apptEnd = new Date(appt.endAt);
        return slotStart < apptEnd && slotEnd > apptStart;
      });

      const timeStr = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

      slots.push({
        time: timeStr,
        startAt: slotStart.toISOString(),
        endAt: slotEnd.toISOString(),
        available: !hasConflict
      });
    }

    return ok({
      slots: slots.filter(s => s.available),
      allSlots: slots,
      serviceDuration,
      date: dateStr
    });
  } catch (error) {
    return handleApiError(error);
  }
}
