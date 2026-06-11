import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiError, ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";

// Chaves de string permitidas no SystemSetting via esta rota. Mantém a tabela
// como um key/value controlado — qualquer chave fora desta lista é ignorada.
const ALLOWED_KEYS = [
  "support_whatsapp", // número do WhatsApp de suporte (ex: "5511999998888")
  "support_message" // mensagem pré-definida ao abrir o chat
] as const;

const patchSchema = z.record(z.string(), z.string().max(500));

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);

    const settings = await prisma.systemSetting.findMany();

    return ok({
      settings: Object.fromEntries(settings.map((s) => [s.key, s.value]))
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireSuperAdmin(request);
    const body = patchSchema.parse(await request.json());

    const updated: Record<string, string> = {};
    for (const [key, value] of Object.entries(body)) {
      if (!ALLOWED_KEYS.includes(key as (typeof ALLOWED_KEYS)[number])) continue;
      await prisma.systemSetting.upsert({
        where: { key },
        update: { value, updatedBy: context.user.id },
        create: { key, value, updatedBy: context.user.id }
      });
      updated[key] = value;
    }

    return ok({ updated });
  } catch (error) {
    return handleApiError(error);
  }
}
