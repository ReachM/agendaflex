import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/lib/api/errors";
import { assertSameOrigin } from "@/lib/security/csrf";
import { rateLimit } from "@/lib/security/rate-limit";
import { getRequestIp } from "@/lib/security/request";
import { forgotPasswordSchema } from "@/lib/validation/schemas";

/**
 * STUB — fluxo de recuperação de senha.
 *
 * Hoje esta rota apenas valida o e-mail e responde 200, sem enviar nada.
 * Não devolve se o usuário existe (para evitar enumeração de contas). Quando o
 * fluxo real for implementado (token + e-mail), substituir aqui:
 *  1) gerar token, persistir hash com expiresAt curto (15–30 min);
 *  2) enviar e-mail com link /redefinir-senha?token=...;
 *  3) manter a resposta sempre 200, independente de o e-mail existir.
 */
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    rateLimit(`forgot:${getRequestIp(request)}`, 5, 60 * 60 * 1000);

    // Valida o formato do e-mail (422 se inválido). Sucesso = 200 sem detalhes.
    forgotPasswordSchema.parse(await request.json());

    return ok({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
