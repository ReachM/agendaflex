import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/security/auth";

/**
 * Lista os planos ativos para a empresa logada (consumido pelo modal de bloqueio
 * de trial). GET é método seguro, então permanece acessível mesmo com o trial
 * vencido — é justamente o caminho para o cliente assinar. Retorna apenas campos
 * públicos do plano (sem contagem de assinaturas nem dados internos).
 */
export async function GET(request: NextRequest) {
  try {
    await requireTenant(request);

    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        price: true,
        maxUsers: true,
        maxProfessionals: true,
        maxCustomers: true,
        maxAppointmentsPerMonth: true,
        allowClientSelfScheduling: true,
        allowAdvancedReports: true,
        allowBotIntegration: true,
        allowCustomFields: true,
        allowMultipleServicesPerAppointment: true
      }
    });

    return ok({ plans });
  } catch (error) {
    return handleApiError(error);
  }
}
