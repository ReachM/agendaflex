import { NextRequest } from "next/server";
import { ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/public/support
 * Rota pública: expõe apenas o número e a mensagem do WhatsApp de suporte,
 * consumidos pelo botão flutuante do painel das empresas (AppShell).
 */
export async function GET(_request: NextRequest) {
  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: ["support_whatsapp", "support_message"] } }
  });
  const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));

  return ok({
    whatsapp: map.support_whatsapp ?? null,
    message: map.support_message ?? "Olá! Preciso de ajuda com o MarcaiFlex."
  });
}
