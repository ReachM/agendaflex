import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { companyUpdateSchema } from "@/lib/validation/schemas";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getParams(context: RouteContext) {
  return await context.params;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireSuperAdmin(request);
    const { id } = await getParams(context);
    const company = await prisma.company.findUniqueOrThrow({
      where: { id },
      include: {
        users: {
          include: {
            user: true,
            role: true
          }
        },
        _count: {
          select: {
            customers: true,
            services: true,
            professionals: true,
            appointments: true
          }
        }
      }
    });

    await audit(request, auth, {
      action: "company.view",
      entityType: "company",
      entityId: id
    });

    return ok({ company });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const auth = await requireSuperAdmin(request);
    const { id } = await getParams(context);
    const body = companyUpdateSchema.parse(await request.json());
    const oldCompany = await prisma.company.findUniqueOrThrow({ where: { id } });

    const company = await prisma.company.update({
      where: { id },
      data: {
        name: body.name,
        tradeName: body.tradeName,
        document: body.document,
        email: body.email,
        phone: body.phone,
        segment: body.segment,
        status: body.status,
        plan: body.plan
      }
    });

    await audit(request, auth, {
      action: "company.update",
      entityType: "company",
      entityId: id,
      oldValues: oldCompany,
      newValues: company
    });

    return ok({ company });
  } catch (error) {
    return handleApiError(error);
  }
}
