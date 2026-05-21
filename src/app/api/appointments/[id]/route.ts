import { AppointmentStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { ApiError, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import {
  canAccessAgendaFinancials,
  canAccessClinicalSensitiveFields,
  canManageAgendaFinancials,
  isClinicalSensitiveFieldKey,
  isFinancialFieldKey
} from "@/config/agenda-presets";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { hasPermission } from "@/lib/security/permissions";
import { resolvePlanFeatures } from "@/lib/security/plan-guard";
import { attachCustomValues, saveCustomFieldValues } from "@/lib/services/custom-field-values";
import { buildAppointmentInfo, notifyCustomerAboutAppointment } from "@/lib/services/notifications";
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

type AgendaAccess = {
  canSeeFinancial: boolean;
  canManageFinancial: boolean;
  canSeeClinicalSensitive: boolean;
};

async function buildAgendaAccess(companyId: string, roleName: Parameters<typeof hasPermission>[0]): Promise<AgendaAccess> {
  const planFeatures = await resolvePlanFeatures(companyId);
  return {
    canSeeFinancial: canAccessAgendaFinancials(roleName, planFeatures),
    canManageFinancial: canManageAgendaFinancials(roleName, planFeatures),
    canSeeClinicalSensitive: canAccessClinicalSensitiveFields(roleName)
  };
}

function removeRestrictedCustomValues(values: unknown, access: AgendaAccess) {
  if (!values || typeof values !== "object" || Array.isArray(values)) return {};
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values as Record<string, unknown>)) {
    if (!access.canSeeFinancial && isFinancialFieldKey(key)) continue;
    if (!access.canSeeClinicalSensitive && isClinicalSensitiveFieldKey(key)) continue;
    result[key] = value;
  }
  return result;
}

function stripRestrictedInputValues(values: Record<string, unknown>, access: AgendaAccess) {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (!access.canManageFinancial && isFinancialFieldKey(key)) continue;
    if (!access.canSeeClinicalSensitive && isClinicalSensitiveFieldKey(key)) {
      throw new ApiError(403, "Permissao insuficiente para alterar dados clinicos sensiveis.");
    }
    result[key] = value;
  }
  return result;
}

function sanitizeAppointment<T extends Record<string, any>>(appointment: T, access: AgendaAccess) {
  const sanitized: Record<string, any> = {
    ...appointment,
    customValues: removeRestrictedCustomValues(appointment.customValues, access)
  };

  if (sanitized.customer && !access.canSeeClinicalSensitive) {
    sanitized.customer = { ...sanitized.customer };
    delete sanitized.customer.allergies;
    delete sanitized.customer.medications;
    delete sanitized.customer.preExistingConditions;
    delete sanitized.customer.requiredCare;
    delete sanitized.customer.clinicalNotes;
    delete sanitized.customer.bloodType;
  }

  if (!access.canSeeFinancial) {
    delete sanitized.partsValue;
    delete sanitized.laborValue;
    delete sanitized.discountPercent;
    delete sanitized.discountValue;
    delete sanitized.totalValue;
    delete sanitized.paymentStatus;
    delete sanitized.paymentMethod;
    delete sanitized.paidAt;
    if (sanitized.service) delete sanitized.service.basePrice;
    sanitized.appointmentServices = (sanitized.appointmentServices ?? []).map((item: Record<string, any>) => {
      const clean = { ...item };
      delete clean.unitPrice;
      delete clean.totalPrice;
      if (clean.service) delete clean.service.basePrice;
      return clean;
    });
  }

  return sanitized;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireTenant(request, "appointments:manage");
    const access = await buildAgendaAccess(auth.companyId, auth.roleName);
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
    return ok({ appointment: sanitizeAppointment(withValues, access) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const auth = await requireTenant(request, "appointments:manage");
    const access = await buildAgendaAccess(auth.companyId, auth.roleName);
    const { id } = await getParams(context);
    const body = appointmentUpdateSchema.parse(await request.json());
    if (body.customValues) {
      (body as Record<string, unknown>).customValues = stripRestrictedInputValues(
        body.customValues as Record<string, unknown>,
        access
      );
    }

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
    const partsValue = access.canManageFinancial && typeof cv._partsValue === "number" ? cv._partsValue : undefined;
    const laborValue = access.canManageFinancial && typeof cv._laborValue === "number" ? cv._laborValue : undefined;
    const discountPercent = access.canManageFinancial && typeof cv._discountPercent === "number" ? cv._discountPercent : undefined;
    const grandTotal = access.canManageFinancial && typeof cv._grandTotal === "number" ? cv._grandTotal : undefined;

    // Calculate lifecycle timestamps based on status transitions
    const lifecycleData: Record<string, unknown> = {};
    if (body.status && body.status !== oldAppointment.status) {
      if (body.status === "IN_PROGRESS" && !oldAppointment.startedAt) {
        lifecycleData.startedAt = new Date();
      }
      if (body.status === "COMPLETED" && !oldAppointment.completedAt) {
        lifecycleData.completedAt = new Date();
        if (!oldAppointment.startedAt) {
          lifecycleData.startedAt = new Date();
        }
      }
      if (body.status === "CANCELLED") {
        lifecycleData.canceledAt = new Date();
        const rawBody = (body as Record<string, unknown>);
        if (typeof rawBody.cancellationReason === "string") {
          lifecycleData.cancellationReason = rawBody.cancellationReason;
        }
      }
    }

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
        ...lifecycleData,
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

    // Send notifications on status changes
    if (body.status && body.status !== oldAppointment.status && appointment.customer?.email) {
      const statusNotificationMap: Record<string, Parameters<typeof notifyCustomerAboutAppointment>[0]["type"]> = {
        CONFIRMED: "APPOINTMENT_CONFIRMED",
        IN_PROGRESS: "APPOINTMENT_STARTED",
        COMPLETED: "APPOINTMENT_COMPLETED",
        CANCELLED: "APPOINTMENT_CANCELED"
      };
      const notifType = statusNotificationMap[body.status];
      if (notifType) {
        const statusLabels: Record<string, string> = {
          CONFIRMED: "Confirmado", IN_PROGRESS: "Em andamento",
          COMPLETED: "Concluído", CANCELLED: "Cancelado"
        };
        const info = buildAppointmentInfo({
          companyName: auth.company.tradeName ?? auth.company.name,
          customerName: appointment.customer.name,
          serviceName: appointment.service?.name ?? "Serviço",
          professionalName: appointment.professional.name,
          startAt: appointment.startAt,
          status: statusLabels[body.status] ?? body.status
        });
        notifyCustomerAboutAppointment({
          companyId: auth.companyId,
          appointmentId: appointment.id,
          customerId: appointment.customerId,
          customerEmail: appointment.customer.email,
          type: notifType,
          info
        });
      }
    }

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
    return ok({ appointment: sanitizeAppointment(withValues, access) });
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
