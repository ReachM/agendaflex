import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { requirePlanFeature } from "@/lib/security/plan-guard";
import { rateLimit } from "@/lib/security/rate-limit";
import { sendTextMessage } from "@/lib/services/whatsapp";

const testSchema = z.object({
  phone: z.string().min(8).max(20),
  message: z.string().min(1).max(1000).optional()
});

/**
 * POST /api/bot-whatsapp/test
 * Envia uma mensagem de teste pela Evolution API usando a instância da empresa.
 */
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "settings:manage");
    await requirePlanFeature(context, "allowBotIntegration", "Bot WhatsApp");

    rateLimit(`bot-whatsapp-test:${context.companyId}`, 5, 60_000);

    const body = testSchema.parse(await request.json());
    const message =
      body.message ?? "✅ Teste do AgendaFlex: seu bot de WhatsApp está conectado e funcionando.";

    await sendTextMessage(context.companyId, body.phone, message);

    await audit(request, context, {
      action: "bot_whatsapp.test",
      entityType: "bot_whatsapp",
      newValues: { phone: body.phone }
    });

    return ok({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
