import { beforeEach, describe, expect, it, vi } from "vitest";

// Exercita o enforcement central dentro de requireTenant: escrita bloqueada
// quando o trial venceu, leitura/opt-out liberados. Mockamos JWT e Prisma para
// não depender de assinatura real de token nem de banco.
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn() },
    companySubscription: { findFirst: vi.fn() }
  } as any
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/security/jwt", () => ({
  verifyAuthToken: vi.fn(async () => ({ sub: "u1", role: "COMPANY_ADMIN", companyId: "c1" }))
}));

import { requireTenant } from "@/lib/security/auth";

const DAY = 24 * 60 * 60 * 1000;

function request(method: string) {
  return {
    method,
    headers: { get: (k: string) => (k.toLowerCase() === "authorization" ? "Bearer x" : null) },
    cookies: { get: () => undefined }
  } as any;
}

function blockedTrial() {
  return {
    status: "TRIALING",
    trialEndsAt: new Date(Date.now() - DAY),
    plan: { slug: "max", name: "Max" },
    createdAt: new Date()
  };
}

function activeSub() {
  return { status: "ACTIVE", trialEndsAt: null, plan: { slug: "max", name: "Max" }, createdAt: new Date() };
}

beforeEach(() => {
  vi.resetAllMocks();
  prismaMock.user.findUnique.mockResolvedValue({
    id: "u1",
    status: "ACTIVE",
    systemRole: null,
    memberships: [
      { companyId: "c1", status: "ACTIVE", role: { name: "COMPANY_ADMIN" }, company: { id: "c1", status: "ACTIVE" } }
    ]
  });
});

describe("requireTenant — enforcement de assinatura", () => {
  it("escrita (POST) com trial vencido -> 403 TRIAL_EXPIRED", async () => {
    prismaMock.companySubscription.findFirst.mockResolvedValue(blockedTrial());

    await expect(requireTenant(request("POST"), "appointments:manage")).rejects.toMatchObject({
      status: 403,
      details: { code: "TRIAL_EXPIRED" }
    });
  });

  it("leitura (GET) com trial vencido -> liberada (modal cuida da UX)", async () => {
    prismaMock.companySubscription.findFirst.mockResolvedValue(blockedTrial());

    const context = await requireTenant(request("GET"), "appointments:manage");
    expect(context.companyId).toBe("c1");
  });

  it("escrita com skipSubscriptionCheck -> liberada (ex.: checkout/assinar)", async () => {
    prismaMock.companySubscription.findFirst.mockResolvedValue(blockedTrial());

    const context = await requireTenant(request("POST"), "appointments:manage", {
      skipSubscriptionCheck: true
    });
    expect(context.companyId).toBe("c1");
  });

  it("escrita com assinatura ativa -> liberada", async () => {
    prismaMock.companySubscription.findFirst.mockResolvedValue(activeSub());

    const context = await requireTenant(request("POST"), "appointments:manage");
    expect(context.companyId).toBe("c1");
  });
});
