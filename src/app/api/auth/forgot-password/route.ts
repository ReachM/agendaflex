import crypto from "crypto";
import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/security/csrf";
import { rateLimit } from "@/lib/security/rate-limit";
import { getRequestIp } from "@/lib/security/request";
import { sendEmail } from "@/lib/services/notifications";
import { forgotPasswordSchema } from "@/lib/validation/schemas";

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutos

/**
 * Inicia o fluxo de recuperação de senha.
 *
 * Gera um token de uso único (hash SHA-256 persistido, token cru só vai no
 * e-mail) válido por 30 minutos e envia o link de redefinição. SEMPRE responde
 * 200 com o mesmo corpo, exista ou não a conta — evita enumeração de usuários.
 */
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    rateLimit(`forgot:${getRequestIp(request)}`, 5, 60 * 60 * 1000);

    const { email } = forgotPasswordSchema.parse(await request.json());

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    if (user && user.status === "ACTIVE") {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

      // Invalida tokens anteriores antes de emitir um novo.
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
      await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } });

      // Prefere a URL pública configurada; cai para a origem da requisição quando
      // NEXT_PUBLIC_APP_URL não estiver definido (resiliência ao Bug 6).
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
      const resetUrl = `${baseUrl}/redefinir-senha?token=${rawToken}`;

      try {
        await sendEmail(
          user.email,
          "Redefinição de senha — MarcaiFlex",
          `Clique no link abaixo para redefinir sua senha (válido por 30 minutos):\n\n${resetUrl}\n\nSe você não solicitou, ignore este e-mail.`
        );
      } catch (mailError) {
        // Não revela ao cliente que o envio falhou — apenas registra no servidor.
        console.error("[forgot-password] falha ao enviar e-mail:", mailError);
      }
    }

    return ok({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
