import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiError, ok, ApiError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { requireBotToken } from "@/middleware/require-bot-token";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const statusSchema = z.object({
  status: z.enum(["confirmed", "cancelled"])
});

/**
 * PATCH /api/bot/data/appointments/:id
 * Update appointment status via bot (confirm or cancel only).
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { companyId } = await requireBotToken(request);
    const { id } = await context.params;

    const body = statusSchema.parse(await request.json());

    // Find appointment strictly within the bot's company
    const appointment = await prisma.appointment.findFirst({
      where: { id, companyId }
    });

    if (!appointment) {
      throw new ApiError(404, "Agendamento não encontrado.");
    }

    const newStatus = body.status.toUpperCase() as "CONFIRMED" | "CANCELLED";

    const updateData: Record<string, unknown> = {
      status: newStatus
    };

    if (newStatus === "CANCELLED") {
      updateData.canceledAt = new Date();
    }

    const updated = await prisma.appointment.update({
      where: { id: appointment.id },
      data: updateData,
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
        action: "APPOINTMENT_STATUS_UPDATED_BY_BOT",
        entityType: "appointment",
        entityId: appointment.id,
        oldValues: JSON.parse(JSON.stringify({ status: appointment.status })),
        newValues: JSON.parse(JSON.stringify({ status: newStatus })),
        ipAddress,
        userAgent: request.headers.get("user-agent") ?? "ChatBotService"
      }
    });

    return ok({
      id: updated.id,
      customerName: updated.customer.name,
      customerPhone: updated.customer.phone,
      professionalName: updated.professional.name,
      serviceName: updated.service?.name ?? null,
      startsAt: updated.startAt.toISOString(),
      status: updated.status.toLowerCase()
    });
  } catch (error) {
    return handleApiError(error);
  }
}
