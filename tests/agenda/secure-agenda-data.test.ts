import type { RoleName } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  canAccessAgendaFinancials,
  canAccessClinicalSensitiveFields,
  canManageAgendaFinancials,
  getAgendaPreset,
  isClinicalSensitiveFieldKey,
  isFinancialFieldKey
} from "@/config/agenda-presets";
import type { PlanFeatures } from "@/lib/security/plan-guard";

const maxPlan: PlanFeatures = {
  planName: "Max",
  planSlug: "max",
  maxUsers: 100,
  maxProfessionals: 100,
  maxCustomers: 50000,
  maxAppointmentsPerMonth: 50000,
  allowClientSelfScheduling: true,
  allowAdvancedReports: true,
  allowFinancialControl: true,
  allowInvoiceRequest: true,
  allowCustomerChecklist: true,
  allowAuditLogs: true,
  allowCustomFields: true,
  allowMultipleServicesPerAppointment: true,
  allowBotIntegration: true
};

const starterPlan: PlanFeatures = {
  ...maxPlan,
  planName: "Starter",
  planSlug: "starter",
  allowFinancialControl: false,
  allowClientSelfScheduling: false,
  allowAdvancedReports: false,
  allowInvoiceRequest: false,
  allowCustomerChecklist: false,
  allowBotIntegration: false
};

describe("Agenda secure data rules", () => {
  it("recognizes financial field keys used by agenda and custom values", () => {
    expect(isFinancialFieldKey("totalValue")).toBe(true);
    expect(isFinancialFieldKey("_grandTotal")).toBe(true);
    expect(isFinancialFieldKey("valor_da_mao_de_obra")).toBe(true);
    expect(isFinancialFieldKey("comissao_profissional")).toBe(true);
    expect(isFinancialFieldKey("motivo_da_consulta")).toBe(false);
  });

  it("recognizes clinical sensitive field keys", () => {
    expect(isClinicalSensitiveFieldKey("allergies")).toBe(true);
    expect(isClinicalSensitiveFieldKey("medicamentos_em_uso")).toBe(true);
    expect(isClinicalSensitiveFieldKey("observacao_atendimento")).toBe(true);
    expect(isClinicalSensitiveFieldKey("placa_do_veiculo")).toBe(false);
  });

  it("does not allow staff to see financial or clinical-sensitive data", () => {
    const role = "STAFF" as RoleName;
    expect(canAccessAgendaFinancials(role, maxPlan)).toBe(false);
    expect(canManageAgendaFinancials(role, maxPlan)).toBe(false);
    expect(canAccessClinicalSensitiveFields(role)).toBe(false);
  });

  it("allows managers to see financial data only when the plan allows it", () => {
    const role = "MANAGER" as RoleName;
    expect(canAccessAgendaFinancials(role, maxPlan)).toBe(true);
    expect(canAccessAgendaFinancials(role, starterPlan)).toBe(false);
    expect(canManageAgendaFinancials(role, maxPlan)).toBe(false);
  });

  it("allows company admins to see clinical-sensitive fields", () => {
    const role = "COMPANY_ADMIN" as RoleName;
    expect(canAccessClinicalSensitiveFields(role)).toBe(true);
  });

  it("marks clinic sensitive preview fields explicitly", () => {
    const preset = getAgendaPreset("CLINICA_MEDICA");
    const sensitiveKeys = preset.previewFields
      .filter((field) => field.sensitive)
      .map((field) => field.key);

    expect(sensitiveKeys).toContain("allergies");
    expect(sensitiveKeys).toContain("medications");
    expect(sensitiveKeys).toContain("requiredCare");
  });

  it("marks workshop financial columns explicitly", () => {
    const preset = getAgendaPreset("OFICINA_MECANICA");
    const financialKeys = preset.tableColumns
      .filter((field) => field.financial)
      .map((field) => field.key);

    expect(financialKeys).toContain("totalValue");
  });
});
