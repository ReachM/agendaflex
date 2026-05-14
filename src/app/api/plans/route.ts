import { NextRequest } from "next/server";
import { ApiError, created, handleApiError, ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);
    const plans = await prisma.plan.findMany({
      include: { features: true, _count: { select: { subscriptions: true } } },
      orderBy: { sortOrder: "asc" }
    });
    return ok({ plans });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    await requireSuperAdmin(request);
    const body = await request.json();

    if (!body.name || !body.slug) {
      throw new ApiError(422, "Nome e slug são obrigatórios.");
    }

    const existing = await prisma.plan.findUnique({ where: { slug: body.slug } });
    if (existing) throw new ApiError(409, "Já existe um plano com esse slug.");

    const plan = await prisma.plan.create({
      data: {
        name: body.name,
        slug: body.slug,
        description: body.description,
        price: body.price ?? 0,
        maxUsers: body.maxUsers ?? 3,
        maxProfessionals: body.maxProfessionals ?? 5,
        maxCustomers: body.maxCustomers ?? 100,
        maxAppointmentsPerMonth: body.maxAppointmentsPerMonth ?? 200,
        allowClientSelfScheduling: body.allowClientSelfScheduling ?? false,
        allowAdvancedReports: body.allowAdvancedReports ?? false,
        allowFinancialControl: body.allowFinancialControl ?? false,
        allowInvoiceRequest: body.allowInvoiceRequest ?? false,
        allowCustomerChecklist: body.allowCustomerChecklist ?? false,
        allowAuditLogs: body.allowAuditLogs ?? true,
        allowCustomFields: body.allowCustomFields ?? true,
        allowMultipleServicesPerAppointment: body.allowMultipleServicesPerAppointment ?? true,
        sortOrder: body.sortOrder ?? 0
      }
    });

    return created({ plan });
  } catch (error) {
    return handleApiError(error);
  }
}
