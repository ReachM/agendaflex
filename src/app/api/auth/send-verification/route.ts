import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handleApiError, ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/security/csrf";
import { rateLimit } from "@/lib/security/rate-limit";
import { getRequestIp } from "@/lib/security/request";
import { sendEmail } from "@/lib/services/notifications";

/**
 * POST /api/auth/send-verification
 * Envia um código de 6 dígitos para confirmar o e-mail ANTES de criar a conta.
 * Público (sem auth) — protegido por same-origin + rate limit por IP.
 */
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    rateLimit(`send-verif:${getRequestIp(request)}`, 5, 60 * 60 * 1000);

    const { email } = z
      .object({ email: z.string().trim().email() })
      .parse(await request.json());
    const normalized = email.toLowerCase();

    const existing = await prisma.user.findUnique({
      where: { email: normalized },
      select: { id: true }
    });
    if (existing) throw new ApiError(409, "Este e-mail já está cadastrado.");

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Invalida códigos anteriores ainda pendentes para o mesmo e-mail.
    await prisma.emailVerification.updateMany({
      where: { email: normalized, usedAt: null },
      data: { usedAt: new Date() }
    });
    await prisma.emailVerification.create({ data: { email: normalized, code, expiresAt } });

    await sendEmail(
      normalized,
      "Verifique seu e-mail — MarcaiFlex",
      `
<div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px 20px;text-align:center;">
  <div style="font-size:20px;font-weight:800;margin-bottom:24px;">Marcai<span style="color:#0d9488;">Flex</span></div>
  <h2 style="font-size:22px;margin-bottom:8px;">Confirme seu e-mail</h2>
  <p style="color:#64748b;margin-bottom:28px;">Use o código abaixo para criar sua conta. Válido por 10 minutos.</p>
  <div style="font-size:42px;font-weight:900;letter-spacing:12px;color:#0d9488;background:#f0fdf4;border:2px solid #bbf7d0;border-radius:12px;padding:20px 32px;margin-bottom:24px;font-family:monospace;">${code}</div>
  <p style="font-size:13px;color:#94a3b8;">Se você não solicitou isso, ignore este e-mail.</p>
</div>
      `
    );

    return ok({ sent: true });
  } catch (error) {
    return handleApiError(error);
  }
}
