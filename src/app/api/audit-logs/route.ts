import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { requireAnyAuth } from "@/lib/security/auth";

export async function GET(request: NextRequest) {
  try {
    const context = await requireAnyAuth(request, "logs:view");
    const companyId =
      context.kind === "super_admin"
        ? request.nextUrl.searchParams.get("companyId") ?? undefined
        : context.companyId;

    const logs = await prisma.auditLog.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        ...(request.nextUrl.searchParams.get("action")
          ? { action: { contains: request.nextUrl.searchParams.get("action")!, mode: "insensitive" } }
          : {}),
        ...(request.nextUrl.searchParams.get("entityType")
          ? { entityType: request.nextUrl.searchParams.get("entityType")! }
          : {})
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        company: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 200
    });

    return ok({ logs });
  } catch (error) {
    return handleApiError(error);
  }
}
