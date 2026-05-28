import crypto from "crypto";
import { describe, expect, it } from "vitest";

import {
  isPastDueGraceExpired,
  mapMpStatus,
  PAST_DUE_GRACE_DAYS,
  parseMpWebhook,
  pastDueDeadline,
  validateWebhookSignature
} from "@/lib/services/mercadopago";

const DAY = 24 * 60 * 60 * 1000;

describe("mapMpStatus", () => {
  it("preapproval authorized -> ACTIVE, empurra período, limpa atraso", () => {
    expect(mapMpStatus("preapproval", "authorized")).toEqual({
      status: "ACTIVE",
      advancePeriod: true,
      markPastDue: false,
      clearPastDue: true
    });
  });

  it("preapproval cancelled / paused / finished -> CANCELLED", () => {
    expect(mapMpStatus("preapproval", "cancelled")?.status).toBe("CANCELLED");
    expect(mapMpStatus("preapproval", "paused")?.status).toBe("CANCELLED");
    expect(mapMpStatus("preapproval", "finished")?.status).toBe("CANCELLED");
  });

  it("preapproval pending -> null (sem efeito)", () => {
    expect(mapMpStatus("preapproval", "pending")).toBeNull();
  });

  it("payment approved -> ACTIVE", () => {
    expect(mapMpStatus("payment", "approved")?.status).toBe("ACTIVE");
  });

  it("payment rejected / cancelled / charged_back -> PAST_DUE", () => {
    expect(mapMpStatus("payment", "rejected")).toMatchObject({
      status: "PAST_DUE",
      markPastDue: true,
      advancePeriod: false
    });
    expect(mapMpStatus("payment", "cancelled")?.status).toBe("PAST_DUE");
    expect(mapMpStatus("payment", "charged_back")?.status).toBe("PAST_DUE");
  });

  it("payment in_process / pending -> null", () => {
    expect(mapMpStatus("payment", "in_process")).toBeNull();
    expect(mapMpStatus("payment", "pending")).toBeNull();
  });

  it("é case-insensitive e tolera espaços", () => {
    expect(mapMpStatus("preapproval", "  AUTHORIZED  ")?.status).toBe("ACTIVE");
  });

  it("status vazio/nulo -> null", () => {
    expect(mapMpStatus("payment", "")).toBeNull();
    expect(mapMpStatus("payment", null)).toBeNull();
    expect(mapMpStatus("payment", undefined)).toBeNull();
  });
});

describe("validateWebhookSignature", () => {
  const SECRET = "mp-webhook-secret";
  const TS = "1700000000";
  const REQ_ID = "req-123";
  const DATA_ID = "987654321";

  function sign(secret: string, ts: string, requestId: string, dataId: string): string {
    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    return crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  }

  function reqWith(opts: { signature?: string | null; requestId?: string | null }): any {
    const map = new Map<string, string>();
    if (opts.signature != null) map.set("x-signature", opts.signature);
    if (opts.requestId != null) map.set("x-request-id", opts.requestId);
    return { headers: { get: (k: string) => map.get(k.toLowerCase()) ?? null } };
  }

  it("true quando x-signature, x-request-id e data.id batem com o HMAC", () => {
    process.env.MP_WEBHOOK_SECRET = SECRET;
    const v1 = sign(SECRET, TS, REQ_ID, DATA_ID);
    const ok = validateWebhookSignature(
      reqWith({ signature: `ts=${TS},v1=${v1}`, requestId: REQ_ID }),
      { data: { id: DATA_ID } }
    );
    expect(ok).toBe(true);
  });

  it("false quando a assinatura é forjada (HMAC errado)", () => {
    process.env.MP_WEBHOOK_SECRET = SECRET;
    const v1 = sign("OUTRO-SEGREDO", TS, REQ_ID, DATA_ID);
    expect(
      validateWebhookSignature(
        reqWith({ signature: `ts=${TS},v1=${v1}`, requestId: REQ_ID }),
        { data: { id: DATA_ID } }
      )
    ).toBe(false);
  });

  it("false quando o data.id do body é diferente do que foi assinado", () => {
    process.env.MP_WEBHOOK_SECRET = SECRET;
    const v1 = sign(SECRET, TS, REQ_ID, DATA_ID);
    expect(
      validateWebhookSignature(
        reqWith({ signature: `ts=${TS},v1=${v1}`, requestId: REQ_ID }),
        { data: { id: "OUTRO-ID" } }
      )
    ).toBe(false);
  });

  it("false quando x-signature está ausente", () => {
    process.env.MP_WEBHOOK_SECRET = SECRET;
    expect(
      validateWebhookSignature(reqWith({ signature: null, requestId: REQ_ID }), {
        data: { id: DATA_ID }
      })
    ).toBe(false);
  });

  it("false quando x-request-id está ausente", () => {
    process.env.MP_WEBHOOK_SECRET = SECRET;
    const v1 = sign(SECRET, TS, REQ_ID, DATA_ID);
    expect(
      validateWebhookSignature(
        reqWith({ signature: `ts=${TS},v1=${v1}`, requestId: null }),
        { data: { id: DATA_ID } }
      )
    ).toBe(false);
  });

  it("false quando MP_WEBHOOK_SECRET não está configurado (fail-closed)", () => {
    delete process.env.MP_WEBHOOK_SECRET;
    const v1 = sign(SECRET, TS, REQ_ID, DATA_ID);
    expect(
      validateWebhookSignature(
        reqWith({ signature: `ts=${TS},v1=${v1}`, requestId: REQ_ID }),
        { data: { id: DATA_ID } }
      )
    ).toBe(false);
  });

  it("false quando o header x-signature está mal formado", () => {
    process.env.MP_WEBHOOK_SECRET = SECRET;
    expect(
      validateWebhookSignature(reqWith({ signature: "lixo", requestId: REQ_ID }), {
        data: { id: DATA_ID }
      })
    ).toBe(false);
  });
});

