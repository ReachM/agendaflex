import { NextRequest, NextResponse } from "next/server";
import { created, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { requirePlanFeature } from "@/lib/security/plan-guard";

// TODO [MVP-FUTURE] Remover bloqueio MVP quando o módulo financeiro for reativado na v2
const MVP_BLOCK = NextResponse.json(
  { error: "Funcionalidade em desenvolvimento e indisponível nesta versão." },
  { status: 403 }
);

export async function GET(request: NextRequest) {
  return MVP_BLOCK;
  try {
    const context = await requireTenant(request, "financial:view");
    await requirePlanFeature(context, "allowFinancialControl", "Controle financeiro");
    const cid = context.companyId;
    const params = request.nextUrl.searchParams;
    const periodFrom = params.get("from");
    const periodTo = params.get("to");

    const now = new Date();
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay); endOfDay.setDate(endOfDay.getDate() + 1);
    const startOfWeek = new Date(startOfDay); startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Financial records
    const whereBase = { companyId: cid } as any;
    if (typeof periodFrom === "string") whereBase.createdAt = { ...whereBase.createdAt, gte: new Date(periodFrom as string) };
    if (typeof periodTo === "string") whereBase.createdAt = { ...whereBase.createdAt, lte: new Date(periodTo as string) };

    const records = await prisma.financialRecord.findMany({
      where: whereBase,
      include: { appointment: { select: { id: true, startAt: true, status: true } }, customer: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100
    });

    // Aggregates from appointments with totalValue
    const [dayRevenue, weekRevenue, monthRevenue, totalDiscounts] = await Promise.all([
      prisma.appointment.aggregate({
        where: { companyId: cid, startAt: { gte: startOfDay, lt: endOfDay }, status: "COMPLETED", totalValue: { not: null } },
        _sum: { totalValue: true }
      }),
      prisma.appointment.aggregate({
        where: { companyId: cid, startAt: { gte: startOfWeek, lt: endOfDay }, status: "COMPLETED", totalValue: { not: null } },
        _sum: { totalValue: true }
      }),
      prisma.appointment.aggregate({
        where: { companyId: cid, startAt: { gte: startOfMonth, lt: endOfMonth }, status: "COMPLETED", totalValue: { not: null } },
        _sum: { totalValue: true }
      }),
      prisma.appointment.aggregate({
        where: { companyId: cid, discountValue: { not: null } },
        _sum: { discountValue: true }
      })
    ]);

    // Revenue by service
    const revenueByService = await prisma.appointmentService.groupBy({
      by: ["serviceId"],
      where: { companyId: cid, appointment: { status: "COMPLETED" } },
      _sum: { totalPrice: true },
      _count: { id: true },
      orderBy: { _sum: { totalPrice: "desc" } },
      take: 10
    });

    const serviceIds = revenueByService.map(r => r.serviceId);
    const serviceMap = serviceIds.length > 0
      ? await prisma.service.findMany({ where: { id: { in: serviceIds } }, select: { id: true, name: true } })
      : [];

    // Top customers
    const topCustomers = await prisma.appointment.groupBy({
      by: ["customerId"],
      where: { companyId: cid, status: "COMPLETED", totalValue: { not: null } },
      _sum: { totalValue: true },
      _count: { id: true },
      orderBy: { _sum: { totalValue: "desc" } },
      take: 10
    });

    const customerIds = topCustomers.map(c => c.customerId);
    const customerMap = customerIds.length > 0
      ? await prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, name: true } })
      : [];

    // Payment status distribution
    const paymentDistribution = await prisma.appointment.groupBy({
      by: ["paymentStatus"],
      where: { companyId: cid, paymentStatus: { not: null } },
      _count: { id: true }
    });

    return ok({
      records,
      summary: {
        dayRevenue: dayRevenue._sum.totalValue ?? 0,
        weekRevenue: weekRevenue._sum.totalValue ?? 0,
        monthRevenue: monthRevenue._sum.totalValue ?? 0,
        totalDiscounts: totalDiscounts._sum.discountValue ?? 0
      },
      revenueByService: revenueByService.map(r => ({
        serviceId: r.serviceId,
        serviceName: serviceMap.find(s => s.id === r.serviceId)?.name ?? "-",
        total: r._sum.totalPrice ?? 0,
        count: r._count.id
      })),
      topCustomers: topCustomers.map(c => ({
        customerId: c.customerId,
        customerName: customerMap.find(cu => cu.id === c.customerId)?.name ?? "-",
        totalSpent: c._sum.totalValue ?? 0,
        appointmentCount: c._count.id
      })),
      paymentDistribution
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  return MVP_BLOCK;
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "financial:manage");
    await requirePlanFeature(context, "allowFinancialControl", "Controle financeiro");
    const body = await request.json();

    const record = await prisma.financialRecord.create({
      data: {
        companyId: context.companyId,
        appointmentId: body.appointmentId || null,
        customerId: body.customerId || null,
        type: body.type ?? "REVENUE",
        description: body.description,
        amount: body.amount,
        discountAmount: body.discountAmount,
        discountPercentage: body.discountPercentage,
        paymentStatus: body.paymentStatus ?? "PENDING",
        paymentMethod: body.paymentMethod,
        paidAt: body.paidAt ? new Date(body.paidAt) : null
      }
    });

    await audit(request, context, {
      action: "financial_record.create",
      entityType: "financial_record",
      entityId: record.id,
      newValues: record
    });

    return created({ record });
  } catch (error) {
    return handleApiError(error);
  }
}
