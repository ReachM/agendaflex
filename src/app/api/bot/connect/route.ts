import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiError, ok, ApiError } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { generateBotToken } from "@/lib/bot-token";
import { registerTenant, deleteTenant } from "@/lib/chatbot-service-client";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { requirePlanFeature } from "@/lib/security/plan-guard";
import { rateLimit } from "@/lib/security/rate-limit";

const connectSchema = z.object({
  chatbotApiKey: z.string().min(10).startsWith("chatbot_sk_", {
    message: "A API Key deve começar com 'chatbot_sk_'."
  })
});

function generateWebhookSecret(): string {
  return `whsec_${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "")}`;
}

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
 * POST /api/bot/connect
 * Activate bot integration for the authenticated company.
 */
export async function POST(request: NextRequest) {
  try {
    const context = await requireTenant(request, "settings:manage");
    await requirePlanFeature(context, "allowBotIntegration", "Integração com Bot WhatsApp");

    rateLimit(`bot-connect:${context.companyId}`, 5, 60_000);

    const body = connectSchema.parse(await request.json());

    // Check if API Key is already in use by another company
    const existing = await prisma.company.findFirst({
      where: { botApiKey: body.chatbotApiKey, id: { not: context.companyId } }
    });

    if (existing) {
      throw new ApiError(409, "Esta API Key já está em uso por outra empresa.");
    }

    // Check if bot is already connected
    const company = await prisma.company.findUniqueOrThrow({
      where: { id: context.companyId }
    });

    if (company.botEnabled) {
      throw new ApiError(409, "O bot já está conectado para esta empresa.");
    }

    // Generate secure secrets
    const botWebhookSecret = generateWebhookSecret();
    const botToken = await generateBotToken(context.companyId);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const config = {
      companyName: company.tradeName ?? company.name,
      webhookSecret: botWebhookSecret,
      adapter: {
        type: "agendaflex",
        baseUrl: appUrl,
        token: botToken,
        webhookSecret: botWebhookSecret,
        companyId: context.companyId
      },
      reminders: {
        enabled: true,
        hours: [24, 2]
      }
    };

    // Register on ChatBot Service
    const result = await registerTenant(body.chatbotApiKey, {
      name: company.tradeName ?? company.name,
      webhookUrl: `${appUrl}/api/bot/webhook`,
      config
    });

    if (!result.ok) {
      throw new ApiError(502, result.error ?? "Erro ao registrar no ChatBot Service.");
    }

    // Save to database only after successful external registration
    await prisma.company.update({
      where: { id: context.companyId },
      data: {
        botEnabled: true,
        botApiKey: body.chatbotApiKey,
        botWebhookSecret,
        botRegisteredAt: new Date(),
        botConfig: sanitizeBotConfig(config)
      }
    });

    await audit(request, context, {
      action: "BOT_CONNECTED",
      entityType: "company",
      entityId: context.companyId,
      newValues: { botEnabled: true, connectedAt: new Date().toISOString() }
    });

    return ok({
      success: true,
      connectedAt: new Date().toISOString()
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/bot/connect
 * Deactivate bot integration for the authenticated company.
 */
export async function DELETE(request: NextRequest) {
  try {
    const context = await requireTenant(request, "settings:manage");

    const company = await prisma.company.findUniqueOrThrow({
      where: { id: context.companyId }
    });

    if (!company.botEnabled) {
      throw new ApiError(400, "O bot não está conectado para esta empresa.");
    }

    // Try to remove from ChatBot Service (best-effort)
    if (company.botApiKey) {
      const result = await deleteTenant(company.botApiKey, context.companyId);
      if (!result.ok) {
        console.error(`[Bot Disconnect] Falha ao remover tenant do ChatBot Service: ${result.error}`);
        // Continue with local deactivation even if external call fails
      }
    }

    // Deactivate locally
    await prisma.company.update({
      where: { id: context.companyId },
      data: {
        botEnabled: false,
        botApiKey: null,
        botWebhookSecret: null,
        botRegisteredAt: null,
        botConfig: Prisma.JsonNull
      }
    });

    await audit(request, context, {
      action: "BOT_DISCONNECTED",
      entityType: "company",
      entityId: context.companyId,
      oldValues: { botEnabled: true },
      newValues: { botEnabled: false }
    });

    return ok({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
