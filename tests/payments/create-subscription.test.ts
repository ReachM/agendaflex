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
  process.env.MP_BACK_URL = "http://localhost:3000/dashboard";
  prismaMock.plan.findFirst.mockResolvedValue({ id: "plan-pro", name: "Pro", price: 99.9, isActive: true });
  prismaMock.companySubscription.findFirst.mockResolvedValue({ id: "sub-1" });
  // Fluxo redirect: MP devolve { id, status: "pending", init_point } no create.
  createMock.mockResolvedValue({
    id: "pre-123",
    status: "pending",
    init_point: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=pre-123"
  });
});

describe("createSubscription (fluxo redirect — Opção A)", () => {
  it("monta o payload correto (mensal, BRL, status pending, sem card_token_id)", async () => {
    const result = await createSubscription({
      planId: "plan-pro",
      companyId: "c1",
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
    expect(body.payer_email).toBe("a@b.com");
    // Em redirect, MP exige status "pending" (vira "authorized" após o cliente autorizar no init_point)
    expect(body.status).toBe("pending");
    expect(body.back_url).toBe("http://localhost:3000/dashboard");
    // Sem dados de cartão: nada de card_token_id no payload nem no resultado.
    expect(body).not.toHaveProperty("card_token_id");

    expect(result).toMatchObject({
      preapprovalId: "pre-123",
      initPoint: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=pre-123",
      status: "pending",
      subscriptionId: "sub-1"
    });
  });

  it("recusa plano sem valor de cobrança (grátis)", async () => {
    prismaMock.plan.findFirst.mockResolvedValue({ id: "plan-free", name: "Starter", price: 0, isActive: true });
    await expect(
      createSubscription({ planId: "plan-free", companyId: "c1", payerEmail: "a@b.com" })
    ).rejects.toMatchObject({ status: 400 });
    expect(createMock).not.toHaveBeenCalled();
  });

  it("falha sem init_point: vira 502 (defensivo, não cliente vê o que houve)", async () => {
    createMock.mockResolvedValue({ id: "pre-x", status: "pending" }); // sem init_point
    await expect(
      createSubscription({ planId: "plan-pro", companyId: "c1", payerEmail: "a@b.com" })
    ).rejects.toMatchObject({ status: 502 });
  });

  it("erro genérico do MP vira mensagem amigável de gateway (502)", async () => {
    createMock.mockRejectedValue({ message: "MP internal error" });
    await expect(
      createSubscription({ planId: "plan-pro", companyId: "c1", payerEmail: "a@b.com" })
    ).rejects.toMatchObject({ status: 502 });
  });
});
