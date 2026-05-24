import { beforeEach, describe, expect, it, vi } from "vitest";

// Plan Guard usa o prisma para resolver o plano da empresa. Mockamos o prisma
// e exercitamos o requirePlanFeature real (mesma checagem usada nas rotas do bot).
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    companySubscription: { findFirst: vi.fn() },
    company: { findUnique: vi.fn() },
    plan: { findUnique: vi.fn() }
  } as any
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { requirePlanFeature } from "@/lib/security/plan-guard";

function planRow(slug: string, allowBotIntegration: boolean) {
  return {
    name: slug,
    slug,
    maxUsers: 10,
    maxProfessionals: 10,
    maxCustomers: 1000,
    maxAppointmentsPerMonth: 1000,
    allowClientSelfScheduling: true,
    allowAdvancedReports: true,
    allowFinancialControl: false,
    allowInvoiceRequest: false,
    allowCustomerChecklist: false,
    allowAuditLogs: true,
    allowCustomFields: true,
    allowMultipleServicesPerAppointment: true,
    allowBotIntegration
  };
}

const ctx = { companyId: "company-1" } as any;

beforeEach(() => {
  vi.resetAllMocks();
  // Sem assinatura ativa -> cai no fallback por company.plan slug.
  prismaMock.companySubscription.findFirst.mockResolvedValue(null);
});

describe("Plan Guard — ativação do Bot WhatsApp por plano", () => {
  it("Pro (salaobella) pode ativar o bot", async () => {
    prismaMock.company.findUnique.mockResolvedValue({ plan: "pro" });
    prismaMock.plan.findUnique.mockResolvedValue(planRow("pro", true));

    const features = await requirePlanFeature(ctx, "allowBotIntegration", "Bot WhatsApp");
    expect(features.allowBotIntegration).toBe(true);
  });

  it("Max (oficinacentral) pode ativar o bot", async () => {
    prismaMock.company.findUnique.mockResolvedValue({ plan: "max" });
    prismaMock.plan.findUnique.mockResolvedValue(planRow("max", true));

    const features = await requirePlanFeature(ctx, "allowBotIntegration", "Bot WhatsApp");
    expect(features.allowBotIntegration).toBe(true);
  });

  it("Starter (clinicavida) recebe 403 (allowBotIntegration false)", async () => {
    prismaMock.company.findUnique.mockResolvedValue({ plan: "starter" });
    prismaMock.plan.findUnique.mockResolvedValue(planRow("starter", false));

    await expect(
      requirePlanFeature(ctx, "allowBotIntegration", "Bot WhatsApp")
    ).rejects.toMatchObject({ status: 403 });
  });
});
