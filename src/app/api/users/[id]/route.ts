import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { userUpdateSchema } from "@/lib/validation/schemas";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getParams(context: RouteContext) {
  return await context.params;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const auth = await requireTenant(request, "users:manage");
    const { id } = await getParams(context);
    const body = userUpdateSchema.parse(await request.json());
    const oldMembership = await prisma.companyUser.findFirstOrThrow({
      where: {
        companyId: auth.companyId,
        userId: id
      },
      include: {
        user: true,
        role: true
      }
    });

    const role = body.roleName
      ? await prisma.role.findUniqueOrThrow({ where: { name: body.roleName } })
      : null;

    const membership = await prisma.companyUser.update({
      where: { id: oldMembership.id },
      data: {
        roleId: role?.id,
        status: body.status
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            createdAt: true,
            updatedAt: true
          }
        },
        role: true
      }
    });

    if (body.name) {
      await prisma.user.update({
        where: { id },
        data: { name: body.name }
      });
    }

    await audit(request, auth, {
      action: "user.update",
      entityType: "user",
      entityId: id,
      oldValues: {
        role: oldMembership.role.name,
        status: oldMembership.status
      },
      newValues: {
        role: membership.role.name,
        status: membership.status
      }
    });

    return ok({ user: membership });
  } catch (error) {
    return handleApiError(error);
  }
}
