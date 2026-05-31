import { NextRequest } from "next/server";
import { ApiError, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "appointments:manage");
    const { id } = await params;

    const existing = await prisma.professionalTimeOff.findFirst({
      where: { id, companyId: context.companyId }
    });
    if (!existing) throw new ApiError(404, "Bloqueio não encontrado");

    await prisma.professionalTimeOff.delete({ where: { id } });

    await audit(request, context, {
      action: "professional_time_off.delete",
      entityType: "professional_time_off",
      entityId: id,
      oldValues: { professionalId: existing.professionalId, startAt: existing.startAt, endAt: existing.endAt }
    });

    return ok({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
