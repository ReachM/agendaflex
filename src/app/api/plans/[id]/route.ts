import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getParams(context: RouteContext) {
  return await context.params;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requireSuperAdmin(request);
    const { id } = await getParams(context);
    const plan = await prisma.plan.findUniqueOrThrow({
      where: { id },
      include: {
        features: true,
        _count: { select: { subscriptions: true } }
      }
    });
    return ok({ plan });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const auth = await requireSuperAdmin(request);
    const { id } = await getParams(context);
    const body = await request.json();

    const oldPlan = await prisma.plan.findUniqueOrThrow({ where: { id } });

    const plan = await prisma.plan.update({
      where: { id },
      data: {
        name: body.name ?? undefined,
        description: body.description ?? undefined,
        price: body.price !== undefined ? body.price : undefined,
        maxUsers: body.maxUsers !== undefined ? body.maxUsers : undefined,
        maxProfessionals: body.maxProfessionals !== undefined ? body.maxProfessionals : undefined,
        maxCustomers: body.maxCustomers !== undefined ? body.maxCustomers : undefined,
        maxAppointmentsPerMonth: body.maxAppointmentsPerMonth !== undefined ? body.maxAppointmentsPerMonth : undefined,
        allowClientSelfScheduling: body.allowClientSelfScheduling !== undefined ? body.allowClientSelfScheduling : undefined,
        allowAdvancedReports: body.allowAdvancedReports !== undefined ? body.allowAdvancedReports : undefined,
        allowFinancialControl: body.allowFinancialControl !== undefined ? body.allowFinancialControl : undefined,
        allowInvoiceRequest: body.allowInvoiceRequest !== undefined ? body.allowInvoiceRequest : undefined,
        allowCustomerChecklist: body.allowCustomerChecklist !== undefined ? body.allowCustomerChecklist : undefined,
        allowAuditLogs: body.allowAuditLogs !== undefined ? body.allowAuditLogs : undefined,
        allowCustomFields: body.allowCustomFields !== undefined ? body.allowCustomFields : undefined,
        allowMultipleServicesPerAppointment: body.allowMultipleServicesPerAppointment !== undefined ? body.allowMultipleServicesPerAppointment : undefined,
        isActive: body.isActive !== undefined ? body.isActive : undefined,
        sortOrder: body.sortOrder !== undefined ? body.sortOrder : undefined
      },
      include: {
        features: true,
        _count: { select: { subscriptions: true } }
      }
    });

    await audit(request, auth, {
      action: "plan.update",
      entityType: "plan",
      entityId: id,
      oldValues: oldPlan,
      newValues: plan
    });

    return ok({ plan });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const auth = await requireSuperAdmin(request);
    const { id } = await getParams(context);

    const plan = await prisma.plan.findUniqueOrThrow({
      where: { id },
      include: { _count: { select: { subscriptions: true } } }
    });

    if (plan._count.subscriptions > 0) {
      // Don't delete, just deactivate
      const updated = await prisma.plan.update({
        where: { id },
        data: { isActive: false }
      });

      await audit(request, auth, {
        action: "plan.deactivate",
        entityType: "plan",
        entityId: id,
        oldValues: plan,
        newValues: updated
      });

      return ok({ plan: updated, message: "Plano desativado. Não pode ser excluído pois possui empresas vinculadas." });
    }

    await prisma.plan.delete({ where: { id } });

    await audit(request, auth, {
      action: "plan.delete",
      entityType: "plan",
      entityId: id,
      oldValues: plan
    });

    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
