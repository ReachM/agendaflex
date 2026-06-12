import { NextRequest } from "next/server";
import { ApiError, handleApiError, ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { sendEmail } from "@/lib/services/notifications";

/**
 * POST /api/auth/send-danger-otp
 * Envia um código de confirmação ao e-mail do administrador da empresa para
 * autorizar ações sensíveis (zona de risco). Reaproveita a tabela LoginOtp com
 * purpose="danger".
 */
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "settings:manage", { skipSubscriptionCheck: true });

    const membership = await prisma.companyUser.findFirst({
      where: { companyId: context.companyId, status: "ACTIVE", role: { name: "COMPANY_ADMIN" } },
      include: { user: { select: { email: true, name: true } } }
    });
    if (!membership) throw new ApiError(404, "Administrador não encontrado.");

    const adminEmail = membership.user.email;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.loginOtp.updateMany({
      where: { email: adminEmail, purpose: "danger", usedAt: null },
      data: { usedAt: new Date() }
    });
    await prisma.loginOtp.create({ data: { email: adminEmail, code, purpose: "danger", expiresAt } });

    sendEmail(
      adminEmail,
      "Código de confirmação — MarcaiFlex",
      `
<div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px 20px;text-align:center;">
  <div style="font-size:20px;font-weight:800;margin-bottom:16px;">Marcai<span style="color:#0d9488;">Flex</span></div>
  <h2 style="color:#dc2626;">⚠️ Ação sensível solicitada</h2>
  <p style="color:#64748b;margin-bottom:28px;">Você solicitou uma ação irreversível na sua conta. Use o código abaixo para confirmar. Válido por 10 minutos.</p>
  <div style="font-size:42px;font-weight:900;letter-spacing:12px;color:#dc2626;background:#fef2f2;border:2px solid #fca5a5;border-radius:12px;padding:20px 32px;margin-bottom:24px;font-family:monospace;">${code}</div>
  <p style="font-size:13px;color:#94a3b8;">Se não foi você, ignore este e-mail e verifique sua conta.</p>
</div>
      `
    ).catch(() => {});

    return ok({ sent: true, email: adminEmail });
  } catch (error) {
    return handleApiError(error);
  }
}
