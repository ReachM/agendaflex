import type { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { slugifyFieldKey } from "@/lib/custom-fields";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { customFieldUpdateSchema } from "@/lib/validation/schemas";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getParams(context: RouteContext) {
  return await context.params;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const auth = await requireSuperAdmin(request);
    const { id } = await getParams(context);
    const body = customFieldUpdateSchema.parse(await request.json());

    const oldField = await prisma.customField.findUniqueOrThrow({
      where: { id }
    });

    const customField = await prisma.customField.update({
      where: { id: oldField.id },
      data: {
        entityType: body.entityType,
        label: body.label,
        fieldKey: body.fieldKey ? slugifyFieldKey(body.fieldKey) : undefined,
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

    await audit(request, auth, {
      action: "custom_field.update",
      entityType: "custom_field",
      entityId: customField.id,
      oldValues: oldField,
      newValues: customField
    });

    return ok({ customField });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const auth = await requireSuperAdmin(request);
    const { id } = await getParams(context);

    const oldField = await prisma.customField.findUniqueOrThrow({
      where: { id }
    });

    const customField = await prisma.customField.update({
      where: { id: oldField.id },
      data: { isActive: false }
    });

    await audit(request, auth, {
      action: "custom_field.deactivate",
      entityType: "custom_field",
      entityId: customField.id,
      oldValues: oldField,
      newValues: customField
    });

    return ok({ customField });
  } catch (error) {
    return handleApiError(error);
  }
}
