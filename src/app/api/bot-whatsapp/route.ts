import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { requirePlanFeature } from "@/lib/security/plan-guard";

const DEFAULT_REMINDER_CONFIG = { enabled: true, send24h: true, send2h: true };

const faqItemSchema = z.object({
  pergunta: z.string().min(1).max(300),
  resposta: z.string().min(1).max(2000)
});

const reminderConfigSchema = z.object({
  enabled: z.boolean(),
  send24h: z.boolean(),
  send2h: z.boolean()
});

const patchSchema = z.object({
  botEnabled: z.boolean().optional(),
  whatsappInstance: z.string().max(100).nullable().optional(),
  allowBooking: z.boolean().optional(),
  faqConfig: z.array(faqItemSchema).max(50).optional(),
  reminderConfig: reminderConfigSchema.optional(),
  businessHours: z.string().max(500).nullable().optional(),
  cancellationPolicy: z.string().max(1000).nullable().optional()
});

async function getOrCreateConfig(companyId: string) {
  const existing = await prisma.companyBotConfig.findUnique({ where: { companyId } });
  if (existing) return existing;

  return prisma.companyBotConfig.create({
    data: {
      companyId,
      reminderConfig: DEFAULT_REMINDER_CONFIG
    }
  });
}

/**
 * GET /api/bot-whatsapp
 * Retorna Company.botEnabled (fonte de verdade do liga/desliga) + a configuração
 * do bot (CompanyBotConfig), criando uma config padrão se ainda não existir.
 * Inclui também KPIs (últimas 24h e mês) e atividade recente.
 */
export async function GET(request: NextRequest) {
  try {
    const context = await requireTenant(request, "settings:manage");
    await requirePlanFeature(context, "allowBotIntegration", "Bot WhatsApp");

    const config = await getOrCreateConfig(context.companyId);

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      conversations24h,
      conversationsMonth,
      botAppointments24h,
      botAppointmentsMonth,
      reminders24h,
      recentReminders
    ] = await Promise.all([
      prisma.botConversationState.count({
        where: { companyId: context.companyId, updatedAt: { gte: last24h } }
      }),
      prisma.botConversationState.count({
        where: { companyId: context.companyId, updatedAt: { gte: startOfMonth } }
      }),
      prisma.appointment.count({
        where: { companyId: context.companyId, source: "BOT", createdAt: { gte: last24h } }
      }),
      prisma.appointment.count({
        where: { companyId: context.companyId, source: "BOT", createdAt: { gte: startOfMonth } }
      }),
      prisma.sentReminder.count({
        where: { appointment: { companyId: context.companyId }, sentAt: { gte: last24h } }
      }),
      prisma.sentReminder.findMany({
        where: { appointment: { companyId: context.companyId }, sentAt: { gte: last30d } },
        include: {
          appointment: {
            select: {
              id: true,
              startAt: true,
              customer: { select: { name: true } }
            }
          }
        },
        orderBy: { sentAt: "desc" },
        take: 10
      })
    ]);

    return ok({
      botEnabled: context.company.botEnabled,
      config,
      stats: {
        conversations24h,
        conversationsMonth,
        botAppointments24h,
        botAppointmentsMonth,
        reminders24h
      },
      recentActivity: recentReminders.map(r => ({
        id: r.id,
        type: r.type,
        sentAt: r.sentAt,
        customerName: r.appointment.customer?.name ?? "—",
        appointmentStartAt: r.appointment.startAt
      }))
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/bot-whatsapp
 * O toggle liga/desliga grava em Company.botEnabled; os demais campos no
 * CompanyBotConfig.
 */
export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "settings:manage");
    await requirePlanFeature(context, "allowBotIntegration", "Bot WhatsApp");

    const body = patchSchema.parse(await request.json());

    if (body.botEnabled !== undefined) {
      await prisma.company.update({
        where: { id: context.companyId },
        data: { botEnabled: body.botEnabled }
      });
    }

    const configData: Prisma.CompanyBotConfigUpdateInput = {};
    if (body.whatsappInstance !== undefined) configData.whatsappInstance = body.whatsappInstance;
    if (body.allowBooking !== undefined) configData.allowBooking = body.allowBooking;
    if (body.faqConfig !== undefined) configData.faqConfig = body.faqConfig as Prisma.InputJsonValue;
    if (body.reminderConfig !== undefined) configData.reminderConfig = body.reminderConfig as Prisma.InputJsonValue;
    if (body.businessHours !== undefined) configData.businessHours = body.businessHours;
    if (body.cancellationPolicy !== undefined) configData.cancellationPolicy = body.cancellationPolicy;

    const config = await prisma.companyBotConfig.upsert({
      where: { companyId: context.companyId },
      create: {
        companyId: context.companyId,
        whatsappInstance: body.whatsappInstance ?? null,
        allowBooking: body.allowBooking ?? false,
        faqConfig: (body.faqConfig ?? []) as Prisma.InputJsonValue,
        reminderConfig: (body.reminderConfig ?? DEFAULT_REMINDER_CONFIG) as Prisma.InputJsonValue,
        businessHours: body.businessHours ?? null,
        cancellationPolicy: body.cancellationPolicy ?? null
      },
      update: configData
    });

    const botEnabled =
      body.botEnabled ??
      (await prisma.company.findUniqueOrThrow({
        where: { id: context.companyId },
        select: { botEnabled: true }
      })).botEnabled;

    await audit(request, context, {
      action: "bot_whatsapp.update",
      entityType: "bot_whatsapp",
      entityId: config.id,
      newValues: {
        botEnabled,
        whatsappInstance: config.whatsappInstance,
        allowBooking: config.allowBooking,
        businessHours: config.businessHours,
        cancellationPolicy: config.cancellationPolicy,
        reminderConfig: config.reminderConfig
      }
    });

    return ok({ botEnabled, config });
  } catch (error) {
    return handleApiError(error);
  }
}
