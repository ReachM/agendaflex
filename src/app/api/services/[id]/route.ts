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

    const service = await prisma.service.update({
      where: { id: oldService.id },
      data: {
        name: body.name,
        description: body.description,
        basePrice: body.basePrice,
        durationMinutes: body.durationMinutes,
        isActive: body.isActive
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
