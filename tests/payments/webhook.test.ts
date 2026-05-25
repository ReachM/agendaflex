import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// SDK do MP em stub (sem rede). fetchWebhookResource é sobrescrito; o resto do
// módulo (validateMpWebhookSignature, mapMpStatus) é REAL.
vi.mock("mercadopago", () => ({ MercadoPagoConfig: class {}, PreApproval: class {}, Payment: class {} }));

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    paymentEvent: { findUnique: vi.fn(), create: vi.fn() },
    companySubscription: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    $transaction: vi.fn()
  } as any
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { fetchResourceMock } = vi.hoisted(() => ({ fetchResourceMock: vi.fn() }));
vi.mock("@/lib/services/mercadopago", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/mercadopago")>();
  return { ...actual, fetchWebhookResource: fetchResourceMock };
});

import { POST } from "@/app/api/webhooks/mercadopago/route";

const SECRET = "webhook-secret-de-teste";
const TS = "1700000000";

function sign(dataId: string, requestId = "req-1", ts = TS): string {
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const v1 = crypto.createHmac("sha256", SECRET).update(manifest).digest("hex");
  return `ts=${ts},v1=${v1}`;
}

function req(opts: { body: unknown; signature?: string; requestId?: string }) {
  const headers = new Map<string, string>();
  if (opts.signature !== undefined) headers.set("x-signature", opts.signature);
  headers.set("x-request-id", opts.requestId ?? "req-1");
  return {
    url: "https://app.test/api/webhooks/mercadopago",
    headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null },
    json: async () => opts.body
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.MP_WEBHOOK_SECRET = SECRET;
  prismaMock.paymentEvent.findUnique.mockResolvedValue(null);
  prismaMock.paymentEvent.create.mockResolvedValue({});
  prismaMock.companySubscription.update.mockResolvedValue({});
  prismaMock.$transaction.mockImplementation(async (cb: any) => cb(prismaMock));
});

describe("POST /api/webhooks/mercadopago", () => {
  it("assinatura inválida -> 401 e não processa", async () => {
    const res = await POST(
      req({ body: { id: "evt-1", type: "payment", data: { id: "123" } }, signature: "ts=1,v1=deadbeef" })
    );
    expect(res.status).toBe(401);
    expect(fetchResourceMock).not.toHaveBeenCalled();
    expect(prismaMock.companySubscription.update).not.toHaveBeenCalled();
  });

  it("notificação duplicada (mesmo id) -> 200 e não reprocessa", async () => {
    prismaMock.paymentEvent.findUnique.mockResolvedValue({ id: "ja-existe" });
    const res = await POST(
      req({ body: { id: "evt-1", type: "payment", data: { id: "123" } }, signature: sign("123") })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).duplicate).toBe(true);
    expect(fetchResourceMock).not.toHaveBeenCalled();
    expect(prismaMock.companySubscription.update).not.toHaveBeenCalled();
  });

  it("pagamento aprovado -> ACTIVE, currentPeriodEnd empurrado, pastDueSince limpo", async () => {
    fetchResourceMock.mockResolvedValue({
      kind: "payment",
      status: "approved",
      preapprovalId: "pre-1",
      paymentId: "pay-9",
      externalReference: "sub-1"
    });
    prismaMock.companySubscription.findUnique.mockResolvedValue({
      id: "sub-1",
      pastDueSince: new Date(),
      currentPeriodEnd: null
    });

    const res = await POST(
      req({ body: { id: "evt-2", type: "payment", data: { id: "123" } }, signature: sign("123") })
    );
    expect(res.status).toBe(200);
    expect(prismaMock.paymentEvent.create).toHaveBeenCalledTimes(1);

    const data = prismaMock.companySubscription.update.mock.calls[0][0].data;
    expect(data.status).toBe("ACTIVE");
    expect(data.pastDueSince).toBeNull();
    expect(data.currentPeriodEnd).toBeInstanceOf(Date);
    expect(data.lastPaymentId).toBe("pay-9");
    expect(data.lastPaymentStatus).toBe("approved");
  });

  it("pagamento recusado -> PAST_DUE com pastDueSince setado", async () => {
    fetchResourceMock.mockResolvedValue({
      kind: "payment",
      status: "rejected",
      preapprovalId: "pre-1",
      paymentId: "pay-10",
      externalReference: "sub-1"
    });
    prismaMock.companySubscription.findUnique.mockResolvedValue({
      id: "sub-1",
      pastDueSince: null,
      currentPeriodEnd: null
    });

    const res = await POST(
      req({ body: { id: "evt-3", type: "payment", data: { id: "123" } }, signature: sign("123") })
    );
    expect(res.status).toBe(200);

    const data = prismaMock.companySubscription.update.mock.calls[0][0].data;
    expect(data.status).toBe("PAST_DUE");
    expect(data.pastDueSince).toBeInstanceOf(Date);
  });

  it("preapproval cancelado -> CANCELLED", async () => {
    fetchResourceMock.mockResolvedValue({
      kind: "preapproval",
      status: "cancelled",
      preapprovalId: "pre-1",
      paymentId: null,
      externalReference: "sub-1"
    });
    prismaMock.companySubscription.findUnique.mockResolvedValue({
      id: "sub-1",
      pastDueSince: null,
      currentPeriodEnd: null
    });

    const res = await POST(
      req({ body: { id: "evt-4", type: "preapproval", data: { id: "pre-1" } }, signature: sign("pre-1") })
    );
    expect(res.status).toBe(200);
    expect(prismaMock.companySubscription.update.mock.calls[0][0].data.status).toBe("CANCELLED");
  });

  it("tipo não tratado -> 200 ignorado, sem atualizar", async () => {
    fetchResourceMock.mockResolvedValue(null);
    const res = await POST(
      req({ body: { id: "evt-5", type: "merchant_order", data: { id: "999" } }, signature: sign("999") })
    );
    expect(res.status).toBe(200);
    expect(prismaMock.companySubscription.update).not.toHaveBeenCalled();
  });
});
