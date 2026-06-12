import { prisma } from "@/lib/prisma";

/**
 * Lê as feature flags (chaves `feature.*`) e devolve um mapa booleano com a
 * chave já sem o prefixo — ex.: `{ notas_fiscais: true, bot_whatsapp: false }`.
 *
 * Fail-open: qualquer erro retorna `{}`, o que faz `FeatureGate` tratar todas
 * as features como ativas (não deixa o painel inacessível por falha de leitura).
 */
export async function getFeatureFlags(): Promise<Record<string, boolean>> {
  try {
    const flags = await prisma.systemFlag.findMany({
      where: { key: { startsWith: "feature." } },
      select: { key: true, value: true }
    });
    return Object.fromEntries(flags.map((f) => [f.key.replace("feature.", ""), f.value]));
  } catch {
    return {}; // fail-open
  }
}
