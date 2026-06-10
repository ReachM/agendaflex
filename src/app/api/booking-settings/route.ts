import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida (use o formato #RRGGBB).");

/**
 * GET /api/booking-settings — returns the public booking configuration for the company
 * PATCH /api/booking-settings — updates the public booking configuration
 */

export async function GET(request: NextRequest) {
  try {
    const context = await requireTenant(request, "public_booking:manage");

    const settings = await prisma.publicBookingSettings.findUnique({
      where: { companyId: context.companyId }
    });

    const services = await prisma.service.findMany({
      where: { companyId: context.companyId, isActive: true },
      select: { id: true, name: true, isPublic: true, basePrice: true, durationMinutes: true },
      orderBy: { name: "asc" }
    });

    const professionals = await prisma.professional.findMany({
      where: { companyId: context.companyId, isActive: true },
      select: { id: true, name: true, specialty: true, isPublic: true },
      orderBy: { name: "asc" }
    });

    return ok({
      settings: settings ?? {
        enabled: false,
        publicSlug: context.company.slug ?? null,
        requireManualApproval: false,
        allowChooseProfessional: true,
        minNoticeHours: 1,
        maxDaysAhead: 30,
        slotIntervalMinutes: 30,
        instructions: null,
        confirmationMessage: null,
        sendEmailNotifications: true,
        sendWhatsappNotifications: false,
        sendSmsNotifications: false,
        primaryColor: "#0d9488"
      },
      services,
      professionals,
      company: {
        slug: context.company.slug,
        publicBookingEnabled: context.company.publicBookingEnabled,
        autoConfirmBooking: context.company.autoConfirmBooking,
        plan: context.company.plan
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "public_booking:manage");

    const body = await request.json();

    if (body.primaryColor !== undefined && body.primaryColor !== null) {
      hexColorSchema.parse(body.primaryColor);
    }

    // Update PublicBookingSettings
    const settings = await prisma.publicBookingSettings.upsert({
      where: { companyId: context.companyId },
      create: {
        companyId: context.companyId,
        enabled: body.enabled ?? false,
        publicSlug: body.publicSlug ?? context.company.slug,
        requireManualApproval: body.requireManualApproval ?? false,
        allowChooseProfessional: body.allowChooseProfessional ?? true,
        minNoticeHours: body.minNoticeHours ?? 1,
        maxDaysAhead: body.maxDaysAhead ?? 30,
        slotIntervalMinutes: body.slotIntervalMinutes ?? 30,
        instructions: body.instructions ?? null,
        confirmationMessage: body.confirmationMessage ?? null,
        sendEmailNotifications: body.sendEmailNotifications ?? true,
        sendWhatsappNotifications: body.sendWhatsappNotifications ?? false,
        sendSmsNotifications: body.sendSmsNotifications ?? false,
        primaryColor: body.primaryColor ?? "#0d9488"
      },
      update: {
        ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
        ...(body.publicSlug !== undefined ? { publicSlug: body.publicSlug } : {}),
        ...(body.requireManualApproval !== undefined ? { requireManualApproval: body.requireManualApproval } : {}),
        ...(body.allowChooseProfessional !== undefined ? { allowChooseProfessional: body.allowChooseProfessional } : {}),
        ...(body.minNoticeHours !== undefined ? { minNoticeHours: body.minNoticeHours } : {}),
        ...(body.maxDaysAhead !== undefined ? { maxDaysAhead: body.maxDaysAhead } : {}),
        ...(body.slotIntervalMinutes !== undefined ? { slotIntervalMinutes: body.slotIntervalMinutes } : {}),
        ...(body.instructions !== undefined ? { instructions: body.instructions } : {}),
        ...(body.confirmationMessage !== undefined ? { confirmationMessage: body.confirmationMessage } : {}),
        ...(body.sendEmailNotifications !== undefined ? { sendEmailNotifications: body.sendEmailNotifications } : {}),
        ...(body.sendWhatsappNotifications !== undefined ? { sendWhatsappNotifications: body.sendWhatsappNotifications } : {}),
        ...(body.sendSmsNotifications !== undefined ? { sendSmsNotifications: body.sendSmsNotifications } : {}),
        ...(body.primaryColor !== undefined ? { primaryColor: body.primaryColor } : {})
      }
    });

    // Sync company-level booking fields
    await prisma.company.update({
      where: { id: context.companyId },
      data: {
        publicBookingEnabled: settings.enabled,
        autoConfirmBooking: !settings.requireManualApproval,
        slug: settings.publicSlug ?? context.company.slug
      }
    });

    // Update service public visibility if provided
    if (Array.isArray(body.publicServiceIds)) {
      await prisma.service.updateMany({
        where: { companyId: context.companyId },
        data: { isPublic: false }
      });
      if (body.publicServiceIds.length > 0) {
        await prisma.service.updateMany({
          where: { companyId: context.companyId, id: { in: body.publicServiceIds } },
          data: { isPublic: true }
        });
      }
    }

    // Update professional public visibility if provided
    if (Array.isArray(body.publicProfessionalIds)) {
      await prisma.professional.updateMany({
        where: { companyId: context.companyId },
        data: { isPublic: false }
      });
      if (body.publicProfessionalIds.length > 0) {
        await prisma.professional.updateMany({
          where: { companyId: context.companyId, id: { in: body.publicProfessionalIds } },
          data: { isPublic: true }
        });
      }
    }

    await audit(request, context, {
      action: "booking_settings.update",
      entityType: "booking_settings",
      entityId: settings.id,
      newValues: settings
    });

    return ok({ settings });
  } catch (error) {
    return handleApiError(error);
  }
}
