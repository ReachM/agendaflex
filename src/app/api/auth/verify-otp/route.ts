import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/security/csrf";
import { signAuthToken } from "@/lib/security/jwt";
import { rateLimit } from "@/lib/security/rate-limit";
import { getRequestIp } from "@/lib/security/request";

const verifyOtpSchema = z.object({
  email: z.string().trim().email(),
  code: z.string().trim().length(6),
  rememberMe: z.coerce.boolean().optional()
});

/**
 * POST /api/auth/verify-otp
 * Confirma o código de 2º fator emitido por /api/auth/login e cria a sessão.
 * Reaplica a mesma resolução de papel/tenant do login normal.
 */
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const body = verifyOtpSchema.parse(await request.json());
    rateLimit(`otp:${getRequestIp(request)}`, 10, 60 * 1000);

    const email = body.email.toLowerCase();
    const otp = await prisma.loginOtp.findFirst({
      where: {
        email,
        code: body.code,
        purpose: "login",
        usedAt: null,
        expiresAt: { gt: new Date() }
      }
    });
    if (!otp) throw new ApiError(401, "Código inválido ou expirado.");

    await prisma.loginOtp.update({ where: { id: otp.id }, data: { usedAt: new Date() } });

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        systemRole: true,
        memberships: {
          include: { role: true, company: true },
          orderBy: { createdAt: "asc" }
        }
      }
    });

    if (!user || user.status !== "ACTIVE") {
      throw new ApiError(401, "Usuário inativo ou não encontrado.");
    }

    const superRole = user.systemRole?.name === "SUPER_ADMIN";
    const activeMembership = user.memberships.find(
      (membership) => membership.status === "ACTIVE" && membership.company.status === "ACTIVE"
    );

    if (!superRole && !activeMembership) {
      throw new ApiError(403, "Usuário sem empresa ativa vinculada.");
    }

    const tokenTtl = body.rememberMe ? "30d" : "8h";
    const token = await signAuthToken(
      superRole
        ? { sub: user.id, role: "SUPER_ADMIN" }
        : {
            sub: user.id,
            role: activeMembership!.role.name,
            companyId: activeMembership!.companyId
          },
      tokenTtl
    );

    const response = ok({
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      role: superRole ? "SUPER_ADMIN" : activeMembership!.role.name,
      company: activeMembership?.company
        ? {
            id: activeMembership.company.id,
            name: activeMembership.company.name,
            status: activeMembership.company.status,
            segment: activeMembership.company.segment
          }
        : null,
      redirectTo: superRole ? "/master" : "/dashboard"
    });

    // 30 dias se "manter conectado", senão a sessão padrão de 8h.
    const cookieMaxAge = body.rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 8;
    response.cookies.set("marcaiflex_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: cookieMaxAge
    });

    await audit(request, null, {
      action: "auth.login_success",
      entityType: "user",
      entityId: user.id,
      userId: user.id,
      companyId: activeMembership?.companyId ?? null
    });

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
