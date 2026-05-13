import { NextRequest } from "next/server";
import { created, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { attachCustomValues, saveCustomFieldValues } from "@/lib/services/custom-field-values";
import { listQuerySchema, serviceCreateSchema } from "@/lib/validation/schemas";

export async function GET(request: NextRequest) {
  try {
    const context = await requireTenant(request, "services:manage");
    const query = listQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const services = await prisma.service.findMany({
      where: {
        companyId: context.companyId,
        ...(query.status ? { isActive: query.status === "active" } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                { description: { contains: query.search, mode: "insensitive" } }
              ]
            }
          : {})
      },
      orderBy: { name: "asc" },
      take: 100
    });

    return ok({ services: await attachCustomValues(context.companyId, "SERVICE", services) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "services:manage");
    const body = serviceCreateSchema.parse(await request.json());
    const service = await prisma.service.create({
      data: {
        companyId: context.companyId,
        name: body.name,
        description: body.description,
        basePrice: body.basePrice,
        durationMinutes: body.durationMinutes,
        isActive: body.isActive
      }
    });

    await saveCustomFieldValues({
      companyId: context.companyId,
      entityType: "SERVICE",
      entityId: service.id,
      values: body.customValues
    });

    await audit(request, context, {
      action: "service.create",
      entityType: "service",
      entityId: service.id,
      newValues: { ...service, customValues: body.customValues ?? {} }
    });

    const [withValues] = await attachCustomValues(context.companyId, "SERVICE", [service]);
    return created({ service: withValues });
  } catch (error) {
    return handleApiError(error);
  }
}
