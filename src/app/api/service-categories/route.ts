import { NextRequest } from "next/server";
import { z } from "zod";
import { created, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  color: z.string().max(20).nullish(),
  sortOrder: z.coerce.number().int().min(0).default(0)
});

export async function GET(request: NextRequest) {
  try {
    const context = await requireTenant(request, "services:view");
    const categories = await prisma.serviceCategory.findMany({
      where: { companyId: context.companyId, isActive: true },
      include: { _count: { select: { services: true } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });
    return ok({ categories });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "services:manage");
    const parsed = createSchema.parse(await request.json());
    const category = await prisma.serviceCategory.create({
      data: {
        companyId: context.companyId,
        name: parsed.name,
        color: parsed.color ?? null,
        sortOrder: parsed.sortOrder
      }
    });
    await audit(request, context, {
      action: "service_category.create",
      entityType: "service_category",
      entityId: category.id,
      newValues: { name: category.name }
    });
    return created({ category });
  } catch (error) {
    return handleApiError(error);
  }
}
