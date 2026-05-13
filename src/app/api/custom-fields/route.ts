import type { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { ApiError, created, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { slugifyFieldKey } from "@/lib/custom-fields";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { customFieldCreateSchema } from "@/lib/validation/schemas";

export async function GET(request: NextRequest) {
  try {
    const context = await requireTenant(request, "custom_fields:manage");
    const entityType = request.nextUrl.searchParams.get("entityType");
    const customFields = await prisma.customField.findMany({
      where: {
        companyId: context.companyId,
        ...(entityType ? { entityType: entityType as never } : {})
      },
      orderBy: [{ entityType: "asc" }, { sortOrder: "asc" }, { label: "asc" }]
    });

    return ok({ customFields });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "custom_fields:manage");
    const body = customFieldCreateSchema.parse(await request.json());
    const fieldKey = slugifyFieldKey(body.fieldKey ?? body.label);

    if (!fieldKey) {
      throw new ApiError(422, "A chave interna do campo é inválida.");
    }

    const customField = await prisma.customField.create({
      data: {
        companyId: context.companyId,
        entityType: body.entityType,
        label: body.label,
        fieldKey,
        fieldType: body.fieldType,
        isRequired: body.isRequired,
        sortOrder: body.sortOrder,
        placeholder: body.placeholder,
        helpText: body.helpText,
        options: body.options,
        defaultValue: body.defaultValue as Prisma.InputJsonValue | undefined,
        isActive: body.isActive
      }
    });

    await audit(request, context, {
      action: "custom_field.create",
      entityType: "custom_field",
      entityId: customField.id,
      newValues: customField
    });

    return created({ customField });
  } catch (error) {
    return handleApiError(error);
  }
}
