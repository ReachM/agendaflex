import { NextRequest } from "next/server";
import { created, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { hasPermission } from "@/lib/security/permissions";
import { attachCustomValues, saveCustomFieldValues } from "@/lib/services/custom-field-values";
import { customerCreateSchema, listQuerySchema } from "@/lib/validation/schemas";

function birthDate(value?: string) {
  return value ? new Date(`${value}T00:00:00.000Z`) : undefined;
}

/** Sensitive health fields that require audit logging when changed */
const SENSITIVE_FIELDS = [
  "healthInsurance", "healthInsuranceNumber", "bloodType", "allergies",
  "medications", "preExistingConditions", "requiredCare", "clinicalNotes",
  "emergencyContact", "emergencyPhone", "legalGuardian", "legalGuardianCpf"
];

export async function GET(request: NextRequest) {
  try {
    const context = await requireTenant(request, "customers:manage");
    const query = listQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const tag = request.nextUrl.searchParams.get("tag");

    const canViewClinicalNotes = hasPermission(context.roleName, "customers:manage");

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const customers = await prisma.customer.findMany({
      where: {
        companyId: context.companyId,
        deletedAt: null,
        ...(query.status ? { status: query.status } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                { email: { contains: query.search, mode: "insensitive" } },
                { phone: { contains: query.search, mode: "insensitive" } },
                { cpf: { contains: query.search, mode: "insensitive" } }
              ]
            }
          : {})
      },
      orderBy: { createdAt: "desc" },
      take: 200
    });

    // Aggregate visits per customer (completed appointments)
    const customerIds = customers.map(c => c.id);
    const [aggregates, lastVisits] = customerIds.length > 0
      ? await Promise.all([
          prisma.appointment.groupBy({
            by: ["customerId"],
            where: { companyId: context.companyId, customerId: { in: customerIds }, status: "COMPLETED" },
            _count: { id: true },
            _sum: { totalValue: true }
          }),
          prisma.appointment.groupBy({
            by: ["customerId"],
            where: { companyId: context.companyId, customerId: { in: customerIds }, status: { notIn: ["CANCELLED", "NO_SHOW"] } },
            _max: { startAt: true }
          })
        ])
      : [[], []];

    const visitMap = new Map<string, { count: number; spent: number }>();
    for (const a of aggregates) {
      visitMap.set(a.customerId, { count: a._count.id, spent: Number(a._sum.totalValue ?? 0) });
    }
    const lastVisitMap = new Map<string, Date | null>();
    for (const a of lastVisits) {
      lastVisitMap.set(a.customerId, a._max.startAt ?? null);
    }

    function resolveTag(c: typeof customers[number], visits: number, spent: number, lastVisit: Date | null): "VIP" | "NEW" | "RECURRING" | "INACTIVE" | "REGULAR" {
      if (spent >= 1000 || visits >= 5) return "VIP";
      if (new Date(c.createdAt).getTime() >= last30.getTime()) return "NEW";
      if (lastVisit && new Date(lastVisit).getTime() < last90.getTime()) return "INACTIVE";
      if (visits >= 2) return "RECURRING";
      return "REGULAR";
    }

    const processed = customers.map(c => {
      const v = visitMap.get(c.id) ?? { count: 0, spent: 0 };
      const lastVisit = lastVisitMap.get(c.id) ?? null;
      const computedTag = resolveTag(c, v.count, v.spent, lastVisit);

      const stripped = !canViewClinicalNotes
        ? {
            ...c,
            clinicalNotes: c.clinicalNotes ? "[Restrito]" : null,
            allergies: c.allergies ? "[Restrito]" : null,
            medications: c.medications ? "[Restrito]" : null,
            preExistingConditions: c.preExistingConditions ? "[Restrito]" : null,
            requiredCare: c.requiredCare ? "[Restrito]" : null
          }
        : c;

      return {
        ...stripped,
        stats: {
          visitCount: v.count,
          totalSpent: v.spent,
          avgTicket: v.count > 0 ? Number((v.spent / v.count).toFixed(2)) : 0,
          lastVisit
        },
        tag: computedTag
      };
    });

    const filtered = tag && tag !== "all"
      ? processed.filter(c => c.tag === tag.toUpperCase())
      : processed;

    // Global metrics
    const vipCount = processed.filter(c => c.tag === "VIP").length;
    const newCount = processed.filter(c => c.tag === "NEW").length;
    const inactiveCount = processed.filter(c => c.tag === "INACTIVE").length;
    const totalSpentAll = processed.reduce((acc, c) => acc + c.stats.totalSpent, 0);
    const totalVisitsAll = processed.reduce((acc, c) => acc + c.stats.visitCount, 0);
    const avgTicketGlobal = totalVisitsAll > 0 ? Number((totalSpentAll / totalVisitsAll).toFixed(2)) : 0;
    const newThisMonth = await prisma.customer.count({ where: { companyId: context.companyId, deletedAt: null, createdAt: { gte: startOfMonth } } });

    return ok({
      customers: await attachCustomValues(context.companyId, "CUSTOMER", filtered),
      segment: context.company.segment,
      metrics: {
        total: customers.length,
        vipCount,
        newCount,
        newThisMonth,
        inactiveCount,
        avgTicket: avgTicketGlobal,
        totalSpent: totalSpentAll
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "customers:manage");
    const body = customerCreateSchema.parse(await request.json());

    const customer = await prisma.customer.create({
      data: {
        companyId: context.companyId,
        name: body.name,
        email: body.email?.toLowerCase(),
        phone: body.phone,
        whatsapp: body.whatsapp,
        cpf: body.cpf,
        rg: body.rg,
        birthDate: birthDate(body.birthDate),
        gender: body.gender,
        notes: body.notes,
        status: body.status ?? "active",
        // Address
        zipCode: body.zipCode,
        address: body.address,
        addressNumber: body.addressNumber,
        neighborhood: body.neighborhood,
        city: body.city,
        state: body.state,
        complement: body.complement,
        // Health/Clinic
        healthInsurance: body.healthInsurance,
        healthInsuranceNumber: body.healthInsuranceNumber,
        bloodType: body.bloodType,
        allergies: body.allergies,
        medications: body.medications,
        preExistingConditions: body.preExistingConditions,
        requiredCare: body.requiredCare,
        clinicalNotes: body.clinicalNotes,
        emergencyContact: body.emergencyContact,
        emergencyPhone: body.emergencyPhone,
        legalGuardian: body.legalGuardian,
        legalGuardianCpf: body.legalGuardianCpf,
        // Administrative
        origin: body.origin,
        internalNotes: body.internalNotes
      }
    });

    await saveCustomFieldValues({
      companyId: context.companyId,
      entityType: "CUSTOMER",
      entityId: customer.id,
      values: body.customValues
    });

    // Check if sensitive health fields were set — audit them
    const sensitiveData: Record<string, unknown> = {};
    for (const field of SENSITIVE_FIELDS) {
      const val = (body as Record<string, unknown>)[field];
      if (val) sensitiveData[field] = "[DADOS SENSÍVEIS REGISTRADOS]";
    }

    await audit(request, context, {
      action: "customer.create",
      entityType: "customer",
      entityId: customer.id,
      newValues: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        status: customer.status,
        ...(Object.keys(sensitiveData).length > 0 ? { sensitiveFieldsUpdated: Object.keys(sensitiveData) } : {}),
        customValues: body.customValues ?? {}
      }
    });

    const [withValues] = await attachCustomValues(context.companyId, "CUSTOMER", [customer]);
    return created({ customer: withValues });
  } catch (error) {
    return handleApiError(error);
  }
}
