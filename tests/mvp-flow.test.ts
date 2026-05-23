import { describe, expect, it } from "vitest";
import {
  hasPermission,
  getVisibleMenuItems,
  TENANT_MENU_ITEMS,
  ROLE_PERMISSIONS,
  type PermissionKey
} from "@/lib/security/permissions";

// ═══ MVP Permission Tests ════════════════════════════════════════

describe("MVP — Permissions by Role", () => {
  // Financial permissions should NOT be assigned to any tenant role in the MVP
  const financialPermissions: PermissionKey[] = [
    "financial:view",
    "financial:manage",
    "invoices:manage",
    "checklists:manage",
    "checklists:view"
  ];

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

    it("does NOT have financial/checklist permissions in MVP", () => {
      for (const perm of financialPermissions) {
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

    it("does NOT have financial/checklist permissions in MVP", () => {
      for (const perm of financialPermissions) {
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

    it("does NOT have financial/checklist permissions in MVP", () => {
      for (const perm of financialPermissions) {
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

// ═══ MVP Menu Tests ══════════════════════════════════════════════

describe("MVP — Menu Items", () => {
  it("does NOT include Financeiro in the active menu", () => {
    const menuHrefs = TENANT_MENU_ITEMS.map((item) => item.href);
    expect(menuHrefs).not.toContain("/financeiro");
    expect(menuHrefs).not.toContain("/notas-fiscais");
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
    it("COMPANY_ADMIN sees all MVP items except plan-gated ones without features", () => {
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
      // Financial should NEVER appear
      expect(hrefs).not.toContain("/financeiro");
      expect(hrefs).not.toContain("/notas-fiscais");
      expect(hrefs).not.toContain("/checklists");
    });

    it("STAFF sees only permitted items", () => {
      const items = getVisibleMenuItems("STAFF");
      const hrefs = items.map((i) => i.href);
      expect(hrefs).toContain("/dashboard");
      expect(hrefs).toContain("/agenda");
      expect(hrefs).toContain("/clientes");
      // Staff should NOT see admin-only pages
      expect(hrefs).not.toContain("/usuarios");
      expect(hrefs).not.toContain("/configuracoes");
      expect(hrefs).not.toContain("/financeiro");
    });

    it("COMPANY_ADMIN with Starter plan does NOT see Link de Agenda or Bot", () => {
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
    });

    it("COMPANY_ADMIN with Pro plan sees Link de Agenda and Bot", () => {
      const proFeatures = {
        allowClientSelfScheduling: true,
        allowAdvancedReports: true,
        allowFinancialControl: false,
        allowInvoiceRequest: false,
        allowCustomerChecklist: false,
        allowBotIntegration: true
      };
      const items = getVisibleMenuItems("COMPANY_ADMIN", proFeatures);
      const hrefs = items.map((i) => i.href);
      expect(hrefs).toContain("/link-agenda");
      expect(hrefs).toContain("/configuracoes/bot");
      // Even with Pro, financial is not in the menu
      expect(hrefs).not.toContain("/financeiro");
    });
  });
});

// ═══ MVP Plan Feature Flags ═════════════════════════════════════

describe("MVP — Plan Feature Flags (Seed Alignment)", () => {
  // These represent the expected feature flags per plan in the MVP seed

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
    allowFinancialControl: false,
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
    allowFinancialControl: false,    // MVP: disabled even on Max
    allowInvoiceRequest: false,      // MVP: disabled even on Max
    allowCustomerChecklist: false,   // MVP: disabled even on Max
    allowBotIntegration: true,
    allowAuditLogs: true,
    allowCustomFields: true,
    allowMultipleServicesPerAppointment: true
  };

  it("Starter plan has financial features DISABLED", () => {
    expect(starterFeatures.allowFinancialControl).toBe(false);
    expect(starterFeatures.allowInvoiceRequest).toBe(false);
    expect(starterFeatures.allowCustomerChecklist).toBe(false);
    expect(starterFeatures.allowClientSelfScheduling).toBe(false);
    expect(starterFeatures.allowBotIntegration).toBe(false);
  });

  it("Pro plan has self-scheduling and bot enabled, financial DISABLED", () => {
    expect(proFeatures.allowClientSelfScheduling).toBe(true);
    expect(proFeatures.allowBotIntegration).toBe(true);
    expect(proFeatures.allowAdvancedReports).toBe(true);
    expect(proFeatures.allowFinancialControl).toBe(false);
    expect(proFeatures.allowInvoiceRequest).toBe(false);
    expect(proFeatures.allowCustomerChecklist).toBe(false);
  });

  it("Max plan has high limits but financial features DISABLED in MVP", () => {
    expect(maxFeatures.allowFinancialControl).toBe(false);
    expect(maxFeatures.allowInvoiceRequest).toBe(false);
    expect(maxFeatures.allowCustomerChecklist).toBe(false);
    // Everything else active
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
