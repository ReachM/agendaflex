import { NextRequest } from "next/server";
import { ApiError, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const ALLOWED_FIELDS = [
  "name", "description", "price",
  "maxUsers", "maxProfessionals", "maxCustomers", "maxAppointmentsPerMonth",
  "allowClientSelfScheduling", "allowAdvancedReports", "allowFinancialControl",
  "allowInvoiceRequest", "allowCustomerChecklist", "allowBotIntegration",
  "allowCustomFields", "allowMultipleServicesPerAppointment", "isActive"
] as const;

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const auth = await requireSuperAdmin(request);
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    const plan = await prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new ApiError(404, "Plano não encontrado.");

    const data: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
      if (key in body) data[key] = body[key];
    }

    if ("price" in data) {
      const price = Number(data.price);
      if (isNaN(price) || price < 0) {
        throw new ApiError(422, "Preço inválido.");
      }
      data.price = price;
    }

    const updated = await prisma.plan.update({
      where: { id },
      data
    });

    await audit(request, auth, {
      action: "master.plan_updated",
      entityType: "plan",
      entityId: id,
      oldValues: { price: plan.price, name: plan.name },
      newValues: data
    });

    return ok({ plan: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
