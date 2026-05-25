import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocks: prisma, JWT, o serviço createSubscription (não tocamos no MP real) e audit.
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
vi.mock("@/lib/services/mercadopago", () => ({ createSubscription: createSubscriptionMock }));
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

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.user.findUnique.mockResolvedValue({
    id: "u1",
    email: "admin@acme.com",
    status: "ACTIVE",
    systemRole: null,
    memberships: [
      { companyId: "c1", status: "ACTIVE", role: { name: "COMPANY_ADMIN" }, company: { id: "c1", status: "ACTIVE" } }
    ]
  });
  prismaMock.plan.findFirst.mockResolvedValue({ id: "plan-pro", slug: "pro" });
  prismaMock.companySubscription.findFirst.mockResolvedValue({ id: "sub-1", mpPreapprovalId: null });
  prismaMock.companySubscription.update.mockResolvedValue({});
  createSubscriptionMock.mockResolvedValue({
    preapprovalId: "pre-9",
    status: "authorized",
    subscriptionId: "sub-1",
    payerEmail: "admin@acme.com"
  });
});

describe("POST /api/subscription/checkout", () => {
  it("recusa sem cardTokenId (422) e não chama o MP", async () => {
    const res = await POST(req({ planSlug: "pro" }));
    expect(res.status).toBe(422);
    expect(createSubscriptionMock).not.toHaveBeenCalled();
  });

  it("idempotência: não cria 2ª assinatura se já há preapproval", async () => {
    prismaMock.companySubscription.findFirst.mockResolvedValue({ id: "sub-1", mpPreapprovalId: "pre-existente" });
    const res = await POST(req({ planSlug: "pro", cardTokenId: "tok_x" }));
    expect(res.status).toBe(409);
    expect(createSubscriptionMock).not.toHaveBeenCalled();
    expect(prismaMock.companySubscription.update).not.toHaveBeenCalled();
  });

  it("sucesso: vincula preapproval SEM ativar (status fica para o webhook)", async () => {
    const res = await POST(req({ planSlug: "pro", cardTokenId: "tok_secret" }));
    expect(res.status).toBe(200);

    const updateData = prismaMock.companySubscription.update.mock.calls[0][0].data;
    expect(updateData.mpPreapprovalId).toBe("pre-9");
    expect(updateData.mpPayerEmail).toBe("admin@acme.com");
    expect(updateData).not.toHaveProperty("status"); // a virada para ACTIVE é do webhook
  });

  it("NUNCA loga/retorna dado de cartão", async () => {
    const res = await POST(req({ planSlug: "pro", cardTokenId: "tok_secret" }));
    const json = await res.json();

    // O token do cartão não pode aparecer na resposta nem na auditoria.
    expect(JSON.stringify(json)).not.toContain("tok_secret");
    const auditPayload = auditMock.mock.calls[0]?.[2];
    expect(JSON.stringify(auditPayload)).not.toContain("tok_secret");
    // (o token vai apenas para o serviço do MP, como esperado)
    expect(createSubscriptionMock.mock.calls[0][0].cardTokenId).toBe("tok_secret");
  });
});
