import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { resolvePlanFeatures } from "@/lib/security/plan-guard";

/**
 * GET /api/bot/status
 * Return the current bot integration status for the authenticated company.
 * Never returns sensitive data (API key, webhook secret, bot token).
 */
export async function GET(request: NextRequest) {
  try {
    const context = await requireTenant(request);

    const company = await prisma.company.findUniqueOrThrow({
      where: { id: context.companyId },
      select: {
        botEnabled: true,
        botRegisteredAt: true
      }
    });

    const features = await resolvePlanFeatures(context.companyId);

    if (company.botEnabled) {
      return ok({
        enabled: true,
        connectedAt: company.botRegisteredAt?.toISOString() ?? null,
        plan: features.planSlug
      });
    }

    return ok({
      enabled: false,
      plan: features.planSlug
    });
  } catch (error) {
    return handleApiError(error);
  }
}