describe("parseMpWebhook", () => {
  it("type=subscription_preapproval -> kind preapproval", () => {
    expect(parseMpWebhook({ type: "subscription_preapproval", data: { id: "pre_1" } })).toEqual({
      kind: "preapproval",
      resourceId: "pre_1"
    });
  });

  it("type=payment -> kind payment", () => {
    expect(parseMpWebhook({ type: "payment", data: { id: 4242 } })).toEqual({
      kind: "payment",
      resourceId: "4242"
    });
  });

  it("type=subscription_authorized_payment -> kind payment", () => {
    expect(parseMpWebhook({ type: "subscription_authorized_payment", data: { id: "p_99" } })).toEqual({
      kind: "payment",
      resourceId: "p_99"
    });
  });

  it("type desconhecido -> null", () => {
    expect(parseMpWebhook({ type: "merchant_order", data: { id: "x" } })).toBeNull();
  });

  it("body sem data.id -> null", () => {
    expect(parseMpWebhook({ type: "payment" })).toBeNull();
  });

  it("body inválido -> null", () => {
    expect(parseMpWebhook(null)).toBeNull();
    expect(parseMpWebhook("string")).toBeNull();
    expect(parseMpWebhook({})).toBeNull();
  });
});

describe("régua dos 7 dias (PAST_DUE)", () => {
  it("PAST_DUE_GRACE_DAYS é 7", () => {
    expect(PAST_DUE_GRACE_DAYS).toBe(7);
  });

  it("pastDueDeadline = pastDueSince + 7 dias", () => {
    const since = new Date("2026-05-01T12:00:00.000Z");
    expect(pastDueDeadline(since).getTime()).toBe(since.getTime() + 7 * DAY);
  });

  it("dentro de 7 dias -> ainda ativo (não bloqueia)", () => {
    const now = new Date("2026-05-10T00:00:00.000Z");
    const since = new Date(now.getTime() - 3 * DAY);
    expect(isPastDueGraceExpired(since, now)).toBe(false);
  });

  it("pastDueSince + 7 dias (ou mais) -> bloqueado", () => {
    const now = new Date("2026-05-10T00:00:00.000Z");
    const exactly = new Date(now.getTime() - 7 * DAY);
    const past = new Date(now.getTime() - 8 * DAY);
    expect(isPastDueGraceExpired(exactly, now)).toBe(true);
    expect(isPastDueGraceExpired(past, now)).toBe(true);
  });

  it("sem pastDueSince -> não bloqueia por este motivo", () => {
    expect(isPastDueGraceExpired(null)).toBe(false);
    expect(isPastDueGraceExpired(undefined)).toBe(false);
  });
});
