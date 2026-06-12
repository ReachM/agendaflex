import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { sendEmail } from "@/lib/services/notifications";

const dangerSchema = z.object({
  action: z.enum(["export", "pause", "delete"]),
  code: z.string().trim().length(6)
});

/**
 * POST /api/company/danger-action
 * Executa uma ação sensível (exportar/pausar/excluir) após validar o código de
 * confirmação enviado por /api/auth/send-danger-otp.
 *
 * Observação: o enum CompanyStatus não tem CANCELLED — "delete" usa INACTIVE
 * (empresa some do acesso; dados preservados para limpeza posterior).
 */
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "settings:manage", { skipSubscriptionCheck: true });
    const body = dangerSchema.parse(await request.json());

    const membership = await prisma.companyUser.findFirst({
      where: { companyId: context.companyId, status: "ACTIVE", role: { name: "COMPANY_ADMIN" } },
      include: { user: { select: { email: true } } }
    });
    if (!membership) throw new ApiError(404, "Administrador não encontrado.");

    const adminEmail = membership.user.email;
    const otp = await prisma.loginOtp.findFirst({
      where: {
        email: adminEmail,
        code: body.code,
        purpose: "danger",
        usedAt: null,
        expiresAt: { gt: new Date() }
      }
    });
    if (!otp) throw new ApiError(401, "Código inválido ou expirado.");

    await prisma.loginOtp.update({ where: { id: otp.id }, data: { usedAt: new Date() } });

    if (body.action === "export") {
      // Geração real do arquivo fica para depois — por ora confirma o pedido.
      sendEmail(
        adminEmail,
        "Exportação solicitada — MarcaiFlex",
        "Recebemos sua solicitação de exportação. Enviaremos o arquivo em até 24h."
      ).catch(() => {});

      await audit(request, context, {
        action: "company.data_export_requested",
        entityType: "company",
        entityId: context.companyId
      });

      return ok({ done: true, scheduled: true });
    }

    const newStatus = body.action === "pause" ? "SUSPENDED" : "INACTIVE";
    await prisma.company.update({
      where: { id: context.companyId },
      data: { status: newStatus }
    });

    await audit(request, context, {
      action: body.action === "pause" ? "company.paused" : "company.deleted",
      entityType: "company",
      entityId: context.companyId,
      newValues: { status: newStatus }
    });

    // Encerra a sessão — a empresa não está mais ACTIVE, o acesso seria barrado.
    const response = ok({ done: true, redirectTo: "/" });
    response.cookies.set("marcaiflex_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 0
    });
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
