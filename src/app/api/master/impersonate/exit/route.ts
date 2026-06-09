import { NextRequest } from "next/server";
import { ApiError, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/security/csrf";
import { signAuthToken, verifyAuthToken } from "@/lib/security/jwt";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);

    const restoreRaw = request.cookies.get("marcaiflex_impersonator")?.value;
    if (!restoreRaw) throw new ApiError(400, "Nenhuma sessão de impersonation ativa.");

    let payload;
    try {
      payload = await verifyAuthToken(restoreRaw);
    } catch {
      throw new ApiError(401, "Sessão de impersonation inválida.");
    }

    if (payload.role !== "SUPER_ADMIN") throw new ApiError(403, "Sessão de retorno inválida.");

    const admin = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { systemRole: { select: { name: true } } }
    });
    if (!admin || admin.status !== "ACTIVE" || admin.systemRole?.name !== "SUPER_ADMIN") {
      throw new ApiError(403, "Super admin não encontrado.");
    }

    const adminToken = await signAuthToken({ sub: admin.id, role: "SUPER_ADMIN" }, "8h");

    await audit(request, null, {
      action: "master.impersonate_end",
      entityType: "user",
      entityId: admin.id,
      userId: admin.id
    });

    const response = ok({ ok: true });
    const secure = process.env.NODE_ENV === "production";

    response.cookies.set("marcaiflex_token", adminToken, {
      httpOnly: true,
      secure,
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 8
    });
    response.cookies.set("marcaiflex_impersonator", "", { path: "/", maxAge: 0 });
    response.cookies.set("marcaiflex_imp_name", "", { path: "/", maxAge: 0 });

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
