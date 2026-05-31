import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiError, ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";

const putSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.boolean()
});

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);

    const flags = await prisma.systemFlag.findMany({
      orderBy: { key: "asc" }
    });

    return ok({ flags });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireSuperAdmin(request);
    const { key, value } = putSchema.parse(await request.json());

    const flag = await prisma.systemFlag.upsert({
      where: { key },
      create: { key, value, updatedBy: context.user.id },
      update: { value, updatedBy: context.user.id }
    });

    return ok({ flag });
  } catch (error) {
    return handleApiError(error);
  }
}
