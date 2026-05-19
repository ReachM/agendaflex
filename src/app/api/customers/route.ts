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

    // Check if user can see clinical notes (sensitive data)
    const canViewClinicalNotes = hasPermission(context.roleName, "customers:manage");

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
      take: 100
    });

    // Strip sensitive fields for users without permission
    const processed = customers.map(c => {
      if (!canViewClinicalNotes) {
        return {
          ...c,
          clinicalNotes: c.clinicalNotes ? "[Restrito]" : null,
          allergies: c.allergies ? "[Restrito]" : null,
          medications: c.medications ? "[Restrito]" : null,
          preExistingConditions: c.preExistingConditions ? "[Restrito]" : null,
          requiredCare: c.requiredCare ? "[Restrito]" : null
        };
      }
      return c;
    });

    // Get company segment to determine which fields to show
    const segment = context.company.segment;

    return ok({
      customers: await attachCustomValues(context.companyId, "CUSTOMER", processed),
      segment
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
