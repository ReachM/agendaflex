import { AppointmentStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { ApiError, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { attachCustomValues, saveCustomFieldValues } from "@/lib/services/custom-field-values";
import { appointmentUpdateSchema } from "@/lib/validation/schemas";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getParams(context: RouteContext) {
  return await context.params;
}

async function ensureNoConflict(input: {
  companyId: string;
  professionalId: string;
  startAt: Date;
  endAt: Date;
  excludeId: string;
}) {
  const conflict = await prisma.appointment.findFirst({
    where: {
      companyId: input.companyId,
      professionalId: input.professionalId,
      status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
      id: { not: input.excludeId },
      startAt: { lt: input.endAt },
      endAt: { gt: input.startAt }
    }
  });

  if (conflict) {
    throw new ApiError(409, "Já existe um agendamento para este profissional nesse horário.");
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireTenant(request, "appointments:manage");
    const { id } = await getParams(context);
    const appointment = await prisma.appointment.findFirstOrThrow({
      where: { id, companyId: auth.companyId },
      include: {
        customer: true,
        service: true,
        professional: true
      }
    });
    const [withValues] = await attachCustomValues(auth.companyId, "APPOINTMENT", [appointment]);
    return ok({ appointment: withValues });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const auth = await requireTenant(request, "appointments:manage");
    const { id } = await getParams(context);
    const body = appointmentUpdateSchema.parse(await request.json());

    const oldAppointment = await prisma.appointment.findFirstOrThrow({
      where: { id, companyId: auth.companyId }
    });

    const nextCustomerId = body.customerId ?? oldAppointment.customerId;
    const nextServiceId = body.serviceId ?? oldAppointment.serviceId;
    const nextProfessionalId = body.professionalId ?? oldAppointment.professionalId;
    const nextStartAt = body.startAt ?? oldAppointment.startAt;
    const nextEndAt = body.endAt ?? oldAppointment.endAt;

    const [customer, service, professional] = await Promise.all([
      prisma.customer.findFirst({ where: { id: nextCustomerId, companyId: auth.companyId, deletedAt: null } }),
      prisma.service.findFirst({ where: { id: nextServiceId, companyId: auth.companyId, isActive: true } }),
      prisma.professional.findFirst({ where: { id: nextProfessionalId, companyId: auth.companyId, isActive: true } })
    ]);

    if (!customer) throw new ApiError(422, "Cliente não pertence ao tenant ou está indisponível.");
    if (!service) throw new ApiError(422, "Serviço não pertence ao tenant ou está inativo.");
    if (!professional) throw new ApiError(422, "Profissional não pertence ao tenant ou está inativo.");

    await ensureNoConflict({
      companyId: auth.companyId,
      professionalId: nextProfessionalId,
      startAt: nextStartAt,
      endAt: nextEndAt,
      excludeId: oldAppointment.id
    });

    const appointment = await prisma.appointment.update({
      where: { id: oldAppointment.id },
      data: {
        customerId: body.customerId,
        serviceId: body.serviceId,
        professionalId: body.professionalId,
        startAt: body.startAt,
        endAt: body.endAt,
        status: body.status,
        notes: body.notes,
        internalNotes: body.internalNotes,
        updatedById: auth.user.id
      },
      include: {
        customer: true,
        service: true,
        professional: true
      }
    });

    await saveCustomFieldValues({
      companyId: auth.companyId,
      entityType: "APPOINTMENT",
      entityId: appointment.id,
      values: body.customValues,
      partial: true
    });

    await audit(request, auth, {
      action: "appointment.update",
      entityType: "appointment",
      entityId: appointment.id,
      oldValues: oldAppointment,
      newValues: { ...appointment, customValues: body.customValues ?? {} }
    });

    const [withValues] = await attachCustomValues(auth.companyId, "APPOINTMENT", [appointment]);
    return ok({ appointment: withValues });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const auth = await requireTenant(request, "appointments:manage");
    const { id } = await getParams(context);
    const oldAppointment = await prisma.appointment.findFirstOrThrow({
      where: { id, companyId: auth.companyId }
    });
    const appointment = await prisma.appointment.update({
      where: { id: oldAppointment.id },
      data: {
        status: "CANCELLED",
        updatedById: auth.user.id
      }
    });

    await audit(request, auth, {
      action: "appointment.cancel",
      entityType: "appointment",
      entityId: appointment.id,
      oldValues: oldAppointment,
      newValues: appointment
    });

    return ok({ appointment });
  } catch (error) {
    return handleApiError(error);
  }
}
