import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    paymentEvent: { findUnique: vi.fn(), create: vi.fn() },
    companySubscription: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    $transaction: vi.fn()
  } as any
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { POST } from "@/app/api/webhooks/asaas/route";

const TOKEN = "asaas-webhook-secret";

function req(opts: { body: unknown; token?: string | null }) {
  const headers = new Map<string, string>();
  if (opts.token !== null && opts.token !== undefined) headers.set("asaas-access-token", opts.token);
  return {
    url: "https://app.test/api/webhooks/asaas",
    headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null },
    json: async () => opts.body
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ASAAS_WEBHOOK_TOKEN = TOKEN;
  prismaMock.paymentEvent.findUnique.mockResolvedValue(null);
  prismaMock.paymentEvent.create.mockResolvedValue({});
  prismaMock.companySubscription.update.mockResolvedValue({});
  prismaMock.$transaction.mockImplementation(async (cb: any) => cb(prismaMock));
});

describe("POST /api/webhooks/asaas", () => {
  it("token inválido -> 401 e não processa", async () => {
    const res = await POST(
      req({ body: { id: "evt-1", event: "PAYMENT_CONFIRMED", payment: { id: "pay-1" } }, token: "errado" })
    );
    expect(res.status).toBe(401);
    expect(prismaMock.companySubscription.update).not.toHaveBeenCalled();
  });

  it("notificação duplicada (mesmo id) -> 200 e não reprocessa", async () => {
    prismaMock.paymentEvent.findUnique.mockResolvedValue({ id: "ja-existe" });
    const res = await POST(
      req({
        body: {
          id: "evt-1",
          event: "PAYMENT_CONFIRMED",
          payment: { id: "pay-1", subscription: "sub-asaas-1", status: "CONFIRMED", externalReference: "sub-1" }
        },
        token: TOKEN
      })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).duplicate).toBe(true);
    expect(prismaMock.companySubscription.update).not.toHaveBeenCalled();
  });

  it("PAYMENT_CONFIRMED -> ACTIVE, currentPeriodEnd empurrado, pastDueSince limpo", async () => {
    prismaMock.companySubscription.findUnique.mockResolvedValue({
      id: "sub-1",
      pastDueSince: new Date(),
      currentPeriodEnd: null
    });

    const res = await POST(
      req({
        body: {
          id: "evt-2",
          event: "PAYMENT_CONFIRMED",
          payment: { id: "pay-9", subscription: "sub-asaas-1", status: "CONFIRMED", externalReference: "sub-1" }
        },
        token: TOKEN
      })
    );
    expect(res.status).toBe(200);
    expect(prismaMock.paymentEvent.create).toHaveBeenCalledTimes(1);

    const data = prismaMock.companySubscription.update.mock.calls[0][0].data;
    expect(data.status).toBe("ACTIVE");
    expect(data.pastDueSince).toBeNull();
    expect(data.currentPeriodEnd).toBeInstanceOf(Date);
    expect(data.lastPaymentId).toBe("pay-9");
    expect(data.lastPaymentStatus).toBe("CONFIRMED");
  });

  it("PAYMENT_OVERDUE -> PAST_DUE com pastDueSince setado", async () => {
    prismaMock.companySubscription.findUnique.mockResolvedValue({
      id: "sub-1",
      pastDueSince: null,
      currentPeriodEnd: null
    });

    const res = await POST(
      req({
        body: {
          id: "evt-3",
          event: "PAYMENT_OVERDUE",
          payment: { id: "pay-10", subscription: "sub-asaas-1", status: "OVERDUE", externalReference: "sub-1" }
        },
        token: TOKEN
      })
    );
    expect(res.status).toBe(200);

    const data = prismaMock.companySubscription.update.mock.calls[0][0].data;
    expect(data.status).toBe("PAST_DUE");
    expect(data.pastDueSince).toBeInstanceOf(Date);
  });

  it("SUBSCRIPTION_DELETED -> CANCELLED", async () => {
    // Sem externalReference: cai no fallback por gatewaySubscriptionId.
    prismaMock.companySubscription.findFirst.mockResolvedValue({
      id: "sub-1",
      pastDueSince: null,
      currentPeriodEnd: null
    });

    const res = await POST(
      req({
        body: {
          id: "evt-4",
          event: "SUBSCRIPTION_DELETED",
          subscription: { id: "sub-asaas-1", status: "INACTIVE" }
        },
        token: TOKEN
      })
    );
    expect(res.status).toBe(200);
    expect(prismaMock.companySubscription.findFirst).toHaveBeenCalledWith({
      where: { gatewaySubscriptionId: "sub-asaas-1" }
    });
    expect(prismaMock.companySubscription.update.mock.calls[0][0].data.status).toBe("CANCELLED");
  });

  it("evento sem efeito (PAYMENT_DELETED) -> 200, grava PaymentEvent, sem update", async () => {
    prismaMock.companySubscription.findUnique.mockResolvedValue({
      id: "sub-1",
      pastDueSince: null,
      currentPeriodEnd: null
    });

    const res = await POST(
      req({
        body: {
          id: "evt-5",
          event: "PAYMENT_DELETED",
          payment: { id: "pay-x", subscription: "sub-asaas-1", externalReference: "sub-1" }
        },
        token: TOKEN
      })
    );
    expect(res.status).toBe(200);
    expect(prismaMock.paymentEvent.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.companySubscription.update).not.toHaveBeenCalled();
  });

  it("evento não tratado (formato desconhecido) -> 200 ignorado", async () => {
    const res = await POST(
      req({
        body: { id: "evt-6", event: "RANDOM_EVENT" },
        token: TOKEN
      })
    );
    expect(res.status).toBe(200);
    expect(prismaMock.paymentEvent.create).not.toHaveBeenCalled();
  });
});
