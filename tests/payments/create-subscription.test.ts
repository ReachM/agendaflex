import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    plan: { findFirst: vi.fn() },
    companySubscription: { findFirst: vi.fn() }
  } as any
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const fetchMock = vi.fn();
const originalFetch = global.fetch;
beforeEach(() => {
  vi.clearAllMocks();
  process.env.MP_ACCESS_TOKEN = "APP_USR-TEST-TOKEN-XXXX";
  process.env.MP_BACK_URL = "https://app.test/assinatura";
  global.fetch = fetchMock as unknown as typeof fetch;
  prismaMock.plan.findFirst.mockResolvedValue({ id: "plan-pro", name: "Pro", price: 99.9, isActive: true });
  prismaMock.companySubscription.findFirst.mockResolvedValue({ id: "sub-1" });
});
afterEach(() => {
  global.fetch = originalFetch;
});

import { createSubscription } from "@/lib/services/mercadopago";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("createSubscription (Mercado Pago, fluxo redirect)", () => {
  it("monta corretamente: POST /preapproval e devolve init_point como checkoutUrl", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ id: "pre_abc", init_point: "https://www.mercadopago.com/auth/pre_abc" })
    );

    const result = await createSubscription({
      planId: "plan-pro",
      companyId: "c1",
      payerEmail: "a@b.com",
      payerName: "Acme"
    });

    expect(result).toMatchObject({
      subscriptionId: "sub-1",
      gatewaySubscriptionId: "pre_abc",
      gatewayCustomerId: "",
      checkoutUrl: "https://www.mercadopago.com/auth/pre_abc",
      payerEmail: "a@b.com"
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://api.mercadopago.com/preapproval");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer APP_USR-TEST-TOKEN-XXXX");

    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      reason: "MarcaiFlex — Plano Pro",
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: 99.9,
        currency_id: "BRL"
      },
      payer_email: "a@b.com",
      back_url: "https://app.test/assinatura",
      status: "pending",
      external_reference: "sub-1"
    });
  });

  it("usa sandbox_init_point quando init_point não vem (sandbox)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ id: "pre_sb", sandbox_init_point: "https://sandbox.mercadopago.com/auth/pre_sb" })
    );
    const result = await createSubscription({
      planId: "plan-pro",
      companyId: "c1",
      payerEmail: "a@b.com",
      payerName: "Acme"
    });
    expect(result.checkoutUrl).toBe("https://sandbox.mercadopago.com/auth/pre_sb");
  });

  it("recusa plano sem valor de cobrança (grátis)", async () => {
    prismaMock.plan.findFirst.mockResolvedValue({ id: "plan-free", name: "Starter", price: 0, isActive: true });
    await expect(
      createSubscription({ planId: "plan-free", companyId: "c1", payerEmail: "a@b.com", payerName: "Acme" })
    ).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falha ao criar preapproval (HTTP 400) vira 502", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: "invalid back_url" }, 400)
    );

    await expect(
      createSubscription({ planId: "plan-pro", companyId: "c1", payerEmail: "a@b.com", payerName: "Acme" })
    ).rejects.toMatchObject({ status: 502 });
  });

  it("falha quando MP retorna sem init_point vira 502", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: "pre_no_url" }));
    await expect(
      createSubscription({ planId: "plan-pro", companyId: "c1", payerEmail: "a@b.com", payerName: "Acme" })
    ).rejects.toMatchObject({ status: 502 });
  });

  it("sem MP_BACK_URL configurado -> 500 (config error) e não chama o MP", async () => {
    delete process.env.MP_BACK_URL;
    await expect(
      createSubscription({ planId: "plan-pro", companyId: "c1", payerEmail: "a@b.com", payerName: "Acme" })
    ).rejects.toMatchObject({ status: 500 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
