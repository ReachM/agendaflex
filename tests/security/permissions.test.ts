import { describe, expect, it } from "vitest";
import { hasPermission } from "@/lib/security/permissions";

describe("role permissions", () => {
  it("allows Super Admin to manage companies", () => {
    expect(hasPermission("SUPER_ADMIN", "companies:manage")).toBe(true);
  });

  it("prevents Staff from changing custom field definitions", () => {
    expect(hasPermission("STAFF", "custom_fields:manage")).toBe(false);
  });

  it("allows Company Admin to manage users and appointments", () => {
    expect(hasPermission("COMPANY_ADMIN", "users:manage")).toBe(true);
    expect(hasPermission("COMPANY_ADMIN", "appointments:manage")).toBe(true);
  });
});
