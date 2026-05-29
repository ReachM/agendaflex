import { describe, expect, it } from "vitest";
import {
  hasPermission,
  getVisibleMenuItems,
  TENANT_MENU_ITEMS,
  type PermissionKey
} from "@/lib/security/permissions";

// ═══ v2 Permission Tests ═════════════════════════════════════════
// Financeiro e Notas Fiscais foram reativados em 2026-05-29 (v2).
// Checklists permanece desativado até ChecklistTemplate/Section serem criados.

describe("v2 — Permissions by Role", () => {
  // Permissions ainda desativadas em todos os roles de tenant nesta fase.
  const checklistPermissions: PermissionKey[] = ["checklists:manage", "checklists:view"];

  describe("COMPANY_ADMIN", () => {
    it("has core operational permissions", () => {
      expect(hasPermission("COMPANY_ADMIN", "users:manage")).toBe(true);
      expect(hasPermission("COMPANY_ADMIN", "appointments:manage")).toBe(true);
      expect(hasPermission("COMPANY_ADMIN", "customers:manage")).toBe(true);
      expect(hasPermission("COMPANY_ADMIN", "services:manage")).toBe(true);
      expect(hasPermission("COMPANY_ADMIN", "professionals:manage")).toBe(true);
      expect(hasPermission("COMPANY_ADMIN", "reports:view")).toBe(true);
      expect(hasPermission("COMPANY_ADMIN", "reports:advanced")).toBe(true);
      expect(hasPermission("COMPANY_ADMIN", "settings:manage")).toBe(true);
      expect(hasPermission("COMPANY_ADMIN", "public_booking:manage")).toBe(true);
      expect(hasPermission("COMPANY_ADMIN", "clinical_notes:view")).toBe(true);
    });

    it("has financial and invoice permissions (v2 reactivation)", () => {
      expect(hasPermission("COMPANY_ADMIN", "financial:view")).toBe(true);
      expect(hasPermission("COMPANY_ADMIN", "financial:manage")).toBe(true);
      expect(hasPermission("COMPANY_ADMIN", "invoices:manage")).toBe(true);
    });

    it("does NOT have checklist permissions (still pending v2.1)", () => {
      for (const perm of checklistPermissions) {
        expect(hasPermission("COMPANY_ADMIN", perm)).toBe(false);
      }
    });
  });

  describe("MANAGER", () => {
    it("has core operational permissions", () => {
      expect(hasPermission("MANAGER", "customers:manage")).toBe(true);
      expect(hasPermission("MANAGER", "appointments:manage")).toBe(true);
      expect(hasPermission("MANAGER", "services:manage")).toBe(true);
      expect(hasPermission("MANAGER", "reports:view")).toBe(true);
      expect(hasPermission("MANAGER", "settings:manage")).toBe(true);
    });

    it("has financial:view (v2) but not financial:manage", () => {
      expect(hasPermission("MANAGER", "financial:view")).toBe(true);
      expect(hasPermission("MANAGER", "financial:manage")).toBe(false);
      expect(hasPermission("MANAGER", "invoices:manage")).toBe(false);
    });

    it("does NOT have checklist permissions", () => {
      for (const perm of checklistPermissions) {
        expect(hasPermission("MANAGER", perm)).toBe(false);
      }
    });
  });

  describe("STAFF", () => {
    it("has basic operational permissions", () => {
      expect(hasPermission("STAFF", "customers:view")).toBe(true);
      expect(hasPermission("STAFF", "appointments:manage")).toBe(true);
      expect(hasPermission("STAFF", "services:view")).toBe(true);
      expect(hasPermission("STAFF", "professionals:view")).toBe(true);
    });

    it("does NOT have financial or checklist permissions", () => {
      expect(hasPermission("STAFF", "financial:view")).toBe(false);
      expect(hasPermission("STAFF", "financial:manage")).toBe(false);
      expect(hasPermission("STAFF", "invoices:manage")).toBe(false);
      for (const perm of checklistPermissions) {
        expect(hasPermission("STAFF", perm)).toBe(false);
      }
    });

    it("does NOT have admin-level permissions", () => {
      expect(hasPermission("STAFF", "users:manage")).toBe(false);
      expect(hasPermission("STAFF", "settings:manage")).toBe(false);
      expect(hasPermission("STAFF", "custom_fields:manage")).toBe(false);
    });
  });

  describe("SUPER_ADMIN", () => {
    it("has ALL permissions including financial (system-level)", () => {
      expect(hasPermission("SUPER_ADMIN", "companies:manage")).toBe(true);
      expect(hasPermission("SUPER_ADMIN", "financial:view")).toBe(true);
      expect(hasPermission("SUPER_ADMIN", "financial:manage")).toBe(true);
      expect(hasPermission("SUPER_ADMIN", "invoices:manage")).toBe(true);
      expect(hasPermission("SUPER_ADMIN", "checklists:manage")).toBe(true);
    });
  });
});

