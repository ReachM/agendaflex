import type { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { ApiError, created, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { slugifyFieldKey } from "@/lib/custom-fields";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { customFieldCreateSchema } from "@/lib/validation/schemas";
import { z } from "zod";

const querySchema = z.object({
  companyId: z.string().min(1, "companyId é obrigatório"),
  entityType: z.string().optional()
});

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);
    const params = querySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    );

    // Verificar se a empresa existe
    const company = await prisma.company.findUnique({
      where: { id: params.companyId }
    });
    if (!company) {
      throw new ApiError(404, "Empresa não encontrada.");
    }

    const customFields = await prisma.customField.findMany({
      where: {
        companyId: params.companyId,
        ...(params.entityType
          ? { entityType: params.entityType as never }
          : {})
      },
      orderBy: [
        { entityType: "asc" },
        { sortOrder: "asc" },
        { label: "asc" }
      ]
    });

    return ok({ customFields, company });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const auth = await requireSuperAdmin(request);
    const rawBody = await request.json();
    const { companyId, ...fieldData } = rawBody;

    if (!companyId) {
      throw new ApiError(422, "companyId é obrigatório.");
    }

    // Verificar se a empresa existe
    const company = await prisma.company.findUnique({
      where: { id: companyId }
    });
    if (!company) {
      throw new ApiError(404, "Empresa não encontrada.");
    }

    const body = customFieldCreateSchema.parse(fieldData);
    const fieldKey = slugifyFieldKey(body.fieldKey ?? body.label);

    if (!fieldKey) {
      throw new ApiError(422, "A chave interna do campo é inválida.");
    }

    const customField = await prisma.customField.create({
      data: {
        companyId,
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

    await audit(request, auth, {
      action: "custom_field.create",
      entityType: "custom_field",
      entityId: customField.id,
      newValues: { ...customField, companyName: company.name }
    });

    return created({ customField });
  } catch (error) {
    return handleApiError(error);
  }
}
