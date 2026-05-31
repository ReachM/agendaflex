import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { attachCustomValues, saveCustomFieldValues } from "@/lib/services/custom-field-values";
import { serviceUpdateSchema } from "@/lib/validation/schemas";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getParams(context: RouteContext) {
  return await context.params;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireTenant(request, "services:manage");
    const { id } = await getParams(context);
    const service = await prisma.service.findFirstOrThrow({
      where: { id, companyId: auth.companyId }
    });
    const [withValues] = await attachCustomValues(auth.companyId, "SERVICE", [service]);
    return ok({ service: withValues });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const auth = await requireTenant(request, "services:manage");
    const { id } = await getParams(context);
    const body = serviceUpdateSchema.parse(await request.json());
    const oldService = await prisma.service.findFirstOrThrow({
      where: { id, companyId: auth.companyId }
    });

    // Validate ownership of category/template if provided
    if (body.categoryId) {
      const cat = await prisma.serviceCategory.findFirst({
        where: { id: body.categoryId, companyId: auth.companyId }
      });
      if (!cat) throw new Error("Categoria inválida");
    }
    if (body.checklistTemplateId) {
      const tpl = await prisma.checklistTemplate.findFirst({
        where: { id: body.checklistTemplateId, companyId: auth.companyId }
      });
      if (!tpl) throw new Error("Template de checklist inválido");
    }

    const service = await prisma.service.update({
      where: { id: oldService.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.basePrice !== undefined ? { basePrice: body.basePrice } : {}),
        ...(body.durationMinutes !== undefined ? { durationMinutes: body.durationMinutes } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.isPublic !== undefined ? { isPublic: body.isPublic } : {}),
        ...(body.categoryId !== undefined ? { categoryId: body.categoryId || null } : {}),
        ...(body.checklistTemplateId !== undefined ? { checklistTemplateId: body.checklistTemplateId || null } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {})
      }
    });

    await saveCustomFieldValues({
      companyId: auth.companyId,
      entityType: "SERVICE",
      entityId: service.id,
      values: body.customValues,
      partial: true
    });

    await audit(request, auth, {
      action: "service.update",
      entityType: "service",
      entityId: service.id,
      oldValues: oldService,
      newValues: { ...service, customValues: body.customValues ?? {} }
    });

    const [withValues] = await attachCustomValues(auth.companyId, "SERVICE", [service]);
    return ok({ service: withValues });
  } catch (error) {
    return handleApiError(error);
  }
}
