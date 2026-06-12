import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/lib/api/errors";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { requirePlanFeature } from "@/lib/security/plan-guard";
import { createInstance, getQrCode } from "@/lib/services/whatsapp";

/**
 * GET /api/bot-whatsapp/qrcode
 * Consulta o QR Code / estado de conexão da instância da empresa (usado no
 * polling enquanto o usuário escaneia).
 */
export async function GET(request: NextRequest) {
  try {
    const context = await requireTenant(request, "settings:manage");
    await requirePlanFeature(context, "allowBotIntegration", "Bot WhatsApp");

    const result = await getQrCode(context.companyId);
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/bot-whatsapp/qrcode
 * Recria a instância na Evolution API e configura o webhook. O QR Code não vem
 * na resposta — chega em ~2-5s via webhook QRCODE_UPDATED; o front faz polling
 * em GET até o QR aparecer. Retornamos "connecting" imediatamente.
 */
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "settings:manage");
    await requirePlanFeature(context, "allowBotIntegration", "Bot WhatsApp");

    await createInstance(context.companyId);
    return ok({ qrcode: null, status: "connecting" });
  } catch (error) {
    return handleApiError(error);
  }
}
