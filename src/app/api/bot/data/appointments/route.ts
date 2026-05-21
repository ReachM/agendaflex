import { AppointmentStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiError, ok, created, ApiError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { checkPlanLimit } from "@/lib/security/plan-guard";
import { requireBotToken } from "@/middleware/require-bot-token";

const appointmentQuerySchema = z.object({
  hoursAhead: z.coerce.number().int().min(1).max(720).default(48),
  status: z.string().optional(),
  phone: z.string().optional()
});

const appointmentCreateSchema = z.object({
  customerPhone: z.string().min(8).max(30),
  customerName: z.string().min(1).max(180),
  serviceId: z.string().min(1),
  professionalId: z.string().min(1),
  startsAt: z.coerce.date()
});

/**
 * GET /api/bot/data/appointments
 * Returns upcoming appointments for the bot's company.
 */
export async function GET(request: NextRequest) {
  try {
    const { companyId } = await requireBotToken(request);

    const params = appointmentQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    );

    const now = new Date();
    const ahead = new Date(now.getTime() + params.hoursAhead * 60 * 60 * 1000);

    const statusFilter = params.status
      ? [params.status as AppointmentStatus]
      : [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED];

    const where: Record<string, unknown> = {
      companyId,
      status: { in: statusFilter },
      startAt: { gte: now, lte: ahead }
    };

    // Filter by phone if provided
    if (params.phone) {
      const customer = await prisma.customer.findFirst({
        where: { companyId, phone: params.phone, deletedAt: null }
      });
      if (!customer) {
        return ok([]);
      }
      where.customerId = customer.id;
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        service: { select: { id: true, name: true } },
        professional: { select: { id: true, name: true } }
      },
      orderBy: { startAt: "asc" },
      take: 100
    });

    const mapped = appointments.map((a) => ({
      id: a.id,
      customerName: a.customer.name,
      customerPhone: a.customer.phone,
      professionalName: a.professional.name,
      serviceName: a.service?.name ?? null,
      startsAt: a.startAt.toISOString(),
      status: a.status.toLowerCase()
    }));

    return ok(mapped);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/bot/data/appointments
 * Create an appointment via the bot.
 * Reuses existing conflict-checking and plan-limit logic.
 */
export async function POST(request: NextRequest) {
  try {
    const { companyId } = await requireBotToken(request);

    const body = appointmentCreateSchema.parse(await request.json());

    // Validate service belongs to company and is active
    const service = await prisma.service.findFirst({
      where: { id: body.serviceId, companyId, isActive: true }
    });
    if (!service) throw new ApiError(422, "Serviço não encontrado ou inativo.");

    // Validate professional belongs to company and is active
    const professional = await prisma.professional.findFirst({
      where: { id: body.professionalId, companyId, isActive: true }
    });
    if (!professional) throw new ApiError(422, "Profissional não encontrado ou inativo.");

    // Find or create customer
    let customer = await prisma.customer.findFirst({
      where: { companyId, phone: body.customerPhone, deletedAt: null }
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          companyId,
          name: body.customerName,
          phone: body.customerPhone
        }
      });
    }

    // Calculate end time
    const startAt = body.startsAt;
    const endAt = new Date(startAt.getTime() + service.durationMinutes * 60 * 1000);

    // Check plan limits
    const startOfMonth = new Date(startAt.getFullYear(), startAt.getMonth(), 1);
    const endOfMonth = new Date(startAt.getFullYear(), startAt.getMonth() + 1, 1);
    const monthCount = await prisma.appointment.count({
      where: {
        companyId,
        startAt: { gte: startOfMonth, lt: endOfMonth },
        status: { not: AppointmentStatus.CANCELLED }
      }
    });
    await checkPlanLimit(companyId, "maxAppointmentsPerMonth", monthCount);

    // Check conflict (same logic as existing appointments route)
    const conflict = await prisma.appointment.findFirst({
      where: {
        companyId,
        professionalId: body.professionalId,
        status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
        startAt: { lt: endAt },
        endAt: { gt: startAt }
      }
    });

    if (conflict) {
      throw new ApiError(409, "Já existe um agendamento para este profissional nesse horário.");
    }

    // Create appointment
    const appointment = await prisma.appointment.create({
      data: {
        companyId,
        customerId: customer.id,
        serviceId: service.id,
        professionalId: professional.id,
        startAt,
        endAt,
        status: "SCHEDULED",
        source: "BOT",
        bookedByClient: true,
        paymentStatus: "PENDING"
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        service: { select: { id: true, name: true } },
        professional: { select: { id: true, name: true } }
      }
    });

    // Audit log
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ?? "unknown";

    await prisma.auditLog.create({
      data: {
        companyId,
        userId: null,
        action: "APPOINTMENT_CREATED_BY_BOT",
        entityType: "appointment",
        entityId: appointment.id,
        newValues: JSON.parse(JSON.stringify({
          customerName: customer.name,
          serviceName: service.name,
          professionalName: professional.name,
          startsAt: startAt.toISOString()
        })),
        ipAddress,
        userAgent: request.headers.get("user-agent") ?? "ChatBotService"
      }
    });

    return created({
      id: appointment.id,
      customerName: appointment.customer.name,
      customerPhone: appointment.customer.phone,
      professionalName: appointment.professional.name,
      serviceName: appointment.service?.name ?? null,
      startsAt: appointment.startAt.toISOString(),
      status: appointment.status.toLowerCase()
    });
  } catch (error) {
    return handleApiError(error);
  }
}
