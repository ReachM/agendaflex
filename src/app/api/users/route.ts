import { NextRequest } from "next/server";
import { created, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { hashPassword } from "@/lib/security/password";
import { userCreateSchema } from "@/lib/validation/schemas";

export async function GET(request: NextRequest) {
  try {
    const context = await requireTenant(request, "users:manage");
    const users = await prisma.companyUser.findMany({
      where: { companyId: context.companyId },
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
      },
      orderBy: { createdAt: "desc" }
    });

    return ok({ users });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "users:manage");
    const body = userCreateSchema.parse(await request.json());
    const passwordHash = await hashPassword(body.password);

    const result = await prisma.$transaction(async (tx) => {
      const role = await tx.role.findUniqueOrThrow({ where: { name: body.roleName } });
      const user = await tx.user.upsert({
        where: { email: body.email.toLowerCase() },
        update: {
          name: body.name,
          passwordHash,
          status: "ACTIVE"
        },
        create: {
          name: body.name,
          email: body.email.toLowerCase(),
          passwordHash,
          status: "ACTIVE"
        }
      });

      const membership = await tx.companyUser.upsert({
        where: {
          companyId_userId: {
            companyId: context.companyId,
            userId: user.id
          }
        },
        update: { roleId: role.id, status: "ACTIVE" },
        create: {
          companyId: context.companyId,
          userId: user.id,
          roleId: role.id,
          status: "ACTIVE"
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

      return membership;
    });

    await audit(request, context, {
      action: "user.create",
      entityType: "user",
      entityId: result.user.id,
      newValues: {
        userId: result.user.id,
        email: result.user.email,
        role: result.role.name
      }
    });

    return created({ user: result });
  } catch (error) {
    return handleApiError(error);
  }
}
