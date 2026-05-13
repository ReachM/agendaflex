import { AppointmentStatus, type Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { ApiError, created, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { attachCustomValues, saveCustomFieldValues } from "@/lib/services/custom-field-values";
import { appointmentCreateSchema, listQuerySchema } from "@/lib/validation/schemas";

async function assertRelatedRecords(companyId: string, customerId: string, serviceId: string, professionalId: string) {
  const [customer, service, professional] = await Promise.all([
    prisma.customer.findFirst({ where: { id: customerId, companyId, deletedAt: null } }),
    prisma.service.findFirst({ where: { id: serviceId, companyId, isActive: true } }),
    prisma.professional.findFirst({ where: { id: professionalId, companyId, isActive: true } })
  ]);

  if (!customer) throw new ApiError(422, "Cliente não pertence ao tenant ou está indisponível.");
  if (!service) throw new ApiError(422, "Serviço não pertence ao tenant ou está inativo.");
  if (!professional) throw new ApiError(422, "Profissional não pertence ao tenant ou está inativo.");
}

async function ensureNoConflict(input: {
  companyId: string;
  professionalId: string;
  startAt: Date;
  endAt: Date;
  excludeId?: string;
}) {
  const conflict = await prisma.appointment.findFirst({
    where: {
      companyId: input.companyId,
      professionalId: input.professionalId,
      status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
      ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
      startAt: { lt: input.endAt },
      endAt: { gt: input.startAt }
    }
  });

  if (conflict) {
    throw new ApiError(409, "Já existe um agendamento para este profissional nesse horário.");
  }
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireTenant(request, "appointments:manage");
    const query = listQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const where: Prisma.AppointmentWhereInput = {
      companyId: context.companyId,
      ...(query.status ? { status: query.status as AppointmentStatus } : {}),
      ...(query.professionalId ? { professionalId: query.professionalId } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.serviceId ? { serviceId: query.serviceId } : {}),
      ...(query.from || query.to
        ? {
            startAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {})
            }
          }
        : {})
    };

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        customer: true,
        service: true,
        professional: true
      },
      orderBy: { startAt: "asc" },
      take: 200
    });

    return ok({ appointments: await attachCustomValues(context.companyId, "APPOINTMENT", appointments) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "appointments:manage");
    const body = appointmentCreateSchema.parse(await request.json());

    await assertRelatedRecords(context.companyId, body.customerId, body.serviceId, body.professionalId);
    await ensureNoConflict({
      companyId: context.companyId,
      professionalId: body.professionalId,
      startAt: body.startAt,
      endAt: body.endAt
    });

    const appointment = await prisma.appointment.create({
      data: {
        companyId: context.companyId,
        customerId: body.customerId,
        serviceId: body.serviceId,
        professionalId: body.professionalId,
        startAt: body.startAt,
        endAt: body.endAt,
        status: body.status,
        notes: body.notes,
        internalNotes: body.internalNotes,
        createdById: context.user.id,
        updatedById: context.user.id
      },
      include: {
        customer: true,
        service: true,
        professional: true
      }
    });

    await saveCustomFieldValues({
      companyId: context.companyId,
      entityType: "APPOINTMENT",
      entityId: appointment.id,
      values: body.customValues
    });

    await audit(request, context, {
      action: "appointment.create",
      entityType: "appointment",
      entityId: appointment.id,
      newValues: { ...appointment, customValues: body.customValues ?? {} }
    });

    const [withValues] = await attachCustomValues(context.companyId, "APPOINTMENT", [appointment]);
    return created({ appointment: withValues });
  } catch (error) {
    return handleApiError(error);
  }
}
