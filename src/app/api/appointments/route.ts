import { AppointmentStatus, type Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { ApiError, created, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { attachCustomValues, saveCustomFieldValues } from "@/lib/services/custom-field-values";
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

/**
 * Resolve service IDs from custom values or the primary serviceId.
 * Creates AppointmentService records with price snapshots.
 */
async function createAppointmentServices(
  companyId: string,
  appointmentId: string,
  serviceIds: string[],
  customValues?: Record<string, unknown>
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
        professional: true,
        appointmentServices: {
          include: { service: true },
          orderBy: { createdAt: "asc" }
        }
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

    // Extract multi-service IDs and financial data from customValues
    const cv = (body.customValues ?? {}) as Record<string, unknown>;
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
    const partsValue = typeof cv._partsValue === "number" ? cv._partsValue : null;
    const laborValue = typeof cv._laborValue === "number" ? cv._laborValue : null;
    const discountPercent = typeof cv._discountPercent === "number" ? cv._discountPercent : null;
    const grandTotal = typeof cv._grandTotal === "number" ? cv._grandTotal : null;

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
    await createAppointmentServices(context.companyId, appointment.id, serviceIds, cv);

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
