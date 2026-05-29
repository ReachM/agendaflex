import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { requirePlanFeature } from "@/lib/security/plan-guard";

const updateRecordSchema = z.object({
  description: z.string().max(500).nullish(),
  amount: z.coerce.number().positive().optional(),
  categoryId: z.string().nullish(),
  accountId: z.string().nullish(),
  flowType: z.enum(["REVENUE", "COST", "EXPENSE"]).optional(),
  type: z.enum(["REVENUE", "DISCOUNT", "REFUND", "ADJUSTMENT"]).optional(),
  paymentStatus: z.enum(["PENDING", "PAID", "PARTIALLY_PAID", "CANCELLED", "REFUNDED"]).optional(),
  paymentMethod: z.enum(["CASH", "PIX", "CREDIT_CARD", "DEBIT_CARD", "BOLETO", "TRANSFER", "OTHER"]).nullish(),
  paidAt: z.string().nullish(),
  dueDate: z.string().nullish()
});

async function loadOwned(id: string, companyId: string) {
  const record = await prisma.financialRecord.findFirst({ where: { id, companyId } });
  if (!record) throw new ApiError(404, "Lançamento não encontrado");
  return record;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireTenant(request, "financial:view");
    await requirePlanFeature(context, "allowFinancialControl", "Controle financeiro");
    const { id } = await params;
    const record = await prisma.financialRecord.findFirst({
      where: { id, companyId: context.companyId },
      include: {
        appointment: { select: { id: true, startAt: true } },
        customer: { select: { id: true, name: true } },
        category: true,
        account: true
      }
    });
    if (!record) throw new ApiError(404, "Lançamento não encontrado");
    return ok({ record });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "financial:manage");
    await requirePlanFeature(context, "allowFinancialControl", "Controle financeiro");
    const { id } = await params;
    await loadOwned(id, context.companyId);
    const body = await request.json();
    const parsed = updateRecordSchema.parse(body);

    const updated = await prisma.financialRecord.update({
      where: { id },
      data: {
        ...(parsed.description !== undefined ? { description: parsed.description } : {}),
        ...(parsed.amount !== undefined ? { amount: parsed.amount } : {}),
        ...(parsed.categoryId !== undefined ? { categoryId: parsed.categoryId } : {}),
        ...(parsed.accountId !== undefined ? { accountId: parsed.accountId } : {}),
        ...(parsed.flowType !== undefined ? { flowType: parsed.flowType } : {}),
        ...(parsed.type !== undefined ? { type: parsed.type } : {}),
        ...(parsed.paymentStatus !== undefined ? { paymentStatus: parsed.paymentStatus } : {}),
        ...(parsed.paymentMethod !== undefined ? { paymentMethod: parsed.paymentMethod } : {}),
        ...(parsed.paidAt !== undefined ? { paidAt: parsed.paidAt ? new Date(parsed.paidAt) : null } : {}),
        ...(parsed.dueDate !== undefined ? { dueDate: parsed.dueDate ? new Date(parsed.dueDate) : null } : {})
      }
    });

    await audit(request, context, {
      action: "financial_record.update",
      entityType: "financial_record",
      entityId: id,
      newValues: parsed
    });

    return ok({ record: updated });
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

    await prisma.financialRecord.delete({ where: { id } });

    await audit(request, context, {
      action: "financial_record.delete",
      entityType: "financial_record",
      entityId: id
    });

    return ok({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
