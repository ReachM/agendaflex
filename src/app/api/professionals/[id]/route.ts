import type { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { attachCustomValues, saveCustomFieldValues } from "@/lib/services/custom-field-values";
import { professionalUpdateSchema } from "@/lib/validation/schemas";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getParams(context: RouteContext) {
  return await context.params;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireTenant(request, "professionals:manage");
    const { id } = await getParams(context);
    const professional = await prisma.professional.findFirstOrThrow({
      where: { id, companyId: auth.companyId }
    });
    const [withValues] = await attachCustomValues(auth.companyId, "PROFESSIONAL", [professional]);
    return ok({ professional: withValues });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const auth = await requireTenant(request, "professionals:manage");
    const { id } = await getParams(context);
    const body = professionalUpdateSchema.parse(await request.json());
    const oldProfessional = await prisma.professional.findFirstOrThrow({
      where: { id, companyId: auth.companyId }
    });

    // Update service links if provided
    if (body.serviceIds !== undefined) {
      const ids = body.serviceIds ?? [];
      if (ids.length > 0) {
        const owned = await prisma.service.count({
          where: { id: { in: ids }, companyId: auth.companyId }
        });
        if (owned !== ids.length) throw new Error("Um ou mais serviços não pertencem à empresa");
      }
      await prisma.$transaction([
        prisma.professionalService.deleteMany({ where: { professionalId: id, companyId: auth.companyId } }),
        ...ids.map(serviceId =>
          prisma.professionalService.create({
            data: { companyId: auth.companyId, professionalId: id, serviceId }
          })
        )
      ]);
    }

    const professional = await prisma.professional.update({
      where: { id: oldProfessional.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.email !== undefined ? { email: body.email?.toLowerCase() ?? null } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.specialty !== undefined ? { specialty: body.specialty } : {}),
        ...(body.avatarUrl !== undefined ? { avatarUrl: body.avatarUrl } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.isPublic !== undefined ? { isPublic: body.isPublic } : {}),
        ...(body.workingHours !== undefined ? { workingHours: body.workingHours as Prisma.InputJsonValue } : {})
      }
    });

    await saveCustomFieldValues({
      companyId: auth.companyId,
      entityType: "PROFESSIONAL",
      entityId: professional.id,
      values: body.customValues,
      partial: true
    });

    await audit(request, auth, {
      action: "professional.update",
      entityType: "professional",
      entityId: professional.id,
      oldValues: oldProfessional,
      newValues: { ...professional, customValues: body.customValues ?? {} }
    });

    const [withValues] = await attachCustomValues(auth.companyId, "PROFESSIONAL", [professional]);
    return ok({ professional: withValues });
  } catch (error) {
    return handleApiError(error);
  }
}
