import { NextRequest } from "next/server";
import { ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/public/maintenance
 * Rota pública e leve: informa se o modo manutenção está ativo. Consumida pelo
 * middleware (para redirecionar visitantes) e pelo AppShell (banner para admins
 * logados). Mantida sem auth de propósito — não expõe nada sensível.
 */
export async function GET(_request: NextRequest) {
  try {
    const [flag, msg] = await Promise.all([
      prisma.systemFlag.findUnique({ where: { key: "maintenance_mode" } }),
      prisma.systemSetting.findUnique({ where: { key: "maintenance_message" } })
    ]);

    return ok({
      enabled: flag?.value ?? false,
      message: msg?.value ?? "O sistema está em manutenção. Voltamos em breve!"
    });
  } catch {
    // Fail-open: nunca derruba o site por falha ao consultar a flag.
    return ok({ enabled: false, message: "" });
  }
}
