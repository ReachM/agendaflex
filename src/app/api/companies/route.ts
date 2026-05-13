import { NextRequest } from "next/server";
import { created, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { hashPassword } from "@/lib/security/password";
import { companyCreateSchema } from "@/lib/validation/schemas";

export async function GET(request: NextRequest) {
  try {
    const context = await requireSuperAdmin(request);
    const companies = await prisma.company.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            users: true,
            customers: true,
            appointments: true
          }
        }
      }
    });

    await audit(request, context, {
      action: "company.list",
      entityType: "company"
    });

    return ok({ companies });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireSuperAdmin(request);
    const body = companyCreateSchema.parse(await request.json());

    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: body.name,
          tradeName: body.tradeName,
          document: body.document,
          email: body.email,
          phone: body.phone,
          segment: body.segment,
          status: body.status,
          plan: body.plan ?? "starter"
        }
      });

      let adminUser = null;
      if (body.adminEmail && body.adminName && body.adminPassword) {
        const companyAdminRole = await tx.role.findUniqueOrThrow({
          where: { name: "COMPANY_ADMIN" }
        });

        adminUser = await tx.user.upsert({
          where: { email: body.adminEmail.toLowerCase() },
          update: {
            name: body.adminName,
            passwordHash: await hashPassword(body.adminPassword),
            status: "ACTIVE"
          },
          create: {
            name: body.adminName,
            email: body.adminEmail.toLowerCase(),
            passwordHash: await hashPassword(body.adminPassword),
            status: "ACTIVE"
          }
        });

        await tx.companyUser.upsert({
          where: {
            companyId_userId: {
              companyId: company.id,
              userId: adminUser.id
            }
          },
          update: { roleId: companyAdminRole.id, status: "ACTIVE" },
          create: {
            companyId: company.id,
            userId: adminUser.id,
            roleId: companyAdminRole.id,
            status: "ACTIVE"
          }
        });
      }

      return { company, adminUser };
    });

    await audit(request, context, {
      action: "company.create",
      entityType: "company",
      entityId: result.company.id,
      newValues: {
        company: result.company,
        adminUserId: result.adminUser?.id
      }
    });

    return created(result);
  } catch (error) {
    return handleApiError(error);
  }
}
