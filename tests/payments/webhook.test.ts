import crypto from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    paymentEvent: { findUnique: vi.fn(), create: vi.fn() },
    companySubscription: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    $transaction: vi.fn()
  } as any
}));
const { fetchPreapprovalMock, fetchPaymentMock } = vi.hoisted(() => ({
  fetchPreapprovalMock: vi.fn(),
  fetchPaymentMock: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
// Mocka apenas os fetchers da API do MP — mantemos validateWebhookSignature,
// mapMpStatus, parseMpWebhook e loadEnvIfNeeded reais para exercitar o caminho
// completo (assinatura HMAC inclusive).
vi.mock("@/lib/services/mercadopago", async () => {
  const actual: any = await vi.importActual("@/lib/services/mercadopago");
  return {
    ...actual,
    fetchPreapproval: fetchPreapprovalMock,
    fetchPayment: fetchPaymentMock
  };
});

import { POST } from "@/app/api/webhooks/mercadopago/route";

const SECRET = "mp-webhook-secret";

function sign(secret: string, ts: string, requestId: string, dataId: string): string {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  return crypto.createHmac("sha256", secret).update(manifest).digest("hex");
}

function req(opts: {
  body: Record<string, unknown>;
  signature?: string;
  requestId?: string;
}) {
  const ts = "1700000000";
  const dataId = String(((opts.body.data as any)?.id) ?? "");
  const signature =
    opts.signature ??
    `ts=${ts},v1=${sign(SECRET, ts, opts.requestId ?? "req-1", dataId)}`;
  const headers = new Map<string, string>();
  headers.set("x-signature", signature);
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
  it("x-signature inválida -> 401 e não processa", async () => {
    const body = { id: "evt-1", type: "subscription_preapproval", data: { id: "pre_1" } };
    const res = await POST(req({ body, signature: "ts=1700000000,v1=deadbeef" }));
    expect(res.status).toBe(401);
    expect(fetchPreapprovalMock).not.toHaveBeenCalled();
    expect(prismaMock.companySubscription.update).not.toHaveBeenCalled();
  });

  it("notificação duplicada (mesmo id) -> 200 e não reprocessa", async () => {
    prismaMock.paymentEvent.findUnique.mockResolvedValue({ id: "ja-existe" });
    const body = { id: "evt-1", type: "subscription_preapproval", data: { id: "pre_1" } };
    const res = await POST(req({ body }));
    expect(res.status).toBe(200);
    expect((await res.json()).duplicate).toBe(true);
    expect(fetchPreapprovalMock).not.toHaveBeenCalled();
    expect(prismaMock.companySubscription.update).not.toHaveBeenCalled();
  });

  it("preapproval authorized -> ACTIVE, currentPeriodEnd empurrado, pastDueSince limpo", async () => {
    fetchPreapprovalMock.mockResolvedValue({
      id: "pre_1",
      status: "authorized",
      external_reference: "sub-1"
    });
    prismaMock.companySubscription.findUnique.mockResolvedValue({
      id: "sub-1",
      pastDueSince: new Date(),
      currentPeriodEnd: null
    });

    const body = { id: "evt-2", type: "subscription_preapproval", data: { id: "pre_1" } };
    const res = await POST(req({ body }));
    expect(res.status).toBe(200);
    expect(prismaMock.paymentEvent.create).toHaveBeenCalledTimes(1);

    const data = prismaMock.companySubscription.update.mock.calls[0][0].data;
    expect(data.status).toBe("ACTIVE");
    expect(data.pastDueSince).toBeNull();
    expect(data.currentPeriodEnd).toBeInstanceOf(Date);
  });

  it("payment rejected -> PAST_DUE e marca pastDueSince", async () => {
    fetchPaymentMock.mockResolvedValue({
      id: "pay_9",
      status: "rejected",
      external_reference: "sub-1",
      preapprovalId: "pre_1"
    });
    prismaMock.companySubscription.findUnique.mockResolvedValue({
      id: "sub-1",
      pastDueSince: null,
      currentPeriodEnd: null
    });

    const body = { id: "evt-3", type: "payment", data: { id: "pay_9" } };
    const res = await POST(req({ body }));
    expect(res.status).toBe(200);

    const data = prismaMock.companySubscription.update.mock.calls[0][0].data;
    expect(data.status).toBe("PAST_DUE");
    expect(data.pastDueSince).toBeInstanceOf(Date);
    expect(data.lastPaymentId).toBe("pay_9");
    expect(data.lastPaymentStatus).toBe("rejected");
  });

  it("preapproval cancelled -> CANCELLED (via fallback gatewaySubscriptionId)", async () => {
    fetchPreapprovalMock.mockResolvedValue({
      id: "pre_99",
      status: "cancelled",
      external_reference: null // sem external_reference -> usa o fallback
    });
    prismaMock.companySubscription.findFirst.mockResolvedValue({
      id: "sub-1",
      pastDueSince: null,
      currentPeriodEnd: null
    });

    const body = { id: "evt-4", type: "subscription_preapproval", data: { id: "pre_99" } };
    const res = await POST(req({ body }));
    expect(res.status).toBe(200);
    expect(prismaMock.companySubscription.findFirst).toHaveBeenCalledWith({
      where: { gatewaySubscriptionId: "pre_99" }
    });
    expect(prismaMock.companySubscription.update.mock.calls[0][0].data.status).toBe("CANCELLED");
  });

  it("evento sem efeito (preapproval pending) -> 200, grava PaymentEvent, sem update", async () => {
    fetchPreapprovalMock.mockResolvedValue({
      id: "pre_1",
      status: "pending",
      external_reference: "sub-1"
    });
    prismaMock.companySubscription.findUnique.mockResolvedValue({
      id: "sub-1",
      pastDueSince: null,
      currentPeriodEnd: null
    });

    const body = { id: "evt-5", type: "subscription_preapproval", data: { id: "pre_1" } };
    const res = await POST(req({ body }));
    expect(res.status).toBe(200);
    expect(prismaMock.paymentEvent.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.companySubscription.update).not.toHaveBeenCalled();
  });

  it("type desconhecido -> 200 ignorado, sem PaymentEvent", async () => {
    const body = { id: "evt-6", type: "merchant_order", data: { id: "x" } };
    const res = await POST(req({ body }));
    expect(res.status).toBe(200);
    expect(prismaMock.paymentEvent.create).not.toHaveBeenCalled();
  });
});
