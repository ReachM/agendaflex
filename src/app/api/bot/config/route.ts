import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { handleApiError, ok, ApiError } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { generateBotToken } from "@/lib/bot-token";
import { updateTenantConfig } from "@/lib/chatbot-service-client";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { requirePlanFeature } from "@/lib/security/plan-guard";

const configSchema = z.object({
  faqContext: z.string().max(2000).optional(),
  businessHours: z.string().max(200).optional(),
  address: z.string().max(300).optional(),
  cancellationPolicy: z.string().max(500).optional(),
  remindersEnabled: z.boolean().optional(),
  reminderHours: z.array(z.number().int().min(1).max(72)).max(3).optional()
});

function sanitizeBotConfig(config: Record<string, unknown>) {
  const safeAdapter = { ...((config.adapter ?? {}) as Record<string, unknown>) };
  delete safeAdapter.token;
  delete safeAdapter.webhookSecret;

  const safeConfig = { ...config };
  delete safeConfig.webhookSecret;
  delete safeConfig.adapter;

  return JSON.parse(JSON.stringify({
    ...safeConfig,
    adapter: safeAdapter
  })) as Prisma.InputJsonValue;
}

/**
 * GET /api/bot/config
 * Return non-sensitive bot configuration for the authenticated company.
 */
export async function GET(request: NextRequest) {
  try {
    const context = await requireTenant(request, "settings:manage");
    await requirePlanFeature(context, "allowBotIntegration", "Integração com Bot WhatsApp");

    const company = await prisma.company.findUniqueOrThrow({
      where: { id: context.companyId },
      select: { botEnabled: true, botConfig: true }
    });

    if (!company.botEnabled) {
      throw new ApiError(400, "O bot não está conectado.");
    }

    const config = (company.botConfig as Record<string, unknown>) ?? {};
    return ok({
      faqContext: config.faqContext ?? "",
      businessHours: config.businessHours ?? "",
      address: config.address ?? "",
      cancellationPolicy: config.cancellationPolicy ?? "",
      reminders: config.reminders ?? { enabled: true, hours: [24, 2] }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/bot/config
 * Update bot configuration for the authenticated company.
 * Syncs changes to the ChatBot Service.
 */
export async function PATCH(request: NextRequest) {
  try {
    const context = await requireTenant(request, "settings:manage");
    await requirePlanFeature(context, "allowBotIntegration", "Integração com Bot WhatsApp");

    const company = await prisma.company.findUniqueOrThrow({
      where: { id: context.companyId },
      select: {
        id: true,
        name: true,
        tradeName: true,
        botEnabled: true,
        botApiKey: true,
        botConfig: true
      }
    });

    if (!company.botEnabled) {
      throw new ApiError(400, "O bot não está conectado. Conecte o bot antes de configurar.");
    }

    const body = configSchema.parse(await request.json());

    // Merge new config into existing
    const existingConfig = (company.botConfig as Record<string, unknown>) ?? {};

    // Generate a fresh bot token for the sync
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const freshBotToken = await generateBotToken(context.companyId);

    const updatedConfig: Record<string, unknown> = {
      ...existingConfig,
      faqContext: body.faqContext ?? existingConfig.faqContext,
      businessHours: body.businessHours ?? existingConfig.businessHours,
      address: body.address ?? existingConfig.address,
      cancellationPolicy: body.cancellationPolicy ?? existingConfig.cancellationPolicy,
      reminders: {
        enabled: body.remindersEnabled ?? (existingConfig.reminders as Record<string, unknown>)?.enabled ?? true,
        hours: body.reminderHours ?? (existingConfig.reminders as Record<string, unknown>)?.hours ?? [24, 2]
      },
      adapter: {
        type: "agendaflex",
        baseUrl: appUrl,
        token: freshBotToken,
        companyId: context.companyId
      }
    };

    // Sync with ChatBot Service
    if (company.botApiKey) {
      const result = await updateTenantConfig(company.botApiKey, context.companyId, {
        config: updatedConfig
      });

      if (!result.ok) {
        console.error(`[Bot Config] Falha ao sincronizar com ChatBot Service: ${result.error}`);
        throw new ApiError(502, "Erro ao sincronizar configuração com o ChatBot Service. Tente novamente.");
      }
    }

    // Save locally
    await prisma.company.update({
      where: { id: context.companyId },
      data: { botConfig: sanitizeBotConfig(updatedConfig) }
    });

    await audit(request, context, {
      action: "BOT_CONFIG_UPDATED",
      entityType: "company",
      entityId: context.companyId,
      newValues: {
        faqContext: body.faqContext,
        businessHours: body.businessHours,
        address: body.address,
        cancellationPolicy: body.cancellationPolicy,
        remindersEnabled: body.remindersEnabled,
        reminderHours: body.reminderHours
      }
    });

    return ok({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
