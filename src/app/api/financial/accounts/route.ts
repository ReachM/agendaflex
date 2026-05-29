import { NextRequest } from "next/server";
import { z } from "zod";
import { created, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { requirePlanFeature } from "@/lib/security/plan-guard";

const createAccountSchema = z.object({
  name: z.string().min(1).max(80),
  type: z.enum(["CHECKING", "SAVINGS", "CASH", "OTHER"]).default("CHECKING"),
  initialBalance: z.coerce.number().default(0),
  sortOrder: z.coerce.number().int().min(0).default(0)
});

export async function GET(request: NextRequest) {
  try {
    const context = await requireTenant(request, "financial:view");
    await requirePlanFeature(context, "allowFinancialControl", "Controle financeiro");
    const accounts = await prisma.financialAccount.findMany({
      where: { companyId: context.companyId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });

    // Compute current balance per account (initial + sum of REVENUE PAID - sum of COST/EXPENSE PAID)
    const balances = await prisma.financialRecord.groupBy({
      by: ["accountId", "flowType"],
      where: { companyId: context.companyId, accountId: { not: null }, paymentStatus: "PAID" },
      _sum: { amount: true }
    });

    const balanceMap = new Map<string, number>();
    for (const a of accounts) balanceMap.set(a.id, Number(a.initialBalance));
    for (const b of balances) {
      if (!b.accountId) continue;
      const current = balanceMap.get(b.accountId) ?? 0;
      const delta = Number(b._sum.amount ?? 0);
      balanceMap.set(b.accountId, current + (b.flowType === "REVENUE" ? delta : -delta));
    }

    return ok({
      accounts: accounts.map(a => ({
        ...a,
        initialBalance: Number(a.initialBalance),
        currentBalance: balanceMap.get(a.id) ?? Number(a.initialBalance)
      }))
    });
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
    const parsed = createAccountSchema.parse(body);

    const account = await prisma.financialAccount.create({
      data: {
        companyId: context.companyId,
        name: parsed.name,
        type: parsed.type,
        initialBalance: parsed.initialBalance,
        sortOrder: parsed.sortOrder
      }
    });

    await audit(request, context, {
      action: "financial_account.create",
      entityType: "financial_account",
      entityId: account.id,
      newValues: { name: account.name, type: account.type }
    });

    return created({ account });
  } catch (error) {
    return handleApiError(error);
  }
}
