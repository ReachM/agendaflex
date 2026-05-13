import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";

// Tenant custom-fields/[id] API is READ-ONLY.
// Custom field modification is exclusively managed by the Super Admin
// via /api/master/custom-fields/[id]. Tenants can only read individual fields.

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getParams(context: RouteContext) {
  return await context.params;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireTenant(request, "custom_fields:manage");
    const { id } = await getParams(context);
    const customField = await prisma.customField.findFirstOrThrow({
      where: { id, companyId: auth.companyId }
    });

    return ok({ customField });
  } catch (error) {
    return handleApiError(error);
  }
}
