import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";

const KNOWN_TYPES = ["nfeio", "stripe", "asaas", "mercadopago"] as const;

const configSchema = z
  .object({
    accountId: z.string().max(200).optional(),
    webhookUrl: z.string().url().max(500).optional(),
    environment: z.enum(["production", "sandbox"]).optional()
  })
  .strict();

const upsertSchema = z.object({
  type: z.enum(KNOWN_TYPES),
  apiKey: z.string().min(8).max(500),
  config: configSchema.optional()
});

function buildHint(apiKey: string): string {
  const tail = apiKey.trim().slice(-4);
  return `••••${tail}`;
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireTenant(request, "settings:manage");

    const integrations = await prisma.companyIntegration.findMany({
      where: { companyId: context.companyId },
      select: {
        id: true,
        type: true,
        isActive: true,
        config: true,
        apiKeyHint: true,
        updatedAt: true
      },
      orderBy: { type: "asc" }
    });

    return ok({ integrations });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "settings:manage");
    const body = upsertSchema.parse(await request.json());

    const apiKeyHint = buildHint(body.apiKey);
    const configJson = (body.config ?? {}) as Prisma.InputJsonValue;

    const integration = await prisma.companyIntegration.upsert({
      where: { companyId_type: { companyId: context.companyId, type: body.type } },
      create: {
        companyId: context.companyId,
        type: body.type,
        isActive: true,
        config: configJson,
        apiKeyHint
      },
      update: {
        isActive: true,
        config: configJson,
        apiKeyHint
      },
      select: {
        id: true,
        type: true,
        isActive: true,
        config: true,
        apiKeyHint: true,
        updatedAt: true
      }
    });

    await audit(request, context, {
      action: "integration.connect",
      entityType: "integration",
      entityId: integration.id,
      newValues: { type: integration.type, apiKeyHint, config: body.config ?? {} }
    });

    return ok({ integration });
  } catch (error) {
    return handleApiError(error);
  }
}
