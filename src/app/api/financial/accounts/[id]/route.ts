import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { requirePlanFeature } from "@/lib/security/plan-guard";

const updateAccountSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  type: z.enum(["CHECKING", "SAVINGS", "CASH", "OTHER"]).optional(),
  initialBalance: z.coerce.number().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional()
});

async function loadOwned(id: string, companyId: string) {
  const account = await prisma.financialAccount.findFirst({ where: { id, companyId } });
  if (!account) throw new ApiError(404, "Conta não encontrada");
  return account;
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "financial:manage");
    await requirePlanFeature(context, "allowFinancialControl", "Controle financeiro");
    const { id } = await params;
    await loadOwned(id, context.companyId);
    const body = await request.json();
    const parsed = updateAccountSchema.parse(body);

    const updated = await prisma.financialAccount.update({
      where: { id },
      data: {
        ...(parsed.name !== undefined ? { name: parsed.name } : {}),
        ...(parsed.type !== undefined ? { type: parsed.type } : {}),
        ...(parsed.initialBalance !== undefined ? { initialBalance: parsed.initialBalance } : {}),
        ...(parsed.sortOrder !== undefined ? { sortOrder: parsed.sortOrder } : {}),
        ...(parsed.isActive !== undefined ? { isActive: parsed.isActive } : {})
      }
    });

    await audit(request, context, {
      action: "financial_account.update",
      entityType: "financial_account",
      entityId: id,
      newValues: parsed
    });

    return ok({ account: updated });
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

    // Soft delete to preserve historical FK
    await prisma.financialAccount.update({ where: { id }, data: { isActive: false } });

    await audit(request, context, {
      action: "financial_account.delete",
      entityType: "financial_account",
      entityId: id
    });

    return ok({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
