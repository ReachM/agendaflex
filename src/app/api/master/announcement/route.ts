import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiError, ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";

const patchSchema = z.object({
  message: z.string().max(500),
  type: z.enum(["info", "warning", "success"]).default("info")
});

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);

    const [a, t] = await Promise.all([
      prisma.systemSetting.findUnique({ where: { key: "global_announcement" } }),
      prisma.systemSetting.findUnique({ where: { key: "announcement_type" } })
    ]);

    return ok({
      message: a?.value ?? "",
      type: (t?.value ?? "info") as "info" | "warning" | "success",
      active: Boolean(a?.value)
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireSuperAdmin(request);
    const body = patchSchema.parse(await request.json());

    await prisma.systemSetting.upsert({
      where: { key: "global_announcement" },
      update: { value: body.message, updatedBy: context.user.id },
      create: { key: "global_announcement", value: body.message, updatedBy: context.user.id }
    });

    await prisma.systemSetting.upsert({
      where: { key: "announcement_type" },
      update: { value: body.type, updatedBy: context.user.id },
      create: { key: "announcement_type", value: body.type, updatedBy: context.user.id }
    });

    return ok({ active: Boolean(body.message) });
  } catch (error) {
    return handleApiError(error);
  }
}
