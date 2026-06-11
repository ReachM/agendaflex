import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { requirePlanFeature } from "@/lib/security/plan-guard";
import { disconnectInstance } from "@/lib/services/whatsapp";

/**
 * POST /api/bot-whatsapp/disconnect
 * Faz logout da instância na Evolution API e desliga o bot da empresa.
 */
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "settings:manage");
    await requirePlanFeature(context, "allowBotIntegration", "Bot WhatsApp");

    await disconnectInstance(context.companyId);

    await prisma.company.update({
      where: { id: context.companyId },
      data: { botEnabled: false }
    });

    await audit(request, context, {
      action: "bot_whatsapp.disconnect",
      entityType: "bot_whatsapp",
      entityId: context.companyId
    });

    return ok({ status: "disconnected" });
  } catch (error) {
    return handleApiError(error);
  }
}
