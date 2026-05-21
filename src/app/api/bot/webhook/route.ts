import { AppointmentStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiError, ok, ApiError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/security/rate-limit";

const webhookBodySchema = z.object({
  event: z.string().min(1),
  eventId: z.string().optional(),
  companyId: z.string().min(1),
  data: z.record(z.unknown()).optional()
});

/**
 * Validate webhook secret: the x-webhook-secret header must match the company's botWebhookSecret.
 */
async function validateWebhook(request: NextRequest, companyId: string) {
  const secret = request.headers.get("x-webhook-secret");
  if (!secret) {
    throw new ApiError(401, "Webhook secret não fornecido.");
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, botEnabled: true, botWebhookSecret: true }
  });

  if (!company || !company.botEnabled) {
    throw new ApiError(401, "Empresa não encontrada ou bot não ativo.");
  }

  if (company.botWebhookSecret !== secret) {
    throw new ApiError(401, "Webhook secret inválido.");
  }

  return company;
}

/**
 * Check idempotency: if this eventId was already processed, skip.
 */
async function checkIdempotency(companyId: string, eventId: string | undefined, event: string): Promise<boolean> {
  if (!eventId) return false; // No eventId means we can't deduplicate

  const existing = await prisma.botWebhookEvent.findUnique({
    where: { companyId_eventId: { companyId, eventId } }
  });

  if (existing) return true; // Already processed

  // Record the event
  await prisma.botWebhookEvent.create({
    data: { companyId, eventId, event }
  });

  return false;
}

/**
 * Create audit log entry for webhook events (no user context available).
 */
async function auditWebhook(
  request: NextRequest,
  companyId: string,
  action: string,
  entityType: string,
  entityId?: string,
  details?: unknown
) {
  const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ?? "unknown";

  await prisma.auditLog.create({
    data: {
      companyId,
      userId: null,
      action,
      entityType,
      entityId: entityId ?? null,
      newValues: details ? JSON.parse(JSON.stringify(details)) : undefined,
      ipAddress,
      userAgent: request.headers.get("user-agent") ?? "ChatBotService"
    }
  });
}

/**
 * Handle appointment.created event.
 * Reuses existing conflict checking logic.
 */
async function handleAppointmentCreated(companyId: string, data: Record<string, unknown>, request: NextRequest) {
  const schema = z.object({
    customerPhone: z.string().min(8),
    customerName: z.string().min(1),
    serviceId: z.string().min(1),
    professionalId: z.string().min(1),
    startsAt: z.string().min(1)
  });

  const parsed = schema.parse(data);

  // Validate service and professional belong to the company
  const [service, professional] = await Promise.all([
    prisma.service.findFirst({ where: { id: parsed.serviceId, companyId, isActive: true } }),
    prisma.professional.findFirst({ where: { id: parsed.professionalId, companyId, isActive: true } })
  ]);

  if (!service) throw new ApiError(422, "Serviço não encontrado ou inativo.");
  if (!professional) throw new ApiError(422, "Profissional não encontrado ou inativo.");

  // Find or create customer
  let customer = await prisma.customer.findFirst({
    where: { companyId, phone: parsed.customerPhone, deletedAt: null }
  });

  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        companyId,
        name: parsed.customerName,
        phone: parsed.customerPhone
      }
    });
  }

  const startAt = new Date(parsed.startsAt);
  const endAt = new Date(startAt.getTime() + service.durationMinutes * 60 * 1000);

  // Check conflict (same logic as existing appointments route)
  const conflict = await prisma.appointment.findFirst({
    where: {
      companyId,
      professionalId: parsed.professionalId,
      status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
      startAt: { lt: endAt },
      endAt: { gt: startAt }
    }
  });

  if (conflict) {
    throw new ApiError(409, "Já existe um agendamento para este profissional nesse horário.");
  }

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
    }
  });

  await auditWebhook(request, companyId, "APPOINTMENT_CREATED_BY_BOT_WEBHOOK", "appointment", appointment.id, {
    customerName: parsed.customerName,
    serviceName: service.name,
    professionalName: professional.name,
    startsAt: parsed.startsAt
  });

  return appointment;
}

/**
 * Handle appointment.confirmed event.
 */
async function handleAppointmentConfirmed(companyId: string, data: Record<string, unknown>, request: NextRequest) {
  const appointmentId = String(data.appointmentId ?? "");
  if (!appointmentId) throw new ApiError(422, "appointmentId obrigatório.");

  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, companyId }
  });

  if (!appointment) throw new ApiError(404, "Agendamento não encontrado.");

  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: "CONFIRMED" }
  });

  await auditWebhook(request, companyId, "APPOINTMENT_CONFIRMED_BY_BOT_WEBHOOK", "appointment", appointment.id, {
    oldStatus: appointment.status,
    newStatus: "CONFIRMED"
  });

  return updated;
}

/**
 * Handle appointment.cancelled event.
 */
async function handleAppointmentCancelled(companyId: string, data: Record<string, unknown>, request: NextRequest) {
  const appointmentId = String(data.appointmentId ?? "");
  if (!appointmentId) throw new ApiError(422, "appointmentId obrigatório.");

  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, companyId }
  });

  if (!appointment) throw new ApiError(404, "Agendamento não encontrado.");

  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: "CANCELLED", canceledAt: new Date() }
  });

  await auditWebhook(request, companyId, "APPOINTMENT_CANCELLED_BY_BOT_WEBHOOK", "appointment", appointment.id, {
    oldStatus: appointment.status,
    newStatus: "CANCELLED"
  });

  return updated;
}

/**
 * POST /api/bot/webhook
 * Receives events from the ChatBot Service.
 * Validates webhook secret, checks idempotency, and processes events.
 */
export async function POST(request: NextRequest) {
  try {
    rateLimit("bot-webhook", 100, 60_000);

    const rawBody = await request.json();
    const body = webhookBodySchema.parse(rawBody);

    // Validate webhook secret against company
    await validateWebhook(request, body.companyId);

    // Check idempotency
    const isDuplicate = await checkIdempotency(body.companyId, body.eventId, body.event);
    if (isDuplicate) {
      return ok({ received: true, duplicate: true });
    }

    const data = (body.data ?? {}) as Record<string, unknown>;

    switch (body.event) {
      case "appointment.created":
        await handleAppointmentCreated(body.companyId, data, request);
        break;

      case "appointment.confirmed":
        await handleAppointmentConfirmed(body.companyId, data, request);
        break;

      case "appointment.cancelled":
        await handleAppointmentCancelled(body.companyId, data, request);
        break;

      case "human_escalation":
        await auditWebhook(request, body.companyId, "BOT_HUMAN_ESCALATION_REQUESTED", "bot", undefined, data);
        break;

      case "reminder.sent":
        await auditWebhook(request, body.companyId, "BOT_REMINDER_SENT", "bot", undefined, data);
        break;

      default:
        // Unknown event — log and return 200
        console.warn(`[Bot Webhook] Evento desconhecido: ${body.event}`);
        await auditWebhook(request, body.companyId, "BOT_UNKNOWN_EVENT", "bot", undefined, {
          event: body.event,
          data
        });
        break;
    }

    return ok({ received: true });
  } catch (error) {
    return handleApiError(error);
  }
}
