import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";

const BUSINESS_DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

const businessHoursSchema = z.object({
  sunday: z.object({ open: z.boolean(), from: z.string().optional(), to: z.string().optional() }).optional(),
  monday: z.object({ open: z.boolean(), from: z.string().optional(), to: z.string().optional() }).optional(),
  tuesday: z.object({ open: z.boolean(), from: z.string().optional(), to: z.string().optional() }).optional(),
  wednesday: z.object({ open: z.boolean(), from: z.string().optional(), to: z.string().optional() }).optional(),
  thursday: z.object({ open: z.boolean(), from: z.string().optional(), to: z.string().optional() }).optional(),
  friday: z.object({ open: z.boolean(), from: z.string().optional(), to: z.string().optional() }).optional(),
  saturday: z.object({ open: z.boolean(), from: z.string().optional(), to: z.string().optional() }).optional()
}).partial();

const profileSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  tradeName: z.string().max(200).nullish(),
  document: z.string().max(30).nullish(),
  email: z.string().email().optional(),
  phone: z.string().max(30).nullish(),
  address: z.string().max(300).nullish(),
  slug: z.string().max(60).regex(/^[a-z0-9-]+$/).nullish(),
  businessHours: businessHoursSchema.optional()
});

export async function GET(request: NextRequest) {
  try {
    const context = await requireTenant(request, "settings:manage");
    const company = await prisma.company.findUniqueOrThrow({
      where: { id: context.companyId },
      select: {
        id: true,
        name: true,
        tradeName: true,
        document: true,
        email: true,
        phone: true,
        address: true,
        slug: true,
        segment: true,
        status: true,
        plan: true,
        publicBookingEnabled: true,
        botEnabled: true,
        settings: true,
        createdAt: true,
        _count: {
          select: {
            users: true,
            customers: true,
            professionals: true,
            services: true,
            appointments: true
          }
        }
      }
    });

    const settings = (company.settings ?? {}) as Record<string, unknown>;
    const businessHours = (settings.businessHours ?? {}) as Record<string, { open: boolean; from?: string; to?: string }>;

    // Resolve integration connection status (no secrets exposed)
    const [hasInvoiceConfig, botConfig, adminMembership] = await Promise.all([
      prisma.companyInvoiceConfig.findUnique({ where: { companyId: context.companyId }, select: { autoEmit: true, nfeioCompanyId: true } }),
      prisma.companyBotConfig.findUnique({ where: { companyId: context.companyId }, select: { whatsappInstance: true } }),
      prisma.companyUser.findFirst({
        where: { companyId: context.companyId, status: "ACTIVE", role: { name: "COMPANY_ADMIN" } },
        include: { user: { select: { email: true } } }
      })
    ]);

    return ok({
      company: {
        id: company.id,
        name: company.name,
        tradeName: company.tradeName,
        document: company.document,
        email: company.email,
        phone: company.phone,
        address: company.address,
        slug: company.slug,
        segment: company.segment,
        status: company.status,
        plan: company.plan,
        publicBookingEnabled: company.publicBookingEnabled,
        botEnabled: company.botEnabled,
        createdAt: company.createdAt,
        counts: company._count,
        businessHours,
        // E-mail do admin — usado na zona de risco (destino do código de confirmação).
        adminEmail: adminMembership?.user.email ?? company.email
      },
      integrations: {
        invoice: {
          configured: Boolean(hasInvoiceConfig),
          autoEmit: hasInvoiceConfig?.autoEmit ?? false,
          hasNfeioKey: Boolean(process.env.NFE_IO_API_KEY) && Boolean(hasInvoiceConfig?.nfeioCompanyId)
        },
        bot: {
          enabled: company.botEnabled,
          hasInstance: Boolean(botConfig?.whatsappInstance)
        },
        publicBooking: {
          enabled: company.publicBookingEnabled
        }
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "settings:manage");
    const body = profileSchema.parse(await request.json());

    const current = await prisma.company.findUniqueOrThrow({
      where: { id: context.companyId },
      select: { settings: true }
    });
    const currentSettings = (current.settings ?? {}) as Record<string, unknown>;

    const settingsUpdate = body.businessHours !== undefined
      ? { ...currentSettings, businessHours: body.businessHours }
      : undefined;

    const updated = await prisma.company.update({
      where: { id: context.companyId },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.tradeName !== undefined ? { tradeName: body.tradeName } : {}),
        ...(body.document !== undefined ? { document: body.document } : {}),
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.address !== undefined ? { address: body.address } : {}),
        ...(body.slug !== undefined ? { slug: body.slug } : {}),
        ...(settingsUpdate !== undefined ? { settings: settingsUpdate } : {})
      }
    });

    await audit(request, context, {
      action: "company.profile_update",
      entityType: "company",
      entityId: context.companyId,
      newValues: {
        name: body.name,
        tradeName: body.tradeName,
        slug: body.slug,
        hasBusinessHours: body.businessHours !== undefined
      }
    });

    return ok({ company: updated, weekdays: BUSINESS_DAYS });
  } catch (error) {
    return handleApiError(error);
  }
}
