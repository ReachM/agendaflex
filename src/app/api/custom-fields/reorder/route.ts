import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { customFieldReorderSchema } from "@/lib/validation/schemas";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const auth = await requireTenant(request, "custom_fields:manage");
    const body = customFieldReorderSchema.parse(await request.json());

    await prisma.$transaction(
      body.items.map((item) =>
        prisma.customField.updateMany({
          where: {
            id: item.id,
            companyId: auth.companyId
          },
          data: {
            sortOrder: item.sortOrder
          }
        })
      )
    );

    await audit(request, auth, {
      action: "custom_field.reorder",
      entityType: "custom_field",
      newValues: body.items
    });

    return ok({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
