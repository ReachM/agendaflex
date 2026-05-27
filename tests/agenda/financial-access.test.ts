import { describe, expect, it } from "vitest";
import {
  canAccessAgendaFinancials,
  canManageAgendaFinancials,
  isFinancialFieldKey,
  isClinicalSensitiveFieldKey,
  AGENDA_PRESETS,
  FINANCIAL_FIELD_KEYS
} from "@/config/agenda-presets";
import type { PlanFeatures } from "@/lib/security/plan-guard";

// Builds a minimal PlanFeatures object for testing
function makePlan(overrides: Partial<PlanFeatures> = {}): PlanFeatures {
  return {
    planName: "Starter",
    planSlug: "starter",
    maxUsers: 3,
    maxProfessionals: 3,
    maxCustomers: 500,
    maxAppointmentsPerMonth: 300,
    allowClientSelfScheduling: false,
    allowAdvancedReports: false,
    allowFinancialControl: false,
    allowInvoiceRequest: false,
    allowCustomerChecklist: false,
    allowAuditLogs: true,
    allowCustomFields: true,
    allowMultipleServicesPerAppointment: true,
    allowBotIntegration: false,
    ...overrides
  };
}

// ═══ MVP: Financial Access Control ══════════════════════════════════

describe("MVP — Financial Access in Agenda", () => {
  describe("canAccessAgendaFinancials", () => {
    it("returns false when plan has allowFinancialControl=false (all MVP plans)", () => {
      const mvpPlan = makePlan({ allowFinancialControl: false });
      // Even COMPANY_ADMIN cannot see financial if the plan disables it
      expect(canAccessAgendaFinancials("COMPANY_ADMIN", mvpPlan)).toBe(false);
      expect(canAccessAgendaFinancials("MANAGER", mvpPlan)).toBe(false);
      expect(canAccessAgendaFinancials("STAFF", mvpPlan)).toBe(false);
      expect(canAccessAgendaFinancials("SUPER_ADMIN", mvpPlan)).toBe(false);
    });

    it("returns true only when plan AND role BOTH allow financial access", () => {
      const financialPlan = makePlan({ allowFinancialControl: true });
      expect(canAccessAgendaFinancials("COMPANY_ADMIN", financialPlan)).toBe(false);
      // COMPANY_ADMIN does not have financial:view in MVP ROLE_PERMISSIONS
      // (it would need to be re-enabled in v2)
      expect(canAccessAgendaFinancials("SUPER_ADMIN", financialPlan)).toBe(true);
    });
  });

  describe("canManageAgendaFinancials", () => {
    it("returns false for all tenant roles in MVP plans", () => {
      const mvpPlan = makePlan({ allowFinancialControl: false });
      expect(canManageAgendaFinancials("COMPANY_ADMIN", mvpPlan)).toBe(false);
      expect(canManageAgendaFinancials("MANAGER", mvpPlan)).toBe(false);
      expect(canManageAgendaFinancials("STAFF", mvpPlan)).toBe(false);
    });
  });
});

// ═══ Financial Field Key Detection ══════════════════════════════════

describe("isFinancialFieldKey", () => {
  it("detects core financial field keys", () => {
    expect(isFinancialFieldKey("partsValue")).toBe(true);
    expect(isFinancialFieldKey("laborValue")).toBe(true);
    expect(isFinancialFieldKey("discountPercent")).toBe(true);
    expect(isFinancialFieldKey("discountValue")).toBe(true);
    expect(isFinancialFieldKey("totalValue")).toBe(true);
    expect(isFinancialFieldKey("paymentStatus")).toBe(true);
    expect(isFinancialFieldKey("paymentMethod")).toBe(true);
    expect(isFinancialFieldKey("paidAt")).toBe(true);
  });

  it("detects Portuguese financial field key aliases", () => {
    expect(isFinancialFieldKey("valor_da_peca")).toBe(true);
    expect(isFinancialFieldKey("valor_da_mao_de_obra")).toBe(true);
    expect(isFinancialFieldKey("desconto_em_porcentagem")).toBe(true);
    expect(isFinancialFieldKey("valor_total")).toBe(true);
    expect(isFinancialFieldKey("comissao")).toBe(true);
    expect(isFinancialFieldKey("comissao_profissional")).toBe(true);
  });

  it("does NOT flag non-financial fields as financial", () => {
    expect(isFinancialFieldKey("name")).toBe(false);
    expect(isFinancialFieldKey("phone")).toBe(false);
    expect(isFinancialFieldKey("status")).toBe(false);
    expect(isFinancialFieldKey("startAt")).toBe(false);
    expect(isFinancialFieldKey("notes")).toBe(false);
    expect(isFinancialFieldKey("convenio")).toBe(false);
    expect(isFinancialFieldKey("placa_do_veiculo")).toBe(false);
  });
});

