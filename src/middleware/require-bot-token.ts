import type { NextRequest } from "next/server";
import { ApiError } from "@/lib/api/errors";
import { verifyBotToken } from "@/lib/bot-token";
import { prisma } from "@/lib/prisma";
import { resolvePlanFeatures } from "@/lib/security/plan-guard";

export type BotAuthContext = {
  companyId: string;
};

/**
 * Middleware for routes under /api/bot/data/*.
 * Reads the Authorization: Bearer <token> header, validates the bot JWT,
 * and returns the companyId extracted from the token.
 *
 * The companyId MUST come from the token — never from body or query params.
 */
export async function requireBotToken(request: NextRequest): Promise<BotAuthContext> {
  const bearer = request.headers.get("authorization");

  if (!bearer || !bearer.startsWith("Bearer ")) {
    throw new ApiError(401, "Token do bot não fornecido.");
  }

  const token = bearer.slice(7);

  if (!token) {
    throw new ApiError(401, "Token do bot não fornecido.");
  }

  const { companyId } = await verifyBotToken(token);

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { status: true, botEnabled: true }
  });

  if (!company || company.status !== "ACTIVE" || !company.botEnabled) {
    throw new ApiError(401, "Bot inativo ou empresa indisponível.");
  }

  const features = await resolvePlanFeatures(companyId);
  if (!features.allowBotIntegration) {
    throw new ApiError(403, "Integração com Bot WhatsApp indisponível no plano atual.");
  }

  return { companyId };
}
