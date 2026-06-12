import { NextRequest } from "next/server";
import { ok } from "@/lib/api/errors";
import { requireTenant } from "@/lib/security/auth";
import { getFeatureFlags } from "@/lib/server/feature-flags";

/**
 * GET /api/feature-flags
 * Rota autenticada (tenant) — retorna apenas as flags `feature.*` ativas/inativas
 * para o painel da empresa, como objeto { notas_fiscais: true, bot_whatsapp: false }.
 * Fail-open: qualquer erro retorna features vazias (tudo ativo).
 */
export async function GET(request: NextRequest) {
  try {
    await requireTenant(request);
    const features = await getFeatureFlags();
    return ok({ features });
  } catch {
    // Fail-open: se der erro, todas as features são consideradas ativas.
    return ok({ features: {} });
  }
}
