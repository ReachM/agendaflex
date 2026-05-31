import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";

export async function GET(request: NextRequest) {
  try {
    const context = await requireTenant(request);

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const count = await prisma.notificationLog.count({
      where: {
        companyId: context.companyId,
        status: "PENDING",
        createdAt: { gte: since }
      }
    });

    return ok({ count });
  } catch (error) {
    return handleApiError(error);
  }
}
