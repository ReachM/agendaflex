import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { requireBotToken } from "@/middleware/require-bot-token";

/**
 * GET /api/bot/data/services
 * Returns active services for the bot's company.
 * Only returns minimal data needed by the chatbot.
 */
export async function GET(request: NextRequest) {
  try {
    const { companyId } = await requireBotToken(request);

    const services = await prisma.service.findMany({
      where: { companyId, isActive: true },
      select: {
        id: true,
        name: true,
        basePrice: true,
        durationMinutes: true
      },
      orderBy: { name: "asc" }
    });

    const mapped = services.map((s) => ({
      id: s.id,
      name: s.name,
      price: s.basePrice ? Number(s.basePrice) : null,
      durationMin: s.durationMinutes
    }));

    return ok(mapped);
  } catch (error) {
    return handleApiError(error);
  }
}