// ═══ Clinical Sensitive Field Key Detection ══════════════════════════

describe("isClinicalSensitiveFieldKey", () => {
  it("detects clinical sensitive field keys", () => {
    expect(isClinicalSensitiveFieldKey("allergies")).toBe(true);
    expect(isClinicalSensitiveFieldKey("medications")).toBe(true);
    expect(isClinicalSensitiveFieldKey("preExistingConditions")).toBe(true);
    expect(isClinicalSensitiveFieldKey("clinicalNotes")).toBe(true);
    expect(isClinicalSensitiveFieldKey("bloodType")).toBe(true);
    expect(isClinicalSensitiveFieldKey("alergias")).toBe(true);
    expect(isClinicalSensitiveFieldKey("medicamentos_em_uso")).toBe(true);
  });

  it("does NOT flag non-clinical fields as sensitive", () => {
    expect(isClinicalSensitiveFieldKey("name")).toBe(false);
    expect(isClinicalSensitiveFieldKey("partsValue")).toBe(false);
    expect(isClinicalSensitiveFieldKey("status")).toBe(false);
    expect(isClinicalSensitiveFieldKey("convenio")).toBe(false);
  });
});

// ═══ Preset showFinancial Flag ════════════════════════════════════════

describe("Agenda Preset — showFinancial flag", () => {
  it("clinic preset does NOT show financial (medical billing is separate)", () => {
    expect(AGENDA_PRESETS.clinic.showFinancial).toBe(false);
  });

  it("generic and custom presets do NOT show financial", () => {
    expect(AGENDA_PRESETS.generic.showFinancial).toBe(false);
    expect(AGENDA_PRESETS.custom.showFinancial).toBe(false);
  });

  it("workshop, beauty_salon and technical_support presets have showFinancial=true (enabled in v2 only)", () => {
    // These presets support financial display, but actual rendering requires
    // access.canSeeFinancial which is gated by allowFinancialControl (false in MVP)
    expect(AGENDA_PRESETS.workshop.showFinancial).toBe(true);
    expect(AGENDA_PRESETS.beauty_salon.showFinancial).toBe(true);
    expect(AGENDA_PRESETS.technical_support.showFinancial).toBe(true);
  });

  it("financial previewFields are marked with financial=true to allow runtime filtering", () => {
    const workshopFinancialFields = AGENDA_PRESETS.workshop.previewFields.filter(f => f.financial);
    expect(workshopFinancialFields.length).toBeGreaterThan(0);
    for (const field of workshopFinancialFields) {
      expect(field.source).toBe("financial");
    }
  });
});

// ═══ Preset Financial Fields Match FINANCIAL_FIELD_KEYS Set ══════════

describe("FINANCIAL_FIELD_KEYS set coverage", () => {
  it("all financial previewFields in workshop preset have keys in FINANCIAL_FIELD_KEYS", () => {
    const workshopFinancialFieldKeys = AGENDA_PRESETS.workshop.previewFields
      .filter(f => f.financial)
      .map(f => f.key);

    for (const key of workshopFinancialFieldKeys) {
      expect(FINANCIAL_FIELD_KEYS.has(key)).toBe(true);
    }
  });

  it("all financial previewFields in beauty_salon preset have keys in FINANCIAL_FIELD_KEYS", () => {
    const salonFinancialFieldKeys = AGENDA_PRESETS.beauty_salon.previewFields
      .filter(f => f.financial)
      .map(f => f.key);

    for (const key of salonFinancialFieldKeys) {
      expect(FINANCIAL_FIELD_KEYS.has(key)).toBe(true);
    }
  });
});
