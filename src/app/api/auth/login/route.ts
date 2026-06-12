import { NextRequest } from "next/server";
import { handleApiError, ApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/security/csrf";
import { verifyPassword } from "@/lib/security/password";
import { rateLimit } from "@/lib/security/rate-limit";
import { getRequestIp } from "@/lib/security/request";
import { sendEmail } from "@/lib/services/notifications";
import { loginSchema } from "@/lib/validation/schemas";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const body = loginSchema.parse(await request.json());
    rateLimit(`login:${getRequestIp(request)}:${body.email.toLowerCase()}`, 5, 5 * 60 * 1000);

    const user = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
      include: {
        systemRole: true,
        memberships: {
          include: {
            role: true,
            company: true
          },
          orderBy: { createdAt: "asc" }
        }
      }
    });

    const isValid = user ? await verifyPassword(body.password, user.passwordHash) : false;
    if (!user || !isValid || user.status !== "ACTIVE") {
      await audit(request, null, {
        action: "auth.login_failed",
        entityType: "user",
        entityId: user?.id,
        userId: user?.id,
        newValues: { email: body.email }
      });
      throw new ApiError(401, "E-mail ou senha inválidos.");
    }

    const superRole = user.systemRole?.name === "SUPER_ADMIN";
    const activeMembership = user.memberships.find(
      (membership) => membership.status === "ACTIVE" && membership.company.status === "ACTIVE"
    );

    if (!superRole && !activeMembership) {
      throw new ApiError(403, "Usuário sem empresa ativa vinculada.");
    }

    // Senha correta — em vez de logar direto, emite um código de 2º fator (OTP)
    // por e-mail. A sessão só é criada após /api/auth/verify-otp confirmar o código.
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.loginOtp.updateMany({
      where: { email: user.email, purpose: "login", usedAt: null },
      data: { usedAt: new Date() }
    });
    await prisma.loginOtp.create({
      data: { email: user.email, code, purpose: "login", expiresAt }
    });

    // Fire-and-forget — o envio do e-mail nunca bloqueia a resposta.
    sendEmail(
      user.email,
      "Código de acesso — MarcaiFlex",
      `
<div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px 20px;text-align:center;">
  <div style="font-size:20px;font-weight:800;margin-bottom:24px;">Marcai<span style="color:#0d9488;">Flex</span></div>
  <h2>Código de acesso</h2>
  <p style="color:#64748b;margin-bottom:28px;">Válido por 10 minutos.</p>
  <div style="font-size:42px;font-weight:900;letter-spacing:12px;color:#0d9488;background:#f0fdf4;border:2px solid #bbf7d0;border-radius:12px;padding:20px 32px;margin-bottom:24px;font-family:monospace;">${code}</div>
  <p style="font-size:13px;color:#94a3b8;">Se não foi você, ignore este e-mail.</p>
</div>
      `
    ).catch(() => {});

    await audit(request, null, {
      action: "auth.login_otp_sent",
      entityType: "user",
      entityId: user.id,
      userId: user.id,
      companyId: activeMembership?.companyId ?? null
    });

    return ok({ otpRequired: true, email: user.email });
  } catch (error) {
    return handleApiError(error);
  }
}
