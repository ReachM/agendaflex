import { NextRequest } from "next/server";
import { z } from "zod";
import { created, handleApiError, ok } from "@/lib/api/errors";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";

const createSchema = z.object({
  professionalId: z.string().min(1),
  startAt: z.string(),
  endAt: z.string(),
  reason: z.string().max(200).nullish()
});

export async function GET(request: NextRequest) {
  try {
    const context = await requireTenant(request, "appointments:view");
    const params = request.nextUrl.searchParams;
    const professionalId = params.get("professionalId") || undefined;
    const fromParam = params.get("from");
    const toParam = params.get("to");

    const timeOffs = await prisma.professionalTimeOff.findMany({
      where: {
        companyId: context.companyId,
        ...(professionalId ? { professionalId } : {}),
        ...(fromParam || toParam
          ? {
              AND: [
                ...(toParam ? [{ startAt: { lte: new Date(toParam) } }] : []),
                ...(fromParam ? [{ endAt: { gte: new Date(fromParam) } }] : [])
              ]
            }
          : {})
      },
      include: { professional: { select: { id: true, name: true } } },
      orderBy: { startAt: "asc" }
    });

    return ok({ timeOffs });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireTenant(request, "appointments:manage");
    const parsed = createSchema.parse(await request.json());

    const startAt = new Date(parsed.startAt);
    const endAt = new Date(parsed.endAt);
    if (endAt <= startAt) throw new Error("Fim do bloqueio deve ser depois do início");

    // Verify professional belongs to tenant
    const prof = await prisma.professional.findFirst({
      where: { id: parsed.professionalId, companyId: context.companyId },
      select: { id: true, name: true }
    });
    if (!prof) throw new Error("Profissional não encontrado");

    // Reject if appointment overlap
    const conflict = await prisma.appointment.findFirst({
      where: {
        companyId: context.companyId,
        professionalId: parsed.professionalId,
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        AND: [
          { startAt: { lt: endAt } },
          { endAt: { gt: startAt } }
        ]
      },
      select: { id: true, startAt: true, endAt: true, customer: { select: { name: true } } }
    });
    if (conflict) {
      const t = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(conflict.startAt);
      throw new Error(`Conflito: agendamento de ${conflict.customer.name} em ${t}. Cancele ou remarque antes de bloquear.`);
    }

    const timeOff = await prisma.professionalTimeOff.create({
      data: {
        companyId: context.companyId,
        professionalId: parsed.professionalId,
        startAt,
        endAt,
        reason: parsed.reason ?? null
      }
    });

    await audit(request, context, {
      action: "professional_time_off.create",
      entityType: "professional_time_off",
      entityId: timeOff.id,
      newValues: { professionalId: prof.id, professionalName: prof.name, startAt, endAt, reason: parsed.reason }
    });

    return created({ timeOff });
  } catch (error) {
    return handleApiError(error);
  }
}
