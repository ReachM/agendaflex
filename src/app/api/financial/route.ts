import { NextRequest } from "next/server";
import { z } from "zod";
import { created, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { requirePlanFeature } from "@/lib/security/plan-guard";

const FlowType = z.enum(["REVENUE", "COST", "EXPENSE"]);
const RecordType = z.enum(["REVENUE", "DISCOUNT", "REFUND", "ADJUSTMENT"]);
const PayStatus = z.enum(["PENDING", "PAID", "PARTIALLY_PAID", "CANCELLED", "REFUNDED"]);
const PayMethod = z.enum(["CASH", "PIX", "CREDIT_CARD", "DEBIT_CARD", "BOLETO", "TRANSFER", "OTHER"]);

const createRecordSchema = z.object({
  appointmentId: z.string().nullish(),
  customerId: z.string().nullish(),
  categoryId: z.string().nullish(),
  accountId: z.string().nullish(),
  type: RecordType.default("REVENUE"),
  flowType: FlowType.default("REVENUE"),
  description: z.string().max(500).nullish(),
  amount: z.coerce.number().positive(),
  discountAmount: z.coerce.number().nullish(),
  discountPercentage: z.coerce.number().min(0).max(100).nullish(),
  paymentStatus: PayStatus.default("PENDING"),
  paymentMethod: PayMethod.nullish(),
  paidAt: z.string().nullish(),
  dueDate: z.string().nullish()
});

function parseDateMaybe(value: string | null): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireTenant(request, "financial:view");
    await requirePlanFeature(context, "allowFinancialControl", "Controle financeiro");
    const cid = context.companyId;
    const params = request.nextUrl.searchParams;
    const accountFilter = params.get("accountId") || undefined;
    const flowFilter = params.get("flow") || undefined;

    const now = new Date();
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay); endOfDay.setDate(endOfDay.getDate() + 1);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const periodFrom = parseDateMaybe(params.get("from")) ?? startOfMonth;
    const periodTo = parseDateMaybe(params.get("to")) ?? endOfMonth;

    const periodWhere = {
      companyId: cid,
      createdAt: { gte: periodFrom, lt: periodTo },
      ...(accountFilter ? { accountId: accountFilter } : {}),
      ...(flowFilter && (flowFilter === "REVENUE" || flowFilter === "COST" || flowFilter === "EXPENSE")
        ? { flowType: flowFilter as "REVENUE" | "COST" | "EXPENSE" }
        : {})
    } as const;

    const [
      records,
      categories,
      accounts,
      revenueSum,
      costSum,
      expenseSum,
      paidRevenueDay,
      paidRevenueMonth,
      receivable,
      paymentDistribution,
      topExpenseCategories,
      cashFlowRecords
    ] = await Promise.all([
      prisma.financialRecord.findMany({
        where: periodWhere,
        include: {
          appointment: { select: { id: true, startAt: true, status: true } },
          customer: { select: { id: true, name: true } },
          category: { select: { id: true, name: true, type: true, color: true } },
          account: { select: { id: true, name: true, type: true } }
        },
        orderBy: { createdAt: "desc" },
        take: 200
      }),
      prisma.financialCategory.findMany({
        where: { companyId: cid, isActive: true },
        orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { name: "asc" }]
      }),
      prisma.financialAccount.findMany({
        where: { companyId: cid, isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
      }),
      prisma.financialRecord.aggregate({
        where: { ...periodWhere, flowType: "REVENUE", paymentStatus: "PAID" },
        _sum: { amount: true }
      }),
      prisma.financialRecord.aggregate({
        where: { ...periodWhere, flowType: "COST", paymentStatus: "PAID" },
        _sum: { amount: true }
      }),
      prisma.financialRecord.aggregate({
        where: { ...periodWhere, flowType: "EXPENSE", paymentStatus: "PAID" },
        _sum: { amount: true }
      }),
      prisma.financialRecord.aggregate({
        where: { companyId: cid, flowType: "REVENUE", paymentStatus: "PAID", paidAt: { gte: startOfDay, lt: endOfDay } },
        _sum: { amount: true }
      }),
      prisma.financialRecord.aggregate({
        where: { companyId: cid, flowType: "REVENUE", paymentStatus: "PAID", paidAt: { gte: startOfMonth, lt: endOfMonth } },
        _sum: { amount: true }
      }),
      prisma.financialRecord.aggregate({
        where: { companyId: cid, flowType: "REVENUE", paymentStatus: "PENDING" },
        _sum: { amount: true },
        _count: { id: true }
      }),
      prisma.financialRecord.groupBy({
        by: ["paymentMethod"],
        where: { ...periodWhere, paymentStatus: "PAID", paymentMethod: { not: null } },
        _sum: { amount: true },
        _count: { id: true }
      }),
      prisma.financialRecord.groupBy({
        by: ["categoryId"],
        where: { ...periodWhere, flowType: "EXPENSE", categoryId: { not: null } },
        _sum: { amount: true },
        _count: { id: true },
        orderBy: { _sum: { amount: "desc" } },
        take: 6
      }),
      // 14d cash flow source — last 14 days
      prisma.financialRecord.findMany({
        where: {
          companyId: cid,
          createdAt: { gte: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) },
          ...(accountFilter ? { accountId: accountFilter } : {})
        },
        select: { amount: true, flowType: true, createdAt: true }
      })
    ]);

    // Aging buckets for PENDING revenue
    const pendingRevenue = await prisma.financialRecord.findMany({
      where: { companyId: cid, flowType: "REVENUE", paymentStatus: "PENDING", dueDate: { not: null } },
      select: { id: true, amount: true, dueDate: true, customer: { select: { id: true, name: true } }, description: true }
    });
    const aging = { upcoming: 0, overdue1to7: 0, overdue8to30: 0, overdue30plus: 0 };
    const agingItems: Array<{ id: string; amount: number; dueDate: string; customerName: string | null; description: string | null; bucket: keyof typeof aging }> = [];
    for (const r of pendingRevenue) {
      if (!r.dueDate) continue;
      const due = new Date(r.dueDate);
      const diffDays = Math.floor((due.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      const amt = Number(r.amount);
      let bucket: keyof typeof aging;
      if (diffDays >= 0) bucket = "upcoming";
      else if (diffDays >= -7) bucket = "overdue1to7";
      else if (diffDays >= -30) bucket = "overdue8to30";
      else bucket = "overdue30plus";
      aging[bucket] += amt;
      agingItems.push({ id: r.id, amount: amt, dueDate: due.toISOString(), customerName: r.customer?.name ?? null, description: r.description, bucket });
    }

    // Cash flow daily aggregation (14 days)
    const cashFlowMap = new Map<string, { date: string; revenue: number; expense: number }>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      cashFlowMap.set(key, { date: key, revenue: 0, expense: 0 });
    }
    for (const r of cashFlowRecords) {
      const key = new Date(r.createdAt).toISOString().slice(0, 10);
      const entry = cashFlowMap.get(key);
      if (!entry) continue;
      if (r.flowType === "REVENUE") entry.revenue += Number(r.amount);
      else entry.expense += Number(r.amount);
    }
    const cashFlow14d = Array.from(cashFlowMap.values());

    // DRE
    const revenueNum = Number(revenueSum._sum.amount ?? 0);
    const costNum = Number(costSum._sum.amount ?? 0);
    const expenseNum = Number(expenseSum._sum.amount ?? 0);
    const profit = revenueNum - costNum - expenseNum;
    const margin = revenueNum > 0 ? Number(((profit / revenueNum) * 100).toFixed(1)) : 0;

    // Top expense categories — enrich names
    const catIds = topExpenseCategories.map(t => t.categoryId).filter(Boolean) as string[];
    const catMap = catIds.length > 0
      ? await prisma.financialCategory.findMany({ where: { id: { in: catIds } }, select: { id: true, name: true, color: true } })
      : [];

    return ok({
      summary: {
        revenue: revenueNum,
        cost: costNum,
        expense: expenseNum,
        profit,
        margin,
        dayRevenue: Number(paidRevenueDay._sum.amount ?? 0),
        monthRevenue: Number(paidRevenueMonth._sum.amount ?? 0),
        receivable: Number(receivable._sum.amount ?? 0),
        receivableCount: receivable._count.id
      },
      cashFlow14d,
      dre: {
        revenue: revenueNum,
        cost: costNum,
        expense: expenseNum,
        profit,
        margin
      },
      aging,
      agingItems,
      topExpenseCategories: topExpenseCategories.map(c => ({
        categoryId: c.categoryId,
        categoryName: catMap.find(m => m.id === c.categoryId)?.name ?? "Sem categoria",
        color: catMap.find(m => m.id === c.categoryId)?.color ?? null,
        total: Number(c._sum.amount ?? 0),
        count: c._count.id
      })),
      paymentDistribution: paymentDistribution.map(p => ({
        method: p.paymentMethod,
        total: Number(p._sum.amount ?? 0),
        count: p._count.id
      })),
      categories,
      accounts,
      records: records.map(r => ({
        ...r,
        amount: Number(r.amount),
        discountAmount: r.discountAmount !== null ? Number(r.discountAmount) : null,
        discountPercentage: r.discountPercentage !== null ? Number(r.discountPercentage) : null
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
    const parsed = createRecordSchema.parse(body);

    // Validate category/account belong to tenant
    if (parsed.categoryId) {
      const cat = await prisma.financialCategory.findFirst({ where: { id: parsed.categoryId, companyId: context.companyId } });
      if (!cat) throw new Error("Categoria inválida");
    }
    if (parsed.accountId) {
      const acct = await prisma.financialAccount.findFirst({ where: { id: parsed.accountId, companyId: context.companyId } });
      if (!acct) throw new Error("Conta inválida");
    }

    const record = await prisma.financialRecord.create({
      data: {
        companyId: context.companyId,
        appointmentId: parsed.appointmentId || null,
        customerId: parsed.customerId || null,
        categoryId: parsed.categoryId || null,
        accountId: parsed.accountId || null,
        type: parsed.type,
        flowType: parsed.flowType,
        description: parsed.description ?? null,
        amount: parsed.amount,
        discountAmount: parsed.discountAmount ?? null,
        discountPercentage: parsed.discountPercentage ?? null,
        paymentStatus: parsed.paymentStatus,
        paymentMethod: parsed.paymentMethod ?? null,
        paidAt: parsed.paidAt ? new Date(parsed.paidAt) : null,
        dueDate: parsed.dueDate ? new Date(parsed.dueDate) : null
      }
    });

    await audit(request, context, {
      action: "financial_record.create",
      entityType: "financial_record",
      entityId: record.id,
      newValues: { id: record.id, flowType: record.flowType, amount: record.amount.toString(), description: record.description }
    });

    return created({ record });
  } catch (error) {
    return handleApiError(error);
  }
}
