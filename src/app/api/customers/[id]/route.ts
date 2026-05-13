import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { attachCustomValues, saveCustomFieldValues } from "@/lib/services/custom-field-values";
import { customerUpdateSchema } from "@/lib/validation/schemas";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getParams(context: RouteContext) {
  return await context.params;
}

function birthDate(value?: string) {
  return value ? new Date(`${value}T00:00:00.000Z`) : undefined;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireTenant(request, "customers:manage");
    const { id } = await getParams(context);
    const customer = await prisma.customer.findFirstOrThrow({
      where: { id, companyId: auth.companyId, deletedAt: null }
    });
    const [withValues] = await attachCustomValues(auth.companyId, "CUSTOMER", [customer]);
    return ok({ customer: withValues });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const auth = await requireTenant(request, "customers:manage");
    const { id } = await getParams(context);
    const body = customerUpdateSchema.parse(await request.json());
    const oldCustomer = await prisma.customer.findFirstOrThrow({
      where: { id, companyId: auth.companyId, deletedAt: null }
    });

    const customer = await prisma.customer.update({
      where: { id: oldCustomer.id },
      data: {
        name: body.name,
        email: body.email?.toLowerCase(),
        phone: body.phone,
        cpf: body.cpf,
        birthDate: body.birthDate === undefined ? undefined : birthDate(body.birthDate),
        notes: body.notes,
        status: body.status
      }
    });

    await saveCustomFieldValues({
      companyId: auth.companyId,
      entityType: "CUSTOMER",
      entityId: customer.id,
      values: body.customValues,
      partial: true
    });

    await audit(request, auth, {
      action: "customer.update",
      entityType: "customer",
      entityId: customer.id,
      oldValues: oldCustomer,
      newValues: { ...customer, customValues: body.customValues ?? {} }
    });

    const [withValues] = await attachCustomValues(auth.companyId, "CUSTOMER", [customer]);
    return ok({ customer: withValues });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const auth = await requireTenant(request, "customers:manage");
    const { id } = await getParams(context);
    const mode = request.nextUrl.searchParams.get("mode");
    const oldCustomer = await prisma.customer.findFirstOrThrow({
      where: { id, companyId: auth.companyId, deletedAt: null }
    });

    const customer =
      mode === "anonymize"
        ? await prisma.$transaction(async (tx) => {
            await tx.customFieldValue.deleteMany({
              where: {
                companyId: auth.companyId,
                entityType: "CUSTOMER",
                entityId: oldCustomer.id
              }
            });

            return tx.customer.update({
              where: { id: oldCustomer.id },
              data: {
                name: `Cliente anonimizado ${oldCustomer.id.slice(-6)}`,
                email: null,
                phone: null,
                cpf: null,
                birthDate: null,
                notes: null,
                status: "anonymized",
                anonymizedAt: new Date()
              }
            });
          })
        : await prisma.customer.update({
            where: { id: oldCustomer.id },
            data: {
              status: "deleted",
              deletedAt: new Date()
            }
          });

    await audit(request, auth, {
      action: mode === "anonymize" ? "customer.anonymize" : "customer.soft_delete",
      entityType: "customer",
      entityId: customer.id,
      oldValues: oldCustomer,
      newValues: customer
    });

    return ok({ customer });
  } catch (error) {
    return handleApiError(error);
  }
}