// ═══ v2 Menu Tests ═══════════════════════════════════════════════

describe("v2 — Menu Items", () => {
  it("includes Financeiro and Notas Fiscais (v2), excludes Checklists (pending)", () => {
    const menuHrefs = TENANT_MENU_ITEMS.map((item) => item.href);
    expect(menuHrefs).toContain("/financeiro");
    expect(menuHrefs).toContain("/notas-fiscais");
    expect(menuHrefs).not.toContain("/checklists");
  });

  it("includes all core MVP modules", () => {
    const menuHrefs = TENANT_MENU_ITEMS.map((item) => item.href);
    expect(menuHrefs).toContain("/dashboard");
    expect(menuHrefs).toContain("/agenda");
    expect(menuHrefs).toContain("/clientes");
    expect(menuHrefs).toContain("/servicos");
    expect(menuHrefs).toContain("/profissionais");
    expect(menuHrefs).toContain("/campos-personalizados");
    expect(menuHrefs).toContain("/usuarios");
    expect(menuHrefs).toContain("/relatorios");
    expect(menuHrefs).toContain("/logs");
    expect(menuHrefs).toContain("/configuracoes");
    expect(menuHrefs).toContain("/link-agenda");
    expect(menuHrefs).toContain("/configuracoes/bot");
  });

  describe("getVisibleMenuItems by role", () => {
    it("COMPANY_ADMIN sees core items; Financeiro requires plan feature", () => {
      const items = getVisibleMenuItems("COMPANY_ADMIN");
      const hrefs = items.map((i) => i.href);
      expect(hrefs).toContain("/dashboard");
      expect(hrefs).toContain("/agenda");
      expect(hrefs).toContain("/clientes");
      expect(hrefs).toContain("/servicos");
      expect(hrefs).toContain("/profissionais");
      expect(hrefs).toContain("/usuarios");
      expect(hrefs).toContain("/relatorios");
      expect(hrefs).toContain("/configuracoes");
      // Without planFeatures provided, plan-gated items still appear (handled at API layer)
      expect(hrefs).toContain("/financeiro");
      expect(hrefs).toContain("/notas-fiscais");
      // Checklists ainda removido
      expect(hrefs).not.toContain("/checklists");
    });

    it("STAFF sees only permitted items", () => {
      const items = getVisibleMenuItems("STAFF");
      const hrefs = items.map((i) => i.href);
      expect(hrefs).toContain("/dashboard");
      expect(hrefs).toContain("/agenda");
      expect(hrefs).toContain("/clientes");
      // Staff should NOT see admin-only or financial pages
      expect(hrefs).not.toContain("/usuarios");
      expect(hrefs).not.toContain("/configuracoes");
      expect(hrefs).not.toContain("/financeiro");
      expect(hrefs).not.toContain("/notas-fiscais");
    });

    it("COMPANY_ADMIN with Starter plan does NOT see Link de Agenda, Bot, Financeiro or Notas", () => {
      const starterFeatures = {
        allowClientSelfScheduling: false,
        allowAdvancedReports: false,
        allowFinancialControl: false,
        allowInvoiceRequest: false,
        allowCustomerChecklist: false,
        allowBotIntegration: false
      };
      const items = getVisibleMenuItems("COMPANY_ADMIN", starterFeatures);
      const hrefs = items.map((i) => i.href);
      expect(hrefs).not.toContain("/link-agenda");
      expect(hrefs).not.toContain("/configuracoes/bot");
      expect(hrefs).not.toContain("/financeiro");
      expect(hrefs).not.toContain("/notas-fiscais");
    });

    it("COMPANY_ADMIN with Pro plan sees Link de Agenda, Bot, Financeiro — but not Notas Fiscais", () => {
      const proFeatures = {
        allowClientSelfScheduling: true,
        allowAdvancedReports: true,
        allowFinancialControl: true,
        allowInvoiceRequest: false,
        allowCustomerChecklist: false,
        allowBotIntegration: true
      };
      const items = getVisibleMenuItems("COMPANY_ADMIN", proFeatures);
      const hrefs = items.map((i) => i.href);
      expect(hrefs).toContain("/link-agenda");
      expect(hrefs).toContain("/configuracoes/bot");
      expect(hrefs).toContain("/financeiro");
      expect(hrefs).not.toContain("/notas-fiscais");
    });

    it("COMPANY_ADMIN with Max plan sees Notas Fiscais too", () => {
      const maxFeatures = {
        allowClientSelfScheduling: true,
        allowAdvancedReports: true,
        allowFinancialControl: true,
        allowInvoiceRequest: true,
        allowCustomerChecklist: false,
        allowBotIntegration: true
      };
      const items = getVisibleMenuItems("COMPANY_ADMIN", maxFeatures);
      const hrefs = items.map((i) => i.href);
      expect(hrefs).toContain("/financeiro");
      expect(hrefs).toContain("/notas-fiscais");
    });
  });
});

