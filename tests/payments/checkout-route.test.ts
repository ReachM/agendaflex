import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn() },
    plan: { findFirst: vi.fn() },
    companySubscription: { findFirst: vi.fn(), update: vi.fn() }
  } as any
}));
const { createSubscriptionMock } = vi.hoisted(() => ({ createSubscriptionMock: vi.fn() }));
const { auditMock } = vi.hoisted(() => ({ auditMock: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/security/jwt", () => ({
  verifyAuthToken: vi.fn(async () => ({ sub: "u1", role: "COMPANY_ADMIN", companyId: "c1" }))
}));
vi.mock("@/lib/services/asaas", () => ({ createSubscription: createSubscriptionMock }));
vi.mock("@/lib/audit", () => ({ audit: auditMock }));

import { POST } from "@/app/api/subscription/checkout/route";

function req(body: unknown) {
  return {
    method: "POST",
    headers: { get: (k: string) => (k.toLowerCase() === "authorization" ? "Bearer x" : null) },
    cookies: { get: () => undefined },
    json: async () => body
  } as any;
}

const CHECKOUT_URL = "https://www.asaas.com/c/pay_xyz";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.user.findUnique.mockResolvedValue({
    id: "u1",
    name: "Admin Acme",
    email: "admin@acme.com",
    status: "ACTIVE",
    systemRole: null,
    memberships: [
      { companyId: "c1", status: "ACTIVE", role: { name: "COMPANY_ADMIN" }, company: { id: "c1", status: "ACTIVE" } }
    ]
  });
  prismaMock.plan.findFirst.mockResolvedValue({ id: "plan-pro", slug: "pro" });
  prismaMock.companySubscription.findFirst.mockResolvedValue({ id: "sub-1", gatewaySubscriptionId: null });
  prismaMock.companySubscription.update.mockResolvedValue({});
  createSubscriptionMock.mockResolvedValue({
    subscriptionId: "sub-1",
    gatewaySubscriptionId: "sub_asaas_9",
    gatewayCustomerId: "cus_9",
    checkoutUrl: CHECKOUT_URL,
    payerEmail: "admin@acme.com"
  });
});

describe("POST /api/subscription/checkout (Asaas redirect)", () => {
  it("recusa sem planSlug (422) e não chama o Asaas", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(422);
    expect(createSubscriptionMock).not.toHaveBeenCalled();
  });

  it("não exige cardTokenId (fluxo redirect não recebe dado de cartão)", async () => {
    const res = await POST(req({ planSlug: "pro" }));
    expect(res.status).toBe(200);
    const call = createSubscriptionMock.mock.calls[0][0];
    expect(call).not.toHaveProperty("cardTokenId");
    expect(call.planId).toBe("plan-pro");
    expect(call.payerName).toBe("Admin Acme");
  });

  it("idempotência: não cria 2ª assinatura se já há gatewaySubscriptionId", async () => {
    prismaMock.companySubscription.findFirst.mockResolvedValue({
      id: "sub-1",
      gatewaySubscriptionId: "sub_asaas_existente"
    });
    const res = await POST(req({ planSlug: "pro" }));
    expect(res.status).toBe(409);
    expect(createSubscriptionMock).not.toHaveBeenCalled();
    expect(prismaMock.companySubscription.update).not.toHaveBeenCalled();
  });

  it("sucesso: vincula gatewaySubscriptionId + gatewayCustomerId e devolve checkoutUrl — SEM ativar", async () => {
    const res = await POST(req({ planSlug: "pro" }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.checkoutUrl).toBe(CHECKOUT_URL);
    expect(json.status).toBe("pending_confirmation");

    const updateData = prismaMock.companySubscription.update.mock.calls[0][0].data;
    expect(updateData.gatewaySubscriptionId).toBe("sub_asaas_9");
    expect(updateData.gatewayCustomerId).toBe("cus_9");
    expect(updateData.payerEmail).toBe("admin@acme.com");
    // A virada para ACTIVE é do webhook — nunca daqui.
    expect(updateData).not.toHaveProperty("status");
  });

  it("auditoria não inclui dado sensível", async () => {
    await POST(req({ planSlug: "pro" }));
    const auditPayload = auditMock.mock.calls[0]?.[2];
    const serialized = JSON.stringify(auditPayload);
    expect(serialized).not.toMatch(/card[_-]?token/i);
    expect(serialized).not.toMatch(/cvv/i);
  });
});
