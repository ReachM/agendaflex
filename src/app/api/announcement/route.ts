import { NextRequest } from "next/server";
import { ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { requireAnyAuth } from "@/lib/security/auth";

/**
 * GET /api/announcement
 * Aviso global exibido no topo do painel das empresas. Autenticada (qualquer
 * usuário logado). Falha-suave: nunca derruba o painel por causa do aviso.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAnyAuth(request);

    const [a, t] = await Promise.all([
      prisma.systemSetting.findUnique({ where: { key: "global_announcement" } }),
      prisma.systemSetting.findUnique({ where: { key: "announcement_type" } })
    ]);

    return ok({
      message: a?.value ?? "",
      type: t?.value ?? "info",
      active: Boolean(a?.value)
    });
  } catch {
    return ok({ message: "", type: "info", active: false });
  }
}
