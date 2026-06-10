import crypto from "crypto";
import { NextRequest } from "next/server";
import { ApiError, handleApiError, ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/security/csrf";
import { hashPassword } from "@/lib/security/password";
import { rateLimit } from "@/lib/security/rate-limit";
import { getRequestIp } from "@/lib/security/request";
import { resetPasswordSchema } from "@/lib/validation/schemas";

/**
 * Conclui a redefinição de senha. Valida o token (existência, não usado, não
 * expirado), troca o hash da senha e marca o token como usado — tudo numa
 * transação. Mensagem de erro genérica para não vazar estado do token.
 */
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    rateLimit(`reset:${getRequestIp(request)}`, 10, 60 * 60 * 1000);

    const { token, password } = resetPasswordSchema.parse(await request.json());

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new ApiError(422, "Link inválido ou expirado. Solicite um novo.");
    }

    const passwordHash = await hashPassword(password);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } })
    ]);

    return ok({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
