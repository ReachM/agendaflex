import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";

// Tenant custom-fields API is READ-ONLY.
// Custom field creation/editing/deletion is exclusively managed by the Super Admin
// via /api/master/custom-fields. Tenants can only READ fields to render dynamic forms.

export async function GET(request: NextRequest) {
  try {
    const context = await requireTenant(request, "custom_fields:view");
    const entityType = request.nextUrl.searchParams.get("entityType");
    const customFields = await prisma.customField.findMany({
      where: {
        companyId: context.companyId,
        ...(entityType ? { entityType: entityType as never } : {})
      },
      orderBy: [{ entityType: "asc" }, { sortOrder: "asc" }, { label: "asc" }]
    });

    return ok({ customFields });
  } catch (error) {
    return handleApiError(error);
  }
}
