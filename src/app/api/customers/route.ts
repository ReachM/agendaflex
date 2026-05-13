import { NextRequest } from "next/server";
import { created, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { attachCustomValues, saveCustomFieldValues } from "@/lib/services/custom-field-values";
import { customerCreateSchema, listQuerySchema } from "@/lib/validation/schemas";

function birthDate(value?: string) {
  return value ? new Date(`${value}T00:00:00.000Z`) : undefined;
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireTenant(request, "customers:manage");
    const query = listQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));

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
                { phone: { contains: query.search, mode: "insensitive" } }
              ]
            }
          : {})
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });

    return ok({ customers: await attachCustomValues(context.companyId, "CUSTOMER", customers) });
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
        cpf: body.cpf,
        birthDate: birthDate(body.birthDate),
        notes: body.notes,
        status: body.status ?? "active"
      }
    });

    await saveCustomFieldValues({
      companyId: context.companyId,
      entityType: "CUSTOMER",
      entityId: customer.id,
      values: body.customValues
    });

    await audit(request, context, {
      action: "customer.create",
      entityType: "customer",
      entityId: customer.id,
      newValues: { ...customer, customValues: body.customValues ?? {} }
    });

    const [withValues] = await attachCustomValues(context.companyId, "CUSTOMER", [customer]);
    return created({ customer: withValues });
  } catch (error) {
    return handleApiError(error);
  }
}
