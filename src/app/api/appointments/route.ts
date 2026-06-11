import { AppointmentStatus, type Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import type { z } from "zod";
import { ApiError, created, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import {
  canAccessAgendaFinancials,
  canAccessClinicalSensitiveFields,
  canManageAgendaFinancials,
  getAgendaPreset,
  isClinicalSensitiveFieldKey,
  isFinancialFieldKey
} from "@/config/agenda-presets";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { hasPermission } from "@/lib/security/permissions";
import { resolvePlanFeatures } from "@/lib/security/plan-guard";
import { ensureNoConflict } from "@/lib/services/availability";
import { attachCustomValues, saveCustomFieldValues } from "@/lib/services/custom-field-values";
import { buildAppointmentInfo, notifyCustomerAboutAppointment } from "@/lib/services/notifications";
import { appointmentCreateSchema, listQuerySchema } from "@/lib/validation/schemas";

async function assertRelatedRecords(companyId: string, customerId: string, serviceId: string | null, professionalId: string) {
  const [customer, service, professional] = await Promise.all([
    prisma.customer.findFirst({ where: { id: customerId, companyId, deletedAt: null } }),
    serviceId ? prisma.service.findFirst({ where: { id: serviceId, companyId, isActive: true } }) : Promise.resolve(null),
    prisma.professional.findFirst({ where: { id: professionalId, companyId, isActive: true } })
  ]);

  if (!customer) throw new ApiError(422, "Cliente não pertence ao tenant ou está indisponível.");
  if (serviceId && !service) throw new ApiError(422, "Serviço não pertence ao tenant ou está inativo.");
  if (!professional) throw new ApiError(422, "Profissional não pertence ao tenant ou está inativo.");
}

/**
 * Resolve service IDs from custom values or the primary serviceId.
 * Creates AppointmentService records with price snapshots.
 */
async function createAppointmentServices(
  companyId: string,
  appointmentId: string,
  serviceIds: string[]
) {
  if (serviceIds.length === 0) return;

  // Fetch all services for snapshots
  const services = await prisma.service.findMany({
    where: { id: { in: serviceIds }, companyId }
  });

  const creates = serviceIds.map((sid) => {
    const svc = services.find((s) => s.id === sid);
    return {
      companyId,
      appointmentId,
      serviceId: sid,
      serviceNameSnapshot: svc?.name ?? "Serviço removido",
      quantity: 1,
      unitPrice: svc?.basePrice ?? null,
      totalPrice: svc?.basePrice ?? null
    };
  });

  await prisma.appointmentService.createMany({ data: creates });
}

type AgendaAccess = {
  canSeeFinancial: boolean;
  canManageFinancial: boolean;
  canSeeClinicalSensitive: boolean;
  canUseChecklist: boolean;
  canManage: boolean;
  canChangeStatus: boolean;
};

function startAndEndOfDate(date: string) {
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function normalize(value: unknown) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(" ").toLowerCase();
  return String(value).toLowerCase();
}

function contains(value: unknown, term?: string) {
  if (!term) return true;
  return normalize(value).includes(term.toLowerCase());
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

function sanitizeAppointmentForAgenda<T extends Record<string, any>>(appointment: T, access: AgendaAccess) {
  const sanitized: Record<string, any> = {
    ...appointment,
    customValues: removeRestrictedCustomValues(appointment.customValues, access)
  };

  if (sanitized.customer) {
    sanitized.customer = {
      ...sanitized.customer,
      customValues: removeRestrictedCustomValues(sanitized.customer.customValues, access)
    };

    if (!access.canSeeClinicalSensitive) {
      delete sanitized.customer.allergies;
      delete sanitized.customer.medications;
      delete sanitized.customer.preExistingConditions;
      delete sanitized.customer.requiredCare;
      delete sanitized.customer.clinicalNotes;
      delete sanitized.customer.bloodType;
    }
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

async function attachCustomerCustomValues<T extends { customerId: string; customer?: Record<string, any> }>(
  companyId: string,
  appointments: T[]
) {
  const customerIds = [...new Set(appointments.map((appointment) => appointment.customerId).filter(Boolean))];
  if (customerIds.length === 0) return appointments;

  const values = await prisma.customFieldValue.findMany({
    where: {
      companyId,
      entityType: "CUSTOMER",
      entityId: { in: customerIds }
    },
    include: { customField: true }
  });

  const valueMap = new Map<string, Record<string, unknown>>();
  for (const value of values) {
    const current = valueMap.get(value.entityId) ?? {};
    current[value.customField.fieldKey] = value.value;
    valueMap.set(value.entityId, current);
  }

  return appointments.map((appointment) => ({
    ...appointment,
    customer: appointment.customer
      ? { ...appointment.customer, customValues: valueMap.get(appointment.customerId) ?? {} }
      : appointment.customer
  }));
}

function appointmentMatchesSegmentFilters(appointment: Record<string, any>, query: z.infer<typeof listQuerySchema>, access: AgendaAccess) {
  const customerCustom = appointment.customer?.customValues ?? {};
  const appointmentCustom = appointment.customValues ?? {};

  if (query.search) {
    const haystack = [
      appointment.customer?.name,
      appointment.customer?.phone,
      appointment.service?.name,
      appointment.professional?.name,
      Object.values(customerCustom).join(" "),
      Object.values(appointmentCustom).join(" ")
    ].join(" ");
    if (!contains(haystack, query.search)) return false;
  }

  if (query.healthInsurance && !contains(appointment.customer?.healthInsurance ?? customerCustom.convenio, query.healthInsurance)) return false;
  if (query.consultationType && !contains(appointmentCustom.tipo_de_consulta, query.consultationType)) return false;
  if (query.returns && !appointmentCustom.retorno_recomendado) return false;
  if (query.plate && !contains(customerCustom.placa_do_veiculo, query.plate)) return false;
  if (query.vehicle) {
    const vehicle = [customerCustom.modelo_do_veiculo, customerCustom.marca_veiculo, customerCustom.ano_veiculo].join(" ");
    if (!contains(vehicle, query.vehicle)) return false;
  }
  if (query.hour && !new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(appointment.startAt)).includes(query.hour)) return false;
  if (query.equipmentType && !contains(customerCustom.tipo_equipamento ?? customerCustom.equipamento, query.equipmentType)) return false;
  if (query.serialNumber && !contains(customerCustom.numero_serie, query.serialNumber)) return false;
  if (query.warranty && !contains(appointmentCustom.garantia ?? appointmentCustom.garantia_servico, query.warranty)) return false;
  if (query.paymentStatus && access.canSeeFinancial && appointment.paymentStatus !== query.paymentStatus) return false;

  return true;
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

export async function GET(request: NextRequest) {
  try {
    const context = await requireTenant(request, "appointments:manage");
    const planFeatures = await resolvePlanFeatures(context.companyId);
    const access: AgendaAccess = {
      canSeeFinancial: canAccessAgendaFinancials(context.roleName, planFeatures),
      canManageFinancial: canManageAgendaFinancials(context.roleName, planFeatures),
      canSeeClinicalSensitive: canAccessClinicalSensitiveFields(context.roleName),
      canUseChecklist: planFeatures.allowCustomerChecklist && (
        hasPermission(context.roleName, "checklists:view") ||
        hasPermission(context.roleName, "checklists:manage")
      ),
      canManage: hasPermission(context.roleName, "appointments:manage"),
      canChangeStatus: hasPermission(context.roleName, "appointments:manage")
    };
    const preset = getAgendaPreset(context.company.segment);
    const query = listQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const dateRange = query.date ? startAndEndOfDate(query.date) : undefined;
    const todayRange = query.today ? startAndEndOfDate(new Date().toISOString().slice(0, 10)) : undefined;
    const where: Prisma.AppointmentWhereInput = {
      companyId: context.companyId,
      ...(query.status ? { status: query.status as AppointmentStatus } : {}),
      ...(query.inProgress ? { status: AppointmentStatus.IN_PROGRESS } : {}),
      ...(query.completed ? { status: AppointmentStatus.COMPLETED } : {}),
      ...(query.cancelled ? { status: AppointmentStatus.CANCELLED } : {}),
      ...(query.professionalId ? { professionalId: query.professionalId } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.serviceId ? { serviceId: query.serviceId } : {}),
      ...(dateRange || todayRange
        ? {
            startAt: {
              gte: (dateRange ?? todayRange)!.start,
              lt: (dateRange ?? todayRange)!.end
            }
          }
        : query.from || query.to
        ? {
            startAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {})
            }
          }
        : {}),
      ...(query.paymentStatus && access.canSeeFinancial
        ? { paymentStatus: query.paymentStatus as never }
        : {})
    };

    const appointments = await prisma.appointment.findMany({
      where,
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
      },
      orderBy: { startAt: "asc" },
      take: 500
    });

    const withAppointmentValues = await attachCustomValues(context.companyId, "APPOINTMENT", appointments);
    const withCustomerValues = await attachCustomerCustomValues(context.companyId, withAppointmentValues);
    const filtered = withCustomerValues.filter((appointment) => appointmentMatchesSegmentFilters(appointment, query, access));
    const sanitized = filtered.map((appointment) => sanitizeAppointmentForAgenda(appointment, access));

    return ok({
      appointments: sanitized,
      agenda: {
        segment: context.company.segment,
        preset,
        access
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "appointments:manage");
    const planFeatures = await resolvePlanFeatures(context.companyId);
    const access: AgendaAccess = {
      canSeeFinancial: canAccessAgendaFinancials(context.roleName, planFeatures),
      canManageFinancial: canManageAgendaFinancials(context.roleName, planFeatures),
      canSeeClinicalSensitive: canAccessClinicalSensitiveFields(context.roleName),
      canUseChecklist: planFeatures.allowCustomerChecklist && (
        hasPermission(context.roleName, "checklists:view") ||
        hasPermission(context.roleName, "checklists:manage")
      ),
      canManage: hasPermission(context.roleName, "appointments:manage"),
      canChangeStatus: hasPermission(context.roleName, "appointments:manage")
    };
    const body = appointmentCreateSchema.parse(await request.json());

    // Extract multi-service IDs and financial data from customValues
    const cv = stripRestrictedInputValues((body.customValues ?? {}) as Record<string, unknown>, access);
    const serviceIds: string[] = Array.isArray(cv._serviceIds) ? cv._serviceIds : (body.serviceId ? [body.serviceId] : []);
    const primaryServiceId = serviceIds[0] ?? body.serviceId;

    await assertRelatedRecords(context.companyId, body.customerId, primaryServiceId, body.professionalId);
    await ensureNoConflict({
      companyId: context.companyId,
      professionalId: body.professionalId,
      startAt: body.startAt,
      endAt: body.endAt
    });

    // Calculate financial values
    const partsValue = access.canManageFinancial && typeof cv._partsValue === "number" ? cv._partsValue : null;
    const laborValue = access.canManageFinancial && typeof cv._laborValue === "number" ? cv._laborValue : null;
    const discountPercent = access.canManageFinancial && typeof cv._discountPercent === "number" ? cv._discountPercent : null;
    const grandTotal = access.canManageFinancial && typeof cv._grandTotal === "number" ? cv._grandTotal : null;

    const appointment = await prisma.appointment.create({
      data: {
        companyId: context.companyId,
        customerId: body.customerId,
        serviceId: primaryServiceId,
        professionalId: body.professionalId,
        startAt: body.startAt,
        endAt: body.endAt,
        status: body.status,
        notes: body.notes,
        internalNotes: body.internalNotes,
        partsValue,
        laborValue,
        discountPercent,
        totalValue: grandTotal,
        paymentStatus: "PENDING",
        createdById: context.user.id,
        updatedById: context.user.id
      },
      include: {
        customer: true,
        service: true,
        professional: true
      }
    });

    // Create AppointmentService records with price snapshots
    await createAppointmentServices(context.companyId, appointment.id, serviceIds);

    // Notificar cliente por e-mail (fire-and-forget). Só envia se houver e-mail
    // cadastrado e o opt-out (sendNotification: false) não tiver sido enviado.
    if (appointment.customer?.email && body.sendNotification !== false) {
      const statusLabels: Record<string, string> = {
        SCHEDULED: "Agendado",
        CONFIRMED: "Confirmado",
        IN_PROGRESS: "Em andamento",
        COMPLETED: "Concluído",
        CANCELLED: "Cancelado",
        NO_SHOW: "Não compareceu"
      };
      const info = buildAppointmentInfo({
        companyName: context.company.tradeName ?? context.company.name,
        customerName: appointment.customer.name,
        serviceName: appointment.service?.name ?? "Serviço",
        professionalName: appointment.professional?.name ?? "",
        startAt: appointment.startAt,
        status: statusLabels[appointment.status] ?? appointment.status
      });
      notifyCustomerAboutAppointment({
        companyId: context.companyId,
        appointmentId: appointment.id,
        customerId: appointment.customerId,
        customerEmail: appointment.customer.email,
        type: "APPOINTMENT_CREATED",
        info
      });
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
      companyId: context.companyId,
      entityType: "APPOINTMENT",
      entityId: appointment.id,
      values: Object.keys(cleanedValues).length > 0 ? cleanedValues : undefined
    });

    await audit(request, context, {
      action: "appointment.create",
      entityType: "appointment",
      entityId: appointment.id,
      newValues: { ...appointment, serviceIds, customValues: cleanedValues }
    });

    // Re-fetch with appointment services
    const full = await prisma.appointment.findUnique({
      where: { id: appointment.id },
      include: {
        customer: true,
        service: true,
        professional: true,
        appointmentServices: { include: { service: true } }
      }
    });

    const [withValues] = await attachCustomValues(context.companyId, "APPOINTMENT", [full!]);
    return created({ appointment: withValues });
  } catch (error) {
    return handleApiError(error);
  }
}
