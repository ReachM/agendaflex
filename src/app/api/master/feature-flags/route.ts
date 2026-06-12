import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiError, ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";

const putSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.boolean()
});

/**
 * Flags de funcionalidade do painel empresa. Criadas (ativas) no primeiro GET
 * caso ainda não existam — sem sobrescrever valores já definidos pelo admin.
 */
const DEFAULT_FLAGS = [
  { key: "feature.financeiro", value: true, description: "Financeiro — fluxo de caixa, receitas e despesas" },
  { key: "feature.notas_fiscais", value: true, description: "Notas Fiscais — emissão e controle" },
  { key: "feature.relatorios", value: true, description: "Relatórios — análises e indicadores" },
  { key: "feature.bot_whatsapp", value: true, description: "Bot WhatsApp — agendamento conversacional" },
  { key: "feature.link_agendamento", value: true, description: "Link de Agendamento — página pública para clientes" },
  { key: "feature.clientes", value: true, description: "Clientes — cadastro, histórico e importação" }
];

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);

    // Garante que as flags de feature existam (sem sobrescrever valor atual).
    for (const f of DEFAULT_FLAGS) {
      await prisma.systemFlag.upsert({
        where: { key: f.key },
        update: {},
        create: { key: f.key, value: f.value, description: f.description }
      });
    }

    const flags = await prisma.systemFlag.findMany({
      orderBy: { key: "asc" }
    });

    return ok({ flags });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireSuperAdmin(request);
    const { key, value } = putSchema.parse(await request.json());

    const flag = await prisma.systemFlag.upsert({
      where: { key },
      create: { key, value, updatedBy: context.user.id },
      update: { value, updatedBy: context.user.id }
    });

    return ok({ flag });
  } catch (error) {
    return handleApiError(error);
  }
}
