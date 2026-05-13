import { describe, expect, it } from "vitest";
import { assertSameTenant, tenantWhere } from "@/lib/security/tenant-scope";

describe("tenant isolation helpers", () => {
  it("always keeps the authenticated companyId even when extra filters try to override it", () => {
    const where = tenantWhere("company_a", {
      companyId: "company_b",
      status: "active"
    });

    expect(where).toEqual({
      companyId: "company_a",
      status: "active"
    });
  });

  it("blocks resources that do not belong to the authenticated tenant", () => {
    expect(() => assertSameTenant("company_b", "company_a")).toThrow("tenant");
  });

  it("allows resources from the same tenant", () => {
    expect(() => assertSameTenant("company_a", "company_a")).not.toThrow();
  });
});
