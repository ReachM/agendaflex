import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { requirePlanFeature } from "@/lib/security/plan-guard";

const updateCategorySchema = z.object({
  name: z.string().min(1).max(80).optional(),
  type: z.enum(["REVENUE", "COST", "EXPENSE"]).optional(),
  color: z.string().max(20).nullish(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional()
});

async function loadOwned(id: string, companyId: string) {
  const category = await prisma.financialCategory.findFirst({ where: { id, companyId } });
  if (!category) throw new ApiError(404, "Categoria não encontrada");
  return category;
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "financial:manage");
    await requirePlanFeature(context, "allowFinancialControl", "Controle financeiro");
    const { id } = await params;
    await loadOwned(id, context.companyId);
    const body = await request.json();
    const parsed = updateCategorySchema.parse(body);

    const updated = await prisma.financialCategory.update({
      where: { id },
      data: {
        ...(parsed.name !== undefined ? { name: parsed.name } : {}),
        ...(parsed.type !== undefined ? { type: parsed.type } : {}),
        ...(parsed.color !== undefined ? { color: parsed.color } : {}),
        ...(parsed.sortOrder !== undefined ? { sortOrder: parsed.sortOrder } : {}),
        ...(parsed.isActive !== undefined ? { isActive: parsed.isActive } : {})
      }
    });

    await audit(request, context, {
      action: "financial_category.update",
      entityType: "financial_category",
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
    const context = await requireTenant(request, "financial:manage");
    await requirePlanFeature(context, "allowFinancialControl", "Controle financeiro");
    const { id } = await params;
    await loadOwned(id, context.companyId);

    // Soft delete to preserve historical FK in FinancialRecord
    await prisma.financialCategory.update({ where: { id }, data: { isActive: false } });

    await audit(request, context, {
      action: "financial_category.delete",
      entityType: "financial_category",
      entityId: id
    });

    return ok({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
