import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handleApiError, ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/security/csrf";
import { rateLimit } from "@/lib/security/rate-limit";
import { getRequestIp } from "@/lib/security/request";

/**
 * POST /api/auth/verify-email-code
 * Valida o código de verificação SEM consumi-lo — apenas confirma que existe
 * e ainda não expirou, para liberar o avanço de etapa no cadastro.
 * O consumo definitivo acontece em /api/auth/register.
 * Público (sem auth) — protegido por same-origin + rate limit por IP.
 */
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    rateLimit(`verify-code:${getRequestIp(request)}`, 10, 60 * 60 * 1000);

    const body = z
      .object({
        email: z.string().trim().email(),
        code: z.string().trim().regex(/^\d{6}$/)
      })
      .parse(await request.json());

    const verification = await prisma.emailVerification.findFirst({
      where: {
        email: body.email.toLowerCase(),
        code: body.code,
        usedAt: null,
        expiresAt: { gt: new Date() }
      }
    });

    if (!verification) throw new ApiError(401, "Código inválido ou expirado.");

    return ok({ valid: true });
  } catch (error) {
    return handleApiError(error);
  }
}
