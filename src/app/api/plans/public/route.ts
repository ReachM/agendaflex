import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/security/csrf";
import { rateLimit } from "@/lib/security/rate-limit";
import { getRequestIp } from "@/lib/security/request";

type PlanRow = {
  name: string;
  slug: string;
  description: string | null;
  price: unknown;
  maxProfessionals: number;
  maxAppointmentsPerMonth: number;
  allowClientSelfScheduling: boolean;
  allowAdvancedReports: boolean;
  allowBotIntegration: boolean;
  allowCustomFields: boolean;
  allowMultipleServicesPerAppointment: boolean;
};

/** Converte os campos do plano em uma lista de features amigável para marketing. */
function friendlyFeatures(plan: PlanRow): string[] {
  const features: string[] = [
    `${plan.maxProfessionals} profissionais`,
    `${plan.maxAppointmentsPerMonth.toLocaleString("pt-BR")} agendamentos por mês`
  ];
  if (plan.allowClientSelfScheduling) features.push("Agendamento online pelo cliente");
  if (plan.allowBotIntegration) features.push("Bot de WhatsApp");
  if (plan.allowAdvancedReports) features.push("Relatórios avançados");
  if (plan.allowCustomFields) features.push("Campos personalizados");
  if (plan.allowMultipleServicesPerAppointment) features.push("Múltiplos serviços por agendamento");
  return features;
}

/**
 * Catálogo público de planos para a tela de cadastro. SEM autenticação, retorna
 * apenas campos de marketing (nome, slug, descrição, preço e features amigáveis).
 * NUNCA expõe contagem de assinaturas, limites internos crus ou dados de gestão.
 * A fonte é o model Plan — o que o Super Admin configurar aparece aqui.
 */
export async function GET(request: NextRequest) {
  try {
    assertSameOrigin(request);
    rateLimit(`plans-public:${getRequestIp(request)}`, 60, 60 * 1000);

    const rows = await prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        name: true,
        slug: true,
        description: true,
        price: true,
        maxProfessionals: true,
        maxAppointmentsPerMonth: true,
        allowClientSelfScheduling: true,
        allowAdvancedReports: true,
        allowBotIntegration: true,
        allowCustomFields: true,
        allowMultipleServicesPerAppointment: true
      }
    });

    const plans = rows.map((plan) => ({
      name: plan.name,
      slug: plan.slug,
      description: plan.description,
      price: Number(plan.price),
      features: friendlyFeatures(plan)
    }));

    return ok({ plans });
  } catch (error) {
    return handleApiError(error);
  }
}
