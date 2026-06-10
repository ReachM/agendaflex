import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { ApiError, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const auth = await requireSuperAdmin(request);
    const { id } = await context.params;

    if (id === auth.user.id) {
      throw new ApiError(409, "Você não pode alterar sua própria conta pelo painel master.");
    }

    const body = await request.json().catch(() => ({}));
    const action = body.action as string;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new ApiError(404, "Usuário não encontrado.");

    if (action === "suspend") {
      await prisma.user.update({ where: { id }, data: { status: "INACTIVE" } });
      await audit(request, auth, { action: "master.user_suspended", entityType: "user", entityId: id });
      return ok({ message: "Usuário suspenso." });
    }

    if (action === "reactivate") {
      await prisma.user.update({ where: { id }, data: { status: "ACTIVE" } });
      await audit(request, auth, { action: "master.user_reactivated", entityType: "user", entityId: id });
      return ok({ message: "Usuário reativado." });
    }

    if (action === "reset_password") {
      const newPassword = Math.random().toString(36).slice(-10) + "A1!";
      const hash = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({ where: { id }, data: { passwordHash: hash } });
      await audit(request, auth, { action: "master.user_password_reset", entityType: "user", entityId: id });
      return ok({ message: "Senha resetada.", temporaryPassword: newPassword });
    }

    throw new ApiError(422, "Ação inválida. Use: suspend | reactivate | reset_password");
  } catch (error) {
    return handleApiError(error);
  }
}
