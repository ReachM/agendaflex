import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";

const DEFAULT_MESSAGE = "O sistema está em manutenção. Voltamos em breve!";

const patchSchema = z.object({
  enabled: z.boolean(),
  message: z.string().max(500).optional()
});

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);

    const [flag, msg] = await Promise.all([
      prisma.systemFlag.findUnique({ where: { key: "maintenance_mode" } }),
      prisma.systemSetting.findUnique({ where: { key: "maintenance_message" } })
    ]);

    return ok({
      enabled: flag?.value ?? false,
      message: msg?.value ?? DEFAULT_MESSAGE
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

    await prisma.systemFlag.upsert({
      where: { key: "maintenance_mode" },
      update: { value: body.enabled, updatedBy: context.user.id },
      create: {
        key: "maintenance_mode",
        value: body.enabled,
        description: "Modo manutenção global",
        updatedBy: context.user.id
      }
    });

    if (body.message !== undefined) {
      await prisma.systemSetting.upsert({
        where: { key: "maintenance_message" },
        update: { value: body.message, updatedBy: context.user.id },
        create: { key: "maintenance_message", value: body.message, updatedBy: context.user.id }
      });
    }

    await audit(request, context, {
      action: body.enabled ? "master.maintenance_enabled" : "master.maintenance_disabled",
      entityType: "system",
      entityId: "maintenance_mode"
    });

    return ok({ enabled: body.enabled });
  } catch (error) {
    return handleApiError(error);
  }
}
