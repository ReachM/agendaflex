import type { TenantAuthContext } from "@/lib/security/auth";
import { ApiError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";

export type PlanFeatures = {
  planName: string;
  planSlug: string;
  maxUsers: number;
  maxProfessionals: number;
  maxCustomers: number;
  maxAppointmentsPerMonth: number;
  allowClientSelfScheduling: boolean;
  allowAdvancedReports: boolean;
  allowFinancialControl: boolean;
  allowInvoiceRequest: boolean;
  allowCustomerChecklist: boolean;
  allowAuditLogs: boolean;
  allowCustomFields: boolean;
  allowMultipleServicesPerAppointment: boolean;
  allowBotIntegration: boolean;
};

const DEFAULT_FEATURES: PlanFeatures = {
  planName: "Starter",
  planSlug: "starter",
  maxUsers: 3,
  maxProfessionals: 5,
  maxCustomers: 100,
  maxAppointmentsPerMonth: 200,
  allowClientSelfScheduling: false,
  allowAdvancedReports: false,
  allowFinancialControl: false,
  allowInvoiceRequest: false,
  allowCustomerChecklist: false,
  allowAuditLogs: true,
  allowCustomFields: true,
  allowMultipleServicesPerAppointment: true,
  allowBotIntegration: false
};

/**
 * Resolve the plan features for a company. Checks the company_subscriptions table first,
 * falls back to the company.plan string field for backward compatibility.
 */
export async function resolvePlanFeatures(companyId: string): Promise<PlanFeatures> {
  // Try active subscription first
  const subscription = await prisma.companySubscription.findFirst({
    where: {
      companyId,
      status: { in: ["ACTIVE", "TRIALING"] }
    },
    include: { plan: true },
    orderBy: { createdAt: "desc" }
  });

  if (subscription?.plan) {
    return mapPlanToFeatures(subscription.plan);
  }

  // Fallback: lookup plan by company.plan slug
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { plan: true }
  });

  if (company?.plan) {
    const plan = await prisma.plan.findUnique({
      where: { slug: company.plan }
    });
    if (plan) {
      return mapPlanToFeatures(plan);
    }
  }

  return DEFAULT_FEATURES;
}

function mapPlanToFeatures(plan: {
  name: string;
  slug: string;
  maxUsers: number;
  maxProfessionals: number;
  maxCustomers: number;
  maxAppointmentsPerMonth: number;
  allowClientSelfScheduling: boolean;
  allowAdvancedReports: boolean;
  allowFinancialControl: boolean;
  allowInvoiceRequest: boolean;
  allowCustomerChecklist: boolean;
  allowAuditLogs: boolean;
  allowCustomFields: boolean;
  allowMultipleServicesPerAppointment: boolean;
  allowBotIntegration: boolean;
}): PlanFeatures {
  return {
    planName: plan.name,
    planSlug: plan.slug,
    maxUsers: plan.maxUsers,
    maxProfessionals: plan.maxProfessionals,
    maxCustomers: plan.maxCustomers,
    maxAppointmentsPerMonth: plan.maxAppointmentsPerMonth,
    allowClientSelfScheduling: plan.allowClientSelfScheduling,
    allowAdvancedReports: plan.allowAdvancedReports,
    allowFinancialControl: plan.allowFinancialControl,
    allowInvoiceRequest: plan.allowInvoiceRequest,
    allowCustomerChecklist: plan.allowCustomerChecklist,
    allowAuditLogs: plan.allowAuditLogs,
    allowCustomFields: plan.allowCustomFields,
    allowMultipleServicesPerAppointment: plan.allowMultipleServicesPerAppointment,
    allowBotIntegration: plan.allowBotIntegration
  };
}

/**
 * Check if a feature is available for the company's plan. Throws 403 if not.
 */
export async function requirePlanFeature(
  context: TenantAuthContext,
  featureKey: keyof PlanFeatures,
  featureLabel?: string
) {
  const features = await resolvePlanFeatures(context.companyId);
  const value = features[featureKey];

  if (typeof value === "boolean" && !value) {
    const label = featureLabel ?? featureKey;
    const upgradeHint = features.planSlug === "starter"
      ? "Essa funcionalidade está disponível a partir do plano Pro."
      : features.planSlug === "pro"
        ? "Essa funcionalidade está disponível no plano Max."
        : `A funcionalidade "${label}" não está incluída no seu plano atual.`;
    throw new ApiError(403, upgradeHint);
  }

  return features;
}

/**
 * Check if the company has reached a numeric limit (users, appointments, etc).
 */
export async function checkPlanLimit(
  companyId: string,
  limitKey: "maxUsers" | "maxProfessionals" | "maxCustomers" | "maxAppointmentsPerMonth",
  currentCount: number
) {
  const features = await resolvePlanFeatures(companyId);
  const limit = features[limitKey];

  if (currentCount >= limit) {
    const labels: Record<string, string> = {
      maxUsers: "usuários",
      maxProfessionals: "profissionais",
      maxCustomers: "clientes",
      maxAppointmentsPerMonth: "agendamentos neste mês"
    };
    throw new ApiError(
      403,
      `Limite do plano atingido: ${currentCount}/${limit} ${labels[limitKey]}. Faça upgrade para ampliar.`
    );
  }

  return features;
}

/**
 * Get plan features as a flat boolean map for frontend menu visibility.
 */
export function featuresToBooleanMap(features: PlanFeatures): Record<string, boolean> {
  return {
    allowClientSelfScheduling: features.allowClientSelfScheduling,
    allowAdvancedReports: features.allowAdvancedReports,
    allowFinancialControl: features.allowFinancialControl,
    allowInvoiceRequest: features.allowInvoiceRequest,
    allowCustomerChecklist: features.allowCustomerChecklist,
    allowAuditLogs: features.allowAuditLogs,
    allowCustomFields: features.allowCustomFields,
    allowMultipleServicesPerAppointment: features.allowMultipleServicesPerAppointment,
    allowBotIntegration: features.allowBotIntegration
  };
}
