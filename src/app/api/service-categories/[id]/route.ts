import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  color: z.string().max(20).nullish(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional()
});

async function loadOwned(id: string, companyId: string) {
  const cat = await prisma.serviceCategory.findFirst({ where: { id, companyId } });
  if (!cat) throw new ApiError(404, "Categoria não encontrada");
  return cat;
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "services:manage");
    const { id } = await params;
    await loadOwned(id, context.companyId);
    const parsed = patchSchema.parse(await request.json());
    const updated = await prisma.serviceCategory.update({
      where: { id },
      data: {
        ...(parsed.name !== undefined ? { name: parsed.name } : {}),
        ...(parsed.color !== undefined ? { color: parsed.color } : {}),
        ...(parsed.sortOrder !== undefined ? { sortOrder: parsed.sortOrder } : {}),
        ...(parsed.isActive !== undefined ? { isActive: parsed.isActive } : {})
      }
    });
    await audit(request, context, {
      action: "service_category.update",
      entityType: "service_category",
      entityId: id,
      newValues: parsed
    });
    return ok({ category: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "services:manage");
    const { id } = await params;
    await loadOwned(id, context.companyId);

    // Soft delete: orphan services keep working but lose link to category
    await prisma.$transaction([
      prisma.service.updateMany({ where: { categoryId: id, companyId: context.companyId }, data: { categoryId: null } }),
      prisma.serviceCategory.update({ where: { id }, data: { isActive: false } })
    ]);

    await audit(request, context, {
      action: "service_category.delete",
      entityType: "service_category",
      entityId: id
    });
    return ok({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
