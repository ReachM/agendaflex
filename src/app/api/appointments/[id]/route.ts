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
        professional: true,
        appointmentServices: {
          include: { service: true },
          orderBy: { createdAt: "asc" }
        },
        checklists: {
          include: {
            items: { orderBy: { sortOrder: "asc" } },
            customerCopy: { select: { id: true, publicToken: true, status: true } }
          }
        }
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

    // Extract multi-service IDs and financial data from customValues
    const cv = (body.customValues ?? {}) as Record<string, unknown>;
    const serviceIds: string[] | undefined = Array.isArray(cv._serviceIds) ? cv._serviceIds : undefined;

    const nextCustomerId = body.customerId ?? oldAppointment.customerId;
    const nextServiceId = serviceIds?.[0] ?? body.serviceId ?? oldAppointment.serviceId;
    const nextProfessionalId = body.professionalId ?? oldAppointment.professionalId;
    const nextStartAt = body.startAt ?? oldAppointment.startAt;
    const nextEndAt = body.endAt ?? oldAppointment.endAt;

    const [customer, service, professional] = await Promise.all([
      prisma.customer.findFirst({ where: { id: nextCustomerId, companyId: auth.companyId, deletedAt: null } }),
      nextServiceId ? prisma.service.findFirst({ where: { id: nextServiceId, companyId: auth.companyId, isActive: true } }) : Promise.resolve(null),
      prisma.professional.findFirst({ where: { id: nextProfessionalId, companyId: auth.companyId, isActive: true } })
    ]);

    if (!customer) throw new ApiError(422, "Cliente não pertence ao tenant ou está indisponível.");
    if (nextServiceId && !service) throw new ApiError(422, "Serviço não pertence ao tenant ou está inativo.");
    if (!professional) throw new ApiError(422, "Profissional não pertence ao tenant ou está inativo.");

    await ensureNoConflict({
      companyId: auth.companyId,
      professionalId: nextProfessionalId,
      startAt: nextStartAt,
      endAt: nextEndAt,
      excludeId: oldAppointment.id
    });

    // Financial fields from custom values
    const partsValue = typeof cv._partsValue === "number" ? cv._partsValue : undefined;
    const laborValue = typeof cv._laborValue === "number" ? cv._laborValue : undefined;
    const discountPercent = typeof cv._discountPercent === "number" ? cv._discountPercent : undefined;
    const grandTotal = typeof cv._grandTotal === "number" ? cv._grandTotal : undefined;

    const appointment = await prisma.appointment.update({
      where: { id: oldAppointment.id },
      data: {
        customerId: body.customerId,
        serviceId: nextServiceId,
        professionalId: body.professionalId,
        startAt: body.startAt,
        endAt: body.endAt,
        status: body.status,
        notes: body.notes,
        internalNotes: body.internalNotes,
        ...(partsValue !== undefined ? { partsValue } : {}),
        ...(laborValue !== undefined ? { laborValue } : {}),
        ...(discountPercent !== undefined ? { discountPercent } : {}),
        ...(grandTotal !== undefined ? { totalValue: grandTotal } : {}),
        updatedById: auth.user.id
      },
      include: {
        customer: true,
        service: true,
        professional: true
      }
    });

    // Update AppointmentService records if service IDs changed
    if (serviceIds && serviceIds.length > 0) {
      // Delete old appointment services
      await prisma.appointmentService.deleteMany({
        where: { appointmentId: appointment.id, companyId: auth.companyId }
      });

      // Create new ones with snapshots
      const services = await prisma.service.findMany({
        where: { id: { in: serviceIds }, companyId: auth.companyId }
      });

      const creates = serviceIds.map((sid) => {
        const svc = services.find((s) => s.id === sid);
        return {
          companyId: auth.companyId,
          appointmentId: appointment.id,
          serviceId: sid,
          serviceNameSnapshot: svc?.name ?? "Serviço removido",
          quantity: 1,
          unitPrice: svc?.basePrice ?? null,
          totalPrice: svc?.basePrice ?? null
        };
      });

      await prisma.appointmentService.createMany({ data: creates });
    }

    // Save custom field values (filter out internal pricing keys)
    const reservedKeys = new Set(["_serviceIds", "_servicesTotal", "_grandTotal", "_totalPrice", "_partsValue", "_laborValue", "_discountPercent"]);
    const cleanedValues: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(cv)) {
      if (!reservedKeys.has(key)) {
        cleanedValues[key] = value;
      }
    }

    await saveCustomFieldValues({
      companyId: auth.companyId,
      entityType: "APPOINTMENT",
      entityId: appointment.id,
      values: Object.keys(cleanedValues).length > 0 ? cleanedValues : undefined,
      partial: true
    });

    await audit(request, auth, {
      action: "appointment.update",
      entityType: "appointment",
      entityId: appointment.id,
      oldValues: oldAppointment,
      newValues: { ...appointment, customValues: body.customValues ?? {} }
    });

    // Re-fetch with full includes
    const full = await prisma.appointment.findUnique({
      where: { id: appointment.id },
      include: {
        customer: true,
        service: true,
        professional: true,
        appointmentServices: { include: { service: true }, orderBy: { createdAt: "asc" } }
      }
    });

    const [withValues] = await attachCustomValues(auth.companyId, "APPOINTMENT", [full!]);
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
