import type { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { created, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { attachCustomValues, saveCustomFieldValues } from "@/lib/services/custom-field-values";
import { listQuerySchema, professionalCreateSchema } from "@/lib/validation/schemas";

export async function GET(request: NextRequest) {
  try {
    const context = await requireTenant(request, "professionals:view");
    const query = listQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const professionals = await prisma.professional.findMany({
      where: {
        companyId: context.companyId,
        ...(query.status ? { isActive: query.status === "active" } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                { email: { contains: query.search, mode: "insensitive" } },
                { specialty: { contains: query.search, mode: "insensitive" } }
              ]
            }
          : {})
      },
      orderBy: { name: "asc" },
      take: 100
    });

    return ok({ professionals: await attachCustomValues(context.companyId, "PROFESSIONAL", professionals) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "professionals:manage");
    const body = professionalCreateSchema.parse(await request.json());
    const professional = await prisma.professional.create({
      data: {
        companyId: context.companyId,
        name: body.name,
        email: body.email?.toLowerCase(),
        phone: body.phone,
        specialty: body.specialty,
        isActive: body.isActive,
        workingHours: body.workingHours as Prisma.InputJsonValue | undefined
      }
    });

    await saveCustomFieldValues({
      companyId: context.companyId,
      entityType: "PROFESSIONAL",
      entityId: professional.id,
      values: body.customValues
    });

    await audit(request, context, {
      action: "professional.create",
      entityType: "professional",
      entityId: professional.id,
      newValues: { ...professional, customValues: body.customValues ?? {} }
    });

    const [withValues] = await attachCustomValues(context.companyId, "PROFESSIONAL", [professional]);
    return created({ professional: withValues });
  } catch (error) {
    return handleApiError(error);
  }
}
