import { RoleName, UserStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiError, ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";

/**
 * GET /api/master/bot-requests
 * Lista as solicitações de configuração de bot pendentes/em andamento (Super Admin).
 */
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);

    const configs = await prisma.companyBotConfig.findMany({
      where: {
        botRequestStatus: { in: ["pending", "in_progress"] },
        botRequestPhone: { not: null }
      },
      include: {
        company: {
          select: {
            name: true,
            tradeName: true,
            users: {
              where: { status: UserStatus.ACTIVE, role: { name: RoleName.COMPANY_ADMIN } },
              select: { user: { select: { name: true, email: true } } },
              take: 1
            }
          }
        }
      },
      orderBy: { botRequestedAt: "asc" }
    });

    const requests = configs.map((c) => ({
      companyId: c.companyId,
      companyName: c.company.tradeName ?? c.company.name,
      adminName: c.company.users[0]?.user.name ?? "",
      adminEmail: c.company.users[0]?.user.email ?? "",
      phone: c.botRequestPhone ?? "",
      notes: c.botRequestNotes ?? null,
      requestedAt: c.botRequestedAt?.toISOString() ?? "",
      status: c.botRequestStatus ?? "pending"
    }));

    return ok({ requests, total: requests.length });
  } catch (error) {
    return handleApiError(error);
  }
}

const patchSchema = z.object({
  companyId: z.string().min(1),
  status: z.enum(["pending", "in_progress", "done"])
});

/**
 * PATCH /api/master/bot-requests
 * Atualiza o status de uma solicitação. Ao marcar "done", registra botConfiguredAt
 * e marca connectionStatus="open" (a equipe já conectou o número).
 */
export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request);
    await requireSuperAdmin(request);

    const { companyId, status } = patchSchema.parse(await request.json());

    await prisma.companyBotConfig.update({
      where: { companyId },
      data: {
        botRequestStatus: status,
        botConfiguredAt: status === "done" ? new Date() : undefined,
        connectionStatus: status === "done" ? "open" : undefined
      }
    });

    return ok({ updated: true });
  } catch (error) {
    return handleApiError(error);
  }
}
