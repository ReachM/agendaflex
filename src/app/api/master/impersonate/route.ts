import { NextRequest } from "next/server";
import { ApiError, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { signAuthToken } from "@/lib/security/jwt";

const IMP_TTL = 60 * 60 * 2; // 2h

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireSuperAdmin(request);

    const body = await request.json().catch(() => ({}));
    const companyId = typeof body.companyId === "string" ? body.companyId : null;
    if (!companyId) throw new ApiError(422, "companyId é obrigatório.");

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new ApiError(404, "Empresa não encontrada.");
    if (company.status !== "ACTIVE") throw new ApiError(409, "Empresa não está ativa.");

    // Assume a identidade do admin (ou primeiro membro ativo) da empresa.
    const membership =
      (await prisma.companyUser.findFirst({
        where: { companyId, status: "ACTIVE", role: { name: "COMPANY_ADMIN" } },
        include: { user: true, role: true },
        orderBy: { createdAt: "asc" }
      })) ??
      (await prisma.companyUser.findFirst({
        where: { companyId, status: "ACTIVE", user: { status: "ACTIVE" } },
        include: { user: true, role: true },
        orderBy: { createdAt: "asc" }
      }));

    if (!membership) throw new ApiError(409, "A empresa não possui usuários ativos para acesso.");

    const tenantToken = await signAuthToken(
      { sub: membership.userId, role: membership.role.name, companyId },
      "2h"
    );

    // Token assinado do super admin para retornar ao painel master ao sair.
    const restoreToken = await signAuthToken({ sub: context.user.id, role: "SUPER_ADMIN" }, "2h");

    await audit(request, null, {
      action: "master.impersonate_start",
      entityType: "company",
      entityId: companyId,
      userId: context.user.id,
      companyId,
      newValues: { companyName: company.name, asUserId: membership.userId }
    });

    const response = ok({ ok: true, companyName: company.name });
    const secure = process.env.NODE_ENV === "production";

    response.cookies.set("marcaiflex_token", tenantToken, {
      httpOnly: true,
      secure,
      sameSite: "strict",
      path: "/",
      maxAge: IMP_TTL
    });
    response.cookies.set("marcaiflex_impersonator", restoreToken, {
      httpOnly: true,
      secure,
      sameSite: "strict",
      path: "/",
      maxAge: IMP_TTL
    });
    // Cookie legível pelo cliente apenas para exibir o banner (não é credencial).
    // cookies.set() já faz o percent-encoding; o banner faz decodeURIComponent ao
    // ler. Não codificar manualmente aqui (causava dupla codificação: "%20" no UI).
    response.cookies.set("marcaiflex_imp_name", company.name, {
      httpOnly: false,
      secure,
      sameSite: "strict",
      path: "/",
      maxAge: IMP_TTL
    });

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
