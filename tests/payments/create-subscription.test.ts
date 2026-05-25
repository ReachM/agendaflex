import { beforeEach, describe, expect, it, vi } from "vitest";

// SDK do MP mockado — sem chamadas reais. Capturamos o body do preapproval.create.
const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));
vi.mock("mercadopago", () => ({
  MercadoPagoConfig: class {},
  PreApproval: class {
    create = createMock;
  }
}));

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    plan: { findFirst: vi.fn() },
    companySubscription: { findFirst: vi.fn() }
  } as any
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { createSubscription } from "@/lib/services/mercadopago";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.MP_ACCESS_TOKEN = "TEST-access-token";
  process.env.MP_BACK_URL = "http://localhost:3000/configuracoes/assinatura";
  prismaMock.plan.findFirst.mockResolvedValue({ id: "plan-pro", name: "Pro", price: 99.9, isActive: true });
  prismaMock.companySubscription.findFirst.mockResolvedValue({ id: "sub-1" });
  createMock.mockResolvedValue({ id: "pre-123", status: "authorized" });
});

describe("createSubscription", () => {
  it("monta o payload correto (mensal, BRL, external_reference = subscriptionId)", async () => {
    const result = await createSubscription({
      planId: "plan-pro",
      companyId: "c1",
      cardTokenId: "tok_abc",
      payerEmail: "a@b.com"
    });

    expect(createMock).toHaveBeenCalledTimes(1);
    const body = createMock.mock.calls[0][0].body;

    expect(body.auto_recurring).toEqual({
      frequency: 1,
      frequency_type: "months",
      transaction_amount: 99.9,
      currency_id: "BRL"
    });
    expect(body.external_reference).toBe("sub-1");
    expect(body.card_token_id).toBe("tok_abc");
    expect(body.payer_email).toBe("a@b.com");
    expect(body.status).toBe("authorized");
    expect(body.back_url).toBe("http://localhost:3000/configuracoes/assinatura");

    expect(result).toMatchObject({ preapprovalId: "pre-123", status: "authorized", subscriptionId: "sub-1" });
  });

  it("recusa plano sem valor de cobrança (grátis)", async () => {
    prismaMock.plan.findFirst.mockResolvedValue({ id: "plan-free", name: "Starter", price: 0, isActive: true });
    await expect(
      createSubscription({ planId: "plan-free", companyId: "c1", cardTokenId: "t", payerEmail: "a@b.com" })
    ).rejects.toMatchObject({ status: 400 });
    expect(createMock).not.toHaveBeenCalled();
  });

  it("erro do MP vira mensagem amigável de cartão (402)", async () => {
    createMock.mockRejectedValue({ message: "invalid card_token_id" });
    await expect(
      createSubscription({ planId: "plan-pro", companyId: "c1", cardTokenId: "bad", payerEmail: "a@b.com" })
    ).rejects.toMatchObject({ status: 402 });
  });
});