// ═══ v2 Plan Feature Flags ═══════════════════════════════════════

describe("v2 — Plan Feature Flags (Seed Alignment)", () => {
  const starterFeatures = {
    allowClientSelfScheduling: false,
    allowAdvancedReports: false,
    allowFinancialControl: false,
    allowInvoiceRequest: false,
    allowCustomerChecklist: false,
    allowBotIntegration: false,
    allowAuditLogs: true,
    allowCustomFields: true,
    allowMultipleServicesPerAppointment: true
  };

  const proFeatures = {
    allowClientSelfScheduling: true,
    allowAdvancedReports: true,
    allowFinancialControl: true,
    allowInvoiceRequest: false,
    allowCustomerChecklist: false,
    allowBotIntegration: true,
    allowAuditLogs: true,
    allowCustomFields: true,
    allowMultipleServicesPerAppointment: true
  };

  const maxFeatures = {
    allowClientSelfScheduling: true,
    allowAdvancedReports: true,
    allowFinancialControl: true,
    allowInvoiceRequest: true,
    allowCustomerChecklist: false,
    allowBotIntegration: true,
    allowAuditLogs: true,
    allowCustomFields: true,
    allowMultipleServicesPerAppointment: true
  };

  it("Starter plan keeps all paid features DISABLED", () => {
    expect(starterFeatures.allowFinancialControl).toBe(false);
    expect(starterFeatures.allowInvoiceRequest).toBe(false);
    expect(starterFeatures.allowCustomerChecklist).toBe(false);
    expect(starterFeatures.allowClientSelfScheduling).toBe(false);
    expect(starterFeatures.allowBotIntegration).toBe(false);
  });

  it("Pro plan enables financial control and self-scheduling; not invoices/checklists", () => {
    expect(proFeatures.allowClientSelfScheduling).toBe(true);
    expect(proFeatures.allowBotIntegration).toBe(true);
    expect(proFeatures.allowAdvancedReports).toBe(true);
    expect(proFeatures.allowFinancialControl).toBe(true);
    expect(proFeatures.allowInvoiceRequest).toBe(false);
    expect(proFeatures.allowCustomerChecklist).toBe(false);
  });

  it("Max plan enables financial and invoices; checklists still pending v2.1", () => {
    expect(maxFeatures.allowFinancialControl).toBe(true);
    expect(maxFeatures.allowInvoiceRequest).toBe(true);
    expect(maxFeatures.allowCustomerChecklist).toBe(false);
    expect(maxFeatures.allowClientSelfScheduling).toBe(true);
    expect(maxFeatures.allowBotIntegration).toBe(true);
    expect(maxFeatures.allowAdvancedReports).toBe(true);
  });

  it("All plans have core features enabled", () => {
    for (const features of [starterFeatures, proFeatures, maxFeatures]) {
      expect(features.allowAuditLogs).toBe(true);
      expect(features.allowCustomFields).toBe(true);
      expect(features.allowMultipleServicesPerAppointment).toBe(true);
    }
  });
});
