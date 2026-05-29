import { NextRequest } from "next/server";
import { z } from "zod";
import { created, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { requirePlanFeature } from "@/lib/security/plan-guard";

const createCategorySchema = z.object({
  name: z.string().min(1).max(80),
  type: z.enum(["REVENUE", "COST", "EXPENSE"]),
  color: z.string().max(20).nullish(),
  sortOrder: z.coerce.number().int().min(0).default(0)
});

export async function GET(request: NextRequest) {
  try {
    const context = await requireTenant(request, "financial:view");
    await requirePlanFeature(context, "allowFinancialControl", "Controle financeiro");
    const type = request.nextUrl.searchParams.get("type");
    const items = await prisma.financialCategory.findMany({
      where: {
        companyId: context.companyId,
        isActive: true,
        ...(type && (type === "REVENUE" || type === "COST" || type === "EXPENSE") ? { type } : {})
      },
      orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { name: "asc" }]
    });
    return ok({ categories: items });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "financial:manage");
    await requirePlanFeature(context, "allowFinancialControl", "Controle financeiro");
    const body = await request.json();
    const parsed = createCategorySchema.parse(body);

    const category = await prisma.financialCategory.create({
      data: {
        companyId: context.companyId,
        name: parsed.name,
        type: parsed.type,
        color: parsed.color ?? null,
        sortOrder: parsed.sortOrder
      }
    });

    await audit(request, context, {
      action: "financial_category.create",
      entityType: "financial_category",
      entityId: category.id,
      newValues: { name: category.name, type: category.type }
    });

    return created({ category });
  } catch (error) {
    return handleApiError(error);
  }
}
