import { NextRequest } from "next/server";
import { created, handleApiError, ApiError } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/security/csrf";
import { signAuthToken } from "@/lib/security/jwt";
import { verifyPassword } from "@/lib/security/password";
import { rateLimit } from "@/lib/security/rate-limit";
import { getRequestIp } from "@/lib/security/request";
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

    const response = created({
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
