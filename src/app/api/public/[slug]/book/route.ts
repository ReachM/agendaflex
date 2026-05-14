import { AppointmentStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { ApiError, created, handleApiError, ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";

/**
 * Public booking page — no authentication required.
 * GET: Returns company info, services, professionals, available slots.
 * POST: Creates a booking request from the client.
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const company = await prisma.company.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        tradeName: true,
        segment: true,
        status: true,
        publicBookingEnabled: true,
        autoConfirmBooking: true
      }
    });

    if (!company || company.status !== "ACTIVE" || !company.publicBookingEnabled) {
      throw new ApiError(404, "Página de agendamento não encontrada ou desativada.");
    }

    const [services, professionals, publicFields] = await Promise.all([
      prisma.service.findMany({
        where: { companyId: company.id, isActive: true, isPublic: true },
        select: { id: true, name: true, description: true, basePrice: true, durationMinutes: true },
        orderBy: { name: "asc" }
      }),
      prisma.professional.findMany({
        where: { companyId: company.id, isActive: true },
        select: { id: true, name: true, specialty: true },
        orderBy: { name: "asc" }
      }),
      prisma.customField.findMany({
        where: { companyId: company.id, entityType: "APPOINTMENT", isPublic: true, isActive: true },
        select: { id: true, label: true, fieldKey: true, fieldType: true, isRequired: true, options: true, placeholder: true, helpText: true },
        orderBy: { sortOrder: "asc" }
      })
    ]);

    return ok({
      company: {
        name: company.name,
        tradeName: company.tradeName,
        segment: company.segment
      },
      services,
      professionals,
      publicFields
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const company = await prisma.company.findUnique({
      where: { slug },
      select: { id: true, status: true, publicBookingEnabled: true, autoConfirmBooking: true }
    });

    if (!company || company.status !== "ACTIVE" || !company.publicBookingEnabled) {
      throw new ApiError(404, "Página de agendamento não encontrada ou desativada.");
    }

    const body = await request.json();
    if (!body.name || !body.phone || !body.serviceId || !body.professionalId || !body.startAt || !body.endAt) {
      throw new ApiError(422, "Campos obrigatórios: nome, telefone, serviço, profissional, data/horário.");
    }

    // Validate service and professional belong to this company
    const [service, professional] = await Promise.all([
      prisma.service.findFirst({ where: { id: body.serviceId, companyId: company.id, isActive: true, isPublic: true } }),
      prisma.professional.findFirst({ where: { id: body.professionalId, companyId: company.id, isActive: true } })
    ]);

    if (!service) throw new ApiError(422, "Serviço indisponível.");
    if (!professional) throw new ApiError(422, "Profissional indisponível.");

    const startAt = new Date(body.startAt);
    const endAt = new Date(body.endAt);

    // Check for scheduling conflicts
    const conflict = await prisma.appointment.findFirst({
      where: {
        companyId: company.id,
        professionalId: body.professionalId,
        status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
        startAt: { lt: endAt },
        endAt: { gt: startAt }
      }
    });

    if (conflict) {
      throw new ApiError(409, "Horário indisponível. Por favor, escolha outro horário.");
    }

    // Find or create customer
    let customer = await prisma.customer.findFirst({
      where: {
        companyId: company.id,
        OR: [
          { phone: body.phone },
          ...(body.email ? [{ email: body.email }] : [])
        ],
        deletedAt: null
      }
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          companyId: company.id,
          name: body.name,
          phone: body.phone,
          email: body.email || null,
          notes: body.notes || null
        }
      });
    }

    const status = company.autoConfirmBooking ? AppointmentStatus.CONFIRMED : AppointmentStatus.SCHEDULED;

    const appointment = await prisma.appointment.create({
      data: {
        companyId: company.id,
        customerId: customer.id,
        serviceId: service.id,
        professionalId: professional.id,
        startAt,
        endAt,
        status,
        notes: body.notes || null,
        bookedByClient: true,
        appointmentServices: {
          create: {
            companyId: company.id,
            serviceId: service.id,
            serviceNameSnapshot: service.name,
            unitPrice: service.basePrice,
            totalPrice: service.basePrice
          }
        }
      }
    });

    await prisma.auditLog.create({
      data: {
        companyId: company.id,
        action: "appointment.public_booking",
        entityType: "appointment",
        entityId: appointment.id,
        newValues: {
          customerName: body.name,
          service: service.name,
          professional: professional.name,
          startAt: startAt.toISOString()
        },
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null
      }
    });

    return created({
      message: company.autoConfirmBooking
        ? "Agendamento confirmado com sucesso!"
        : "Solicitação de agendamento enviada. Aguarde a confirmação.",
      appointmentId: appointment.id,
      status
    });
  } catch (error) {
    return handleApiError(error);
  }
}
