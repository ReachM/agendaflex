import { NextRequest } from "next/server";
import { ApiError, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const auth = await requireSuperAdmin(request);
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const action = body.action as string;

    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) throw new ApiError(404, "Empresa não encontrada.");

    if (action === "suspend") {
      await prisma.company.update({ where: { id }, data: { status: "SUSPENDED" } });
      await audit(request, auth, { action: "master.company_suspended", entityType: "company", entityId: id, companyId: id });
      return ok({ message: "Empresa suspensa." });
    }

    if (action === "reactivate") {
      await prisma.company.update({ where: { id }, data: { status: "ACTIVE" } });
      await audit(request, auth, { action: "master.company_reactivated", entityType: "company", entityId: id, companyId: id });
      return ok({ message: "Empresa reativada." });
    }

    if (action === "cancel") {
      await prisma.$transaction([
        prisma.company.update({ where: { id }, data: { status: "INACTIVE" } }),
        prisma.companySubscription.updateMany({
          where: { companyId: id, status: { in: ["ACTIVE", "TRIALING"] } },
          data: { status: "CANCELLED", canceledAt: new Date() }
        })
      ]);
      await audit(request, auth, { action: "master.company_cancelled", entityType: "company", entityId: id, companyId: id });
      return ok({ message: "Empresa cancelada." });
    }

    if (action === "change_plan") {
      const planSlug = body.planSlug as string;
      if (!["starter", "pro", "max"].includes(planSlug)) {
        throw new ApiError(422, "Plano inválido. Use: starter | pro | max");
      }
      await prisma.company.update({ where: { id }, data: { plan: planSlug } });
      await audit(request, auth, {
        action: "master.company_plan_changed",
        entityType: "company",
        entityId: id,
        companyId: id,
        oldValues: { plan: company.plan },
        newValues: { plan: planSlug }
      });
      return ok({ message: `Plano alterado para ${planSlug}.` });
    }

    throw new ApiError(422, "Ação inválida. Use: suspend | reactivate | cancel | change_plan");
  } catch (error) {
    return handleApiError(error);
  }
}
