import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/security/auth";

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);

    const now = new Date();
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      total,
      statusBreakdown,
      issuedLast30,
      cancelledLast30,
      pending,
      monthlyValue,
      withConfig,
      autoEmitCount,
      withNfeioKey,
      byCompany,
      recent
    ] = await Promise.all([
      prisma.invoiceRequest.count(),
      prisma.invoiceRequest.groupBy({
        by: ["status"],
        _count: { id: true },
        _sum: { amount: true }
      }),
      prisma.invoiceRequest.count({ where: { status: "ISSUED", issuedAt: { gte: last30d } } }),
      prisma.invoiceRequest.count({ where: { status: "CANCELLED", updatedAt: { gte: last30d } } }),
      prisma.invoiceRequest.count({ where: { status: { in: ["REQUESTED", "UNDER_REVIEW"] } } }),
      prisma.invoiceRequest.aggregate({
        where: { status: "ISSUED", issuedAt: { gte: startOfMonth } },
        _sum: { amount: true }
      }),
      prisma.companyInvoiceConfig.count(),
      prisma.companyInvoiceConfig.count({ where: { autoEmit: true, nfeioApiKey: { not: null } } }),
      prisma.companyInvoiceConfig.count({ where: { nfeioApiKey: { not: null } } }),
      prisma.invoiceRequest.groupBy({
        by: ["companyId"],
        _count: { id: true },
        _sum: { amount: true },
        orderBy: { _count: { id: "desc" } },
        take: 15
      }),
      prisma.invoiceRequest.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          company: { select: { id: true, name: true, slug: true, plan: true } },
          customer: { select: { id: true, name: true } }
        }
      })
    ]);

    const companyIds = byCompany.map(c => c.companyId);
    const companyMap = companyIds.length > 0
      ? await prisma.company.findMany({
          where: { id: { in: companyIds } },
          select: { id: true, name: true, slug: true, plan: true }
        })
      : [];

    return ok({
      metrics: {
        total,
        issuedLast30,
        cancelledLast30,
        pending,
        monthlyValueIssued: Number(monthlyValue._sum.amount ?? 0),
        configuredCompanies: withConfig,
        autoEmitCompanies: autoEmitCount,
        nfeioConnected: withNfeioKey
      },
      statusBreakdown: statusBreakdown.map(s => ({
        status: s.status,
        count: s._count.id,
        total: Number(s._sum.amount ?? 0)
      })),
      topCompanies: byCompany.map(c => {
        const company = companyMap.find(co => co.id === c.companyId);
        return {
          companyId: c.companyId,
          companyName: company?.name ?? "—",
          companySlug: company?.slug ?? null,
          companyPlan: company?.plan ?? "starter",
          count: c._count.id,
          total: Number(c._sum.amount ?? 0)
        };
      }),
      recentInvoices: recent.map(i => ({
        id: i.id,
        legalName: i.legalName,
        documentNumber: i.documentNumber,
        amount: Number(i.amount),
        status: i.status,
        invoiceNumber: i.invoiceNumber,
        issuedAt: i.issuedAt,
        errorMessage: i.errorMessage,
        createdAt: i.createdAt,
        companyId: i.company.id,
        companyName: i.company.name,
        companySlug: i.company.slug,
        companyPlan: i.company.plan,
        customerName: i.customer?.name ?? null
      }))
    });
  } catch (error) {
    return handleApiError(error);
  }
}
