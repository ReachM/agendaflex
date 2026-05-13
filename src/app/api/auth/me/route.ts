import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/lib/api/errors";
import { requireAnyAuth } from "@/lib/security/auth";

export async function GET(request: NextRequest) {
  try {
    const context = await requireAnyAuth(request);

    return ok({
      kind: context.kind,
      user: {
        id: context.user.id,
        name: context.user.name,
        email: context.user.email
      },
      role: context.roleName,
      company: context.company
        ? {
            id: context.company.id,
            name: context.company.name,
            tradeName: context.company.tradeName,
            status: context.company.status,
            segment: context.company.segment,
            plan: context.company.plan
          }
        : null
    });
  } catch (error) {
    return handleApiError(error);
  }
}
