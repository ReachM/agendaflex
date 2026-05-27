import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    plan: { findFirst: vi.fn() },
    companySubscription: { findFirst: vi.fn() }
  } as any
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

// fetch global é mockado: cada teste injeta a sequência de respostas esperadas.
const fetchMock = vi.fn();
const originalFetch = global.fetch;
beforeEach(() => {
  vi.clearAllMocks();
  process.env.ASAAS_API_KEY = "$aact_TEST_SANDBOX_XXXX";
  process.env.ASAAS_SANDBOX = "true";
  global.fetch = fetchMock as unknown as typeof fetch;
  prismaMock.plan.findFirst.mockResolvedValue({ id: "plan-pro", name: "Pro", price: 99.9, isActive: true });
  prismaMock.companySubscription.findFirst.mockResolvedValue({ id: "sub-1" });
});
afterEach(() => {
  global.fetch = originalFetch;
});

import { createSubscription } from "@/lib/services/asaas";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("createSubscription (Asaas, fluxo redirect)", () => {
  it("monta corretamente: busca customer, cria assinatura UNDEFINED, devolve checkoutUrl", async () => {
    fetchMock
      // GET /customers?email= -> não existe
      .mockResolvedValueOnce(jsonResponse({ data: [] }))
      // POST /customers -> criado
      .mockResolvedValueOnce(jsonResponse({ id: "cus_99" }))
      // POST /subscriptions -> ok
      .mockResolvedValueOnce(jsonResponse({ id: "sub_asaas_1" }))
      // GET /subscriptions/sub_asaas_1/payments?limit=1 -> primeira cobrança
      .mockResolvedValueOnce(
        jsonResponse({ data: [{ id: "pay_1", invoiceUrl: "https://www.asaas.com/i/pay_1" }] })
      );

    const result = await createSubscription({
      planId: "plan-pro",
      companyId: "c1",
      payerEmail: "a@b.com",
      payerName: "Acme"
    });

    expect(result).toMatchObject({
      subscriptionId: "sub-1",
      gatewaySubscriptionId: "sub_asaas_1",
      gatewayCustomerId: "cus_99",
      checkoutUrl: "https://www.asaas.com/i/pay_1",
      payerEmail: "a@b.com"
    });

    // 4 chamadas no total e o POST /subscriptions traz o payload correto.
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const subCall = fetchMock.mock.calls[2];
    expect(String(subCall[0])).toContain("/subscriptions");
    const body = JSON.parse(subCall[1].body);
    expect(body).toMatchObject({
      customer: "cus_99",
      billingType: "UNDEFINED",
      value: 99.9,
      cycle: "MONTHLY",
      externalReference: "sub-1"
    });
    expect(body.description).toContain("Pro");
    expect(body.nextDueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Header de auth está em TODAS as chamadas.
    for (const call of fetchMock.mock.calls) {
      expect(call[1].headers.access_token).toBe("$aact_TEST_SANDBOX_XXXX");
    }
  });

  it("usa o customer existente quando o e-mail já está cadastrado", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: "cus_existing" }] }))
      .mockResolvedValueOnce(jsonResponse({ id: "sub_asaas_2", paymentLink: "https://www.asaas.com/pl/2" }));

    const result = await createSubscription({
      planId: "plan-pro",
      companyId: "c1",
      payerEmail: "a@b.com",
      payerName: "Acme"
    });

    expect(result.gatewayCustomerId).toBe("cus_existing");
    expect(result.checkoutUrl).toBe("https://www.asaas.com/pl/2");
    // Sem POST /customers, e sem GET /payments (paymentLink veio direto).
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("recusa plano sem valor de cobrança (grátis)", async () => {
    prismaMock.plan.findFirst.mockResolvedValue({ id: "plan-free", name: "Starter", price: 0, isActive: true });
    await expect(
      createSubscription({ planId: "plan-free", companyId: "c1", payerEmail: "a@b.com", payerName: "Acme" })
    ).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falha ao criar assinatura no Asaas vira 502", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: "cus_1" }] }))
      .mockResolvedValueOnce(jsonResponse({ errors: [{ description: "Limite atingido" }] }, 400));

    await expect(
      createSubscription({ planId: "plan-pro", companyId: "c1", payerEmail: "a@b.com", payerName: "Acme" })
    ).rejects.toMatchObject({ status: 502 });
  });

  it("falha quando não consegue URL de checkout vira 502", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: "cus_1" }] }))
      .mockResolvedValueOnce(jsonResponse({ id: "sub_asaas_3" })) // sem paymentLink
      .mockResolvedValueOnce(jsonResponse({ data: [] })); // sem cobranças

    await expect(
      createSubscription({ planId: "plan-pro", companyId: "c1", payerEmail: "a@b.com", payerName: "Acme" })
    ).rejects.toMatchObject({ status: 502 });
  });

  it("usa o ambiente de produção quando ASAAS_SANDBOX=false", async () => {
    process.env.ASAAS_SANDBOX = "false";
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: "cus_1" }] }))
      .mockResolvedValueOnce(jsonResponse({ id: "sub_asaas_4", paymentLink: "https://www.asaas.com/pl/4" }));

    await createSubscription({
      planId: "plan-pro",
      companyId: "c1",
      payerEmail: "a@b.com",
      payerName: "Acme"
    });

    for (const call of fetchMock.mock.calls) {
      expect(String(call[0])).toMatch(/^https:\/\/www\.asaas\.com\/api\/v3/);
    }
  });
});
